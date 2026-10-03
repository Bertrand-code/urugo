CREATE TABLE `application_events` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`stage` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`internal` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_application_events` ON `application_events` (`application_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `application_workflows` (
	`application_id` text PRIMARY KEY NOT NULL,
	`account_id` text,
	`unit_id` text,
	`stage` text DEFAULT 'submitted' NOT NULL,
	`profile_snapshot` text DEFAULT '{}' NOT NULL,
	`assigned_to` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workflow_account` ON `application_workflows` (`account_id`,`stage`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`property_id` text,
	`action` text NOT NULL,
	`resource_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `domain_migrations` (
	`id` text PRIMARY KEY NOT NULL,
	`applied_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `household_members` (
	`id` text PRIMARY KEY NOT NULL,
	`tenancy_id` text NOT NULL,
	`account_id` text,
	`email` text,
	`name` text NOT NULL,
	`relationship` text DEFAULT 'primary' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `household_tenancy_email` ON `household_members` (`tenancy_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_household_account` ON `household_members` (`account_id`,`tenancy_id`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`invited_by` text NOT NULL,
	`property_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_invitation_email` ON `invitations` (`email`,`status`);--> statement-breakpoint
CREATE TABLE `listing_preferences` (
	`account_id` text NOT NULL,
	`property_id` text NOT NULL,
	`saved` integer DEFAULT 0 NOT NULL,
	`viewed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listing_preference_account_property` ON `listing_preferences` (`account_id`,`property_id`);--> statement-breakpoint
CREATE TABLE `ownerships` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`account_id` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ownership_property_account` ON `ownerships` (`property_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `idx_ownership_account` ON `ownerships` (`account_id`,`status`,`property_id`);--> statement-breakpoint
CREATE TABLE `renter_profiles` (
	`account_id` text PRIMARY KEY NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`account_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_property_account` ON `staff_assignments` (`property_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `idx_staff_account` ON `staff_assignments` (`account_id`,`status`,`property_id`);--> statement-breakpoint
CREATE TABLE `tenancies` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`unit_id` text,
	`lease_id` text NOT NULL,
	`status` text DEFAULT 'pending_move_in' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenancies_lease_id_unique` ON `tenancies` (`lease_id`);--> statement-breakpoint
CREATE INDEX `idx_tenancy_property` ON `tenancies` (`property_id`,`status`);
--> statement-breakpoint
-- Preserve legacy IDs; only real leases create tenancies. Unverified historical applications remain unclaimed.
INSERT OR IGNORE INTO ownerships (id, property_id, account_id) SELECT 'legacy-' || id, property_id, account_id FROM property_memberships WHERE role = 'owner';
--> statement-breakpoint
INSERT OR IGNORE INTO tenancies (id, property_id, unit_id, lease_id, status, start_date, end_date) SELECT 'lease-' || id, property_id, unit_id, id, CASE status WHEN 'active' THEN 'active' WHEN 'ended' THEN 'former' ELSE 'pending_move_in' END, start_date, end_date FROM leases;
--> statement-breakpoint
INSERT OR IGNORE INTO household_members (id, tenancy_id, account_id, email, name) SELECT 'resident-' || id, 'lease-' || id, resident_account_id, resident_email, resident_name FROM leases;
--> statement-breakpoint
INSERT OR IGNORE INTO application_workflows (application_id, stage) SELECT id, CASE status WHEN 'new' THEN 'submitted' WHEN 'reviewing' THEN 'under_review' WHEN 'accepted' THEN 'approved' ELSE 'denied' END FROM applications;
--> statement-breakpoint
INSERT OR IGNORE INTO invitations (id, email, invited_by, property_id, role, expires_at) SELECT 'legacy-' || i.id, i.email, g.created_by, g.property_id, 'owner', datetime('now', '+7 days') FROM access_invites i JOIN access_groups g ON g.id = i.group_id WHERE g.role = 'owner';
--> statement-breakpoint
INSERT OR IGNORE INTO domain_migrations (id) VALUES ('relationships-v1');
