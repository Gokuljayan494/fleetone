import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, notFound, ok } from "@/lib/api";
import { daysUntil, findDocument, removeDocument } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/documents/:id */
export async function GET(_req: Request, routeCtx: Ctx) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await routeCtx.params;
  const doc = await findDocument(ctx.companyId, id);
  if (!doc) return notFound("No such document");

  // A driver may only read their own licence or their vehicle's papers.
  if (ctx.session.role === "driver") {
    const { name, plate } = ctx.session;
    const mine =
      (doc.scope === "driver" && doc.subject === name) || (doc.scope === "vehicle" && doc.subject === plate);
    if (!mine) return notFound("No such document");
  }
  return ok({ document: { ...doc, daysLeft: daysUntil(doc.expiresOn) } });
}

/** DELETE /api/documents/:id */
export async function DELETE(_req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await routeCtx.params;
  const removed = await removeDocument(ctx.companyId, id);
  return removed ? ok({ ok: true }) : notFound("No such document");
}
