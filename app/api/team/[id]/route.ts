import { NextResponse } from "next/server";
import { destroySessionsForUser } from "@/lib/auth";
import { fail, guard, notFound, ok } from "@/lib/api";
import { countOwners, findTeamMember, removeTeamMember } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/team/:id — remove a colleague. Owners only. */
export async function DELETE(_req: Request, routeCtx: Ctx) {
  const ctx = await guard(["owner"]);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await routeCtx.params;
  const target = await findTeamMember(ctx.companyId, id);
  if (!target) return notFound("No such team member");

  if (target.role === "owner" && (await countOwners(ctx.companyId)) === 1) {
    return fail("A company must keep at least one owner", 409);
  }

  await removeTeamMember(ctx.companyId, id);
  // Their existing sessions must stop working immediately.
  await destroySessionsForUser(id);
  return ok({ ok: true });
}
