import type { ReviewDecision, ReviewSentence, ReviewSentenceRow, SentenceReviewState } from "./types";

const statePriority: Record<SentenceReviewState, number> = {
  forgotten: 0,
  unknown: 1,
  remembered: 2
};

export function getReviewShortcutAction(key: string): ReviewDecision | null {
  if (key === "ArrowLeft") return "forgotten";
  if (key === "ArrowRight") return "remembered";
  return null;
}

export function buildReviewQueue(sentences: ReviewSentenceRow[], seed = Date.now(), shuffled = true): string[] {
  const rng = createSeededRng(seed);
  const buckets = new Map<number, ReviewSentenceRow[]>();

  for (const sentence of sentences) {
    const score = scoreReviewSentence(sentence);
    const bucket = buckets.get(score) ?? [];
    bucket.push(sentence);
    buckets.set(score, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([, bucket]) => shuffled ? shuffle(bucket, rng) : bucket)
    .map((sentence) => sentence.id);
}

export function applyReviewDecision(
  sentence: ReviewSentence,
  decision: ReviewDecision,
  reviewedAt = new Date()
): ReviewSentence {
  const nextReviewState = decision;
  const nextReviewStreak = decision === "remembered" ? sentence.reviewStreak + 1 : 0;

  return {
    ...sentence,
    reviewState: nextReviewState,
    reviewStreak: nextReviewStreak,
    reviewedAt: reviewedAt.toISOString()
  };
}

export function summarizeReviewSentences(sentences: ReviewSentenceRow[]) {
  return sentences.reduce(
    (snapshot, sentence) => {
      snapshot.total += 1;
      snapshot[sentence.reviewState] += 1;
      return snapshot;
    },
    { total: 0, remembered: 0, forgotten: 0, unknown: 0 } satisfies Record<"total" | SentenceReviewState, number>
  );
}

function scoreReviewSentence(sentence: ReviewSentenceRow): number {
  const baseScore = statePriority[sentence.reviewState] * 100;
  const streakPenalty = sentence.reviewState === "remembered" ? sentence.reviewStreak * 10 : 0;
  return baseScore + streakPenalty;
}

function createSeededRng(seed: number) {
  let state = seed >>> 0;
  return function next() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: T[], rng: () => number): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
