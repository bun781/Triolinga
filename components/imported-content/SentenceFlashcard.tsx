"use client";

import { useState } from "react";
import type { ItemFamiliarity, RevealState, SelectedItem, StudySentence } from "@/lib/imported-content/types";
import type { ReviewDecision } from "@/lib/review/types";
import { getHint } from "@/lib/imported-content/study-utils";
import { useSpeech } from "@/lib/useSpeech";
import { InteractiveToken } from "./InteractiveToken";
import { ProgressiveRevealControls } from "./ProgressiveRevealControls";
import { RelatedSentences } from "./RelatedSentences";
import { StudyDetailsPanel } from "./StudyDetailsPanel";
import { AudioButton } from "@/components/ui/AudioButton";

interface Props {
  sentence: StudySentence;
  cardIndex: number;
  totalCards: number;
  lessonTitle: string;
  language: string;
  allSentences: StudySentence[];
  reveal: RevealState;
  sessionFamiliarity: Map<string, ItemFamiliarity>;
  currentGrade: string | null;
  reviewMode: boolean;
  reviewState: ReviewDecision | null;
  isSavingReview: boolean;
  reviewError: string | null;
  onRevealTranslation: () => void;
  onToggleWordMeanings: () => void;
  onToggleGrammar: () => void;
  onToggleHint: () => void;
  onGrade: (grade: "easy" | "correct" | "hard" | "failed") => void;
  randomOrderEnabled: boolean;
  onToggleRandomOrder: () => void;
  onReview: (decision: ReviewDecision) => void;
  onPrev: () => void;
  onNext: () => void;
}

const GRADES = [
  { id: "failed", label: "Again" },
  { id: "hard", label: "Hard" },
  { id: "correct", label: "Good" },
  { id: "easy", label: "Easy" }
] as const;

export function SentenceFlashcard({
  sentence,
  cardIndex,
  totalCards,
  lessonTitle,
  language,
  allSentences,
  reveal,
  sessionFamiliarity,
  currentGrade,
  reviewMode,
  reviewState,
  isSavingReview,
  reviewError,
  onRevealTranslation,
  onToggleWordMeanings,
  onToggleGrammar,
  onToggleHint,
  onGrade,
  randomOrderEnabled,
  onToggleRandomOrder,
  onReview,
  onPrev,
  onNext
}: Props) {
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const speak = useSpeech(language);

  const progress = ((cardIndex + 1) / totalCards) * 100;
  const hint = reveal.hint ? getHint(sentence) : null;
  const revealInstruction = "Click or press Space to reveal";

  function toggleItem(item: SelectedItem) {
    const surface =
      item.kind === "word" ? item.data.surface :
      item.kind === "grammar" ? item.data.surfaceText :
      item.data.surfaceText;
    speak(surface);
    setSelectedItem((prev) => {
      if (!prev || prev.kind !== item.kind) return item;
      const prevKey = prev.data.canonicalKey;
      const itemKey = item.data.canonicalKey;
      return prevKey === itemKey ? null : item;
    });
  }

  function isSelected(kind: SelectedItem["kind"], key: string): boolean {
    if (!selectedItem || selectedItem.kind !== kind) return false;
    return selectedItem.data.canonicalKey === key;
  }

  return (
    <div className="flashcard card stack">
      {/* Header */}
      <div className="row">
        <span className="muted">{lessonTitle}</span>
        <span className="pill">{reviewMode ? "Review" : "Card"} {cardIndex + 1} / {totalCards}</span>
      </div>

      {/* Progress bar */}
      <div className="flashcard-progress" role="progressbar" aria-valuenow={cardIndex + 1} aria-valuemax={totalCards}>
        <div className="flashcard-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Sentence */}
      <div className="sentence-line">
        <p className="sentence-text">{sentence.text}</p>
        <AudioButton sentence={sentence.text} language={language} compact />
      </div>

      {/* Word tokens */}
      {sentence.words.length > 0 ? (
        <div className="token-row">
          {sentence.words.map((word, i) => (
            <InteractiveToken
              key={word.canonicalKey || `w${i}`}
              surface={word.surface}
              kind="word"
              displayText={word.displayText}
              meaning={word.meaning}
              explanation={word.explanation}
              showMeaning={reveal.wordMeanings}
              isSelected={isSelected("word", word.canonicalKey)}
              familiarity={sessionFamiliarity.get(word.canonicalKey)}
              onClick={() => toggleItem({ kind: "word", data: word })}
            />
          ))}
        </div>
      ) : null}

      {/* Grammar tags */}
      {sentence.grammar.length > 0 ? (
        <div className="token-row">
          {sentence.grammar.map((g, i) => (
            <InteractiveToken
              key={g.canonicalKey || `g${i}`}
              surface={g.surfaceText}
              kind="grammar"
              displayText={g.pattern}
              meaning={g.meaning}
              explanation={g.explanation}
              showMeaning={reveal.grammar}
              isSelected={isSelected("grammar", g.canonicalKey)}
              familiarity={sessionFamiliarity.get(g.canonicalKey)}
              onClick={() => toggleItem({ kind: "grammar", data: g })}
            />
          ))}
        </div>
      ) : null}

      {/* Chunk tags */}
      {sentence.chunks.length > 0 ? (
        <div className="token-row">
          {sentence.chunks.map((c, i) => (
            <InteractiveToken
              key={c.canonicalKey || `c${i}`}
              surface={c.surfaceText}
              kind="chunk"
              displayText={null}
              meaning={c.meaning}
              explanation={c.explanation}
              showMeaning={reveal.wordMeanings}
              isSelected={isSelected("chunk", c.canonicalKey)}
              familiarity={sessionFamiliarity.get(c.canonicalKey)}
              onClick={() => toggleItem({ kind: "chunk", data: c })}
            />
          ))}
        </div>
      ) : null}

      {/* Hint */}
      {hint ? <p className="flashcard-hint">{hint}</p> : null}

      {/* Reveal controls */}
      <ProgressiveRevealControls
        reveal={reveal}
        onHint={onToggleHint}
        onWordMeanings={onToggleWordMeanings}
        onGrammar={onToggleGrammar}
        onTranslation={onRevealTranslation}
      />

      {/* Translation */}
      <div
        className={`flashcard-translation${reveal.translation ? "" : " translation-hidden"}`}
        onClick={reveal.translation ? undefined : onRevealTranslation}
        role={reveal.translation ? undefined : "button"}
        tabIndex={reveal.translation ? undefined : 0}
        onKeyDown={
          reveal.translation
            ? undefined
            : (e) => { if (e.key === "Enter" || e.key === " ") onRevealTranslation(); }
        }
        aria-label={reveal.translation ? undefined : revealInstruction}
      >
        {reveal.translation ? (
          sentence.translation
        ) : (
          <>
            <span className="translation-hidden-text" aria-hidden="true">{sentence.translation}</span>
            <span className="translation-reveal-prompt">{revealInstruction}</span>
          </>
        )}
      </div>

      {/* Selected item details */}
      {selectedItem ? <StudyDetailsPanel item={selectedItem} /> : null}

      {/* Related sentences */}
      <RelatedSentences
        currentSentence={sentence}
        allSentences={allSentences}
        selectedItem={selectedItem}
      />

      {!reviewMode ? (
        <div className="grade-row">
          {GRADES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`button secondary grade-btn grade-${id}${currentGrade === id ? " active" : ""}`}
              onClick={() => onGrade(id)}
            >
              {label}
            </button>
          ))}
          <div className="grade-row-spacer" />
          <button
            type="button"
            className={`button secondary random-order-toggle${randomOrderEnabled ? " active" : ""}`}
            onClick={onToggleRandomOrder}
            aria-pressed={randomOrderEnabled}
            title={randomOrderEnabled ? "Random order on" : "Random order off"}
          >
            Random order {randomOrderEnabled ? "On" : "Off"}
          </button>
        </div>
      ) : null}

      {reviewMode ? (
        <div className="review-decision-row" aria-busy={isSavingReview}>
          <button
            type="button"
            className={`button review-negative${reviewState === "forgotten" ? " review-selected" : ""}`}
            onClick={() => onReview("forgotten")}
            title="Not remembered  ·  ←"
          >
            ← Not remembered
          </button>
          <button
            type="button"
            className={`button review-positive${reviewState === "remembered" ? " review-selected" : ""}`}
            onClick={() => onReview("remembered")}
            title="Remembered  ·  →"
          >
            Remembered →
          </button>
          {reviewError ? <p className="review-error">{reviewError}</p> : null}
        </div>
      ) : null}

      {!reviewMode ? (
        <div className="row">
          <button
            type="button"
            className="button secondary"
            disabled={cardIndex === 0}
            onClick={onPrev}
          >
            ← Previous
          </button>
          <button
            type="button"
            className="button"
            onClick={onNext}
          >
            {cardIndex >= totalCards - 1 ? "Finish →" : "Next →"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
