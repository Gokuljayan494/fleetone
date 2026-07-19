"use client";
import { useEffect, useMemo, useState } from "react";
import { I } from "./Icons";
import { Field, Modal, useZodSubmit } from "./forms";
import { FuelLogSchema } from "@/lib/schemas";
import type { FuelLog } from "@/lib/store";
import type { vehicles as vehicleSeed } from "@/data/fleet";

type Vehicle = (typeof vehicleSeed)[number];

export function FuelClient() {
  const [logs, setLogs] = useState<FuelLog[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [open, setOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fuel").then((r) => r.json()).then((d) => setLogs(d.logs));
    fetch("/api/vehicles").then((r) => r.json()).then((d) => setVehicles(d.vehicles));
  }, []);

  const perVehicle = useMemo(() => {
    if (!logs) return [];
    const byPlate = new Map<string, FuelLog[]>();
    for (const l of logs) {
      byPlate.set(l.plate, [...(byPlate.get(l.plate) ?? []), l]);
    }
    return [...byPlate.entries()].map(([plate, ls]) => {
      const withKmpl = ls.filter((l) => l.kmpl !== null);
      const latest = withKmpl[0]?.kmpl ?? null;
      const baseline = vehicles.find((v) => v.plate === plate)?.kmpl ?? null;
      const low = latest !== null && baseline !== null && latest < baseline * 0.8;
      const spend = ls.reduce((s, l) => s + l.amountInr, 0);
      return { plate, fills: ls.length, latest, baseline, low, spend };
    });
  }, [logs, vehicles]);

  return (
    <div className="content">
      <div className="filters">
        <span className="crumb" style={{ fontSize: 12 }}>
          Log every fill-up — FleetOne computes real km/L per vehicle and flags drops below 80% of its baseline.
        </span>
        <button className="btn btn-p push" onClick={() => setOpen(true)}>
          <I name="plus" />Log fill-up
        </button>
      </div>

      <div className="grid-2-1">
        <div className="card">
          <div className="card-h"><h3>Fill-up history</h3><span className="sub">{logs?.length ?? 0} entries</span></div>
          {!logs || logs.length === 0 ? (
            <p style={{ padding: "14px 18px 18px", color: "var(--mut)", fontSize: 12 }}>
              No fill-ups yet. Log the first one — km/L starts computing from the second fill on the same vehicle.
            </p>
          ) : (
            <div style={{ overflowX: "auto", padding: "4px 6px 6px" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Vehicle</th><th>When</th><th className="num">Litres</th>
                    <th className="num">Amount</th><th className="num">Odometer</th><th className="num">km/L</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="strong">{l.plate}</td>
                      <td>{new Date(l.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="num">{l.litres} L</td>
                      <td className="num strong">₹{l.amountInr.toLocaleString("en-IN")}</td>
                      <td className="num">{l.odometer.toLocaleString("en-IN")}</td>
                      <td className="num">{l.kmpl !== null ? <b>{l.kmpl}</b> : <span style={{ color: "var(--soft)" }}>first fill</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: "14px 16px" }}>
          <h3 style={{ fontSize: 13.5, marginBottom: 11 }}>Efficiency watch</h3>
          {perVehicle.length === 0 ? (
            <p style={{ color: "var(--mut)", fontSize: 12 }}>Appears once a vehicle has two fill-ups.</p>
          ) : (
            <div className="col" style={{ gap: 10 }}>
              {perVehicle.map((v) => (
                <div key={v.plate} className="row" style={{ gap: 10 }}>
                  <span className="plate" style={{ fontSize: 10 }}>{v.plate}</span>
                  <span style={{ fontSize: 11.5, color: "var(--mut)", flex: 1 }}>
                    {v.fills} fills · ₹{v.spend.toLocaleString("en-IN")}
                  </span>
                  {v.latest !== null && (
                    <span className={`kmpl-flag ${v.low ? "low" : "ok"}`}>
                      {v.latest} km/L{v.low ? " ⚠ below normal" : ""}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {open && (
        <FillUpModal
          vehicles={vehicles}
          onClose={() => setOpen(false)}
          onAdded={(log) => {
            setLogs((prev) => (prev ? [log, ...prev] : [log]));
            setOpen(false);
            setToastMsg(`${log.litres} L on ${log.plate}${log.kmpl !== null ? ` · ${log.kmpl} km/L` : ""}`);
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

export function FillUpModal({
  vehicles,
  onClose,
  onAdded,
  coords,
}: {
  vehicles: Vehicle[];
  onClose: () => void;
  onAdded: (l: FuelLog) => void;
  coords?: { lat: number; lng: number } | null;
}) {
  const { errors, busy, submit } = useZodSubmit(FuelLogSchema, "/api/fuel");
  const [form, setForm] = useState({ plate: vehicles.length === 1 ? vehicles[0].plate : "", litres: "", amountInr: "", odometer: "", station: "" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title="Log fill-up" sub="From the pump receipt — takes 20 seconds" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit({ ...form, ...(coords ?? {}) }, (body) => onAdded((body as { log: FuelLog }).log));
        }}
      >
        {coords && (
          <div className="crumb" style={{ marginTop: 8 }}>
            📍 Current location will be pinned on the map with this fill-up.
          </div>
        )}
        <div className="fgrid">
          <Field label="Vehicle" error={errors.plate} wide>
            <select value={form.plate} onChange={set("plate")} autoFocus>
              <option value="">Select…</option>
              {vehicles.map((v) => (
                <option key={v.plate} value={v.plate}>{v.plate} · {v.model}</option>
              ))}
            </select>
          </Field>
          <Field label="Litres" error={errors.litres}>
            <input value={form.litres} onChange={set("litres")} placeholder="32" inputMode="decimal" />
          </Field>
          <Field label="Amount (₹)" error={errors.amountInr}>
            <input value={form.amountInr} onChange={set("amountInr")} placeholder="2970" inputMode="numeric" />
          </Field>
          <Field label="Odometer (km)" error={errors.odometer}>
            <input value={form.odometer} onChange={set("odometer")} placeholder="82740" inputMode="numeric" />
          </Field>
          <Field label="Station (optional)" error={errors.station}>
            <input value={form.station} onChange={set("station")} placeholder="IOCL Vellore" />
          </Field>
        </div>
        {errors.form && <div className="form-err">{errors.form}</div>}
        <div className="factions">
          <button type="button" className="btn btn-s" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-p" disabled={busy}>{busy ? "Saving…" : "Save fill-up"}</button>
        </div>
      </form>
    </Modal>
  );
}
