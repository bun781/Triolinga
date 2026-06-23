import { describe, expect, it } from "vitest";
import { buildChoices } from "@/components/imported-content/FillBlankMode";

describe("fill blank choices", () => {
  it("always keeps the correct answer in the visible choices", () => {
    const deck = makeDeck([
      "right answer",
      "distractor one",
      "distractor two",
      "distractor three",
      "distractor four",
      "distractor five"
    ]);

    const choices = buildChoices("right answer", deck);

    expect(choices).toContain("right answer");
    expect(choices.length).toBeLessThanOrEqual(4);
  });
});

function makeDeck(answerTexts: string[]) {
  return answerTexts.map((answerText, index) => ({
    id: `card-${index}`,
    sentence: {
      id: `sentence-${index}`,
      text: `Sentence ${index}`,
      translation: "",
      audioUrl: null,
      words: [],
      grammar: [],
      chunks: []
    },
    candidate: {
      id: `candidate-${index}`,
      start: 0,
      end: 1,
      kind: "word" as const,
      displayText: answerText,
      answerText,
      meaning: null,
      explanation: null
    }
  }));
}
