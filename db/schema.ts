import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["admin", "owner", "resident"] }).notNull().default("resident"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const properties = sqliteTable("properties", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  neighborhood: text("neighborhood").notNull(),
  kind: text("kind").notNull(),
  homes: integer("homes").notNull(),
  occupied: integer("occupied").notNull().default(0),
  status: text("status", { enum: ["published", "draft"] }).notNull().default("draft"),
  accent: text("accent").notNull().default("green"),
  listingType: text("listing_type", { enum: ["rent", "sale"] }).notNull().default("rent"),
  priceAmount: integer("price_amount").notNull().default(0),
  currency: text("currency").notNull().default("BIF"),
  bedrooms: integer("bedrooms").notNull().default(0),
  bathrooms: real("bathrooms").notNull().default(0),
  areaSqm: integer("area_sqm"),
  yearBuilt: integer("year_built"),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default("Bujumbura"),
  description: text("description").notNull().default(""),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_properties_status").on(table.status)]);

export const propertyMemberships = sqliteTable("property_memberships", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull(),
  accountId: text("account_id").notNull(),
  role: text("role", { enum: ["owner", "resident"] }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("property_memberships_property_account").on(table.propertyId, table.accountId),
  index("idx_property_memberships_account_property").on(table.accountId, table.propertyId),
]);

export const accessGroups = sqliteTable("access_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role", { enum: ["owner", "resident"] }).notNull(),
  propertyId: text("property_id").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const propertyImages = sqliteTable("property_images", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  altText: text("alt_text").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_property_images_property_sort").on(table.propertyId, table.sortOrder)]);

export const units = sqliteTable("units", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull(),
  name: text("name").notNull(),
  bedrooms: integer("bedrooms").notNull().default(0),
  bathrooms: real("bathrooms").notNull().default(0),
  areaSqm: integer("area_sqm"),
  priceAmount: integer("price_amount").notNull(),
  currency: text("currency").notNull().default("BIF"),
  status: text("status", { enum: ["available", "occupied", "reserved"] }).notNull().default("available"),
  availableDate: text("available_date"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_units_property_status").on(table.propertyId, table.status)]);

export const accessGroupMembers = sqliteTable("access_group_members", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  accountId: text("account_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("access_group_members_group_account").on(table.groupId, table.accountId),
]);

export const accessInvites = sqliteTable("access_invites", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("access_invites_group_email").on(table.groupId, table.email)]);

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  moveInDate: text("move_in_date"),
  householdSize: integer("household_size").notNull(),
  message: text("message").notNull().default(""),
  status: text("status", { enum: ["new", "reviewing", "declined", "accepted"] }).notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_applications_property_created").on(table.propertyId, table.createdAt)]);

export const contactInquiries = sqliteTable("contact_inquiries", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["new", "read", "closed"] }).notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_contact_inquiries_created").on(table.createdAt)]);

export const leases = sqliteTable("leases", {
  id: text("id").primaryKey(),
  propertyId: text("property_id").notNull(),
  unitId: text("unit_id"),
  residentAccountId: text("resident_account_id"),
  residentEmail: text("resident_email").notNull(),
  residentName: text("resident_name").notNull(),
  monthlyRent: integer("monthly_rent").notNull(),
  currency: text("currency").notNull().default("BIF"),
  dueDay: integer("due_day").notNull().default(5),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  status: text("status", { enum: ["active", "pending", "ended"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_leases_resident_email_status").on(table.residentEmail, table.status),
  index("idx_leases_property_status").on(table.propertyId, table.status),
]);

export const charges = sqliteTable("charges", {
  id: text("id").primaryKey(),
  leaseId: text("lease_id").notNull(),
  kind: text("kind", { enum: ["rent", "utility", "fee"] }).notNull().default("rent"),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status", { enum: ["open", "paid", "waived"] }).notNull().default("open"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_charges_lease_status_due").on(table.leaseId, table.status, table.dueDate)]);

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  leaseId: text("lease_id").notNull(),
  amount: integer("amount").notNull(),
  method: text("method").notNull().default("manual"),
  reference: text("reference").notNull().default(""),
  paidAt: text("paid_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_payments_lease_paid").on(table.leaseId, table.paidAt)]);
