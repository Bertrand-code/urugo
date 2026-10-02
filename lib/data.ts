import { env } from "cloudflare:workers";
import { headers } from "next/headers";

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
];

const propertyColumnMigrations: Record<string, string> = {
  listing_type: "ALTER TABLE properties ADD COLUMN listing_type TEXT NOT NULL DEFAULT 'rent'",
  price_amount: "ALTER TABLE properties ADD COLUMN price_amount INTEGER NOT NULL DEFAULT 0",
  currency: "ALTER TABLE properties ADD COLUMN currency TEXT NOT NULL DEFAULT 'BIF'",
  bedrooms: "ALTER TABLE properties ADD COLUMN bedrooms INTEGER NOT NULL DEFAULT 0",
  bathrooms: "ALTER TABLE properties ADD COLUMN bathrooms REAL NOT NULL DEFAULT 0",
  area_sqm: "ALTER TABLE properties ADD COLUMN area_sqm INTEGER",
  year_built: "ALTER TABLE properties ADD COLUMN year_built INTEGER",
  address: "ALTER TABLE properties ADD COLUMN address TEXT NOT NULL DEFAULT ''",
  city: "ALTER TABLE properties ADD COLUMN city TEXT NOT NULL DEFAULT 'Bujumbura'",
  description: "ALTER TABLE properties ADD COLUMN description TEXT NOT NULL DEFAULT ''",
  featured: "ALTER TABLE properties ADD COLUMN featured INTEGER NOT NULL DEFAULT 0",
};

export function runtimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

export function mediaBucket() {
  return runtimeEnv().MEDIA;
}

async function initializeSchema(db: D1Database) {
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  const columns = await db.prepare("PRAGMA table_info(properties)").all<{ name: string }>();
  const existing = new Set(columns.results.map((column) => column.name));
  const migrations = Object.entries(propertyColumnMigrations)
    .filter(([column]) => !existing.has(column))
    .map(([, statement]) => db.prepare(statement));
  if (migrations.length) await db.batch(migrations);
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

async function claimGroupAccess(db: D1Database, account: Account): Promise<Account> {
  await db.prepare("UPDATE leases SET resident_account_id = ? WHERE resident_email = ? AND resident_account_id IS NULL")
    .bind(account.id, account.email).run();
  const invitations = await db.prepare(
    `SELECT i.id AS invite_id, g.id AS group_id, g.property_id, g.role
     FROM access_invites i
     INNER JOIN access_groups g ON g.id = i.group_id
     WHERE i.email = ?`,
  ).bind(account.email).all<{ invite_id: string; group_id: string; property_id: string; role: Exclude<Role, "admin"> }>();

  if (!invitations.results.length) return account;

  const statements: D1PreparedStatement[] = [];
  for (const invite of invitations.results) {
    statements.push(
      db.prepare("INSERT OR IGNORE INTO access_group_members (id, group_id, account_id) VALUES (?, ?, ?)")
        .bind(crypto.randomUUID(), invite.group_id, account.id),
      db.prepare("INSERT OR IGNORE INTO property_memberships (id, property_id, account_id, role) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), invite.property_id, account.id, invite.role),
      db.prepare("DELETE FROM access_invites WHERE id = ?").bind(invite.invite_id),
    );
  }
  if (account.role !== "admin") {
    const strongestRole = invitations.results.some((invite) => invite.role === "owner") ? "owner" : "resident";
    statements.push(db.prepare("UPDATE accounts SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(strongestRole, account.id));
  }
  await db.batch(statements);
  return (await db.prepare("SELECT id, email, display_name, role FROM accounts WHERE id = ?").bind(account.id).first<Account>())!;
}

async function ensureAccount(input: { id: string; email: string; displayName: string }): Promise<Account> {
  const db = await database();
  const email = normalizeEmail(input.email);
  const preferredAdmin = normalizeEmail(runtimeEnv().ADMIN_EMAIL ?? PRIMARY_ADMIN_EMAIL);
  const existing = await db.prepare("SELECT id, email, display_name, role FROM accounts WHERE id = ?").bind(input.id).first<Account>();

  if (existing) {
    if (existing.email !== email || existing.display_name !== input.displayName) {
      await db.prepare("UPDATE accounts SET email = ?, display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(email, input.displayName, input.id).run();
    }
    const refreshed = { ...existing, email, display_name: input.displayName };
    return claimGroupAccess(db, refreshed);
  }

  const role: Role = email === preferredAdmin ? "admin" : "resident";
  await db.prepare("INSERT INTO accounts (id, email, display_name, role) VALUES (?, ?, ?, ?)")
    .bind(input.id, email, input.displayName, role).run();
  return claimGroupAccess(db, { id: input.id, email, display_name: input.displayName, role });
}

export async function currentAccount(): Promise<Account | null> {
  const requestHeaders = await headers();
  const id = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
  const isEncoded = requestHeaders.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8";

  if (id && email) {
    return ensureAccount({ id, email, displayName: safeDisplayName(isEncoded ? encodedName : null, email) });
  }
  if (isLocalDevelopment()) {
    return ensureAccount({ id: "local-administrator", email: PRIMARY_ADMIN_EMAIL, displayName: "Workspace administrator" });
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
  if (account.role !== "admin") throw new AccessError("Only administrators can manage workspace access.", 403);
  return account;
}

export async function propertyAccess(account: Account, propertyId: string): Promise<"admin" | "owner" | "resident" | null> {
  if (account.role === "admin") return "admin";
  const db = await database();
  const membership = await db.prepare("SELECT role FROM property_memberships WHERE property_id = ? AND account_id = ?")
    .bind(propertyId, account.id).first<{ role: "owner" | "resident" }>();
  return membership?.role ?? null;
}

export async function requirePropertyManager(propertyId: string): Promise<Account> {
  const account = await requireAccount();
  const access = await propertyAccess(account, propertyId);
  if (access !== "admin" && access !== "owner") throw new AccessError("You do not have permission to manage this property.", 403);
  return account;
}

export async function accessiblePropertyIds(account: Account): Promise<string[] | null> {
  if (account.role === "admin") return null;
  const db = await database();
  const rows = await db.prepare("SELECT property_id FROM property_memberships WHERE account_id = ?")
    .bind(account.id).all<{ property_id: string }>();
  return rows.results.map((row) => row.property_id);
}

export class AccessError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export function stringField(value: unknown, maxLength = 200) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
