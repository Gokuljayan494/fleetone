"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { I } from "./Icons";
import { Av, Badge } from "./ui";
import { FillUpModal } from "./FuelClient";
import { RealMap } from "./RealMap";
import type { Vehicle } from "@/lib/types";
import type { FuelLog } from "@/lib/store";

/** Simplified Bengaluru → Chennai corridor for demo mode; `stop` points idle at a fuel halt near Vellore. */
const SIM_ROUTE: { lat: number; lng: number; stop?: boolean }[] = [
  { lat: 12.97, lng: 77.59 }, { lat: 12.88, lng: 77.75 }, { lat: 12.79, lng: 77.88 },
  { lat: 12.74, lng: 78.05 }, { lat: 12.72, lng: 78.25 }, { lat: 12.70, lng: 78.45 },
  { lat: 12.92, lng: 79.13, stop: true }, { lat: 12.92, lng: 79.13, stop: true },
  { lat: 12.95, lng: 79.33 }, { lat: 12.98, lng: 79.45 }, { lat: 13.02, lng: 79.65 },
  { lat: 13.05, lng: 79.85 }, { lat: 13.07, lng: 80.05 }, { lat: 13.08, lng: 80.21 },
];

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371, dLat = ((b[0] - a[0]) * Math.PI) / 180, dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * The active trip, mirrored to localStorage so a refresh (or the phone locking
 * and the tab reloading) resumes the same trip instead of losing it. Time spent
 * on a break does not count toward the trip clock.
 */
type TripState = {
  plate: string;
  driver: string;
  mode: "gps" | "sim";
  startedAt: number;
  km: number;
  pausedMs: number;         // total time already spent on breaks
  pauseStartedAt: number | null; // set while currently on a break
  simIdx: number;
  lastLat: number | null;
  lastLng: number | null;
};

const KEY = (plate: string) => `fleetone.trip.${plate}`;

export function DriverClient({ driverName, assignedPlate }: { driverName: string; assignedPlate: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [plate, setPlate] = useState(assignedPlate);
  const [driver, setDriver] = useState(driverName);
  const [mode, setMode] = useState<"gps" | "sim">("gps");

  const [trip, setTrip] = useState<TripState | null>(null);
  const [speed, setSpeed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [fuelOpen, setFuelOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const tripRef = useRef<TripState | null>(null);
  const lastFixTs = useRef<number>(0);
  const watchId = useRef<number | null>(null);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const [screenLocked, setScreenLocked] = useState(false);

  const active = trip !== null;
  const onBreak = trip?.pauseStartedAt != null;

  // Keep a ref in step with state so timers and GPS callbacks read the latest.
  const persist = useCallback((t: TripState | null) => {
    tripRef.current = t;
    setTrip(t);
    if (typeof window === "undefined") return;
    if (t) localStorage.setItem(KEY(t.plate), JSON.stringify(t));
  }, []);

  useEffect(() => {
    fetch("/api/vehicles").then((r) => r.json()).then((d) => setVehicles(d.vehicles ?? []));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/driver/login";
  }

  /* --------------------------------------------------------- tracking loop */

  const post = useCallback((p: string, lat: number, lng: number, spd: number, source: "phone" | "sim") => {
    void fetch("/api/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plate: p, lat, lng, speed: spd, source }),
    }).catch(() => {
      /* offline ping dropped; the next one retries */
    });
  }, []);

  // One position fix — accumulate distance, derive speed, post, and persist so
  // the running total survives a reload.
  const onFix = useCallback(
    (lat: number, lng: number, coordsSpeed: number | null, source: "phone" | "sim") => {
      const t = tripRef.current;
      if (!t || t.pauseStartedAt != null) return;

      const here: [number, number] = [lat, lng];
      const now = Date.now();
      let spd = coordsSpeed ?? 0;

      if (t.lastLat != null && t.lastLng != null) {
        const d = haversineKm([t.lastLat, t.lastLng], here);
        t.km += d;
        // Phones often report coords.speed as null; derive it from movement so
        // the driver actually sees a speed when the vehicle is moving.
        if ((coordsSpeed == null || coordsSpeed === 0) && lastFixTs.current) {
          const hrs = (now - lastFixTs.current) / 3_600_000;
          if (hrs > 0) spd = d / hrs;
        }
      }
      t.lastLat = lat;
      t.lastLng = lng;
      lastFixTs.current = now;
      persist({ ...t });
      setSpeed(spd);
      post(t.plate, lat, lng, Math.min(200, Math.round(spd)), source);
    },
    [persist, post],
  );

  const startGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("This browser has no GPS access — use demo mode.");
      return false;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (p) => onFix(p.coords.latitude, p.coords.longitude, p.coords.speed != null ? p.coords.speed * 3.6 : null, "phone"),
      (e) =>
        setGpsError(
          e.code === 1
            ? "Location permission denied — allow it in your browser, or use demo mode."
            : "GPS signal unavailable — moving to a clearer spot may help.",
        ),
      // maximumAge 0 forces a fresh fix each time, so movement shows immediately.
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return true;
  }, [onFix]);

  const startSim = useCallback(() => {
    simTimer.current = setInterval(() => {
      const t = tripRef.current;
      if (!t) return;
      if (t.simIdx >= SIM_ROUTE.length) {
        void finish();
        return;
      }
      const wp = SIM_ROUTE[t.simIdx];
      const jit = wp.stop ? 0 : (Math.random() - 0.5) * 0.01;
      t.simIdx += 1;
      onFix(wp.lat + jit, wp.lng + jit, wp.stop ? 0 : 40 + Math.random() * 18, "sim");
    }, 2500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFix]);

  // Keep the screen awake during a trip. This is what stops the phone dimming
  // and suspending the page mid-drive — the usual cause of "it stopped when I
  // put the phone down". The OS still suspends us if the driver hard-locks the
  // phone; a hardware tracker is the only true screen-off answer.
  const acquireWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLock.current = await navigator.wakeLock.request("screen");
        wakeLock.current.addEventListener?.("release", () => {
          wakeLock.current = null;
        });
      }
    } catch {
      /* denied or unsupported — the trip still tracks while the tab is visible */
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLock.current?.release();
    } catch {
      /* already gone */
    }
    wakeLock.current = null;
  }, []);

  const stopTracking = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (simTimer.current) {
      clearInterval(simTimer.current);
      simTimer.current = null;
    }
    void releaseWakeLock();
  }, [releaseWakeLock]);

  const beginTracking = useCallback(
    (t: TripState) => {
      lastFixTs.current = 0;
      void acquireWakeLock();
      if (t.mode === "gps") {
        const ok = startGps();
        if (!ok) return;
      } else {
        startSim();
      }
    },
    [startGps, startSim, acquireWakeLock],
  );

  // When the driver returns to the app (screen back on, tab refocused), the OS
  // may have cleared the wake lock and throttled or killed the geolocation
  // watch. Re-acquire the lock and re-arm tracking so it keeps going.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") {
        // Went to the background — note it so the UI can warn on return.
        if (tripRef.current && tripRef.current.pauseStartedAt == null) setScreenLocked(true);
        return;
      }
      const t = tripRef.current;
      if (!t || t.pauseStartedAt != null) return;
      setScreenLocked(false);
      void acquireWakeLock();
      // Restart the watcher cleanly rather than trusting a throttled one.
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (simTimer.current) {
        clearInterval(simTimer.current);
        simTimer.current = null;
      }
      lastFixTs.current = 0;
      if (t.mode === "gps") startGps();
      else startSim();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acquireWakeLock, startGps, startSim]);

  /* ------------------------------------------------------- resume on mount */

  // If a trip was in progress when the page was last open, pick it back up.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(KEY(assignedPlate));
    if (!raw) return;
    try {
      const t = JSON.parse(raw) as TripState;
      tripRef.current = t;
      setTrip(t);
      setPlate(t.plate);
      setDriver(t.driver);
      setMode(t.mode);
      if (t.pauseStartedAt == null) beginTracking(t);
    } catch {
      localStorage.removeItem(KEY(assignedPlate));
    }
    return () => stopTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedPlate]);

  // Trip clock — excludes time spent on breaks.
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const t = tripRef.current;
      if (!t) return;
      const pausedNow = t.pauseStartedAt != null ? Date.now() - t.pauseStartedAt : 0;
      setElapsed(Math.max(0, Math.floor((Date.now() - t.startedAt - t.pausedMs - pausedNow) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, onBreak]);

  /* ------------------------------------------------------------- controls */

  function start() {
    if (!plate) return;
    setSummary(null);
    setGpsError(null);
    const t: TripState = {
      plate, driver, mode,
      startedAt: Date.now(),
      km: 0, pausedMs: 0, pauseStartedAt: null,
      simIdx: 0, lastLat: null, lastLng: null,
    };
    persist(t);
    setSpeed(0);
    setElapsed(0);
    beginTracking(t);
  }

  function takeBreak() {
    const t = tripRef.current;
    if (!t || t.pauseStartedAt != null) return;
    stopTracking();
    setSpeed(0);
    persist({ ...t, pauseStartedAt: Date.now(), lastLat: null, lastLng: null });
  }

  function resume() {
    const t = tripRef.current;
    if (!t || t.pauseStartedAt == null) return;
    const resumed: TripState = {
      ...t,
      pausedMs: t.pausedMs + (Date.now() - t.pauseStartedAt),
      pauseStartedAt: null,
    };
    persist(resumed);
    beginTracking(resumed);
  }

  async function finish() {
    const t = tripRef.current;
    stopTracking();
    if (typeof window !== "undefined" && t) localStorage.removeItem(KEY(t.plate));
    tripRef.current = null;
    setTrip(null);
    setSpeed(0);

    if (t && t.km > 0.1) {
      const pausedNow = t.pauseStartedAt != null ? Date.now() - t.pauseStartedAt : 0;
      const minutes = Math.max(1, (Date.now() - t.startedAt - t.pausedMs - pausedNow) / 60_000);
      setSummary(`${t.km.toFixed(1)} km in ${Math.round(minutes)} min — trip saved`);
      await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: t.plate, driver: t.driver, km: t.km, minutes }),
      }).catch(() => {});
    } else {
      setSummary("Trip discarded — too short to record.");
    }
  }

  const mins = Math.floor(elapsed / 60), secs = elapsed % 60;
  const vehicle = vehicles.find((v) => v.plate === plate);
  const km = trip?.km ?? 0;

  return (
    <div className="drv">
      <div className="drv-head">
        <span className="logo-mark"><I name="bolt" /></span>
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 14, letterSpacing: "-.01em" }}>FleetOne Driver</b>
          <div className="crumb">{driver || "No driver selected"}</div>
        </div>
        {active ? (
          onBreak ? <Badge tone="org">On break</Badge> : <span className="drv-live"><span className="dot" />LIVE</span>
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

        {!active ? (
          <button className="drv-big go" onClick={start} disabled={!plate}>
            <I name="route" />Start trip
          </button>
        ) : (
          <>
            {onBreak ? (
              <button className="drv-big go" onClick={resume}>
                <I name="route" />Resume trip
              </button>
            ) : (
              <button className="drv-big brk" onClick={takeBreak}>
                <I name="pause" />Take a break
              </button>
            )}
            <button className="btn btn-s full" style={{ padding: 12 }} onClick={finish}>
              <I name="check" />End trip
            </button>
          </>
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
              <RealMap height={220} focusPlate={plate} showFuel={false} zoom={13} />
            </div>
            <div className="card side-note" style={{ borderLeftColor: onBreak ? "var(--org)" : "var(--ind)" }}>
              <svg style={{ width: 15, height: 15, color: onBreak ? "var(--org)" : "var(--ind)" }}><use href="#i-pin" /></svg>
              <span>
                {onBreak ? (
                  <><b>On a break.</b> Tracking is paused and the clock is stopped. Tap Resume when you set off again.</>
                ) : (
                  <>
                    <b>Streaming location{mode === "sim" ? " (demo route)" : ""}.</b>{" "}
                    The screen stays on while driving. You can refresh and the trip continues.
                  </>
                )}
              </span>
            </div>
            {screenLocked && !onBreak && (
              <div className="card side-note" style={{ borderLeftColor: "var(--org)" }}>
                <svg style={{ width: 15, height: 15, color: "var(--org)" }}><use href="#i-warn" /></svg>
                <span>
                  <b>The phone was locked.</b> Location can&apos;t update while the screen is off,
                  so that stretch isn&apos;t on the map. For hands-off tracking, ask your owner to
                  fit a GPS device — it reports even with the phone away.
                </span>
              </div>
            )}
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
          coords={trip?.lastLat != null && trip.lastLng != null ? { lat: trip.lastLat, lng: trip.lastLng } : null}
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
