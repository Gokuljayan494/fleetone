import { NextResponse } from "next/server";
import { guard, ok, parseBody } from "@/lib/api";
import { NotificationsReadSchema } from "@/lib/schemas";
import { countUnread, listNotifications, markNotificationsRead } from "@/lib/store";

/** GET /api/notifications — the company's alert feed. ?unread=1 for just the new ones. */
export async function GET(req: Request) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const unreadOnly = new URL(req.url).searchParams.get("unread") === "1";
  const [notifications, unread] = await Promise.all([
    listNotifications(ctx.companyId, unreadOnly),
    countUnread(ctx.companyId),
  ]);
  return ok({ notifications, unread });
}

/** PATCH /api/notifications — mark some or all as read. */
export async function PATCH(req: Request) {
  const ctx = await guard();
  if (ctx instanceof NextResponse) return ctx;

  const body = await parseBody(req, NotificationsReadSchema);
  if (body instanceof NextResponse) return body;

  const marked = await markNotificationsRead(ctx.companyId, body.ids);
  return ok({ marked, unread: await countUnread(ctx.companyId) });
}
