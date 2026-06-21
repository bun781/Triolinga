"use client";

import type { ItemFamiliarity } from "@/lib/imported-content/types";
import { Tooltip } from "@/components/ui/Tooltip";

interface Props {
  surface: string;
  kind: "word" | "grammar" | "chunk";
  displayText: string | null;
  meaning: string | null | undefined;
  explanation: string | null | undefined;
  showMeaning: boolean;
  isSelected: boolean;
  familiarity?: ItemFamiliarity;
  onClick: () => void;
}

export function InteractiveToken({
  surface,
  kind,
  displayText,
  meaning,
  explanation,
  showMeaning,
  isSelected,
  familiarity,
  onClick
}: Props) {
  const classes = [
    "token-chip",
    `token-chip-${kind}`,
    isSelected ? "token-selected" : "",
    familiarity ? `token-fam-${familiarity}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="interactive-token-wrap">
      <Tooltip
        placement="bottom"
        content={
          <div className="tooltip-stack">
            <strong>{displayText ?? surface}</strong>
            {meaning ? <span>{meaning}</span> : null}
            {explanation ? <span className="muted">{explanation}</span> : null}
          </div>
        }
      >
        <button type="button" className={classes} onClick={onClick} aria-pressed={isSelected}>
          <span>{surface}</span>
        </button>
      </Tooltip>
      {showMeaning && meaning ? <span className="token-meaning muted">{meaning}</span> : null}
    </div>
  );
}
