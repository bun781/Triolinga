"use client";

import { useId } from "react";
import type { StudySentence } from "@/lib/imported-content/types";

interface AnnotationRange {
  start: number;
  end: number;
  kind: "word" | "grammar" | "chunk";
  displayText: string;
  meaning: string | null;
  explanation: string | null;
}

type Run =
  | { kind: "plain"; text: string }
  | { kind: "annotated"; text: string; range: AnnotationRange };

const PRIORITY: Record<string, number> = { word: 0, grammar: 1, chunk: 2 };

function buildRuns(sentence: StudySentence): Run[] {
  const { text } = sentence;
  const ranges: AnnotationRange[] = [];

  for (const word of sentence.words) {
    const start = text.indexOf(word.surface);
    if (start >= 0) {
      ranges.push({ start, end: start + word.surface.length, kind: "word", displayText: word.displayText, meaning: word.meaning, explanation: word.explanation });
    }
  }
  for (const g of sentence.grammar) {
    const start = text.indexOf(g.surfaceText);
    if (start >= 0) {
      ranges.push({ start, end: start + g.surfaceText.length, kind: "grammar", displayText: g.pattern, meaning: g.meaning, explanation: g.explanation });
    }
  }
  for (const c of sentence.chunks) {
    const start = text.indexOf(c.surfaceText);
    if (start >= 0) {
      ranges.push({ start, end: start + c.surfaceText.length, kind: "chunk", displayText: c.surfaceText, meaning: c.meaning, explanation: c.explanation });
    }
  }

  const charMap: (AnnotationRange | null)[] = new Array(text.length).fill(null);
  for (let i = 0; i < text.length; i++) {
    let best: AnnotationRange | null = null;
    for (const range of ranges) {
      if (i >= range.start && i < range.end) {
        if (!best || PRIORITY[range.kind] < PRIORITY[best.kind]) best = range;
      }
    }
    charMap[i] = best;
  }

  const runs: Run[] = [];
  let i = 0;
  while (i < text.length) {
    const range = charMap[i];
    if (!range) {
      let j = i;
      while (j < text.length && !charMap[j]) j++;
      runs.push({ kind: "plain", text: text.slice(i, j) });
      i = j;
    } else {
      let j = i;
      while (j < text.length && charMap[j] === range) j++;
      runs.push({ kind: "annotated", text: text.slice(i, j), range });
      i = j;
    }
  }

  return runs;
}

export function AnnotatedSentence({ sentence }: { sentence: StudySentence }) {
  const baseId = useId();
  const runs = buildRuns(sentence);
  const hasAnnotations = runs.some((r) => r.kind === "annotated");

  if (!hasAnnotations) {
    return <p className="sentence-text">{sentence.text}</p>;
  }

  return (
    <p className="sentence-text">
      {runs.map((run, i) => {
        if (run.kind === "plain") return <span key={i}>{run.text}</span>;

        const tipId = `${baseId}-t${i}`;
        return (
          <span key={i} className="tooltip-wrap tooltip-bottom sentence-annotated-wrap">
            <span className={`annotated-${run.range.kind} sentence-annotated`} aria-describedby={tipId}>
              {run.text}
            </span>
            <span className="tooltip-bubble" role="tooltip" id={tipId}>
              <span className="tooltip-stack">
                <strong>{run.range.displayText}</strong>
                {run.range.meaning ? <span>{run.range.meaning}</span> : null}
                {run.range.explanation ? <span className="muted">{run.range.explanation}</span> : null}
              </span>
            </span>
          </span>
        );
      })}
    </p>
  );
}
