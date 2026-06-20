import type { DrillBlueprint, LessonSentenceInput } from "@/lib/language/types";

export function generateSentenceForgeDrills(sentence: LessonSentenceInput): DrillBlueprint[] {
  const focusText = sentence.chunks?.[0]?.surface
    ?? sentence.words?.[0]?.surface
    ?? sentence.grammar?.[0]?.surface
    ?? sentence.grammar?.[0]?.pattern
    ?? sentence.text;
  const answer = focusText && sentence.text.includes(focusText)
    ? focusText
    : sentence.text;
  const tokens = sentence.words?.length
    ? sentence.words.map((word) => word.surface).filter(Boolean)
    : splitSentence(sentence.text);

  return [
    {
      type: "recall",
      prompt: sentence.translation ? `Translate into the target language: ${sentence.translation}` : "Translate into the target language.",
      answer: sentence.text,
      payload: {}
    },
    {
      type: "reconstruction",
      prompt: "Rebuild the sentence.",
      answer: sentence.text,
      payload: { tokens: shuffleStable(tokens) }
    },
    {
      type: "cloze",
      prompt: buildClozePrompt(sentence.text, answer),
      answer,
      payload: { hidden: answer }
    },
    {
      type: "transformation",
      prompt: "Change the sentence as prompted by your teacher.",
      answer: sentence.text,
      payload: {}
    },
    {
      type: "original_sentence",
      prompt: `Write one original sentence using ${focusText}.`,
      answer: focusText,
      payload: { selfGraded: true }
    }
  ];
}

function splitSentence(sentence: string): string[] {
  const byWhitespace = sentence.trim().split(/\s+/).filter(Boolean);
  if (byWhitespace.length > 1) return byWhitespace;
  return Array.from(sentence.trim()).filter((character) => character.trim().length > 0);
}

function buildClozePrompt(sentence: string, answer: string): string {
  if (answer && sentence.includes(answer)) {
    return sentence.replace(answer, "____");
  }

  return `${sentence}\nFill the focus blank.`;
}

function shuffleStable(tokens: string[]): string[] {
  return tokens
    .map((token, index) => ({ token, rank: hashRank(`${token}:${index}`) }))
    .sort((left, right) => left.rank - right.rank)
    .map(({ token }) => token);
}

function hashRank(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) % 9973;
  }
  return hash;
}
