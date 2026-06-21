"use client";

import type { ReviewSentence } from "@/lib/review/types";

interface ReviewSentenceCardProps {
  sentence: ReviewSentence;
  index: number;
  total: number;
}

export function ReviewSentenceCard({ sentence, index, total }: ReviewSentenceCardProps) {
  return (
    <section className="review-card">
      <div className="review-card-meta">
        <span className="pill">Sentence {index + 1} of {total}</span>
        <span className={`pill review-state-${sentence.reviewState}`}>{sentence.reviewState}</span>
      </div>
      <p className="review-sentence">{sentence.text}</p>
      <p className="review-translation">{sentence.translation}</p>
      <div className="review-stats">
        <span>Streak {sentence.reviewStreak}</span>
        <span>{sentence.reviewedAt ? `Last reviewed ${new Date(sentence.reviewedAt).toLocaleString()}` : "Never reviewed"}</span>
      </div>
    </section>
  );
}
