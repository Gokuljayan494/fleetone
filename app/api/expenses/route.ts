import { NextResponse } from "next/server";
import { guard, invalid, ok, parseBody } from "@/lib/api";
import { ExpenseSchema } from "@/lib/schemas";
import { addExpense, findVehicle, listExpenses } from "@/lib/store";

/** GET /api/expenses — running costs. Filters: ?plate= &category= &from= &to= */
export async function GET(req: Request) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const q = new URL(req.url).searchParams;
  const expenses = await listExpenses(ctx.companyId, {
    plate: q.get("plate")?.toUpperCase(),
    category: q.get("category") ?? undefined,
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
    // Drivers only see what they filed.
    driver: ctx.session.role === "driver" ? ctx.session.name : undefined,
  });

  const byCategory: Record<string, number> = {};
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amountInr;

  return ok({
    expenses,
    summary: { count: expenses.length, totalInr: expenses.reduce((s, e) => s + e.amountInr, 0), byCategory },
  });
}

/** POST /api/expenses — log a toll, fine, repair or other running cost. */
export async function POST(req: Request) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, ExpenseSchema);
  if (body instanceof NextResponse) return body;

  // Drivers file expenses under their own name, against their own vehicle.
  const input =
    ctx.session.role === "driver"
      ? { ...body, driver: ctx.session.name, plate: ctx.session.plate }
      : body;

  if (!(await findVehicle(ctx.companyId, input.plate))) {
    return invalid({ plate: "No such vehicle in this fleet" }, 404);
  }
  return ok({ expense: await addExpense(ctx.companyId, input) }, 201);
}
