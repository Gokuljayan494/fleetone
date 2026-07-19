import { MongoClient, type Collection, type Db } from "mongodb";
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
import type { Session } from "./auth";
import type { DriverCred, FuelLog, LivePosition, TrackPoint } from "./store";

/**
 * MongoDB access. Every document outside `companies` carries a `companyId`, and
 * every query filters on it — that is what keeps two fleets apart. The unique
 * indexes below enforce the invariants the in-memory Maps used to hold.
 */

const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB ?? "fleetone";

/** Documents as stored: the domain type plus the tenant key. */
export type Doc<T> = T & { companyId: string };

export type PositionDoc = Doc<LivePosition>;
export type TrackDoc = Doc<{ plate: string; points: TrackPoint[] }>;
export type CredDoc = Doc<DriverCred>;
export type SessionDoc = { token: string; session: Session; exp: Date };

/**
 * Serverless runs many short-lived invocations against one Atlas cluster, so the
 * client (and its pool) is cached on globalThis. Without this, each request opens
 * a new connection and the cluster hits its connection limit under light load.
 */
const g = globalThis as unknown as { __mongo?: Promise<MongoClient> };

function client(): Promise<MongoClient> {
  if (!URI) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local and add your connection string.",
    );
  }
  if (!g.__mongo) {
    g.__mongo = new MongoClient(URI, {
      // Keep the pool small: many serverless instances × a big pool exhausts Atlas.
      maxPoolSize: 10,
      retryWrites: true,
    }).connect();
  }
  return g.__mongo;
}

export async function db(): Promise<Db> {
  return (await client()).db(DB_NAME);
}

/* -------------------------------------------------------------- collections */

export const companies = async (): Promise<Collection<Company>> => (await db()).collection("companies");
export const users = async (): Promise<Collection<Doc<User>>> => (await db()).collection("users");
export const vehicles = async (): Promise<Collection<Doc<Vehicle>>> => (await db()).collection("vehicles");
export const drivers = async (): Promise<Collection<Doc<Driver>>> => (await db()).collection("drivers");
export const driverCreds = async (): Promise<Collection<CredDoc>> => (await db()).collection("driverCreds");
export const trips = async (): Promise<Collection<Doc<Trip & { createdAt: number }>>> =>
  (await db()).collection("trips");
export const fuelLogs = async (): Promise<Collection<Doc<FuelLog>>> => (await db()).collection("fuelLogs");
export const maintenance = async (): Promise<Collection<Doc<MaintenanceRecord>>> =>
  (await db()).collection("maintenance");
export const expenses = async (): Promise<Collection<Doc<Expense>>> => (await db()).collection("expenses");
export const customers = async (): Promise<Collection<Doc<Customer>>> => (await db()).collection("customers");
export const documents = async (): Promise<Collection<Doc<FleetDocument>>> => (await db()).collection("documents");
export const invoices = async (): Promise<Collection<Doc<Invoice>>> => (await db()).collection("invoices");
export const notifications = async (): Promise<Collection<Doc<Notification>>> =>
  (await db()).collection("notifications");
export const positions = async (): Promise<Collection<PositionDoc>> => (await db()).collection("positions");
export const tracks = async (): Promise<Collection<TrackDoc>> => (await db()).collection("tracks");
export const sessions = async (): Promise<Collection<SessionDoc>> => (await db()).collection("sessions");

/* ------------------------------------------------------------------ indexes */

const gi = globalThis as unknown as { __mongoIndexes?: Promise<void> };

/**
 * Created once per process. The unique indexes are the real guarantee — the
 * application-level duplicate checks race under concurrent signups, these do not.
 */
async function createIndexes(): Promise<void> {
  const [c, u, v, d, dc, t, f, m, e, cu, doc, i, n, p, tr, s] = await Promise.all([
    companies(), users(), vehicles(), drivers(), driverCreds(), trips(), fuelLogs(),
    maintenance(), expenses(), customers(), documents(), invoices(), notifications(),
    positions(), tracks(), sessions(),
  ]);

  await Promise.all([
    c.createIndex({ id: 1 }, { unique: true }),
    c.createIndex({ deviceKey: 1 }, { unique: true }),

    // One account per email, across every company.
    u.createIndex({ email: 1 }, { unique: true }),
    u.createIndex({ companyId: 1 }),
    u.createIndex({ companyId: 1, id: 1 }, { unique: true }),

    // A plate is unique within a company, not globally.
    v.createIndex({ companyId: 1, plate: 1 }, { unique: true }),

    d.createIndex({ companyId: 1 }),
    d.createIndex({ companyId: 1, name: 1 }, { unique: true }),

    // Driver IDs are globally unique so the login form needs no company code.
    dc.createIndex({ driverId: 1 }, { unique: true }),
    dc.createIndex({ companyId: 1 }),

    t.createIndex({ companyId: 1, createdAt: -1 }),
    t.createIndex({ companyId: 1, plate: 1 }),
    t.createIndex({ companyId: 1, driver: 1 }),

    f.createIndex({ companyId: 1, ts: -1 }),
    f.createIndex({ companyId: 1, plate: 1, odometer: -1 }),

    m.createIndex({ companyId: 1, id: 1 }, { unique: true }),
    m.createIndex({ companyId: 1, plate: 1 }),
    m.createIndex({ companyId: 1, status: 1, dueDate: 1 }),

    e.createIndex({ companyId: 1, id: 1 }, { unique: true }),
    e.createIndex({ companyId: 1, date: -1 }),
    e.createIndex({ companyId: 1, plate: 1 }),

    cu.createIndex({ companyId: 1, id: 1 }, { unique: true }),
    cu.createIndex({ companyId: 1, name: 1 }, { unique: true }),

    doc.createIndex({ companyId: 1, id: 1 }, { unique: true }),
    doc.createIndex({ companyId: 1, expiresOn: 1 }),

    i.createIndex({ companyId: 1, id: 1 }, { unique: true }),
    i.createIndex({ companyId: 1, number: 1 }, { unique: true }),
    i.createIndex({ companyId: 1, customerId: 1 }),
    i.createIndex({ companyId: 1, status: 1 }),

    n.createIndex({ companyId: 1, createdAt: -1 }),

    p.createIndex({ companyId: 1, plate: 1 }, { unique: true }),
    p.createIndex({ ts: -1 }),

    tr.createIndex({ companyId: 1, plate: 1 }, { unique: true }),

    // Mongo deletes expired sessions for us — no sweeper job needed.
    s.createIndex({ token: 1 }, { unique: true }),
    s.createIndex({ exp: 1 }, { expireAfterSeconds: 0 }),
  ]);
}

/** Idempotent; safe to await on every request. */
export function ready(): Promise<void> {
  if (!gi.__mongoIndexes) {
    gi.__mongoIndexes = createIndexes().catch((err) => {
      // Let the next request retry rather than caching a failure forever.
      gi.__mongoIndexes = undefined;
      throw err;
    });
  }
  return gi.__mongoIndexes;
}
