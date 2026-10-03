CREATE TABLE `message_context` (
	`message_id` text PRIMARY KEY NOT NULL,
	`reply_to` text,
	`recipient_account_id` text,
	`context_type` text DEFAULT 'property' NOT NULL,
	`context_id` text
);
