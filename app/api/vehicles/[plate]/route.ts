import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, notFound, ok, parseBody } from "@/lib/api";
import { VehiclePatchSchema } from "@/lib/schemas";
import {
  detectStops,
  findVehicle,
  getTrack,
  listExpenses,
  listFuelLogs,
  listMaintenance,
  listTrips,
  removeVehicle,
  updateVehicle,
} from "@/lib/store";
import * as C from "@/lib/db";

type Ctx = { params: Promise<{ plate: string }> };

/** Plates carry spaces ("KA 05 MJ 2211"), so they arrive URL-encoded. */
const plateOf = async (ctx: Ctx) => decodeURIComponent((await ctx.params).plate).toUpperCase();

/** GET /api/vehicles/:plate — one vehicle with its live position and recent history. */
export async function GET(_req: Request, routeCtx: Ctx) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const plate = await plateOf(routeCtx);
  const vehicle = await findVehicle(ctx.companyId, plate);
  if (!vehicle) return notFound("No such vehicle in this fleet");

  const [track, position, fuelLogs, maintenance, expenses, trips] = await Promise.all([
    getTrack(ctx.companyId, plate),
    (await C.positions()).findOne({ companyId: ctx.companyId, plate }, { projection: { _id: 0, companyId: 0 } }),
    listFuelLogs(ctx.companyId, plate),
    listMaintenance(ctx.companyId, { plate }),
    listExpenses(ctx.companyId, { plate }),
    listTrips(ctx.companyId, { plate }),
  ]);

  return ok({ vehicle, position, track, stops: detectStops(track), fuelLogs, maintenance, expenses, trips });
}

/** PATCH /api/vehicles/:plate — update model, driver, mileage, odometer or status. */
export async function PATCH(req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, VehiclePatchSchema);
  if (body instanceof NextResponse) return body;

  const vehicle = await updateVehicle(ctx.companyId, await plateOf(routeCtx), body);
  return vehicle ? ok({ vehicle }) : notFound("No such vehicle in this fleet");
}

/** DELETE /api/vehicles/:plate — retire a vehicle. */
export async function DELETE(_req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const removed = await removeVehicle(ctx.companyId, await plateOf(routeCtx));
  return removed ? ok({ ok: true }) : notFound("No such vehicle in this fleet");
}
