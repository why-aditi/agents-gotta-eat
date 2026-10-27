CREATE TYPE "public"."dispute_status" AS ENUM('open', 'upheld', 'overturned');--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"bounty_id" text NOT NULL,
	"poster_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"note" text,
	"refund_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disputes_reason_len" CHECK (char_length("disputes"."reason") between 1 and 1000),
	CONSTRAINT "disputes_note_len" CHECK ("disputes"."note" is null or char_length("disputes"."note") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "dispute_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "escrows" ADD COLUMN "dispute_refund_id" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_poster_id_users_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_bounty_idx" ON "disputes" USING btree ("bounty_id");--> statement-breakpoint
CREATE INDEX "disputes_status_opened_idx" ON "disputes" USING btree ("status","opened_at");