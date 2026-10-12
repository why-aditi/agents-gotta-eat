CREATE TABLE "idempotency_keys" (
	"principal" text NOT NULL,
	"key" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_principal_key_pk" PRIMARY KEY("principal","key"),
	CONSTRAINT "idempotency_keys_status" CHECK ("idempotency_keys"."status" in ('in_progress', 'done'))
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "api_key_prefix" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "agents_api_key_hash_idx" ON "agents" USING btree ("api_key_hash");