"use client";

import { useEffect, useMemo, useState } from "react";
import { AudioButton } from "@/components/ui/AudioButton";
import { getLesson } from "@/lib/desktopApi";
import type { StudyLesson, StudyLessonMeta, StudySentence } from "@/lib/imported-content/types";
import { buildClozeCandidates, type ClozeCandidate } from "@/lib/imported-content/study-utils";
import { answersMatch, normalizePracticeAnswer } from "@/lib/imported-content/text-spans";
import { readSessionProgress, writeSessionProgress } from "./sessionProgress";

interface Props {
  lesson: StudyLesson | null;
  lessons?: StudyLessonMeta[];
}

type AnswerMode = "type" | "choice";
type TestMode = "continuous" | "full";
type TestStatus = "setup" | "active" | "complete";

interface FillBlankCard {
  id: string;
  sentence: StudySentence;
  candidate: ClozeCandidate;
  lessonId: string;
  lessonTitle: string;
}

interface SavedTestResult {
  id: string;
  completedAt: string;
  mode: TestMode;
  lessonTitles: string[];
  questionCount: number;
  correct: number;
  wrong: number;
}

const RESULTS_KEY = "fydor.fill-blank-test-results";
const DEFAULT_QUESTION_COUNT = 10;
const PROGRESS_KEY = "fill-blank";

interface FillBlankProgress {
  selectedLessonIds: string[];
  questionCount: number;
  testMode: TestMode;
  answerMode: AnswerMode;
  status: TestStatus;
  deck: FillBlankCard[];
  index: number;
  answers: Record<string, string>;
  submittedCards: string[];
  score: { correct: number; wrong: number };
  resultSaved: boolean;
  showResults: boolean;
}

export function FillBlankMode({ lesson, lessons = [] }: Props) {
  const availableLessons = useMemo(() => (
    lessons.length ? lessons : lesson ? [lessonToMeta(lesson)] : []
  ), [lesson, lessons]);
  const [initialProgress] = useState(() => readSessionProgress(PROGRESS_KEY, validateFillBlankProgress));
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(() => {
    return new Set(initialProgress?.selectedLessonIds ?? (lesson ? [lesson.id] : []));
  });
  const [loadedLessons, setLoadedLessons] = useState<StudyLesson[]>(() => (lesson ? [lesson] : []));
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(() => initialProgress?.questionCount ?? DEFAULT_QUESTION_COUNT);
  const [testMode, setTestMode] = useState<TestMode>(() => initialProgress?.testMode ?? "continuous");
  const [answerMode, setAnswerMode] = useState<AnswerMode>(() => initialProgress?.answerMode ?? "choice");
  const [showResults, setShowResults] = useState(() => initialProgress?.showResults ?? false);
  const [savedResults, setSavedResults] = useState<SavedTestResult[]>(() => readSavedResults());
  const [status, setStatus] = useState<TestStatus>(() => initialProgress?.status ?? "setup");
  const [deck, setDeck] = useState<FillBlankCard[]>(() => initialProgress?.deck ?? []);
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

  const pool = useMemo(() => buildFillBlankDeck(loadedLessons), [loadedLessons]);
  const maxQuestions = Math.max(1, pool.length);
  const clampedQuestionCount = Math.min(Math.max(1, questionCount), maxQuestions);
  const card = deck[index] ?? null;
  const activeAnswer = card ? answers[card.id] ?? "" : "";
  const choices = useMemo(() => buildChoices(card?.candidate.answerText ?? null, deck), [card?.candidate.answerText, deck]);
  const currentSubmitted = Boolean(card && submittedCards.has(card.id));
  const currentResult = card && currentSubmitted
    ? answersMatch(activeAnswer, card.candidate.answerText) ? "correct" : "wrong"
    : null;

  useEffect(() => {
    if (questionCount > maxQuestions) setQuestionCount(maxQuestions);
  }, [maxQuestions, questionCount]);

  useEffect(() => {
    writeSessionProgress(PROGRESS_KEY, {
      selectedLessonIds: [...selectedLessonIds],
      questionCount,
      testMode,
      answerMode,
      status,
      deck,
      index,
      answers,
      submittedCards: [...submittedCards],
      score,
      resultSaved,
      showResults
    } satisfies FillBlankProgress);
  }, [answerMode, answers, deck, index, questionCount, resultSaved, score, selectedLessonIds, showResults, status, submittedCards, testMode]);

  if (!availableLessons.length) {
    return (
      <section className="card stack">
        <p className="muted">No lessons yet. Save a lesson to start Fill Blank.</p>
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
    if (!card || currentSubmitted) return;
    setAnswers((current) => ({ ...current, [card.id]: value }));
  }

  function submitContinuous(value?: string) {
    if (!card || currentSubmitted) return;
    const selectedAnswer = value ?? activeAnswer;
    if (!selectedAnswer.trim()) return;
    const isCorrect = answersMatch(selectedAnswer, card.candidate.answerText);
    setAnswers((current) => ({ ...current, [card.id]: selectedAnswer }));
    setSubmittedCards((current) => new Set(current).add(card.id));
    setScore((current) => ({
      correct: current.correct + (isCorrect ? 1 : 0),
      wrong: current.wrong + (isCorrect ? 0 : 1)
    }));
  }

  function nextCard() {
    if (index + 1 >= deck.length) finishContinuous();
    else setIndex((current) => current + 1);
  }

  function moveFull(delta: number) {
    setIndex((current) => Math.min(deck.length - 1, Math.max(0, current + delta)));
  }

  function finishFull() {
    const finalScore = calculateScore(deck, answers);
    setScore(finalScore);
    setSubmittedCards(new Set(deck.map((item) => item.id)));
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
            <h2>Fill Blank</h2>
            <p className="muted">{selectedLessonIds.size} lesson{selectedLessonIds.size === 1 ? "" : "s"} selected</p>
          </div>
          <span className="pill">Cloze</span>
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
            <button type="button" className="button secondary" onClick={() => setShowResults((value) => !value)}>
              {showResults ? "Hide past test results" : "View past test results"}
            </button>
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

              <span className="cloze-context-label">Answer style</span>
              <div className="mode-tabs cloze-answer-tabs" role="tablist" aria-label="Answer style">
                <button type="button" className={answerMode === "type" ? "active" : ""} onClick={() => setAnswerMode("type")}>
                  Type
                </button>
                <button type="button" className={answerMode === "choice" ? "active" : ""} onClick={() => setAnswerMode("choice")}>
                  Multiple choice
                </button>
              </div>
            </div>
          </div>

          {loadError ? <p className="review-error">{loadError}</p> : null}
          {!selectedLessonIds.size ? <p className="muted">Select at least one lesson.</p> : null}
          {selectedLessonIds.size && !pool.length && !loadingLessons ? (
            <p className="muted">The selected lessons need word, grammar, or chunk annotations before they can make fill-in-the-blank cards.</p>
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
          <button type="button" className="button" onClick={restartSetup}>New test</button>
        </section>
      ) : null}

      {status === "active" && card ? (
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
              language={loadedLessons[0]?.language ?? lesson?.language ?? ""}
              compact
              label={`Play ${formatKind(card.candidate.kind)} aloud`}
            />
          </div>

          <p className="sentence-text practice-sentence">
            <span>{card.sentence.text.slice(0, card.candidate.start)}</span>
            <span className={`cloze-blank cloze-kind-${card.candidate.kind}`}>
              {currentSubmitted ? card.candidate.answerText : ""}
            </span>
            <span>{card.sentence.text.slice(card.candidate.end)}</span>
          </p>

          {answerMode === "choice" && choices.length >= 2 ? (
            <div className="cloze-choice-grid">
              {choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={[
                    "button secondary cloze-choice",
                    activeAnswer === choice ? "selected" : "",
                    currentSubmitted && answersMatch(choice, card.candidate.answerText) ? "correct" : "",
                    currentSubmitted && activeAnswer === choice && !answersMatch(choice, card.candidate.answerText) ? "incorrect" : ""
                  ].filter(Boolean).join(" ")}
                  disabled={currentSubmitted}
                  onClick={() => testMode === "continuous" ? submitContinuous(choice) : updateAnswer(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : (
            <div className="practice-answer-row">
              <input
                className="input"
                value={activeAnswer}
                placeholder="Type the missing text"
                disabled={currentSubmitted}
                onChange={(event) => updateAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    if (testMode === "continuous") submitContinuous();
                    else moveFull(1);
                  }
                }}
              />
              {testMode === "continuous" ? (
                <button type="button" className="button secondary" disabled={currentSubmitted} onClick={() => submitContinuous()}>Check</button>
              ) : null}
            </div>
          )}

          {testMode === "continuous" && currentSubmitted ? (
            <div className="stack">
              <p className={`quiz-result ${currentResult === "correct" ? "quiz-result-ok" : "quiz-result-fail"}`}>
                {currentResult === "correct" ? "Correct!" : `Answer: ${card.candidate.answerText}`}
              </p>
              <button type="button" className="button" onClick={nextCard}>
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

export function buildFillBlankDeck(lessons: StudyLesson[] | StudyLesson | null): FillBlankCard[] {
  const lessonList = Array.isArray(lessons) ? lessons : lessons ? [lessons] : [];
  return lessonList.flatMap((item) =>
    item.sentences.flatMap((sentence) => {
      const candidate = pickClozeCandidate(sentence);
      return candidate ? [{
        id: `${item.id}:${sentence.id}:${candidate.id}`,
        sentence,
        candidate,
        lessonId: item.id,
        lessonTitle: item.title
      }] : [];
    })
  );
}

export function buildChoices(answer: string | null, deck: FillBlankCard[]): string[] {
  if (!answer) return [];
  const seen = new Set([normalizePracticeAnswer(answer)]);
  const distractors: string[] = [];

  for (const card of stableShuffle(deck, answer)) {
    const key = normalizePracticeAnswer(card.candidate.answerText);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    distractors.push(card.candidate.answerText);
  }

  return stableShuffle([answer, ...distractors.slice(0, 3)], answer);
}

function pickClozeCandidate(sentence: StudySentence): ClozeCandidate | null {
  const candidates = buildClozeCandidates(sentence);
  if (!candidates.length) return null;
  return stableShuffle(candidates, sentence.id)[0];
}

function sampleDeck(deck: FillBlankCard[], count: number): FillBlankCard[] {
  return stableShuffle(deck, `${count}:${deck.map((card) => card.id).join("|")}`).slice(0, count);
}

function calculateScore(deck: FillBlankCard[], answers: Record<string, string>) {
  return deck.reduce(
    (current, card) => {
      if (answersMatch(answers[card.id] ?? "", card.candidate.answerText)) current.correct += 1;
      else current.wrong += 1;
      return current;
    },
    { correct: 0, wrong: 0 }
  );
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

function validateFillBlankProgress(value: unknown): FillBlankProgress | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<FillBlankProgress>;
  const index = item.index;
  const questionCount = item.questionCount;

  if (!isStringArray(item.selectedLessonIds)) return null;
  if (typeof questionCount !== "number" || !Number.isInteger(questionCount)) return null;
  if (item.testMode !== "continuous" && item.testMode !== "full") return null;
  if (item.answerMode !== "type" && item.answerMode !== "choice") return null;
  if (item.status !== "setup" && item.status !== "active" && item.status !== "complete") return null;
  if (!Array.isArray(item.deck) || !item.deck.every(isFillBlankCard)) return null;
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
    answerMode: item.answerMode,
    status: item.status,
    deck,
    index: Math.min(Math.max(0, index), deck.length),
    answers: item.answers,
    submittedCards: item.submittedCards.filter((id) => deck.some((card) => card.id === id)),
    score: item.score,
    resultSaved: item.resultSaved,
    showResults: item.showResults ?? false
  };
}

function isFillBlankCard(value: unknown): value is FillBlankCard {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<FillBlankCard>;
  return (
    typeof card.id === "string" &&
    typeof card.lessonId === "string" &&
    typeof card.lessonTitle === "string" &&
    isStudySentence(card.sentence) &&
    isClozeCandidate(card.candidate)
  );
}

function isStudySentence(value: unknown): value is StudySentence {
  if (!value || typeof value !== "object") return false;
  const sentence = value as Partial<StudySentence>;
  return (
    typeof sentence.id === "string" &&
    typeof sentence.text === "string" &&
    typeof sentence.translation === "string" &&
    Array.isArray(sentence.words) &&
    Array.isArray(sentence.grammar) &&
    Array.isArray(sentence.chunks)
  );
}

function isClozeCandidate(value: unknown): value is ClozeCandidate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ClozeCandidate>;
  return (
    typeof candidate.id === "string" &&
    (candidate.kind === "word" || candidate.kind === "grammar" || candidate.kind === "chunk") &&
    typeof candidate.start === "number" &&
    typeof candidate.end === "number" &&
    typeof candidate.answerText === "string"
  );
}

function isAnswerMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((answer) => typeof answer === "string");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isScore(value: unknown): value is FillBlankProgress["score"] {
  if (!value || typeof value !== "object") return false;
  const score = value as Partial<FillBlankProgress["score"]>;
  return Number.isInteger(score.correct) && Number.isInteger(score.wrong);
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
  if (!results.length) return <p className="muted">No completed fill-blank tests yet.</p>;

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

function formatKind(kind: ClozeCandidate["kind"]): string {
  if (kind === "word") return "Vocabulary";
  if (kind === "grammar") return "Grammar pattern";
  return "Chunk / expression";
}
