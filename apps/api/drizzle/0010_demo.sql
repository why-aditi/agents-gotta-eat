CREATE TABLE "recording_events" (
	"recording_id" text NOT NULL,
	"seq" integer NOT NULL,
	"offset_ms" integer NOT NULL,
	"type" text NOT NULL,
	"bounty_id" text,
	"data" jsonb NOT NULL,
	"source_event_id" bigint,
	CONSTRAINT "recording_events_recording_id_seq_pk" PRIMARY KEY("recording_id","seq"),
	CONSTRAINT "recording_events_offset_nonneg" CHECK ("recording_events"."offset_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"featured" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recordings_source" CHECK ("recordings"."source" in ('live', 'import')),
	CONSTRAINT "recordings_window" CHECK ("recordings"."ended_at" is null or "recordings"."ended_at" >= "recordings"."started_at")
);
--> statement-breakpoint
ALTER TABLE "recording_events" ADD CONSTRAINT "recording_events_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recording_events_source_uniq" ON "recording_events" USING btree ("recording_id","source_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recordings_featured_uniq" ON "recordings" USING btree ("featured") WHERE "recordings"."featured";--> statement-breakpoint
CREATE UNIQUE INDEX "recordings_active_uniq" ON "recordings" USING btree (("ended_at" is null)) WHERE "recordings"."ended_at" is null;