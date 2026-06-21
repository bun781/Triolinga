"use client";

import { Tooltip } from "@/components/ui/Tooltip";

interface ReviewControlsProps {
  disabled?: boolean;
  onRemembered: () => void;
  onForgotten: () => void;
  onShuffle: () => void;
}

export function ReviewControls({ disabled, onRemembered, onForgotten, onShuffle }: ReviewControlsProps) {
  return (
    <div className="review-controls">
      <Tooltip content="Shuffle the current queue and start over.">
        <button className="button secondary" type="button" disabled={disabled} onClick={onShuffle}>
          Shuffle
        </button>
      </Tooltip>
      <div className="review-action-group">
        <Tooltip content="Mark this sentence as not remembered. Shortcut: Left Arrow.">
          <button className="button secondary review-negative" type="button" disabled={disabled} onClick={onForgotten}>
            ← Not Remembered
          </button>
        </Tooltip>
        <Tooltip content="Mark this sentence as remembered. Shortcut: Right Arrow.">
          <button className="button review-positive" type="button" disabled={disabled} onClick={onRemembered}>
            Remembered →
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
