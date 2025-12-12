CREATE TABLE `accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`discriminator` text NOT NULL,
	`avatar` text,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`token_expires_at` integer NOT NULL,
	`guilds` text,
	`guilds_updated_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guild_settings` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`dj_role_id` text,
	`dj_only_mode` integer DEFAULT false NOT NULL,
	`is_247_mode` integer DEFAULT false NOT NULL,
	`autoplay` integer DEFAULT false NOT NULL,
	`vote_skip_enabled` integer DEFAULT false NOT NULL,
	`vote_skip_threshold` real DEFAULT 0.5 NOT NULL,
	`default_volume` integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `playlist_tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`playlist_id` text NOT NULL,
	`position` integer NOT NULL,
	`encoded` text NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`uri` text NOT NULL,
	`duration` integer NOT NULL,
	`artwork_url` text,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`owner_name` text NOT NULL,
	`name` text NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_accessed_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
