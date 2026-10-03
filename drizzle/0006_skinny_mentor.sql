CREATE TABLE `application_leases` (
	`application_id` text PRIMARY KEY NOT NULL,
	`lease_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_leases_lease_id_unique` ON `application_leases` (`lease_id`);