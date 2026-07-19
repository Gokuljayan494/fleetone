import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, invalid, ok, parseBody } from "@/lib/api";
import { DriverSchema } from "@/lib/schemas";
import { addDriver, listDrivers } from "@/lib/store";

/** GET /api/drivers — the company's drivers. */
export async function GET() {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;
  return ok({ drivers: await listDrivers(ctx.companyId) });
}

/** POST /api/drivers — hire a driver; returns the login credentials to hand them. */
export async function POST(req: Request) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, DriverSchema);
  if (body instanceof NextResponse) return body;

  const created = await addDriver(ctx.companyId, body);
  return created ? ok(created, 201) : invalid({ name: "A driver with this name already exists" }, 409);
}
