import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, invalid, ok, parseBody } from "@/lib/api";
import { InvoiceSchema } from "@/lib/schemas";
import { addInvoice, listInvoices } from "@/lib/store";

/** GET /api/invoices — billing. Filters: ?status= &customerId= */
export async function GET(req: Request) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const q = new URL(req.url).searchParams;
  const [invoices, all] = await Promise.all([
    listInvoices(ctx.companyId, {
      status: q.get("status") ?? undefined,
      customerId: q.get("customerId") ?? undefined,
    }),
    listInvoices(ctx.companyId),
  ]);

  const sum = (s: string) => all.filter((i) => i.status === s).reduce((n, i) => n + i.totalInr, 0);
  return ok({
    invoices,
    summary: {
      count: all.length,
      draftInr: sum("draft"),
      sentInr: sum("sent"),
      overdueInr: sum("overdue"),
      paidInr: sum("paid"),
      outstandingInr: sum("sent") + sum("overdue"),
    },
  });
}

/** POST /api/invoices — raise an invoice against a customer. */
export async function POST(req: Request) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, InvoiceSchema);
  if (body instanceof NextResponse) return body;

  const invoice = await addInvoice(ctx.companyId, body);
  return invoice ? ok({ invoice }, 201) : invalid({ customerId: "No such customer" }, 404);
}
