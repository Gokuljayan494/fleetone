import { NextResponse } from "next/server";
import { guard, invalid, ok, parseBody } from "@/lib/api";
import { FuelLogSchema } from "@/lib/schemas";
import { addFuelLog, findVehicle, lastFuelLog, listFuelLogs } from "@/lib/store";

/** GET /api/fuel — fuel logs, newest first. Optional ?plate= filter. */
export async function GET(req: Request) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const plate = new URL(req.url).searchParams.get("plate")?.toUpperCase();
  const logs = await listFuelLogs(ctx.companyId, plate);

  const rated = logs.filter((f) => f.kmpl !== null);
  return ok({
    logs,
    summary: {
      entries: logs.length,
      litres: Math.round(logs.reduce((s, f) => s + f.litres, 0) * 10) / 10,
      spendInr: logs.reduce((s, f) => s + f.amountInr, 0),
      avgKmpl: rated.length
        ? Math.round((rated.reduce((s, f) => s + (f.kmpl ?? 0), 0) / rated.length) * 10) / 10
        : null,
    },
  });
}

/** POST /api/fuel — record a refuel; mileage is derived from the previous odometer. */
export async function POST(req: Request) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, FuelLogSchema);
  if (body instanceof NextResponse) return body;

  // Drivers log fuel only against the vehicle they are signed in to.
  const plate = ctx.session.role === "driver" ? ctx.session.plate : body.plate;

  if (!(await findVehicle(ctx.companyId, plate))) {
    return invalid({ plate: "No such vehicle in this fleet" }, 404);
  }

  const prev = await lastFuelLog(ctx.companyId, plate);
  if (prev && body.odometer <= prev.odometer) {
    return invalid({
      odometer: `Must be above the last reading (${prev.odometer.toLocaleString("en-IN")})`,
    });
  }

  return ok({ log: await addFuelLog(ctx.companyId, { ...body, plate }) }, 201);
}
