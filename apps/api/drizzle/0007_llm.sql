CREATE TYPE "public"."llm_outcome" AS ENUM('ok', 'invalid_output', 'error', 'timeout', 'over_budget');--> statement-breakpoint
CREATE TYPE "public"."llm_role" AS ENUM('mandate_compile', 'intent_check', 'judge');--> statement-breakpoint
ALTER TYPE "public"."judge_verifier" ADD VALUE 'ai_judge';--> statement-breakpoint
ALTER TYPE "public"."judge_verifier" ADD VALUE 'fallback_ai_top';--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"role" "llm_role" NOT NULL,
	"model" text NOT NULL,
	"served_model" text,
	"latency_ms" integer NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"outcome" "llm_outcome" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "ai_ranked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "ai_rank_failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "ai_rank_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "llm_calls_created_idx" ON "llm_calls" USING btree ("created_at");