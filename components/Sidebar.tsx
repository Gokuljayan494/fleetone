"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { I } from "./Icons";

const groups: { label: string | null; items: { href: string; icon: string; label: string; badge?: "maintenance" | "notifications" }[] }[] = [
  { label: null, items: [{ href: "/", icon: "grid", label: "Dashboard" }] },
  {
    label: "Operations",
    items: [
      { href: "/vehicles", icon: "truck", label: "Vehicles" },
      { href: "/drivers", icon: "user", label: "Drivers" },
      { href: "/trips", icon: "route", label: "Trips" },
      { href: "/tracking", icon: "pin", label: "Live Tracking" },
      { href: "/maintenance", icon: "wrench", label: "Maintenance", badge: "maintenance" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/fuel", icon: "fuel", label: "Fuel" },
      { href: "/expenses", icon: "card", label: "Expenses" },
      { href: "/reports", icon: "chart", label: "Reports" },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/customers", icon: "users", label: "Customers" },
      { href: "/documents", icon: "doc", label: "Documents" },
      { href: "/notifications", icon: "bell", label: "Notifications", badge: "notifications" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/billing", icon: "card", label: "Billing" },
      { href: "/team", icon: "users", label: "Team" },
      { href: "/settings", icon: "gear", label: "Settings" },
    ],
  },
];

export function Sidebar() {
  const path = usePathname();
  // Badge counts are the signed-in company's own — never a fixed number.
  const [counts, setCounts] = useState<{ maintenance: number; notifications: number }>({
    maintenance: 0,
    notifications: 0,
  });

  useEffect(() => {
    let live = true;
    Promise.all([
      fetch("/api/maintenance").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/notifications?unread=1").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([m, n]) => {
      if (!live) return;
      setCounts({ maintenance: m?.summary?.open ?? 0, notifications: n?.unread ?? 0 });
    });
    return () => {
      live = false;
    };
    // Re-read on navigation so counts settle after the user acts on them.
  }, [path]);

  return (
    <aside className="sb">
      <div className="brand">
        <span className="logo-mark"><I name="bolt" /></span>
        FleetOne
      </div>
      {groups.map((g, gi) => (
        <div key={gi} style={{ display: "contents" }}>
          {g.label && <div className="grp">{g.label}</div>}
          {g.items.map((it) => (
            <Link key={it.href} href={it.href} className={`nav-i${path === it.href ? " on" : ""}`}>
              <I name={it.icon} />
              {it.label}
              {it.badge && counts[it.badge] > 0 ? <span className="ct">{counts[it.badge]}</span> : null}
            </Link>
          ))}
        </div>
      ))}
      <div className="upgrade">
        <b>Fleet Pro</b>
        <p>Unlock geofencing, fuel-theft alerts &amp; API access.</p>
        <span>Upgrade →</span>
      </div>
    </aside>
  );
}
