import { NextResponse } from "next/server";
import { guard, ok, parseBody } from "@/lib/api";
import { TripEndSchema } from "@/lib/schemas";
import { endTrip, listTrips } from "@/lib/store";

/**
 * GET /api/trips — the company's trips.
 * Drivers only ever see their own; staff see the whole fleet.
 * Optional filters: ?plate=KA 05 MJ 2211 &driver=Suresh Kumar
 */
export async function GET(req: Request) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const q = new URL(req.url).searchParams;
  const trips = await listTrips(ctx.companyId, {
    plate: q.get("plate")?.toUpperCase(),
    // A driver is pinned to their own name regardless of what they ask for.
    driver: ctx.session.role === "driver" ? ctx.session.name : (q.get("driver") ?? undefined),
  });
  return ok({ trips });
}

/** POST /api/trips — close out a completed trip. */
export async function POST(req: Request) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, TripEndSchema);
  if (body instanceof NextResponse) return body;

  // A driver can only file trips under their own name and vehicle.
  const input =
    ctx.session.role === "driver"
      ? { ...body, driver: ctx.session.name, plate: ctx.session.plate }
      : body;

  return ok({ trip: await endTrip(ctx.companyId, input) }, 201);
}
