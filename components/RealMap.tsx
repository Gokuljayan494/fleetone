"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FuelLog, LivePosition } from "@/lib/store";

type Fix = LivePosition & { ageMs: number; status: "moving" | "idle" | "stale" | "offline" };

type LiveData = {
  positions: Fix[];
  missing: { plate: string; model: string; driver: string }[];
  tracks: Record<string, { lat: number; lng: number }[]>;
  stops: Record<string, { lat: number; lng: number }[]>;
  summary: { moving: number; idle: number; stale: number; offline: number; neverReported: number };
};

/** "3m ago", "2h ago" — how old the fix is, in plain words. */
function since(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_COLOR: Record<Fix["status"], string> = {
  moving: "#059669",
  idle: "#0369A1",
  stale: "#C2410C",
  offline: "#64748B",
};
const STATUS_LABEL: Record<Fix["status"], string> = {
  moving: "Moving",
  idle: "Stopped",
  stale: "No signal",
  offline: "Offline",
};

/**
 * Real map — Leaflet + OpenStreetMap tiles. Shows every vehicle's latest known
 * position, coloured by how fresh the fix is, with its route trail and detected
 * stops; /api/fuel adds fill-up pins.
 * `focusPlate` keeps the camera following one vehicle (tracking page / driver app).
 */
export function RealMap({
  height = 340,
  focusPlate,
  showFuel = true,
  zoom = 8,
  showPlates,
}: {
  height?: number | string;
  focusPlate?: string;
  showFuel?: boolean;
  zoom?: number;
  /** When set, only these plates are drawn — used by the tracking filter. */
  showPlates?: string[] | null;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const fuelLayerRef = useRef<LayerGroup | null>(null);
  const didFitRef = useRef(false);
  const [empty, setEmpty] = useState<{ vehicles: number } | null>(null);

  // Read the filter through a ref so changing it re-draws without tearing the
  // map down and rebuilding it.
  const showPlatesRef = useRef(showPlates);
  useEffect(() => {
    showPlatesRef.current = showPlates;
    didFitRef.current = false; // refit the camera to the new selection
  }, [showPlates]);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let fuelPoll: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !divRef.current || mapRef.current) return;

      const map = L.map(divRef.current, { zoomControl: true, attributionControl: true }).setView([12.9, 78.9], zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      fuelLayerRef.current = L.layerGroup().addTo(map);

      const vehicleIcon = (plate: string, status: Fix["status"]) =>
        L.divIcon({
          className: "veh-marker-wrap",
          html: `<div class="veh-marker ${status}"${status === "moving" ? ' data-moving="1"' : ""}>
                   <span class="pulse-ring"></span>
                   <span class="dot" style="background:${STATUS_COLOR[status]}"></span>
                   <span class="tag">${plate}</span>
                 </div>`,
          iconSize: [0, 0],
        });
      const stopIcon = L.divIcon({
        className: "veh-marker-wrap",
        html: `<div class="stop-marker" title="Stop detected"></div>`,
        iconSize: [0, 0],
      });
      const fuelIcon = (label: string) =>
        L.divIcon({
          className: "veh-marker-wrap",
          html: `<div class="fuel-marker" title="${label}">⛽</div>`,
          iconSize: [0, 0],
        });

      const drawLive = async () => {
        try {
          const res = await fetch("/api/positions");
          if (!res.ok) return;
          const data: LiveData = await res.json();
          if (cancelled || !layerRef.current) return;
          const layer = layerRef.current;
          layer.clearLayers();

          let shown = data.positions;
          if (focusPlate) shown = shown.filter((p) => p.plate === focusPlate);
          else if (showPlatesRef.current) {
            const allow = new Set(showPlatesRef.current);
            shown = shown.filter((p) => allow.has(p.plate));
          }

          // Nothing has ever reported — say so rather than showing bare tiles.
          setEmpty(
            shown.length === 0
              ? { vehicles: data.missing.length + (focusPlate ? 0 : data.positions.length) }
              : null,
          );

          for (const p of shown) {
            const track = data.tracks[p.plate] ?? [];
            if (track.length > 1) {
              L.polyline(track.map((t) => [t.lat, t.lng] as [number, number]), {
                color: STATUS_COLOR[p.status],
                weight: 4,
                // Fade the trail when the fix is old, so a day-old path does not
                // read as current movement.
                opacity: p.status === "stale" || p.status === "offline" ? 0.4 : 0.85,
                lineCap: "round",
              }).addTo(layer);
            }
            for (const s of data.stops[p.plate] ?? []) {
              L.marker([s.lat, s.lng], { icon: stopIcon }).addTo(layer);
            }
            L.marker([p.lat, p.lng], { icon: vehicleIcon(p.plate, p.status) })
              .bindPopup(
                `<b>${p.plate}</b><br>` +
                  `${STATUS_LABEL[p.status]} · ${Math.round(p.speed)} km/h<br>` +
                  `<span style="color:#64748B">Last fix ${since(p.ageMs)} · ${p.source}</span>`,
              )
              .addTo(layer);
          }

          if (shown.length > 0) {
            if (focusPlate) {
              map.panTo([shown[0].lat, shown[0].lng], { animate: true });
            } else if (!didFitRef.current) {
              didFitRef.current = true;
              map.fitBounds(L.latLngBounds(shown.map((p) => [p.lat, p.lng] as [number, number])).pad(0.3), { maxZoom: 11 });
            }
          }
        } catch {
          /* server briefly unavailable — retry on next tick */
        }
      };

      const drawFuel = async () => {
        if (!showFuel) return;
        try {
          const res = await fetch("/api/fuel");
          if (!res.ok) return;
          const data: { logs: FuelLog[] } = await res.json();
          if (cancelled || !fuelLayerRef.current) return;
          fuelLayerRef.current.clearLayers();
          for (const log of data.logs) {
            if (log.lat === undefined || log.lng === undefined) continue;
            if (focusPlate && log.plate !== focusPlate) continue;
            L.marker([log.lat, log.lng], { icon: fuelIcon(`${log.plate} · ${log.litres} L`) })
              .bindPopup(
                `<b>Fill-up · ${log.plate}</b><br>${log.litres} L · ₹${log.amountInr.toLocaleString("en-IN")}` +
                  (log.station ? `<br>${log.station}` : ""),
              )
              .addTo(fuelLayerRef.current);
          }
        } catch {
          /* ignore */
        }
      };

      await drawLive();
      await drawFuel();
      poll = setInterval(drawLive, 5000);
      fuelPoll = setInterval(drawFuel, 30000);
    })();

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (fuelPoll) clearInterval(fuelPoll);
      mapRef.current?.remove();
      mapRef.current = null;
      didFitRef.current = false;
    };
  }, [focusPlate, showFuel, zoom]);

  return (
    <div style={{ position: "relative" }}>
      <div ref={divRef} className="realmap" style={{ height, width: "100%" }} />
      {empty && (
        <div className="map-empty">
          <b>No vehicle is reporting its location yet</b>
          <p>
            {empty.vehicles > 0
              ? `${empty.vehicles} vehicle${empty.vehicles === 1 ? "" : "s"} in your fleet, none sending GPS.`
              : "Add a vehicle to start tracking."}
          </p>
          <p>
            Positions arrive when a driver signs in on their phone, or when a GPS
            box posts to <code>/api/positions</code> with your device key.
          </p>
        </div>
      )}
    </div>
  );
}
