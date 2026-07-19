"use client";
import { useRef, useState } from "react";
import { revenueSeries } from "@/data/fleet";

const XS = [70, 162, 254, 346, 438, 530];
const TOP = 24, BOT = 200, MAXL = 15;
const y = (v: number) => BOT - (v / MAXL) * (BOT - TOP);

export function RevenueChart() {
  const { months, revenue, expenses } = revenueSeries;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [tipLeft, setTipLeft] = useState(0);

  const revY = revenue.map(y);
  const expY = expenses.map(y);
  const line = (ys: number[]) => ys.map((v, i) => `${i === 0 ? "M" : "L"}${XS[i]} ${v}`).join(" ");

  const onMove = (ev: React.MouseEvent<SVGSVGElement>) => {
    const svg = ev.currentTarget;
    const r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) * 588) / r.width;
    let best = 0, bd = Infinity;
    XS.forEach((px, k) => {
      const d = Math.abs(px - x);
      if (d < bd) { bd = d; best = k; }
    });
    setHover(best);
    const wr = wrapRef.current?.getBoundingClientRect();
    if (wr) {
      const px = (XS[best] * r.width) / 588 + (r.left - wr.left);
      setTipLeft(Math.min(Math.max(px - 70, 4), wr.width - 160));
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", padding: "6px 14px 12px" }}>
      <svg viewBox="0 0 588 230" style={{ width: "100%", display: "block" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <g className="gridln">
          {[24, 72, 120, 168].map((gy) => <line key={gy} x1="44" y1={gy} x2="548" y2={gy} />)}
        </g>
        <line x1="44" y1="200" x2="548" y2="200" stroke="var(--line)" strokeWidth="1.2" />
        <g className="axis">
          <text x="36" y="27" textAnchor="end">15L</text>
          <text x="36" y="75" textAnchor="end">10L</text>
          <text x="36" y="123" textAnchor="end">5L</text>
          <text x="36" y="203" textAnchor="end">0</text>
        </g>
        <g className="axis" textAnchor="middle">
          {months.map((m, i) => <text key={m} x={XS[i]} y="219">{m}</text>)}
        </g>
        <path d={`${line(revY)} L530 200 L70 200 Z`} fill="var(--c1)" opacity=".08" />
        <path d={line(revY)} fill="none" stroke="var(--c1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={line(expY)} fill="none" stroke="var(--c4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="530" cy={revY[5]} r="4" fill="var(--c1)" stroke="var(--card)" strokeWidth="2" />
        <circle cx="530" cy={expY[5]} r="4" fill="var(--c4)" stroke="var(--card)" strokeWidth="2" />
        <text x="540" y={revY[5] - 4} className="axis" fontWeight="700" fill="var(--ink)">₹12.4L</text>
        <text x="540" y={expY[5] + 4} className="axis" fontWeight="700" fill="var(--ink)">₹4.5L</text>
        {hover !== null && (
          <g>
            <line x1={XS[hover]} x2={XS[hover]} y1="24" y2="200" stroke="var(--soft)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={XS[hover]} cy={revY[hover]} r="4.5" fill="var(--c1)" stroke="var(--card)" strokeWidth="2" />
            <circle cx={XS[hover]} cy={expY[hover]} r="4.5" fill="var(--c4)" stroke="var(--card)" strokeWidth="2" />
          </g>
        )}
      </svg>
      <div className="chart-tip" style={{ left: tipLeft, top: 8, opacity: hover !== null ? 1 : 0 }}>
        {hover !== null &&
          `${months[hover]} 2026 · Rev ₹${revenue[hover].toFixed(1)}L · Exp ₹${expenses[hover].toFixed(1)}L`}
      </div>
    </div>
  );
}
