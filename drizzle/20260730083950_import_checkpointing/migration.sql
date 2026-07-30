ALTER TABLE "imports" ADD COLUMN "file_size" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "status" text DEFAULT 'running' NOT NULL;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "last_row_number" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "last_byte_offset" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "failed_row_number" integer;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;