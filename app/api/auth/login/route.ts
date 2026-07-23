import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, getCompany, hashPassword, sessionCookie } from "@/lib/auth";
import { fail, invalid, ok, parseBody } from "@/lib/api";
import { DriverLoginSchema, OwnerLoginSchema } from "@/lib/schemas";
import { bootstrap, findDriverCred, findUserByEmail } from "@/lib/store";

const BodySchema = z.discriminatedUnion("role", [
  OwnerLoginSchema.extend({ role: z.literal("owner") }),
  DriverLoginSchema.extend({ role: z.literal("driver") }),
]);

/** POST /api/auth/login — staff sign in by email, drivers by ID + PIN. */
export async function POST(req: Request) {
  try {
    await bootstrap();
  } catch (err) {
    console.error("Database unavailable:", err);
    return fail("Database unavailable — check the server configuration", 503);
  }

  const body = await parseBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  let token: string;
  let companyId: string;

  if (body.role === "owner") {
    const user = await findUserByEmail(body.email);
    if (!user || user.passwordHash !== hashPassword(body.password)) {
      return invalid({ form: "Wrong email or password" }, 401);
    }
    companyId = (user as typeof user & { companyId: string }).companyId;
    token = await createSession({
      role: user.role,
      companyId,
      userId: user.id,
      name: user.name,
      email: user.email,
    });
  } else {
    const cred = await findDriverCred(body.driverId);
    if (!cred || cred.pin !== body.pin) {
      return invalid({ form: "Wrong driver ID or PIN — ask your owner" }, 401);
    }
    companyId = cred.companyId;
    token = await createSession({
      role: "driver",
      companyId,
      name: cred.name,
      driverId: cred.driverId,
      plate: cred.plate,
    });
  }

  const company = await getCompany(companyId);
  const res = ok({ ok: true, role: body.role, company: company?.name ?? "" });
  res.cookies.set(sessionCookie(token));
  return res;
}
