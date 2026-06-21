import { eq, asc } from "drizzle-orm";
import { sentences } from "@/db/schema";
import { db, getDb } from "@/lib/server/db";
import type { ReviewDecision, ReviewSentence } from "./types";
import { applyReviewDecision } from "./algorithm";

export async function getReviewSentences(): Promise<ReviewSentence[]> {
  await getDb();
  const rows = await db
    .select({
      id: sentences.id,
      language: sentences.language,
      text: sentences.text,
      translation: sentences.translation,
      reviewState: sentences.reviewState,
      reviewStreak: sentences.reviewStreak,
      reviewedAt: sentences.reviewedAt
    })
    .from(sentences)
    .orderBy(asc(sentences.text));

  return rows.map((row) => ({
    id: row.id,
    language: row.language,
    text: row.text,
    translation: row.translation,
    reviewState: row.reviewState,
    reviewStreak: row.reviewStreak,
    reviewedAt: row.reviewedAt?.toISOString() ?? null
  }));
}

export async function updateReviewSentenceState(
  sentenceId: string,
  decision: ReviewDecision
): Promise<ReviewSentence | null> {
  await getDb();
  const [current] = await db
    .select({
      id: sentences.id,
      language: sentences.language,
      text: sentences.text,
      translation: sentences.translation,
      reviewState: sentences.reviewState,
      reviewStreak: sentences.reviewStreak,
      reviewedAt: sentences.reviewedAt
    })
    .from(sentences)
    .where(eq(sentences.id, sentenceId))
    .limit(1);

  if (!current) return null;

  const updated = applyReviewDecision(
    {
      ...current,
      reviewedAt: current.reviewedAt?.toISOString() ?? null
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

  return updated;
}
