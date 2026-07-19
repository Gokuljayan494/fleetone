"use client";
import { useEffect, useRef } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LivePosition } from "@/lib/store";
import type { FuelLog } from "@/lib/store";

type LiveData = {
  positions: LivePosition[];
  tracks: Record<string, { lat: number; lng: number }[]>;
  stops: Record<string, { lat: number; lng: number }[]>;
};

/**
 * Real map — Leaflet + OpenStreetMap tiles. Polls /api/positions for live
 * vehicles, their route trail and detected stops; /api/fuel for fill-up pins.
 * `focusPlate` keeps the camera following one vehicle (tracking page / driver app).
 */
export function RealMap({
  height = 340,
  focusPlate,
  showFuel = true,
  zoom = 8,
}: {
  height?: number | string;
  focusPlate?: string;
  showFuel?: boolean;
  zoom?: number;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const fuelLayerRef = useRef<LayerGroup | null>(null);
  const didFitRef = useRef(false);

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

      const vehicleIcon = (plate: string, moving: boolean) =>
        L.divIcon({
          className: "veh-marker-wrap",
          html: `<div class="veh-marker${moving ? " moving" : ""}"><span class="pulse-ring"></span><span class="dot"></span><span class="tag">${plate}</span></div>`,
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
          const data: LiveData = await res.json();
          if (cancelled || !layerRef.current) return;
          const layer = layerRef.current;
          layer.clearLayers();

          const shown = focusPlate ? data.positions.filter((p) => p.plate === focusPlate) : data.positions;
          for (const p of shown) {
            const track = data.tracks[p.plate] ?? [];
            if (track.length > 1) {
              L.polyline(track.map((t) => [t.lat, t.lng] as [number, number]), {
                color: "#6366F1", weight: 4, opacity: 0.85, lineCap: "round",
              }).addTo(layer);
            }
            for (const s of data.stops[p.plate] ?? []) {
              L.marker([s.lat, s.lng], { icon: stopIcon }).addTo(layer);
            }
            L.marker([p.lat, p.lng], { icon: vehicleIcon(p.plate, p.speed > 3) })
              .bindPopup(`<b>${p.plate}</b><br>${Math.round(p.speed)} km/h · ${p.source === "sim" ? "demo route" : p.source}`)
              .addTo(layer);
          }

          if (shown.length > 0) {
            if (focusPlate) {
              map.panTo([shown[0].lat, shown[0].lng], { animate: true });
            } else if (!didFitRef.current) {
              didFitRef.current = true;
              map.fitBounds(L.latLngBounds(shown.map((p) => [p.lat, p.lng] as [number, number])).pad(0.3), { maxZoom: 10 });
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
          const data: { logs: FuelLog[] } = await res.json();
          if (cancelled || !fuelLayerRef.current) return;
          fuelLayerRef.current.clearLayers();
          for (const log of data.logs) {
            if (log.lat === undefined || log.lng === undefined) continue;
            if (focusPlate && log.plate !== focusPlate) continue;
            L.marker([log.lat, log.lng], { icon: fuelIcon(`${log.plate} · ${log.litres} L`) })
              .bindPopup(`<b>Fill-up · ${log.plate}</b><br>${log.litres} L · ₹${log.amountInr.toLocaleString("en-IN")}${log.station ? `<br>${log.station}` : ""}`)
              .addTo(fuelLayerRef.current);
          }
        } catch {
          /* ignore */
        }
      };

      await drawLive();
      await drawFuel();
      poll = setInterval(drawLive, 3000);
      fuelPoll = setInterval(drawFuel, 15000);
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

  return <div ref={divRef} className="realmap" style={{ height, width: "100%" }} />;
}
