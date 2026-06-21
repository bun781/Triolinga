import type { QuizQuestion, SelectedItem, StudySentence } from "./types";

export function findRelatedSentences(
  current: StudySentence,
  all: StudySentence[],
  selected: SelectedItem | null,
  max = 3
): Array<{ sentence: StudySentence; reason: string }> {
  if (!selected) return [];
  const results: Array<{ sentence: StudySentence; reason: string }> = [];

  for (const sentence of all) {
    if (results.length >= max) break;
    if (sentence.id === current.id) continue;

    if (selected.kind === "word") {
      const key = selected.data.canonicalKey;
      if (sentence.words.some((w) => w.canonicalKey === key)) {
        results.push({ sentence, reason: `Uses "${selected.data.surface}"` });
      }
    } else if (selected.kind === "grammar") {
      const key = selected.data.canonicalKey;
      if (sentence.grammar.some((g) => g.canonicalKey === key)) {
        results.push({ sentence, reason: `Uses "${selected.data.pattern}"` });
      }
    } else if (selected.kind === "chunk") {
      const key = selected.data.canonicalKey;
      if (sentence.chunks.some((c) => c.canonicalKey === key)) {
        results.push({ sentence, reason: `Uses "${selected.data.surfaceText}"` });
      }
    }
  }

  return results;
}

export function getHint(sentence: StudySentence): string | null {
  const firstWord = sentence.words.find((w) => w.meaning);
  if (firstWord) return `${firstWord.surface} = ${firstWord.meaning}`;
  const firstGrammar = sentence.grammar.find((g) => g.meaning);
  if (firstGrammar) return `${firstGrammar.surfaceText} = ${firstGrammar.meaning}`;
  return null;
}

export function generateQuizQuestion(
  recent: StudySentence[],
  all: StudySentence[]
): QuizQuestion | null {
  const deck = buildQuizDeck(recent, all);
  return deck.length ? deck[Math.floor(Math.random() * deck.length)] : null;
}

export function buildQuizDeck(recent: StudySentence[], all: StudySentence[]): QuizQuestion[] {
  const wordQuestions = buildWordQuestions(recent, all);
  const sentenceQuestions = buildSentenceQuestions(recent);
  return shuffle([...wordQuestions, ...sentenceQuestions]);
}

function buildWordQuestions(recent: StudySentence[], all: StudySentence[]): QuizQuestion[] {
  const wordPool = recent.flatMap((sentence) =>
    sentence.words
      .filter((word) => word.meaning)
      .map((word) => ({
        sentenceId: sentence.id,
        sentenceText: sentence.text,
        surface: word.surface,
        meaning: word.meaning as string,
        canonicalKey: word.canonicalKey
      }))
  );

  const uniqueTargets = new Map<string, (typeof wordPool)[number]>();
  for (const target of wordPool) {
    const key = `${target.canonicalKey}:${target.meaning}`;
    if (!uniqueTargets.has(key)) uniqueTargets.set(key, target);
  }

  const allMeanings = [
    ...new Set(
      all
        .flatMap((sentence) => sentence.words)
        .filter((word) => word.meaning)
        .map((word) => word.meaning as string)
    )
  ];

  const questions: QuizQuestion[] = [];

  for (const target of uniqueTargets.values()) {
    const distractors = allMeanings.filter((meaning) => meaning !== target.meaning).slice(0, 3);
    if (distractors.length < 2) continue;

    questions.push({
      type: "multiple-choice",
      prompt: `What does "${target.surface}" mean?`,
      options: shuffle([target.meaning, ...distractors]),
      answer: target.meaning,
      sentenceId: target.sentenceId,
      focusType: "word",
      focusText: target.surface
    });
  }

  return questions;
}

function buildSentenceQuestions(sentences: StudySentence[]): QuizQuestion[] {
  const sentencePool = sentences
    .filter((sentence) => sentence.translation)
    .map((sentence) => ({
      sentenceId: sentence.id,
      prompt: `Which translation matches this sentence?`,
      sentenceText: sentence.text,
      answer: sentence.translation
    }));

  const translations = [
    ...new Set(sentencePool.map((sentence) => sentence.answer))
  ];

  const questions: QuizQuestion[] = [];

  for (const target of sentencePool) {
    const distractors = translations.filter((translation) => translation !== target.answer).slice(0, 3);
    if (distractors.length < 2) continue;

    questions.push({
      type: "multiple-choice",
      prompt: target.prompt,
      options: shuffle([target.answer, ...distractors]),
      answer: target.answer,
      sentenceId: target.sentenceId,
      focusType: "sentence",
      focusText: target.sentenceText
    });
  }

  return questions;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
