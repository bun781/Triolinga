import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const reviewRatingEnum = pgEnum("review_rating", ["easy", "correct", "hard", "failed"]);
export const learningItemTypeEnum = pgEnum("learning_item_type", ["word", "grammar", "chunk"]);
export const sentenceDrillTypeEnum = pgEnum("sentence_drill_type", [
  "recall",
  "reconstruction",
  "cloze",
  "transformation",
  "original_sentence"
]);

const idColumn = () => uuid("id").defaultRandom().primaryKey();
const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const lessons = pgTable("lessons", {
  id: idColumn(),
  targetLanguage: text("target_language").notNull(),
  baseLanguage: text("base_language").notNull(),
  description: text("description"),
  source: text("source"),
  level: text("level"),
  title: text("title").notNull(),
  sourceHash: text("source_hash").notNull(),
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps()
}, (table) => ({
  sourceIdx: uniqueIndex("lessons_source_idx").on(table.sourceHash),
  titleIdx: index("lessons_title_idx").on(table.title)
}));

export const learningItems = pgTable("learning_items", {
  id: idColumn(),
  language: text("language").notNull(),
  type: learningItemTypeEnum("type").notNull(),
  canonicalKey: text("canonical_key").notNull(),
  displayText: text("display_text").notNull(),
  meaning: text("meaning"),
  explanation: text("explanation"),
  commonMistakes: jsonb("common_mistakes").$type<string[]>().default([]).notNull(),
  ...timestamps()
}, (table) => ({
  canonicalIdx: uniqueIndex("learning_items_canonical_idx").on(table.canonicalKey),
  languageTypeIdx: index("learning_items_language_type_idx").on(table.language, table.type)
}));

export const sentences = pgTable("sentences", {
  id: idColumn(),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  text: text("text").notNull(),
  normalizedText: text("normalized_text").notNull(),
  translation: text("translation").notNull(),
  focusCanonicalKey: text("focus_canonical_key"),
  focusDisplayText: text("focus_display_text"),
  focusMeaning: text("focus_meaning"),
  focusExplanation: text("focus_explanation"),
  ...timestamps()
}, (table) => ({
  duplicateIdx: uniqueIndex("sentences_language_normalized_idx").on(table.language, table.normalizedText),
  lessonIdx: index("sentences_lesson_idx").on(table.lessonId)
}));

export const lessonSentences = pgTable("lesson_sentences", {
  id: idColumn(),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  sentenceId: uuid("sentence_id").notNull().references(() => sentences.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  ...timestamps()
}, (table) => ({
  lessonSentenceIdx: uniqueIndex("lesson_sentences_lesson_sentence_idx").on(table.lessonId, table.sentenceId),
  lessonPositionIdx: uniqueIndex("lesson_sentences_lesson_position_idx").on(table.lessonId, table.position)
}));

export const sentenceVocabularyLinks = pgTable("sentence_vocabulary_links", {
  id: idColumn(),
  sentenceId: uuid("sentence_id").notNull().references(() => sentences.id, { onDelete: "cascade" }),
  vocabularyItemId: uuid("vocabulary_item_id").notNull().references(() => learningItems.id, { onDelete: "cascade" }),
  surfaceText: text("surface_text").notNull(),
  ...timestamps()
}, (table) => ({
  uniqueLinkIdx: uniqueIndex("sentence_vocabulary_links_unique_idx").on(table.sentenceId, table.vocabularyItemId, table.surfaceText),
  sentenceIdx: index("sentence_vocabulary_links_sentence_idx").on(table.sentenceId),
  itemIdx: index("sentence_vocabulary_links_item_idx").on(table.vocabularyItemId)
}));

export const sentenceGrammarLinks = pgTable("sentence_grammar_links", {
  id: idColumn(),
  sentenceId: uuid("sentence_id").notNull().references(() => sentences.id, { onDelete: "cascade" }),
  grammarItemId: uuid("grammar_item_id").notNull().references(() => learningItems.id, { onDelete: "cascade" }),
  surfaceText: text("surface_text").notNull(),
  ...timestamps()
}, (table) => ({
  uniqueLinkIdx: uniqueIndex("sentence_grammar_links_unique_idx").on(table.sentenceId, table.grammarItemId, table.surfaceText),
  sentenceIdx: index("sentence_grammar_links_sentence_idx").on(table.sentenceId),
  itemIdx: index("sentence_grammar_links_item_idx").on(table.grammarItemId)
}));

export const sentenceChunkLinks = pgTable("sentence_chunk_links", {
  id: idColumn(),
  sentenceId: uuid("sentence_id").notNull().references(() => sentences.id, { onDelete: "cascade" }),
  chunkItemId: uuid("chunk_item_id").notNull().references(() => learningItems.id, { onDelete: "cascade" }),
  surfaceText: text("surface_text").notNull(),
  ...timestamps()
}, (table) => ({
  uniqueLinkIdx: uniqueIndex("sentence_chunk_links_unique_idx").on(table.sentenceId, table.chunkItemId, table.surfaceText),
  sentenceIdx: index("sentence_chunk_links_sentence_idx").on(table.sentenceId),
  itemIdx: index("sentence_chunk_links_item_idx").on(table.chunkItemId)
}));

export const sentenceTokens = pgTable("sentence_tokens", {
  id: idColumn(),
  sentenceId: uuid("sentence_id").notNull().references(() => sentences.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  text: text("text").notNull(),
  itemType: learningItemTypeEnum("item_type"),
  canonicalKey: text("canonical_key"),
  meaning: text("meaning"),
  explanation: text("explanation"),
  commonMistakes: jsonb("common_mistakes").$type<string[]>().default([]).notNull(),
  learningItemId: uuid("learning_item_id").references(() => learningItems.id, { onDelete: "set null" }),
  ...timestamps()
}, (table) => ({
  sentencePositionIdx: uniqueIndex("sentence_tokens_sentence_position_idx").on(table.sentenceId, table.position)
}));

export const sentenceItemLinks = pgTable("sentence_item_links", {
  id: idColumn(),
  sentenceId: uuid("sentence_id").notNull().references(() => sentences.id, { onDelete: "cascade" }),
  learningItemId: uuid("learning_item_id").notNull().references(() => learningItems.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  ...timestamps()
}, (table) => ({
  uniqueLinkIdx: uniqueIndex("sentence_item_links_unique_idx").on(table.sentenceId, table.learningItemId, table.role),
  itemIdx: index("sentence_item_links_item_idx").on(table.learningItemId)
}));

export const drills = pgTable("drills", {
  id: idColumn(),
  sentenceId: uuid("sentence_id").notNull().references(() => sentences.id, { onDelete: "cascade" }),
  learningItemId: uuid("learning_item_id").references(() => learningItems.id, { onDelete: "set null" }),
  type: sentenceDrillTypeEnum("type").notNull(),
  prompt: text("prompt").notNull(),
  answer: text("answer").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps()
}, (table) => ({
  sentenceTypeIdx: uniqueIndex("drills_sentence_type_idx").on(table.sentenceId, table.type),
  sentenceIdx: index("drills_sentence_idx").on(table.sentenceId)
}));

export const reviewStates = pgTable("review_states", {
  id: idColumn(),
  drillId: uuid("drill_id").notNull().references(() => drills.id, { onDelete: "cascade" }),
  reviewState: text("review_state").notNull().default("new"),
  nextReviewAt: timestamp("next_review_at", { withTimezone: true }).defaultNow().notNull(),
  intervalDays: integer("interval_days").default(0).notNull(),
  lastGrade: reviewRatingEnum("last_grade"),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  ...timestamps()
}, (table) => ({
  drillIdx: uniqueIndex("review_states_drill_idx").on(table.drillId),
  dueIdx: index("review_states_due_idx").on(table.nextReviewAt)
}));

export const sentenceReviewAttempts = pgTable("sentence_review_attempts", {
  id: idColumn(),
  reviewStateId: uuid("review_state_id").notNull().references(() => reviewStates.id, { onDelete: "cascade" }),
  drillId: uuid("drill_id").notNull().references(() => drills.id, { onDelete: "cascade" }),
  drillType: sentenceDrillTypeEnum("drill_type").notNull(),
  response: text("response"),
  grade: reviewRatingEnum("grade").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  stateIdx: index("sentence_review_attempts_state_idx").on(table.reviewStateId),
  drillIdx: index("sentence_review_attempts_drill_idx").on(table.drillId)
}));
