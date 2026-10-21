DROP INDEX `pageviews_session_idx`;--> statement-breakpoint
CREATE INDEX `pageviews_session_path_idx` ON `pageviews` (`session_id`,`path`);