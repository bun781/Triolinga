-- Add columns that may be missing if the DB was created before the canonical schema
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "source" text;
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "tags" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint

-- Drop the old too-strict unique index if it exists and create the correct one
DROP INDEX IF EXISTS "learning_items_canonical_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "learning_items_type_canonical_idx" ON "learning_items" USING btree ("type","canonical_key");
