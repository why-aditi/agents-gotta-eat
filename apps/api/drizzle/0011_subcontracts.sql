CREATE TYPE "public"."subcontract_status" AS ENUM('offered', 'open', 'delivered', 'accepted', 'rejected', 'declined', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "subcontracts" (
	"id" text PRIMARY KEY NOT NULL,
	"spend_request_id" text NOT NULL,
	"hirer_agent_id" text NOT NULL,
	"worker_agent_id" text NOT NULL,
	"bounty_id" text,
	"task" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"fee_cents" bigint NOT NULL,
	"status" "subcontract_status" NOT NULL,
	"deliverable" text,
	"deliver_by" timestamp with time zone NOT NULL,
	"opened_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"review_by" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"rating" smallint,
	"reject_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subcontracts_amount_pos" CHECK ("subcontracts"."amount_cents" > 0 and "subcontracts"."fee_cents" >= 0),
	CONSTRAINT "subcontracts_task_len" CHECK (char_length("subcontracts"."task") between 1 and 4096),
	CONSTRAINT "subcontracts_deliverable_len" CHECK ("subcontracts"."deliverable" is null or octet_length("subcontracts"."deliverable") <= 65536),
	CONSTRAINT "subcontracts_rating_range" CHECK ("subcontracts"."rating" is null or "subcontracts"."rating" between 1 and 5),
	CONSTRAINT "subcontracts_reject_reason_len" CHECK ("subcontracts"."reject_reason" is null or char_length("subcontracts"."reject_reason") <= 500),
	CONSTRAINT "subcontracts_distinct_agents" CHECK ("subcontracts"."hirer_agent_id" <> "subcontracts"."worker_agent_id")
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "skills" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "completed_jobs" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subcontracts" ADD CONSTRAINT "subcontracts_spend_request_id_spend_requests_id_fk" FOREIGN KEY ("spend_request_id") REFERENCES "public"."spend_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontracts" ADD CONSTRAINT "subcontracts_hirer_agent_id_agents_id_fk" FOREIGN KEY ("hirer_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontracts" ADD CONSTRAINT "subcontracts_worker_agent_id_agents_id_fk" FOREIGN KEY ("worker_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcontracts" ADD CONSTRAINT "subcontracts_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subcontracts_spend_request_idx" ON "subcontracts" USING btree ("spend_request_id");--> statement-breakpoint
CREATE INDEX "subcontracts_worker_status_idx" ON "subcontracts" USING btree ("worker_agent_id","status");--> statement-breakpoint
CREATE INDEX "subcontracts_hirer_created_idx" ON "subcontracts" USING btree ("hirer_agent_id","created_at");--> statement-breakpoint
CREATE INDEX "subcontracts_status_deliver_by_idx" ON "subcontracts" USING btree ("status","deliver_by");--> statement-breakpoint
CREATE INDEX "subcontracts_status_review_by_idx" ON "subcontracts" USING btree ("status","review_by");--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_skills_max" CHECK (cardinality("agents"."skills") <= 10);--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_completed_jobs_nonneg" CHECK ("agents"."completed_jobs" >= 0);