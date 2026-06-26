// Source of truth for the 5-mode recall progression. The order is the product's core learning model — do not reorder or add modes without updating ReviewSentenceCard.tsx.
import type { RecallMode, ReviewGrade } from "./types";

export const recallModeOrder: RecallMode[] = [
  "full_support",
  "translation_hidden",
  "sentence_only",
  "fill_blank",
  "reverse_translate"
];

const recallModeLabels: Record<RecallMode, string> = {
  full_support: "Full support",
  translation_hidden: "Translation hidden",
  sentence_only: "Sentence only",
  fill_blank: "Fill blank",
  reverse_translate: "Reverse translate"
};

export function getRecallModeLabel(mode: RecallMode): string {
  return recallModeLabels[mode];
}

export function progressRecallMode(mode: RecallMode, grade: ReviewGrade): RecallMode {
  const index = recallModeOrder.indexOf(mode);
  if (index < 0) return "full_support";

  if (grade === "forgot") {
    return recallModeOrder[Math.max(0, index - 1)];
  }

  if (grade === "hard") return mode;

  const step = grade === "easy" ? 2 : 1;
  return recallModeOrder[Math.min(recallModeOrder.length - 1, index + step)];
}

export function getFillBlankPrompt(text: string, focusText?: string | null): { prompt: string; answer: string | null } {
  const candidate = focusText?.trim() || pickUsefulChunk(text);
  if (!candidate) return { prompt: text, answer: null };

  const index = text.indexOf(candidate);
  if (index < 0) return { prompt: text, answer: candidate };

  const blank = "_".repeat(Math.max(4, Math.min(candidate.length, 12)));
  return {
    prompt: `${text.slice(0, index)}${blank}${text.slice(index + candidate.length)}`,
    answer: candidate
  };
}

function pickUsefulChunk(text: string): string | null {
  const words = text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  return words.find((word) => word.replace(/[^\p{Letter}\p{Number}]/gu, "").length >= 3) ?? words[0] ?? null;
}
