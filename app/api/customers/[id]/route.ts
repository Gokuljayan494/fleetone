import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { fail, guard, notFound, ok, parseBody } from "@/lib/api";
import { CustomerPatchSchema } from "@/lib/schemas";
import {
  countInvoicesForCustomer,
  findCustomer,
  listInvoices,
  listTrips,
  removeCustomer,
  updateCustomer,
} from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/customers/:id — a customer with their invoices and trips. */
export async function GET(_req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await routeCtx.params;
  const customer = await findCustomer(ctx.companyId, id);
  if (!customer) return notFound("No such customer");

  const [invoices, allTrips] = await Promise.all([
    listInvoices(ctx.companyId, { customerId: id }),
    listTrips(ctx.companyId),
  ]);

  return ok({ customer, invoices, trips: allTrips.filter((t) => t.customer === customer.name) });
}

/** PATCH /api/customers/:id */
export async function PATCH(req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, CustomerPatchSchema);
  if (body instanceof NextResponse) return body;

  const { id } = await routeCtx.params;
  const customer = await updateCustomer(ctx.companyId, id, body);
  return customer ? ok({ customer }) : notFound("No such customer");
}

/** DELETE /api/customers/:id — refused while they still have invoices. */
export async function DELETE(_req: Request, routeCtx: Ctx) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await routeCtx.params;
  if (!(await findCustomer(ctx.companyId, id))) return notFound("No such customer");
  if (await countInvoicesForCustomer(ctx.companyId, id)) {
    return fail("This customer has invoices — delete those first", 409);
  }
  await removeCustomer(ctx.companyId, id);
  return ok({ ok: true });
}
