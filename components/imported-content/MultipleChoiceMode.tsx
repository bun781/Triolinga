"use client";

import { useEffect, useState } from "react";
import type { StudyLesson } from "@/lib/imported-content/types";
import { buildQuizDeck } from "@/lib/imported-content/study-utils";

interface Props {
  lesson: StudyLesson | null;
}

export function MultipleChoiceMode({ lesson }: Props) {
  const [deck, setDeck] = useState(() => (lesson ? buildQuizDeck(lesson.sentences, lesson.sentences) : []));
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });

  useEffect(() => {
    const nextDeck = lesson ? buildQuizDeck(lesson.sentences, lesson.sentences) : [];
    setDeck(nextDeck);
    setIndex(0);
    setAnswer("");
    setSubmitted(false);
    setResult(null);
    setScore({ correct: 0, wrong: 0 });
  }, [lesson?.id]);

  const question = deck[index] ?? null;
  const completed = deck.length > 0 && index >= deck.length;
  const title = lesson?.title ?? "Multiple Choice";

  if (!lesson) {
    return (
      <section className="card stack">
        <p className="muted">No lessons yet. Save a lesson to start the multiple-choice mode.</p>
      </section>
    );
  }

  if (!deck.length) {
    return (
      <section className="card stack quiz-card">
        <div className="row">
          <h2>Multiple Choice</h2>
          <span className="pill">Lesson quiz</span>
        </div>
        <p className="muted">This lesson does not have enough annotated material yet for a quiz deck.</p>
      </section>
    );
  }

  function submit(selected?: string) {
    if (!question || submitted) return;
    const selectedAnswer = selected ?? answer;
    if (!selectedAnswer.trim()) return;

    const isCorrect = normalize(selectedAnswer) === normalize(question.answer);
    setAnswer(selectedAnswer);
    setSubmitted(true);
    setResult(isCorrect ? "correct" : "wrong");
    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1)
    }));
  }

  function nextQuestion() {
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setAnswer("");
    setSubmitted(false);
    setResult(null);
  }

  function restart() {
    if (!lesson) return;
    const nextDeck = buildQuizDeck(lesson.sentences, lesson.sentences);
    setDeck(nextDeck);
    setIndex(0);
    setAnswer("");
    setSubmitted(false);
    setResult(null);
    setScore({ correct: 0, wrong: 0 });
  }

  return (
    <section className="stack">
      <header className="card stack quiz-card">
        <div className="row">
          <div>
            <h2>Multiple Choice</h2>
            <p className="muted">{title}</p>
          </div>
          <span className="pill">Sentence pool</span>
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
          <p className="muted">
            You finished the current multiple-choice pool with {score.correct} correct and {score.wrong} missed.
          </p>
          <div className="session-stats">
            <span className="pill">Questions {deck.length}</span>
            <span className="pill grade-stat-easy">Correct {score.correct}</span>
            <span className="pill grade-stat-again">Missed {score.wrong}</span>
          </div>
          <button type="button" className="button" onClick={restart}>
            Play again
          </button>
        </section>
      ) : question ? (
        <section className="card stack quiz-card">
          <div className="row">
            <span className="pill">Question {index + 1} / {deck.length}</span>
            <span className="pill">{question.focusType === "sentence" ? "Translation" : "Vocabulary"}</span>
          </div>

          <p className="quiz-prompt">{question.prompt}</p>
          {question.focusText ? <p className="quiz-focus-text">{question.focusText}</p> : null}

          {question.type === "multiple-choice" && question.options ? (
            <div className="quiz-choices">
              {question.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={[
                    "button secondary quiz-choice",
                    submitted && normalize(option) === normalize(question.answer) ? "quiz-correct" : "",
                    submitted && normalize(option) === normalize(answer) && normalize(option) !== normalize(question.answer)
                      ? "quiz-wrong"
                      : ""
                  ].filter(Boolean).join(" ")}
                  disabled={submitted}
                  onClick={() => submit(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}

          {!submitted ? (
            <div className="stack">
              <input
                className="input"
                placeholder="Type your answer or click one above…"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submit();
                }}
              />
              <button type="button" className="button" onClick={() => submit()}>
                Check
              </button>
            </div>
          ) : (
            <div className="stack">
              <p className={`quiz-result ${result === "correct" ? "quiz-result-ok" : "quiz-result-fail"}`}>
                {result === "correct" ? "✓ Correct!" : `✗ Answer: ${question.answer}`}
              </p>
              <button type="button" className="button" onClick={nextQuestion}>
                Next →
              </button>
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
