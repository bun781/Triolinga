import { z } from "zod";
import type { LessonImportInput } from "@/lib/language/types";

export const FYDOR_PACK_TYPE = "fydor_pack";
export const FYDOR_PACK_SCHEMA_VERSION = 1;

export interface FydorPackAuthor {
  name?: string;
  organization?: string;
  url?: string;
}

export interface FydorPack {
  type: typeof FYDOR_PACK_TYPE;
  schemaVersion: typeof FYDOR_PACK_SCHEMA_VERSION;
  id: string;
  title: string;
  description?: string;
  author?: FydorPackAuthor;
  version: string;
  license?: string;
  language: string;
  baseLanguage: string;
  level?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  lessons: LessonImportInput[];
}

export interface FydorPackValidation {
  pack?: FydorPack;
  errors: string[];
  warnings: string[];
  lessonErrors: Array<{ index: number; title: string; errors: string[] }>;
  lessonCount: number;
  sentenceCount: number;
}

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

const authorSchema = z.object({
  name: z.string().trim().optional(),
  organization: z.string().trim().optional(),
  url: z.string().trim().optional()
}).strict();

const packSchema = z.object({
  type: z.literal(FYDOR_PACK_TYPE),
  schemaVersion: z.literal(FYDOR_PACK_SCHEMA_VERSION),
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  author: authorSchema.optional(),
  version: z.string().trim().min(1),
  license: z.string().trim().optional(),
  language: z.string().trim().min(1),
  baseLanguage: z.string().trim().min(1),
  level: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  createdAt: z.string().trim().optional(),
  updatedAt: z.string().trim().optional(),
  lessons: z.array(z.unknown()).min(1)
}).strict();

export function parseFydorPack(source: string): FydorPackValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return emptyValidation(["This is not a readable Fydor Pack."]);
  }

  const packResult = packSchema.safeParse(parsed);
  if (!packResult.success) {
    return emptyValidation(packResult.error.issues.map((issue) => issue.message));
  }

  const lessonErrors: FydorPackValidation["lessonErrors"] = [];
  const lessons: LessonImportInput[] = [];
  const warnings: string[] = [];
  const seenLessonKeys = new Set<string>();

  for (const [index, rawLesson] of packResult.data.lessons.entries()) {
    const result = lessonImportSchema.safeParse(rawLesson);
    const title = getRawTitle(rawLesson, `Lesson ${index + 1}`);
    if (!result.success) {
      lessonErrors.push({
        index,
        title,
        errors: result.error.issues.map((issue) => issue.message)
      });
      continue;
    }

    const lesson = result.data;
    const lessonWarnings = validateLessonContents(lesson);
    if (lessonWarnings.length) {
      lessonErrors.push({ index, title: lesson.title, errors: lessonWarnings });
      continue;
    }

    if (lesson.language !== packResult.data.language || lesson.baseLanguage !== packResult.data.baseLanguage) {
      warnings.push(`${lesson.title} uses ${lesson.language} to ${lesson.baseLanguage}, which differs from the pack language.`);
    }

    const duplicateKey = lessonKey(lesson);
    if (seenLessonKeys.has(duplicateKey)) {
      warnings.push(`${lesson.title} appears more than once inside this pack.`);
    }
    seenLessonKeys.add(duplicateKey);
    lessons.push(lesson);
  }

  const now = new Date().toISOString();
  const pack: FydorPack = {
    ...packResult.data,
    createdAt: packResult.data.createdAt || now,
    updatedAt: packResult.data.updatedAt || now,
    lessons
  };

  return {
    pack,
    errors: lessonErrors.length ? ["One or more lessons in this pack need attention."] : [],
    warnings,
    lessonErrors,
    lessonCount: lessons.length,
    sentenceCount: countSentences(lessons)
  };
}

export function createFydorPack(input: {
  title: string;
  description?: string;
  author?: FydorPackAuthor;
  version: string;
  license?: string;
  tags?: string[];
  lessons: LessonImportInput[];
}): FydorPack {
  const now = new Date().toISOString();
  const firstLesson = input.lessons[0];
  return {
    type: FYDOR_PACK_TYPE,
    schemaVersion: FYDOR_PACK_SCHEMA_VERSION,
    id: stablePackId(input.title, input.author?.name, now),
    title: input.title.trim() || "Untitled Fydor Pack",
    description: emptyToUndefined(input.description),
    author: pruneAuthor(input.author),
    version: input.version.trim() || "1.0.0",
    license: emptyToUndefined(input.license),
    language: firstLesson?.language ?? "zh",
    baseLanguage: firstLesson?.baseLanguage ?? "en",
    level: sharedValue(input.lessons.map((lesson) => lesson.level)),
    tags: uniqueTags(input.tags),
    createdAt: now,
    updatedAt: now,
    lessons: input.lessons
  };
}

export function countSentences(lessons: LessonImportInput[]): number {
  return lessons.reduce((total, lesson) => total + lesson.sentences.length, 0);
}

export function estimatePackSize(pack: FydorPack): string {
  const bytes = new Blob([JSON.stringify(pack, null, 2)]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function slugifyPackTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "fydor-pack";
}

export function lessonKey(lesson: Pick<LessonImportInput, "title" | "language" | "baseLanguage">): string {
  return `${lesson.language}:${lesson.baseLanguage}:${lesson.title.trim().toLowerCase()}`;
}

function validateLessonContents(lesson: LessonImportInput): string[] {
  const errors: string[] = [];
  const seenSentences = new Set<string>();

  lesson.sentences.forEach((sentence, index) => {
    const normalized = sentence.text.trim().toLocaleLowerCase();
    if (seenSentences.has(normalized)) {
      errors.push(`Duplicate sentence text at sentence ${index + 1}.`);
    }
    seenSentences.add(normalized);

    for (const word of sentence.words ?? []) {
      if (!containsSurface(sentence.text, word.surface)) {
        errors.push(`Sentence ${index + 1}: word surface "${word.surface}" does not appear in the sentence.`);
      }
    }
    for (const grammar of sentence.grammar ?? []) {
      if (grammar.surface && !containsSurface(sentence.text, grammar.surface)) {
        errors.push(`Sentence ${index + 1}: grammar surface "${grammar.surface}" does not appear in the sentence.`);
      }
    }
    for (const chunk of sentence.chunks ?? []) {
      if (!containsSurface(sentence.text, chunk.surface)) {
        errors.push(`Sentence ${index + 1}: chunk surface "${chunk.surface}" does not appear in the sentence.`);
      }
    }
  });

  return errors;
}

function containsSurface(sentenceText: string, surface: string): boolean {
  return sentenceText.toLocaleLowerCase().includes(surface.toLocaleLowerCase());
}

function emptyValidation(errors: string[]): FydorPackValidation {
  return {
    errors,
    warnings: [],
    lessonErrors: [],
    lessonCount: 0,
    sentenceCount: 0
  };
}

function getRawTitle(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null || !("title" in value)) return fallback;
  const title = (value as { title?: unknown }).title;
  return typeof title === "string" && title.trim() ? title : fallback;
}

function stablePackId(title: string, authorName: string | undefined, createdAt: string): string {
  const seed = `${title}-${authorName ?? "fydor"}-${createdAt}`;
  return seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || `pack-${Date.now()}`;
}

function pruneAuthor(author: FydorPackAuthor | undefined): FydorPackAuthor | undefined {
  if (!author) return undefined;
  const next = {
    name: emptyToUndefined(author.name),
    organization: emptyToUndefined(author.organization),
    url: emptyToUndefined(author.url)
  };
  return next.name || next.organization || next.url ? next : undefined;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function uniqueTags(tags: string[] | undefined): string[] {
  return Array.from(new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean)));
}

function sharedValue(values: Array<string | undefined>): string | undefined {
  const present = values.map((value) => value?.trim()).filter(Boolean) as string[];
  if (!present.length) return undefined;
  return present.every((value) => value === present[0]) ? present[0] : undefined;
}
