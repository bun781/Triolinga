import { inArray, eq, and } from "drizzle-orm";
import {
  lessonSentences,
  learningItems,
  lessons,
  sentenceChunkLinks,
  sentenceGrammarLinks,
  sentenceVocabularyLinks,
  sentences
} from "@/db/schema";
import { getDb, db } from "@/lib/server/db";
import { buildCanonicalKey, hashLessonSource, normalizeSentenceText } from "@/lib/language/normalize";
import type {
  LessonImportInput,
  LessonImportPreviewItem,
  LessonImportPreviewResult,
  LessonImportSummary,
  LessonSentenceInput
} from "@/lib/language/types";

interface ExistingLessonItem {
  id: string;
  canonicalKey: string;
  type: "word" | "grammar" | "chunk";
  displayText: string;
  meaning: string | null;
  explanation: string | null;
}

interface ExistingSentence {
  id: string;
  normalizedText: string;
}

interface CandidateItem {
  canonicalKey: string;
  type: "word" | "grammar" | "chunk";
  displayText: string;
  meaning?: string;
  explanation?: string;
}

interface ImportPlan {
  sourceHash: string;
  duplicateImport: boolean;
  validationErrors: string[];
  lessonPreview: LessonImportPreviewResult["lesson"];
  sentencePreviews: LessonImportPreviewResult["sentences"];
  vocabulary: LessonImportPreviewItem[];
  grammar: LessonImportPreviewItem[];
  chunks: LessonImportPreviewItem[];
  candidateItems: CandidateItem[];
  existingItemsByKey: Map<string, ExistingLessonItem>;
  existingSentencesByText: Map<string, ExistingSentence>;
}

export async function buildImportPreview(lesson: LessonImportInput): Promise<LessonImportPreviewResult> {
  const plan = await buildImportPlan(lesson);
  return {
    lesson: plan.lessonPreview,
    sentenceCount: plan.sentencePreviews.length,
    duplicateImport: plan.duplicateImport,
    validationErrors: plan.validationErrors,
    sentences: plan.sentencePreviews,
    vocabulary: plan.vocabulary,
    grammar: plan.grammar,
    chunks: plan.chunks
  };
}

export async function importApprovedLesson(lesson: LessonImportInput): Promise<LessonImportSummary> {
  await getDb();
  const sourceHash = hashLessonSource(lesson);
  const [duplicateLesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.sourceHash, sourceHash))
    .limit(1);

  if (duplicateLesson) {
    return {
      lessonCreated: false,
      lessonUpdated: false,
      sentencesImported: 0,
      sentencesSkipped: 0,
      vocabularyCreated: 0,
      vocabularyReused: 0,
      grammarCreated: 0,
      grammarReused: 0,
      chunksCreated: 0,
      chunksReused: 0,
      linksCreated: 0,
      errors: []
    };
  }

  const plan = await buildImportPlan(lesson);

  if (plan.duplicateImport) {
    return {
      lessonCreated: false,
      lessonUpdated: false,
      sentencesImported: 0,
      sentencesSkipped: 0,
      vocabularyCreated: 0,
      vocabularyReused: 0,
      grammarCreated: 0,
      grammarReused: 0,
      chunksCreated: 0,
      chunksReused: 0,
      linksCreated: 0,
      errors: ["This lesson has already been imported."]
    };
  }

  if (plan.validationErrors.length) {
    return {
      lessonCreated: false,
      lessonUpdated: false,
      sentencesImported: 0,
      sentencesSkipped: 0,
      vocabularyCreated: 0,
      vocabularyReused: 0,
      grammarCreated: 0,
      grammarReused: 0,
      chunksCreated: 0,
      chunksReused: 0,
      linksCreated: 0,
      errors: plan.validationErrors
    };
  }

  return db.transaction(async (tx) => {
    const [lessonRow] = await tx.insert(lessons).values({
      targetLanguage: lesson.language,
      baseLanguage: lesson.baseLanguage,
      description: lesson.description,
      source: lesson.source,
      level: lesson.level,
      title: lesson.title,
      sourceHash,
      tags: lesson.tags ?? []
    }).returning({ id: lessons.id });

    let sentencesImported = 0;
    let sentencesSkipped = 0;

    const itemIdByKey = new Map<string, string>();
    let linksCreated = 0;

    const itemSummary = summarizeItemOccurrences(lesson, plan.existingItemsByKey);
    const vocabularyCreated = itemSummary.vocabularyCreated;
    const vocabularyReused = itemSummary.vocabularyReused;
    const grammarCreated = itemSummary.grammarCreated;
    const grammarReused = itemSummary.grammarReused;
    const chunksCreated = itemSummary.chunksCreated;
    const chunksReused = itemSummary.chunksReused;

    const existingItems = [...plan.existingItemsByKey.values()];
    for (const item of existingItems) {
      itemIdByKey.set(itemLookupKey(item), item.id);
    }

    const newItems = plan.candidateItems.filter((candidate) => !plan.existingItemsByKey.has(itemLookupKey(candidate)));
    if (newItems.length) {
      const insertedItems = await tx.insert(learningItems).values(newItems.map((candidate) => ({
        language: lesson.language,
        type: candidate.type,
        canonicalKey: candidate.canonicalKey,
        displayText: candidate.displayText,
        meaning: candidate.meaning,
        explanation: candidate.explanation,
        commonMistakes: []
      }))).returning({
        id: learningItems.id,
        canonicalKey: learningItems.canonicalKey,
        type: learningItems.type
      });

      for (const item of insertedItems) {
        itemIdByKey.set(itemLookupKey(item), item.id);
      }
    }

    for (const candidate of plan.candidateItems) {
      const existing = plan.existingItemsByKey.get(itemLookupKey(candidate));
      if (existing) {
        itemIdByKey.set(itemLookupKey(candidate), existing.id);
        const patch: { meaning?: string | null; explanation?: string | null } = {};
        if (!existing.meaning && candidate.meaning) patch.meaning = candidate.meaning;
        if (!existing.explanation && candidate.explanation) patch.explanation = candidate.explanation;
        if (Object.keys(patch).length) {
          await tx.update(learningItems).set(patch).where(eq(learningItems.id, existing.id));
        }
      }
    }

    for (const [index, sentence] of lesson.sentences.entries()) {
      const normalizedText = normalizeSentenceText(sentence.text);
      const existingSentence = plan.existingSentencesByText.get(normalizedText);
      let sentenceId: string;

      if (existingSentence) {
        sentenceId = existingSentence.id;
        sentencesSkipped += 1;
      } else {
        const [insertedSentence] = await tx.insert(sentences).values({
          lessonId: lessonRow.id,
          language: lesson.language,
          text: sentence.text,
          normalizedText,
          translation: sentence.translation ?? "",
          reviewState: "unknown",
          reviewStreak: 0,
          reviewedAt: null
        }).returning({ id: sentences.id });
        sentenceId = insertedSentence.id;
        sentencesImported += 1;
      }

      const [lessonSentenceRow] = await tx.insert(lessonSentences).values({
        lessonId: lessonRow.id,
        sentenceId,
        position: index
      }).returning({ id: lessonSentences.id });
      if (lessonSentenceRow) {
        linksCreated += 1;
      }

      const sentenceLinksCreated = await createSentenceItemLinks({
        tx,
        language: lesson.language,
        sentenceId,
        sentence,
        itemIdByKey
      });
      linksCreated += sentenceLinksCreated;
    }

    return {
      lessonCreated: Boolean(lessonRow?.id),
      lessonUpdated: false,
      sentencesImported,
      sentencesSkipped,
      vocabularyCreated,
      vocabularyReused,
      grammarCreated,
      grammarReused,
      chunksCreated,
      chunksReused,
      linksCreated,
      errors: []
    };
  });
}

async function buildImportPlan(lesson: LessonImportInput): Promise<ImportPlan> {
  await getDb();
  const sourceHash = hashLessonSource(lesson);
  const [duplicateImport] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.sourceHash, sourceHash))
    .limit(1);

  const normalizedTexts = lesson.sentences.map((sentence) => normalizeSentenceText(sentence.text));
  const existingSentences = normalizedTexts.length
    ? await db
      .select({ id: sentences.id, normalizedText: sentences.normalizedText })
      .from(sentences)
      .where(and(
        eq(sentences.language, lesson.language),
        inArray(sentences.normalizedText, normalizedTexts)
      ))
    : [];

  const candidateItems = collectCandidates(lesson);
  const canonicalKeys = candidateItems.map((candidate) => candidate.canonicalKey);
  const existingItems = canonicalKeys.length
    ? await db
      .select({
        id: learningItems.id,
        canonicalKey: learningItems.canonicalKey,
        type: learningItems.type,
        displayText: learningItems.displayText,
        meaning: learningItems.meaning,
        explanation: learningItems.explanation
      })
      .from(learningItems)
      .where(inArray(learningItems.canonicalKey, canonicalKeys))
    : [];

  const existingItemsByKey = new Map(existingItems.map((item) => [itemLookupKey(item), item]));
  const existingSentencesByText = new Map(existingSentences.map((sentence) => [sentence.normalizedText, sentence]));

  return {
    sourceHash,
    duplicateImport: Boolean(duplicateImport),
    validationErrors: [],
    lessonPreview: {
      language: lesson.language,
      baseLanguage: lesson.baseLanguage,
      title: lesson.title,
      description: lesson.description,
      source: lesson.source,
      level: lesson.level,
      tags: lesson.tags ?? []
    },
    sentencePreviews: lesson.sentences.map((sentence, index) => ({
      index,
      text: sentence.text,
      translation: sentence.translation ?? "",
      duplicateSentence: existingSentencesByText.has(normalizeSentenceText(sentence.text)),
      words: sentence.words ?? [],
      grammar: sentence.grammar ?? [],
      chunks: sentence.chunks ?? []
    })),
    vocabulary: toPreviewItems(candidateItems.filter((item) => item.type === "word"), existingItemsByKey),
    grammar: toPreviewItems(candidateItems.filter((item) => item.type === "grammar"), existingItemsByKey),
    chunks: toPreviewItems(candidateItems.filter((item) => item.type === "chunk"), existingItemsByKey),
    candidateItems,
    existingItemsByKey,
    existingSentencesByText
  };
}

function collectCandidates(lesson: LessonImportInput): CandidateItem[] {
  const items = new Map<string, CandidateItem>();

  for (const sentence of lesson.sentences) {
    for (const word of sentence.words ?? []) {
      upsertCandidate(items, {
        canonicalKey: buildCanonicalKey(lesson.language, word.lemma ?? word.surface),
        type: "word",
        displayText: word.lemma ?? word.surface,
        meaning: word.meaning,
        explanation: word.explanation
      });
    }

    for (const grammar of sentence.grammar ?? []) {
      upsertCandidate(items, {
        canonicalKey: buildCanonicalKey(lesson.language, grammar.pattern),
        type: "grammar",
        displayText: grammar.pattern,
        meaning: grammar.meaning,
        explanation: grammar.explanation
      });
    }

    for (const chunk of sentence.chunks ?? []) {
      upsertCandidate(items, {
        canonicalKey: buildCanonicalKey(lesson.language, chunk.surface),
        type: "chunk",
        displayText: chunk.surface,
        meaning: chunk.meaning,
        explanation: chunk.explanation
      });
    }
  }

  return [...items.values()];
}

function upsertCandidate(items: Map<string, CandidateItem>, candidate: CandidateItem): void {
  const key = itemLookupKey(candidate);
  const existing = items.get(key);
  if (!existing) {
    items.set(key, candidate);
    return;
  }

  items.set(key, {
    ...existing,
    meaning: existing.meaning ?? candidate.meaning,
    explanation: existing.explanation ?? candidate.explanation
  });
}

function toPreviewItems(items: CandidateItem[], existingItemsByKey: Map<string, ExistingLessonItem>): LessonImportPreviewItem[] {
  return items.map((candidate) => ({
    canonicalKey: candidate.canonicalKey,
    type: candidate.type,
    displayText: candidate.displayText,
    meaning: candidate.meaning,
    explanation: candidate.explanation,
    status: existingItemsByKey.has(itemLookupKey(candidate)) ? "existing" : "new"
  }));
}

function summarizeItemOccurrences(
  lesson: LessonImportInput,
  existingItemsByKey: Map<string, ExistingLessonItem>
): {
  vocabularyCreated: number;
  vocabularyReused: number;
  grammarCreated: number;
  grammarReused: number;
  chunksCreated: number;
  chunksReused: number;
} {
  const seen = new Set<string>();
  let vocabularyCreated = 0;
  let vocabularyReused = 0;
  let grammarCreated = 0;
  let grammarReused = 0;
  let chunksCreated = 0;
  let chunksReused = 0;

  for (const sentence of lesson.sentences) {
    for (const word of sentence.words ?? []) {
      const key = buildCanonicalKey(lesson.language, word.lemma ?? word.surface);
      const lookupKey = itemLookupKey({ type: "word", canonicalKey: key });
      if (existingItemsByKey.has(lookupKey) || seen.has(lookupKey)) {
        vocabularyReused += 1;
      } else {
        vocabularyCreated += 1;
        seen.add(lookupKey);
      }
    }

    for (const grammar of sentence.grammar ?? []) {
      const key = buildCanonicalKey(lesson.language, grammar.pattern);
      const lookupKey = itemLookupKey({ type: "grammar", canonicalKey: key });
      if (existingItemsByKey.has(lookupKey) || seen.has(lookupKey)) {
        grammarReused += 1;
      } else {
        grammarCreated += 1;
        seen.add(lookupKey);
      }
    }

    for (const chunk of sentence.chunks ?? []) {
      const key = buildCanonicalKey(lesson.language, chunk.surface);
      const lookupKey = itemLookupKey({ type: "chunk", canonicalKey: key });
      if (existingItemsByKey.has(lookupKey) || seen.has(lookupKey)) {
        chunksReused += 1;
      } else {
        chunksCreated += 1;
        seen.add(lookupKey);
      }
    }
  }

  return {
    vocabularyCreated,
    vocabularyReused,
    grammarCreated,
    grammarReused,
    chunksCreated,
    chunksReused
  };
}

async function createSentenceItemLinks({
  tx,
  language,
  sentenceId,
  sentence,
  itemIdByKey
}: {
  tx: typeof db;
  language: string;
  sentenceId: string;
  sentence: LessonSentenceInput;
  itemIdByKey: Map<string, string>;
}): Promise<number> {
  const seen = new Set<string>();
  let inserted = 0;

  for (const word of sentence.words ?? []) {
    const key = buildCanonicalKey(language, word.lemma ?? word.surface);
    const itemId = itemIdByKey.get(itemLookupKey({ type: "word", canonicalKey: key }));
    if (!itemId || seen.has(`word:${itemId}:${word.surface}`)) continue;
    seen.add(`word:${itemId}:${word.surface}`);
    const [row] = await tx.insert(sentenceVocabularyLinks).values({
      sentenceId,
      vocabularyItemId: itemId,
      surfaceText: word.surface
    }).onConflictDoNothing().returning({ id: sentenceVocabularyLinks.id });
    if (row) inserted += 1;
  }

  for (const grammar of sentence.grammar ?? []) {
    const key = buildCanonicalKey(language, grammar.pattern);
    const itemId = itemIdByKey.get(itemLookupKey({ type: "grammar", canonicalKey: key }));
    const surfaceText = grammar.surface ?? grammar.pattern;
    if (!itemId || seen.has(`grammar:${itemId}:${surfaceText}`)) continue;
    seen.add(`grammar:${itemId}:${surfaceText}`);
    const [row] = await tx.insert(sentenceGrammarLinks).values({
      sentenceId,
      grammarItemId: itemId,
      surfaceText
    }).onConflictDoNothing().returning({ id: sentenceGrammarLinks.id });
    if (row) inserted += 1;
  }

  for (const chunk of sentence.chunks ?? []) {
    const key = buildCanonicalKey(language, chunk.surface);
    const itemId = itemIdByKey.get(itemLookupKey({ type: "chunk", canonicalKey: key }));
    if (!itemId || seen.has(`chunk:${itemId}:${chunk.surface}`)) continue;
    seen.add(`chunk:${itemId}:${chunk.surface}`);
    const [row] = await tx.insert(sentenceChunkLinks).values({
      sentenceId,
      chunkItemId: itemId,
      surfaceText: chunk.surface
    }).onConflictDoNothing().returning({ id: sentenceChunkLinks.id });
    if (row) inserted += 1;
  }

  return inserted;
}

function itemLookupKey(item: Pick<CandidateItem, "type" | "canonicalKey">): string {
  return `${item.type}:${item.canonicalKey}`;
}
