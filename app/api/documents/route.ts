import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, ok, parseBody } from "@/lib/api";
import { DocumentSchema } from "@/lib/schemas";
import { addDocument, daysUntil, listDocuments } from "@/lib/store";

/**
 * GET /api/documents — RCs, insurance, permits, licences.
 * Filters: ?scope=vehicle|driver &subject= &kind= &expiring=<days>
 */
export async function GET(req: Request) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const q = new URL(req.url).searchParams;
  const raw = await listDocuments(ctx.companyId, {
    scope: q.get("scope") ?? undefined,
    subject: q.get("subject") ?? undefined,
    kind: q.get("kind") ?? undefined,
  });

  let docs = raw.map((d) => ({ ...d, daysLeft: daysUntil(d.expiresOn) }));

  // A driver sees their own licence plus the papers for the vehicle they drive.
  if (ctx.session.role === "driver") {
    const { name, plate } = ctx.session;
    docs = docs.filter(
      (d) => (d.scope === "driver" && d.subject === name) || (d.scope === "vehicle" && d.subject === plate),
    );
  }

  const expiring = q.get("expiring");
  if (expiring) docs = docs.filter((d) => d.daysLeft <= Number(expiring));
  docs.sort((a, b) => a.daysLeft - b.daysLeft);

  const alertDays = ctx.company.settings.documentAlertDays;
  return ok({
    documents: docs,
    summary: {
      total: docs.length,
      expired: docs.filter((d) => d.daysLeft < 0).length,
      expiringSoon: docs.filter((d) => d.daysLeft >= 0 && d.daysLeft <= alertDays).length,
      alertDays,
    },
  });
}

/** POST /api/documents — file a document with its expiry date. */
export async function POST(req: Request) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, DocumentSchema);
  if (body instanceof NextResponse) return body;

  const doc = await addDocument(ctx.companyId, body);
  return ok({ document: { ...doc, daysLeft: daysUntil(doc.expiresOn) } }, 201);
}
