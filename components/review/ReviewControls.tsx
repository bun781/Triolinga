"use client";

import { Shuffle } from "lucide-react";

interface ReviewControlsProps {
  disabled?: boolean;
  shuffleEnabled: boolean;
  onRemembered: () => void;
  onForgotten: () => void;
  onToggleShuffle: () => void;
}

export function ReviewControls({ disabled, shuffleEnabled, onRemembered, onForgotten, onToggleShuffle }: ReviewControlsProps) {
  return (
    <div className="review-controls">
      <button
        type="button"
        className={`shuffle-toggle${shuffleEnabled ? " shuffle-toggle--on" : ""}`}
        onClick={onToggleShuffle}
        disabled={disabled}
        aria-pressed={shuffleEnabled}
        aria-label={shuffleEnabled ? "Random order on" : "Random order off"}
        title={shuffleEnabled ? "Random order on" : "Random order off"}
      >
        <Shuffle size={14} className="shuffle-icon" />
        <span className="shuffle-track">
          <span className="shuffle-thumb" />
        </span>
        <span className="shuffle-label">Random order</span>
      </button>

      <div className="review-action-group">
        <button
          className="button review-negative"
          type="button"
          disabled={disabled}
          onClick={onForgotten}
          title="Not remembered  ·  ←"
        >
          ← Not Remembered
        </button>
        <button
          className="button review-positive"
          type="button"
          disabled={disabled}
          onClick={onRemembered}
          title="Remembered  ·  →"
        >
          Remembered →
        </button>
      </div>

      <p className="review-hotkey-hint" aria-label="Keyboard shortcut hint">
        Sequential when off, random when on. Use <kbd>←</kbd> for Not Remembered and <kbd>→</kbd> for Remembered.
      </p>
    </div>
  );
}
