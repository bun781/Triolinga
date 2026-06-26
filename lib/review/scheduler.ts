// Source of truth for SRS scheduling. Interval values (10min/1day/3day/7day) must stay in sync with src-tauri/src/review.rs.
import { progressRecallMode } from "./recallModes";
import type { ReviewGrade, ReviewSentence, ReviewSentenceRow, SentenceReviewState } from "./types";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export function normalizeReviewGrade(decision: ReviewGrade | "forgotten"): ReviewGrade {
  return decision === "forgotten" ? "forgot" : decision;
}

export function applyReviewDecision(
  sentence: ReviewSentence,
  decision: ReviewGrade | "forgotten",
  reviewedAt = new Date()
): ReviewSentence {
  const grade = normalizeReviewGrade(decision);
  const dueAt = scheduleNextDueAt(grade, reviewedAt);
  const currentRepetitions = sentence.repetitions ?? Math.max(0, sentence.reviewStreak);
  const currentLapses = sentence.lapses ?? (sentence.reviewState === "forgotten" ? 1 : 0);
  const currentDifficulty = sentence.difficulty ?? 0.3;
  const currentStability = sentence.stability ?? Math.max(0, sentence.reviewStreak);
  const currentRecallMode = sentence.recallMode ?? "full_support";
  const repetitions = grade === "remembered" || grade === "easy" ? currentRepetitions + 1 : currentRepetitions;
  const lapses = grade === "forgot" ? currentLapses + 1 : currentLapses;
  const recallMode = progressRecallMode(currentRecallMode, grade);

  return {
    ...sentence,
    reviewState: toLegacyReviewState(grade),
    reviewStreak: grade === "remembered" || grade === "easy" ? sentence.reviewStreak + 1 : grade === "forgot" ? 0 : sentence.reviewStreak,
    reviewedAt: reviewedAt.toISOString(),
    dueAt: dueAt.toISOString(),
    lastReviewedAt: reviewedAt.toISOString(),
    repetitions,
    lapses,
    difficulty: updateDifficulty(currentDifficulty, grade),
    stability: updateStability(currentStability, grade),
    recallMode
  };
}

export function scheduleNextDueAt(grade: ReviewGrade, reviewedAt = new Date()): Date {
  const delay = grade === "forgot"
    ? 10 * MINUTE
    : grade === "hard"
      ? DAY
      : grade === "remembered"
        ? 3 * DAY
        : 7 * DAY;
  return new Date(reviewedAt.getTime() + delay);
}

export function toLegacyReviewState(grade: ReviewGrade): SentenceReviewState {
  if (grade === "forgot") return "forgotten";
  if (grade === "hard") return "unknown";
  return "remembered";
}

export function hydrateReviewSentence(row: ReviewSentenceRow): ReviewSentence {
  const now = new Date().toISOString();
  const reviewedAt = row.reviewedAt?.toISOString() ?? row.lastReviewedAt?.toISOString() ?? null;
  return {
    id: row.id,
    sentenceId: row.sentenceId ?? row.id,
    lessonId: row.lessonId ?? "",
    importId: row.importId ?? row.lessonId ?? "",
    language: row.language,
    text: row.text,
    translation: row.translation,
    reviewState: row.reviewState,
    reviewStreak: row.reviewStreak,
    reviewedAt,
    dueAt: row.dueAt?.toISOString() ?? now,
    lastReviewedAt: row.lastReviewedAt?.toISOString() ?? reviewedAt,
    repetitions: row.repetitions ?? Math.max(0, row.reviewStreak),
    lapses: row.lapses ?? (row.reviewState === "forgotten" ? 1 : 0),
    difficulty: row.difficulty ?? 0.3,
    stability: row.stability ?? Math.max(0, row.reviewStreak),
    recallMode: row.recallMode ?? "full_support",
    focusText: row.focusText ?? null,
    focusMeaning: row.focusMeaning ?? null,
    focusExplanation: row.focusExplanation ?? null
  };
}

function updateDifficulty(current: number, grade: ReviewGrade): number {
  const delta = grade === "forgot" ? 0.18 : grade === "hard" ? 0.08 : grade === "remembered" ? -0.04 : -0.08;
  return clamp(round(current + delta), 0, 1);
}

function updateStability(current: number, grade: ReviewGrade): number {
  if (grade === "forgot") return Math.max(0.5, round(current * 0.45));
  if (grade === "hard") return Math.max(1, round(current + 0.5));
  if (grade === "remembered") return Math.max(3, round(current + 2));
  return Math.max(7, round(current + 4));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
