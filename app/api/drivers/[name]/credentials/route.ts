import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, invalid, notFound, ok, parseBody } from "@/lib/api";
import { DriverCredentialSchema } from "@/lib/schemas";
import { findCredForDriver, findDriver, setDriverCredentials } from "@/lib/store";

type Ctx = { params: Promise<{ name: string }> };

const nameOf = async (ctx: Ctx) => decodeURIComponent((await ctx.params).name);

/**
 * GET /api/drivers/:name/credentials — the driver's login ID.
 * The PIN is never readable; it is shown once when set, then only resettable.
 */
export async function GET(_req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const driver = await findDriver(ctx.companyId, await nameOf(routeCtx));
  if (!driver) return notFound("No such driver in this fleet");

  const cred = await findCredForDriver(ctx.companyId, driver.name);
  return cred
    ? ok({ driverId: cred.driverId, plate: cred.plate, hasPin: Boolean(cred.pin) })
    : notFound("This driver has no login yet");
}

/**
 * PUT /api/drivers/:name/credentials — set a new PIN and/or reissue the ID.
 * Send `{}` to generate a fresh random PIN. Returns the credential once, in
 * full, so the owner can hand it to the driver.
 */
export async function PUT(req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, DriverCredentialSchema);
  if (body instanceof NextResponse) return body;

  const result = await setDriverCredentials(ctx.companyId, await nameOf(routeCtx), {
    driverId: body.driverId || undefined,
    pin: body.pin || undefined,
  });
  if (result === null) return notFound("No such driver in this fleet");
  if (result === "taken") return invalid({ driverId: "That driver ID is taken — pick another" }, 409);

  return ok({ cred: result });
}
