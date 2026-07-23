import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { companies, ready, sessions } from "./db";
import type { Company } from "./types";

export const AUTH_COOKIE = "f1_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * One place that describes the session cookie, so login, signup and logout
 * cannot drift apart. `secure` is on in production (HTTPS on Vercel) but off in
 * local dev, where the server is plain http and a secure cookie would never be
 * sent back — which looks exactly like "logged out on refresh".
 */
export function sessionCookie(token: string) {
  return {
    name: AUTH_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60,
  };
}

export function clearedCookie() {
  return { ...sessionCookie(""), maxAge: 0 };
}

/** Every session is pinned to one company — that is what keeps fleets apart. */
export type Session =
  | { role: "owner" | "manager"; companyId: string; userId: string; name: string; email: string; exp: number }
  | { role: "driver"; companyId: string; name: string; driverId: string; plate: string; exp: number };

export type Role = Session["role"];

/** Roles that can change company-wide data. */
export const STAFF: Role[] = ["owner", "manager"];
/** Anyone signed in to the company. */
export const ANYONE: Role[] = ["owner", "manager", "driver"];

export function hashPassword(pw: string): string {
  return createHash("sha256").update(`fleetone:${pw}`).digest("hex");
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export async function createSession(data: DistributiveOmit<Session, "exp">): Promise<string> {
  await ready();
  const token = randomBytes(24).toString("base64url");
  const exp = Date.now() + SESSION_TTL_MS;
  const col = await sessions();
  // `exp` is a Date so the TTL index can expire the row automatically.
  await col.insertOne({ token, session: { ...data, exp } as Session, exp: new Date(exp) });
  return token;
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  const col = await sessions();
  await col.deleteOne({ token });
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const col = await sessions();
  const row = await col.findOne({ token });
  if (!row) return null;

  // The TTL index sweeps roughly once a minute, so check the clock too.
  if (row.session.exp < Date.now()) {
    await col.deleteOne({ token });
    return null;
  }
  return row.session;
}

/** For route handlers: returns the session if it matches one of the roles, else null. */
export async function requireRole(...roles: Role[]): Promise<Session | null> {
  const s = await getSession();
  return s && roles.includes(s.role) ? s : null;
}

export async function getCompany(companyId: string): Promise<Company | null> {
  const col = await companies();
  return col.findOne({ id: companyId }, { projection: { _id: 0 } });
}

/**
 * The gate every tenant-scoped route goes through: resolves the caller's session
 * AND their company in one step, so a handler always has a companyId to filter by.
 */
export async function requireTenant(
  roles: Role[] = ANYONE,
): Promise<{ session: Session; company: Company; companyId: string } | null> {
  const session = await requireRole(...roles);
  if (!session) return null;
  const company = await getCompany(session.companyId);
  return company ? { session, company, companyId: session.companyId } : null;
}

/** Hardware trackers post with a per-company device key instead of a cookie. */
export async function companyFromDeviceKey(key: string | null): Promise<Company | null> {
  if (!key) return null;
  const col = await companies();
  return col.findOne({ deviceKey: key }, { projection: { _id: 0 } });
}

/** Removing an account must not leave its sessions usable. */
export async function destroySessionsForUser(userId: string) {
  const col = await sessions();
  await col.deleteMany({ "session.userId": userId });
}
