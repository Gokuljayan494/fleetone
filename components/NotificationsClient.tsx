"use client";
import { useEffect, useState } from "react";
import { I } from "./Icons";
import { Badge } from "./ui";
import type { Notification } from "@/lib/types";

/** Relative time, so the feed reads like the rest of the product. */
function ago(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationsClient() {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.notifications ?? []);
        setUnread(d.unread ?? 0);
      })
      .catch(() => setItems([]));
  }, []);

  async function markAll() {
    setBusy(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setItems((prev) => prev?.map((n) => ({ ...n, unread: false })) ?? null);
        setUnread(0);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="content">
      <div className="card" style={{ padding: 6, maxWidth: 640 }}>
        <div className="card-h" style={{ padding: "10px 12px 6px" }}>
          <h3>All activity</h3>
          {unread > 0 && <Badge tone="ind">{unread} new</Badge>}
          <div className="right">
            {unread > 0 && (
              <button
                onClick={markAll}
                disabled={busy}
                style={{
                  fontSize: 10.5,
                  color: "var(--soft)",
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  padding: 0,
                }}
              >
                {busy ? "Marking…" : "Mark all read"}
              </button>
            )}
          </div>
        </div>

        {!items ? (
          <div className="crumb" style={{ padding: 12 }}>Loading activity…</div>
        ) : items.length === 0 ? (
          <div className="crumb" style={{ padding: "18px 12px" }}>
            Nothing yet — alerts appear here as you run your fleet.
          </div>
        ) : (
          items.map((n) => (
            <div key={n.id} className="ntf">
              <span className="nico" style={{ background: `var(--${n.tone}-soft)`, color: `var(--${n.tone}-ink)` }}>
                <I name={n.icon} />
              </span>
              <div>
                <b>{n.title}</b>
                <p>{n.body}</p>
              </div>
              <span className="when">{ago(n.createdAt)}</span>
              {n.unread && <span className="unread" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
