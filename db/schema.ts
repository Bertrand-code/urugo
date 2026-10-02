import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
