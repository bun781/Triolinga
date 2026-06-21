"use client";

import type { ReviewSentence } from "@/lib/review/types";
import { useReviewDeck } from "@/lib/review/useReviewDeck";
import { ReviewControls } from "./ReviewControls";
import { ReviewSentenceCard } from "./ReviewSentenceCard";

interface ReviewDeckProps {
  sentences: ReviewSentence[];
}

export function ReviewDeck({ sentences }: ReviewDeckProps) {
  const { currentSentence, position, total, saving, error, reviewCurrent, reshuffle, summary } = useReviewDeck(sentences);

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
        <p className="muted">Shuffle to start another pass through the current review set.</p>
        <ReviewControls
          disabled={saving}
          onRemembered={() => reviewCurrent("remembered")}
          onForgotten={() => reviewCurrent("forgotten")}
          onShuffle={() => reshuffle()}
        />
      </section>
    );
  }

  return (
    <div className="review-shell">
      <header className="review-header">
        <div>
          <h1>Review</h1>
          <p className="muted">Left arrow = Not Remembered. Right arrow = Remembered.</p>
        </div>
        <div className="review-summary">
          <span className="pill">Total {summary.total}</span>
          <span className="pill">Unknown {summary.unknown}</span>
          <span className="pill">Forgotten {summary.forgotten}</span>
          <span className="pill">Remembered {summary.remembered}</span>
        </div>
      </header>

      {error ? <p className="review-error">{error}</p> : null}

      <ReviewSentenceCard sentence={currentSentence} index={position} total={total} />

      <ReviewControls
        disabled={saving}
        onRemembered={() => reviewCurrent("remembered")}
        onForgotten={() => reviewCurrent("forgotten")}
        onShuffle={() => reshuffle(currentSentence.id)}
      />
    </div>
  );
}
