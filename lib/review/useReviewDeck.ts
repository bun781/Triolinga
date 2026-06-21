"use client";

import { useCallback, useEffect, useState } from "react";
import { updateReviewItem } from "@/lib/desktopApi";
import { applyReviewDecision, buildReviewQueue, getReviewShortcutAction, summarizeReviewSentences } from "./algorithm";
import type { ReviewDecision, ReviewSentence } from "./types";

interface ReviewDeckState {
  order: string[];
  position: number;
  sentences: ReviewSentence[];
  saving: boolean;
  error: string | null;
  shuffleEnabled: boolean;
}

export function useReviewDeck(initialSentences: ReviewSentence[]) {
  const [state, setState] = useState<ReviewDeckState>(() => ({
    order: buildReviewQueue(asRows(initialSentences)),
    position: 0,
    sentences: initialSentences,
    saving: false,
    error: null,
    shuffleEnabled: true
  }));

  const currentId = state.order[state.position] ?? null;
  const currentSentence = currentId ? state.sentences.find((sentence) => sentence.id === currentId) ?? null : null;
  const summary = summarizeReviewSentences(asRows(state.sentences));

  const reshuffle = useCallback((currentSentenceId = currentSentence?.id ?? null) => {
    setState((prev) => {
      const nextOrder = buildReviewQueue(asRows(prev.sentences), Date.now(), prev.shuffleEnabled);
      const reordered = currentSentenceId
        ? [currentSentenceId, ...nextOrder.filter((id) => id !== currentSentenceId)]
        : nextOrder;
      return { ...prev, order: reordered, position: 0, error: null };
    });
  }, [currentSentence?.id]);

  const toggleShuffle = useCallback(() => {
    setState((prev) => {
      const next = !prev.shuffleEnabled;
      const nextOrder = buildReviewQueue(asRows(prev.sentences), next ? Date.now() : 0, next);
      return { ...prev, shuffleEnabled: next, order: nextOrder, position: 0, error: null };
    });
  }, []);

  const reviewCurrent = useCallback(async (decision: ReviewDecision) => {
    if (!currentSentence || state.saving) return;

    const reviewedAt = new Date();
    const updatedSentence = applyReviewDecision(currentSentence, decision, reviewedAt);
    const nextSentences = state.sentences.map((sentence) => (sentence.id === currentSentence.id ? updatedSentence : sentence));
    const nextPosition = state.position + 1;

    setState((prev) => ({
      ...prev,
      sentences: nextSentences,
      saving: true,
      error: null,
      order: nextPosition >= prev.order.length ? buildReviewQueue(asRows(nextSentences), reviewedAt.getTime()) : prev.order,
      position: nextPosition >= prev.order.length ? 0 : nextPosition
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
  }, [currentSentence, state.position, state.saving, state.sentences]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const decision = getReviewShortcutAction(event.key);
      if (!decision) return;
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      void reviewCurrent(decision);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSentence?.id, reviewCurrent, state.saving]);

  return {
    currentSentence,
    position: state.position,
    summary,
    total: state.sentences.length,
    saving: state.saving,
    error: state.error,
    shuffleEnabled: state.shuffleEnabled,
    reviewCurrent,
    reshuffle,
    toggleShuffle
  };
}

function asRows(sentences: ReviewSentence[]) {
  return sentences.map((sentence) => ({
    ...sentence,
    reviewedAt: sentence.reviewedAt ? new Date(sentence.reviewedAt) : null
  }));
}
