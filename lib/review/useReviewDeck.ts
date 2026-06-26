"use client";

import { useCallback, useEffect, useState } from "react";
import { updateReviewItem } from "@/lib/desktopApi";
import { readSessionProgress, writeSessionProgress } from "@/components/imported-content/sessionProgress";
import {
  applyReviewDecision,
  summarizeReviewSentences
} from "./algorithm";
import { buildInterleavedReviewQueue, type ReviewQueueFilter } from "./queue";
import {
  buildReviewSessionSummary,
  classifyReviewSource,
  type ReviewSessionEvent,
  type ReviewSessionSummary
} from "./sessionSummary";
import type { ReviewDecision, ReviewSentence } from "./types";

const REVIEW_DECK_PROGRESS_KEY = "review.deck";

interface ReviewDeckState {
  order: string[];
  position: number;
  sentences: ReviewSentence[];
  saving: boolean;
  error: string | null;
  filter: ReviewQueueFilter;
  started: boolean;
  activeSession: {
    startedAt: Date;
    queueIds: string[];
    reviewed: ReviewSessionEvent[];
  } | null;
  completedSession: {
    filter: ReviewQueueFilter | "custom";
    label: string;
    summary: ReviewSessionSummary;
  } | null;
}

export function useReviewDeck(initialSentences: ReviewSentence[]) {
  const [state, setState] = useState<ReviewDeckState>(() => restoreReviewDeckState(initialSentences) ?? ({
    order: [],
    position: 0,
    sentences: initialSentences,
    saving: false,
    error: null,
    filter: "mixed",
    started: false,
    activeSession: null,
    completedSession: null
  }));

  useEffect(() => {
    setState((prev) => {
      const restored = restoreReviewDeckState(initialSentences);
      if (restored) return restored;

      return {
        ...prev,
        order: [],
        position: 0,
        sentences: initialSentences,
        started: false,
        activeSession: null,
        completedSession: null
      };
    });
  }, [initialSentences]);

  useEffect(() => {
    writeReviewDeckState(state);
  }, [state]);

  const currentId = state.order[state.position] ?? null;
  const currentSentence = currentId ? state.sentences.find((sentence) => sentence.id === currentId) ?? null : null;
  const summary = summarizeReviewSentences(state.sentences);

  const toggleShuffle = useCallback(() => {}, []);

  const startReview = useCallback((filter: ReviewQueueFilter = "mixed") => {
    setState((prev) => {
      const startedAt = new Date();
      const order = buildInterleavedReviewQueue(prev.sentences, { filter, seed: startedAt.getTime(), shuffled: true, now: startedAt });

      return {
        ...prev,
        filter,
        started: order.length > 0,
        position: 0,
        order,
        error: null,
        activeSession: order.length > 0 ? { startedAt, queueIds: order, reviewed: [] } : null,
        completedSession: null
      };
    });
  }, []);

  const startFocusedReview = useCallback((sentenceIds: string[], label = "Targeted retry") => {
    setState((prev) => {
      const seen = new Set<string>();
      const order = sentenceIds.filter((id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return prev.sentences.some((sentence) => sentence.id === id);
      });

      return {
        ...prev,
        started: order.length > 0,
        position: 0,
        order,
        error: null,
        activeSession: order.length > 0
          ? {
              startedAt: new Date(),
              queueIds: order,
              reviewed: []
            }
          : null,
        completedSession: order.length > 0
          ? null
          : {
              filter: "custom",
              label,
              summary: buildReviewSessionSummary([])
            }
      };
    });
  }, []);

  const reviewCurrent = useCallback(async (decision: ReviewDecision) => {
    if (!currentSentence || state.saving || !state.activeSession) return;

    const reviewedAt = new Date();
    const updatedSentence = applyReviewDecision(currentSentence, decision, reviewedAt);
    const nextSentences = state.sentences.map((sentence) => (sentence.id === currentSentence.id ? updatedSentence : sentence));
    const nextPosition = state.position + 1;
    const event: ReviewSessionEvent = {
      sentenceId: currentSentence.id,
      lessonId: currentSentence.lessonId,
      text: currentSentence.text,
      translation: currentSentence.translation,
      decision,
      before: currentSentence,
      after: updatedSentence,
      sourceBucket: classifyReviewSource(currentSentence, state.activeSession.startedAt)
    };
    const reviewedEvents = [...state.activeSession.reviewed, event];
    const sessionFinished = nextPosition >= state.order.length;

    setState((prev) => ({
      ...prev,
      sentences: nextSentences,
      saving: true,
      error: null,
      order: sessionFinished ? [] : prev.order,
      position: sessionFinished ? 0 : nextPosition,
      activeSession: sessionFinished
        ? null
        : {
            ...prev.activeSession!,
            reviewed: reviewedEvents
          },
      completedSession: sessionFinished
        ? {
            filter: prev.filter,
            label: getSessionLabel(prev.filter),
            summary: buildReviewSessionSummary(reviewedEvents)
          }
        : null
    }));

    try {
      const savedSentence = await updateReviewItem(currentSentence.id, decision);
      setState((prev) => ({
        ...prev,
        sentences: prev.sentences.map((sentence) => (sentence.id === savedSentence.id ? savedSentence : sentence))
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Unable to save review decision."
      }));
    } finally {
      setState((prev) => ({ ...prev, saving: false }));
    }
  }, [currentSentence, state.activeSession, state.order.length, state.position, state.saving, state.sentences]);

  return {
    currentSentence,
    position: state.position,
    summary,
    total: state.sentences.length,
    queueTotal: state.order.length,
    saving: state.saving,
    error: state.error,
    started: state.started,
    filter: state.filter,
    startReview,
    startFocusedReview,
    completedSession: state.completedSession,
    shuffleEnabled: true,
    reviewCurrent,
    toggleShuffle
  };
}

function getSessionLabel(filter: ReviewQueueFilter) {
  if (filter === "due") return "Due review";
  if (filter === "new") return "New cards";
  if (filter === "all") return "Full review";
  return "Mixed review";
}

function restoreReviewDeckState(initialSentences: ReviewSentence[]): ReviewDeckState | null {
  const saved = readSessionProgress(REVIEW_DECK_PROGRESS_KEY, validateReviewDeckProgress);
  if (!saved) return null;

  const sentenceIds = new Set(initialSentences.map((sentence) => sentence.id));
  const order = saved.order.filter((id) => sentenceIds.has(id));
  const hasActiveOrder = saved.started && order.length > 0;
  const started = hasActiveOrder || Boolean(saved.completedSession);

  return {
    ...saved,
    order: hasActiveOrder ? order : [],
    position: hasActiveOrder ? Math.min(Math.max(0, saved.position), Math.max(0, order.length - 1)) : 0,
    sentences: initialSentences,
    saving: false,
    error: null,
    started,
    activeSession: hasActiveOrder && saved.activeSession
      ? {
          startedAt: saved.activeSession.startedAt,
          queueIds: saved.activeSession.queueIds.filter((id) => sentenceIds.has(id)),
          reviewed: saved.activeSession.reviewed.filter((event) => sentenceIds.has(event.sentenceId))
        }
      : null
  };
}

function writeReviewDeckState(state: ReviewDeckState) {
  writeSessionProgress(REVIEW_DECK_PROGRESS_KEY, {
    ...state,
    saving: false,
    error: null
  });
}

function validateReviewDeckProgress(value: unknown): ReviewDeckState | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<ReviewDeckState>;

  if (!isStringArray(item.order)) return null;
  if (typeof item.position !== "number" || !Number.isInteger(item.position)) return null;
  if (!isReviewQueueFilter(item.filter)) return null;
  if (typeof item.started !== "boolean") return null;
  if (item.completedSession !== null && item.completedSession !== undefined && !isCompletedSession(item.completedSession)) return null;

  return {
    order: item.order,
    position: item.position,
    sentences: [],
    saving: false,
    error: null,
    filter: item.filter,
    started: item.started,
    activeSession: parseActiveSession(item.activeSession),
    completedSession: item.completedSession ?? null
  };
}

function parseActiveSession(value: unknown): ReviewDeckState["activeSession"] {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<NonNullable<ReviewDeckState["activeSession"]>> & { startedAt?: unknown };
  const startedAt = typeof item.startedAt === "string" || item.startedAt instanceof Date ? new Date(item.startedAt) : null;

  if (!startedAt || Number.isNaN(startedAt.getTime())) return null;
  if (!isStringArray(item.queueIds)) return null;
  if (!Array.isArray(item.reviewed) || !item.reviewed.every(isReviewSessionEvent)) return null;

  return {
    startedAt,
    queueIds: item.queueIds,
    reviewed: item.reviewed
  };
}

function isCompletedSession(value: unknown): value is NonNullable<ReviewDeckState["completedSession"]> {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<NonNullable<ReviewDeckState["completedSession"]>>;
  return (
    (isReviewQueueFilter(item.filter) || item.filter === "custom") &&
    typeof item.label === "string" &&
    Boolean(item.summary)
  );
}

function isReviewSessionEvent(value: unknown): value is ReviewSessionEvent {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ReviewSessionEvent>;
  return (
    typeof item.sentenceId === "string" &&
    typeof item.text === "string" &&
    typeof item.translation === "string" &&
    isReviewDecision(item.decision) &&
    isReviewSentence(item.before) &&
    isReviewSentence(item.after) &&
    (item.sourceBucket === "due" || item.sourceBucket === "new" || item.sourceBucket === "mastered")
  );
}

function isReviewSentence(value: unknown): value is ReviewSentence {
  if (!value || typeof value !== "object") return false;
  const sentence = value as Partial<ReviewSentence>;
  return (
    typeof sentence.id === "string" &&
    typeof sentence.language === "string" &&
    typeof sentence.text === "string" &&
    typeof sentence.translation === "string" &&
    (sentence.reviewState === "unknown" || sentence.reviewState === "remembered" || sentence.reviewState === "forgotten") &&
    typeof sentence.reviewStreak === "number" &&
    (sentence.reviewedAt === null || typeof sentence.reviewedAt === "string")
  );
}

function isReviewDecision(value: unknown): value is ReviewDecision {
  return value === "forgot" || value === "hard" || value === "remembered" || value === "easy" || value === "forgotten";
}

function isReviewQueueFilter(value: unknown): value is ReviewQueueFilter {
  return value === "mixed" || value === "due" || value === "new" || value === "all";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
