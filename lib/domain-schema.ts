// Additive domain migration. Existing records and legacy groups are retained.
export const domainStatements = [
  `CREATE TABLE IF NOT EXISTS message_context (message_id TEXT PRIMARY KEY, reply_to TEXT, recipient_account_id TEXT, context_type TEXT NOT NULL DEFAULT 'property', context_id TEXT)`,
  `CREATE TABLE IF NOT EXISTS application_leases (application_id TEXT PRIMARY KEY, lease_id TEXT NOT NULL UNIQUE)`,
  `CREATE TABLE IF NOT EXISTS listing_details (property_id TEXT PRIMARY KEY, amenities TEXT NOT NULL DEFAULT '[]', pet_policy TEXT NOT NULL DEFAULT 'ask', parking TEXT NOT NULL DEFAULT 'ask', publication TEXT NOT NULL DEFAULT 'published', policies TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS domain_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS ownerships (id TEXT PRIMARY KEY, property_id TEXT NOT NULL, account_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner', status TEXT NOT NULL DEFAULT 'active', UNIQUE(property_id, account_id))`,
  `CREATE TABLE IF NOT EXISTS staff_assignments (id TEXT PRIMARY KEY, property_id TEXT NOT NULL, account_id TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', UNIQUE(property_id, account_id))`,
  `CREATE TABLE IF NOT EXISTS invitations (id TEXT PRIMARY KEY, email TEXT NOT NULL, invited_by TEXT NOT NULL, property_id TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', expires_at TEXT NOT NULL, accepted_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS tenancies (id TEXT PRIMARY KEY, property_id TEXT NOT NULL, unit_id TEXT, lease_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending_move_in', start_date TEXT NOT NULL, end_date TEXT)`,
  `CREATE TABLE IF NOT EXISTS household_members (id TEXT PRIMARY KEY, tenancy_id TEXT NOT NULL, account_id TEXT, email TEXT, name TEXT NOT NULL, relationship TEXT NOT NULL DEFAULT 'primary', UNIQUE(tenancy_id, email))`,
  `CREATE TABLE IF NOT EXISTS renter_profiles (account_id TEXT PRIMARY KEY, data TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS application_workflows (application_id TEXT PRIMARY KEY, account_id TEXT, unit_id TEXT, stage TEXT NOT NULL DEFAULT 'submitted', profile_snapshot TEXT NOT NULL DEFAULT '{}', assigned_to TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS application_events (id TEXT PRIMARY KEY, application_id TEXT NOT NULL, actor_id TEXT NOT NULL, stage TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', internal INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS listing_preferences (account_id TEXT NOT NULL, property_id TEXT NOT NULL, saved INTEGER NOT NULL DEFAULT 0, viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(account_id, property_id))`,
  `CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, property_id TEXT, action TEXT NOT NULL, resource_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_ownership_account ON ownerships(account_id, status, property_id)`,
  `CREATE INDEX IF NOT EXISTS idx_staff_account ON staff_assignments(account_id, status, property_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invitation_email ON invitations(email, status)`,
  `CREATE INDEX IF NOT EXISTS idx_tenancy_property ON tenancies(property_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_household_account ON household_members(account_id, tenancy_id)`,
  `CREATE INDEX IF NOT EXISTS idx_workflow_account ON application_workflows(account_id, stage)`,
  `CREATE INDEX IF NOT EXISTS idx_application_events ON application_events(application_id, created_at)`,
];

export async function initializeDomain(db: D1Database) {
  await db.batch(domainStatements.map((sql) => db.prepare(sql)));
  const migrated = await db
    .prepare("SELECT id FROM domain_migrations WHERE id = 'relationships-v1'")
    .first();
  if (!migrated)
    await db.batch([
      db.prepare(
        "INSERT OR IGNORE INTO ownerships (id, property_id, account_id) SELECT 'legacy-' || id, property_id, account_id FROM property_memberships WHERE role = 'owner'",
      ),
      db.prepare(
        "INSERT OR IGNORE INTO tenancies (id, property_id, unit_id, lease_id, status, start_date, end_date) SELECT 'lease-' || id, property_id, unit_id, id, CASE status WHEN 'active' THEN 'active' WHEN 'ended' THEN 'former' ELSE 'pending_move_in' END, start_date, end_date FROM leases",
      ),
      db.prepare(
        "INSERT OR IGNORE INTO household_members (id, tenancy_id, account_id, email, name) SELECT 'resident-' || id, 'lease-' || id, resident_account_id, resident_email, resident_name FROM leases",
      ),
      // Historical email alone is not proof of ownership of an application.
      db.prepare(
        "INSERT OR IGNORE INTO application_workflows (application_id, stage) SELECT id, CASE status WHEN 'new' THEN 'submitted' WHEN 'reviewing' THEN 'under_review' WHEN 'accepted' THEN 'approved' ELSE 'denied' END FROM applications",
      ),
      db.prepare(
        "INSERT OR IGNORE INTO invitations (id, email, invited_by, property_id, role, expires_at) SELECT 'legacy-' || i.id, i.email, g.created_by, g.property_id, 'owner', datetime('now', '+7 days') FROM access_invites i JOIN access_groups g ON g.id = i.group_id WHERE g.role = 'owner'",
      ),
      db.prepare(
        "INSERT OR IGNORE INTO domain_migrations (id) VALUES ('relationships-v1')",
      ),
    ]);
}
