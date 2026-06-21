"use client";

import type { RevealState } from "@/lib/imported-content/types";
import { Tooltip } from "@/components/ui/Tooltip";

interface Props {
  reveal: RevealState;
  onHint: () => void;
  onWordMeanings: () => void;
  onGrammar: () => void;
  onTranslation: () => void;
}

export function ProgressiveRevealControls({
  reveal,
  onHint,
  onWordMeanings,
  onGrammar,
  onTranslation
}: Props) {
  return (
    <div className="reveal-controls">
      <Tooltip content="Show or hide hints. Shortcut: H.">
        <button
          type="button"
          className={`button secondary${reveal.hint ? " active" : ""}`}
          onClick={onHint}
        >
          Hint
        </button>
      </Tooltip>
      <Tooltip content="Show or hide word meanings. Shortcut: W.">
        <button
          type="button"
          className={`button secondary${reveal.wordMeanings ? " active" : ""}`}
          onClick={onWordMeanings}
        >
          Words
        </button>
      </Tooltip>
      <Tooltip content="Show or hide grammar notes. Shortcut: G.">
        <button
          type="button"
          className={`button secondary${reveal.grammar ? " active" : ""}`}
          onClick={onGrammar}
        >
          Grammar
        </button>
      </Tooltip>
      <Tooltip content="Reveal translation. Shortcut: Space.">
        <button
          type="button"
          className={`button secondary${reveal.translation ? " active" : ""}`}
          onClick={onTranslation}
        >
          Translation
        </button>
      </Tooltip>
    </div>
  );
}
