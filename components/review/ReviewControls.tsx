"use client";

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
      <label className="shuffle-toggle" title="Shuffle the review queue">
        <input
          type="checkbox"
          checked={shuffleEnabled}
          onChange={onToggleShuffle}
          disabled={disabled}
        />
        <span className="shuffle-toggle-track">
          <span className="shuffle-toggle-thumb" />
        </span>
        <span className="shuffle-toggle-label">Shuffle</span>
      </label>

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
    </div>
  );
}
