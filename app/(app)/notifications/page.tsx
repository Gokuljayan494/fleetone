import { Topbar } from "@/components/Topbar";
import { NotificationsClient } from "@/components/NotificationsClient";
import { getSession } from "@/lib/auth";
import { bootstrap, countUnread } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await bootstrap();
  const session = await getSession();
  const unread = session ? await countUnread(session.companyId) : 0;

  return (
    <>
      <Topbar
        title="Notifications"
        sub={unread ? `${unread} new · maintenance, insurance & route alerts` : "Maintenance, insurance & route alerts"}
      />
      <NotificationsClient />
    </>
  );
}
