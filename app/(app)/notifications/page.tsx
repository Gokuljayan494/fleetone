import { Topbar } from "@/components/Topbar";
import { I } from "@/components/Icons";
import { Badge } from "@/components/ui";
import { notifications } from "@/data/fleet";

export default function NotificationsPage() {
  return (
    <>
      <Topbar title="Notifications" sub="6 new · maintenance, insurance & route alerts" />
      <div className="content">
        <div className="card" style={{ padding: 6, maxWidth: 640 }}>
          <div className="card-h" style={{ padding: "10px 12px 6px" }}>
            <h3>All activity</h3>
            <Badge tone="ind">6 new</Badge>
            <div className="right">
              <span style={{ fontSize: 10.5, color: "var(--soft)", fontWeight: 600, cursor: "pointer" }}>Mark all read</span>
            </div>
          </div>
          {notifications.map((n) => (
            <div key={n.title} className="ntf">
              <span className="nico" style={{ background: `var(--${n.tone}-soft)`, color: `var(--${n.tone}-ink)` }}>
                <I name={n.icon} />
              </span>
              <div>
                <b>{n.title}</b>
                <p>{n.body}</p>
              </div>
              <span className="when">{n.when}</span>
              {n.unread && <span className="unread" />}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
