import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, notFound, ok } from "@/lib/api";
import { findExpense, removeExpense } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/expenses/:id */
export async function GET(_req: Request, routeCtx: Ctx) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await routeCtx.params;
  const expense = await findExpense(ctx.companyId, id);
  if (!expense) return notFound("No such expense");
  // A driver may only read back their own.
  if (ctx.session.role === "driver" && expense.driver !== ctx.session.name) {
    return notFound("No such expense");
  }
  return ok({ expense });
}

/** DELETE /api/expenses/:id */
export async function DELETE(_req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await routeCtx.params;
  const removed = await removeExpense(ctx.companyId, id);
  return removed ? ok({ ok: true }) : notFound("No such expense");
}
