import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, invalid, ok, parseBody } from "@/lib/api";
import { MaintenanceSchema } from "@/lib/schemas";
import { addMaintenance, daysUntil, findVehicle, listMaintenance } from "@/lib/store";

/** GET /api/maintenance — service jobs. Filters: ?plate= &status= &due=<days> */
export async function GET(req: Request) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const q = new URL(req.url).searchParams;
  const all = await listMaintenance(ctx.companyId);

  let records = all;
  const plate = q.get("plate")?.toUpperCase();
  const status = q.get("status");
  const due = q.get("due");
  if (plate) records = records.filter((m) => m.plate === plate);
  if (status) records = records.filter((m) => m.status === status);
  if (due) {
    const within = Number(due);
    records = records.filter((m) => m.status !== "done" && daysUntil(m.dueDate) <= within);
  }

  return ok({
    maintenance: records.map((m) => ({ ...m, daysLeft: daysUntil(m.dueDate) })),
    summary: {
      open: all.filter((m) => m.status !== "done").length,
      overdue: all.filter((m) => m.status !== "done" && daysUntil(m.dueDate) < 0).length,
      spendInr: all.reduce((s, m) => s + (m.costInr ?? 0), 0),
    },
  });
}

/** POST /api/maintenance — schedule a service job. */
export async function POST(req: Request) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, MaintenanceSchema);
  if (body instanceof NextResponse) return body;

  if (!(await findVehicle(ctx.companyId, body.plate))) {
    return invalid({ plate: "No such vehicle in this fleet" }, 404);
  }
  return ok({ record: await addMaintenance(ctx.companyId, body) }, 201);
}
