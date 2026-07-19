"use client";
import { useEffect, useRef, useState } from "react";
import { I } from "./Icons";
import { Av, Badge } from "./ui";
import { FillUpModal } from "./FuelClient";
import { RealMap } from "./RealMap";
import type { vehicles as vehicleSeed } from "@/data/fleet";
import type { FuelLog } from "@/lib/store";

type Vehicle = (typeof vehicleSeed)[number];

/** Simplified Bengaluru → Chennai corridor for demo mode; `stop` points idle at a fuel halt near Vellore. */
const SIM_ROUTE: { lat: number; lng: number; stop?: boolean }[] = [
  { lat: 12.97, lng: 77.59 }, { lat: 12.88, lng: 77.75 }, { lat: 12.79, lng: 77.88 },
  { lat: 12.74, lng: 78.05 }, { lat: 12.72, lng: 78.25 }, { lat: 12.70, lng: 78.45 },
  { lat: 12.92, lng: 79.13, stop: true }, { lat: 12.92, lng: 79.13, stop: true }, { lat: 12.92, lng: 79.13, stop: true },
  { lat: 12.95, lng: 79.33 }, { lat: 12.98, lng: 79.45 }, { lat: 13.02, lng: 79.65 },
  { lat: 13.05, lng: 79.85 }, { lat: 13.07, lng: 80.05 }, { lat: 13.08, lng: 80.21 },
];

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371, dLat = ((b[0] - a[0]) * Math.PI) / 180, dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function DriverClient({ driverName, assignedPlate }: { driverName: string; assignedPlate: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [plate, setPlate] = useState(assignedPlate);
  const [driver, setDriver] = useState(driverName);
  const [mode, setMode] = useState<"gps" | "sim">("sim");
  const [active, setActive] = useState(false);
  const [km, setKm] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [fuelOpen, setFuelOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const lastPos = useRef<[number, number] | null>(null);
  const kmRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const watchId = useRef<number | null>(null);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const simIdx = useRef(0);

  useEffect(() => {
    fetch("/api/vehicles").then((r) => r.json()).then((d) => setVehicles(d.vehicles));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/driver/login";
  }

  useEffect(() => {
    if (!active || startedAt === null) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [active, startedAt]);

  async function post(lat: number, lng: number, spd: number, source: "phone" | "sim") {
    try {
      await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate, lat, lng, speed: spd, source }),
      });
    } catch {
      /* offline ping dropped; next one retries */
    }
  }

  function tick(lat: number, lng: number, spd: number, source: "phone" | "sim") {
    const here: [number, number] = [lat, lng];
    if (lastPos.current) {
      kmRef.current += haversineKm(lastPos.current, here);
      setKm(kmRef.current);
    }
    lastPos.current = here;
    setSpeed(spd);
    void post(lat, lng, spd, source);
  }

  function start() {
    if (!plate) return;
    setSummary(null);
    setGpsError(null);
    kmRef.current = 0;
    setKm(0);
    lastPos.current = null;
    startedAtRef.current = Date.now();
    setStartedAt(startedAtRef.current);
    setElapsed(0);
    setActive(true);

    if (mode === "gps") {
      if (!navigator.geolocation) {
        setGpsError("This browser has no GPS access — use demo mode.");
        setActive(false);
        return;
      }
      watchId.current = navigator.geolocation.watchPosition(
        (p) => tick(p.coords.latitude, p.coords.longitude, (p.coords.speed ?? 0) * 3.6, "phone"),
        (e) => {
          setGpsError(e.code === 1 ? "Location permission denied — allow it or use demo mode." : "GPS unavailable — try demo mode.");
          stop(false);
        },
        { enableHighAccuracy: true, maximumAge: 3000 },
      );
    } else {
      simIdx.current = 0;
      simTimer.current = setInterval(() => {
        const i = simIdx.current;
        if (i >= SIM_ROUTE.length) {
          stop(true);
          return;
        }
        const wp = SIM_ROUTE[i];
        const jitter = wp.stop ? () => 0 : () => (Math.random() - 0.5) * 0.01;
        tick(wp.lat + jitter(), wp.lng + jitter(), wp.stop ? 0.5 : 38 + Math.random() * 18, "sim");
        simIdx.current += 1;
      }, 2500);
    }
  }

  function stop(complete: boolean) {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (simTimer.current) {
      clearInterval(simTimer.current);
      simTimer.current = null;
    }
    setActive(false);
    setSpeed(0);
    if (complete && startedAtRef.current !== null && kmRef.current > 0.1) {
      const minutes = (Date.now() - startedAtRef.current) / 60_000;
      const totalKm = kmRef.current;
      setSummary(`${totalKm.toFixed(1)} km in ${Math.max(1, Math.round(minutes))} min — trip saved`);
      void fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate, driver, km: totalKm, minutes }),
      });
    }
  }

  const mins = Math.floor(elapsed / 60), secs = elapsed % 60;
  const vehicle = vehicles.find((v) => v.plate === plate);

  return (
    <div className="drv">
      <div className="drv-head">
        <span className="logo-mark"><I name="bolt" /></span>
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 14, letterSpacing: "-.01em" }}>FleetOne Driver</b>
          <div className="crumb">{driver || "No driver selected"}</div>
        </div>
        {active ? (
          <span className="drv-live"><span className="dot" />LIVE</span>
        ) : (
          <Badge tone="slate">Off duty</Badge>
        )}
        <button className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
          <svg style={{ width: 14, height: 14 }}><use href="#i-arr" /></svg>
        </button>
      </div>

      <div className="drv-body">
        {!active && (
          <div className="card" style={{ padding: 14 }}>
            <div className="fgrid" style={{ marginTop: 0 }}>
              <div className="field wide">
                <label>Vehicle</label>
                <select
                  value={plate}
                  onChange={(e) => {
                    setPlate(e.target.value);
                    const v = vehicles.find((x) => x.plate === e.target.value);
                    if (v) setDriver(v.driver);
                  }}
                >
                  {vehicles.map((v) => (
                    <option key={v.plate} value={v.plate}>{v.plate} · {v.model}</option>
                  ))}
                </select>
              </div>
              <div className="field wide">
                <label>Tracking mode</label>
                <div className="seg">
                  <button className={mode === "gps" ? "on" : ""} onClick={() => setMode("gps")}>Phone GPS</button>
                  <button className={mode === "sim" ? "on" : ""} onClick={() => setMode("sim")}>Demo route</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {active ? (
          <button className="drv-big stop" onClick={() => stop(true)}>
            <I name="check" />End trip
          </button>
        ) : (
          <button className="drv-big go" onClick={start} disabled={!plate}>
            <I name="route" />Start trip
          </button>
        )}

        {gpsError && <div className="form-err">{gpsError}</div>}
        {summary && (
          <div className="card side-note" style={{ borderLeftColor: "var(--emr)" }}>
            <svg style={{ width: 15, height: 15, color: "var(--emr)" }}><use href="#i-check" /></svg>
            <span><b>Trip complete.</b> {summary} — the owner&apos;s dashboard has it already.</span>
          </div>
        )}

        <div className="drv-stats">
          <div className="mini-stat"><b>{km.toFixed(1)}</b><div>km</div></div>
          <div className="mini-stat"><b>{Math.round(speed)}</b><div>km/h</div></div>
          <div className="mini-stat"><b>{mins}:{secs.toString().padStart(2, "0")}</b><div>duration</div></div>
        </div>

        {active && (
          <>
            <div className="card" style={{ padding: 8 }}>
              <RealMap height={220} focusPlate={plate} zoom={12} />
            </div>
            <div className="card side-note" style={{ borderLeftColor: "var(--ind)" }}>
              <svg style={{ width: 15, height: 15, color: "var(--ind)" }}><use href="#i-pin" /></svg>
              <span>
                <b>Streaming location{mode === "sim" ? " (demo route: Bengaluru → Chennai)" : ""}.</b>{" "}
                Keep this page open — position updates every few seconds.
              </span>
            </div>
          </>
        )}

        <button className="btn btn-s full" style={{ padding: 12 }} onClick={() => setFuelOpen(true)}>
          <I name="fuel" />Log a fill-up
        </button>

        {vehicle && (
          <div className="card" style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
            <Av g={vehicle.av} size="md">{driver.split(" ").map((w) => w[0]).join("").slice(0, 2)}</Av>
            <div style={{ flex: 1 }}>
              <b style={{ fontSize: 12 }}>{vehicle.model}</b>
              <div className="crumb">{vehicle.km} km · {vehicle.kmpl} km/L baseline</div>
            </div>
            <span className="plate">{vehicle.plate}</span>
          </div>
        )}
      </div>

      {fuelOpen && (
        <FillUpModal
          vehicles={vehicles.filter((v) => v.plate === plate)}
          coords={lastPos.current ? { lat: lastPos.current[0], lng: lastPos.current[1] } : null}
          onClose={() => setFuelOpen(false)}
          onAdded={(log: FuelLog) => {
            setFuelOpen(false);
            setToastMsg(`${log.litres} L · ₹${log.amountInr.toLocaleString("en-IN")} logged`);
            setTimeout(() => setToastMsg(null), 2800);
          }}
        />
      )}

      <div className={`toast${toastMsg ? " show" : ""}`}>
        <svg style={{ width: 16, height: 16, color: "var(--emr)" }}><use href="#i-check" /></svg>
        <div>
          <b>Fill-up logged</b>
          <span>{toastMsg}</span>
        </div>
      </div>
    </div>
  );
}
