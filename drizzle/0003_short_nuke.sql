CREATE TABLE `maintenance_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`lease_id` text,
	`resident_account_id` text,
	`resident_name` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`scheduled_for` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_maintenance_property_status_created` ON `maintenance_requests` (`property_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_maintenance_resident_created` ON `maintenance_requests` (`resident_account_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `property_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`lease_id` text,
	`uploaded_by` text NOT NULL,
	`file_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`visibility` text DEFAULT 'resident' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `property_documents_storage_key_unique` ON `property_documents` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_documents_property_created` ON `property_documents` (`property_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_documents_lease_created` ON `property_documents` (`lease_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `property_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`sender_account_id` text NOT NULL,
	`sender_name` text NOT NULL,
	`audience` text DEFAULT 'all' NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_property_created` ON `property_messages` (`property_id`,`created_at`);