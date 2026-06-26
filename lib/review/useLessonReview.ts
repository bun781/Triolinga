"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { updateReviewItem } from "@/lib/desktopApi";
import type { StudySentence } from "@/lib/imported-content/types";
import type { ReviewDecision } from "./types";

interface LessonReviewState {
  active: boolean;
  queue: string[];
  reviewed: number;
  remembered: number;
  forgotten: number;
  saving: boolean;
  error: string | null;
}

interface UseLessonReviewOptions {
  onDecision?: (sentence: StudySentence, decision: ReviewDecision) => void;
  onSaved?: (sentenceId: string, decision: ReviewDecision) => void;
}

const REINSERT_MIN_OFFSET = 2;
const REINSERT_MAX_OFFSET = 4;

export function useLessonReview(sentences: StudySentence[], options: UseLessonReviewOptions = {}) {
  const { onDecision, onSaved } = options;
  const [state, setState] = useState<LessonReviewState>({
    active: false,
    queue: [],
    reviewed: 0,
    remembered: 0,
    forgotten: 0,
    saving: false,
    error: null
  });
  const markedCardRef = useRef<string | null>(null);

  const sentenceById = useMemo(
    () => new Map(sentences.map((sentence) => [sentence.id, sentence])),
    [sentences]
  );

  const currentCard = state.active && state.queue[0] ? sentenceById.get(state.queue[0]) ?? null : null;
  const remaining = state.queue.length;
  const finished = state.active && remaining === 0;

  const finishReview = useCallback(() => {
    setState((prev) => ({ ...prev, active: false, queue: [], saving: false, error: null }));
  }, []);

  const startReview = useCallback(() => {
    markedCardRef.current = null;
    setState({
      active: true,
      queue: sentences.map((sentence) => sentence.id),
      reviewed: 0,
      remembered: 0,
      forgotten: 0,
      saving: false,
      error: null
    });
  }, [sentences]);

  const getNextCard = useCallback(() => {
    const nextId = state.queue[0] ?? null;
    return nextId ? sentenceById.get(nextId) ?? null : null;
  }, [sentenceById, state.queue]);

  const markCard = useCallback((decision: ReviewDecision) => {
    if (!state.active || !currentCard) return;
    if (markedCardRef.current === currentCard.id) return;

    markedCardRef.current = currentCard.id;
    onDecision?.(currentCard, decision);

    setState((prev) => {
      if (!prev.active || prev.queue[0] !== currentCard.id) return prev;

      const rest = prev.queue.slice(1);
      const queue = decision === "remembered"
        ? rest
        : reinsertForgottenCard(rest, currentCard.id);

      return {
        ...prev,
        queue,
        reviewed: prev.reviewed + 1,
        remembered: prev.remembered + (decision === "remembered" ? 1 : 0),
        forgotten: prev.forgotten + (decision === "forgotten" ? 1 : 0),
        saving: true,
        error: null
      };
    });

    void updateReviewItem(currentCard.id, decision)
      .then(() => {
        onSaved?.(currentCard.id, decision);
      })
      .catch((error) => {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Unable to save review result."
        }));
      })
      .finally(() => {
        setState((prev) => ({ ...prev, saving: false }));
      });
  }, [currentCard, onDecision, onSaved, state.active]);

  const markRemembered = useCallback((cardId?: string) => {
    if (cardId && cardId !== currentCard?.id) return;
    markCard("remembered");
  }, [currentCard?.id, markCard]);

  const markNotRemembered = useCallback((cardId?: string) => {
    if (cardId && cardId !== currentCard?.id) return;
    markCard("forgotten");
  }, [currentCard?.id, markCard]);

  useEffect(() => {
    markedCardRef.current = null;
  }, [currentCard?.id]);

  useEffect(() => {
    if (!state.active) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || isEditableShortcutTarget(event.target)) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        markNotRemembered();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        markRemembered();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        finishReview();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [finishReview, markNotRemembered, markRemembered, state.active]);

  return {
    active: state.active,
    currentCard,
    error: state.error,
    finished,
    getNextCard,
    markNotRemembered,
    markRemembered,
    remaining,
    saving: state.saving,
    startReview,
    finishReview,
    stats: {
      reviewed: state.reviewed,
      remembered: state.remembered,
      forgotten: state.forgotten,
      total: sentences.length
    }
  };
}

function reinsertForgottenCard(queue: string[], cardId: string): string[] {
  const offset = REINSERT_MIN_OFFSET + Math.floor(Math.random() * (REINSERT_MAX_OFFSET - REINSERT_MIN_OFFSET + 1));
  const index = Math.min(queue.length, offset);
  return [...queue.slice(0, index), cardId, ...queue.slice(index)];
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
