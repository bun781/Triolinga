ALTER TABLE "sentences" ADD COLUMN IF NOT EXISTS "review_state" "sentence_review_state" DEFAULT 'unknown' NOT NULL;
--> statement-breakpoint
ALTER TABLE "sentences" ADD COLUMN IF NOT EXISTS "review_streak" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sentences" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
