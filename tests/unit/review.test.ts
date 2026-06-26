import { describe, expect, it } from "vitest";
import {
  applyReviewDecision,
  buildReviewQueue,
  buildReviewQueueWithCurrent,
  getReviewShortcutAction,
  summarizeReviewSentences
} from "@/lib/review/algorithm";
import { isSpaceKey, shouldIgnoreReviewHotkey, shouldRevealOnSpaceRelease } from "@/lib/review/keyboard";
import { buildReviewSessionSummary, classifyReviewSource } from "@/lib/review/sessionSummary";
import type { ReviewSentenceRow } from "@/lib/review/types";

describe("review keyboard shortcuts", () => {
  it("maps arrow keys to review decisions", () => {
    expect(getReviewShortcutAction("ArrowLeft")).toBe("forgot");
    expect(getReviewShortcutAction("ArrowRight")).toBe("remembered");
    expect(getReviewShortcutAction("1")).toBe("forgot");
    expect(getReviewShortcutAction("2")).toBe("hard");
    expect(getReviewShortcutAction("3")).toBe("remembered");
    expect(getReviewShortcutAction("4")).toBe("easy");
    expect(getReviewShortcutAction("Enter")).toBeNull();
  });

  it("ignores repeated keydown events so holding space does not reveal the next card", () => {
    expect(shouldIgnoreReviewHotkey({ repeat: true, target: null })).toBe(true);
    expect(shouldIgnoreReviewHotkey({ repeat: false, target: null })).toBe(false);
  });

  it("recognizes spacebar variants", () => {
    expect(isSpaceKey(" ")).toBe(true);
    expect(isSpaceKey("Spacebar")).toBe(true);
    expect(isSpaceKey("Enter")).toBe(false);
  });

  it("only reveals on release for the same sentence that was pressed", () => {
    expect(shouldRevealOnSpaceRelease("sentence-1", "sentence-1")).toBe(true);
    expect(shouldRevealOnSpaceRelease("sentence-1", "sentence-2")).toBe(false);
    expect(shouldRevealOnSpaceRelease(null, "sentence-1")).toBe(false);
  });
});

describe("review state updates", () => {
  it("updates the remembered state immediately", () => {
    const reviewedAt = new Date("2026-06-21T10:00:00.000Z");
    const updated = applyReviewDecision(
      {
        id: "sentence-1",
        language: "ko",
        text: "안녕하세요.",
        translation: "Hello.",
        reviewState: "unknown",
        reviewStreak: 0,
        reviewedAt: null
      },
      "remembered",
      reviewedAt
    );

    expect(updated.reviewState).toBe("remembered");
    expect(updated.reviewStreak).toBe(1);
    expect(updated.reviewedAt).toBe(reviewedAt.toISOString());
    expect(updated.dueAt).toBe("2026-06-24T10:00:00.000Z");
    expect(updated.recallMode).toBe("translation_hidden");
  });

  it("resets streak when a sentence is forgotten", () => {
    const updated = applyReviewDecision(
      {
        id: "sentence-1",
        language: "ko",
        text: "안녕하세요.",
        translation: "Hello.",
        reviewState: "remembered",
        reviewStreak: 3,
        reviewedAt: null
      },
      "forgotten"
    );

    expect(updated.reviewState).toBe("forgotten");
    expect(updated.reviewStreak).toBe(0);
    expect(updated.lapses).toBe(1);
    expect(updated.recallMode).toBe("full_support");
  });

  it("keeps recall mode on hard and moves two stages on easy", () => {
    const hard = applyReviewDecision(
      {
        id: "sentence-1",
        language: "ko",
        text: "안녕하세요.",
        translation: "Hello.",
        reviewState: "unknown",
        reviewStreak: 0,
        reviewedAt: null,
        recallMode: "sentence_only"
      },
      "hard",
      new Date("2026-06-21T10:00:00.000Z")
    );
    const easy = applyReviewDecision(hard, "easy", new Date("2026-06-22T10:00:00.000Z"));

    expect(hard.recallMode).toBe("sentence_only");
    expect(hard.dueAt).toBe("2026-06-22T10:00:00.000Z");
    expect(easy.recallMode).toBe("reverse_translate");
    expect(easy.dueAt).toBe("2026-06-29T10:00:00.000Z");
  });
});

describe("review algorithm", () => {
  const sentences: ReviewSentenceRow[] = [
      {
        id: "forgotten",
        language: "ko",
        text: "Forgotten",
        translation: "Forgotten",
        reviewState: "forgotten",
      reviewStreak: 0,
      reviewedAt: null
    },
      {
        id: "unknown-a",
        language: "ko",
        text: "Unknown A",
        translation: "Unknown A",
        reviewState: "unknown",
      reviewStreak: 0,
      reviewedAt: null
    },
      {
        id: "unknown-b",
        language: "ko",
        text: "Unknown B",
        translation: "Unknown B",
        reviewState: "unknown",
      reviewStreak: 0,
      reviewedAt: null
    },
      {
        id: "remembered-low",
        language: "ko",
        text: "Remembered low",
        translation: "Remembered low",
        reviewState: "remembered",
      reviewStreak: 1,
      reviewedAt: null
    },
      {
        id: "remembered-high",
        language: "ko",
        text: "Remembered high",
        translation: "Remembered high",
        reviewState: "remembered",
      reviewStreak: 4,
      reviewedAt: null
    }
  ];

  it("prioritizes forgotten items and pushes remembered items later as streak grows", () => {
    const queue = buildReviewQueue(sentences, 42);

    expect(queue[0]).toBe("forgotten");
    expect(queue.indexOf("remembered-high")).toBeGreaterThan(queue.indexOf("remembered-low"));
  });

  it("generates a shuffled queue without duplicates until the cycle is exhausted", () => {
    const queue = buildReviewQueue(sentences, 7);

    expect(new Set(queue).size).toBe(queue.length);
    expect(queue).toHaveLength(sentences.length);
  });

  it("keeps buckets in sequential order when shuffle is off", () => {
    const queue = buildReviewQueue(sentences, 7, false);

    expect(queue).toEqual(["forgotten", "unknown-a", "unknown-b", "remembered-low", "remembered-high"]);
  });

  it("moves the current sentence to the front when rebuilding the queue", () => {
    const queue = buildReviewQueueWithCurrent(sentences, "unknown-b", 7, false);

    expect(queue[0]).toBe("unknown-b");
    expect(queue).toContain("forgotten");
    expect(new Set(queue).size).toBe(queue.length);
  });

  it("changes order when the shuffle seed changes", () => {
    const shuffledSentences: ReviewSentenceRow[] = [
      { id: "one", language: "ko", text: "One", translation: "One", reviewState: "unknown", reviewStreak: 0, reviewedAt: null },
      { id: "two", language: "ko", text: "Two", translation: "Two", reviewState: "unknown", reviewStreak: 0, reviewedAt: null },
      { id: "three", language: "ko", text: "Three", translation: "Three", reviewState: "unknown", reviewStreak: 0, reviewedAt: null },
      { id: "four", language: "ko", text: "Four", translation: "Four", reviewState: "unknown", reviewStreak: 0, reviewedAt: null }
    ];

    const first = buildReviewQueue(shuffledSentences, 1);
    const second = buildReviewQueue(shuffledSentences, 2);

    expect(first).not.toEqual(second);
    expect(new Set(first)).toEqual(new Set(second));
  });

  it("summarizes the review state counts", () => {
    expect(summarizeReviewSentences(sentences)).toEqual({
      total: 5,
      remembered: 2,
      forgotten: 1,
      unknown: 2
    });
  });

  it("classifies review sources for due, new, and mastered items", () => {
    const now = new Date("2026-06-26T10:00:00.000Z");

    expect(classifyReviewSource({
      id: "due",
      language: "ko",
      text: "Due",
      translation: "Due",
      reviewState: "remembered",
      reviewStreak: 2,
      reviewedAt: null,
      repetitions: 2,
      dueAt: "2026-06-25T10:00:00.000Z"
    }, now)).toBe("due");

    expect(classifyReviewSource({
      id: "new",
      language: "ko",
      text: "New",
      translation: "New",
      reviewState: "unknown",
      reviewStreak: 0,
      reviewedAt: null,
      repetitions: 0,
      dueAt: "2026-06-30T10:00:00.000Z"
    }, now)).toBe("new");

    expect(classifyReviewSource({
      id: "mastered",
      language: "ko",
      text: "Mastered",
      translation: "Mastered",
      reviewState: "remembered",
      reviewStreak: 5,
      reviewedAt: null,
      repetitions: 5,
      dueAt: "2026-07-01T10:00:00.000Z"
    }, now)).toBe("mastered");
  });

  it("builds a session summary with retry and promotion stats", () => {
    const summary = buildReviewSessionSummary([
      {
        sentenceId: "a",
        lessonId: "lesson-1",
        text: "A",
        translation: "A",
        decision: "forgot",
        sourceBucket: "due",
        before: {
          id: "a",
          language: "ko",
          text: "A",
          translation: "A",
          reviewState: "remembered",
          reviewStreak: 2,
          reviewedAt: null,
          repetitions: 2,
          dueAt: "2026-06-25T10:00:00.000Z",
          recallMode: "translation_hidden"
        },
        after: {
          id: "a",
          language: "ko",
          text: "A",
          translation: "A",
          reviewState: "forgotten",
          reviewStreak: 0,
          reviewedAt: "2026-06-26T10:00:00.000Z",
          repetitions: 2,
          dueAt: "2026-06-26T10:10:00.000Z",
          recallMode: "full_support"
        }
      },
      {
        sentenceId: "b",
        lessonId: "lesson-2",
        text: "B",
        translation: "B",
        decision: "easy",
        sourceBucket: "new",
        before: {
          id: "b",
          language: "ko",
          text: "B",
          translation: "B",
          reviewState: "unknown",
          reviewStreak: 0,
          reviewedAt: null,
          repetitions: 0,
          dueAt: "2026-06-26T10:00:00.000Z",
          recallMode: "full_support"
        },
        after: {
          id: "b",
          language: "ko",
          text: "B",
          translation: "B",
          reviewState: "remembered",
          reviewStreak: 1,
          reviewedAt: "2026-06-26T10:00:00.000Z",
          repetitions: 1,
          dueAt: "2026-07-03T10:00:00.000Z",
          recallMode: "sentence_only"
        }
      },
      {
        sentenceId: "c",
        lessonId: "lesson-1",
        text: "C",
        translation: "C",
        decision: "hard",
        sourceBucket: "mastered",
        before: {
          id: "c",
          language: "ko",
          text: "C",
          translation: "C",
          reviewState: "remembered",
          reviewStreak: 4,
          reviewedAt: null,
          repetitions: 4,
          dueAt: "2026-06-30T10:00:00.000Z",
          recallMode: "fill_blank"
        },
        after: {
          id: "c",
          language: "ko",
          text: "C",
          translation: "C",
          reviewState: "unknown",
          reviewStreak: 4,
          reviewedAt: "2026-06-26T10:00:00.000Z",
          repetitions: 4,
          dueAt: "2026-06-27T10:00:00.000Z",
          recallMode: "fill_blank"
        }
      }
    ]);

    expect(summary).toEqual({
      reviewed: 3,
      forgot: 1,
      hard: 1,
      remembered: 0,
      easy: 1,
      strongRecall: 1,
      retrySoon: 2,
      strongRecallRate: 33,
      promotedRecallModes: 1,
      lessonCount: 2,
      dueCount: 1,
      newCount: 1,
      masteredCount: 1,
      retrySentenceIds: ["a", "c"],
      toughestLessons: [{ lessonId: "lesson-1", misses: 2 }]
    });
  });
});
