CREATE TABLE `fix_revision_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`revision_id` integer NOT NULL,
	`path` text NOT NULL,
	`action` text NOT NULL,
	`before_content` text,
	`after_content` text,
	FOREIGN KEY (`revision_id`) REFERENCES `fix_revisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fix_revision_files_revision_path_idx` ON `fix_revision_files` (`revision_id`,`path`);--> statement-breakpoint
CREATE TABLE `fix_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`incident_id` integer NOT NULL,
	`number` integer NOT NULL,
	`author` text NOT NULL,
	`created_at` integer NOT NULL,
	`target_repo` text NOT NULL,
	`base_sha` text NOT NULL,
	`summary` text NOT NULL,
	FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fix_revisions_incident_number_idx` ON `fix_revisions` (`incident_id`,`number`);--> statement-breakpoint
ALTER TABLE `incidents` ADD `approved_revision_id` integer REFERENCES fix_revisions(id);