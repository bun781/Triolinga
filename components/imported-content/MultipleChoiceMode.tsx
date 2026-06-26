"use client";

import { useEffect, useMemo, useState } from "react";
import { AudioButton } from "@/components/ui/AudioButton";
import { getLesson } from "@/lib/desktopApi";
import type { QuizQuestion, StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import { buildQuizDeck } from "@/lib/imported-content/study-utils";
import { clearSessionProgress, readSessionProgress, writeSessionProgress } from "./sessionProgress";

interface Props {
  lesson: StudyLesson | null;
  lessons?: StudyLessonMeta[];
}

type TestMode = "continuous" | "full";
type TestStatus = "setup" | "active" | "complete";

interface SavedTestResult {
  id: string;
  completedAt: string;
  mode: TestMode;
  lessonTitles: string[];
  questionCount: number;
  correct: number;
  wrong: number;
}

interface MultipleChoiceProgress {
  selectedLessonIds: string[];
  questionCount: number;
  testMode: TestMode;
  status: TestStatus;
  deck: QuizQuestion[];
  index: number;
  answers: Record<string, string>;
  submittedCards: string[];
  score: { correct: number; wrong: number };
  resultSaved: boolean;
  showResults: boolean;
}

const RESULTS_KEY = "fydor.multiple-choice-test-results";
const DEFAULT_QUESTION_COUNT = 10;
const PROGRESS_KEY = "multiple-choice";

export function MultipleChoiceMode({ lesson, lessons = [] }: Props) {
  const availableLessons = useMemo(() => (
    lessons.length ? lessons : lesson ? [lessonToMeta(lesson)] : []
  ), [lesson, lessons]);
  const [initialProgress] = useState(() => readSessionProgress(PROGRESS_KEY, validateMultipleChoiceProgress));
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(() => {
    return new Set(initialProgress?.selectedLessonIds ?? (lesson ? [lesson.id] : []));
  });
  const [loadedLessons, setLoadedLessons] = useState<StudyLesson[]>(() => (lesson ? [lesson] : []));
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(() => initialProgress?.questionCount ?? DEFAULT_QUESTION_COUNT);
  const [testMode, setTestMode] = useState<TestMode>(() => initialProgress?.testMode ?? "continuous");
  const [showResults, setShowResults] = useState(() => initialProgress?.showResults ?? false);
  const [savedResults, setSavedResults] = useState<SavedTestResult[]>(() => readSavedResults());
  const [status, setStatus] = useState<TestStatus>(() => initialProgress?.status ?? "setup");
  const [deck, setDeck] = useState<QuizQuestion[]>(() => initialProgress?.deck ?? []);
  const [index, setIndex] = useState(() => initialProgress?.index ?? 0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => initialProgress?.answers ?? {});
  const [submittedCards, setSubmittedCards] = useState<Set<string>>(() => (
    new Set(initialProgress?.submittedCards ?? [])
  ));
  const [score, setScore] = useState(() => initialProgress?.score ?? { correct: 0, wrong: 0 });
  const [resultSaved, setResultSaved] = useState(() => initialProgress?.resultSaved ?? false);

  useEffect(() => {
    if (!availableLessons.length) {
      setSelectedLessonIds(new Set());
      return;
    }

    setSelectedLessonIds((current) => {
      const validIds = new Set(availableLessons.map((item) => item.id));
      const next = new Set([...current].filter((id) => validIds.has(id)));
      if (!next.size) next.add(lesson?.id && validIds.has(lesson.id) ? lesson.id : availableLessons[0].id);
      return next;
    });
  }, [availableLessons, lesson?.id]);

  useEffect(() => {
    if (!lesson) return;
    setLoadedLessons((current) => {
      const others = current.filter((item) => item.id !== lesson.id);
      return [lesson, ...others];
    });
  }, [lesson]);

  useEffect(() => {
    const ids = [...selectedLessonIds];
    if (!ids.length) {
      setLoadedLessons([]);
      return;
    }

    let cancelled = false;
    async function loadSelectedLessons() {
      setLoadingLessons(true);
      setLoadError(null);
      try {
        const loaded = await Promise.all(ids.map((id) => lesson?.id === id ? lesson : getLesson(id)));
        if (!cancelled) setLoadedLessons(loaded.filter((item): item is StudyLesson => Boolean(item)));
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Unable to load selected lessons.");
      } finally {
        if (!cancelled) setLoadingLessons(false);
      }
    }

    void loadSelectedLessons();
    return () => {
      cancelled = true;
    };
  }, [selectedLessonIds, lesson]);

  const allSentences = useMemo(() => loadedLessons.flatMap((item) => item.sentences), [loadedLessons]);
  const pool = useMemo(() => buildQuizDeck(allSentences, allSentences), [allSentences]);
  const maxQuestions = Math.max(1, pool.length);
  const clampedQuestionCount = Math.min(Math.max(1, questionCount), maxQuestions);
  const question = deck[index] ?? null;
  const questionKey = question ? getQuestionKey(question) : "";
  const activeAnswer = questionKey ? answers[questionKey] ?? "" : "";
  const currentSubmitted = Boolean(questionKey && submittedCards.has(questionKey));
  const currentResult = question && currentSubmitted
    ? normalize(activeAnswer) === normalize(question.answer) ? "correct" : "wrong"
    : null;

  useEffect(() => {
    if (questionCount > maxQuestions) setQuestionCount(maxQuestions);
  }, [maxQuestions, questionCount]);

  useEffect(() => {
    writeSessionProgress(PROGRESS_KEY, {
      selectedLessonIds: [...selectedLessonIds],
      questionCount,
      testMode,
      status,
      deck,
      index,
      answers,
      submittedCards: [...submittedCards],
      score,
      resultSaved,
      showResults
    } satisfies MultipleChoiceProgress);
  }, [answers, deck, index, questionCount, resultSaved, score, selectedLessonIds, showResults, status, submittedCards, testMode]);

  useEffect(() => {
    if (status === "setup") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || isEditableShortcutTarget(event.target)) return;
      event.preventDefault();
      resetToMenu();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status]);

  if (!availableLessons.length) {
    return (
      <section className="card stack">
        <p className="muted">No lessons yet. Save a lesson to start the multiple-choice mode.</p>
      </section>
    );
  }

  function toggleLesson(lessonId: string) {
    if (status !== "setup") return;
    setSelectedLessonIds((current) => {
      const next = new Set(current);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  }

  function startTest() {
    const nextDeck = sampleDeck(pool, clampedQuestionCount);
    if (!nextDeck.length) return;
    setDeck(nextDeck);
    setIndex(0);
    setAnswers({});
    setSubmittedCards(new Set());
    setScore({ correct: 0, wrong: 0 });
    setResultSaved(false);
    setStatus("active");
  }

  function updateAnswer(value: string) {
    if (!questionKey || currentSubmitted) return;
    setAnswers((current) => ({ ...current, [questionKey]: value }));
  }

  function submitContinuous(value: string) {
    if (!question || !questionKey || currentSubmitted) return;
    const isCorrect = normalize(value) === normalize(question.answer);
    setAnswers((current) => ({ ...current, [questionKey]: value }));
    setSubmittedCards((current) => new Set(current).add(questionKey));
    setScore((current) => ({
      correct: current.correct + (isCorrect ? 1 : 0),
      wrong: current.wrong + (isCorrect ? 0 : 1)
    }));
  }

  function nextQuestion() {
    if (index + 1 >= deck.length) finishContinuous();
    else setIndex((current) => current + 1);
  }

  function moveFull(delta: number) {
    setIndex((current) => Math.min(deck.length - 1, Math.max(0, current + delta)));
  }

  function finishFull() {
    const finalScore = calculateScore(deck, answers);
    setScore(finalScore);
    setSubmittedCards(new Set(deck.map(getQuestionKey)));
    completeTest(finalScore);
  }

  function finishContinuous() {
    completeTest(score);
  }

  function completeTest(finalScore: { correct: number; wrong: number }) {
    if (!resultSaved) {
      const next = saveResult({
        id: createResultId(),
        completedAt: new Date().toISOString(),
        mode: testMode,
        lessonTitles: getSelectedLessonTitles(availableLessons, selectedLessonIds),
        questionCount: deck.length,
        correct: finalScore.correct,
        wrong: finalScore.wrong
      });
      setSavedResults(next);
      setResultSaved(true);
    }
    setStatus("complete");
  }

  function restartSetup() {
    resetToMenu();
  }

  function resetToMenu() {
    clearSessionProgress(PROGRESS_KEY);
    setStatus("setup");
    setDeck([]);
    setIndex(0);
    setAnswers({});
    setSubmittedCards(new Set());
    setScore({ correct: 0, wrong: 0 });
    setResultSaved(false);
  }

  return (
    <section className="stack">
      <header className="card stack quiz-card">
        <div className="row">
          <div>
            <h2>Multiple Choice</h2>
            <p className="muted">{selectedLessonIds.size} lesson{selectedLessonIds.size === 1 ? "" : "s"} selected</p>
          </div>
          <span className="pill">Recognition</span>
        </div>
        <div className="session-stats">
          <span className="pill">Available {pool.length}</span>
          {status !== "setup" ? <span className="pill">Score {score.correct}/{Math.max(1, score.correct + score.wrong)}</span> : null}
        </div>
      </header>

      {status === "setup" ? (
        <section className="card stack quiz-card">
          <div className="row">
            <h3>Test setup</h3>
            <div className="review-filter-row">
              <button type="button" className="button secondary" onClick={() => setShowResults((value) => !value)}>
                {showResults ? "Hide past test results" : "Statistics"}
              </button>
              <a className="button secondary" href="/study/imported-content">Back</a>
            </div>
          </div>

          <div className="test-setup-grid">
            <div className="stack">
              <span className="cloze-context-label">Lessons</span>
              <div className="test-lesson-list">
                {availableLessons.map((item) => (
                  <label className="test-check-row" key={item.id}>
                    <input type="checkbox" checked={selectedLessonIds.has(item.id)} onChange={() => toggleLesson(item.id)} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.sentenceCount} sentences</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="stack">
              <label className="stack">
                <span className="cloze-context-label">Questions</span>
                <input
                  className="input selector-compact"
                  type="number"
                  min={1}
                  max={maxQuestions}
                  value={questionCount}
                  onChange={(event) => setQuestionCount(Number(event.target.value) || 1)}
                />
              </label>

              <span className="cloze-context-label">Check answers</span>
              <div className="mode-tabs cloze-answer-tabs" role="tablist" aria-label="Test mode">
                <button type="button" className={testMode === "continuous" ? "active" : ""} onClick={() => setTestMode("continuous")}>
                  Continuous
                </button>
                <button type="button" className={testMode === "full" ? "active" : ""} onClick={() => setTestMode("full")}>
                  Full test
                </button>
              </div>
            </div>
          </div>

          {loadError ? <p className="review-error">{loadError}</p> : null}
          {!selectedLessonIds.size ? <p className="muted">Select at least one lesson.</p> : null}
          {selectedLessonIds.size && !pool.length && !loadingLessons ? (
            <p className="muted">The selected lessons do not have enough annotated material yet for a multiple-choice test.</p>
          ) : null}

          <button
            type="button"
            className="button"
            disabled={loadingLessons || !selectedLessonIds.size || !pool.length}
            onClick={startTest}
          >
            {loadingLessons ? "Loading lessons..." : "Start test"}
          </button>

          {showResults ? <PastResults results={savedResults} /> : null}
        </section>
      ) : null}

      {status === "complete" ? (
        <section className="card stack quiz-card">
          <div className="row">
            <h2>Test complete</h2>
            <span className="pill">Saved</span>
          </div>
          <p className="muted">You finished with {score.correct} correct and {score.wrong} missed.</p>
          <div className="session-stats">
            <span className="pill">Questions {deck.length}</span>
            <span className="pill grade-stat-easy">Correct {score.correct}</span>
            <span className="pill grade-stat-again">Missed {score.wrong}</span>
          </div>
          <div className="review-complete-actions">
            <button type="button" className="button" onClick={restartSetup}>New test</button>
            <button type="button" className="button secondary" onClick={resetToMenu}>Back</button>
          </div>
        </section>
      ) : null}

      {status === "active" && question ? (
        <section className="card stack quiz-card">
          <div className="row">
            <span className="pill">Question {index + 1} / {deck.length}</span>
            <span className="pill">{question.focusType === "sentence" ? "Translation" : "Vocabulary"}</span>
            <button type="button" className="button secondary" onClick={resetToMenu}>Back</button>
          </div>

          <p className="quiz-prompt">{question.prompt}</p>
          {question.focusText ? (
            <div className="sentence-line quiz-focus-row">
              <p className="quiz-focus-text">{question.focusText}</p>
              <AudioButton
                sentence={question.focusText}
                language={loadedLessons[0]?.language ?? lesson?.language ?? ""}
                compact
                label={`Play ${question.focusType === "word" ? "word" : "sentence"} aloud`}
              />
            </div>
          ) : null}

          {question.options ? (
            <div className="quiz-choices">
              {question.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={[
                    "button secondary quiz-choice",
                    activeAnswer === option ? "selected" : "",
                    currentSubmitted && normalize(option) === normalize(question.answer) ? "quiz-correct" : "",
                    currentSubmitted && normalize(option) === normalize(activeAnswer) && normalize(option) !== normalize(question.answer)
                      ? "quiz-wrong"
                      : ""
                  ].filter(Boolean).join(" ")}
                  disabled={currentSubmitted}
                  onClick={() => testMode === "continuous" ? submitContinuous(option) : updateAnswer(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}

          {testMode === "continuous" && currentSubmitted ? (
            <div className="stack">
              <p className={`quiz-result ${currentResult === "correct" ? "quiz-result-ok" : "quiz-result-fail"}`}>
                {currentResult === "correct" ? "Correct!" : `Answer: ${question.answer}`}
              </p>
              <button type="button" className="button" onClick={nextQuestion}>
                {index + 1 >= deck.length ? "Finish" : "Next"}
              </button>
            </div>
          ) : null}

          {testMode === "full" ? (
            <div className="practice-answer-row">
              <button type="button" className="button secondary" disabled={index === 0} onClick={() => moveFull(-1)}>Back</button>
              {index + 1 >= deck.length ? (
                <button type="button" className="button" onClick={finishFull}>Check test</button>
              ) : (
                <button type="button" className="button" onClick={() => moveFull(1)}>Next</button>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function sampleDeck(deck: QuizQuestion[], count: number): QuizQuestion[] {
  return stableShuffle(deck, `${count}:${deck.map(getQuestionKey).join("|")}`).slice(0, count);
}

function calculateScore(deck: QuizQuestion[], answers: Record<string, string>) {
  return deck.reduce(
    (current, question) => {
      if (normalize(answers[getQuestionKey(question)] ?? "") === normalize(question.answer)) current.correct += 1;
      else current.wrong += 1;
      return current;
    },
    { correct: 0, wrong: 0 }
  );
}

function getQuestionKey(question: QuizQuestion) {
  return `${question.sentenceId}:${question.focusType ?? "question"}:${question.answer}`;
}

function stableShuffle<T>(values: T[], seed: string): T[] {
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

function readSavedResults(): SavedTestResult[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RESULTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isSavedResult) : [];
  } catch {
    return [];
  }
}

function saveResult(result: SavedTestResult): SavedTestResult[] {
  const next = [result, ...readSavedResults()].slice(0, 20);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(RESULTS_KEY, JSON.stringify(next));
    } catch {
      // Results are optional history; the test should still finish if storage is unavailable.
    }
  }
  return next;
}

function isSavedResult(value: unknown): value is SavedTestResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<SavedTestResult>;
  return typeof result.id === "string" && typeof result.completedAt === "string" && typeof result.questionCount === "number";
}

function createResultId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getSelectedLessonTitles(lessons: StudyLessonMeta[], selectedIds: Set<string>) {
  return lessons.filter((item) => selectedIds.has(item.id)).map((item) => item.title);
}

function lessonToMeta(lesson: StudyLesson): StudyLessonMeta {
  return {
    id: lesson.id,
    language: lesson.language,
    baseLanguage: lesson.baseLanguage,
    title: lesson.title,
    description: lesson.description,
    level: lesson.level,
    tags: lesson.tags,
    sentenceCount: lesson.sentences.length
  };
}

function PastResults({ results }: { results: SavedTestResult[] }) {
  if (!results.length) return <p className="muted">No completed multiple-choice tests yet.</p>;

  return (
    <div className="past-results stack">
      {results.map((result) => (
        <div className="past-result-row" key={result.id}>
          <div>
            <strong>{result.correct}/{result.questionCount}</strong>
            <p className="muted">{result.lessonTitles.join(", ") || "Selected lessons"}</p>
          </div>
          <span className="pill">{result.mode === "continuous" ? "Continuous" : "Full test"}</span>
          <small>{new Date(result.completedAt).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
}

function validateMultipleChoiceProgress(value: unknown): MultipleChoiceProgress | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<MultipleChoiceProgress>;
  const index = item.index;
  const questionCount = item.questionCount;

  if (!isStringArray(item.selectedLessonIds)) return null;
  if (typeof questionCount !== "number" || !Number.isInteger(questionCount)) return null;
  if (item.testMode !== "continuous" && item.testMode !== "full") return null;
  if (item.status !== "setup" && item.status !== "active" && item.status !== "complete") return null;
  if (!Array.isArray(item.deck) || !item.deck.every(isQuizQuestion)) return null;
  if (typeof index !== "number" || !Number.isInteger(index)) return null;
  if (!isAnswerMap(item.answers)) return null;
  if (!isStringArray(item.submittedCards)) return null;
  if (!isScore(item.score)) return null;
  if (typeof item.resultSaved !== "boolean") return null;
  if (item.showResults !== undefined && typeof item.showResults !== "boolean") return null;
  const deck = item.deck;

  return {
    selectedLessonIds: item.selectedLessonIds,
    questionCount,
    testMode: item.testMode,
    status: item.status,
    deck,
    index: Math.min(Math.max(0, index), deck.length),
    answers: item.answers,
    submittedCards: item.submittedCards.filter((id) => deck.some((question) => getQuestionKey(question) === id)),
    score: item.score,
    resultSaved: item.resultSaved,
    showResults: item.showResults ?? false
  };
}

function isQuizQuestion(value: unknown): value is QuizQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Partial<QuizQuestion>;
  const hasValidOptions = question.options === undefined ||
    (Array.isArray(question.options) && question.options.every((option) => typeof option === "string"));

  return (
    (question.type === "multiple-choice" || question.type === "fill-blank") &&
    typeof question.prompt === "string" &&
    hasValidOptions &&
    typeof question.answer === "string" &&
    typeof question.sentenceId === "string" &&
    (question.focusType === undefined || question.focusType === "word" || question.focusType === "sentence") &&
    (question.focusText === undefined || typeof question.focusText === "string")
  );
}

function isScore(value: unknown): value is MultipleChoiceProgress["score"] {
  if (!value || typeof value !== "object") return false;
  const score = value as Partial<MultipleChoiceProgress["score"]>;
  return Number.isInteger(score.correct) && Number.isInteger(score.wrong);
}

function isAnswerMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((answer) => typeof answer === "string");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
