CREATE INDEX `idx_applications_property_created` ON `applications` (`property_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_contact_inquiries_created` ON `contact_inquiries` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_properties_status` ON `properties` (`status`);--> statement-breakpoint
CREATE INDEX `idx_property_memberships_account_property` ON `property_memberships` (`account_id`,`property_id`);