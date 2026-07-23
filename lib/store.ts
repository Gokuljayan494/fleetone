import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  vehicles as seedVehicles,
  drivers as seedDrivers,
  trips as seedTrips,
  notifications as seedNotifications,
  type Status,
} from "@/data/fleet";
import * as C from "./db";
import type {
  Company,
  Customer,
  Driver,
  Expense,
  FleetDocument,
  Invoice,
  MaintenanceRecord,
  Notification,
  Trip,
  User,
  Vehicle,
} from "./types";
import type {
  CustomerInput,
  DocumentInput,
  DriverInput,
  ExpenseInput,
  FuelLogInput,
  InvoiceInput,
  MaintenanceInput,
  PositionInput,
  SignupInput,
  TripEndInput,
  VehicleInput,
} from "./schemas";

/**
 * Tenant-scoped data access over MongoDB. Every function takes a `companyId`
 * and every query filters on it — that is what keeps two fleets apart.
 * Unique indexes in `db.ts` back the duplicate checks here, so concurrent
 * requests cannot slip a duplicate past an application-level `findOne`.
 */

export type LivePosition = PositionInput & { ts: number };
export type TrackPoint = { lat: number; lng: number; ts: number; speed: number };
export type Stop = { lat: number; lng: number; fromTs: number; toTs: number };

export type FuelLog = FuelLogInput & { id: string; ts: number; kmpl: number | null };

export type DriverCred = { driverId: string; pin: string; name: string; plate: string };

const AV_CYCLE = ["g1", "g2", "g3", "g4", "g5", "g6"];
const TINTS: Record<string, { stroke: string; tint: string }> = {
  van: { stroke: "#4F46E5", tint: "linear-gradient(135deg,#EEF0FE,#E4ECFB)" },
  truck: { stroke: "#0369A1", tint: "linear-gradient(135deg,#E6F5FD,#E3EEFA)" },
};

/**
 * Projections. `companyId` and the internal sort keys are storage details, so
 * they are stripped on the way out — API responses carry only domain fields.
 */
const NO_ID = { projection: { _id: 0, companyId: 0 } } as const;
/** Vehicles and drivers additionally carry an `addedAt` used only for ordering. */
const NO_ID_ORDERED = { projection: { _id: 0, companyId: 0, addedAt: 0 } } as const;
/** For the two lookups that resolve which company a credential belongs to. */
const WITH_TENANT = { projection: { _id: 0 } } as const;

export const sha = (s: string) => createHash("sha256").update(`fleetone:${s}`).digest("hex");
const uid = () => randomBytes(9).toString("base64url");

/** Duplicate-key violations from a unique index surface as code 11000. */
const isDuplicate = (e: unknown) => (e as { code?: number })?.code === 11000;

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "fleet";
}

function defaultSettings(): Company["settings"] {
  return { currency: "INR", timezone: "Asia/Kolkata", ratePerKm: 58, documentAlertDays: 30 };
}

/**
 * Initials for the avatar and, more importantly, for the driver's login ID.
 * Letters only: the ID is `initials + two digits` and the login form accepts
 * `^[A-Z]{1,3}\d{2}$`, so a digit here would mint an ID nobody can sign in with.
 */
export function initialsOf(name: string): string {
  const fromWords = name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (fromWords) return fromWords.slice(0, 2);
  // Names with no leading letters at all (e.g. "3M Logistics") still need an ID.
  return name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) || "DR";
}

/* ---------------------------------------------------------------- companies */

export async function getCompany(companyId: string): Promise<Company | null> {
  return (await C.companies()).findOne({ id: companyId }, NO_ID);
}

/** Returns null if the email is already taken (enforced by a unique index). */
export async function createCompany(input: SignupInput): Promise<{ company: Company; user: User } | null> {
  const id = uid();
  const company: Company = {
    id,
    name: input.companyName,
    slug: `${slugify(input.companyName)}-${id.slice(0, 4).toLowerCase()}`,
    createdAt: Date.now(),
    plan: "trial",
    deviceKey: `FLEET-${randomBytes(12).toString("base64url").toUpperCase()}`,
    settings: defaultSettings(),
  };
  const user: User = {
    id: uid(),
    name: input.name,
    email: input.email,
    role: "owner",
    passwordHash: sha(input.password),
    createdAt: Date.now(),
  };

  try {
    // Insert the user first: its unique email index is what rejects a duplicate
    // signup, and failing here leaves no orphaned company behind.
    await (await C.users()).insertOne({ ...user, companyId: id });
  } catch (e) {
    if (isDuplicate(e)) return null;
    throw e;
  }
  await (await C.companies()).insertOne({ ...company });

  await notify(id, {
    icon: "check",
    tone: "emr",
    title: `Welcome to FleetOne, ${input.companyName}`,
    body: "Add your first vehicle and driver to get started.",
  });
  return { company, user };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return (await C.users()).findOne({ email }, WITH_TENANT);
}

export async function addTeamMember(
  companyId: string,
  input: { name: string; email: string; password: string; role: "owner" | "manager" },
): Promise<User | null> {
  const user: User = {
    id: uid(),
    name: input.name,
    email: input.email,
    role: input.role,
    passwordHash: sha(input.password),
    createdAt: Date.now(),
  };
  try {
    await (await C.users()).insertOne({ ...user, companyId });
  } catch (e) {
    if (isDuplicate(e)) return null;
    throw e;
  }
  return user;
}

export async function listTeam(companyId: string): Promise<User[]> {
  return (await C.users()).find({ companyId }, NO_ID).sort({ createdAt: 1 }).toArray();
}

export async function findTeamMember(companyId: string, userId: string): Promise<User | null> {
  return (await C.users()).findOne({ companyId, id: userId }, NO_ID);
}

export async function countOwners(companyId: string): Promise<number> {
  return (await C.users()).countDocuments({ companyId, role: "owner" });
}

export async function removeTeamMember(companyId: string, userId: string): Promise<boolean> {
  const res = await (await C.users()).deleteOne({ companyId, id: userId });
  return res.deletedCount > 0;
}

export async function updateSettings(
  companyId: string,
  patch: { name?: string; currency?: string; timezone?: string; ratePerKm?: number; documentAlertDays?: number },
): Promise<Company | null> {
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.currency !== undefined) set["settings.currency"] = patch.currency;
  if (patch.timezone !== undefined) set["settings.timezone"] = patch.timezone;
  if (patch.ratePerKm !== undefined) set["settings.ratePerKm"] = patch.ratePerKm;
  if (patch.documentAlertDays !== undefined) set["settings.documentAlertDays"] = patch.documentAlertDays;
  if (!Object.keys(set).length) return getCompany(companyId);

  return (await C.companies()).findOneAndUpdate(
    { id: companyId },
    { $set: set },
    { returnDocument: "after", projection: { _id: 0, companyId: 0 } },
  );
}

/* ----------------------------------------------------------- driver logins */

export async function findDriverCred(driverId: string): Promise<(DriverCred & { companyId: string }) | null> {
  return (await C.driverCreds()).findOne({ driverId }, WITH_TENANT);
}

export async function findCredForDriver(companyId: string, name: string): Promise<DriverCred | null> {
  return (await C.driverCreds()).findOne({ companyId, name }, NO_ID);
}

/* ----------------------------------------------------------------- vehicles */

export async function listVehicles(companyId: string): Promise<Vehicle[]> {
  return (await C.vehicles()).find({ companyId }, NO_ID_ORDERED).sort({ addedAt: -1 }).toArray();
}

export async function findVehicle(companyId: string, plate: string): Promise<Vehicle | null> {
  return (await C.vehicles()).findOne({ companyId, plate }, NO_ID_ORDERED);
}

export async function countVehicles(companyId: string): Promise<number> {
  return (await C.vehicles()).countDocuments({ companyId });
}

/** Returns null when the plate is already in this company's fleet. */
export async function addVehicle(companyId: string, input: VehicleInput): Promise<Vehicle | null> {
  const art = TINTS[input.kind];
  const n = await countVehicles(companyId);
  const v: Vehicle = {
    model: input.model,
    plate: input.plate,
    status: "Parked",
    tone: "slate" as Status,
    driver: input.driver,
    av: AV_CYCLE[n % AV_CYCLE.length],
    health: 100,
    lastService: "New",
    km: input.km.toLocaleString("en-IN"),
    kmpl: input.kmpl,
    stroke: art.stroke,
    tint: art.tint,
    kind: input.kind,
  };
  try {
    await (await C.vehicles()).insertOne({ ...v, companyId, addedAt: Date.now() } as never);
  } catch (e) {
    if (isDuplicate(e)) return null;
    throw e;
  }
  return v;
}

export async function updateVehicle(
  companyId: string,
  plate: string,
  patch: Partial<VehicleInput> & { status?: string },
): Promise<Vehicle | null> {
  const set: Record<string, unknown> = {};
  if (patch.model !== undefined) set.model = patch.model;
  if (patch.driver !== undefined) set.driver = patch.driver;
  if (patch.kmpl !== undefined) set.kmpl = patch.kmpl;
  if (patch.km !== undefined) set.km = patch.km.toLocaleString("en-IN");
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.kind !== undefined && TINTS[patch.kind]) {
    set.kind = patch.kind;
    set.stroke = TINTS[patch.kind].stroke;
    set.tint = TINTS[patch.kind].tint;
  }
  if (!Object.keys(set).length) return findVehicle(companyId, plate);

  return (await C.vehicles()).findOneAndUpdate(
    { companyId, plate },
    { $set: set },
    { returnDocument: "after", projection: { _id: 0, companyId: 0, addedAt: 0 } },
  );
}

export async function removeVehicle(companyId: string, plate: string): Promise<boolean> {
  const res = await (await C.vehicles()).deleteOne({ companyId, plate });
  if (!res.deletedCount) return false;
  await (await C.positions()).deleteMany({ companyId, plate });
  await (await C.tracks()).deleteMany({ companyId, plate });
  return true;
}

/* ------------------------------------------------------------------ drivers */

export async function listDrivers(companyId: string): Promise<Driver[]> {
  return (await C.drivers()).find({ companyId }, NO_ID_ORDERED).sort({ addedAt: -1 }).toArray();
}

export async function findDriver(companyId: string, name: string): Promise<Driver | null> {
  // Names are matched case-insensitively, as the in-memory version did.
  return (await C.drivers()).findOne(
    { companyId, name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
    NO_ID_ORDERED,
  );
}

export async function countDrivers(companyId: string): Promise<number> {
  return (await C.drivers()).countDocuments({ companyId });
}

/** Distinguishes "name taken" from "driver ID taken" for the caller. */
export type AddDriverResult =
  | { ok: true; driver: Driver; cred: DriverCred }
  | { ok: false; reason: "name" | "driverId" };

export async function addDriver(companyId: string, input: DriverInput): Promise<AddDriverResult> {
  const initials = initialsOf(input.name);
  const n = await countDrivers(companyId);
  const d: Driver = {
    name: input.name,
    initials,
    av: AV_CYCLE[n % AV_CYCLE.length],
    rating: 5,
    starsOn: 5,
    score: 80,
    vehicle: input.vehicle,
    license: { label: `License valid to ${input.licenseExpiry}`, tone: "emr" as Status },
    trips: 0,
    attendance: 100,
    onTime: 100,
  };
  try {
    await (await C.drivers()).insertOne({ ...d, companyId, addedAt: Date.now() } as never);
  } catch (e) {
    if (isDuplicate(e)) return { ok: false, reason: "name" };
    throw e;
  }

  const creds = await C.driverCreds();
  const pin = input.pin || String(randomInt(1000, 9999));
  const rollback = async () => {
    // Never leave behind a driver who has no way to log in.
    await (await C.drivers()).deleteOne({ companyId, name: input.name });
  };

  // An owner-chosen ID is used as-is; a clash is their error to fix, not
  // something to silently work around.
  if (input.driverId) {
    const cred: DriverCred = { driverId: input.driverId, pin, name: input.name, plate: input.vehicle };
    try {
      await creds.insertOne({ ...cred, companyId });
      return { ok: true, driver: d, cred };
    } catch (e) {
      if (isDuplicate(e)) {
        await rollback();
        return { ok: false, reason: "driverId" };
      }
      throw e;
    }
  }

  // Otherwise mint one. Driver IDs are unique across every company so the login
  // form needs no company code; the unique index decides the winner if two race.
  for (let attempt = 0; attempt < 20; attempt++) {
    const cred: DriverCred = {
      driverId: initials + String(randomInt(10, 99)),
      pin,
      name: input.name,
      plate: input.vehicle,
    };
    try {
      await creds.insertOne({ ...cred, companyId });
      return { ok: true, driver: d, cred };
    } catch (e) {
      if (!isDuplicate(e)) throw e;
    }
  }
  await rollback();
  throw new Error("Could not allocate a driver ID — set one manually");
}

/**
 * Reset a driver's PIN and/or reissue their ID. Returns the full credential so
 * the owner can hand it over; null if there is no such driver.
 */
export async function setDriverCredentials(
  companyId: string,
  name: string,
  patch: { driverId?: string; pin?: string },
): Promise<DriverCred | "taken" | null> {
  const driver = await findDriver(companyId, name);
  if (!driver) return null;

  const creds = await C.driverCreds();
  const existing = await creds.findOne({ companyId, name: driver.name });
  if (!existing) return null;

  const next: DriverCred = {
    driverId: patch.driverId || existing.driverId,
    pin: patch.pin || String(randomInt(1000, 9999)),
    name: driver.name,
    plate: driver.vehicle,
  };

  try {
    await creds.replaceOne({ companyId, driverId: existing.driverId }, { ...next, companyId });
  } catch (e) {
    if (isDuplicate(e)) return "taken";
    throw e;
  }

  // Changing an ID must invalidate sessions issued under the old one.
  if (next.driverId !== existing.driverId) {
    await (await C.sessions()).deleteMany({ "session.driverId": existing.driverId });
  }
  return next;
}

export async function updateDriver(
  companyId: string,
  name: string,
  patch: Partial<DriverInput>,
): Promise<Driver | null> {
  const existing = await findDriver(companyId, name);
  if (!existing) return null;

  const set: Record<string, unknown> = {};
  if (patch.vehicle !== undefined) {
    set.vehicle = patch.vehicle;
    await (await C.driverCreds()).updateMany(
      { companyId, name: existing.name },
      { $set: { plate: patch.vehicle } },
    );
  }
  if (patch.licenseExpiry !== undefined) {
    const expired = new Date(patch.licenseExpiry) <= new Date();
    set.license = {
      label: expired ? `License expired ${patch.licenseExpiry}` : `License valid to ${patch.licenseExpiry}`,
      tone: expired ? ("red" as Status) : ("emr" as Status),
    };
  }
  if (!Object.keys(set).length) return existing;

  return (await C.drivers()).findOneAndUpdate(
    { companyId, name: existing.name },
    { $set: set },
    { returnDocument: "after", projection: { _id: 0, companyId: 0, addedAt: 0 } },
  );
}

export async function removeDriver(companyId: string, name: string): Promise<boolean> {
  const existing = await findDriver(companyId, name);
  if (!existing) return false;
  await (await C.drivers()).deleteOne({ companyId, name: existing.name });
  await (await C.driverCreds()).deleteMany({ companyId, name: existing.name });
  return true;
}

/* --------------------------------------------------------------------- fuel */

export async function listFuelLogs(companyId: string, plate?: string): Promise<FuelLog[]> {
  const q = plate ? { companyId, plate } : { companyId };
  return (await C.fuelLogs()).find(q, NO_ID).sort({ ts: -1 }).toArray();
}

export async function lastFuelLog(companyId: string, plate: string): Promise<FuelLog | null> {
  return (await C.fuelLogs()).findOne({ companyId, plate }, { ...NO_ID, sort: { odometer: -1 } });
}

export async function addFuelLog(companyId: string, input: FuelLogInput): Promise<FuelLog> {
  const prev = await lastFuelLog(companyId, input.plate);
  const kmpl =
    prev && input.odometer > prev.odometer
      ? Math.round(((input.odometer - prev.odometer) / input.litres) * 10) / 10
      : null;
  const log: FuelLog = { ...input, id: uid(), ts: Date.now(), kmpl };
  await (await C.fuelLogs()).insertOne({ ...log, companyId });
  return log;
}

/* ---------------------------------------------------------------- positions */

export async function upsertPosition(companyId: string, input: PositionInput) {
  const ts = Date.now();
  await (await C.positions()).updateOne(
    { companyId, plate: input.plate },
    { $set: { ...input, companyId, ts } },
    { upsert: true },
  );
  // Keep the breadcrumb trail bounded: append, then trim to the last 600 points.
  await (await C.tracks()).updateOne(
    { companyId, plate: input.plate },
    {
      $push: {
        points: {
          $each: [{ lat: input.lat, lng: input.lng, ts, speed: input.speed }],
          $slice: -600,
        },
      },
    },
    { upsert: true },
  );
}

export async function getTrack(companyId: string, plate: string): Promise<TrackPoint[]> {
  const doc = await (await C.tracks()).findOne({ companyId, plate }, NO_ID);
  return doc?.points ?? [];
}

/** Runs of consecutive slow pings (< 3 km/h) collapse into one stop marker. */
export function detectStops(track: TrackPoint[]): Stop[] {
  const stops: Stop[] = [];
  let run: TrackPoint[] = [];
  const flush = () => {
    if (run.length >= 2) {
      stops.push({
        lat: run.reduce((s, p) => s + p.lat, 0) / run.length,
        lng: run.reduce((s, p) => s + p.lng, 0) / run.length,
        fromTs: run[0].ts,
        toTs: run[run.length - 1].ts,
      });
    }
    run = [];
  };
  for (const p of track) {
    if (p.speed < 3) run.push(p);
    else flush();
  }
  flush();
  return stops;
}

export async function livePositions(companyId: string, plate?: string): Promise<LivePosition[]> {
  const cutoff = Date.now() - 5 * 60_000;
  const q: Record<string, unknown> = { companyId, ts: { $gt: cutoff } };
  if (plate) q.plate = plate;
  return (await C.positions()).find(q, NO_ID).toArray();
}

/** How stale a fix is, so the map can distinguish "moving now" from "parked here yesterday". */
export type FixStatus = "moving" | "idle" | "stale" | "offline";

export function fixStatus(ageMs: number, speed: number): FixStatus {
  if (ageMs > 24 * 3600_000) return "offline";
  if (ageMs > 15 * 60_000) return "stale";
  return speed > 3 ? "moving" : "idle";
}

/**
 * Every vehicle's most recent fix regardless of age, plus the vehicles that have
 * never reported. The map needs this: filtering to the last 5 minutes leaves it
 * blank whenever nothing happens to be driving right now.
 */
export async function lastKnownPositions(companyId: string, plate?: string) {
  const q: Record<string, unknown> = { companyId };
  if (plate) q.plate = plate;

  const [fixes, vehicles] = await Promise.all([
    (await C.positions()).find(q, NO_ID).toArray(),
    listVehicles(companyId),
  ]);

  const now = Date.now();
  const positions = fixes.map((p) => {
    const ageMs = now - p.ts;
    return { ...p, ageMs, status: fixStatus(ageMs, p.speed) };
  });

  const reporting = new Set(positions.map((p) => p.plate));
  const missing = vehicles
    .filter((v) => !reporting.has(v.plate) && (!plate || v.plate === plate))
    .map((v) => ({ plate: v.plate, model: v.model, driver: v.driver }));

  return { positions, missing };
}

/* -------------------------------------------------------------------- trips */

export async function listTrips(
  companyId: string,
  filter: { plate?: string; driver?: string } = {},
): Promise<Trip[]> {
  const q: Record<string, unknown> = { companyId };
  if (filter.plate) q.plate = filter.plate;
  if (filter.driver) q.driver = { $regex: `^${filter.driver.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };
  return (await C.trips()).find(q, { projection: { _id: 0, companyId: 0, createdAt: 0 } })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
}

/** Trips closed since a timestamp — powers the dashboard's "Today" panel. */
export async function listTripsSince(companyId: string, since: number): Promise<Trip[]> {
  return (await C.trips())
    .find({ companyId, createdAt: { $gte: since } }, { projection: { _id: 0, companyId: 0, createdAt: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function endTrip(companyId: string, input: TripEndInput): Promise<Trip> {
  const h = Math.floor(input.minutes / 60);
  const m = Math.round(input.minutes % 60);
  const vehicle = await findVehicle(companyId, input.plate);
  const trip: Trip = {
    plate: input.plate,
    vkind: vehicle?.kind ?? "van",
    vtone: "ind",
    driver: input.driver,
    av: "g1",
    ini: initialsOf(input.driver),
    customer: input.customer ?? "Ad-hoc trip",
    km: `${Math.round(input.km)} km`,
    dur: h ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`,
    // A trip records distance and time only. Money is raised against the
    // customer in Billing — a fixed per-km guess here is not real revenue.
    rev: "—",
    status: "Completed",
    tone: "emr" as Status,
  };
  await (await C.trips()).insertOne({ ...trip, companyId, createdAt: Date.now() });
  await (await C.drivers()).updateOne({ companyId, name: input.driver }, { $inc: { trips: 1 } });
  return trip;
}

/* -------------------------------------------------------------- maintenance */

export async function listMaintenance(
  companyId: string,
  filter: { plate?: string; status?: string } = {},
): Promise<MaintenanceRecord[]> {
  const q: Record<string, unknown> = { companyId };
  if (filter.plate) q.plate = filter.plate;
  if (filter.status) q.status = filter.status;
  return (await C.maintenance()).find(q, NO_ID).sort({ createdAt: -1 }).toArray();
}

export async function findMaintenance(companyId: string, id: string): Promise<MaintenanceRecord | null> {
  return (await C.maintenance()).findOne({ companyId, id }, NO_ID);
}

export async function addMaintenance(companyId: string, input: MaintenanceInput): Promise<MaintenanceRecord> {
  const rec: MaintenanceRecord = {
    id: uid(),
    plate: input.plate,
    type: input.type,
    dueDate: input.dueDate,
    odometer: input.odometer ?? null,
    costInr: input.costInr ?? null,
    vendor: input.vendor ?? "",
    notes: input.notes ?? "",
    status: input.status ?? "scheduled",
    createdAt: Date.now(),
    completedAt: null,
  };
  await (await C.maintenance()).insertOne({ ...rec, companyId });
  await notify(companyId, {
    icon: "wrench",
    tone: "sky",
    title: `Service scheduled · ${rec.plate}`,
    body: `${rec.type} due ${rec.dueDate}.`,
  });
  return rec;
}

export async function updateMaintenance(
  companyId: string,
  id: string,
  patch: Partial<MaintenanceInput>,
): Promise<MaintenanceRecord | null> {
  const existing = await findMaintenance(companyId, id);
  if (!existing) return null;

  const set: Record<string, unknown> = {};
  for (const k of ["type", "dueDate", "odometer", "costInr", "vendor", "notes", "status"] as const) {
    if (patch[k] !== undefined) set[k] = patch[k];
  }
  if (patch.status === "done" && !existing.completedAt) {
    set.completedAt = Date.now();
    // Finishing a service refreshes the vehicle's health and service date.
    await (await C.vehicles()).updateOne({ companyId, plate: existing.plate }, [
      {
        $set: {
          lastService: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          health: { $min: [100, { $add: ["$health", 8] }] },
        },
      },
    ]);
  }
  if (!Object.keys(set).length) return existing;

  return (await C.maintenance()).findOneAndUpdate(
    { companyId, id },
    { $set: set },
    { returnDocument: "after", projection: { _id: 0, companyId: 0 } },
  );
}

export async function removeMaintenance(companyId: string, id: string): Promise<boolean> {
  const res = await (await C.maintenance()).deleteOne({ companyId, id });
  return res.deletedCount > 0;
}

/* ----------------------------------------------------------------- expenses */

export async function listExpenses(
  companyId: string,
  filter: { plate?: string; category?: string; from?: string; to?: string; driver?: string } = {},
): Promise<Expense[]> {
  const q: Record<string, unknown> = { companyId };
  if (filter.plate) q.plate = filter.plate;
  if (filter.category) q.category = filter.category;
  if (filter.driver) q.driver = filter.driver;
  if (filter.from || filter.to) {
    const range: Record<string, string> = {};
    if (filter.from) range.$gte = filter.from;
    if (filter.to) range.$lte = filter.to;
    q.date = range;
  }
  return (await C.expenses()).find(q, NO_ID).sort({ date: -1, createdAt: -1 }).toArray();
}

export async function findExpense(companyId: string, id: string): Promise<Expense | null> {
  return (await C.expenses()).findOne({ companyId, id }, NO_ID);
}

export async function addExpense(companyId: string, input: ExpenseInput): Promise<Expense> {
  const e: Expense = {
    id: uid(),
    plate: input.plate,
    category: input.category,
    amountInr: input.amountInr,
    date: input.date,
    driver: input.driver ?? "",
    note: input.note ?? "",
    createdAt: Date.now(),
  };
  await (await C.expenses()).insertOne({ ...e, companyId });
  return e;
}

export async function removeExpense(companyId: string, id: string): Promise<boolean> {
  const res = await (await C.expenses()).deleteOne({ companyId, id });
  return res.deletedCount > 0;
}

/* ---------------------------------------------------------------- customers */

export async function listCustomers(companyId: string, search?: string): Promise<Customer[]> {
  const q: Record<string, unknown> = { companyId };
  if (search) q.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  return (await C.customers()).find(q, NO_ID).sort({ createdAt: -1 }).toArray();
}

export async function findCustomer(companyId: string, id: string): Promise<Customer | null> {
  return (await C.customers()).findOne({ companyId, id }, NO_ID);
}

export async function addCustomer(companyId: string, input: CustomerInput): Promise<Customer | null> {
  const c: Customer = {
    id: uid(),
    name: input.name,
    contact: input.contact ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    gstin: input.gstin ?? "",
    address: input.address ?? "",
    createdAt: Date.now(),
  };
  try {
    await (await C.customers()).insertOne({ ...c, companyId });
  } catch (e) {
    if (isDuplicate(e)) return null;
    throw e;
  }
  return c;
}

export async function updateCustomer(
  companyId: string,
  id: string,
  patch: Partial<CustomerInput>,
): Promise<Customer | null> {
  const set: Record<string, unknown> = {};
  for (const k of ["name", "contact", "phone", "email", "gstin", "address"] as const) {
    if (patch[k] !== undefined) set[k] = patch[k];
  }
  if (!Object.keys(set).length) return findCustomer(companyId, id);

  return (await C.customers()).findOneAndUpdate(
    { companyId, id },
    { $set: set },
    { returnDocument: "after", projection: { _id: 0, companyId: 0 } },
  );
}

export async function removeCustomer(companyId: string, id: string): Promise<boolean> {
  const res = await (await C.customers()).deleteOne({ companyId, id });
  return res.deletedCount > 0;
}

/* ---------------------------------------------------------------- documents */

export async function listDocuments(
  companyId: string,
  filter: { scope?: string; subject?: string; kind?: string } = {},
): Promise<FleetDocument[]> {
  const q: Record<string, unknown> = { companyId };
  if (filter.scope) q.scope = filter.scope;
  if (filter.kind) q.kind = filter.kind;
  if (filter.subject) {
    q.subject = { $regex: `^${filter.subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };
  }
  return (await C.documents()).find(q, NO_ID).sort({ expiresOn: 1 }).toArray();
}

export async function findDocument(companyId: string, id: string): Promise<FleetDocument | null> {
  return (await C.documents()).findOne({ companyId, id }, NO_ID);
}

export async function addDocument(companyId: string, input: DocumentInput): Promise<FleetDocument> {
  const doc: FleetDocument = {
    id: uid(),
    subject: input.subject,
    scope: input.scope,
    kind: input.kind,
    number: input.number ?? "",
    issuedOn: input.issuedOn ?? null,
    expiresOn: input.expiresOn,
    fileUrl: input.fileUrl ?? "",
    createdAt: Date.now(),
  };
  await (await C.documents()).insertOne({ ...doc, companyId });
  return doc;
}

export async function removeDocument(companyId: string, id: string): Promise<boolean> {
  const res = await (await C.documents()).deleteOne({ companyId, id });
  return res.deletedCount > 0;
}

/** Days until expiry — negative once expired. */
export function daysUntil(date: string): number {
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86_400_000);
}

export async function expiringDocuments(companyId: string, withinDays: number) {
  const docs = await listDocuments(companyId);
  return docs
    .map((d) => ({ ...d, daysLeft: daysUntil(d.expiresOn) }))
    .filter((d) => d.daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/* ----------------------------------------------------------------- invoices */

/** Past-due `sent` invoices report as overdue without being rewritten in place. */
const asOverdue = (inv: Invoice): Invoice =>
  inv.status === "sent" && daysUntil(inv.dueOn) < 0 ? { ...inv, status: "overdue" } : inv;

export async function listInvoices(
  companyId: string,
  filter: { status?: string; customerId?: string } = {},
): Promise<Invoice[]> {
  const q: Record<string, unknown> = { companyId };
  if (filter.customerId) q.customerId = filter.customerId;
  const all = (await (await C.invoices()).find(q, NO_ID).sort({ createdAt: -1 }).toArray()).map(asOverdue);
  // Filter after the overdue rollup so ?status=overdue works.
  return filter.status ? all.filter((i) => i.status === filter.status) : all;
}

export async function findInvoice(companyId: string, id: string): Promise<Invoice | null> {
  const inv = await (await C.invoices()).findOne({ companyId, id }, NO_ID);
  return inv ? asOverdue(inv) : null;
}

export async function addInvoice(companyId: string, input: InvoiceInput): Promise<Invoice | null> {
  const customer = await findCustomer(companyId, input.customerId);
  if (!customer) return null;

  const subtotal = input.lines.reduce((s, l) => s + l.qty * l.rateInr, 0);
  const taxPct = input.taxPct ?? 18;

  // Invoice numbers are per-company and must not collide; the unique index on
  // {companyId, number} is the backstop if two are raised at the same moment.
  const count = await (await C.invoices()).countDocuments({ companyId });
  for (let seq = count + 1; seq < count + 50; seq++) {
    const inv: Invoice = {
      id: uid(),
      number: `INV-${String(seq).padStart(4, "0")}`,
      customerId: customer.id,
      customerName: customer.name,
      issuedOn: input.issuedOn,
      dueOn: input.dueOn,
      lines: input.lines,
      subtotalInr: Math.round(subtotal),
      taxPct,
      totalInr: Math.round(subtotal * (1 + taxPct / 100)),
      status: input.status ?? "draft",
      createdAt: Date.now(),
      paidAt: null,
    };
    try {
      await (await C.invoices()).insertOne({ ...inv, companyId });
      return inv;
    } catch (e) {
      if (!isDuplicate(e)) throw e;
    }
  }
  throw new Error("Could not allocate an invoice number");
}

export async function updateInvoiceStatus(
  companyId: string,
  id: string,
  status: Invoice["status"],
): Promise<Invoice | null> {
  const existing = await (await C.invoices()).findOne({ companyId, id }, NO_ID);
  if (!existing) return null;

  const set: Record<string, unknown> = { status };
  if (status === "paid" && !existing.paidAt) set.paidAt = Date.now();

  const updated = await (await C.invoices()).findOneAndUpdate(
    { companyId, id },
    { $set: set },
    { returnDocument: "after", projection: { _id: 0, companyId: 0 } },
  );
  if (updated && status === "paid" && !existing.paidAt) {
    await notify(companyId, {
      icon: "check",
      tone: "emr",
      title: `Payment received · ${updated.number}`,
      body: `₹${updated.totalInr.toLocaleString("en-IN")} from ${updated.customerName}.`,
    });
  }
  return updated;
}

export async function removeInvoice(companyId: string, id: string): Promise<boolean> {
  const res = await (await C.invoices()).deleteOne({ companyId, id });
  return res.deletedCount > 0;
}

export async function countInvoicesForCustomer(companyId: string, customerId: string): Promise<number> {
  return (await C.invoices()).countDocuments({ companyId, customerId });
}

/* ------------------------------------------------------------ notifications */

export async function notify(
  companyId: string,
  n: Pick<Notification, "icon" | "tone" | "title" | "body">,
): Promise<Notification> {
  const item: Notification = { id: uid(), ...n, createdAt: Date.now(), unread: true };
  await (await C.notifications()).insertOne({ ...item, companyId });
  return item;
}

export async function listNotifications(companyId: string, unreadOnly = false): Promise<Notification[]> {
  const q: Record<string, unknown> = { companyId };
  if (unreadOnly) q.unread = true;
  return (await C.notifications()).find(q, NO_ID).sort({ createdAt: -1 }).limit(100).toArray();
}

export async function countUnread(companyId: string): Promise<number> {
  return (await C.notifications()).countDocuments({ companyId, unread: true });
}

export async function markNotificationsRead(companyId: string, ids?: string[]): Promise<number> {
  const q: Record<string, unknown> = { companyId, unread: true };
  if (ids) q.id = { $in: ids };
  const res = await (await C.notifications()).updateMany(q, { $set: { unread: false } });
  return res.modifiedCount;
}

/* ------------------------------------------------------------------ reports */

const parseInr = (s: string) => Number(s.replace(/[^\d.]/g, "")) || 0;
const parseKm = (s: string) => Number(s.replace(/[^\d.]/g, "")) || 0;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

/**
 * Revenue and spend bucketed by month for the trend chart. Built from real
 * timestamps, so a new company sees a flat line rather than someone else's
 * numbers. Returns the last `count` months including the current one.
 */
async function monthlySeries(companyId: string, count = 6) {
  const [invoices, fuel, expenses, maint] = await Promise.all([
    // Revenue is what was billed — trips no longer carry a money amount.
    listInvoices(companyId),
    listFuelLogs(companyId),
    listExpenses(companyId),
    listMaintenance(companyId),
  ]);

  const buckets = new Map<string, { month: string; revenueInr: number; expensesInr: number }>();
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(monthKey(d), { month: MONTHS[d.getMonth()], revenueInr: 0, expensesInr: 0 });
  }

  const addTo = (when: Date, field: "revenueInr" | "expensesInr", amount: number) => {
    const b = buckets.get(monthKey(when));
    if (b) b[field] += amount;
  };

  for (const inv of invoices) {
    if (inv.status !== "draft") addTo(new Date(`${inv.issuedOn}T00:00:00`), "revenueInr", inv.totalInr);
  }
  for (const f of fuel) addTo(new Date(f.ts), "expensesInr", f.amountInr);
  for (const e of expenses) addTo(new Date(`${e.date}T00:00:00`), "expensesInr", e.amountInr);
  for (const m of maint) addTo(new Date(m.createdAt), "expensesInr", m.costInr ?? 0);

  return [...buckets.values()].map((b) => ({
    month: b.month,
    revenueInr: Math.round(b.revenueInr),
    expensesInr: Math.round(b.expensesInr),
  }));
}

export async function buildReport(companyId: string, alertDays: number) {
  const [vehicles, drivers, trips, fuel, expenses, maint, invoices] = await Promise.all([
    listVehicles(companyId),
    listDrivers(companyId),
    listTrips(companyId),
    listFuelLogs(companyId),
    listExpenses(companyId),
    listMaintenance(companyId),
    listInvoices(companyId),
  ]);

  // Revenue is billed money — the sum of every issued (non-draft) invoice.
  const revenue = invoices.filter((i) => i.status !== "draft").reduce((s, i) => s + i.totalInr, 0);
  const km = trips.reduce((s, t) => s + parseKm(t.km), 0);
  const fuelSpend = fuel.reduce((s, f) => s + f.amountInr, 0);
  const otherSpend = expenses.reduce((s, e) => s + e.amountInr, 0);
  const maintenanceSpend = maint.reduce((s, m) => s + (m.costInr ?? 0), 0);
  const totalExpenses = fuelSpend + otherSpend + maintenanceSpend;

  const litres = fuel.reduce((s, f) => s + f.litres, 0);
  const rated = fuel.filter((f) => f.kmpl !== null);
  const fleetAvgKmpl = rated.length
    ? Math.round((rated.reduce((s, f) => s + (f.kmpl ?? 0), 0) / rated.length) * 10) / 10
    : null;

  // Per-vehicle cost is attributable; revenue is not (invoices bill a customer,
  // not a plate), so we report running cost per vehicle rather than a fake profit.
  const perVehicle = vehicles.map((v) => {
    const vTrips = trips.filter((t) => t.plate === v.plate);
    const vExpenses =
      fuel.filter((f) => f.plate === v.plate).reduce((s, f) => s + f.amountInr, 0) +
      expenses.filter((e) => e.plate === v.plate).reduce((s, e) => s + e.amountInr, 0) +
      maint.filter((m) => m.plate === v.plate).reduce((s, m) => s + (m.costInr ?? 0), 0);
    return {
      plate: v.plate,
      model: v.model,
      trips: vTrips.length,
      km: vTrips.reduce((s, t) => s + parseKm(t.km), 0),
      expensesInr: vExpenses,
      kmpl: v.kmpl,
      health: v.health,
    };
  });

  const perDriver = drivers.map((d) => {
    const dTrips = trips.filter((t) => t.driver === d.name);
    return {
      name: d.name,
      vehicle: d.vehicle,
      trips: dTrips.length,
      km: dTrips.reduce((s, t) => s + parseKm(t.km), 0),
      rating: d.rating,
      score: d.score,
      onTime: d.onTime,
      attendance: d.attendance,
    };
  });

  const byCategory: Record<string, number> = { fuel: fuelSpend, maintenance: maintenanceSpend };
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amountInr;

  const [docs, monthly] = await Promise.all([
    expiringDocuments(companyId, alertDays),
    monthlySeries(companyId),
  ]);
  return {
    monthly,
    /** Next few service jobs, for the maintenance pipeline panel. */
    pipeline: [...maint]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 4)
      .map((m) => ({
        id: m.id,
        plate: m.plate,
        type: m.type,
        dueDate: m.dueDate,
        costInr: m.costInr,
        vendor: m.vendor,
        status: m.status,
        daysLeft: daysUntil(m.dueDate),
      })),
    totals: {
      vehicles: vehicles.length,
      drivers: drivers.length,
      trips: trips.length,
      km: Math.round(km),
      revenueInr: Math.round(revenue),
      expensesInr: Math.round(totalExpenses),
      profitInr: Math.round(revenue - totalExpenses),
      litres: Math.round(litres * 10) / 10,
      fleetAvgKmpl,
    },
    receivables: {
      outstandingInr: invoices
        .filter((i) => i.status === "sent" || i.status === "overdue")
        .reduce((s, i) => s + i.totalInr, 0),
      overdueInr: invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.totalInr, 0),
      paidInr: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.totalInr, 0),
    },
    expensesByCategory: byCategory,
    perVehicle,
    perDriver,
    alerts: {
      expiringDocuments: docs.length,
      serviceDue: maint.filter((m) => m.status !== "done" && daysUntil(m.dueDate) <= 7).length,
    },
  };
}

/* --------------------------------------------------------------------- seed */

const gs = globalThis as unknown as { __fleetBoot?: Promise<void> };

/**
 * Ensures indexes exist and the demo company is present. Memoized per process,
 * so it costs one round trip on cold start and nothing afterwards. Every entry
 * point (guard, login, signup) awaits this before touching data.
 */
export function bootstrap(): Promise<void> {
  if (!gs.__fleetBoot) {
    gs.__fleetBoot = C.ready()
      .then(() => seedDemo())
      .then(() => seedDemoPositions())
      .catch((err) => {
        // Let the next request retry rather than caching a failure forever.
        gs.__fleetBoot = undefined;
        throw err;
      });
  }
  return gs.__fleetBoot;
}

/**
 * Positions for the demo fleet, so the map shows something on the demo login.
 * Runs only for the `demo` company and only while it has none — a real company
 * never gets invented locations. Every fix is tagged `source: "sim"`, which the
 * map surfaces in the popup so nobody mistakes it for a real tracker.
 */
export async function seedDemoPositions(): Promise<void> {
  const positions = await C.positions();
  if (await positions.countDocuments({ companyId: "demo" })) return;

  const demoVehicles = await listVehicles("demo");
  if (demoVehicles.length === 0) return;

  // Points along the Bengaluru–Chennai and Bengaluru–Hosur corridors.
  const ROUTES: { lat: number; lng: number; speed: number; ageMin: number }[] = [
    { lat: 12.9698, lng: 77.7500, speed: 46, ageMin: 1 },   // Whitefield
    { lat: 12.7409, lng: 77.8253, speed: 58, ageMin: 2 },   // Hosur
    { lat: 12.9165, lng: 79.1325, speed: 0, ageMin: 4 },    // Vellore, stopped
    { lat: 13.0827, lng: 80.2707, speed: 32, ageMin: 3 },   // Chennai
    { lat: 12.2958, lng: 76.6394, speed: 0, ageMin: 45 },   // Mysuru, stale
    { lat: 13.3409, lng: 74.7421, speed: 0, ageMin: 2600 }, // Udupi, offline
  ];

  const now = Date.now();
  const tracksCol = await C.tracks();

  for (const [i, v] of demoVehicles.entries()) {
    const r = ROUTES[i % ROUTES.length];
    const ts = now - r.ageMin * 60_000;

    await positions.updateOne(
      { companyId: "demo", plate: v.plate },
      { $set: { companyId: "demo", plate: v.plate, lat: r.lat, lng: r.lng, speed: r.speed, source: "sim", ts } },
      { upsert: true },
    );

    // A short trail behind each vehicle so the route line has something to draw.
    const points = Array.from({ length: 8 }, (_, k) => ({
      lat: r.lat - (7 - k) * 0.012,
      lng: r.lng - (7 - k) * 0.017,
      ts: ts - (7 - k) * 60_000,
      speed: r.speed,
    }));
    await tracksCol.updateOne(
      { companyId: "demo", plate: v.plate },
      { $set: { companyId: "demo", plate: v.plate, points } },
      { upsert: true },
    );
  }
}

/**
 * Creates the demo company on first run so the published demo credentials work
 * against an empty database. Idempotent — a second call is a no-op.
 */
export async function seedDemo(): Promise<void> {
  const existing = await getCompany("demo");
  if (existing) return;

  const demo: Company = {
    id: "demo",
    name: "FleetOne Demo Logistics",
    slug: "fleetone-demo",
    createdAt: Date.now(),
    plan: "pro",
    deviceKey: "FLEET-DEV-KEY",
    settings: defaultSettings(),
  };

  try {
    await (await C.users()).insertOne({
      id: uid(),
      companyId: "demo",
      name: "Arjun",
      email: "arjun@fleetone.in",
      role: "owner",
      passwordHash: sha("fleetone123"),
      createdAt: Date.now(),
    });
  } catch (e) {
    if (!isDuplicate(e)) throw e;
    return; // Another process seeded it first.
  }
  await (await C.companies()).insertOne({ ...demo });

  const now = Date.now();
  await (await C.vehicles()).insertMany(
    seedVehicles.map((v, i) => ({ ...v, companyId: "demo", addedAt: now - i })) as never,
  );
  await (await C.drivers()).insertMany(
    seedDrivers.map((d, i) => ({ ...d, companyId: "demo", addedAt: now - i })) as never,
  );
  await (await C.trips()).insertMany(
    seedTrips.map((t, i) => ({ ...t, companyId: "demo", createdAt: now - i * 1000 })),
  );
  await (await C.notifications()).insertMany(
    seedNotifications.map((n, i) => ({
      id: uid(),
      companyId: "demo",
      icon: n.icon,
      tone: n.tone,
      title: n.title,
      body: n.body,
      createdAt: now - i * 3_600_000,
      unread: n.unread,
    })),
  );
  await (await C.driverCreds()).insertMany(
    seedDrivers.map((d, i) => ({
      companyId: "demo",
      driverId: d.initials + String(i + 1).padStart(2, "0"),
      pin: "4321",
      name: d.name,
      plate: d.vehicle,
    })),
  );
}
