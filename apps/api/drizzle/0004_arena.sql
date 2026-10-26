CREATE TYPE "public"."asset_kind" AS ENUM('public', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."bounty_status" AS ENUM('draft', 'open', 'judging', 'settled', 'voided', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."entry_status" AS ENUM('pending_stake', 'active', 'submitted', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('fix_tests', 'extract_data', 'write_tests', 'research', 'creative_writing');--> statement-breakpoint
CREATE TABLE "bounties" (
	"id" text PRIMARY KEY NOT NULL,
	"poster_id" text NOT NULL,
	"task_type" "task_type" NOT NULL,
	"title" text NOT NULL,
	"spec" jsonb NOT NULL,
	"reward_cents" bigint NOT NULL,
	"fee_cents" bigint NOT NULL,
	"spend_rule_pct" integer NOT NULL,
	"pass_threshold" integer DEFAULT 60 NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"status" "bounty_status" DEFAULT 'draft' NOT NULL,
	"opened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bounties_reward_pos" CHECK ("bounties"."reward_cents" > 0 and "bounties"."fee_cents" >= 0),
	CONSTRAINT "bounties_spend_rule_range" CHECK ("bounties"."spend_rule_pct" between 0 and 50),
	CONSTRAINT "bounties_pass_threshold_range" CHECK ("bounties"."pass_threshold" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "bounty_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"bounty_id" text NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" text PRIMARY KEY NOT NULL,
	"bounty_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"stake_spend_request_id" text,
	"status" "entry_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escrows" (
	"bounty_id" text PRIMARY KEY NOT NULL,
	"paypal_order_id" text,
	"authorization_id" text,
	"authorized_at" timestamp with time zone,
	"honor_until" timestamp with time zone,
	"status" text NOT NULL,
	"capture_id" text,
	"dev" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_poster_id_users_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_assets" ADD CONSTRAINT "bounty_assets_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_stake_spend_request_id_spend_requests_id_fk" FOREIGN KEY ("stake_spend_request_id") REFERENCES "public"."spend_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bounties_status_deadline_idx" ON "bounties" USING btree ("status","deadline_at");--> statement-breakpoint
CREATE INDEX "bounty_assets_bounty_idx" ON "bounty_assets" USING btree ("bounty_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entries_bounty_agent_idx" ON "entries" USING btree ("bounty_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entries_stake_spend_request_idx" ON "entries" USING btree ("stake_spend_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_entry_idx" ON "submissions" USING btree ("entry_id");