import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { fail, guard, notFound, ok, parseBody } from "@/lib/api";
import { InvoiceStatusSchema } from "@/lib/schemas";
import { findInvoice, removeInvoice, updateInvoiceStatus } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/invoices/:id */
export async function GET(_req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await routeCtx.params;
  const invoice = await findInvoice(ctx.companyId, id);
  return invoice ? ok({ invoice }) : notFound("No such invoice");
}

/** PATCH /api/invoices/:id — move it through draft → sent → paid. */
export async function PATCH(req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, InvoiceStatusSchema);
  if (body instanceof NextResponse) return body;

  const { id } = await routeCtx.params;
  const invoice = await updateInvoiceStatus(ctx.companyId, id, body.status);
  return invoice ? ok({ invoice }) : notFound("No such invoice");
}

/** DELETE /api/invoices/:id — only while it is still a draft. */
export async function DELETE(_req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await routeCtx.params;
  const invoice = await findInvoice(ctx.companyId, id);
  if (!invoice) return notFound("No such invoice");
  if (invoice.status !== "draft") {
    return fail("Only draft invoices can be deleted — cancel it instead", 409);
  }
  await removeInvoice(ctx.companyId, id);
  return ok({ ok: true });
}
