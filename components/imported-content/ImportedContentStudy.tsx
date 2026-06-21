"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ItemFamiliarity,
  RevealState,
  StudyLesson,
  StudyLessonMeta,
  StudySentence
} from "@/lib/imported-content/types";
import type { ReviewDecision } from "@/lib/review/types";
import { getLesson } from "@/lib/desktopApi";
import { groupLessonsByLanguage } from "@/lib/language/importResources";
import { useLessonReview } from "@/lib/review/useLessonReview";
import { CheckpointQuiz } from "./CheckpointQuiz";
import { SentenceFlashcard } from "./SentenceFlashcard";

interface Props {
  lesson: StudyLesson | null;
  allLessons: StudyLessonMeta[];
}

const DEFAULT_REVEAL: RevealState = {
  translation: false,
  wordMeanings: false,
  grammar: false,
  hint: false
};

type CardGrade = "easy" | "correct" | "hard" | "failed";

export function ImportedContentStudy({ lesson: initialLesson, allLessons }: Props) {
  const [lesson, setLesson] = useState(initialLesson);
  const [selectedLanguage, setSelectedLanguage] = useState(initialLesson?.language ?? allLessons[0]?.language ?? "");
  const [cardIndex, setCardIndex] = useState(0);
  const [cardOrder, setCardOrder] = useState<string[]>(
    () => initialLesson?.sentences.map((s) => s.id) ?? []
  );
  const [quizPendingAt, setQuizPendingAt] = useState<number | null>(null);
  const [reveal, setReveal] = useState<RevealState>(DEFAULT_REVEAL);
  const [sessionFamiliarity, setSessionFamiliarity] = useState<Map<string, ItemFamiliarity>>(new Map());
  const [cardGrades, setCardGrades] = useState<Map<string, CardGrade>>(new Map());
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [reviewStates, setReviewStates] = useState<Map<string, ReviewDecision>>(new Map());

  const languageGroups = groupLessonsByLanguage(allLessons);
  const activeLanguageGroup = languageGroups.find((g) => g.language === selectedLanguage) ?? languageGroups[0] ?? null;
  const languageLessons = activeLanguageGroup?.lessons ?? [];

  const sentenceById = useMemo(
    () => new Map(lesson?.sentences.map((s) => [s.id, s]) ?? []),
    [lesson]
  );
  const total = cardOrder.length;
  const sentenceId = cardOrder[cardIndex] ?? null;
  const sentence = sentenceId ? sentenceById.get(sentenceId) ?? null : null;
  const completed = total > 0 && cardIndex >= total;

  const summary = useMemo(() => {
    let easy = 0;
    let correct = 0;
    let hard = 0;
    let failed = 0;
    for (const grade of cardGrades.values()) {
      if (grade === "easy") easy += 1;
      else if (grade === "correct") correct += 1;
      else if (grade === "hard") hard += 1;
      else failed += 1;
    }
    return { total, reviewed: cardGrades.size, remaining: Math.max(0, total - cardGrades.size), easy, correct, hard, failed };
  }, [cardGrades, total]);

  const applySentenceFamiliarity = useCallback((targetSentence: StudySentence, familiarity: ItemFamiliarity) => {
    setSessionFamiliarity((prev) => {
      const next = new Map(prev);
      for (const w of targetSentence.words) next.set(w.canonicalKey, familiarity);
      for (const g of targetSentence.grammar) next.set(g.canonicalKey, familiarity);
      for (const c of targetSentence.chunks) next.set(c.canonicalKey, familiarity);
      return next;
    });
  }, []);

  const handlePrev = useCallback(() => {
    setCardIndex((i) => Math.max(0, i - 1));
    setReveal(DEFAULT_REVEAL);
  }, []);

  const handleNext = useCallback(() => {
    const next = cardIndex + 1;
    if (next % 5 === 0) {
      setQuizPendingAt(next);
      return;
    }
    if (next >= total) {
      setCardIndex(total);
      setQuizPendingAt(null);
      setReveal(DEFAULT_REVEAL);
      return;
    }
    setCardIndex(next);
    setReveal(DEFAULT_REVEAL);
  }, [cardIndex, total]);

  const handleQuizDone = useCallback(() => {
    const nextIdx = quizPendingAt ?? cardIndex + 1;
    setQuizPendingAt(null);
    if (nextIdx >= total) {
      setCardIndex(total);
    } else {
      setCardIndex(nextIdx);
    }
    setReveal(DEFAULT_REVEAL);
  }, [quizPendingAt, cardIndex, total]);

  const handleRevealTranslation = useCallback(() => {
    setReveal((r) => ({ ...r, translation: true }));
  }, []);

  const handleToggleWordMeanings = useCallback(() => {
    setReveal((r) => ({ ...r, wordMeanings: !r.wordMeanings }));
  }, []);

  const handleToggleGrammar = useCallback(() => {
    setReveal((r) => ({ ...r, grammar: !r.grammar }));
  }, []);

  const handleToggleHint = useCallback(() => {
    setReveal((r) => ({ ...r, hint: !r.hint }));
  }, []);

  const handleGrade = useCallback(
    (grade: CardGrade) => {
      if (!sentenceId || !sentence) return;
      setCardGrades((prev) => new Map(prev).set(sentenceId, grade));
      const familiarity: ItemFamiliarity = grade === "easy" || grade === "correct" ? "known" : "learning";
      applySentenceFamiliarity(sentence, familiarity);
    },
    [applySentenceFamiliarity, sentence, sentenceId]
  );

  const handleShuffle = useCallback(() => {
    const sourceOrder = lesson?.sentences.map((s) => s.id) ?? [];
    if (!sourceOrder.length) return;
    setCardOrder(shuffleIds(sourceOrder));
    setCardIndex(0);
    setQuizPendingAt(null);
    setReveal(DEFAULT_REVEAL);
    setCardGrades(new Map());
  }, [lesson]);

  const handleLessonReviewDecision = useCallback((reviewSentence: StudySentence, decision: ReviewDecision) => {
    setReviewStates((prev) => new Map(prev).set(reviewSentence.id, decision));
    applySentenceFamiliarity(reviewSentence, decision === "remembered" ? "known" : "learning");
  }, [applySentenceFamiliarity]);

  const review = useLessonReview(lesson?.sentences ?? [], {
    onDecision: handleLessonReviewDecision,
    onSaved: (reviewedSentenceId, decision) => {
      setReviewStates((prev) => new Map(prev).set(reviewedSentenceId, decision));
    }
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditableShortcutTarget(e.target)) return;
      if (review.active && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
      switch (e.key) {
        case "ArrowLeft": handlePrev(); break;
        case "ArrowRight": handleNext(); break;
        case " ": e.preventDefault(); handleRevealTranslation(); break;
        case "h": case "H": handleToggleHint(); break;
        case "w": case "W": handleToggleWordMeanings(); break;
        case "g": case "G": handleToggleGrammar(); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePrev, handleNext, handleRevealTranslation, handleToggleHint, handleToggleWordMeanings, handleToggleGrammar, review.active]);

  useEffect(() => {
    if (review.active) setReveal(DEFAULT_REVEAL);
  }, [review.active, review.currentCard?.id]);

  async function switchLesson(lessonId: string) {
    setLoadingLesson(true);
    try {
      const next = await getLesson(lessonId);
      if (next) {
        setLesson(next);
        setSelectedLanguage(next.language);
        setCardIndex(0);
        setCardOrder(next.sentences.map((s) => s.id));
        setQuizPendingAt(null);
        setReveal(DEFAULT_REVEAL);
        setSessionFamiliarity(new Map());
        setCardGrades(new Map());
        setReviewStates(new Map());
        review.finishReview();
      }
    } finally {
      setLoadingLesson(false);
    }
  }

  function handleLanguageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const lang = e.target.value;
    setSelectedLanguage(lang);
    const group = languageGroups.find((g) => g.language === lang);
    const first = group?.lessons[0];
    if (first) void switchLesson(first.id);
  }

  if (!lesson) {
    return (
      <section className="card stack">
        <p className="muted">No lessons yet. Save a lesson to start studying.</p>
      </section>
    );
  }

  const currentReviewState = sentenceId ? (reviewStates.get(sentenceId) ?? null) : null;
  const activeSentence = review.active ? review.currentCard : sentence;
  const activeReviewState = activeSentence ? (reviewStates.get(activeSentence.id) ?? null) : null;
  const recentSentences = cardOrder.slice(Math.max(0, cardIndex - 4), cardIndex + 1);
  const recentStudySentences = recentSentences
    .map((id) => sentenceById.get(id))
    .filter((v): v is StudySentence => Boolean(v));

  return (
    <div className="study-shell stack">
      {/* Compact selector + session stats */}
      <div className="lesson-selector-bar">
        {languageGroups.length > 1 ? (
          <select
            className="input selector-compact"
            value={selectedLanguage}
            disabled={loadingLesson}
            onChange={handleLanguageChange}
          >
            {languageGroups.map((g) => (
              <option key={g.language} value={g.language}>{g.label}</option>
            ))}
          </select>
        ) : null}
        {languageLessons.length > 1 ? (
          <select
            className="input selector-compact"
            value={lesson.id}
            disabled={loadingLesson}
            onChange={(e) => void switchLesson(e.target.value)}
          >
            {languageLessons.map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
        ) : null}
        <div className="session-stats">
          {review.active ? (
            <>
              <span className="pill">Review {review.remaining} left</span>
              {review.stats.remembered > 0 && <span className="pill review-state-remembered">Remembered {review.stats.remembered}</span>}
              {review.stats.forgotten > 0 && <span className="pill review-state-forgotten">Forgotten {review.stats.forgotten}</span>}
            </>
          ) : (
            <span className="pill">{summary.remaining > 0 ? `${summary.remaining} remaining` : "Done"}</span>
          )}
          {summary.easy > 0 && <span className="pill grade-stat-easy">Easy {summary.easy}</span>}
          {summary.correct > 0 && <span className="pill grade-stat-good">Good {summary.correct}</span>}
          {summary.hard > 0 && <span className="pill grade-stat-hard">Hard {summary.hard}</span>}
          {summary.failed > 0 && <span className="pill grade-stat-again">Again {summary.failed}</span>}
          {lesson.sentences.length > 0 ? (
            <button
              type="button"
              className="button secondary lesson-review-toggle"
              disabled={loadingLesson}
              onClick={() => {
                setQuizPendingAt(null);
                setReveal(DEFAULT_REVEAL);
                if (review.active) review.finishReview();
                else review.startReview();
              }}
            >
              {review.active ? "End Review" : "Start Review"}
            </button>
          ) : null}
        </div>
      </div>

      {review.active && review.finished ? (
        <section className="card stack">
          <div className="row">
            <div>
              <h2>Review complete</h2>
              <p className="muted">You remembered every active card in this pass.</p>
            </div>
            <span className="pill">Done</span>
          </div>
          <div className="session-stats">
            <span className="pill">Reviewed {review.stats.reviewed}</span>
            <span className="pill review-state-remembered">Remembered {review.stats.remembered}</span>
            {review.stats.forgotten > 0 && <span className="pill review-state-forgotten">Forgotten {review.stats.forgotten}</span>}
          </div>
          {review.error ? <p className="review-error">{review.error}</p> : null}
          <div className="row compact-row" style={{ gap: 8 }}>
            <button type="button" className="button secondary" onClick={review.finishReview}>Return to lesson</button>
            <button type="button" className="button" onClick={review.startReview}>Review again</button>
          </div>
        </section>
      ) : quizPendingAt !== null && !review.active ? (
        <CheckpointQuiz
          sentences={recentStudySentences}
          allSentences={lesson.sentences}
          onComplete={handleQuizDone}
        />
      ) : completed && !review.active ? (
        <section className="card stack">
          <div className="row">
            <div>
              <h2>Lesson complete</h2>
              <p className="muted">You reached the end. Shuffle for another pass or restart.</p>
            </div>
            <span className="pill">Done</span>
          </div>
          <div className="session-stats">
            <span className="pill">Total {summary.total}</span>
            {summary.easy > 0 && <span className="pill grade-stat-easy">Easy {summary.easy}</span>}
            {summary.correct > 0 && <span className="pill grade-stat-good">Good {summary.correct}</span>}
            {summary.hard > 0 && <span className="pill grade-stat-hard">Hard {summary.hard}</span>}
            {summary.failed > 0 && <span className="pill grade-stat-again">Again {summary.failed}</span>}
          </div>
          <div className="row compact-row" style={{ gap: 8 }}>
            <button type="button" className="button secondary" onClick={handleShuffle}>Shuffle</button>
            <button
              type="button"
              className="button"
              onClick={() => { setCardIndex(0); setQuizPendingAt(null); setReveal(DEFAULT_REVEAL); }}
            >
              Restart
            </button>
          </div>
        </section>
      ) : activeSentence ? (
        <SentenceFlashcard
          key={`${lesson.id}:${activeSentence.id}:${review.active ? `review-${review.stats.reviewed}` : cardIndex}`}
          sentence={activeSentence}
          cardIndex={review.active ? review.stats.reviewed : cardIndex}
          totalCards={review.active ? Math.max(1, review.stats.reviewed + review.remaining) : total}
          lessonTitle={lesson.title}
          language={lesson.language}
          allSentences={lesson.sentences}
          reveal={reveal}
          sessionFamiliarity={sessionFamiliarity}
          currentGrade={cardGrades.get(activeSentence.id) ?? null}
          reviewMode={review.active}
          reviewState={review.active ? activeReviewState : currentReviewState}
          isSavingReview={review.saving}
          reviewError={review.error}
          onRevealTranslation={handleRevealTranslation}
          onToggleWordMeanings={handleToggleWordMeanings}
          onToggleGrammar={handleToggleGrammar}
          onToggleHint={handleToggleHint}
          onGrade={handleGrade}
          onShuffle={handleShuffle}
          onReview={(decision) => {
            if (decision === "remembered") review.markRemembered(activeSentence.id);
            else review.markNotRemembered(activeSentence.id);
          }}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      ) : null}
    </div>
  );
}

function shuffleIds(values: string[]): string[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  if (copy.length > 1 && copy.every((id, index) => id === values[index])) {
    copy.push(copy.shift() as string);
  }
  return copy;
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
