import type { Status } from "@/data/fleet";

/**
 * Domain types for the tenant-scoped records. The vehicle/driver/trip shapes
 * mirror the demo seed in `data/fleet.ts` because the UI renders them directly;
 * everything below them is new and shaped for the API first.
 */

export type Vehicle = {
  model: string;
  plate: string;
  status: string;
  tone: Status;
  driver: string;
  av: string;
  health: number;
  lastService: string;
  km: string;
  kmpl: number;
  stroke: string;
  tint: string;
  kind: string;
};

export type Driver = {
  name: string;
  initials: string;
  av: string;
  rating: number;
  starsOn: number;
  score: number;
  vehicle: string;
  license: { label: string; tone: Status };
  trips: number;
  attendance: number;
  onTime: number;
};

export type Trip = {
  plate: string;
  vkind: string;
  vtone: string;
  driver: string;
  av: string;
  ini: string;
  customer: string;
  km: string;
  dur: string;
  rev: string;
  status: string;
  tone: Status;
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  createdAt: number;
  plan: "trial" | "pro";
  /** Shared secret for GPS hardware / Traccar ingestion (no browser session). */
  deviceKey: string;
  settings: {
    currency: string;
    timezone: string;
    ratePerKm: number;
    /** Alert when a document expires within this many days. */
    documentAlertDays: number;
  };
};

export type UserRole = "owner" | "manager";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  createdAt: number;
};

export type Customer = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  createdAt: number;
};

export type MaintenanceStatus = "scheduled" | "in_progress" | "done";

export type MaintenanceRecord = {
  id: string;
  plate: string;
  type: string;
  dueDate: string;
  odometer: number | null;
  costInr: number | null;
  vendor: string;
  notes: string;
  status: MaintenanceStatus;
  createdAt: number;
  completedAt: number | null;
};

export type ExpenseCategory = "toll" | "parking" | "fine" | "repair" | "insurance" | "permit" | "salary" | "other";

export type Expense = {
  id: string;
  plate: string;
  category: ExpenseCategory;
  amountInr: number;
  date: string;
  driver: string;
  note: string;
  createdAt: number;
};

export type DocumentKind = "rc" | "insurance" | "permit" | "fitness" | "puc" | "license" | "other";

export type FleetDocument = {
  id: string;
  /** Plate for vehicle docs, driver name for licences. */
  subject: string;
  scope: "vehicle" | "driver";
  kind: DocumentKind;
  number: string;
  issuedOn: string | null;
  expiresOn: string;
  fileUrl: string;
  createdAt: number;
};

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export type InvoiceLine = { description: string; qty: number; rateInr: number };

export type Invoice = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  issuedOn: string;
  dueOn: string;
  lines: InvoiceLine[];
  subtotalInr: number;
  taxPct: number;
  totalInr: number;
  status: InvoiceStatus;
  createdAt: number;
  paidAt: number | null;
};

export type Notification = {
  id: string;
  icon: string;
  tone: Status;
  title: string;
  body: string;
  createdAt: number;
  unread: boolean;
};
