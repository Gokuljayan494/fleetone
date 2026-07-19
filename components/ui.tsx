import type { ReactNode } from "react";
import type { Status } from "@/data/fleet";
import { I } from "./Icons";

export function Badge({ tone, children }: { tone: Status; children: ReactNode }) {
  return (
    <span className={`badge b-${tone}`}>
      <span className="d" />
      {children}
    </span>
  );
}

export function Av({ g, children, size }: { g: string; children: ReactNode; size?: "md" | "lg" }) {
  return <span className={`av ${g}${size ? ` ${size}` : ""}`}>{children}</span>;
}

export function Bar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div className="bar">
      <i style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}

export function Ring({ score }: { score: number }) {
  const C = 2 * Math.PI * 22;
  const color = score >= 80 ? "var(--emr)" : score >= 60 ? "var(--org)" : "var(--red)";
  return (
    <div className="ring">
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r="22" fill="none" stroke="var(--hair)" strokeWidth="5" />
        <circle cx="26" cy="26" r="22" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} />
      </svg>
      <b>{score}</b>
    </div>
  );
}

export function Stars({ on }: { on: number }) {
  return (
    <span className="stars">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} className={i < on ? undefined : "off"}>
          <use href="#i-star" />
        </svg>
      ))}
    </span>
  );
}

export function Sparkline({ points, color, fill = true }: { points: number[]; color: string; fill?: boolean }) {
  const xs = points.map((_, i) => 2 + (i * 72) / (points.length - 1));
  const line = points.map((y, i) => `${i === 0 ? "M" : "L"}${xs[i]} ${y}`).join(" ");
  const last = { x: xs[xs.length - 1], y: points[points.length - 1] };
  return (
    <svg className="spark" viewBox="0 0 76 30">
      {fill && <path d={`${line} L74 30 L2 30 Z`} fill={color} opacity=".1" />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r="2.6" fill={color} />
    </svg>
  );
}

export function VehicleArt({ kind, stroke, tint, status, tone }: { kind: string; stroke: string; tint: string; status: string; tone: Status }) {
  return (
    <div className="vphoto" style={{ background: tint }}>
      <Badge tone={tone}>{status}</Badge>
      <svg viewBox="0 0 120 70">
        <g fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {kind === "van" ? (
            <>
              <path d="M8 44h62V16H8zM70 26h22l14 10v8h-8" />
              <circle cx="26" cy="50" r="7" fill="rgba(255,255,255,.7)" />
              <circle cx="88" cy="50" r="7" fill="rgba(255,255,255,.7)" />
              <path d="M8 30h62M78 26v10h22" />
            </>
          ) : (
            <>
              <path d="M6 46h74V12H6zM80 22h20l14 14v10h-8" />
              <circle cx="24" cy="52" r="7" fill="rgba(255,255,255,.7)" />
              <circle cx="92" cy="52" r="7" fill="rgba(255,255,255,.7)" />
            </>
          )}
        </g>
      </svg>
    </div>
  );
}

export function VehDot({ tone, kind }: { tone: string; kind: string }) {
  return (
    <span className="veh-dot" style={{ background: `var(--${tone}-soft)`, color: `var(--${tone === "ind" ? "ind" : tone})` }}>
      <I name={kind === "van" ? "van" : "truck"} />
    </span>
  );
}
