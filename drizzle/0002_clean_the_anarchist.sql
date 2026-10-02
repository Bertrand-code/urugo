CREATE TABLE `charges` (
	`id` text PRIMARY KEY NOT NULL,
	`lease_id` text NOT NULL,
	`kind` text DEFAULT 'rent' NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_charges_lease_status_due` ON `charges` (`lease_id`,`status`,`due_date`);--> statement-breakpoint
CREATE TABLE `leases` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`unit_id` text,
	`resident_account_id` text,
	`resident_email` text NOT NULL,
	`resident_name` text NOT NULL,
	`monthly_rent` integer NOT NULL,
	`currency` text DEFAULT 'BIF' NOT NULL,
	`due_day` integer DEFAULT 5 NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_leases_resident_email_status` ON `leases` (`resident_email`,`status`);--> statement-breakpoint
CREATE INDEX `idx_leases_property_status` ON `leases` (`property_id`,`status`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`lease_id` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text DEFAULT 'manual' NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`paid_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_payments_lease_paid` ON `payments` (`lease_id`,`paid_at`);--> statement-breakpoint
CREATE TABLE `property_images` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`alt_text` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `property_images_storage_key_unique` ON `property_images` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_property_images_property_sort` ON `property_images` (`property_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`name` text NOT NULL,
	`bedrooms` integer DEFAULT 0 NOT NULL,
	`bathrooms` real DEFAULT 0 NOT NULL,
	`area_sqm` integer,
	`price_amount` integer NOT NULL,
	`currency` text DEFAULT 'BIF' NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`available_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_units_property_status` ON `units` (`property_id`,`status`);--> statement-breakpoint
ALTER TABLE `properties` ADD `listing_type` text DEFAULT 'rent' NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `price_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `currency` text DEFAULT 'BIF' NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `bedrooms` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `bathrooms` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `area_sqm` integer;--> statement-breakpoint
ALTER TABLE `properties` ADD `year_built` integer;--> statement-breakpoint
ALTER TABLE `properties` ADD `address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `city` text DEFAULT 'Bujumbura' NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `properties` ADD `featured` integer DEFAULT false NOT NULL;