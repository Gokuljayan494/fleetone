import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { Counter } from "@/components/Counter";
import { RealMap } from "@/components/RealMap";
import { I } from "@/components/Icons";
import { Av, Badge, Bar, Sparkline, VehDot } from "@/components/ui";
import { getSession } from "@/lib/auth";
import {
  bootstrap,
  buildReport,
  getCompany,
  listTrips,
  listTripsSince,
  listVehicles,
  livePositions,
} from "@/lib/store";
import type { Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Sparkline shapes are decorative; the numbers beside them are real. */
const FLAT = [12, 12, 12, 12, 12, 12, 12, 12];

const lakh = (n: number) =>
  n >= 100_000 ? `₹${(n / 100_000).toFixed(2)}L` : n >= 1000 ? `₹${Math.round(n / 1000)}K` : `₹${n}`;

export default async function Dashboard() {
  await bootstrap();
  const session = await getSession();

  let trips: Trip[] = [];
  let sub = "Sign in to see your fleet";
  let kpis: {
    icon: string; tone: string; label: string;
    value: React.ReactNode; trend: { cls: string; text: string }; c: string;
  }[] = [];
  let fleetStatus: { tone: "emr" | "org" | "slate" | "sky"; label: string; pct: number; n: number; color: string }[] = [];
  let attention: { href: string; cls: string; icon: string; text: string; strong: string }[] = [];
  let todayTrips = 0;
  let todayCollected = 0;
  let liveCount = 0;

  if (session) {
    const [company, vehicles, report, live] = await Promise.all([
      getCompany(session.companyId),
      listVehicles(session.companyId),
      buildReport(session.companyId, 30),
      livePositions(session.companyId),
    ]);
    trips = await listTrips(session.companyId);
    liveCount = live.length;

    if (company) sub = `${company.name} · ${vehicles.length} vehicles · ${report.totals.drivers} drivers`;

    const t = report.totals;
    const thisMonth = report.monthly[report.monthly.length - 1] ?? { revenueInr: 0, expensesInr: 0 };
    const fuelSpend = report.expensesByCategory.fuel ?? 0;
    const maintSpend = report.expensesByCategory.maintenance ?? 0;
    const avgHealth = vehicles.length
      ? Math.round(vehicles.reduce((s, v) => s + v.health, 0) / vehicles.length)
      : 0;
    const onTrip = vehicles.filter((v) => /trip|transit/i.test(v.status)).length;

    kpis = [
      { icon: "truck", tone: "ind", label: "Total Vehicles", value: <Counter to={vehicles.length} />, trend: { cls: "up", text: `${report.totals.drivers} drivers` }, c: "var(--c1)" },
      { icon: "bolt", tone: "emr", label: "Vehicles Online", value: <><Counter to={liveCount} /><small> / {vehicles.length}</small></>, trend: { cls: liveCount ? "up" : "dn", text: liveCount ? "reporting now" : "none reporting" }, c: "var(--c2)" },
      { icon: "route", tone: "sky", label: "Trips Recorded", value: <Counter to={t.trips} />, trend: { cls: "up", text: `${t.km.toLocaleString("en-IN")} km total` }, c: "var(--c3)" },
      { icon: "chart", tone: "ind", label: "Revenue · this month", value: <>{lakh(thisMonth.revenueInr)}</>, trend: { cls: "up", text: `${lakh(t.revenueInr)} all time` }, c: "var(--c1)" },
      { icon: "fuel", tone: "org", label: "Fuel Spend", value: <>{lakh(fuelSpend)}</>, trend: { cls: "dn", text: t.fleetAvgKmpl ? `${t.fleetAvgKmpl} km/L avg` : "no logs yet" }, c: "var(--c4)" },
      { icon: "wrench", tone: "sky", label: "Maintenance Spend", value: <>{lakh(maintSpend)}</>, trend: { cls: "up", text: `${report.alerts.serviceDue} due soon` }, c: "var(--c3)" },
      { icon: "users", tone: "emr", label: "Profit", value: <>{lakh(t.profitInr)}</>, trend: { cls: t.profitInr >= 0 ? "up" : "dn", text: `${lakh(t.expensesInr)} spent` }, c: "var(--c2)" },
      { icon: "heart", tone: "ind", label: "Fleet Health Score", value: <><Counter to={avgHealth} /><small> / 100</small></>, trend: { cls: avgHealth >= 80 ? "up" : "dn", text: avgHealth >= 80 ? "Healthy" : "Needs attention" }, c: "var(--c1)" },
    ];

    const parked = vehicles.length - onTrip - liveCount > 0 ? vehicles.length - onTrip : 0;
    const pct = (n: number) => (vehicles.length ? Math.round((n / vehicles.length) * 100) : 0);
    fleetStatus = [
      { tone: "emr", label: "On trip", pct: pct(onTrip), n: onTrip, color: "var(--emr)" },
      { tone: "sky", label: "Reporting", pct: pct(liveCount), n: liveCount, color: "var(--sky)" },
      { tone: "slate", label: "Parked", pct: pct(parked), n: parked, color: "var(--soft)" },
      { tone: "org", label: "In service", pct: pct(report.alerts.serviceDue), n: report.alerts.serviceDue, color: "var(--org)" },
    ];

    if (report.alerts.serviceDue > 0) {
      attention.push({ href: "/maintenance", cls: "warn", icon: "wrench", text: "Service due — ", strong: `${report.alerts.serviceDue} job${report.alerts.serviceDue === 1 ? "" : "s"}` });
    }
    if (report.alerts.expiringDocuments > 0) {
      attention.push({ href: "/documents", cls: "crit", icon: "shield", text: "Documents expiring — ", strong: `${report.alerts.expiringDocuments}` });
    }
    if (report.receivables.overdueInr > 0) {
      attention.push({ href: "/billing", cls: "crit", icon: "doc", text: "Overdue invoices — ", strong: lakh(report.receivables.overdueInr) });
    }
    const worst = [...vehicles].sort((a, b) => a.health - b.health)[0];
    if (worst && worst.health < 70) {
      attention.push({ href: "/vehicles", cls: "warn", icon: "heart", text: "Low health — ", strong: worst.plate });
    }

    // "Today" panel — trips closed since midnight.
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const todays = await listTripsSince(session.companyId, midnight.getTime());
    todayTrips = todays.length;
    todayCollected = todays.reduce((s, x) => s + (Number(x.rev.replace(/[^\d.]/g, "")) || 0), 0);
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
                <Sparkline points={FLAT} color={k.c} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid-map">
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="card-h" style={{ paddingBottom: 12 }}>
              <h3>Live Fleet Map</h3>
              <Badge tone={liveCount ? "emr" : "slate"}>{liveCount} live</Badge>
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
                {attention.length === 0 ? (
                  <span style={{ fontSize: 12, color: "var(--mut)" }}>Nothing needs attention right now.</span>
                ) : (
                  attention.map((a) => (
                    <Link key={a.href + a.strong} href={a.href} className={`attention ${a.cls}`}>
                      <I name={a.icon} />{a.text}<b>{a.strong}</b>
                    </Link>
                  ))
                )}
              </div>
            </div>
            <div className="card" style={{ padding: "14px 16px" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <h3 style={{ fontSize: 13.5 }}>Today</h3>
                <span style={{ fontSize: 10.5, color: "var(--soft)", fontWeight: 600 }}>
                  {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase()}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 11 }}>
                <div className="mini-stat"><b>{todayTrips}</b><div>Trips done</div></div>
                <div className="mini-stat"><b>{lakh(todayCollected)}</b><div>Collected</div></div>
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
