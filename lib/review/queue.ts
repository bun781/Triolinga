// Source of truth for review queue ordering. The interleaving ratios (30% fresh, 12% mastered) are intentional — do not adjust without product review.
import type { ReviewSentence, ReviewSentenceRow, SentenceReviewState } from "./types";
import { hydrateReviewSentence } from "./scheduler";

export type ReviewQueueFilter = "mixed" | "due" | "new" | "all";

const statePriority: Record<SentenceReviewState, number> = {
  forgotten: 0,
  unknown: 1,
  remembered: 2
};

export function buildInterleavedReviewQueue(
  sentences: ReviewSentence[],
  options: { filter?: ReviewQueueFilter; seed?: number; shuffled?: boolean; now?: Date } = {}
): string[] {
  const filter = options.filter ?? "mixed";
  const now = options.now ?? new Date();
  const rng = createSeededRng(options.seed ?? Date.now());
  const shuffled = options.shuffled ?? true;

  const due = sentences.filter((sentence) => isDue(sentence, now) && (sentence.repetitions ?? 0) > 0);
  const fresh = sentences.filter((sentence) => (sentence.repetitions ?? 0) === 0);
  const mastered = sentences.filter((sentence) => !isDue(sentence, now) && (sentence.repetitions ?? 0) > 0);

  if (filter === "due") return orderedIds(due, rng, shuffled);
  if (filter === "new") return orderedIds(fresh, rng, shuffled);
  if (filter === "all") return orderedIds(sentences, rng, shuffled);

  const duePicked = ordered(due, rng, shuffled);
  const freshTarget = duePicked.length ? Math.max(1, Math.ceil(duePicked.length * 0.3)) : fresh.length;
  const freshPicked = take(ordered(fresh, rng, shuffled), freshTarget);
  const masteredTarget = Math.max(1, Math.ceil((duePicked.length + freshPicked.length) * 0.12));
  const masteredPicked = take(ordered(mastered, rng, shuffled), masteredTarget);
  const picked = weightedMerge(duePicked, freshPicked, masteredPicked);

  const fallback = picked.length ? picked : sentences;
  return avoidSameLessonRuns(ordered(fallback, rng, true)).map((sentence) => sentence.id);
}

export function buildReviewQueue(sentences: ReviewSentenceRow[], seed = Date.now(), shuffled = true): string[] {
  const hydrated = sentences.map(hydrateReviewSentence);
  if (sentences.every((sentence) => !sentence.dueAt && !sentence.repetitions && !sentence.lessonId)) {
    return buildLegacyReviewQueue(sentences, seed, shuffled);
  }
  return buildInterleavedReviewQueue(hydrated, { seed, shuffled, filter: "mixed" });
}

export function buildReviewQueueWithCurrent(
  sentences: ReviewSentenceRow[],
  currentSentenceId: string | null,
  seed = Date.now(),
  shuffled = true
): string[] {
  const queue = buildReviewQueue(sentences, seed, shuffled);
  if (!currentSentenceId) return queue;
  return [currentSentenceId, ...queue.filter((id) => id !== currentSentenceId)];
}

export function summarizeReviewSentences(sentences: ReviewSentenceRow[] | ReviewSentence[]) {
  return sentences.reduce(
    (snapshot, sentence) => {
      snapshot.total += 1;
      snapshot[sentence.reviewState] += 1;
      return snapshot;
    },
    { total: 0, remembered: 0, forgotten: 0, unknown: 0 } satisfies Record<"total" | SentenceReviewState, number>
  );
}

export function getReviewShortcutAction(key: string) {
  if (key === "ArrowLeft" || key === "1") return "forgot" as const;
  if (key === "2") return "hard" as const;
  if (key === "ArrowRight" || key === "3") return "remembered" as const;
  if (key === "4") return "easy" as const;
  return null;
}

function buildLegacyReviewQueue(sentences: ReviewSentenceRow[], seed = Date.now(), shuffled = true): string[] {
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

function scoreReviewSentence(sentence: ReviewSentenceRow): number {
  const baseScore = statePriority[sentence.reviewState] * 100;
  const streakPenalty = sentence.reviewState === "remembered" ? sentence.reviewStreak * 10 : 0;
  return baseScore + streakPenalty;
}

function isDue(sentence: ReviewSentence, now: Date): boolean {
  return new Date(sentence.dueAt ?? 0).getTime() <= now.getTime();
}

function orderedIds(sentences: ReviewSentence[], rng: () => number, shuffled: boolean): string[] {
  return ordered(sentences, rng, shuffled).map((sentence) => sentence.id);
}

function ordered(sentences: ReviewSentence[], rng: () => number, shuffled: boolean): ReviewSentence[] {
  const sorted = [...sentences].sort((a, b) => {
    const dueDiff = new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime();
    if (dueDiff !== 0) return dueDiff;
    return scoreAnyReviewSentence(a) - scoreAnyReviewSentence(b);
  });
  return shuffled ? shuffle(sorted, rng) : sorted;
}

function scoreAnyReviewSentence(sentence: ReviewSentence): number {
  const baseScore = statePriority[sentence.reviewState] * 100;
  const streakPenalty = sentence.reviewState === "remembered" ? sentence.reviewStreak * 10 : 0;
  return baseScore + streakPenalty;
}

function take<T>(values: T[], count: number): T[] {
  return values.slice(0, Math.max(0, count));
}

function weightedMerge(due: ReviewSentence[], fresh: ReviewSentence[], mastered: ReviewSentence[]): ReviewSentence[] {
  const result: ReviewSentence[] = [];
  const buckets = [
    { values: due, index: 0 },
    { values: fresh, index: 0 },
    { values: mastered, index: 0 }
  ];
  const pattern = [0, 0, 0, 0, 0, 0, 0, 1, 1, 2];

  while (buckets.some((bucket) => bucket.index < bucket.values.length)) {
    for (const bucketIndex of pattern) {
      const bucket = buckets[bucketIndex];
      if (bucket.index < bucket.values.length) {
        result.push(bucket.values[bucket.index]);
        bucket.index += 1;
      }
    }
  }

  return result;
}

function avoidSameLessonRuns(sentences: ReviewSentence[]): ReviewSentence[] {
  const queue = [...sentences];
  for (let index = 1; index < queue.length; index += 1) {
    if (!queue[index - 1].lessonId || queue[index - 1].lessonId !== queue[index].lessonId) continue;
    const swapIndex = queue.findIndex((candidate, candidateIndex) => (
      candidateIndex > index && candidate.lessonId !== queue[index - 1].lessonId
    ));
    if (swapIndex > index) {
      [queue[index], queue[swapIndex]] = [queue[swapIndex], queue[index]];
    }
  }
  return queue;
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
