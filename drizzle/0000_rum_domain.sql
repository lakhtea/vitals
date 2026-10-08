CREATE TABLE `metric_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pageview_id` text NOT NULL,
	`metric_id` text NOT NULL,
	`name` text NOT NULL,
	`value` real NOT NULL,
	`rating` text NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`pageview_id`) REFERENCES `pageviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `metric_events_dedupe_idx` ON `metric_events` (`pageview_id`,`name`,`metric_id`);--> statement-breakpoint
CREATE INDEX `metric_events_name_recorded_idx` ON `metric_events` (`name`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `pageviews` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`path` text NOT NULL,
	`started_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pageviews_session_idx` ON `pageviews` (`session_id`);--> statement-breakpoint
CREATE INDEX `pageviews_path_idx` ON `pageviews` (`path`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`device_class` text NOT NULL,
	`connection_type` text NOT NULL,
	`user_agent_family` text NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_site_started_idx` ON `sessions` (`site_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
