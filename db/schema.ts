import { sql } from "drizzle-orm";
export * from "./products";
export const messageContext = sqliteTable("message_context", {
  messageId: text("message_id").primaryKey(),
  replyTo: text("reply_to"),
  recipientAccountId: text("recipient_account_id"),
  contextType: text("context_type").notNull().default("property"),
  contextId: text("context_id"),
});
export const applicationLeases = sqliteTable("application_leases", {
  applicationId: text("application_id").primaryKey(),
  leaseId: text("lease_id").notNull().unique(),
});
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const domainMigrations = sqliteTable("domain_migrations", {
  id: text("id").primaryKey(),
  appliedAt: text("applied_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const listingDetails = sqliteTable("listing_details", {
  propertyId: text("property_id").primaryKey(),
  amenities: text("amenities").notNull().default("[]"),
  petPolicy: text("pet_policy").notNull().default("ask"),
  parking: text("parking").notNull().default("ask"),
  publication: text("publication").notNull().default("published"),
  policies: text("policies").notNull().default(""),
});
export const ownerships = sqliteTable(
  "ownerships",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id").notNull(),
    accountId: text("account_id").notNull(),
    role: text("role").notNull().default("owner"),
    status: text("status").notNull().default("active"),
  },
  (t) => [
    uniqueIndex("ownership_property_account").on(t.propertyId, t.accountId),
    index("idx_ownership_account").on(t.accountId, t.status, t.propertyId),
  ],
);
export const staffAssignments = sqliteTable(
  "staff_assignments",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id").notNull(),
    accountId: text("account_id").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
  },
  (t) => [
    uniqueIndex("staff_property_account").on(t.propertyId, t.accountId),
    index("idx_staff_account").on(t.accountId, t.status, t.propertyId),
  ],
);
export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    invitedBy: text("invited_by").notNull(),
    propertyId: text("property_id").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: text("expires_at").notNull(),
    acceptedAt: text("accepted_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("idx_invitation_email").on(t.email, t.status)],
);
export const tenancies = sqliteTable(
  "tenancies",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id").notNull(),
    unitId: text("unit_id"),
    leaseId: text("lease_id").notNull().unique(),
    status: text("status").notNull().default("pending_move_in"),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
  },
  (t) => [index("idx_tenancy_property").on(t.propertyId, t.status)],
);
export const householdMembers = sqliteTable(
  "household_members",
  {
    id: text("id").primaryKey(),
    tenancyId: text("tenancy_id").notNull(),
    accountId: text("account_id"),
    email: text("email"),
    name: text("name").notNull(),
    relationship: text("relationship").notNull().default("primary"),
  },
  (t) => [
    uniqueIndex("household_tenancy_email").on(t.tenancyId, t.email),
    index("idx_household_account").on(t.accountId, t.tenancyId),
  ],
);
export const renterProfiles = sqliteTable("renter_profiles", {
  accountId: text("account_id").primaryKey(),
  data: text("data").notNull().default("{}"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const applicationWorkflows = sqliteTable(
  "application_workflows",
  {
    applicationId: text("application_id").primaryKey(),
    accountId: text("account_id"),
    unitId: text("unit_id"),
    stage: text("stage").notNull().default("submitted"),
    profileSnapshot: text("profile_snapshot").notNull().default("{}"),
    assignedTo: text("assigned_to"),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("idx_workflow_account").on(t.accountId, t.stage)],
);
export const applicationEvents = sqliteTable(
  "application_events",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id").notNull(),
    actorId: text("actor_id").notNull(),
    stage: text("stage").notNull(),
    message: text("message").notNull().default(""),
    internal: integer("internal").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("idx_application_events").on(t.applicationId, t.createdAt)],
);
export const listingPreferences = sqliteTable(
  "listing_preferences",
  {
    accountId: text("account_id").notNull(),
    propertyId: text("property_id").notNull(),
    saved: integer("saved").notNull().default(0),
    viewedAt: text("viewed_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("listing_preference_account_property").on(
      t.accountId,
      t.propertyId,
    ),
  ],
);
export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  propertyId: text("property_id"),
  action: text("action").notNull(),
  resourceId: text("resource_id").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["admin", "owner", "resident"] })
    .notNull()
    .default("resident"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const properties = sqliteTable(
  "properties",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    neighborhood: text("neighborhood").notNull(),
    kind: text("kind").notNull(),
    homes: integer("homes").notNull(),
    occupied: integer("occupied").notNull().default(0),
    status: text("status", { enum: ["published", "draft"] })
      .notNull()
      .default("draft"),
    accent: text("accent").notNull().default("green"),
    listingType: text("listing_type", { enum: ["rent", "sale"] })
      .notNull()
      .default("rent"),
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
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_properties_status").on(table.status)],
);

export const propertyMemberships = sqliteTable(
  "property_memberships",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id").notNull(),
    accountId: text("account_id").notNull(),
    role: text("role", { enum: ["owner", "resident"] }).notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("property_memberships_property_account").on(
      table.propertyId,
      table.accountId,
    ),
    index("idx_property_memberships_account_property").on(
      table.accountId,
      table.propertyId,
    ),
  ],
);

export const accessGroups = sqliteTable("access_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role", { enum: ["owner", "resident"] }).notNull(),
  propertyId: text("property_id").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const propertyImages = sqliteTable(
  "property_images",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    altText: text("alt_text").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_property_images_property_sort").on(
      table.propertyId,
      table.sortOrder,
    ),
  ],
);

export const units = sqliteTable(
  "units",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id").notNull(),
    name: text("name").notNull(),
    bedrooms: integer("bedrooms").notNull().default(0),
    bathrooms: real("bathrooms").notNull().default(0),
    areaSqm: integer("area_sqm"),
    priceAmount: integer("price_amount").notNull(),
    currency: text("currency").notNull().default("BIF"),
    status: text("status", { enum: ["available", "occupied", "reserved"] })
      .notNull()
      .default("available"),
    availableDate: text("available_date"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_units_property_status").on(table.propertyId, table.status),
  ],
);

export const accessGroupMembers = sqliteTable(
  "access_group_members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id").notNull(),
    accountId: text("account_id").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("access_group_members_group_account").on(
      table.groupId,
      table.accountId,
    ),
  ],
);

export const accessInvites = sqliteTable(
  "access_invites",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id").notNull(),
    email: text("email").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("access_invites_group_email").on(table.groupId, table.email),
  ],
);

export const applications = sqliteTable(
  "applications",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    moveInDate: text("move_in_date"),
    householdSize: integer("household_size").notNull(),
    message: text("message").notNull().default(""),
    status: text("status", {
      enum: ["new", "reviewing", "declined", "accepted"],
    })
      .notNull()
      .default("new"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_applications_property_created").on(
      table.propertyId,
      table.createdAt,
    ),
  ],
);

export const contactInquiries = sqliteTable(
  "contact_inquiries",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status", { enum: ["new", "read", "closed"] })
      .notNull()
      .default("new"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_contact_inquiries_created").on(table.createdAt)],
);

export const leases = sqliteTable(
  "leases",
  {
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
    status: text("status", { enum: ["active", "pending", "ended"] })
      .notNull()
      .default("active"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_leases_resident_email_status").on(
      table.residentEmail,
      table.status,
    ),
    index("idx_leases_property_status").on(table.propertyId, table.status),
  ],
);

export const charges = sqliteTable(
  "charges",
  {
    id: text("id").primaryKey(),
    leaseId: text("lease_id").notNull(),
    kind: text("kind", { enum: ["rent", "utility", "fee"] })
      .notNull()
      .default("rent"),
    description: text("description").notNull(),
    amount: integer("amount").notNull(),
    dueDate: text("due_date").notNull(),
    status: text("status", { enum: ["open", "paid", "waived"] })
      .notNull()
      .default("open"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_charges_lease_status_due").on(
      table.leaseId,
      table.status,
      table.dueDate,
    ),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    leaseId: text("lease_id").notNull(),
    amount: integer("amount").notNull(),
    method: text("method").notNull().default("manual"),
    reference: text("reference").notNull().default(""),
    paidAt: text("paid_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_payments_lease_paid").on(table.leaseId, table.paidAt)],
);

export const maintenanceRequests = sqliteTable(
  "maintenance_requests",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id").notNull(),
    leaseId: text("lease_id"),
    residentAccountId: text("resident_account_id"),
    residentName: text("resident_name").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull().default("general"),
    priority: text("priority", { enum: ["low", "normal", "high", "emergency"] })
      .notNull()
      .default("normal"),
    status: text("status", {
      enum: ["new", "in_progress", "on_hold", "completed"],
    })
      .notNull()
      .default("new"),
    scheduledFor: text("scheduled_for"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_maintenance_property_status_created").on(
      table.propertyId,
      table.status,
      table.createdAt,
    ),
    index("idx_maintenance_resident_created").on(
      table.residentAccountId,
      table.createdAt,
    ),
  ],
);

export const propertyMessages = sqliteTable(
  "property_messages",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id").notNull(),
    senderAccountId: text("sender_account_id").notNull(),
    senderName: text("sender_name").notNull(),
    audience: text("audience", { enum: ["all", "resident", "management"] })
      .notNull()
      .default("all"),
    body: text("body").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_messages_property_created").on(
      table.propertyId,
      table.createdAt,
    ),
  ],
);

export const propertyDocuments = sqliteTable(
  "property_documents",
  {
    id: text("id").primaryKey(),
    propertyId: text("property_id").notNull(),
    leaseId: text("lease_id"),
    uploadedBy: text("uploaded_by").notNull(),
    fileName: text("file_name").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    visibility: text("visibility", { enum: ["management", "resident"] })
      .notNull()
      .default("resident"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_documents_property_created").on(
      table.propertyId,
      table.createdAt,
    ),
    index("idx_documents_lease_created").on(table.leaseId, table.createdAt),
  ],
);
