CREATE TABLE `checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`site_id` text NOT NULL,
	`check_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`value` real,
	`unit` text,
	`observed_at` integer NOT NULL,
	`detail` text,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checks_dedupe_idx` ON `checks` (`site_id`,`check_id`,`observed_at`);--> statement-breakpoint
CREATE TABLE `incident_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`incident_id` integer NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`summary` text NOT NULL,
	`detail` text,
	`model` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`cost_usd` real,
	`link` text,
	FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `incident_steps_incident_started_idx` ON `incident_steps` (`incident_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`site_id` text NOT NULL,
	`source` text NOT NULL,
	`subject` text NOT NULL,
	`metric` text,
	`status` text NOT NULL,
	`detected_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`resolved_at` integer,
	`evidence` text NOT NULL,
	`note` text,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `incidents_site_detected_idx` ON `incidents` (`site_id`,`detected_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `incidents_one_live_per_subject_idx` ON `incidents` (`site_id`,`source`,`subject`,`metric`) WHERE status NOT IN ('dismissed', 'resolved');--> statement-breakpoint
ALTER TABLE `sites` ADD `write_key` text;