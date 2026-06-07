ALTER TABLE `carousels` ADD `short_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `carousels_short_id_unique` ON `carousels` (`short_id`);