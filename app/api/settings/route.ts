import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, notFound, ok, parseBody } from "@/lib/api";
import { SettingsSchema } from "@/lib/schemas";
import { updateSettings } from "@/lib/store";

/** GET /api/settings — company profile and preferences. */
export async function GET() {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const { company } = ctx;
  return ok({
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      plan: company.plan,
      createdAt: company.createdAt,
      settings: company.settings,
      // Owners need this to configure GPS hardware; managers do not.
      deviceKey: ctx.session.role === "owner" ? company.deviceKey : undefined,
    },
  });
}

/** PATCH /api/settings — rename the company or change its billing defaults. */
export async function PATCH(req: Request) {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, SettingsSchema);
  if (body instanceof NextResponse) return body;

  const company = await updateSettings(ctx.companyId, body);
  if (!company) return notFound("No such company");
  return ok({ company: { id: company.id, name: company.name, settings: company.settings } });
}
