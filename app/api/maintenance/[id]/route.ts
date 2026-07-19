import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, notFound, ok, parseBody } from "@/lib/api";
import { MaintenancePatchSchema } from "@/lib/schemas";
import { daysUntil, findMaintenance, removeMaintenance, updateMaintenance } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/maintenance/:id */
export async function GET(_req: Request, routeCtx: Ctx) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await routeCtx.params;
  const record = await findMaintenance(ctx.companyId, id);
  return record ? ok({ record: { ...record, daysLeft: daysUntil(record.dueDate) } }) : notFound("No such service job");
}

/** PATCH /api/maintenance/:id — reschedule, cost it, or mark it done. */
export async function PATCH(req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, MaintenancePatchSchema);
  if (body instanceof NextResponse) return body;

  const { id } = await routeCtx.params;
  const record = await updateMaintenance(ctx.companyId, id, body);
  return record ? ok({ record }) : notFound("No such service job");
}

/** DELETE /api/maintenance/:id */
export async function DELETE(_req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await routeCtx.params;
  const removed = await removeMaintenance(ctx.companyId, id);
  return removed ? ok({ ok: true }) : notFound("No such service job");
}
