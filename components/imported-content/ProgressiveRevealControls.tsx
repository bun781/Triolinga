"use client";

import type { RevealState } from "@/lib/imported-content/types";

interface Props {
  reveal: RevealState;
  hasAudio: boolean;
  onHint: () => void;
  onWordMeanings: () => void;
  onGrammar: () => void;
  onTranslation: () => void;
  onAudio: () => void;
}

export function ProgressiveRevealControls({
  reveal,
  onHint,
  onWordMeanings,
  onGrammar,
  onTranslation,
  onAudio
}: Props) {
  return (
    <div className="reveal-controls">
      <button
        type="button"
        className={`button secondary${reveal.hint ? " active" : ""}`}
        onClick={onHint}
        title="H"
      >
        Hint
      </button>
      <button
        type="button"
        className={`button secondary${reveal.wordMeanings ? " active" : ""}`}
        onClick={onWordMeanings}
        title="W"
      >
        Words
      </button>
      <button
        type="button"
        className={`button secondary${reveal.grammar ? " active" : ""}`}
        onClick={onGrammar}
        title="G"
      >
        Grammar
      </button>
      <button
        type="button"
        className={`button secondary${reveal.translation ? " active" : ""}`}
        onClick={onTranslation}
        title="Space"
      >
        Translation
      </button>
      <button type="button" className="button secondary icon-only" onClick={onAudio} title="A — Play audio" aria-label="Play audio">
        ♪
      </button>
    </div>
  );
}
