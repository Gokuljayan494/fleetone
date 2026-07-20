"use client";
import { useEffect, useState } from "react";
import { Av } from "./ui";

type Report = {
  monthly: { month: string; revenueInr: number; expensesInr: number }[];
  pipeline: {
    id: string; plate: string; type: string; dueDate: string;
    costInr: number | null; vendor: string; status: string; daysLeft: number;
  }[];
  totals: {
    vehicles: number; drivers: number; trips: number; km: number;
    revenueInr: number; expensesInr: number; profitInr: number;
    litres: number; fleetAvgKmpl: number | null;
  };
  expensesByCategory: Record<string, number>;
  perVehicle: { plate: string; model: string; kmpl: number; profitInr: number }[];
  perDriver: { name: string; score: number; trips: number }[];
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
/** Lakh formatting matches how Indian fleet owners read these numbers. */
const lakh = (n: number) => (n >= 100_000 ? `₹${(n / 100_000).toFixed(2)}L` : inr(n));
const initials = (name: string) =>
  name.split(/\s+/).map((w) => w[0] ?? "").join("").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) || "DR";

const CAT_COLORS: Record<string, string> = {
  fuel: "var(--c4)", maintenance: "var(--c3)", salary: "var(--c1)", toll: "var(--c2)",
  parking: "var(--c2)", fine: "var(--c4)", repair: "var(--c3)", insurance: "var(--c1)",
  permit: "var(--c2)", other: "var(--soft)",
};
const AV_CYCLE = ["g1", "g2", "g3", "g4", "g5", "g6"];

export function ReportsClient() {
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Could not load reports");
        return res.json();
      })
      .then(setR)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="content"><div className="crumb">{error}</div></div>;
  if (!r) return <div className="content"><div className="crumb">Crunching your numbers…</div></div>;

  const hasData = r.totals.trips > 0 || r.totals.expensesInr > 0;
  if (!hasData) {
    return (
      <div className="content">
        <div className="card" style={{ padding: "40px 48px", textAlign: "center", maxWidth: 460, margin: "0 auto" }}>
          <h2 style={{ fontSize: 16 }}>No numbers yet</h2>
          <p style={{ color: "var(--mut)", fontSize: 12.5, marginTop: 8 }}>
            Reports fill in as you complete trips and log fuel, expenses and services.
            You have {r.totals.vehicles} vehicle{r.totals.vehicles === 1 ? "" : "s"} and{" "}
            {r.totals.drivers} driver{r.totals.drivers === 1 ? "" : "s"} set up.
          </p>
        </div>
      </div>
    );
  }

  // Chart geometry — one scale across both series so the bars stay comparable.
  const peak = Math.max(1, ...r.monthly.flatMap((m) => [m.revenueInr, m.expensesInr]));
  const catTotal = Object.values(r.expensesByCategory).reduce((s, n) => s + n, 0);
  const cats = Object.entries(r.expensesByCategory)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const CIRC = 326.7;
  let offset = 0;
  const arcs = cats.map(([label, value]) => {
    const len = catTotal ? (value / catTotal) * CIRC : 0;
    const arc = { label, value, len, off: -offset, c: CAT_COLORS[label] ?? "var(--soft)" };
    offset += len;
    return arc;
  });

  const fuelBars = [...r.perVehicle].filter((v) => v.kmpl > 0).sort((a, b) => b.kmpl - a.kmpl).slice(0, 6);
  const avg = r.totals.fleetAvgKmpl ?? 0;
  const maxKmpl = Math.max(15, ...fuelBars.map((v) => v.kmpl));
  const topDrivers = [...r.perDriver].sort((a, b) => b.score - a.score).slice(0, 4);

  return (
    <div className="content">
      <div className="grid-2-1">
        <div className="card">
          <div className="card-h" style={{ paddingBottom: 6 }}>
            <h3>Revenue vs Expenses</h3>
            <div className="right legend">
              <span><i style={{ background: "var(--c1)" }} />Revenue</span>
              <span><i style={{ background: "var(--c4)" }} />Expenses</span>
            </div>
          </div>
          <div style={{ padding: "6px 14px 12px" }}>
            <svg viewBox="0 0 560 210" style={{ width: "100%", display: "block" }}>
              <g className="gridln">
                <line x1="40" y1="30" x2="548" y2="30" />
                <line x1="40" y1="80" x2="548" y2="80" />
                <line x1="40" y1="130" x2="548" y2="130" />
              </g>
              <line x1="40" y1="176" x2="548" y2="176" stroke="var(--line)" strokeWidth="1.2" />
              {r.monthly.map((m, i) => {
                const slot = 508 / r.monthly.length;
                const x = 40 + i * slot + slot / 2;
                const rh = (m.revenueInr / peak) * 146;
                const eh = (m.expensesInr / peak) * 146;
                return (
                  <g key={m.month + i}>
                    <rect x={x - 15} y={176 - rh} width="13" height={rh} rx="3" fill="var(--c1)" />
                    <rect x={x + 2} y={176 - eh} width="13" height={eh} rx="3" fill="var(--c4)" />
                    <text x={x} y="194" className="axis" textAnchor="middle">{m.month}</text>
                  </g>
                );
              })}
              <text x="32" y="33" textAnchor="end" className="axis">{lakh(peak)}</text>
            </svg>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Expense Breakdown</h3><span className="sub">all time</span></div>
          <div className="row" style={{ gap: 18, padding: "12px 18px 16px" }}>
            <div style={{ position: "relative", width: 132, height: 132, flexShrink: 0 }}>
              <svg width="132" height="132" viewBox="0 0 132 132" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="66" cy="66" r="52" fill="none" stroke="var(--hair)" strokeWidth="16" />
                {arcs.map((s) => (
                  <circle key={s.label} cx="66" cy="66" r="52" fill="none" stroke={s.c} strokeWidth="16"
                    strokeDasharray={`${s.len} ${CIRC}`} strokeDashoffset={s.off} />
                ))}
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
                <div>
                  <b style={{ fontSize: 17, letterSpacing: "-.02em", display: "block" }}>{lakh(catTotal)}</b>
                  <span style={{ fontSize: 9.5, color: "var(--soft)", fontWeight: 700, letterSpacing: ".06em" }}>TOTAL</span>
                </div>
              </div>
            </div>
            <div className="dleg">
              {arcs.length === 0 && <div style={{ color: "var(--mut)", fontSize: 12 }}>No expenses logged yet.</div>}
              {arcs.map((s) => (
                <div key={s.label}>
                  <i style={{ background: s.c }} />
                  <span style={{ textTransform: "capitalize" }}>{s.label}</span>
                  <b>{lakh(s.value)} · {catTotal ? Math.round((s.value / catTotal) * 100) : 0}%</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2-1">
        <div className="card">
          <div className="card-h" style={{ paddingBottom: 6 }}>
            <h3>Fuel Efficiency by Vehicle</h3>
            <span className="sub">km per litre</span>
            <div className="right legend">
              <span><i style={{ background: "var(--c2)" }} />Above fleet avg</span>
              <span><i style={{ background: "var(--c4)" }} />Below</span>
            </div>
          </div>
          <div style={{ padding: "6px 14px 12px" }}>
            {fuelBars.length === 0 ? (
              <div className="crumb" style={{ padding: 12 }}>Log fuel to see mileage per vehicle.</div>
            ) : (
              <svg viewBox="0 0 560 210" style={{ width: "100%", display: "block" }}>
                <g className="gridln">
                  <line x1="40" y1="30" x2="548" y2="30" />
                  <line x1="40" y1="80" x2="548" y2="80" />
                  <line x1="40" y1="130" x2="548" y2="130" />
                </g>
                <line x1="40" y1="176" x2="548" y2="176" stroke="var(--line)" strokeWidth="1.2" />
                {avg > 0 && (
                  <>
                    <line x1="40" y1={176 - (avg / maxKmpl) * 146} x2="548" y2={176 - (avg / maxKmpl) * 146}
                      stroke="var(--soft)" strokeWidth="1" strokeDasharray="4 4" />
                    <text x="548" y={176 - (avg / maxKmpl) * 146 - 6} className="axis" textAnchor="end" fontWeight="700">
                      fleet avg {avg}
                    </text>
                  </>
                )}
                {fuelBars.map((v, i) => {
                  const h = (v.kmpl / maxKmpl) * 146;
                  const slot = 508 / fuelBars.length;
                  const x = 40 + i * slot + slot / 2 - 17;
                  return (
                    <g key={v.plate}>
                      <rect x={x} y={176 - h} width="34" height={h} rx="4" fill={v.kmpl >= avg ? "var(--c2)" : "var(--c4)"} />
                      <text x={x + 17} y={176 - h - 7} className="axis" textAnchor="middle" fontWeight="700" fill="var(--ink)">{v.kmpl}</text>
                      <text x={x + 17} y="194" className="axis" textAnchor="middle">{v.plate.slice(-7)}</text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        <div className="col">
          <div className="card" style={{ padding: "14px 16px", flex: 1 }}>
            <h3 style={{ fontSize: 13.5, marginBottom: 11 }}>Driver Leaderboard</h3>
            <div className="col" style={{ gap: 10 }}>
              {topDrivers.length === 0 && <div style={{ color: "var(--mut)", fontSize: 12 }}>No drivers yet.</div>}
              {topDrivers.map((d, i) => (
                <div key={d.name} className="lead-row">
                  <span className="rank">{i + 1}</span>
                  <Av g={AV_CYCLE[i % AV_CYCLE.length]}>{initials(d.name)}</Av>
                  <span className="nm">{d.name}</span>
                  <div className="bar"><i style={{ width: `${d.score}%`, background: "var(--c1)" }} /></div>
                  <b className="sc">{d.score}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: "14px 16px" }}>
            <h3 style={{ fontSize: 13.5, marginBottom: 11 }}>Maintenance Pipeline</h3>
            {r.pipeline.length === 0 ? (
              <div style={{ color: "var(--mut)", fontSize: 12 }}>No service jobs scheduled.</div>
            ) : (
              <div className="tline">
                {r.pipeline.map((m, i) => (
                  <div
                    key={m.id}
                    className={`tstop ${m.status === "done" ? "end" : m.daysLeft < 7 ? "warn" : "mid"}`}
                  >
                    <span className="knot" />
                    <b>{m.type} · {m.plate.slice(-7)}</b>
                    <span>
                      {m.status === "done" ? "Done" : m.daysLeft < 0 ? "Overdue" : `Due ${m.dueDate}`}
                      {m.vendor ? ` · ${m.vendor}` : ""}
                      {m.costInr ? ` · ${inr(m.costInr)}` : ""}
                      {i < 0 ? "" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
