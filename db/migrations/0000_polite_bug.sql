DO $$ BEGIN
 CREATE TYPE "public"."learning_item_type" AS ENUM('word', 'grammar', 'chunk');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."review_rating" AS ENUM('easy', 'correct', 'hard', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sentence_drill_type" AS ENUM('recall', 'reconstruction', 'cloze', 'transformation', 'original_sentence');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sentence_id" uuid NOT NULL,
	"learning_item_id" uuid,
	"type" "sentence_drill_type" NOT NULL,
	"prompt" text NOT NULL,
	"answer" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" text NOT NULL,
	"type" "learning_item_type" NOT NULL,
	"canonical_key" text NOT NULL,
	"display_text" text NOT NULL,
	"meaning" text,
	"explanation" text,
	"common_mistakes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lesson_sentences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"sentence_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_language" text NOT NULL,
	"base_language" text NOT NULL,
	"description" text,
	"source" text,
	"level" text,
	"title" text NOT NULL,
	"source_hash" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drill_id" uuid NOT NULL,
	"review_state" text DEFAULT 'new' NOT NULL,
	"next_review_at" timestamp with time zone DEFAULT now() NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"last_grade" "review_rating",
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sentence_chunk_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sentence_id" uuid NOT NULL,
	"chunk_item_id" uuid NOT NULL,
	"surface_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sentence_grammar_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sentence_id" uuid NOT NULL,
	"grammar_item_id" uuid NOT NULL,
	"surface_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sentence_item_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sentence_id" uuid NOT NULL,
	"learning_item_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sentence_review_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_state_id" uuid NOT NULL,
	"drill_id" uuid NOT NULL,
	"drill_type" "sentence_drill_type" NOT NULL,
	"response" text,
	"grade" "review_rating" NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sentence_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sentence_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"item_type" "learning_item_type",
	"canonical_key" text,
	"meaning" text,
	"explanation" text,
	"common_mistakes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"learning_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sentence_vocabulary_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sentence_id" uuid NOT NULL,
	"vocabulary_item_id" uuid NOT NULL,
	"surface_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sentences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"language" text NOT NULL,
	"text" text NOT NULL,
	"normalized_text" text NOT NULL,
	"translation" text NOT NULL,
	"focus_canonical_key" text,
	"focus_display_text" text,
	"focus_meaning" text,
	"focus_explanation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drills" ADD CONSTRAINT "drills_sentence_id_sentences_id_fk" FOREIGN KEY ("sentence_id") REFERENCES "public"."sentences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drills" ADD CONSTRAINT "drills_learning_item_id_learning_items_id_fk" FOREIGN KEY ("learning_item_id") REFERENCES "public"."learning_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_sentences" ADD CONSTRAINT "lesson_sentences_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_sentences" ADD CONSTRAINT "lesson_sentences_sentence_id_sentences_id_fk" FOREIGN KEY ("sentence_id") REFERENCES "public"."sentences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_states" ADD CONSTRAINT "review_states_drill_id_drills_id_fk" FOREIGN KEY ("drill_id") REFERENCES "public"."drills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentence_chunk_links" ADD CONSTRAINT "sentence_chunk_links_sentence_id_sentences_id_fk" FOREIGN KEY ("sentence_id") REFERENCES "public"."sentences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentence_chunk_links" ADD CONSTRAINT "sentence_chunk_links_chunk_item_id_learning_items_id_fk" FOREIGN KEY ("chunk_item_id") REFERENCES "public"."learning_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentence_grammar_links" ADD CONSTRAINT "sentence_grammar_links_sentence_id_sentences_id_fk" FOREIGN KEY ("sentence_id") REFERENCES "public"."sentences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentence_grammar_links" ADD CONSTRAINT "sentence_grammar_links_grammar_item_id_learning_items_id_fk" FOREIGN KEY ("grammar_item_id") REFERENCES "public"."learning_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentence_item_links" ADD CONSTRAINT "sentence_item_links_sentence_id_sentences_id_fk" FOREIGN KEY ("sentence_id") REFERENCES "public"."sentences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentence_item_links" ADD CONSTRAINT "sentence_item_links_learning_item_id_learning_items_id_fk" FOREIGN KEY ("learning_item_id") REFERENCES "public"."learning_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentence_review_attempts" ADD CONSTRAINT "sentence_review_attempts_review_state_id_review_states_id_fk" FOREIGN KEY ("review_state_id") REFERENCES "public"."review_states"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentence_review_attempts" ADD CONSTRAINT "sentence_review_attempts_drill_id_drills_id_fk" FOREIGN KEY ("drill_id") REFERENCES "public"."drills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentence_tokens" ADD CONSTRAINT "sentence_tokens_sentence_id_sentences_id_fk" FOREIGN KEY ("sentence_id") REFERENCES "public"."sentences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentence_tokens" ADD CONSTRAINT "sentence_tokens_learning_item_id_learning_items_id_fk" FOREIGN KEY ("learning_item_id") REFERENCES "public"."learning_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentence_vocabulary_links" ADD CONSTRAINT "sentence_vocabulary_links_sentence_id_sentences_id_fk" FOREIGN KEY ("sentence_id") REFERENCES "public"."sentences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentence_vocabulary_links" ADD CONSTRAINT "sentence_vocabulary_links_vocabulary_item_id_learning_items_id_fk" FOREIGN KEY ("vocabulary_item_id") REFERENCES "public"."learning_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sentences" ADD CONSTRAINT "sentences_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "drills_sentence_type_idx" ON "drills" USING btree ("sentence_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drills_sentence_idx" ON "drills" USING btree ("sentence_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "learning_items_type_canonical_idx" ON "learning_items" USING btree ("type","canonical_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_items_language_type_idx" ON "learning_items" USING btree ("language","type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_sentences_lesson_sentence_idx" ON "lesson_sentences" USING btree ("lesson_id","sentence_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_sentences_lesson_position_idx" ON "lesson_sentences" USING btree ("lesson_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lessons_source_idx" ON "lessons" USING btree ("source_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lessons_title_idx" ON "lessons" USING btree ("title");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "review_states_drill_idx" ON "review_states" USING btree ("drill_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_states_due_idx" ON "review_states" USING btree ("next_review_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sentence_chunk_links_unique_idx" ON "sentence_chunk_links" USING btree ("sentence_id","chunk_item_id","surface_text");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sentence_chunk_links_sentence_idx" ON "sentence_chunk_links" USING btree ("sentence_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sentence_chunk_links_item_idx" ON "sentence_chunk_links" USING btree ("chunk_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sentence_grammar_links_unique_idx" ON "sentence_grammar_links" USING btree ("sentence_id","grammar_item_id","surface_text");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sentence_grammar_links_sentence_idx" ON "sentence_grammar_links" USING btree ("sentence_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sentence_grammar_links_item_idx" ON "sentence_grammar_links" USING btree ("grammar_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sentence_item_links_unique_idx" ON "sentence_item_links" USING btree ("sentence_id","learning_item_id","role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sentence_item_links_item_idx" ON "sentence_item_links" USING btree ("learning_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sentence_review_attempts_state_idx" ON "sentence_review_attempts" USING btree ("review_state_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sentence_review_attempts_drill_idx" ON "sentence_review_attempts" USING btree ("drill_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sentence_tokens_sentence_position_idx" ON "sentence_tokens" USING btree ("sentence_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sentence_vocabulary_links_unique_idx" ON "sentence_vocabulary_links" USING btree ("sentence_id","vocabulary_item_id","surface_text");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sentence_vocabulary_links_sentence_idx" ON "sentence_vocabulary_links" USING btree ("sentence_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sentence_vocabulary_links_item_idx" ON "sentence_vocabulary_links" USING btree ("vocabulary_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sentences_language_normalized_idx" ON "sentences" USING btree ("language","normalized_text");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sentences_lesson_idx" ON "sentences" USING btree ("lesson_id");