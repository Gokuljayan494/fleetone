import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, ok } from "@/lib/api";
import { buildReport, expiringDocuments } from "@/lib/store";

/** GET /api/reports — the numbers behind the dashboard, computed from live data. */
export async function GET() {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const alertDays = ctx.company.settings.documentAlertDays;
  const [report, docs] = await Promise.all([
    buildReport(ctx.companyId, alertDays),
    expiringDocuments(ctx.companyId, alertDays),
  ]);

  return ok({
    company: { id: ctx.company.id, name: ctx.company.name },
    ...report,
    expiringDocuments: docs.slice(0, 10),
    generatedAt: Date.now(),
  });
}
