export type LearningItemType = "word" | "grammar" | "chunk";
export type SentenceGrade = "easy" | "correct" | "hard" | "failed";

export interface LessonWordInput {
  surface: string;
  lemma?: string;
  meaning?: string;
  role?: string;
  explanation?: string;
}

export interface LessonGrammarInput {
  pattern: string;
  surface?: string;
  meaning?: string;
  explanation?: string;
}

export interface LessonChunkInput {
  surface: string;
  meaning?: string;
  explanation?: string;
  type?: string;
  level?: string;
  tags?: string[];
}

export interface LessonSentenceInput {
  text: string;
  translation?: string;
  words?: LessonWordInput[];
  grammar?: LessonGrammarInput[];
  chunks?: LessonChunkInput[];
}

export interface LessonImportInput {
  language: string;
  baseLanguage: string;
  title: string;
  description?: string;
  source?: string;
  level?: string;
  tags?: string[];
  sentences: LessonSentenceInput[];
}

export interface ImportValidationResult {
  lesson?: LessonImportInput;
  errors: string[];
}

export interface LessonImportPreviewLesson {
  language: string;
  baseLanguage: string;
  title: string;
  description?: string;
  source?: string;
  level?: string;
  tags: string[];
}

export interface LessonImportPreviewSentence {
  index: number;
  text: string;
  translation: string;
  duplicateSentence: boolean;
  words: LessonWordInput[];
  grammar: LessonGrammarInput[];
  chunks: LessonChunkInput[];
}

export interface LessonImportPreviewItem {
  canonicalKey: string;
  type: LearningItemType;
  displayText: string;
  meaning?: string;
  explanation?: string;
  status: "new" | "existing";
}

export interface LessonImportPreviewResult {
  lesson: LessonImportPreviewLesson;
  sentenceCount: number;
  duplicateImport: boolean;
  validationErrors: string[];
  sentences: LessonImportPreviewSentence[];
  vocabulary: LessonImportPreviewItem[];
  grammar: LessonImportPreviewItem[];
  chunks: LessonImportPreviewItem[];
}

export interface LessonImportSummary {
  lessonCreated: boolean;
  lessonUpdated: boolean;
  sentencesImported: number;
  sentencesSkipped: number;
  vocabularyCreated: number;
  vocabularyReused: number;
  grammarCreated: number;
  grammarReused: number;
  chunksCreated: number;
  chunksReused: number;
  linksCreated: number;
  errors: string[];
}
