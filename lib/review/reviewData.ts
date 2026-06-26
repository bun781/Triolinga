// Source of truth for review DB reads and writes. All reviewItems table access goes through here.
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { learningItems, reviewItems, sentenceChunkLinks, sentenceGrammarLinks, sentences, sentenceVocabularyLinks } from "@/db/schema";
import { db, getDb } from "@/lib/server/db";
import type { ReviewDecision, ReviewResetScope, ReviewSentence } from "./types";
import { applyReviewDecision } from "./algorithm";

export async function getReviewSentences(): Promise<ReviewSentence[]> {
  await getDb();
  await ensureReviewItems();
  const rows = await db
    .select({
      id: sentences.id,
      sentenceId: sentences.id,
      lessonId: sentences.lessonId,
      importId: reviewItems.importId,
      language: sentences.language,
      text: sentences.text,
      translation: sentences.translation,
      reviewState: sentences.reviewState,
      reviewStreak: sentences.reviewStreak,
      reviewedAt: sentences.reviewedAt,
      dueAt: reviewItems.dueAt,
      lastReviewedAt: reviewItems.lastReviewedAt,
      repetitions: reviewItems.repetitions,
      lapses: reviewItems.lapses,
      difficulty: reviewItems.difficulty,
      stability: reviewItems.stability,
      recallMode: reviewItems.recallMode,
      focusText: sentences.focusDisplayText,
      focusMeaning: sentences.focusMeaning,
      focusExplanation: sentences.focusExplanation
    })
    .from(sentences)
    .innerJoin(reviewItems, eq(reviewItems.sentenceId, sentences.id))
    .orderBy(asc(reviewItems.dueAt), asc(sentences.text));

  return rows.map((row) => ({
    id: row.id,
    sentenceId: row.sentenceId,
    lessonId: row.lessonId,
    importId: row.importId,
    language: row.language,
    text: row.text,
    translation: row.translation,
    reviewState: row.reviewState,
    reviewStreak: row.reviewStreak,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    dueAt: row.dueAt.toISOString(),
    lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
    repetitions: row.repetitions,
    lapses: row.lapses,
    difficulty: row.difficulty,
    stability: row.stability,
    recallMode: row.recallMode as ReviewSentence["recallMode"],
    focusText: row.focusText,
    focusMeaning: row.focusMeaning,
    focusExplanation: row.focusExplanation
  }));
}

export async function updateReviewSentenceState(
  sentenceId: string,
  decision: ReviewDecision
): Promise<ReviewSentence | null> {
  await getDb();
  await ensureReviewItems();
  const [current] = await db
    .select({
      id: sentences.id,
      sentenceId: sentences.id,
      lessonId: sentences.lessonId,
      importId: reviewItems.importId,
      language: sentences.language,
      text: sentences.text,
      translation: sentences.translation,
      reviewState: sentences.reviewState,
      reviewStreak: sentences.reviewStreak,
      reviewedAt: sentences.reviewedAt,
      dueAt: reviewItems.dueAt,
      lastReviewedAt: reviewItems.lastReviewedAt,
      repetitions: reviewItems.repetitions,
      lapses: reviewItems.lapses,
      difficulty: reviewItems.difficulty,
      stability: reviewItems.stability,
      recallMode: reviewItems.recallMode,
      focusText: sentences.focusDisplayText,
      focusMeaning: sentences.focusMeaning,
      focusExplanation: sentences.focusExplanation
    })
    .from(sentences)
    .innerJoin(reviewItems, eq(reviewItems.sentenceId, sentences.id))
    .where(eq(sentences.id, sentenceId))
    .limit(1);

  if (!current) return null;

  const updated = applyReviewDecision(
    {
      ...current,
      reviewedAt: current.reviewedAt?.toISOString() ?? null,
      dueAt: current.dueAt.toISOString(),
      lastReviewedAt: current.lastReviewedAt?.toISOString() ?? null,
      recallMode: current.recallMode as ReviewSentence["recallMode"]
    },
    decision
  );

  await db
    .update(sentences)
    .set({
      reviewState: updated.reviewState,
      reviewStreak: updated.reviewStreak,
      reviewedAt: updated.reviewedAt ? new Date(updated.reviewedAt) : null
    })
    .where(eq(sentences.id, sentenceId));

  await db
    .update(reviewItems)
    .set({
      dueAt: updated.dueAt ? new Date(updated.dueAt) : new Date(),
      lastReviewedAt: updated.lastReviewedAt ? new Date(updated.lastReviewedAt) : null,
      repetitions: updated.repetitions ?? 0,
      lapses: updated.lapses ?? 0,
      difficulty: updated.difficulty ?? 0.3,
      stability: updated.stability ?? 0,
      recallMode: updated.recallMode ?? "full_support",
      updatedAt: new Date()
    })
    .where(eq(reviewItems.sentenceId, sentenceId));

  return updated;
}

export async function resetReviewSentenceProgress(scope: ReviewResetScope): Promise<void> {
  await getDb();
  await ensureReviewItems();
  const sentenceIds = await getResetSentenceIds(scope);
  if (!sentenceIds.length) return;

  await db
    .update(sentences)
    .set({
      reviewState: "unknown",
      reviewStreak: 0,
      reviewedAt: null,
      updatedAt: new Date()
    })
    .where(inArray(sentences.id, sentenceIds));

  await db
    .update(reviewItems)
    .set({
      dueAt: new Date(),
      lastReviewedAt: null,
      repetitions: 0,
      lapses: 0,
      difficulty: 0.3,
      stability: 0,
      recallMode: "full_support",
      updatedAt: new Date()
    })
    .where(inArray(reviewItems.sentenceId, sentenceIds));
}

async function getResetSentenceIds(scope: ReviewResetScope): Promise<string[]> {
  if (scope.type === "sentence") return [scope.sentenceId];
  if (scope.type === "lesson") {
    const rows = await db.select({ id: sentences.id }).from(sentences).where(eq(sentences.lessonId, scope.lessonId));
    return rows.map((row) => row.id);
  }

  const linkTable = scope.itemType === "word"
    ? sentenceVocabularyLinks
    : scope.itemType === "grammar"
      ? sentenceGrammarLinks
      : sentenceChunkLinks;
  const itemIdColumn = scope.itemType === "word"
    ? sentenceVocabularyLinks.vocabularyItemId
    : scope.itemType === "grammar"
      ? sentenceGrammarLinks.grammarItemId
      : sentenceChunkLinks.chunkItemId;
  const conditions = [
    eq(learningItems.type, scope.itemType),
    eq(learningItems.canonicalKey, scope.canonicalKey)
  ];
  if (scope.lessonId) conditions.push(eq(sentences.lessonId, scope.lessonId));

  const rows = await db
    .select({ id: sentences.id })
    .from(sentences)
    .innerJoin(linkTable, eq(linkTable.sentenceId, sentences.id))
    .innerJoin(learningItems, eq(learningItems.id, itemIdColumn))
    .where(and(...conditions));

  return [...new Set(rows.map((row) => row.id))];
}

async function ensureReviewItems() {
  await db.execute(sql`
    INSERT INTO review_items
    (sentence_id, lesson_id, import_id, due_at, last_reviewed_at, repetitions, lapses, difficulty, stability, recall_mode)
    SELECT id, lesson_id, lesson_id, COALESCE(reviewed_at, now()), reviewed_at, review_streak,
           CASE WHEN review_state = 'forgotten' THEN 1 ELSE 0 END,
           0.3, review_streak, 'full_support'
    FROM sentences
    ON CONFLICT ("sentence_id") DO NOTHING
  `);
}
