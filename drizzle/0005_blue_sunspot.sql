CREATE TABLE `listing_details` (
	`property_id` text PRIMARY KEY NOT NULL,
	`amenities` text DEFAULT '[]' NOT NULL,
	`pet_policy` text DEFAULT 'ask' NOT NULL,
	`parking` text DEFAULT 'ask' NOT NULL,
	`publication` text DEFAULT 'published' NOT NULL,
	`policies` text DEFAULT '' NOT NULL
);
