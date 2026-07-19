import { NextResponse } from "next/server";
import type { z } from "zod";
import { ANYONE, requireTenant, type Role, type Session } from "./auth";
import { fieldErrors } from "./schemas";
import { bootstrap } from "./store";
import type { Company } from "./types";

/**
 * Small helpers so every route handler reads the same way:
 *   const ctx = await guard(STAFF); if (ctx instanceof NextResponse) return ctx;
 *   const body = await parseBody(req, Schema); if (body instanceof NextResponse) return body;
 */

export const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });

export const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export const invalid = (errors: Record<string, string>, status = 400) => NextResponse.json({ errors }, { status });

export const notFound = (what = "Not found") => fail(what, 404);

export type Ctx = { session: Session; company: Company; companyId: string };

/** Resolves the caller's session + company, or returns the 401/403/503 response. */
export async function guard(roles: Role[] = ANYONE): Promise<Ctx | NextResponse> {
  try {
    await bootstrap();
  } catch (err) {
    // A missing MONGODB_URI or an unreachable cluster is an outage, not a 401.
    console.error("Database unavailable:", err);
    return fail("Database unavailable — check the server configuration", 503);
  }

  const ctx = await requireTenant(roles);
  if (ctx) return ctx;
  // Distinguish "not signed in" from "signed in but not allowed".
  const any = await requireTenant(ANYONE);
  return any ? fail("You do not have access to this", 403) : fail("Sign in first", 401);
}

/** Parses and validates the JSON body, or returns the 400 response. */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<z.infer<S> | NextResponse> {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return invalid(fieldErrors(parsed.error));
  return parsed.data;
}
