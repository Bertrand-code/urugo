import { AccessError, type Account, database } from "./data";

export type Input = Record<string, unknown>;
export async function input(request: Request): Promise<Input> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AccessError("Send JSON data.", 415);
  if (Number(request.headers.get("content-length") || 0) > 24000)
    throw new AccessError("This request is too large.", 413);
  const raw = await request.text();
  if (raw.length > 24000)
    throw new AccessError("This request is too large.", 413);
  const body: unknown = JSON.parse(raw);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new AccessError("Invalid request.", 400);
  return body as Input;
}
export function field(
  body: Input,
  key: string,
  max = 200,
  optional = false,
): string {
  const v = body[key];
  if (optional && (v === undefined || v === "")) return "";
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw new AccessError(
      `Provide ${key.replaceAll("_", " ")} (up to ${max} characters).`,
      400,
    );
  return v.trim();
}
export function choice(
  body: Input,
  key: string,
  options: readonly string[],
): string {
  const value = field(body, key, 60);
  if (!options.includes(value)) throw new AccessError(`Invalid ${key}.`, 400);
  return value;
}
export function whole(
  body: Input,
  key: string,
  min = 0,
  max = 1_000_000_000,
): number {
  const value = body[key];
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    value === "" ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < min ||
    Number(value) > max
  )
    throw new AccessError(
      `Provide a valid ${key} between ${min} and ${max}.`,
      400,
    );
  return Number(value);
}
export function futureDate(body: Input, key: string, maxDays = 366): string {
  const raw = field(body, key, 40);
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(raw))
    throw new AccessError("Include a timezone in dates.", 400);
  const date = new Date(raw),
    now = Date.now();
  if (
    !Number.isFinite(date.getTime()) ||
    date.getTime() <= now ||
    date.getTime() > now + maxDays * 86400000
  )
    throw new AccessError(
      `Choose a future ${key} within ${maxDays} days.`,
      400,
    );
  return date.toISOString();
}
export const publicVehicleColumns =
  "v.id,v.seller_name,v.seller_type,v.make,v.model,v.year,v.mileage,v.transmission,v.fuel,v.condition,v.price,v.currency,v.city,v.description,v.status,v.created_at";
export const vehiclePhoto =
  "(SELECT '/api/cars/photos/'||p.id FROM vehicle_photos p WHERE p.vehicle_id=v.id ORDER BY p.position,p.id LIMIT 1) AS image_url";
export type Vehicle = {
  id: string;
  seller_id: string;
  seller_name: string;
  status: string;
  make: string;
  model: string;
  year: number;
  [key: string]: unknown;
};
export async function vehicle(id: string) {
  const db = await database();
  const v = await db
    .prepare("SELECT * FROM vehicles WHERE id=?")
    .bind(id)
    .first<Vehicle>();
  if (!v) throw new AccessError("Vehicle not found.", 404);
  return v;
}
export function ownsVehicle(account: Account, v: Vehicle) {
  if (v.seller_id !== account.id)
    throw new AccessError("Vehicle not found.", 404);
}
export type Facility = {
  id: string;
  owner_id: string;
  name: string;
  kind: string;
  status: string;
  [key: string]: unknown;
};
export async function facility(id: string) {
  const db = await database();
  const f = await db
    .prepare("SELECT * FROM health_facilities WHERE id=?")
    .bind(id)
    .first<Facility>();
  if (!f) throw new AccessError("Provider not found.", 404);
  return f;
}
export async function canOperateFacility(account: Account, f: Facility) {
  if (f.owner_id === account.id) return true;
  const db = await database();
  return !!(await db
    .prepare(
      "SELECT id FROM health_staff WHERE account_id=? AND facility_id=? AND status='active'",
    )
    .bind(account.id, f.id)
    .first());
}
export async function requireFacility(
  account: Account,
  id: string,
  kind?: string,
) {
  const f = await facility(id);
  // Even platform administrators need an explicit healthcare relationship to
  // read patient information. Property staff/owners never inherit access.
  if (!(await canOperateFacility(account, f)))
    throw new AccessError("Provider not found.", 404);
  if (kind && f.kind !== kind)
    throw new AccessError(`This action requires a ${kind}.`, 400);
  return f;
}
export function facilityScope(alias = "f") {
  return `(${alias}.owner_id=? OR EXISTS(SELECT 1 FROM health_staff hs WHERE hs.facility_id=${alias}.id AND hs.account_id=? AND hs.status='active'))`;
}
export function requireVerified(f: Facility) {
  if (f.status !== "verified")
    throw new AccessError(
      "This provider must be verified before accepting requests.",
      409,
    );
}
export function audit(
  db: D1Database,
  account: Account,
  action: string,
  resourceId: string,
) {
  return db
    .prepare(
      "INSERT INTO audit_events(id,actor_id,property_id,action,resource_id) VALUES(?,?,NULL,?,?)",
    )
    .bind(crypto.randomUUID(), account.id, action, resourceId);
}
export function conflict(error: unknown, message: string): never {
  if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message))
    throw new AccessError(message, 409);
  throw error;
}
export async function expireHealthRequests(db: D1Database) {
  await db.batch([
    db.prepare(
      "UPDATE medicine_requests SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE status='confirmed' AND datetime(hold_until)<=datetime('now')",
    ),
    db.prepare(
      "UPDATE medicine_requests SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE status='requested' AND datetime(created_at)<datetime('now','-2 days')",
    ),
    db.prepare(
      "UPDATE health_appointments SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE status='requested' AND slot_id IN(SELECT id FROM appointment_slots WHERE datetime(starts_at)<=datetime('now'))",
    ),
  ]);
}
