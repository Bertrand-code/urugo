import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { initializeDomain } from "./domain-schema";
import { initializeProducts } from "./product-schema";

export type Role = "admin" | "owner" | "resident";
export type Account = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
};

type RuntimeEnv = {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  ADMIN_EMAIL?: string;
  RESEND_API_KEY?: string;
  CONTACT_FROM_EMAIL?: string;
};

const PRIMARY_ADMIN_EMAIL = "btuyisenge40@gmail.com";
let schemaReady: Promise<void> | undefined;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'owner', 'resident')) DEFAULT 'resident',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    kind TEXT NOT NULL,
    homes INTEGER NOT NULL CHECK(homes > 0),
    occupied INTEGER NOT NULL DEFAULT 0 CHECK(occupied >= 0),
    status TEXT NOT NULL CHECK(status IN ('published', 'draft')) DEFAULT 'draft',
    accent TEXT NOT NULL DEFAULT 'green',
    listing_type TEXT NOT NULL DEFAULT 'rent',
    price_amount INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BIF',
    bedrooms INTEGER NOT NULL DEFAULT 0,
    bathrooms REAL NOT NULL DEFAULT 0,
    area_sqm INTEGER,
    year_built INTEGER,
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT 'Bujumbura',
    description TEXT NOT NULL DEFAULT '',
    featured INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS property_memberships (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner', 'resident')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(property_id, account_id)
  )`,
  `CREATE TABLE IF NOT EXISTS access_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner', 'resident')),
    property_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS access_group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, account_id)
  )`,
  `CREATE TABLE IF NOT EXISTS access_invites (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, email)
  )`,
  `CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    move_in_date TEXT,
    household_size INTEGER NOT NULL CHECK(household_size > 0),
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK(status IN ('new', 'reviewing', 'declined', 'accepted')) DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS contact_inquiries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('new', 'read', 'closed')) DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS property_images (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    alt_text TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    name TEXT NOT NULL,
    bedrooms INTEGER NOT NULL DEFAULT 0,
    bathrooms REAL NOT NULL DEFAULT 0,
    area_sqm INTEGER,
    price_amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BIF',
    status TEXT NOT NULL CHECK(status IN ('available', 'occupied', 'reserved')) DEFAULT 'available',
    available_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS leases (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    unit_id TEXT,
    resident_account_id TEXT,
    resident_email TEXT NOT NULL,
    resident_name TEXT NOT NULL,
    monthly_rent INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BIF',
    due_day INTEGER NOT NULL DEFAULT 5,
    start_date TEXT NOT NULL,
    end_date TEXT,
    status TEXT NOT NULL CHECK(status IN ('active', 'pending', 'ended')) DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS charges (
    id TEXT PRIMARY KEY,
    lease_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('rent', 'utility', 'fee')) DEFAULT 'rent',
    description TEXT NOT NULL,
    amount INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('open', 'paid', 'waived')) DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    lease_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    method TEXT NOT NULL DEFAULT 'manual',
    reference TEXT NOT NULL DEFAULT '',
    paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS maintenance_requests (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    lease_id TEXT,
    resident_account_id TEXT,
    resident_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    priority TEXT NOT NULL CHECK(priority IN ('low', 'normal', 'high', 'emergency')) DEFAULT 'normal',
    status TEXT NOT NULL CHECK(status IN ('new', 'in_progress', 'on_hold', 'completed')) DEFAULT 'new',
    scheduled_for TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS property_messages (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    sender_account_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    audience TEXT NOT NULL CHECK(audience IN ('all', 'resident', 'management')) DEFAULT 'all',
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS property_documents (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    lease_id TEXT,
    uploaded_by TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    visibility TEXT NOT NULL CHECK(visibility IN ('management', 'resident')) DEFAULT 'resident',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status)",
  "CREATE INDEX IF NOT EXISTS idx_property_memberships_account ON property_memberships(account_id, property_id)",
  "CREATE INDEX IF NOT EXISTS idx_applications_property_created ON applications(property_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created ON contact_inquiries(created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_property_images_property_sort ON property_images(property_id, sort_order)",
  "CREATE INDEX IF NOT EXISTS idx_units_property_status ON units(property_id, status)",
  "CREATE INDEX IF NOT EXISTS idx_leases_resident_email_status ON leases(resident_email, status)",
  "CREATE INDEX IF NOT EXISTS idx_leases_property_status ON leases(property_id, status)",
  "CREATE INDEX IF NOT EXISTS idx_charges_lease_status_due ON charges(lease_id, status, due_date)",
  "CREATE INDEX IF NOT EXISTS idx_payments_lease_paid ON payments(lease_id, paid_at)",
  "CREATE INDEX IF NOT EXISTS idx_maintenance_property_status_created ON maintenance_requests(property_id, status, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_maintenance_resident_created ON maintenance_requests(resident_account_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_messages_property_created ON property_messages(property_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_documents_property_created ON property_documents(property_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_documents_lease_created ON property_documents(lease_id, created_at)",
];

const propertyColumnMigrations: Record<string, string> = {
  listing_type:
    "ALTER TABLE properties ADD COLUMN listing_type TEXT NOT NULL DEFAULT 'rent'",
  price_amount:
    "ALTER TABLE properties ADD COLUMN price_amount INTEGER NOT NULL DEFAULT 0",
  currency:
    "ALTER TABLE properties ADD COLUMN currency TEXT NOT NULL DEFAULT 'BIF'",
  bedrooms:
    "ALTER TABLE properties ADD COLUMN bedrooms INTEGER NOT NULL DEFAULT 0",
  bathrooms:
    "ALTER TABLE properties ADD COLUMN bathrooms REAL NOT NULL DEFAULT 0",
  area_sqm: "ALTER TABLE properties ADD COLUMN area_sqm INTEGER",
  year_built: "ALTER TABLE properties ADD COLUMN year_built INTEGER",
  address: "ALTER TABLE properties ADD COLUMN address TEXT NOT NULL DEFAULT ''",
  city: "ALTER TABLE properties ADD COLUMN city TEXT NOT NULL DEFAULT 'Bujumbura'",
  description:
    "ALTER TABLE properties ADD COLUMN description TEXT NOT NULL DEFAULT ''",
  featured:
    "ALTER TABLE properties ADD COLUMN featured INTEGER NOT NULL DEFAULT 0",
};

export function runtimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

export function mediaBucket() {
  return runtimeEnv().MEDIA;
}

async function initializeSchema(db: D1Database) {
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  const columns = await db
    .prepare("PRAGMA table_info(properties)")
    .all<{ name: string }>();
  const existing = new Set(columns.results.map((column) => column.name));
  const migrations = Object.entries(propertyColumnMigrations)
    .filter(([column]) => !existing.has(column))
    .map(([, statement]) => db.prepare(statement));
  if (migrations.length) await db.batch(migrations);
  await initializeDomain(db);
  await initializeProducts(db);
  await db.prepare("PRAGMA optimize").run();
}

export async function database(): Promise<D1Database> {
  const db = runtimeEnv().DB;
  if (!db) throw new Error("The workspace database is unavailable.");
  if (!schemaReady) {
    schemaReady = initializeSchema(db).then(() => undefined);
  }
  await schemaReady;
  return db;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function safeDisplayName(value: string | null, email: string) {
  if (!value) return email.split("@")[0] || email;
  try {
    return decodeURIComponent(value).slice(0, 100);
  } catch {
    return email.split("@")[0] || email;
  }
}

function isLocalDevelopment() {
  return process.env.NODE_ENV === "development";
}

async function claimGroupAccess(
  db: D1Database,
  account: Account,
): Promise<Account> {
  await db
    .prepare(
      "UPDATE leases SET resident_account_id = ? WHERE resident_email = ? AND resident_account_id IS NULL",
    )
    .bind(account.id, account.email)
    .run();
  await db
    .prepare(
      "UPDATE household_members SET account_id = ? WHERE email = ? AND account_id IS NULL",
    )
    .bind(account.id, account.email)
    .run();
  // Invitations now require explicit acceptance. Legacy groups remain archival.
  return account;
}

async function ensureAccount(input: {
  id: string;
  email: string;
  displayName: string;
}): Promise<Account> {
  const db = await database();
  const email = normalizeEmail(input.email);
  const preferredAdmin = normalizeEmail(
    runtimeEnv().ADMIN_EMAIL ?? PRIMARY_ADMIN_EMAIL,
  );
  const existing = await db
    .prepare("SELECT id, email, display_name, role FROM accounts WHERE id = ?")
    .bind(input.id)
    .first<Account>();

  if (existing) {
    if (
      existing.email !== email ||
      existing.display_name !== input.displayName
    ) {
      await db
        .prepare(
          "UPDATE accounts SET email = ?, display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(email, input.displayName, input.id)
        .run();
    }
    const refreshed = { ...existing, email, display_name: input.displayName };
    return claimGroupAccess(db, refreshed);
  }

  const role: Role = email === preferredAdmin ? "admin" : "resident";
  await db
    .prepare(
      "INSERT INTO accounts (id, email, display_name, role) VALUES (?, ?, ?, ?)",
    )
    .bind(input.id, email, input.displayName, role)
    .run();
  return claimGroupAccess(db, {
    id: input.id,
    email,
    display_name: input.displayName,
    role,
  });
}

export async function currentAccount(): Promise<Account | null> {
  const requestHeaders = await headers();
  const id = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
  const isEncoded =
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
    "percent-encoded-utf-8";

  if (id && email) {
    return ensureAccount({
      id,
      email,
      displayName: safeDisplayName(isEncoded ? encodedName : null, email),
    });
  }
  if (isLocalDevelopment()) {
    return ensureAccount({
      id: "local-administrator",
      email: PRIMARY_ADMIN_EMAIL,
      displayName: "Workspace administrator",
    });
  }
  return null;
}

export async function requireAccount(): Promise<Account> {
  const account = await currentAccount();
  if (!account) throw new AccessError("Please sign in to continue.", 401);
  return account;
}

export async function requireAdmin(): Promise<Account> {
  const account = await requireAccount();
  if (account.role !== "admin")
    throw new AccessError(
      "Only administrators can manage workspace access.",
      403,
    );
  return account;
}

export async function propertyAccess(
  account: Account,
  propertyId: string,
): Promise<"admin" | "owner" | "resident" | null> {
  const { can } = await import("./authorization");
  if (await can(account, "property.edit", propertyId))
    return account.role === "admin" ? "admin" : "owner";
  return null;
}
export async function requirePropertyManager(
  propertyId: string,
): Promise<Account> {
  const { requirePermission } = await import("./authorization");
  return requirePermission(propertyId, "property.edit");
}
export async function propertyParticipant(
  account: Account,
  propertyId: string,
): Promise<"admin" | "owner" | "resident" | null> {
  const access = await propertyAccess(account, propertyId);
  if (access) return access;
  const db = await database();
  const household = await db
    .prepare(
      "SELECT t.id FROM tenancies t JOIN household_members h ON h.tenancy_id=t.id WHERE t.property_id=? AND h.account_id=? AND h.relationship IN ('primary','co_resident','guarantor') AND t.status IN ('active','notice_given','move_out_pending') LIMIT 1",
    )
    .bind(propertyId, account.id)
    .first();
  return household ? "resident" : null;
}
export async function requirePropertyParticipant(
  propertyId: string,
): Promise<{ account: Account; access: "admin" | "owner" | "resident" }> {
  const account = await requireAccount();
  const access = await propertyParticipant(account, propertyId);
  if (!access)
    throw new AccessError("You do not have access to this property.", 403);
  return { account, access };
}
export async function accessiblePropertyIds(
  account: Account,
): Promise<string[] | null> {
  const { permittedPropertyIds } = await import("./authorization");
  return permittedPropertyIds(account, "property.view");
}

export class AccessError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof SyntaxError)
    return Response.json(
      { error: "Please send a valid request." },
      { status: 400 },
    );
  if (error instanceof AccessError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}

export function stringField(value: unknown, maxLength = 200) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
