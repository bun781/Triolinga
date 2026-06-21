"use client";

import { Tooltip } from "@/components/ui/Tooltip";

interface InteractiveSentenceToken {
  id?: string;
  text: string;
  meaning?: string | null;
  explanation?: string | null;
  commonMistakes?: string[] | null;
  canonicalKey?: string | null;
  learningItemId?: string | null;
}

interface InteractiveSentenceProps {
  sentence: string;
  tokens: InteractiveSentenceToken[];
}

export function InteractiveSentence({ sentence, tokens }: InteractiveSentenceProps) {
  if (!tokens.length) {
    return <p className="sentence-text">{sentence}</p>;
  }

  return (
    <div className="interactive-sentence" aria-label={sentence}>
      {tokens.map((token, index) => (
        <Tooltip
          placement="bottom"
          key={token.id ?? `${token.text}-${index}`}
          content={
            <div className="tooltip-stack">
              <strong>{token.text}</strong>
              {token.meaning ? <span>{token.meaning}</span> : null}
              {token.explanation ? <span>{token.explanation}</span> : null}
              {token.commonMistakes?.length ? <span>{token.commonMistakes.join("; ")}</span> : null}
              {token.learningItemId ? <span>{token.canonicalKey}</span> : null}
            </div>
          }
        >
          <button className="token-chip" type="button">
            <span>{token.text}</span>
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
