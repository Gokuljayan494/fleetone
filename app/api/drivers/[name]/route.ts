import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, notFound, ok, parseBody } from "@/lib/api";
import { DriverPatchSchema } from "@/lib/schemas";
import {
  findCredForDriver,
  findDriver,
  listDocuments,
  listExpenses,
  listTrips,
  removeDriver,
  updateDriver,
} from "@/lib/store";

type Ctx = { params: Promise<{ name: string }> };

const nameOf = async (ctx: Ctx) => decodeURIComponent((await ctx.params).name);

/** GET /api/drivers/:name — one driver with their trips, expenses and login ID. */
export async function GET(_req: Request, routeCtx: Ctx) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const driver = await findDriver(ctx.companyId, await nameOf(routeCtx));
  if (!driver) return notFound("No such driver in this fleet");

  const [cred, trips, expenses, documents] = await Promise.all([
    findCredForDriver(ctx.companyId, driver.name),
    listTrips(ctx.companyId, { driver: driver.name }),
    listExpenses(ctx.companyId, { driver: driver.name }),
    listDocuments(ctx.companyId, { scope: "driver", subject: driver.name }),
  ]);

  return ok({
    driver,
    // The PIN is deliberately omitted — it is shown once, when the driver is created.
    login: cred ? { driverId: cred.driverId, plate: cred.plate } : null,
    trips,
    expenses,
    documents,
  });
}

/** PATCH /api/drivers/:name — reassign a vehicle or renew a licence. */
export async function PATCH(req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, DriverPatchSchema);
  if (body instanceof NextResponse) return body;

  const driver = await updateDriver(ctx.companyId, await nameOf(routeCtx), body);
  return driver ? ok({ driver }) : notFound("No such driver in this fleet");
}

/** DELETE /api/drivers/:name — offboard a driver and revoke their login. */
export async function DELETE(_req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const removed = await removeDriver(ctx.companyId, await nameOf(routeCtx));
  return removed ? ok({ ok: true }) : notFound("No such driver in this fleet");
}
