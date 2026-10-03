import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";

// Product boundaries are intentional: property assignments grant no access here.
export const vehicles = sqliteTable(
  "vehicles",
  {
    id: text("id").primaryKey(),
    sellerId: text("seller_id").notNull(),
    sellerName: text("seller_name").notNull(),
    sellerType: text("seller_type").notNull(),
    make: text("make").notNull(),
    model: text("model").notNull(),
    year: integer("year").notNull(),
    mileage: integer("mileage").notNull(),
    transmission: text("transmission").notNull(),
    fuel: text("fuel").notNull(),
    condition: text("condition").notNull(),
    price: integer("price").notNull(),
    currency: text("currency").notNull().default("BIF"),
    city: text("city").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("draft"),
    moderationNote: text("moderation_note").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_vehicle_seller").on(t.sellerId, t.status),
    index("idx_vehicle_market").on(t.status, t.city, t.price),
    check(
      "vehicle_status",
      sql`${t.status} IN ('draft','pending','published','sold','archived')`,
    ),
    check(
      "vehicle_amounts",
      sql`${t.price}>0 AND ${t.mileage}>=0 AND ${t.year}>=1900`,
    ),
  ],
);
export const vehiclePhotos = sqliteTable(
  "vehicle_photos",
  {
    id: text("id").primaryKey(),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull().unique(),
    contentType: text("content_type").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("idx_vehicle_photo").on(t.vehicleId, t.position)],
);
export const vehicleFavorites = sqliteTable(
  "vehicle_favorites",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("idx_vehicle_favorite").on(t.accountId, t.vehicleId)],
);
export const vehicleInquiries = sqliteTable(
  "vehicle_inquiries",
  {
    id: text("id").primaryKey(),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id").notNull(),
    buyerName: text("buyer_name").notNull(),
    message: text("message").notNull(),
    reply: text("reply").notNull().default(""),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_vehicle_inquiry_buyer").on(t.buyerId, t.createdAt),
    index("idx_vehicle_inquiry_vehicle").on(t.vehicleId, t.status),
    check(
      "vehicle_inquiry_status",
      sql`${t.status} IN ('open','replied','closed')`,
    ),
  ],
);
export const healthFacilities = sqliteTable(
  "health_facilities",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    city: text("city").notNull(),
    address: text("address").notNull(),
    phone: text("phone").notNull(),
    hours: text("hours").notNull(),
    license: text("license").notNull(),
    status: text("status").notNull().default("pending"),
    reviewNote: text("review_note").notNull().default(""),
    verifiedAt: text("verified_at"),
    verifiedBy: text("verified_by"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_health_facility_owner").on(t.ownerId),
    index("idx_health_facility_public").on(t.status, t.kind, t.city),
    check("health_facility_kind", sql`${t.kind} IN ('pharmacy','clinic')`),
    check(
      "health_facility_status",
      sql`${t.status} IN ('pending','verified','suspended')`,
    ),
  ],
);
export const healthStaff = sqliteTable(
  "health_staff",
  {
    id: text("id").primaryKey(),
    facilityId: text("facility_id")
      .notNull()
      .references(() => healthFacilities.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    status: text("status").notNull().default("active"),
  },
  (t) => [
    uniqueIndex("idx_health_staff_scope").on(t.accountId, t.facilityId),
    check("health_staff_status", sql`${t.status} IN ('active','revoked')`),
  ],
);
export const medicineInventory = sqliteTable(
  "medicine_inventory",
  {
    id: text("id").primaryKey(),
    facilityId: text("facility_id")
      .notNull()
      .references(() => healthFacilities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    genericName: text("generic_name").notNull().default(""),
    strength: text("strength").notNull(),
    form: text("form").notNull(),
    availability: text("availability").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_inventory_facility").on(t.facilityId, t.name),
    check(
      "inventory_availability",
      sql`${t.availability} IN ('available','unavailable','unknown')`,
    ),
  ],
);
export const medicineRequests = sqliteTable(
  "medicine_requests",
  {
    id: text("id").primaryKey(),
    inventoryId: text("inventory_id")
      .notNull()
      .references(() => medicineInventory.id),
    patientId: text("patient_id").notNull(),
    patientName: text("patient_name").notNull(),
    status: text("status").notNull().default("requested"),
    holdUntil: text("hold_until"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_medicine_request_patient").on(t.patientId, t.createdAt),
    index("idx_medicine_request_inventory").on(t.inventoryId, t.status),
    uniqueIndex("idx_medicine_request_active")
      .on(t.patientId, t.inventoryId)
      .where(sql`${t.status} IN ('requested','confirmed')`),
    check(
      "medicine_request_status",
      sql`${t.status} IN ('requested','confirmed','unavailable','collected','cancelled','expired')`,
    ),
  ],
);
export const appointmentSlots = sqliteTable(
  "appointment_slots",
  {
    id: text("id").primaryKey(),
    facilityId: text("facility_id")
      .notNull()
      .references(() => healthFacilities.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    practitioner: text("practitioner").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    status: text("status").notNull().default("open"),
  },
  (t) => [
    index("idx_slot_facility_date").on(t.facilityId, t.startsAt),
    uniqueIndex("idx_slot_practitioner_start").on(
      t.facilityId,
      t.practitioner,
      t.startsAt,
    ),
    check("appointment_slot_status", sql`${t.status} IN ('open','closed')`),
    check("appointment_slot_interval", sql`${t.endsAt}>${t.startsAt}`),
  ],
);
export const healthAppointments = sqliteTable(
  "health_appointments",
  {
    id: text("id").primaryKey(),
    slotId: text("slot_id")
      .notNull()
      .references(() => appointmentSlots.id),
    patientId: text("patient_id").notNull(),
    patientName: text("patient_name").notNull(),
    status: text("status").notNull().default("requested"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_appointment_patient").on(t.patientId, t.createdAt),
    uniqueIndex("idx_appointment_active_slot")
      .on(t.slotId)
      .where(sql`${t.status} IN ('requested','confirmed')`),
    check(
      "health_appointment_status",
      sql`${t.status} IN ('requested','confirmed','declined','cancelled','completed','expired')`,
    ),
  ],
);
