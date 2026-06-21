import { describe, expect, it } from "vitest";
import { applyReviewDecision, buildReviewQueue, getReviewShortcutAction, summarizeReviewSentences } from "@/lib/review/algorithm";
import type { ReviewSentenceRow } from "@/lib/review/types";

describe("review keyboard shortcuts", () => {
  it("maps arrow keys to review decisions", () => {
    expect(getReviewShortcutAction("ArrowLeft")).toBe("forgotten");
    expect(getReviewShortcutAction("ArrowRight")).toBe("remembered");
    expect(getReviewShortcutAction("Enter")).toBeNull();
  });
});

describe("review state updates", () => {
  it("updates the remembered state immediately", () => {
    const reviewedAt = new Date("2026-06-21T10:00:00.000Z");
    const updated = applyReviewDecision(
      {
        id: "sentence-1",
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
  });

  it("resets streak when a sentence is forgotten", () => {
    const updated = applyReviewDecision(
      {
        id: "sentence-1",
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
  });
});

describe("review algorithm", () => {
  const sentences: ReviewSentenceRow[] = [
    {
      id: "forgotten",
      text: "Forgotten",
      translation: "Forgotten",
      reviewState: "forgotten",
      reviewStreak: 0,
      reviewedAt: null
    },
    {
      id: "unknown-a",
      text: "Unknown A",
      translation: "Unknown A",
      reviewState: "unknown",
      reviewStreak: 0,
      reviewedAt: null
    },
    {
      id: "unknown-b",
      text: "Unknown B",
      translation: "Unknown B",
      reviewState: "unknown",
      reviewStreak: 0,
      reviewedAt: null
    },
    {
      id: "remembered-low",
      text: "Remembered low",
      translation: "Remembered low",
      reviewState: "remembered",
      reviewStreak: 1,
      reviewedAt: null
    },
    {
      id: "remembered-high",
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

  it("changes order when the shuffle seed changes", () => {
    const shuffledSentences: ReviewSentenceRow[] = [
      { id: "one", text: "One", translation: "One", reviewState: "unknown", reviewStreak: 0, reviewedAt: null },
      { id: "two", text: "Two", translation: "Two", reviewState: "unknown", reviewStreak: 0, reviewedAt: null },
      { id: "three", text: "Three", translation: "Three", reviewState: "unknown", reviewStreak: 0, reviewedAt: null },
      { id: "four", text: "Four", translation: "Four", reviewState: "unknown", reviewStreak: 0, reviewedAt: null }
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
});
