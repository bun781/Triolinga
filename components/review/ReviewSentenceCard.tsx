"use client";

import { AudioButton } from "@/components/ui/AudioButton";
import type { ReviewSentence } from "@/lib/review/types";

interface ReviewSentenceCardProps {
  sentence: ReviewSentence;
  index: number;
  total: number;
  revealed: boolean;
}

export function ReviewSentenceCard({ sentence, index, total, revealed }: ReviewSentenceCardProps) {
  return (
    <section className="review-card">
      <div className="review-card-meta">
        <span className="pill">Sentence {index + 1} of {total}</span>
        <span className={`pill review-state-${sentence.reviewState}`}>{sentence.reviewState}</span>
      </div>
      <div className="review-sentence-row">
        <p className="review-sentence">{sentence.text}</p>
        <AudioButton sentence={sentence.text} language={sentence.language} compact />
      </div>
      {revealed ? (
        <p className="review-translation">{sentence.translation}</p>
      ) : (
        <p className="review-reveal-hint">Press Space to reveal</p>
      )}
      <div className="review-stats">
        <span>Streak {sentence.reviewStreak}</span>
        <span>{sentence.reviewedAt ? `Last reviewed ${new Date(sentence.reviewedAt).toLocaleString()}` : "Never reviewed"}</span>
      </div>
    </section>
  );
}
