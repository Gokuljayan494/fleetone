"use client";
import { useEffect, useMemo, useState } from "react";
import { I } from "./Icons";
import { Av, Bar, VehicleArt } from "./ui";
import { Field, Modal, useZodSubmit } from "./forms";
import { VehicleSchema } from "@/lib/schemas";
import type { vehicles as seedType } from "@/data/fleet";

type Vehicle = (typeof seedType)[number];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active", dot: "var(--emr)", match: (v: Vehicle) => v.tone === "emr" || v.tone === "sky" },
  { key: "attention", label: "Needs attention", dot: "var(--org)", match: (v: Vehicle) => v.tone === "org" || v.tone === "red" },
  { key: "parked", label: "Parked", dot: "var(--soft)", match: (v: Vehicle) => v.tone === "slate" },
] as const;

export function VehiclesClient() {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [open, setOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/vehicles")
      .then((r) => r.json())
      .then((d) => setVehicles(d.vehicles));
  }, []);

  const shown = useMemo(() => {
    if (!vehicles) return [];
    const f = FILTERS.find((f) => f.key === filter);
    return f && "match" in f ? vehicles.filter(f.match) : vehicles;
  }, [vehicles, filter]);

  const counts = useMemo(() => {
    const list = vehicles ?? [];
    return Object.fromEntries(
      FILTERS.map((f) => [f.key, "match" in f ? list.filter(f.match).length : list.length]),
    );
  }, [vehicles]);

  return (
    <div className="content">
      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f.key} className={`fpill${filter === f.key ? " on" : ""}`} onClick={() => setFilter(f.key)}>
            {"dot" in f && f.dot ? <i style={{ background: f.dot }} /> : null}
            {f.label} {counts[f.key] ?? 0}
          </button>
        ))}
        <button className="btn btn-p push" onClick={() => setOpen(true)}>
          <I name="plus" />Add vehicle
        </button>
      </div>

      {!vehicles ? (
        <div className="crumb">Loading fleet…</div>
      ) : (
        <div className="vgrid">
          {shown.map((v) => {
            const healthColor = v.health >= 80 ? "var(--emr)" : "var(--org)";
            const healthInk = v.health >= 80 ? "var(--emr-ink)" : "var(--org-ink)";
            return (
              <div key={v.plate} className="vcard">
                <VehicleArt kind={v.kind} stroke={v.stroke} tint={v.tint} status={v.status} tone={v.tone} />
                <div className="vbody">
                  <div className="vname">
                    <b>{v.model}</b>
                    <span className="plate">{v.plate}</span>
                  </div>
                  <div className="vdriver">
                    <Av g={v.av}>{v.driver.split(" ").map((w) => w[0]).join("").slice(0, 2)}</Av>
                    {v.driver}
                    <span className="role">· driver</span>
                  </div>
                  <div className="vhealth">
                    <span className="lbl">Health</span>
                    <Bar pct={v.health} color={healthColor} />
                    <b style={{ color: healthInk }}>{v.health}%</b>
                  </div>
                </div>
                <div className="vstat">
                  <div><b>{v.lastService}</b><span>LAST SERVICE</span></div>
                  <div><b>{v.km}</b><span>KM</span></div>
                  <div><b>{v.kmpl}</b><span>KM / L</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <AddVehicleModal
          onClose={() => setOpen(false)}
          onAdded={(v) => {
            setVehicles((prev) => (prev ? [v, ...prev] : [v]));
            setOpen(false);
            setToastMsg(`${v.plate} joined the fleet`);
            setTimeout(() => setToastMsg(null), 2800);
          }}
        />
      )}

      <div className={`toast${toastMsg ? " show" : ""}`}>
        <svg style={{ width: 16, height: 16, color: "var(--emr)" }}><use href="#i-check" /></svg>
        <div>
          <b>Vehicle added</b>
          <span>{toastMsg}</span>
        </div>
      </div>
    </div>
  );
}

function AddVehicleModal({ onClose, onAdded }: { onClose: () => void; onAdded: (v: Vehicle) => void }) {
  const { errors, busy, submit } = useZodSubmit(VehicleSchema, "/api/vehicles");
  const [form, setForm] = useState({ model: "", plate: "", driver: "", kind: "van", kmpl: "", km: "" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title="Add vehicle" sub="Registered commercial vehicle joining this fleet" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(form, (body) => onAdded((body as { vehicle: Vehicle }).vehicle));
        }}
      >
        <div className="fgrid">
          <Field label="Model" error={errors.model} wide>
            <input value={form.model} onChange={set("model")} placeholder="Tata Ace Gold" autoFocus />
          </Field>
          <Field label="Registration plate" error={errors.plate}>
            <input value={form.plate} onChange={set("plate")} placeholder="KA 05 MJ 2211" />
          </Field>
          <Field label="Type" error={errors.kind}>
            <select value={form.kind} onChange={set("kind")}>
              <option value="van">Mini truck / van</option>
              <option value="truck">Truck / LCV</option>
            </select>
          </Field>
          <Field label="Driver" error={errors.driver} wide>
            <input value={form.driver} onChange={set("driver")} placeholder="Suresh Kumar" />
          </Field>
          <Field label="Mileage (km/L)" error={errors.kmpl}>
            <input value={form.kmpl} onChange={set("kmpl")} placeholder="13.2" inputMode="decimal" />
          </Field>
          <Field label="Odometer (km)" error={errors.km}>
            <input value={form.km} onChange={set("km")} placeholder="82410" inputMode="numeric" />
          </Field>
        </div>
        {errors.form && <div className="form-err">{errors.form}</div>}
        <div className="factions">
          <button type="button" className="btn btn-s" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-p" disabled={busy}>{busy ? "Adding…" : "Add vehicle"}</button>
        </div>
      </form>
    </Modal>
  );
}
