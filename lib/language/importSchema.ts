import { z } from "zod";
import type { ImportValidationResult } from "@/lib/language/types";
import { normalizeCanonicalText } from "@/lib/language/normalize";

const lessonWordSchema = z.object({
  surface: z.string().trim().min(1),
  lemma: z.string().trim().min(1).optional(),
  meaning: z.string().trim().min(1).optional(),
  role: z.string().trim().min(1).optional(),
  explanation: z.string().trim().min(1).optional()
}).strict();

const lessonGrammarSchema = z.object({
  pattern: z.string().trim().min(1),
  surface: z.string().trim().min(1).optional(),
  meaning: z.string().trim().min(1).optional(),
  explanation: z.string().trim().min(1).optional()
}).strict();

const lessonChunkSchema = z.object({
  surface: z.string().trim().min(1),
  meaning: z.string().trim().min(1).optional(),
  explanation: z.string().trim().min(1).optional(),
  type: z.string().trim().min(1).optional(),
  level: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).optional()
}).strict();

const lessonSentenceSchema = z.object({
  text: z.string().trim().min(1),
  translation: z.string().trim().min(1).optional(),
  words: z.array(lessonWordSchema).optional(),
  grammar: z.array(lessonGrammarSchema).optional(),
  chunks: z.array(lessonChunkSchema).optional()
}).strict();

const lessonImportSchema = z.object({
  language: z.string().trim().min(1),
  baseLanguage: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  source: z.string().trim().optional(),
  level: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  sentences: z.array(lessonSentenceSchema).min(1)
}).strict();

export function parseLessonJson(source: string): ImportValidationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch {
    return { errors: ["Invalid JSON."] };
  }

  const result = lessonImportSchema.safeParse(parsed);
  if (!result.success) {
    return { errors: result.error.issues.map((issue) => issue.message) };
  }

  const errors: string[] = [];
  const sentenceTexts = new Set<string>();

  for (const [sentenceIndex, sentence] of result.data.sentences.entries()) {
    const normalizedSentence = normalizeCanonicalText(sentence.text);
    if (sentenceTexts.has(normalizedSentence)) {
      errors.push(`Duplicate sentence text at sentence ${sentenceIndex + 1}.`);
    } else {
      sentenceTexts.add(normalizedSentence);
    }

    for (const word of sentence.words ?? []) {
      if (!containsSurface(sentence.text, word.surface)) {
        errors.push(`Sentence ${sentenceIndex + 1}: word surface "${word.surface}" does not appear in the sentence.`);
      }
    }

    for (const grammar of sentence.grammar ?? []) {
      if (grammar.surface && !containsSurface(sentence.text, grammar.surface)) {
        errors.push(`Sentence ${sentenceIndex + 1}: grammar surface "${grammar.surface}" does not appear in the sentence.`);
      }
    }

    for (const chunk of sentence.chunks ?? []) {
      if (!containsSurface(sentence.text, chunk.surface)) {
        errors.push(`Sentence ${sentenceIndex + 1}: chunk surface "${chunk.surface}" does not appear in the sentence.`);
      }
    }
  }

  if (errors.length) {
    return { errors };
  }

  return { lesson: result.data, errors: [] };
}

function containsSurface(sentenceText: string, surface: string): boolean {
  return normalizeCanonicalText(sentenceText).includes(normalizeCanonicalText(surface));
}

