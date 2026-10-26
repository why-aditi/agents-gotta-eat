CREATE TYPE "public"."agent_run_step" AS ENUM('enter_decision', 'plan', 'work', 'self_check', 'spend', 'submit', 'stop');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"bounty_id" text,
	"step" "agent_run_step" NOT NULL,
	"tool" text,
	"summary" text NOT NULL,
	"input" text,
	"output" text,
	"tokens" integer,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_runs_counts_nonneg" CHECK (coalesce("agent_runs"."tokens", 0) >= 0 and coalesce("agent_runs"."latency_ms", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"scope" text NOT NULL,
	"owner_id" text,
	"bounty_id" text,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_scope" CHECK (("events"."scope" = 'public' and "events"."owner_id" is null) or ("events"."scope" = 'owner' and "events"."owner_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_agent_created_idx" ON "agent_runs" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_runs_created_idx" ON "agent_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_bounty_id_idx" ON "events" USING btree ("bounty_id","id");--> statement-breakpoint
CREATE INDEX "events_owner_id_idx" ON "events" USING btree ("owner_id","id");--> statement-breakpoint
CREATE INDEX "events_created_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
-- Events are append-only: inserted, and deleted only by the 30-day prune. Never updated.
CREATE FUNCTION events_no_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'events are append-only: % rejected', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER events_append_only
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION events_no_update();