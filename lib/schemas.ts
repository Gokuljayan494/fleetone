import { z } from "zod";

export const plateRegex = /^[A-Z]{2}\s?\d{2}\s?[A-Z]{1,2}\s?\d{4}$/;

export const VehicleSchema = z.object({
  model: z.string().trim().min(2, "Model name is too short").max(40, "Model name is too long"),
  plate: z
    .string()
    .trim()
    .toUpperCase()
    .regex(plateRegex, "Use the format KA 05 MJ 2211"),
  driver: z.string().trim().min(2, "Driver name is too short").max(40, "Driver name is too long"),
  kind: z.enum(["van", "truck"]),
  kmpl: z.coerce.number().positive("Must be above 0").max(40, "That mileage is not realistic"),
  km: z.coerce.number().int("Whole numbers only").nonnegative("Cannot be negative").max(2_000_000, "Odometer too high"),
});
export type VehicleInput = z.infer<typeof VehicleSchema>;

export const DriverSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(40, "Name is too long"),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"),
  license: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}\d{2}\s?\d{11}$/, "Use the format KA05 20190001234"),
  licenseExpiry: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .refine((d) => new Date(d) > new Date(), "License is already expired"),
  vehicle: z.string().trim().min(1, "Assign a vehicle"),
});
export type DriverInput = z.infer<typeof DriverSchema>;

export const FuelLogSchema = z.object({
  plate: z.string().trim().min(1, "Pick a vehicle"),
  litres: z.coerce.number().positive("Litres must be above 0").max(500, "Above any tank size"),
  amountInr: z.coerce.number().positive("Amount must be above 0").max(60_000, "Amount looks too high"),
  odometer: z.coerce.number().int("Whole numbers only").positive("Odometer must be above 0").max(2_000_000, "Odometer too high"),
  station: z.string().trim().max(60, "Keep it under 60 characters").optional().or(z.literal("")),
  lat: z.number().gte(-90).lte(90).optional(),
  lng: z.number().gte(-180).lte(180).optional(),
});
export type FuelLogInput = z.infer<typeof FuelLogSchema>;

export const PositionSchema = z.object({
  plate: z.string().trim().min(4),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  speed: z.number().nonnegative().max(200),
  source: z.enum(["phone", "sim", "device"]).default("phone"),
});
export type PositionInput = z.infer<typeof PositionSchema>;

export const TripEndSchema = z.object({
  plate: z.string().trim().min(4),
  driver: z.string().trim().min(2),
  km: z.number().min(0.1, "Trip too short to record").max(5000),
  minutes: z.number().nonnegative().max(60 * 48),
  customer: z.string().trim().max(60).optional(),
});
export type TripEndInput = z.infer<typeof TripEndSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const MaintenanceSchema = z.object({
  plate: z.string().trim().min(4, "Pick a vehicle"),
  type: z.string().trim().min(2, "Describe the job").max(60, "Keep it under 60 characters"),
  dueDate: isoDate,
  odometer: z.coerce.number().int().nonnegative().max(2_000_000).optional(),
  costInr: z.coerce.number().nonnegative().max(1_000_000, "Cost looks too high").optional(),
  vendor: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(300).optional(),
  status: z.enum(["scheduled", "in_progress", "done"]).optional(),
});
export type MaintenanceInput = z.infer<typeof MaintenanceSchema>;
export const MaintenancePatchSchema = MaintenanceSchema.partial().omit({ plate: true });

export const ExpenseSchema = z.object({
  plate: z.string().trim().min(4, "Pick a vehicle"),
  category: z.enum(["toll", "parking", "fine", "repair", "insurance", "permit", "salary", "other"]),
  amountInr: z.coerce.number().positive("Amount must be above 0").max(1_000_000, "Amount looks too high"),
  date: isoDate,
  driver: z.string().trim().max(40).optional(),
  note: z.string().trim().max(200).optional(),
});
export type ExpenseInput = z.infer<typeof ExpenseSchema>;

export const CustomerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60, "Name is too long"),
  contact: z.string().trim().max(40).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional().or(z.literal("")),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, "Enter a valid 15-character GSTIN")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(200).optional(),
});
export type CustomerInput = z.infer<typeof CustomerSchema>;
export const CustomerPatchSchema = CustomerSchema.partial();

export const DocumentSchema = z
  .object({
    subject: z.string().trim().min(2, "Pick a vehicle or driver"),
    scope: z.enum(["vehicle", "driver"]),
    kind: z.enum(["rc", "insurance", "permit", "fitness", "puc", "license", "other"]),
    number: z.string().trim().max(40).optional(),
    issuedOn: isoDate.optional(),
    expiresOn: isoDate,
    fileUrl: z.string().trim().url("Enter a valid URL").max(300).optional().or(z.literal("")),
  })
  .refine((d) => !d.issuedOn || d.issuedOn <= d.expiresOn, {
    message: "Expiry must be after the issue date",
    path: ["expiresOn"],
  });
export type DocumentInput = z.infer<typeof DocumentSchema>;

export const InvoiceLineSchema = z.object({
  description: z.string().trim().min(2, "Describe the line item").max(80),
  qty: z.coerce.number().positive("Quantity must be above 0").max(10_000),
  rateInr: z.coerce.number().nonnegative("Rate cannot be negative").max(1_000_000),
});

export const InvoiceSchema = z
  .object({
    customerId: z.string().trim().min(1, "Pick a customer"),
    issuedOn: isoDate,
    dueOn: isoDate,
    lines: z.array(InvoiceLineSchema).min(1, "Add at least one line item").max(50),
    taxPct: z.coerce.number().nonnegative().max(50).optional(),
    status: z.enum(["draft", "sent", "paid", "overdue"]).optional(),
  })
  .refine((i) => i.dueOn >= i.issuedOn, { message: "Due date must be on or after the issue date", path: ["dueOn"] });
export type InvoiceInput = z.infer<typeof InvoiceSchema>;

export const InvoiceStatusSchema = z.object({
  status: z.enum(["draft", "sent", "paid", "overdue"]),
});

export const SignupSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is too short").max(60, "Company name is too long"),
  name: z.string().trim().min(2, "Name is too short").max(40, "Name is too long"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters").max(72, "Password is too long"),
});
export type SignupInput = z.infer<typeof SignupSchema>;

export const TeamMemberSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(40, "Name is too long"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters").max(72, "Password is too long"),
  role: z.enum(["owner", "manager"]).default("manager"),
});
export type TeamMemberInput = z.infer<typeof TeamMemberSchema>;

export const SettingsSchema = z.object({
  name: z.string().trim().min(2, "Company name is too short").max(60).optional(),
  currency: z.string().trim().length(3, "Use a 3-letter code like INR").toUpperCase().optional(),
  timezone: z.string().trim().min(3).max(40).optional(),
  ratePerKm: z.coerce.number().positive("Must be above 0").max(1000, "Rate looks too high").optional(),
  documentAlertDays: z.coerce.number().int().min(1).max(180).optional(),
});
export type SettingsInput = z.infer<typeof SettingsSchema>;

export const VehiclePatchSchema = VehicleSchema.partial()
  .omit({ plate: true })
  .extend({ status: z.string().trim().min(2).max(40).optional() });

export const DriverPatchSchema = DriverSchema.partial().omit({ name: true });

export const NotificationsReadSchema = z.object({
  ids: z.array(z.string()).optional(),
});

export const OwnerLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
});
export type OwnerLoginInput = z.infer<typeof OwnerLoginSchema>;

export const DriverLoginSchema = z.object({
  driverId: z.string().trim().toUpperCase().regex(/^[A-Z]{1,3}\d{2}$/, "Like SK01 — from your owner"),
  pin: z.string().trim().regex(/^\d{4}$/, "4-digit PIN"),
});
export type DriverLoginInput = z.infer<typeof DriverLoginSchema>;

/** Client-side bodies for /api/auth/login — must carry the role discriminator. */
export const OwnerLoginBody = OwnerLoginSchema.extend({ role: z.literal("owner") });
export const DriverLoginBody = DriverLoginSchema.extend({ role: z.literal("driver") });

/** Flatten zod issues to { field: message } for form display. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
