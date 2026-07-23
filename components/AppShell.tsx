"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { I } from "./Icons";

/**
 * Owner/manager shell. On desktop the sidebar is a static column; on a phone it
 * becomes an off-canvas drawer opened from the mobile top bar, so the fixed
 * 216px nav no longer eats half the screen.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes (a nav link was tapped).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Stop the page behind the drawer from scrolling while it's open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className={`shell${open ? " nav-open" : ""}`}>
      <header className="mobile-bar">
        <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu">
          <I name="menu" />
        </button>
        <span className="brand-mini">
          <span className="logo-mark"><I name="bolt" /></span>
          FleetOne
        </span>
      </header>

      <button className="nav-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />
      <Sidebar onNavigate={() => setOpen(false)} />

      <div className="main">{children}</div>
    </div>
  );
}
