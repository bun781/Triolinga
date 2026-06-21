"use client";

import { useEffect, useState } from "react";
import type { ReviewSentence } from "@/lib/review/types";
import { useReviewDeck } from "@/lib/review/useReviewDeck";
import { ReviewControls } from "./ReviewControls";
import { ReviewSentenceCard } from "./ReviewSentenceCard";

interface ReviewDeckProps {
  sentences: ReviewSentence[];
}

export function ReviewDeck({ sentences }: ReviewDeckProps) {
  const { currentSentence, position, total, saving, error, reviewCurrent, summary, shuffleEnabled, toggleShuffle } = useReviewDeck(sentences);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
  }, [currentSentence?.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isInteractiveTarget(event.target)) return;
      if (event.key === " ") {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void reviewCurrent("forgotten");
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        void reviewCurrent("remembered");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reviewCurrent]);

  if (!sentences.length) {
    return (
      <section className="card review-empty">
        <h2>No sentences to review yet</h2>
        <p className="muted">Import a lesson first, then come back here to review sentences one at a time.</p>
      </section>
    );
  }

  if (!currentSentence) {
    return (
      <section className="card review-empty">
        <h2>Review queue complete</h2>
        <p className="muted">Turn random order on to start another pass through the current review set.</p>
        <ReviewControls
          disabled={saving}
          shuffleEnabled={shuffleEnabled}
          onRemembered={() => reviewCurrent("remembered")}
          onForgotten={() => reviewCurrent("forgotten")}
          onToggleShuffle={toggleShuffle}
        />
      </section>
    );
  }

  return (
    <div className="review-shell">
      <header className="review-header">
        <div>
          <h1>Review</h1>
          <p className="muted">Space = reveal · ← Not Remembered · → Remembered</p>
        </div>
        <div className="review-summary">
          <span className="pill">Total {summary.total}</span>
          <span className="pill">Unknown {summary.unknown}</span>
          <span className="pill review-state-forgotten">Forgotten {summary.forgotten}</span>
          <span className="pill review-state-remembered">Remembered {summary.remembered}</span>
        </div>
      </header>

      {error ? <p className="review-error">{error}</p> : null}

      <ReviewSentenceCard
        sentence={currentSentence}
        index={position}
        total={total}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
      />

      <ReviewControls
        disabled={saving}
        shuffleEnabled={shuffleEnabled}
        onRemembered={() => reviewCurrent("remembered")}
        onForgotten={() => reviewCurrent("forgotten")}
        onToggleShuffle={toggleShuffle}
      />
    </div>
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
