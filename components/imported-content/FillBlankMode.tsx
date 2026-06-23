"use client";

import { useEffect, useMemo, useState } from "react";
import { AudioButton } from "@/components/ui/AudioButton";
import type { StudyLesson, StudySentence } from "@/lib/imported-content/types";
import { buildClozeCandidates, type ClozeCandidate } from "@/lib/imported-content/study-utils";
import { answersMatch, normalizePracticeAnswer } from "@/lib/imported-content/text-spans";

interface Props {
  lesson: StudyLesson | null;
}

type AnswerMode = "type" | "choice";

interface FillBlankCard {
  id: string;
  sentence: StudySentence;
  candidate: ClozeCandidate;
}

export function FillBlankMode({ lesson }: Props) {
  const [deck, setDeck] = useState<FillBlankCard[]>(() => buildFillBlankDeck(lesson));
  const [index, setIndex] = useState(0);
  const [answerMode, setAnswerMode] = useState<AnswerMode>("type");
  const [answer, setAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });

  useEffect(() => {
    setDeck(buildFillBlankDeck(lesson));
    setIndex(0);
    setAnswerMode("type");
    setAnswer("");
    setSelectedChoice(null);
    setSubmitted(false);
    setResult(null);
    setScore({ correct: 0, wrong: 0 });
  }, [lesson]);

  const card = deck[index] ?? null;
  const completed = deck.length > 0 && index >= deck.length;
  const choices = useMemo(() => buildChoices(card?.candidate.answerText ?? null, deck), [card?.candidate.answerText, deck]);

  if (!lesson) {
    return (
      <section className="card stack">
        <p className="muted">No lessons yet. Save a lesson to start Fill Blank.</p>
      </section>
    );
  }

  if (!deck.length) {
    return (
      <section className="card stack quiz-card">
        <div className="row">
          <h2>Fill Blank</h2>
          <span className="pill">Cloze</span>
        </div>
        <p className="muted">This lesson needs word, grammar, or chunk annotations before it can make fill-in-the-blank cards.</p>
      </section>
    );
  }

  function submit(value?: string) {
    if (!card || submitted) return;
    const selectedAnswer = value ?? answer;
    if (!selectedAnswer.trim()) return;

    const isCorrect = answersMatch(selectedAnswer, card.candidate.answerText);
    setAnswer(selectedAnswer);
    setSelectedChoice(value ?? null);
    setSubmitted(true);
    setResult(isCorrect ? "correct" : "wrong");
    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1)
    }));
  }

  function nextCard() {
    setIndex((current) => current + 1);
    setAnswer("");
    setSelectedChoice(null);
    setSubmitted(false);
    setResult(null);
  }

  function restart() {
    setDeck(buildFillBlankDeck(lesson));
    setIndex(0);
    setAnswerMode("type");
    setAnswer("");
    setSelectedChoice(null);
    setSubmitted(false);
    setResult(null);
    setScore({ correct: 0, wrong: 0 });
  }

  return (
    <section className="stack">
      <header className="card stack quiz-card">
        <div className="row">
          <div>
            <h2>Fill Blank</h2>
            <p className="muted">{lesson.title}</p>
          </div>
          <span className="pill">Cloze</span>
        </div>
        <div className="session-stats">
          <span className="pill">Score {score.correct}/{Math.max(1, score.correct + score.wrong)}</span>
          <span className="pill">Left {Math.max(0, deck.length - index - (submitted ? 1 : 0))}</span>
        </div>
      </header>

      {completed ? (
        <section className="card stack quiz-card">
          <div className="row">
            <h2>Session complete</h2>
            <span className="pill">Done</span>
          </div>
          <p className="muted">You finished this fill-blank pool with {score.correct} correct and {score.wrong} missed.</p>
          <button type="button" className="button" onClick={restart}>Play again</button>
        </section>
      ) : card ? (
        <section className="card stack quiz-card">
          <div className="row">
            <span className="pill">Question {index + 1} / {deck.length}</span>
            <span className={`pill cloze-kind-${card.candidate.kind}`}>{card.candidate.kind}</span>
          </div>

          <div className="cloze-context">
            <span className="cloze-context-label">Translation</span>
            <p>{card.sentence.translation}</p>
          </div>

          <div className="cloze-clue-card">
            <span className="cloze-context-label">Clue</span>
            <dl>
              <div>
                <dt>Focus</dt>
                <dd>{formatKind(card.candidate.kind)}</dd>
              </div>
              {card.candidate.meaning ? (
                <div>
                  <dt>Meaning</dt>
                  <dd>{card.candidate.meaning}</dd>
                </div>
              ) : null}
              {card.candidate.explanation ? (
                <div>
                  <dt>Note</dt>
                  <dd>{card.candidate.explanation}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="sentence-line quiz-focus-row">
            <span className="cloze-context-label">Listen</span>
            <AudioButton
              sentence={card.candidate.answerText}
              language={lesson.language}
              compact
              label={`Play ${formatKind(card.candidate.kind)} aloud`}
            />
          </div>

          <p className="sentence-text practice-sentence">
            <span>{card.sentence.text.slice(0, card.candidate.start)}</span>
            <span className={`cloze-blank cloze-kind-${card.candidate.kind}`}>
              {submitted ? card.candidate.answerText : ""}
            </span>
            <span>{card.sentence.text.slice(card.candidate.end)}</span>
          </p>

          <div className="mode-tabs cloze-answer-tabs" role="tablist" aria-label="Answer style">
            <button type="button" className={answerMode === "type" ? "active" : ""} onClick={() => setAnswerMode("type")}>
              Type
            </button>
            <button
              type="button"
              className={answerMode === "choice" ? "active" : ""}
              disabled={choices.length < 2}
              onClick={() => setAnswerMode("choice")}
            >
              Multiple choice
            </button>
          </div>

          {answerMode === "choice" && choices.length >= 2 ? (
            <div className="cloze-choice-grid">
              {choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={[
                    "button secondary cloze-choice",
                    selectedChoice === choice ? "selected" : "",
                    submitted && answersMatch(choice, card.candidate.answerText) ? "correct" : "",
                    submitted && selectedChoice === choice && !answersMatch(choice, card.candidate.answerText) ? "incorrect" : ""
                  ].filter(Boolean).join(" ")}
                  disabled={submitted}
                  onClick={() => submit(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : (
            <div className="practice-answer-row">
              <input
                className="input"
                value={answer}
                placeholder="Type the missing text"
                disabled={submitted}
                onChange={(event) => setAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submit();
                }}
              />
              <button type="button" className="button secondary" disabled={submitted} onClick={() => submit()}>Check</button>
            </div>
          )}

          {submitted ? (
            <div className="stack">
              <p className={`quiz-result ${result === "correct" ? "quiz-result-ok" : "quiz-result-fail"}`}>
                {result === "correct" ? "Correct!" : `Answer: ${card.candidate.answerText}`}
              </p>
              <button type="button" className="button" onClick={nextCard}>Next →</button>
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

function buildFillBlankDeck(lesson: StudyLesson | null): FillBlankCard[] {
  if (!lesson) return [];
  return lesson.sentences.flatMap((sentence) =>
    buildClozeCandidates(sentence).map((candidate) => ({
      id: `${sentence.id}:${candidate.id}`,
      sentence,
      candidate
    }))
  );
}

export function buildChoices(answer: string | null, deck: FillBlankCard[]): string[] {
  if (!answer) return [];
  const seen = new Set([normalizePracticeAnswer(answer)]);
  const distractors: string[] = [];

  for (const card of deck) {
    const key = normalizePracticeAnswer(card.candidate.answerText);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    distractors.push(card.candidate.answerText);
  }

  return stableShuffle([answer, ...distractors.slice(0, 3)], answer);
}

function stableShuffle(values: string[], seed: string): string[] {
  const out = [...values];
  let state = 0;
  for (let i = 0; i < seed.length; i += 1) state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function formatKind(kind: ClozeCandidate["kind"]): string {
  if (kind === "word") return "Vocabulary";
  if (kind === "grammar") return "Grammar pattern";
  return "Chunk / expression";
}
