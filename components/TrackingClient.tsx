"use client";
import { useEffect, useState } from "react";
import { RealMap } from "./RealMap";
import { I } from "./Icons";
import { Badge } from "./ui";

type Status = "moving" | "idle" | "stale" | "offline";
type Fix = {
  plate: string; lat: number; lng: number; speed: number;
  source: string; ts: number; ageMs: number; status: Status;
};
type Data = {
  positions: Fix[];
  missing: { plate: string; model: string; driver: string }[];
  summary: { moving: number; idle: number; stale: number; offline: number; neverReported: number };
};

const COLOR: Record<Status, string> = {
  moving: "var(--emr)", idle: "var(--sky)", stale: "var(--org)", offline: "var(--soft)",
};
const LABEL: Record<Status, string> = {
  moving: "Moving", idle: "Stopped", stale: "No signal", offline: "Offline",
};
const TONE: Record<Status, "emr" | "sky" | "org" | "slate"> = {
  moving: "emr", idle: "sky", stale: "org", offline: "slate",
};

function since(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function TrackingClient() {
  const [data, setData] = useState<Data | null>(null);
  const [focus, setFocus] = useState<string | undefined>(undefined);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch("/api/positions");
        if (!res.ok) return;
        const d = await res.json();
        if (live) setData(d);
      } catch {
        /* retry next tick */
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  const positions = data?.positions ?? [];
  const missing = data?.missing ?? [];
  const s = data?.summary;

  return (
    <div className="content" style={{ flexDirection: "row", display: "flex", gap: 14 }}>
      <div className="card" style={{ flex: 1, overflow: "hidden", minHeight: 540, padding: 14 }}>
        <div className="card-h" style={{ paddingBottom: 10 }}>
          <h3>{focus ? focus : "All vehicles"}</h3>
          {s && (
            <div className="right legend">
              <span><i style={{ background: COLOR.moving }} />{s.moving} moving</span>
              <span><i style={{ background: COLOR.idle }} />{s.idle} stopped</span>
              <span><i style={{ background: COLOR.stale }} />{s.stale + s.offline} no signal</span>
            </div>
          )}
        </div>
        <RealMap height={480} focusPlate={focus} zoom={focus ? 12 : 8} />
      </div>

      <div className="col" style={{ width: 300, flexShrink: 0 }}>
        <div className="card" style={{ padding: "15px 16px" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 11 }}>
            <h3 style={{ fontSize: 12.5 }}>Fleet</h3>
            {focus && (
              <button className="btn btn-g" style={{ padding: "2px 6px", fontSize: 10.5 }} onClick={() => setFocus(undefined)}>
                Show all
              </button>
            )}
          </div>

          {!data ? (
            <div style={{ fontSize: 11.5, color: "var(--mut)" }}>Locating vehicles…</div>
          ) : positions.length === 0 && missing.length === 0 ? (
            <div style={{ fontSize: 11.5, color: "var(--mut)" }}>No vehicles in this fleet yet.</div>
          ) : (
            <div className="fleet-live">
              {positions.map((p) => (
                <div
                  key={p.plate}
                  className={`row-v${focus === p.plate ? " on" : ""}`}
                  onClick={() => setFocus(focus === p.plate ? undefined : p.plate)}
                >
                  <span className="pin" style={{ background: COLOR[p.status] }} />
                  <span className="nm">
                    <b>{p.plate}</b>
                    <span>{LABEL[p.status]} · {Math.round(p.speed)} km/h</span>
                  </span>
                  <span className="age">{since(p.ageMs)}</span>
                </div>
              ))}

              {missing.length > 0 && (
                <>
                  <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".07em", color: "var(--soft)", margin: "10px 0 4px", padding: "0 10px" }}>
                    NOT REPORTING
                  </div>
                  {missing.map((v) => (
                    <div key={v.plate} className="row-v" style={{ cursor: "default", opacity: 0.75 }}>
                      <span className="pin" style={{ background: "var(--soft)" }} />
                      <span className="nm">
                        <b>{v.plate}</b>
                        <span>{v.driver || v.model}</span>
                      </span>
                      <span className="age">—</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {focus && (() => {
          const p = positions.find((x) => x.plate === focus);
          if (!p) return null;
          return (
            <div className="card" style={{ padding: "15px 16px" }}>
              <h3 style={{ fontSize: 12.5, marginBottom: 11 }}>{p.plate}</h3>
              <div className="pl-grid">
                <div><b>{Math.round(p.speed)} km/h</b><span>Speed</span></div>
                <div><b>{since(p.ageMs)}</b><span>Last fix</span></div>
                <div><b>{p.lat.toFixed(4)}</b><span>Latitude</span></div>
                <div><b>{p.lng.toFixed(4)}</b><span>Longitude</span></div>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <Badge tone={TONE[p.status]}>{LABEL[p.status]}</Badge>
                <span style={{ fontSize: 10.5, color: "var(--mut)" }}>via {p.source}</span>
              </div>
            </div>
          );
        })()}

        {missing.length > 0 && (
          <div className="card side-note">
            <I name="warn" />
            <span>
              <b>{missing.length} vehicle{missing.length === 1 ? "" : "s"} not reporting.</b>{" "}
              They appear once a driver signs in on their phone, or a GPS box posts with your device key.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
