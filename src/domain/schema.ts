import { z } from "zod";
export const houseSchema = z.object({
  nickname: z.string().trim().min(1),
  client_name: z.string().trim().min(1),
  phone: z.string().default(""),
  email: z.string().email().or(z.literal("")).default(""),
  language: z.enum(["en-US", "pt-BR"]).default("en-US"),
  contact_preference: z.string().default("text"),
  address: z.string().trim().min(1),
  city: z.string().default(""),
  state: z.string().default(""),
  zip: z.string().default(""),
  bedrooms: z.coerce.number().int().min(0).default(0),
  bathrooms: z.coerce.number().min(0).default(0),
  duration_minutes: z.coerce.number().int().min(15).max(1440).default(120),
  checklist: z.array(z.string().trim().min(1)).default([]),
  restricted_rooms: z.string().default(""),
  products: z.string().default(""),
  avoid_products: z.string().default(""),
  pets: z.string().default(""),
  warnings: z.string().default(""),
  notes: z.string().default(""),
  parking: z.string().default(""),
});
export const housePatchSchema = z.object({
  nickname: houseSchema.shape.nickname.optional(),
  client_name: houseSchema.shape.client_name.optional(),
  phone: houseSchema.shape.phone.removeDefault().optional(),
  email: houseSchema.shape.email.removeDefault().optional(),
  language: houseSchema.shape.language.removeDefault().optional(),
  contact_preference: houseSchema.shape.contact_preference
    .removeDefault()
    .optional(),
  address: houseSchema.shape.address.optional(),
  city: houseSchema.shape.city.removeDefault().optional(),
  state: houseSchema.shape.state.removeDefault().optional(),
  zip: houseSchema.shape.zip.removeDefault().optional(),
  bedrooms: houseSchema.shape.bedrooms.removeDefault().optional(),
  bathrooms: houseSchema.shape.bathrooms.removeDefault().optional(),
  duration_minutes: houseSchema.shape.duration_minutes
    .removeDefault()
    .optional(),
  checklist: houseSchema.shape.checklist.removeDefault().optional(),
  restricted_rooms: houseSchema.shape.restricted_rooms
    .removeDefault()
    .optional(),
  products: houseSchema.shape.products.removeDefault().optional(),
  avoid_products: houseSchema.shape.avoid_products.removeDefault().optional(),
  pets: houseSchema.shape.pets.removeDefault().optional(),
  warnings: houseSchema.shape.warnings.removeDefault().optional(),
  notes: houseSchema.shape.notes.removeDefault().optional(),
  parking: houseSchema.shape.parking.removeDefault().optional(),
});
export type HouseInput = z.infer<typeof houseSchema>;
export type House = HouseInput & { id: string; business_id: string };
export const employeeSchema = z.object({
  full_name: z.string().trim().min(1),
  phone: z.string().default(""),
  role: z.enum(["manager", "employee"]).default("employee"),
  availability: z.string().default(""),
  active: z.boolean().default(true),
  user_id: z.string().uuid().nullable().default(null),
  color: z.string().default("#537C70"),
});
export type Employee = z.infer<typeof employeeSchema> & {
  id: string;
  business_id: string;
};
export const statusSchema = z.enum([
  "not_started",
  "on_the_way",
  "in_progress",
  "paused",
  "completed",
  "canceled",
]);
export type CleaningStatus = z.infer<typeof statusSchema>;
export const seriesSchema = z.object({
  house_id: z.string().uuid(),
  starts_at: z.string().datetime({ offset: true }),
  duration_minutes: z.coerce.number().int().min(15).max(1440),
  recurrence: z.enum(["once", "weekly", "biweekly", "monthly", "custom"]),
  interval_weeks: z.coerce.number().int().min(1).max(52).default(1),
  employee_ids: z.array(z.string().uuid()).default([]),
  notes: z.string().default(""),
});
export type Series = z.infer<typeof seriesSchema> & {
  id: string;
  business_id: string;
  until_at: string | null;
};
export type Exception = {
  id: string;
  series_id: string;
  original_date: string;
  canceled: boolean;
  starts_at: string | null;
  duration_minutes: number | null;
  employee_ids: string[] | null;
  notes: string | null;
};
export type Occurrence = {
  key: string;
  series_id: string;
  house_id: string;
  original_date: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  employee_ids: string[];
  notes: string;
};
export type Visit = {
  id: string;
  series_id: string;
  original_date: string;
  status: CleaningStatus;
  actual_start: string | null;
  actual_end: string | null;
  completed_tasks: string[];
  notes: string;
  employee_count: number;
};
export type Request = {
  id: string;
  house_id: string;
  message: string;
  requested_start: string | null;
  status: "pending" | "approved" | "declined";
  series_id: string | null;
  original_date: string | null;
};
export type Photo = {
  id: string;
  house_id: string;
  visit_id: string | null;
  path: string;
  caption: string;
  is_cover?: boolean;
  created_at?: string;
};
export type Profile = {
  id: string;
  business_id: string;
  role: "manager" | "employee";
  full_name: string;
};
export type Notification = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};
export type Data = {
  timezone: string;
  houses: House[];
  employees: Employee[];
  series: Series[];
  exceptions: Exception[];
  visits: Visit[];
  requests: Request[];
  photos: Photo[];
  notifications: Notification[];
};
export const emptyData: Data = {
  timezone: "America/New_York",
  houses: [],
  employees: [],
  series: [],
  exceptions: [],
  visits: [],
  requests: [],
  photos: [],
  notifications: [],
};
// Every AI operation is schema-checked again by the server before confirmation.
export const proposalSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("answer"), answer: z.string() }),
  z.object({ action: z.literal("clarify"), question: z.string() }),
  z.object({
    action: z.literal("create_house"),
    house: houseSchema,
    access_instructions: z.string().max(10000).optional(),
    schedule: seriesSchema.omit({ house_id: true }).optional(),
  }),
  z.object({
    action: z.literal("update_house"),
    house_id: z.string().uuid(),
    changes: housePatchSchema,
    access_instructions: z.string().max(10000).optional(),
  }),
  z.object({ action: z.literal("create_employee"), employee: employeeSchema }),
  z.object({ action: z.literal("create_series"), series: seriesSchema }),
  z.object({
    action: z.literal("change_occurrence"),
    series_id: z.string().uuid(),
    original_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    starts_at: z.string().datetime({ offset: true }).optional(),
    canceled: z.boolean().default(false),
    employee_ids: z.array(z.string().uuid()).optional(),
    notes: z.string().optional(),
  }),
]);
export type Proposal = z.infer<typeof proposalSchema>;
