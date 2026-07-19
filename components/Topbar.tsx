"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { I } from "./Icons";

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const isDark =
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") && matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const flip = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  return (
    <button className="icon-btn" onClick={flip} aria-label="Toggle theme">
      <I name={dark ? "sun" : "moon"} />
    </button>
  );
}

export function Topbar({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {sub && <div className="crumb">{sub}</div>}
      </div>
      <div className="search">
        <I name="search" />
        Search vehicles, drivers, trips…
        <kbd>⌘K</kbd>
      </div>
      {actions}
      <ThemeToggle />
      <Link href="/notifications" className="icon-btn" aria-label="Notifications">
        <I name="bell" />
        <span className="ping" />
      </Link>
      <button
        className="icon-btn"
        aria-label="Log out"
        title="Log out"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/login";
        }}
      >
        <I name="arr" />
      </button>
      <div className="avatar">AR</div>
    </div>
  );
}
