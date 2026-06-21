"use client";

import { useState } from "react";
import type { ItemFamiliarity, RevealState, SelectedItem, StudySentence } from "@/lib/imported-content/types";
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
  onRevealTranslation: () => void;
  onToggleWordMeanings: () => void;
  onToggleGrammar: () => void;
  onToggleHint: () => void;
  onGrade: (grade: "easy" | "correct" | "hard" | "failed") => void;
  onPrev: () => void;
  onNext: () => void;
}

const GRADES = [
  { id: "failed", label: "Failed" },
  { id: "hard", label: "Hard" },
  { id: "correct", label: "Correct" },
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
  onRevealTranslation,
  onToggleWordMeanings,
  onToggleGrammar,
  onToggleHint,
  onGrade,
  onPrev,
  onNext
}: Props) {
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const speak = useSpeech(language);

  const progress = ((cardIndex + 1) / totalCards) * 100;
  const hint = reveal.hint ? getHint(sentence) : null;

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
        <span className="pill">Card {cardIndex + 1} / {totalCards}</span>
      </div>

      {/* Progress bar */}
      <div className="flashcard-progress" role="progressbar" aria-valuenow={cardIndex + 1} aria-valuemax={totalCards}>
        <div className="flashcard-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Sentence */}
      <p className="sentence-text">{sentence.text}</p>

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

      <AudioButton sentence={sentence.text} language={language} compact />

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
        aria-label={reveal.translation ? undefined : "Click to reveal translation"}
      >
        {reveal.translation ? sentence.translation : "···"}
      </div>

      {/* Selected item details */}
      {selectedItem ? <StudyDetailsPanel item={selectedItem} /> : null}

      {/* Related sentences */}
      <RelatedSentences
        currentSentence={sentence}
        allSentences={allSentences}
        selectedItem={selectedItem}
      />

      {/* Difficulty grade */}
      <div className="grade-grid">
        {GRADES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`button secondary${currentGrade === id ? " active" : ""}`}
            onClick={() => onGrade(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Navigation */}
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
          disabled={cardIndex >= totalCards - 1}
          onClick={onNext}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
