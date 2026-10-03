import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
test("all generated migrations apply to a clean disposable database", () => {
  const db = new DatabaseSync(":memory:");
  for (const name of readdirSync("drizzle")
    .filter((n) => n.endsWith(".sql"))
    .sort())
    db.exec(readFileSync("drizzle/" + name, "utf8"));
  for (const table of [
    "accounts",
    "properties",
    "applications",
    "ownerships",
    "staff_assignments",
    "tenancies",
    "household_members",
    "application_workflows",
    "invitations",
    "vehicles",
    "vehicle_photos",
    "vehicle_favorites",
    "vehicle_inquiries",
    "health_facilities",
    "health_staff",
    "medicine_inventory",
    "medicine_requests",
    "appointment_slots",
    "health_appointments",
  ])
    assert(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(table),
    );
  db.close();
});

test("legacy owner groups migrate without inventing resident tenancies or claiming applications", () => {
  const db = new DatabaseSync(":memory:");
  const migrations = readdirSync("drizzle")
    .filter((n) => n.endsWith(".sql"))
    .sort();
  for (const name of migrations.filter((n) => n < "0004"))
    db.exec(readFileSync("drizzle/" + name, "utf8"));
  db.exec(`INSERT INTO accounts (id,email,display_name,role) VALUES ('owner','owner@example.invalid','Owner','owner'),('resident','resident@example.invalid','Resident','resident');
    INSERT INTO properties (id,name,neighborhood,kind,homes,created_by) VALUES ('existing','Existing Property','Existing Area','Apartment',2,'owner');
    INSERT INTO property_memberships (id,property_id,account_id,role) VALUES ('owner-membership','existing','owner','owner'),('resident-membership','existing','resident','resident');
    INSERT INTO leases (id,property_id,resident_email,resident_name,monthly_rent,start_date,status) VALUES ('existing-lease','existing','resident@example.invalid','Resident',1200,'2026-01-01','active');
    INSERT INTO applications (id,property_id,full_name,email,phone,household_size,status) VALUES ('historical-app','existing','Resident','resident@example.invalid','000',1,'accepted');`);
  for (const name of migrations.filter((n) => n >= "0004"))
    db.exec(readFileSync("drizzle/" + name, "utf8"));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM properties").get().n, 1);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM property_memberships").get().n,
    2,
  );
  assert.equal(
    db.prepare("SELECT account_id FROM ownerships").get().account_id,
    "owner",
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM tenancies").get().n, 1);
  assert.equal(
    db.prepare("SELECT status FROM tenancies").get().status,
    "active",
  );
  assert.equal(
    db.prepare("SELECT stage FROM application_workflows").get().stage,
    "approved",
  );
  assert.equal(
    db.prepare("SELECT account_id FROM application_workflows").get().account_id,
    null,
  );
  db.close();
});
