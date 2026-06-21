export type SentenceReviewState = "unknown" | "remembered" | "forgotten";
export type ReviewDecision = "remembered" | "forgotten";

export interface ReviewSentence {
  id: string;
  language: string;
  text: string;
  translation: string;
  reviewState: SentenceReviewState;
  reviewStreak: number;
  reviewedAt: string | null;
}

export interface ReviewSentenceRow {
  id: string;
  language: string;
  text: string;
  translation: string;
  reviewState: SentenceReviewState;
  reviewStreak: number;
  reviewedAt: Date | null;
}
