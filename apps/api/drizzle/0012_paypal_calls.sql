ALTER TYPE "public"."llm_role" ADD VALUE 'treasurer';--> statement-breakpoint
CREATE TABLE "paypal_calls" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status" integer,
	"debug_id" text,
	"request_id" text,
	"duration_ms" integer NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paypal_calls_source" CHECK ("paypal_calls"."source" in ('client', 'toolkit'))
);
--> statement-breakpoint
CREATE INDEX "paypal_calls_created_idx" ON "paypal_calls" USING btree ("created_at");