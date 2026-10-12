CREATE TYPE "public"."gate_name" AS ENUM('hard_rules', 'intent', 'owner');--> statement-breakpoint
CREATE TYPE "public"."spend_category" AS ENUM('subcontract', 'stake', 'tool');--> statement-breakpoint
CREATE TYPE "public"."spend_status" AS ENUM('pending_approval', 'allowed', 'settled', 'denied', 'released');--> statement-breakpoint
CREATE TYPE "public"."verdict" AS ENUM('allow', 'ask', 'deny');--> statement-breakpoint
CREATE TABLE "mandates" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"version" integer NOT NULL,
	"source_text" text NOT NULL,
	"rules" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "spend_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"spend_request_id" text NOT NULL,
	"gate" "gate_name" NOT NULL,
	"verdict" "verdict" NOT NULL,
	"confidence" integer,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spend_decisions_confidence_range" CHECK ("spend_decisions"."confidence" is null or "spend_decisions"."confidence" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "spend_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"bounty_id" text,
	"payee_type" text DEFAULT 'agent' NOT NULL,
	"payee_id" text,
	"payee_owner_id" text,
	"amount_cents" bigint NOT NULL,
	"fee_cents" bigint DEFAULT 0 NOT NULL,
	"category" "spend_category" NOT NULL,
	"reason" text NOT NULL,
	"status" "spend_status" NOT NULL,
	"mandate_id" text,
	"expires_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spend_requests_amount_pos" CHECK ("spend_requests"."amount_cents" > 0 and "spend_requests"."fee_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_decisions" ADD CONSTRAINT "spend_decisions_spend_request_id_spend_requests_id_fk" FOREIGN KEY ("spend_request_id") REFERENCES "public"."spend_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_requests" ADD CONSTRAINT "spend_requests_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_requests" ADD CONSTRAINT "spend_requests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_requests" ADD CONSTRAINT "spend_requests_payee_owner_id_users_id_fk" FOREIGN KEY ("payee_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_requests" ADD CONSTRAINT "spend_requests_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mandates_agent_version_idx" ON "mandates" USING btree ("agent_id","version");--> statement-breakpoint
CREATE INDEX "spend_decisions_request_idx" ON "spend_decisions" USING btree ("spend_request_id");--> statement-breakpoint
CREATE INDEX "spend_requests_agent_created_idx" ON "spend_requests" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "spend_requests_status_expires_idx" ON "spend_requests" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "spend_requests_owner_status_idx" ON "spend_requests" USING btree ("owner_id","status");