import { asc, desc, eq, inArray } from "drizzle-orm";
import {
  lessonSentences,
  learningItems,
  lessons,
  sentenceChunkLinks,
  sentenceGrammarLinks,
  sentenceVocabularyLinks,
  sentences
} from "@/db/schema";
import { db } from "@/lib/server/db";

export interface ImportedLessonSentence {
  id: string;
  text: string;
  translation: string;
  words: Array<{ surface: string; meaning?: string | null; explanation?: string | null; canonicalKey?: string | null }>;
  grammar: Array<{ surfaceText: string; pattern: string; meaning?: string | null; explanation?: string | null }>;
  chunks: Array<{ surfaceText: string; meaning?: string | null; explanation?: string | null; type?: string | null }>;
}

export interface ImportedLessonContent {
  lesson: {
    id: string;
    language: string;
    baseLanguage: string;
    title: string;
    description?: string | null;
    level?: string | null;
    tags: string[];
  };
  sentences: ImportedLessonSentence[];
}

export async function getLatestImportedLessonContent(): Promise<ImportedLessonContent | null> {
  const [lesson] = await db
    .select({
      id: lessons.id,
      language: lessons.targetLanguage,
      baseLanguage: lessons.baseLanguage,
      title: lessons.title,
      description: lessons.description,
      level: lessons.level,
      tags: lessons.tags
    })
    .from(lessons)
    .orderBy(desc(lessons.importedAt))
    .limit(1);

  if (!lesson) return null;

  const lessonSentenceRows = await db
    .select({
      sentenceId: lessonSentences.sentenceId,
      text: sentences.text,
      translation: sentences.translation
    })
    .from(lessonSentences)
    .innerJoin(sentences, eq(lessonSentences.sentenceId, sentences.id))
    .where(eq(lessonSentences.lessonId, lesson.id))
    .orderBy(asc(lessonSentences.position));

  const sentenceIds = lessonSentenceRows.map((row) => row.sentenceId);
  if (!sentenceIds.length) {
    return { lesson, sentences: [] };
  }

  const [vocabularyLinks, grammarLinks, chunkLinks] = await Promise.all([
    db
      .select({
        sentenceId: sentenceVocabularyLinks.sentenceId,
        surfaceText: sentenceVocabularyLinks.surfaceText,
        meaning: learningItems.meaning,
        explanation: learningItems.explanation,
        canonicalKey: learningItems.canonicalKey
      })
      .from(sentenceVocabularyLinks)
      .innerJoin(learningItems, eq(sentenceVocabularyLinks.vocabularyItemId, learningItems.id))
      .where(inArray(sentenceVocabularyLinks.sentenceId, sentenceIds)),
    db
      .select({
        sentenceId: sentenceGrammarLinks.sentenceId,
        surfaceText: sentenceGrammarLinks.surfaceText,
        pattern: learningItems.displayText,
        meaning: learningItems.meaning,
        explanation: learningItems.explanation
      })
      .from(sentenceGrammarLinks)
      .innerJoin(learningItems, eq(sentenceGrammarLinks.grammarItemId, learningItems.id))
      .where(inArray(sentenceGrammarLinks.sentenceId, sentenceIds)),
    db
      .select({
        sentenceId: sentenceChunkLinks.sentenceId,
        surfaceText: sentenceChunkLinks.surfaceText,
        meaning: learningItems.meaning,
        explanation: learningItems.explanation,
        type: learningItems.type
      })
      .from(sentenceChunkLinks)
      .innerJoin(learningItems, eq(sentenceChunkLinks.chunkItemId, learningItems.id))
      .where(inArray(sentenceChunkLinks.sentenceId, sentenceIds))
  ]);

  const wordsBySentence = groupBySentence(vocabularyLinks);
  const grammarBySentence = groupBySentence(grammarLinks);
  const chunksBySentence = groupBySentence(chunkLinks);

  return {
    lesson,
    sentences: lessonSentenceRows.map((row) => ({
      id: row.sentenceId,
      text: row.text,
      translation: row.translation,
      words: (wordsBySentence.get(row.sentenceId) ?? []).map((word) => ({
        surface: word.surfaceText,
        meaning: word.meaning,
        explanation: word.explanation,
        canonicalKey: word.canonicalKey
      })),
      grammar: (grammarBySentence.get(row.sentenceId) ?? []).map((grammar) => ({
        surfaceText: grammar.surfaceText,
        pattern: grammar.pattern,
        meaning: grammar.meaning,
        explanation: grammar.explanation
      })),
      chunks: (chunksBySentence.get(row.sentenceId) ?? []).map((chunk) => ({
        surfaceText: chunk.surfaceText,
        meaning: chunk.meaning,
        explanation: chunk.explanation,
        type: chunk.type
      }))
    }))
  };
}

function groupBySentence<T extends { sentenceId: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const items = grouped.get(row.sentenceId) ?? [];
    items.push(row);
    grouped.set(row.sentenceId, items);
  }
  return grouped;
}
