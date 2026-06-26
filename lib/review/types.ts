export type SentenceReviewState = "unknown" | "remembered" | "forgotten";
export type ReviewGrade = "forgot" | "hard" | "remembered" | "easy";
export type ReviewDecision = ReviewGrade | "forgotten";
export type RecallMode =
  | "full_support"
  | "translation_hidden"
  | "sentence_only"
  | "fill_blank"
  | "reverse_translate";

export interface ReviewSentence {
  id: string;
  sentenceId?: string;
  lessonId?: string;
  importId?: string;
  language: string;
  text: string;
  translation: string;
  reviewState: SentenceReviewState;
  reviewStreak: number;
  reviewedAt: string | null;
  dueAt?: string;
  lastReviewedAt?: string | null;
  repetitions?: number;
  lapses?: number;
  difficulty?: number;
  stability?: number;
  recallMode?: RecallMode;
  focusText?: string | null;
  focusMeaning?: string | null;
  focusExplanation?: string | null;
}

export interface ReviewSentenceRow {
  id: string;
  sentenceId?: string;
  lessonId?: string;
  importId?: string;
  language: string;
  text: string;
  translation: string;
  reviewState: SentenceReviewState;
  reviewStreak: number;
  reviewedAt: Date | null;
  dueAt?: Date;
  lastReviewedAt?: Date | null;
  repetitions?: number;
  lapses?: number;
  difficulty?: number;
  stability?: number;
  recallMode?: RecallMode;
  focusText?: string | null;
  focusMeaning?: string | null;
  focusExplanation?: string | null;
}

export type ReviewResetScope =
  | { type: "lesson"; lessonId: string }
  | { type: "sentence"; sentenceId: string }
  | { type: "item"; itemType: "word" | "grammar" | "chunk"; canonicalKey: string; lessonId?: string };
