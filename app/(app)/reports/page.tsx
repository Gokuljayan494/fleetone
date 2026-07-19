import { Topbar } from "@/components/Topbar";
import { Av } from "@/components/ui";
import { RevenueChart } from "@/components/RevenueChart";
import { drivers, fleetAvgKmpl, fuelEfficiency } from "@/data/fleet";

const donut = [
  { label: "Fuel", value: "₹2.42L · 54%", c: "var(--c4)", len: 176.2, off: 0 },
  { label: "Salaries", value: "₹1.12L · 25%", c: "var(--c1)", len: 81.7, off: -179.2 },
  { label: "Maintenance", value: "₹0.64L · 14%", c: "var(--c3)", len: 45.7, off: -263.9 },
  { label: "Tolls & permits", value: "₹0.32L · 7%", c: "var(--c2)", len: 10.8, off: -312.6 },
];

export default function ReportsPage() {
  const top = [...drivers].sort((a, b) => b.score - a.score).slice(0, 4);
  return (
    <>
      <Topbar
        title="Reports"
        sub="Feb – Jul 2026 · all hubs"
        actions={
          <>
            <div className="chip-tabs"><span>30d</span><span>90d</span><span className="on">6m</span><span>1y</span></div>
            <button className="btn btn-s">Export PDF</button>
          </>
        }
      />
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
            <RevenueChart />
          </div>

          <div className="card">
            <div className="card-h"><h3>Expense Breakdown</h3><span className="sub">July</span></div>
            <div className="row" style={{ gap: 18, padding: "12px 18px 16px" }}>
              <div style={{ position: "relative", width: 132, height: 132, flexShrink: 0 }}>
                <svg width="132" height="132" viewBox="0 0 132 132" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="66" cy="66" r="52" fill="none" stroke="var(--hair)" strokeWidth="16" />
                  {donut.map((s) => (
                    <circle key={s.label} cx="66" cy="66" r="52" fill="none" stroke={s.c} strokeWidth="16"
                      strokeDasharray={`${s.len} 326.7`} strokeDashoffset={s.off} />
                  ))}
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
                  <div>
                    <b style={{ fontSize: 17, letterSpacing: "-.02em", display: "block" }}>₹4.5L</b>
                    <span style={{ fontSize: 9.5, color: "var(--soft)", fontWeight: 700, letterSpacing: ".06em" }}>TOTAL</span>
                  </div>
                </div>
              </div>
              <div className="dleg">
                {donut.map((s) => (
                  <div key={s.label}><i style={{ background: s.c }} /><span>{s.label}</span><b>{s.value}</b></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid-2-1">
          <div className="card">
            <div className="card-h" style={{ paddingBottom: 6 }}>
              <h3>Fuel Efficiency by Vehicle</h3>
              <span className="sub">km per litre · July avg</span>
              <div className="right legend">
                <span><i style={{ background: "var(--c2)" }} />Above fleet avg</span>
                <span><i style={{ background: "var(--c4)" }} />Below</span>
              </div>
            </div>
            <div style={{ padding: "6px 14px 12px" }}>
              <svg viewBox="0 0 560 210" style={{ width: "100%", display: "block" }}>
                <g className="gridln">
                  <line x1="40" y1="30" x2="548" y2="30" /><line x1="40" y1="80" x2="548" y2="80" /><line x1="40" y1="130" x2="548" y2="130" />
                </g>
                <line x1="40" y1="176" x2="548" y2="176" stroke="var(--line)" strokeWidth="1.2" />
                <g className="axis">
                  <text x="32" y="33" textAnchor="end">15</text>
                  <text x="32" y="83" textAnchor="end">10</text>
                  <text x="32" y="133" textAnchor="end">5</text>
                </g>
                <line x1="40" y1={176 - (fleetAvgKmpl / 15) * 146} x2="548" y2={176 - (fleetAvgKmpl / 15) * 146} stroke="var(--soft)" strokeWidth="1" strokeDasharray="4 4" />
                <text x="548" y={176 - (fleetAvgKmpl / 15) * 146 - 6} className="axis" textAnchor="end" fontWeight="700">
                  fleet avg {fleetAvgKmpl}
                </text>
                {fuelEfficiency.map((v, i) => {
                  const h = (v.kmpl / 15) * 146;
                  const x = 64 + i * 81;
                  const above = v.kmpl >= fleetAvgKmpl;
                  return (
                    <g key={v.plate}>
                      <rect x={x} y={176 - h} width="34" height={h} rx="4" fill={above ? "var(--c2)" : "var(--c4)"} />
                      <text x={x + 17} y={176 - h - 7} className="axis" textAnchor="middle" fontWeight="700" fill="var(--ink)">{v.kmpl}</text>
                      <text x={x + 17} y="194" className="axis" textAnchor="middle">{v.plate}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="col">
            <div className="card" style={{ padding: "14px 16px", flex: 1 }}>
              <h3 style={{ fontSize: 13.5, marginBottom: 11 }}>Driver Leaderboard</h3>
              <div className="col" style={{ gap: 10 }}>
                {top.map((d, i) => (
                  <div key={d.name} className="lead-row">
                    <span className="rank">{i + 1}</span>
                    <Av g={d.av}>{d.initials}</Av>
                    <span className="nm">{d.name}</span>
                    <div className="bar"><i style={{ width: `${d.score}%`, background: "var(--c1)" }} /></div>
                    <b className="sc">{d.score}</b>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: "14px 16px" }}>
              <h3 style={{ fontSize: 13.5, marginBottom: 11 }}>Maintenance Pipeline</h3>
              <div className="tline">
                <div className="tstop warn">
                  <span className="knot" /><b>Brake pads · HT 8874</b>
                  <span>Sat 19 Jul · SRS Motors, Peenya · est ₹8,200</span>
                </div>
                <div className="tstop mid">
                  <span className="knot" /><b>Full service · TC 5567</b>
                  <span>Tue 22 Jul · est ₹14,500</span>
                </div>
                <div className="tstop end">
                  <span className="knot" /><b>Tyres replaced · BQ 4432</b>
                  <span>Done 11 Jul · ₹21,300 · 4× CEAT Mile XL</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
