import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, invalid, ok, parseBody } from "@/lib/api";
import { CustomerSchema } from "@/lib/schemas";
import { addCustomer, listCustomers, listInvoices } from "@/lib/store";

/** GET /api/customers — the company's customers with what each still owes. */
export async function GET(req: Request) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const search = new URL(req.url).searchParams.get("search") ?? undefined;
  const [customers, invoices] = await Promise.all([
    listCustomers(ctx.companyId, search),
    listInvoices(ctx.companyId),
  ]);

  return ok({
    customers: customers.map((c) => {
      const theirs = invoices.filter((i) => i.customerId === c.id);
      return {
        ...c,
        invoices: theirs.length,
        billedInr: theirs.reduce((s, i) => s + i.totalInr, 0),
        outstandingInr: theirs
          .filter((i) => i.status === "sent" || i.status === "overdue")
          .reduce((s, i) => s + i.totalInr, 0),
      };
    }),
  });
}

/** POST /api/customers — add a customer to bill. */
export async function POST(req: Request) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, CustomerSchema);
  if (body instanceof NextResponse) return body;

  const customer = await addCustomer(ctx.companyId, body);
  return customer ? ok({ customer }, 201) : invalid({ name: "A customer with this name already exists" }, 409);
}
