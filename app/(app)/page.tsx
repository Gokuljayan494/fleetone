import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { Counter } from "@/components/Counter";
import { RealMap } from "@/components/RealMap";
import { I } from "@/components/Icons";
import { Av, Badge, Bar, Sparkline, VehDot } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { bootstrap, countDrivers, countVehicles, getCompany, listTrips } from "@/lib/store";
import type { Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

const kpis = [
  { icon: "truck", tone: "ind", label: "Total Vehicles", value: <Counter to={48} />, trend: { cls: "up", text: "↑ 4 this month" }, spark: [24, 22, 23, 18, 19, 14, 12, 6], c: "var(--c1)" },
  { icon: "bolt", tone: "emr", label: "Vehicles Online", value: <><Counter to={42} /><small> / 48</small></>, trend: { cls: "up", text: "87.5% uptime" }, spark: [18, 14, 16, 10, 12, 8, 10, 7], c: "var(--c2)" },
  { icon: "route", tone: "sky", label: "Active Trips", value: <Counter to={17} />, trend: { cls: "up", text: "↑ 12% vs last week" }, spark: [22, 20, 24, 16, 18, 11, 14, 8], c: "var(--c3)" },
  { icon: "chart", tone: "ind", label: "Monthly Revenue", value: <>₹<Counter to={12.4} decimals={1} />L</>, trend: { cls: "up", text: "↑ 18.2% MoM" }, spark: [25, 23, 20, 21, 15, 13, 9, 5], c: "var(--c1)" },
  { icon: "fuel", tone: "org", label: "Fuel Cost · July", value: <>₹<Counter to={2.86} decimals={2} />L</>, trend: { cls: "dn", text: "↑ 6.4% — diesel hike" }, spark: [20, 21, 18, 19, 16, 17, 13, 11], c: "var(--c4)" },
  { icon: "wrench", tone: "sky", label: "Maintenance Cost", value: <>₹<Counter to={64} />K</>, trend: { cls: "up", text: "↓ 11% vs June" }, spark: [10, 14, 12, 17, 15, 19, 18, 21], c: "var(--c3)" },
  { icon: "users", tone: "emr", label: "Driver Utilization", value: <><Counter to={81} /><small>%</small></>, trend: { cls: "up", text: "↑ 3.5 pts" }, spark: [19, 17, 18, 14, 15, 12, 10, 9], c: "var(--c2)" },
  { icon: "heart", tone: "ind", label: "Fleet Health Score", value: <><Counter to={92} /><small> / 100</small></>, trend: { cls: "up", text: "Excellent" }, spark: [16, 15, 13, 14, 11, 10, 8, 7], c: "var(--c1)" },
];

const fleetStatus = [
  { tone: "emr" as const, label: "Moving", pct: 64, n: 27, color: "var(--emr)" },
  { tone: "org" as const, label: "Idle", pct: 26, n: 11, color: "var(--org)" },
  { tone: "slate" as const, label: "Offline", pct: 14, n: 6, color: "var(--soft)" },
  { tone: "sky" as const, label: "In service", pct: 9, n: 4, color: "var(--sky)" },
];

export default async function Dashboard() {
  await bootstrap();
  const session = await getSession();

  let trips: Trip[] = [];
  let sub = "Sign in to see your fleet";
  if (session) {
    const [company, vehicles, drivers, t] = await Promise.all([
      getCompany(session.companyId),
      countVehicles(session.companyId),
      countDrivers(session.companyId),
      listTrips(session.companyId),
    ]);
    trips = t;
    if (company) sub = `${company.name} · ${vehicles} vehicles · ${drivers} drivers`;
  }
  const greeting = session ? `Good morning, ${session.name} 👋` : "Good morning 👋";
  return (
    <>
      <Topbar title={greeting} sub={sub} />
      <div className="content">
        <div className="kpis">
          {kpis.map((k) => (
            <div key={k.label} className="kpi">
              <div className="top">
                <span className="kico" style={{ background: `var(--${k.tone}-soft)`, color: `var(--${k.tone})` }}>
                  <I name={k.icon} />
                </span>
                <span className="lbl">{k.label}</span>
              </div>
              <div className="val">{k.value}</div>
              <div className="foot">
                <span className={`trend ${k.trend.cls}`}>{k.trend.text}</span>
                <Sparkline points={k.spark} color={k.c} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid-map">
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="card-h" style={{ paddingBottom: 12 }}>
              <h3>Live Fleet Map</h3>
              <Badge tone="emr">42 live</Badge>
              <div className="right">
                <div className="chip-tabs"><span className="on">Traffic</span><span>Satellite</span><span>Geofences</span></div>
              </div>
            </div>
            <div style={{ margin: "0 14px 14px" }}>
              <RealMap height={330} />
            </div>
          </div>

          <div className="col">
            <div className="card" style={{ padding: "14px 16px", flex: 1 }}>
              <h3 style={{ fontSize: 13.5, marginBottom: 12 }}>Fleet Status</h3>
              <div className="col" style={{ gap: 9 }}>
                {fleetStatus.map((s) => (
                  <div key={s.label} className="row" style={{ gap: 10 }}>
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <Bar pct={s.pct} color={s.color} />
                    <b style={{ fontSize: 12, width: 20, textAlign: "right" }}>{s.n}</b>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <h3 style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--soft)", marginBottom: 10 }}>
                Needs attention
              </h3>
              <div className="col" style={{ gap: 8 }}>
                <Link href="/maintenance" className="attention warn"><I name="wrench" />Maintenance due — <b>3 vehicles</b></Link>
                <Link href="/vehicles" className="attention crit"><I name="shield" />Insurance expiring — <b>2 in 7 days</b></Link>
                <Link href="/vehicles" className="attention warn"><I name="fuel" />Fuel low — <b>KA 03 HT 8874</b></Link>
              </div>
            </div>
            <div className="card" style={{ padding: "14px 16px" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <h3 style={{ fontSize: 13.5 }}>Today</h3>
                <span style={{ fontSize: 10.5, color: "var(--soft)", fontWeight: 600 }}>17 JUL</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 11 }}>
                <div className="mini-stat"><b>23</b><div>Trips done</div></div>
                <div className="mini-stat"><b>₹86K</b><div>Collected</div></div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Recent Trips</h3>
            <span className="sub">Updated 2 min ago</span>
            <div className="right">
              <button className="btn btn-s">Export</button>
              <button className="btn btn-p"><I name="plus" />New trip</button>
            </div>
          </div>
          <div style={{ overflowX: "auto", padding: "4px 6px 6px" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Vehicle</th><th>Driver</th><th>Customer</th>
                  <th className="num">Distance</th><th className="num">Duration</th><th className="num">Revenue</th>
                  <th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {trips.map((t, i) => (
                  <tr key={i}>
                    <td className="strong">
                      <span className="cell-id"><VehDot tone={t.vtone} kind={t.vkind} />{t.plate}</span>
                    </td>
                    <td><span className="cell-id"><Av g={t.av}>{t.ini}</Av>{t.driver}</span></td>
                    <td>{t.customer}</td>
                    <td className="num">{t.km}</td>
                    <td className="num">{t.dur}</td>
                    <td className="num strong">{t.rev}</td>
                    <td><Badge tone={t.tone}>{t.status}</Badge></td>
                    <td><button className="dots-btn">⋯</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
