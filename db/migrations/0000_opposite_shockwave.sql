CREATE TABLE `apps` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apps_slug_unique` ON `apps` (`slug`);--> statement-breakpoint
CREATE TABLE `carousel_slides` (
	`id` text PRIMARY KEY NOT NULL,
	`carousel_id` text NOT NULL,
	`order` integer NOT NULL,
	`image_id` text,
	`generated_image_path` text,
	`texts` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`carousel_id`) REFERENCES `carousels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `carousels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`app_id` text,
	`influencer_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`json_source` text,
	`zip_path` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`influencer_id`) REFERENCES `influencers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`original_name` text NOT NULL,
	`path` text NOT NULL,
	`tag` text NOT NULL,
	`scope` text NOT NULL,
	`app_id` text,
	`influencer_id` text,
	`width` integer,
	`height` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`influencer_id`) REFERENCES `influencers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `influencers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`reference_image_path` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `influencers_slug_unique` ON `influencers` (`slug`);