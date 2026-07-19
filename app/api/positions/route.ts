import { NextResponse } from "next/server";
import { fail, guard, invalid, ok } from "@/lib/api";
import { companyFromDeviceKey } from "@/lib/auth";
import { PositionSchema, fieldErrors } from "@/lib/schemas";
import { bootstrap, detectStops, findVehicle, getTrack, livePositions, upsertPosition } from "@/lib/store";

/** GET /api/positions — live positions, breadcrumb tracks and detected stops. */
export async function GET() {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const { companyId, session } = ctx;
  const positions = await livePositions(companyId, session.role === "driver" ? session.plate : undefined);

  const tracks: Record<string, { lat: number; lng: number }[]> = {};
  const stops: Record<string, { lat: number; lng: number }[]> = {};
  await Promise.all(
    positions.map(async (p) => {
      const t = await getTrack(companyId, p.plate);
      tracks[p.plate] = t.map(({ lat, lng }) => ({ lat, lng }));
      stops[p.plate] = detectStops(t).map(({ lat, lng }) => ({ lat, lng }));
    }),
  );
  return ok({ positions, tracks, stops });
}

/**
 * POST /api/positions — a GPS ping.
 * Accepts either a signed-in session or a company's `x-device-key` header,
 * which is how hardware trackers report without a browser.
 */
export async function POST(req: Request) {
  let companyId: string;
  let lockedPlate: string | null = null;

  const deviceKey = req.headers.get("x-device-key");
  if (deviceKey) {
    try {
      await bootstrap();
    } catch (err) {
      console.error("Database unavailable:", err);
      return fail("Database unavailable — check the server configuration", 503);
    }
    const company = await companyFromDeviceKey(deviceKey);
    if (!company) return fail("Sign in first", 401);
    companyId = company.id;
  } else {
    const ctx = await guard();
    if (ctx instanceof NextResponse) return ctx;
    companyId = ctx.companyId;
    if (ctx.session.role === "driver") lockedPlate = ctx.session.plate;
  }

  const parsed = PositionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(fieldErrors(parsed.error));

  // A driver's phone can only report the vehicle they are signed in to.
  const plate = lockedPlate ?? parsed.data.plate.toUpperCase();
  if (!(await findVehicle(companyId, plate))) {
    return fail("No such vehicle in this fleet", 404);
  }

  await upsertPosition(companyId, { ...parsed.data, plate });
  return ok({ ok: true });
}
