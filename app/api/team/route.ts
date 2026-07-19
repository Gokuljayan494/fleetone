import { NextResponse } from "next/server";
import { STAFF } from "@/lib/auth";
import { guard, invalid, ok, parseBody } from "@/lib/api";
import { TeamMemberSchema } from "@/lib/schemas";
import { addTeamMember, listTeam } from "@/lib/store";
import type { User } from "@/lib/types";

/** Never leak the password hash. */
const publicUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  createdAt: u.createdAt,
});

/** GET /api/team — the company's office staff (owners and managers). */
export async function GET() {
  const ctx = await guard(STAFF);
  if (ctx instanceof NextResponse) return ctx;
  return ok({ team: (await listTeam(ctx.companyId)).map(publicUser) });
}

/** POST /api/team — invite a manager. Owners only. */
export async function POST(req: Request) {
  const ctx = await guard(["owner"]);
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, TeamMemberSchema);
  if (body instanceof NextResponse) return body;

  const user = await addTeamMember(ctx.companyId, body);
  return user
    ? ok({ user: publicUser(user) }, 201)
    : invalid({ email: "An account with this email already exists" }, 409);
}
