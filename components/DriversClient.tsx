"use client";
import { useEffect, useState } from "react";
import { I } from "./Icons";
import { Av, Badge, Ring, Stars } from "./ui";
import { ConfirmDelete, Field, Modal, useZodSubmit } from "./forms";
import { DriverCredentialSchema, DriverSchema } from "@/lib/schemas";
import type { Driver, Vehicle } from "@/lib/types";

type Cred = { driverId: string; pin: string };

export function DriversClient() {
  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [resetting, setResetting] = useState<Driver | null>(null);
  const [removing, setRemoving] = useState<Driver | null>(null);
  const [toast, setToast] = useState<{ title: string; msg: string } | null>(null);

  const say = (title: string, msg: string) => {
    setToast({ title, msg });
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    fetch("/api/drivers").then((r) => r.json()).then((d) => setDrivers(d.drivers ?? []));
    fetch("/api/vehicles").then((r) => r.json()).then((d) => setVehicles(d.vehicles ?? []));
  }, []);

  return (
    <div className="content">
      <div className="filters">
        <button className="fpill on">All {drivers?.length ?? 0}</button>
        <button className="btn btn-p push" onClick={() => setOpen(true)}>
          <I name="plus" />Add driver
        </button>
      </div>

      {!drivers ? (
        <div className="crumb">Loading drivers…</div>
      ) : drivers.length === 0 ? (
        <div className="crumb">No drivers yet — add one to give them a phone login.</div>
      ) : (
        <div className="dgrid">
          {drivers.map((d) => (
            <div key={d.name} className="dcard">
              <div className="dhead">
                <Av g={d.av} size="lg">{d.initials}</Av>
                <div className="who">
                  <b>{d.name}</b>
                  <div className="rate"><Stars on={d.starsOn} />{d.rating.toFixed(1)}</div>
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
                <button className="btn btn-s" onClick={() => setEditing(d)}><I name="wrench" />Edit</button>
                <button className="btn btn-s" onClick={() => setResetting(d)}><I name="shield" />PIN</button>
                <button className="btn btn-s danger" onClick={() => setRemoving(d)}><I name="trash" />Remove</button>
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
            say("Driver added", `${d.name} joined the team`);
          }}
        />
      )}

      {editing && (
        <EditDriverModal
          driver={editing}
          vehicles={vehicles}
          onClose={() => setEditing(null)}
          onSaved={(d) => {
            setDrivers((prev) => prev?.map((x) => (x.name === d.name ? d : x)) ?? null);
            setEditing(null);
            say("Driver updated", `${d.name} saved`);
          }}
        />
      )}

      {resetting && (
        <ResetPinModal
          driver={resetting}
          onClose={() => setResetting(null)}
          onDone={(name) => {
            setResetting(null);
            say("Credentials updated", `New sign-in details for ${name}`);
          }}
        />
      )}

      {removing && (
        <ConfirmDelete
          title="Remove driver"
          body={
            <>
              <b>{removing.name}</b> will be removed and their phone login revoked
              immediately. Their past trips stay in your records.
            </>
          }
          confirmLabel="Remove driver"
          url={`/api/drivers/${encodeURIComponent(removing.name)}`}
          onClose={() => setRemoving(null)}
          onDeleted={() => {
            const name = removing.name;
            setDrivers((prev) => prev?.filter((x) => x.name !== name) ?? null);
            setRemoving(null);
            say("Driver removed", `${name} no longer has access`);
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

/** Shown once after create or reset — the PIN is never readable again. */
function CredentialCard({ name, cred }: { name: string; cred: Cred }) {
  return (
    <div className="cred-card">
      <b style={{ fontSize: 13 }}>{name} · FleetOne Driver app</b>
      <div className="row2">
        <div className="cell"><span>DRIVER ID</span><b>{cred.driverId}</b></div>
        <div className="cell"><span>PIN</span><b>{cred.pin}</b></div>
      </div>
      <p>They sign in at <b>/driver</b> — trips, live location and fill-ups run from their phone.</p>
    </div>
  );
}

function AddDriverModal({
  vehicles, onClose, onAdded,
}: { vehicles: Vehicle[]; onClose: () => void; onAdded: (d: Driver) => void }) {
  const { errors, busy, submit } = useZodSubmit(DriverSchema, "/api/drivers");
  const [form, setForm] = useState({
    name: "", phone: "", license: "", licenseExpiry: "", vehicle: "", driverId: "", pin: "",
  });
  const [cred, setCred] = useState<Cred | null>(null);
  const [added, setAdded] = useState<Driver | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (cred && added) {
    return (
      <Modal title="Driver added ✓" sub="Hand these sign-in details over — shown only once" onClose={() => onAdded(added)}>
        <CredentialCard name={added.name} cred={cred} />
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
              {vehicles.map((v) => <option key={v.plate} value={v.plate}>{v.plate}</option>)}
            </select>
          </Field>
          <Field label="License number" error={errors.license}>
            <input value={form.license} onChange={set("license")} placeholder="KA05 20190001234" />
          </Field>
          <Field label="License expiry" error={errors.licenseExpiry}>
            <input type="date" value={form.licenseExpiry} onChange={set("licenseExpiry")} />
          </Field>

          <div className="field wide" style={{ marginTop: 2 }}>
            <label style={{ color: "var(--soft)" }}>Phone sign-in — leave blank to generate</label>
          </div>
          <Field label="Driver ID" error={errors.driverId}>
            <input value={form.driverId} onChange={set("driverId")} placeholder="SK01" />
          </Field>
          <Field label="4-digit PIN" error={errors.pin}>
            <input value={form.pin} onChange={set("pin")} placeholder="4321" inputMode="numeric" maxLength={4} />
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

function EditDriverModal({
  driver, vehicles, onClose, onSaved,
}: { driver: Driver; vehicles: Vehicle[]; onClose: () => void; onSaved: (d: Driver) => void }) {
  const [form, setForm] = useState({ vehicle: driver.vehicle, licenseExpiry: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const payload: Record<string, string> = { vehicle: form.vehicle };
      if (form.licenseExpiry) payload.licenseExpiry = form.licenseExpiry;
      const res = await fetch(`/api/drivers/${encodeURIComponent(driver.name)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(body.errors ?? { form: body.error ?? "Could not save" });
        return;
      }
      onSaved(body.driver as Driver);
    } catch {
      setErrors({ form: "Network error — try again" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Edit ${driver.name}`} sub="Reassign their vehicle or renew their licence" onClose={onClose}>
      <form onSubmit={save}>
        <div className="fgrid">
          <Field label="Assigned vehicle" error={errors.vehicle} wide>
            <select value={form.vehicle} onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value }))}>
              {vehicles.map((v) => <option key={v.plate} value={v.plate}>{v.plate}</option>)}
            </select>
          </Field>
          <Field label="New license expiry" error={errors.licenseExpiry} wide>
            <input
              type="date"
              value={form.licenseExpiry}
              onChange={(e) => setForm((f) => ({ ...f, licenseExpiry: e.target.value }))}
            />
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

function ResetPinModal({
  driver, onClose, onDone,
}: { driver: Driver; onClose: () => void; onDone: (name: string) => void }) {
  const { errors, busy, submit, setErrors } = useZodSubmit(
    DriverCredentialSchema,
    `/api/drivers/${encodeURIComponent(driver.name)}/credentials`,
  );
  const [form, setForm] = useState({ driverId: "", pin: "" });
  const [cred, setCred] = useState<Cred | null>(null);

  if (cred) {
    return (
      <Modal title="New sign-in details ✓" sub="Shown only once — hand them over now" onClose={() => onDone(driver.name)}>
        <CredentialCard name={driver.name} cred={cred} />
        <div className="factions">
          <button type="button" className="btn btn-p" onClick={() => onDone(driver.name)}>Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Reset sign-in · ${driver.name}`}
      sub="Leave blank to keep the ID and generate a fresh PIN"
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErrors({});
          // PUT, not POST — this replaces the credential rather than creating one.
          try {
            const res = await fetch(`/api/drivers/${encodeURIComponent(driver.name)}/credentials`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(form),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
              setErrors(body.errors ?? { form: body.error ?? "Could not reset" });
              return;
            }
            setCred(body.cred as Cred);
          } catch {
            setErrors({ form: "Network error — try again" });
          }
        }}
      >
        <div className="fgrid">
          <Field label="Driver ID" error={errors.driverId}>
            <input
              value={form.driverId}
              onChange={(e) => setForm((f) => ({ ...f, driverId: e.target.value }))}
              placeholder="keep current"
            />
          </Field>
          <Field label="New PIN" error={errors.pin}>
            <input
              value={form.pin}
              onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
              placeholder="auto-generate"
              inputMode="numeric"
              maxLength={4}
            />
          </Field>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 4 }}>
          Changing the ID signs the driver out of any active session.
        </p>
        {errors.form && <div className="form-err">{errors.form}</div>}
        <div className="factions">
          <button type="button" className="btn btn-s" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-p" disabled={busy}>Reset sign-in</button>
        </div>
      </form>
    </Modal>
  );
}
