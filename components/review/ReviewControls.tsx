"use client";

interface ReviewControlsProps {
  disabled?: boolean;
  onRemembered: () => void;
  onForgotten: () => void;
  onShuffle: () => void;
}

export function ReviewControls({ disabled, onRemembered, onForgotten, onShuffle }: ReviewControlsProps) {
  return (
    <div className="review-controls">
      <button className="button secondary" type="button" disabled={disabled} onClick={onShuffle}>
        Shuffle
      </button>
      <div className="review-action-group">
        <button className="button secondary review-negative" type="button" disabled={disabled} onClick={onForgotten}>
          ← Not Remembered
        </button>
        <button className="button review-positive" type="button" disabled={disabled} onClick={onRemembered}>
          Remembered →
        </button>
      </div>
    </div>
  );
}
