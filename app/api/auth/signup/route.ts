import { NextResponse } from "next/server";
import { createSession, sessionCookie } from "@/lib/auth";
import { fail, invalid, ok, parseBody } from "@/lib/api";
import { SignupSchema } from "@/lib/schemas";
import { bootstrap, createCompany } from "@/lib/store";

/** POST /api/auth/signup — a new company registers and gets its first owner. */
export async function POST(req: Request) {
  try {
    await bootstrap();
  } catch (err) {
    console.error("Database unavailable:", err);
    return fail("Database unavailable — check the server configuration", 503);
  }

  const body = await parseBody(req, SignupSchema);
  if (body instanceof NextResponse) return body;

  // The unique index on users.email decides this, so concurrent signups
  // with the same address cannot both succeed.
  const created = await createCompany(body);
  if (!created) return invalid({ email: "An account with this email already exists" }, 409);

  const { company, user } = created;
  const token = await createSession({
    role: "owner",
    companyId: company.id,
    userId: user.id,
    name: user.name,
    email: user.email,
  });

  const res = ok(
    {
      company: { id: company.id, name: company.name, slug: company.slug, plan: company.plan },
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      deviceKey: company.deviceKey,
    },
    201,
  );
  res.cookies.set(sessionCookie(token));
  return res;
}
