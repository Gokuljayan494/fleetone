# FleetOne

Multi-tenant fleet management. Each transport company signs up, gets its own
isolated fleet, and hands its drivers a generated ID + PIN to sign in with.

## Running

```bash
npm install
cp .env.example .env.local   # then paste your MongoDB connection string
npm run dev                  # http://localhost:3000
```

On first boot the app creates its indexes and seeds a demo company, so an empty
database just works. Demo login — `arjun@fleetone.in` / `fleetone123`.
Or create your own company at `/signup`.

## Storage

MongoDB, via the official driver (no ODM — the zod schemas in `lib/schemas.ts`
are the single source of validation, shared by the API routes and the client forms).

- `lib/db.ts` — connection, collections, indexes
- `lib/store.ts` — all data access, every function scoped by `companyId`

The Mongo client is cached on `globalThis`: on serverless each invocation would
otherwise open a new connection and exhaust the cluster's limit.

**Sessions live in Mongo** with a TTL index on `exp`, so Mongo expires them
itself and a signed-in user stays signed in across restarts and across instances.

Unique indexes — not application checks — are what actually enforce the
invariants, so concurrent requests cannot slip a duplicate through:

| Index | Guarantees |
| --- | --- |
| `users.email` | one account per email, globally |
| `driverCreds.driverId` | driver IDs unique across all companies |
| `companies.deviceKey` | a device key maps to exactly one company |
| `vehicles {companyId, plate}` | a plate is unique *within* a company |
| `invoices {companyId, number}` | no duplicate invoice numbers |
| `sessions.exp` (TTL) | expired sessions self-delete |

`companyId` and internal ordering keys are projected out of every read, so API
responses carry only domain fields.

## Tenancy model

Every record lives inside exactly one company. A session is pinned to a
`companyId` at login, and `guard()` resolves the caller's company on every
request — a handler can never reach another company's data.

| Role | Sees | Can change |
| --- | --- | --- |
| `owner` | everything in their company | everything, incl. team + device key |
| `manager` | everything in their company | everything except team management |
| `driver` | only their own trips, fuel, expenses, vehicle, documents | only records for the vehicle they are signed in to |

Driver IDs are unique across all companies, so the driver login form needs no
company code. A driver's writes are rewritten server-side to their own name and
plate — passing someone else's plate silently files it against their own.

## Deploying

The app is one Next.js deployment — pages and `/api` routes ship together.
The only separate piece is the database.

**Vercel:** import the repo, then add `MONGODB_URI` and `MONGODB_DB` under
Settings → Environment Variables. Nothing else to configure.

**Atlas Network Access:** Vercel's outbound IPs are dynamic, so add `0.0.0.0/0`
to the cluster's IP access list. The database user's password is the real
credential; keep it out of the repo (`.env.local` is gitignored).

If your environment cannot do DNS SRV lookups, use the direct
`mongodb://host1,host2,host3/?replicaSet=...` form instead of `mongodb+srv://`.
Both are in `.env.example`.

## API

All routes are under `/api`, JSON in and out, cookie-authenticated.
Validation failures return `{ errors: { field: message } }` with `400`;
missing auth returns `401`, wrong role `403`.

### Auth
| Method | Route | Notes |
| --- | --- | --- |
| POST | `/auth/signup` | Register a company + first owner. Returns the company's `deviceKey`. |
| POST | `/auth/login` | `{role:"owner",email,password}` or `{role:"driver",driverId,pin}` |
| POST | `/auth/logout` | |
| GET | `/auth/me` | Current session + company |

### Fleet
| Method | Route | Notes |
| --- | --- | --- |
| GET POST | `/vehicles` | |
| GET PATCH DELETE | `/vehicles/:plate` | GET returns position, track, stops, fuel, maintenance, expenses, trips. Plate is URL-encoded. |
| GET POST | `/drivers` | POST returns the `driverId` + `pin` to hand the driver — shown once. |
| GET PATCH DELETE | `/drivers/:name` | |

### Operations
| Method | Route | Notes |
| --- | --- | --- |
| GET POST | `/trips` | Filters `?plate=` `?driver=`. Revenue derives from `ratePerKm`. |
| GET POST | `/fuel` | Filter `?plate=`. Mileage derives from the previous odometer reading. |
| GET POST | `/positions` | GPS pings. Accepts a session **or** an `x-device-key` header for hardware trackers. |
| GET POST | `/maintenance` | Filters `?plate=` `?status=` `?due=<days>` |
| GET PATCH DELETE | `/maintenance/:id` | Marking `done` bumps the vehicle's health and service date. |
| GET POST | `/expenses` | Filters `?plate=` `?category=` `?from=` `?to=` |
| GET DELETE | `/expenses/:id` | |

### Business
| Method | Route | Notes |
| --- | --- | --- |
| GET POST | `/customers` | Staff only. Includes what each customer still owes. |
| GET PATCH DELETE | `/customers/:id` | Delete refused while invoices exist. |
| GET POST | `/documents` | RCs, insurance, permits, licences. Filters `?scope=` `?subject=` `?kind=` `?expiring=<days>`. Every response carries `daysLeft`. |
| GET DELETE | `/documents/:id` | |
| GET POST | `/invoices` | Filters `?status=` `?customerId=`. Past-due `sent` invoices report as `overdue`. |
| GET PATCH DELETE | `/invoices/:id` | PATCH moves draft → sent → paid. Delete only while draft. |

### Workspace
| Method | Route | Notes |
| --- | --- | --- |
| GET PATCH | `/notifications` | PATCH `{ids?}` marks read; omit `ids` for all. |
| GET | `/reports` | Totals, receivables, spend by category, per-vehicle and per-driver P&L. |
| GET POST | `/team` | POST is owner-only. |
| DELETE | `/team/:id` | Owner-only. A company must keep one owner. |
| GET PATCH | `/settings` | Company profile, currency, `ratePerKm`, document alert window. |

### Hardware ingestion

GPS boxes post without a browser session using the company's device key
(returned at signup, and visible to owners at `GET /api/settings`):

```bash
curl -X POST http://localhost:3000/api/positions \
  -H 'content-type: application/json' \
  -H 'x-device-key: FLEET-XXXXXXXX' \
  -d '{"plate":"MH 12 AB 1234","lat":19.076,"lng":72.877,"speed":42,"source":"device"}'
```
