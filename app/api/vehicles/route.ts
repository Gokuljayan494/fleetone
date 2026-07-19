import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, invalid, ok, parseBody } from "@/lib/api";
import { VehicleSchema } from "@/lib/schemas";
import { addVehicle, listVehicles } from "@/lib/store";

/** GET /api/vehicles — the company's fleet. */
export async function GET() {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;
  return ok({ vehicles: await listVehicles(ctx.companyId) });
}

/** POST /api/vehicles — add a vehicle to the company's fleet. */
export async function POST(req: Request) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, VehicleSchema);
  if (body instanceof NextResponse) return body;

  // The unique index on {companyId, plate} rejects duplicates atomically.
  const vehicle = await addVehicle(ctx.companyId, body);
  return vehicle ? ok({ vehicle }, 201) : invalid({ plate: "This plate is already in the fleet" }, 409);
}
