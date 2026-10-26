CREATE TYPE "public"."judge_verifier" AS ENUM('extract_data_v1', 'poster_pick', 'fallback_earliest');--> statement-breakpoint
CREATE TYPE "public"."stake_outcome" AS ENUM('refunded', 'forfeited');--> statement-breakpoint
CREATE TABLE "judgements" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"verifier" "judge_verifier" NOT NULL,
	"score" integer NOT NULL,
	"rationale" text NOT NULL,
	"model" text,
	"prompt_hash" text,
	"raw_output" jsonb NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "judgements_score_range" CHECK ("judgements"."score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "judging_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "pick_deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "winner_entry_id" text;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "stake_outcome" "stake_outcome";--> statement-breakpoint
ALTER TABLE "judgements" ADD CONSTRAINT "judgements_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "judgements_submission_verifier_idx" ON "judgements" USING btree ("submission_id","verifier");