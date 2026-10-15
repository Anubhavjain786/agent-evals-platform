CREATE TABLE `agent_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`source` text NOT NULL,
	`version` text NOT NULL,
	`definition` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`suite_id` text NOT NULL,
	`baseline_config_id` text NOT NULL,
	`status` text NOT NULL,
	`trials` integer NOT NULL,
	`concurrency` integer NOT NULL,
	`seed` integer NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	`started_at` text,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `experiments_created_at_idx` ON `experiments` (`created_at`);--> statement-breakpoint
CREATE TABLE `run_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`seq` integer NOT NULL,
	`type` text NOT NULL,
	`ts` integer NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `run_events_run_seq_uq` ON `run_events` (`run_id`,`seq`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`task_id` text NOT NULL,
	`config_id` text NOT NULL,
	`trial` integer NOT NULL,
	`queue_order` integer NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`status` text NOT NULL,
	`outcome` text,
	`score` real,
	`error_kind` text,
	`error_message` text,
	`final_answer` text,
	`exit_code` integer,
	`turn_exit_reason` text,
	`session_id` text,
	`usage` text,
	`cost_usd` real,
	`total_tokens` integer,
	`tool_calls` integer,
	`duration_ms` integer,
	`files` text,
	`log_tail` text,
	`started_at` text,
	`finished_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `runs_experiment_idx` ON `runs` (`experiment_id`,`status`);--> statement-breakpoint
CREATE INDEX `runs_queue_idx` ON `runs` (`status`,`queue_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `runs_cell_trial_uq` ON `runs` (`experiment_id`,`task_id`,`config_id`,`trial`);--> statement-breakpoint
CREATE TABLE `score_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`position` integer NOT NULL,
	`scorer_id` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`weight` real NOT NULL,
	`required` integer NOT NULL,
	`score` real NOT NULL,
	`passed` integer NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`evidence` text,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `score_results_run_idx` ON `score_results` (`run_id`);--> statement-breakpoint
CREATE TABLE `suites` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`source` text NOT NULL,
	`version` text NOT NULL,
	`definition` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
