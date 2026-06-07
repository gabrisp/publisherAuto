CREATE TABLE `tiktok_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tiktok_user_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`token_expires_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tiktok_accounts_tiktok_user_id_unique` ON `tiktok_accounts` (`tiktok_user_id`);--> statement-breakpoint
ALTER TABLE `carousels` ADD `render_text` integer DEFAULT 1 NOT NULL;