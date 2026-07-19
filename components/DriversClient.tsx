"use client";
import { useEffect, useState } from "react";
import { I } from "./Icons";
import { Av, Badge, Ring, Stars } from "./ui";
import { Field, Modal, useZodSubmit } from "./forms";
import { DriverSchema } from "@/lib/schemas";
import type { drivers as seedType, vehicles as vehicleSeed } from "@/data/fleet";

type Driver = (typeof seedType)[number];
type Vehicle = (typeof vehicleSeed)[number];

export function DriversClient() {
  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [open, setOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/drivers").then((r) => r.json()).then((d) => setDrivers(d.drivers));
    fetch("/api/vehicles").then((r) => r.json()).then((d) => setVehicles(d.vehicles));
  }, []);

  return (
    <div className="content">
      <div className="filters">
        <button className="fpill on">All {drivers?.length ?? 0}</button>
        <button className="fpill">On duty</button>
        <button className="fpill">License expiring</button>
        <button className="btn btn-p push" onClick={() => setOpen(true)}>
          <I name="plus" />Add driver
        </button>
      </div>

      {!drivers ? (
        <div className="crumb">Loading drivers…</div>
      ) : (
        <div className="dgrid">
          {drivers.map((d) => (
            <div key={d.name} className="dcard">
              <div className="dhead">
                <Av g={d.av} size="lg">{d.initials}</Av>
                <div className="who">
                  <b>{d.name}</b>
                  <div className="rate">
                    <Stars on={d.starsOn} />
                    {d.rating.toFixed(1)}
                  </div>
                </div>
                <Ring score={d.score} />
              </div>
              <div className="dtags">
                <Badge tone={d.license.tone}>{d.license.label}</Badge>
                <Badge tone="ind">{d.vehicle}</Badge>
              </div>
              <div className="drow"><span>Trips this month</span><b>{d.trips}</b></div>
              <div className="drow"><span>Attendance</span><b>{d.attendance}%</b></div>
              <div className="drow"><span>On-time delivery</span><b>{d.onTime}%</b></div>
              <div className="dactions">
                <button className="btn btn-s"><I name="phone" />Call</button>
                <button className="btn btn-s"><I name="msg" />Message</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <AddDriverModal
          vehicles={vehicles}
          onClose={() => setOpen(false)}
          onAdded={(d) => {
            setDrivers((prev) => (prev ? [d, ...prev] : [d]));
            setOpen(false);
            setToastMsg(`${d.name} added to the team`);
            setTimeout(() => setToastMsg(null), 2800);
          }}
        />
      )}

      <div className={`toast${toastMsg ? " show" : ""}`}>
        <svg style={{ width: 16, height: 16, color: "var(--emr)" }}><use href="#i-check" /></svg>
        <div>
          <b>Driver added</b>
          <span>{toastMsg}</span>
        </div>
      </div>
    </div>
  );
}

type Cred = { driverId: string; pin: string };

function AddDriverModal({ vehicles, onClose, onAdded }: { vehicles: Vehicle[]; onClose: () => void; onAdded: (d: Driver) => void }) {
  const { errors, busy, submit } = useZodSubmit(DriverSchema, "/api/drivers");
  const [form, setForm] = useState({ name: "", phone: "", license: "", licenseExpiry: "", vehicle: "" });
  const [cred, setCred] = useState<Cred | null>(null);
  const [added, setAdded] = useState<Driver | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (cred && added) {
    return (
      <Modal title="Driver added ✓" sub="Hand these sign-in details to the driver — shown only once" onClose={() => onAdded(added)}>
        <div className="cred-card">
          <b style={{ fontSize: 13 }}>{added.name} · FleetOne Driver app</b>
          <div className="row2">
            <div className="cell"><span>DRIVER ID</span><b>{cred.driverId}</b></div>
            <div className="cell"><span>PIN</span><b>{cred.pin}</b></div>
          </div>
          <p>They sign in at <b>fleetone.in/driver</b> — trips, live location and fill-ups run from their phone.</p>
        </div>
        <div className="factions">
          <button type="button" className="btn btn-p" onClick={() => onAdded(added)}>Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add driver" sub="License details are checked for expiry" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(form, (body) => {
            const b = body as { driver: Driver; cred: Cred };
            setAdded(b.driver);
            setCred(b.cred);
          });
        }}
      >
        <div className="fgrid">
          <Field label="Full name" error={errors.name} wide>
            <input value={form.name} onChange={set("name")} placeholder="Suresh Kumar" autoFocus />
          </Field>
          <Field label="Mobile" error={errors.phone}>
            <input value={form.phone} onChange={set("phone")} placeholder="9876543210" inputMode="numeric" />
          </Field>
          <Field label="Assigned vehicle" error={errors.vehicle}>
            <select value={form.vehicle} onChange={set("vehicle")}>
              <option value="">Select…</option>
              {vehicles.map((v) => (
                <option key={v.plate} value={v.plate}>{v.plate}</option>
              ))}
            </select>
          </Field>
          <Field label="License number" error={errors.license}>
            <input value={form.license} onChange={set("license")} placeholder="KA05 20190001234" />
          </Field>
          <Field label="License expiry" error={errors.licenseExpiry}>
            <input type="date" value={form.licenseExpiry} onChange={set("licenseExpiry")} />
          </Field>
        </div>
        {errors.form && <div className="form-err">{errors.form}</div>}
        <div className="factions">
          <button type="button" className="btn btn-s" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-p" disabled={busy}>{busy ? "Adding…" : "Add driver"}</button>
        </div>
      </form>
    </Modal>
  );
}
