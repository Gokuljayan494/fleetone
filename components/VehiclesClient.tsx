"use client";
import { useEffect, useMemo, useState } from "react";
import { I } from "./Icons";
import { Av, Bar, VehicleArt } from "./ui";
import { ConfirmDelete, Field, Modal, useZodSubmit } from "./forms";
import { VehicleSchema } from "@/lib/schemas";
import type { Vehicle } from "@/lib/types";

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
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [removing, setRemoving] = useState<Vehicle | null>(null);
  const [toast, setToast] = useState<{ title: string; msg: string } | null>(null);

  const say = (title: string, msg: string) => {
    setToast({ title, msg });
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    fetch("/api/vehicles")
      .then((r) => r.json())
      .then((d) => setVehicles(d.vehicles ?? []));
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
                <div className="dactions" style={{ padding: "0 14px 14px" }}>
                  <button className="btn btn-s" onClick={() => setEditing(v)}><I name="edit" />Edit</button>
                  <button className="btn btn-s danger" onClick={() => setRemoving(v)}><I name="trash" />Retire</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EditVehicleModal
          vehicle={editing}
          onClose={() => setEditing(null)}
          onSaved={(v) => {
            setVehicles((prev) => prev?.map((x) => (x.plate === v.plate ? v : x)) ?? null);
            setEditing(null);
            say("Vehicle updated", `${v.plate} saved`);
          }}
        />
      )}

      {removing && (
        <ConfirmDelete
          title="Retire vehicle"
          body={
            <>
              <b>{removing.plate}</b> ({removing.model}) will be removed from the fleet
              along with its live position and tracking history. Trips, fuel logs and
              expenses already recorded against it are kept.
            </>
          }
          confirmLabel="Retire vehicle"
          url={`/api/vehicles/${encodeURIComponent(removing.plate)}`}
          onClose={() => setRemoving(null)}
          onDeleted={() => {
            const plate = removing.plate;
            setVehicles((prev) => prev?.filter((x) => x.plate !== plate) ?? null);
            setRemoving(null);
            say("Vehicle retired", `${plate} left the fleet`);
          }}
        />
      )}

      {open && (
        <AddVehicleModal
          onClose={() => setOpen(false)}
          onAdded={(v) => {
            setVehicles((prev) => (prev ? [v, ...prev] : [v]));
            setOpen(false);
            say("Vehicle added", `${v.plate} joined the fleet`);
          }}
        />
      )}

      <div className={`toast${toast ? " show" : ""}`}>
        <svg style={{ width: 16, height: 16, color: "var(--emr)" }}><use href="#i-check" /></svg>
        <div>
          <b>{toast?.title}</b>
          <span>{toast?.msg}</span>
        </div>
      </div>
    </div>
  );
}

const STATUSES = ["Parked", "On trip", "In transit", "Service due", "Insurance expiring"];

function EditVehicleModal({
  vehicle, onClose, onSaved,
}: { vehicle: Vehicle; onClose: () => void; onSaved: (v: Vehicle) => void }) {
  const [form, setForm] = useState({
    model: vehicle.model,
    driver: vehicle.driver,
    kind: vehicle.kind,
    status: vehicle.status,
    // Odometer is stored formatted ("82,410"); edit it as a plain number.
    km: vehicle.km.replace(/[^\d]/g, ""),
    kmpl: String(vehicle.kmpl),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch(`/api/vehicles/${encodeURIComponent(vehicle.plate)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(body.errors ?? { form: body.error ?? "Could not save" });
        return;
      }
      onSaved(body.vehicle as Vehicle);
    } catch {
      setErrors({ form: "Network error — try again" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Edit ${vehicle.plate}`} sub="The registration plate cannot be changed" onClose={onClose}>
      <form onSubmit={save}>
        <div className="fgrid">
          <Field label="Model" error={errors.model} wide>
            <input value={form.model} onChange={set("model")} autoFocus />
          </Field>
          <Field label="Type" error={errors.kind}>
            <select value={form.kind} onChange={set("kind")}>
              <option value="van">Mini truck / van</option>
              <option value="truck">Truck / LCV</option>
            </select>
          </Field>
          <Field label="Status" error={errors.status}>
            <select value={form.status} onChange={set("status")}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Driver" error={errors.driver} wide>
            <input value={form.driver} onChange={set("driver")} />
          </Field>
          <Field label="Mileage (km/L)" error={errors.kmpl}>
            <input value={form.kmpl} onChange={set("kmpl")} inputMode="decimal" />
          </Field>
          <Field label="Odometer (km)" error={errors.km}>
            <input value={form.km} onChange={set("km")} inputMode="numeric" />
          </Field>
        </div>
        {errors.form && <div className="form-err">{errors.form}</div>}
        <div className="factions">
          <button type="button" className="btn btn-s" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-p" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </Modal>
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
