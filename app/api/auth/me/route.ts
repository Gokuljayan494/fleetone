import { NextResponse } from "next/server";
import { guard, ok } from "@/lib/api";

/** GET /api/auth/me — who am I and which company am I in. */
export async function GET() {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;
  const { session, company } = ctx;
  return ok({
    session,
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      plan: company.plan,
      settings: company.settings,
    },
  });
}
