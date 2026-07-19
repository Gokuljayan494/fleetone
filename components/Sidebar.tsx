"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { I } from "./Icons";

const groups: { label: string | null; items: { href: string; icon: string; label: string; count?: number }[] }[] = [
  { label: null, items: [{ href: "/", icon: "grid", label: "Dashboard" }] },
  {
    label: "Operations",
    items: [
      { href: "/vehicles", icon: "truck", label: "Vehicles" },
      { href: "/drivers", icon: "user", label: "Drivers" },
      { href: "/trips", icon: "route", label: "Trips" },
      { href: "/tracking", icon: "pin", label: "Live Tracking" },
      { href: "/maintenance", icon: "wrench", label: "Maintenance", count: 3 },
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
      { href: "/notifications", icon: "bell", label: "Notifications", count: 6 },
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
              {it.count ? <span className="ct">{it.count}</span> : null}
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
