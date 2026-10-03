CREATE TABLE `appointment_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`facility_id` text NOT NULL,
	`service` text NOT NULL,
	`practitioner` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	FOREIGN KEY (`facility_id`) REFERENCES `health_facilities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "appointment_slot_status" CHECK("appointment_slots"."status" IN ('open','closed')),
	CONSTRAINT "appointment_slot_interval" CHECK("appointment_slots"."ends_at">"appointment_slots"."starts_at")
);
--> statement-breakpoint
CREATE INDEX `idx_slot_facility_date` ON `appointment_slots` (`facility_id`,`starts_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_slot_practitioner_start` ON `appointment_slots` (`facility_id`,`practitioner`,`starts_at`);--> statement-breakpoint
CREATE TABLE `health_appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`slot_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`patient_name` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`slot_id`) REFERENCES `appointment_slots`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "health_appointment_status" CHECK("health_appointments"."status" IN ('requested','confirmed','declined','cancelled','completed','expired'))
);
--> statement-breakpoint
CREATE INDEX `idx_appointment_patient` ON `health_appointments` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_appointment_active_slot` ON `health_appointments` (`slot_id`) WHERE "health_appointments"."status" IN ('requested','confirmed');--> statement-breakpoint
CREATE TABLE `health_facilities` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`city` text NOT NULL,
	`address` text NOT NULL,
	`phone` text NOT NULL,
	`hours` text NOT NULL,
	`license` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`verified_at` text,
	`verified_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "health_facility_kind" CHECK("health_facilities"."kind" IN ('pharmacy','clinic')),
	CONSTRAINT "health_facility_status" CHECK("health_facilities"."status" IN ('pending','verified','suspended'))
);
--> statement-breakpoint
CREATE INDEX `idx_health_facility_owner` ON `health_facilities` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_health_facility_public` ON `health_facilities` (`status`,`kind`,`city`);--> statement-breakpoint
CREATE TABLE `health_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`facility_id` text NOT NULL,
	`account_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`facility_id`) REFERENCES `health_facilities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "health_staff_status" CHECK("health_staff"."status" IN ('active','revoked'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_health_staff_scope` ON `health_staff` (`account_id`,`facility_id`);--> statement-breakpoint
CREATE TABLE `medicine_inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`facility_id` text NOT NULL,
	`name` text NOT NULL,
	`generic_name` text DEFAULT '' NOT NULL,
	`strength` text NOT NULL,
	`form` text NOT NULL,
	`availability` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`facility_id`) REFERENCES `health_facilities`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "inventory_availability" CHECK("medicine_inventory"."availability" IN ('available','unavailable','unknown'))
);
--> statement-breakpoint
CREATE INDEX `idx_inventory_facility` ON `medicine_inventory` (`facility_id`,`name`);--> statement-breakpoint
CREATE TABLE `medicine_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`inventory_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`patient_name` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`hold_until` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`inventory_id`) REFERENCES `medicine_inventory`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "medicine_request_status" CHECK("medicine_requests"."status" IN ('requested','confirmed','unavailable','collected','cancelled','expired'))
);
--> statement-breakpoint
CREATE INDEX `idx_medicine_request_patient` ON `medicine_requests` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_medicine_request_inventory` ON `medicine_requests` (`inventory_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_medicine_request_active` ON `medicine_requests` (`patient_id`,`inventory_id`) WHERE "medicine_requests"."status" IN ('requested','confirmed');--> statement-breakpoint
CREATE TABLE `vehicle_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_vehicle_favorite` ON `vehicle_favorites` (`account_id`,`vehicle_id`);--> statement-breakpoint
CREATE TABLE `vehicle_inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`buyer_name` text NOT NULL,
	`message` text NOT NULL,
	`reply` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "vehicle_inquiry_status" CHECK("vehicle_inquiries"."status" IN ('open','replied','closed'))
);
--> statement-breakpoint
CREATE INDEX `idx_vehicle_inquiry_buyer` ON `vehicle_inquiries` (`buyer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_vehicle_inquiry_vehicle` ON `vehicle_inquiries` (`vehicle_id`,`status`);--> statement-breakpoint
CREATE TABLE `vehicle_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`content_type` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicle_photos_storage_key_unique` ON `vehicle_photos` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_vehicle_photo` ON `vehicle_photos` (`vehicle_id`,`position`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_id` text NOT NULL,
	`seller_name` text NOT NULL,
	`seller_type` text NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`year` integer NOT NULL,
	`mileage` integer NOT NULL,
	`transmission` text NOT NULL,
	`fuel` text NOT NULL,
	`condition` text NOT NULL,
	`price` integer NOT NULL,
	`currency` text DEFAULT 'BIF' NOT NULL,
	`city` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`moderation_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "vehicle_status" CHECK("vehicles"."status" IN ('draft','pending','published','sold','archived')),
	CONSTRAINT "vehicle_amounts" CHECK("vehicles"."price">0 AND "vehicles"."mileage">=0 AND "vehicles"."year">=1900)
);
--> statement-breakpoint
CREATE INDEX `idx_vehicle_seller` ON `vehicles` (`seller_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_vehicle_market` ON `vehicles` (`status`,`city`,`price`);