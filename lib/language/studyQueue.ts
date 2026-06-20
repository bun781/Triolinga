import { asc, eq, lte } from "drizzle-orm";
import {
  drills,
  learningItems,
  reviewStates,
  sentenceTokens,
  sentences
} from "@/db/schema";
import { getDb, db } from "@/lib/server/db";

export async function getNextSentenceForgeItem() {
  await getDb();
  const [next] = await db
    .select({
      reviewStateId: reviewStates.id,
      drillId: drills.id,
      drillType: drills.type,
      prompt: drills.prompt,
      answer: drills.answer,
      payload: drills.payload,
      sentenceId: sentences.id,
      sentenceText: sentences.text,
      translation: sentences.translation,
      focusDisplayText: sentences.focusDisplayText,
      focusMeaning: sentences.focusMeaning,
      focusExplanation: sentences.focusExplanation,
      itemId: learningItems.id,
      itemCanonicalKey: learningItems.canonicalKey,
      itemDisplayText: learningItems.displayText
    })
    .from(reviewStates)
    .innerJoin(drills, eq(reviewStates.drillId, drills.id))
    .innerJoin(sentences, eq(drills.sentenceId, sentences.id))
    .leftJoin(learningItems, eq(drills.learningItemId, learningItems.id))
    .where(lte(reviewStates.nextReviewAt, new Date()))
    .orderBy(asc(reviewStates.nextReviewAt))
    .limit(1);

  if (!next) return null;

  const tokens = await db
    .select({
      id: sentenceTokens.id,
      text: sentenceTokens.text,
      position: sentenceTokens.position,
      meaning: sentenceTokens.meaning,
      explanation: sentenceTokens.explanation,
      commonMistakes: sentenceTokens.commonMistakes,
      canonicalKey: sentenceTokens.canonicalKey,
      learningItemId: sentenceTokens.learningItemId
    })
    .from(sentenceTokens)
    .where(eq(sentenceTokens.sentenceId, next.sentenceId))
    .orderBy(asc(sentenceTokens.position));

  return { ...next, tokens };
}
