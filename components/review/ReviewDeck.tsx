"use client";

import { useEffect, useState } from "react";
import type { StudyLessonMeta } from "@/lib/imported-content/types";
import { getReviewShortcutAction } from "@/lib/review/queue";
import type { ReviewSentence } from "@/lib/review/types";
import { useReviewDeck } from "@/lib/review/useReviewDeck";
import { ReviewControls } from "./ReviewControls";
import { ReviewSentenceCard } from "./ReviewSentenceCard";

interface ReviewLessonOption {
  id: string;
  title: string;
}

interface ReviewDeckProps {
  allSentenceCount?: number;
  lessons?: StudyLessonMeta[];
  sentenceCountByLesson?: Map<string, number>;
  selectedLessonIds?: string[];
  sentences: ReviewSentence[];
  onSelectedLessonIdsChange?: (lessonIds: string[]) => void;
}

export function ReviewDeck({
  sentences,
  allSentenceCount,
  lessons = [],
  sentenceCountByLesson,
  selectedLessonIds = lessons.map((lesson) => lesson.id),
  onSelectedLessonIdsChange
}: ReviewDeckProps) {
  const totalSentenceCount = allSentenceCount ?? sentences.length;
  const lessonSentenceCounts = sentenceCountByLesson ?? getSentenceCountByLesson(sentences);
  const lessonOptions = getReviewLessonOptions(lessons, lessonSentenceCounts);
  const {
    currentSentence,
    position,
    queueTotal,
    saving,
    error,
    reviewCurrent,
    summary,
    started,
    startReview,
    shuffleEnabled,
    toggleShuffle
  } = useReviewDeck(sentences);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
  }, [currentSentence?.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isInteractiveTarget(event.target)) return;
      if (!started) return;
      if (event.key === " ") {
        event.preventDefault();
        setRevealed(true);
        return;
      }

      const decision = getReviewShortcutAction(event.key);
      if (decision && revealed) {
        event.preventDefault();
        void reviewCurrent(decision);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [revealed, reviewCurrent, started]);

  if (!sentences.length) {
    if (totalSentenceCount > 0) {
      return (
        <div className="review-shell">
          <ReviewStartHeader summary={summary} />
          <section className="review-start-panel">
            <ReviewLessonSelect
              lessons={lessonOptions}
              selectedLessonIds={selectedLessonIds}
              sentenceCountByLesson={lessonSentenceCounts}
              totalSentenceCount={totalSentenceCount}
              onChange={onSelectedLessonIdsChange}
            />
            <p className="muted">Select at least one lesson to build a review queue.</p>
          </section>
          <LearningSciencePanel />
        </div>
      );
    }

    return (
      <section className="card review-empty">
        <h2>No sentences to review yet</h2>
        <p className="muted">Import a lesson first, then come back here to review sentences one at a time.</p>
      </section>
    );
  }

  if (!currentSentence) {
    if (!started) {
      return (
        <div className="review-shell">
          <ReviewStartHeader summary={summary} />
          <section className="review-start-panel">
            <ReviewLessonSelect
              lessons={lessonOptions}
              selectedLessonIds={selectedLessonIds}
              sentenceCountByLesson={lessonSentenceCounts}
              totalSentenceCount={totalSentenceCount}
              onChange={onSelectedLessonIdsChange}
            />
            <div className="review-start-actions">
              <button className="button" type="button" onClick={() => startReview("mixed")}>
                Start Mixed Review
              </button>
              <div className="review-filter-row" aria-label="Review filters">
                <button className="button secondary" type="button" onClick={() => startReview("due")}>Due only</button>
                <button className="button secondary" type="button" onClick={() => startReview("new")}>New only</button>
                <button className="button secondary" type="button" onClick={() => startReview("all")}>All selected</button>
              </div>
            </div>
          </section>
          <LearningSciencePanel />
        </div>
      );
    }

    return (
      <section className="card review-empty">
        <h2>Review queue complete</h2>
        <p className="muted">This review pass is complete. Start another mixed review whenever you are ready.</p>
        <ReviewControls
          disabled={saving}
          shuffleEnabled={shuffleEnabled}
          shuffleDisabled
          visible={false}
          onForgot={() => reviewCurrent("forgot")}
          onHard={() => reviewCurrent("hard")}
          onRemembered={() => reviewCurrent("remembered")}
          onEasy={() => reviewCurrent("easy")}
          onToggleShuffle={toggleShuffle}
        />
      </section>
    );
  }

  return (
    <div className="review-shell">
      <header className="review-header">
        <div>
          <h1>Review</h1>
          <p className="muted">Recall before reveal. Space reveals; grade only after the answer is visible.</p>
        </div>
        <div className="review-summary">
          <span className="pill">Total {summary.total}</span>
          <span className="pill">Unknown {summary.unknown}</span>
          <span className="pill review-state-forgotten">Forgotten {summary.forgotten}</span>
          <span className="pill review-state-remembered">Remembered {summary.remembered}</span>
        </div>
      </header>

      {error ? <p className="review-error">{error}</p> : null}

      <ReviewSentenceCard
        sentence={currentSentence}
        index={position}
        total={queueTotal}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
      />

      <ReviewControls
        disabled={saving}
        shuffleEnabled={shuffleEnabled}
        shuffleDisabled
        visible={revealed}
        onForgot={() => reviewCurrent("forgot")}
        onHard={() => reviewCurrent("hard")}
        onRemembered={() => reviewCurrent("remembered")}
        onEasy={() => reviewCurrent("easy")}
        onToggleShuffle={toggleShuffle}
      />
      <LearningSciencePanel compact />
    </div>
  );
}

function ReviewStartHeader({ summary }: { summary: ReturnType<typeof useReviewDeck>["summary"] }) {
  return (
    <header className="review-header">
      <div>
        <h1>Review</h1>
        <p className="muted">Build a mixed queue from due, new, and older mastered sentences.</p>
      </div>
      <div className="review-summary">
        <span className="pill">Total {summary.total}</span>
        <span className="pill">Unknown {summary.unknown}</span>
        <span className="pill review-state-forgotten">Forgotten {summary.forgotten}</span>
        <span className="pill review-state-remembered">Remembered {summary.remembered}</span>
      </div>
    </header>
  );
}

function ReviewLessonSelect({
  lessons,
  selectedLessonIds,
  sentenceCountByLesson,
  totalSentenceCount,
  onChange
}: {
  lessons: ReviewLessonOption[];
  selectedLessonIds: string[];
  sentenceCountByLesson: Map<string, number>;
  totalSentenceCount: number;
  onChange?: (lessonIds: string[]) => void;
}) {
  if (!lessons.length || !onChange) return null;

  const handleChange = onChange;
  const selected = new Set(selectedLessonIds);
  const allSelected = lessons.length > 0 && lessons.every((lesson) => selected.has(lesson.id));
  const selectedValue = allSelected
    ? "all"
    : selectedLessonIds.length === 1
      ? selectedLessonIds[0]
      : "custom";

  function chooseLesson(value: string) {
    if (value === "all") {
      handleChange(lessons.map((lesson) => lesson.id));
      return;
    }
    if (value === "custom") return;
    handleChange([value]);
  }

  return (
    <label className="review-lesson-select">
      <span>Lesson</span>
      <select
        className="input"
        value={selectedValue}
        onChange={(event) => chooseLesson(event.target.value)}
      >
        <option value="all">All lessons ({totalSentenceCount})</option>
        {selectedValue === "custom" ? <option value="custom">Selected lessons ({selectedLessonIds.length})</option> : null}
        {lessons.map((lesson) => {
          const count = sentenceCountByLesson.get(lesson.id) ?? 0;
          return (
            <option value={lesson.id} key={lesson.id}>
              {lesson.title} ({count})
            </option>
          );
        })}
      </select>
    </label>
  );
}

function getReviewLessonOptions(lessons: StudyLessonMeta[], sentenceCountByLesson: Map<string, number>): ReviewLessonOption[] {
  if (lessons.length) {
    return lessons.map((lesson) => ({ id: lesson.id, title: lesson.title }));
  }

  return [...sentenceCountByLesson.keys()].map((lessonId, index) => ({
    id: lessonId,
    title: `Lesson ${index + 1}`
  }));
}

function getSentenceCountByLesson(sentences: ReviewSentence[]) {
  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    if (!sentence.lessonId) continue;
    counts.set(sentence.lessonId, (counts.get(sentence.lessonId) ?? 0) + 1);
  }
  return counts;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function LearningSciencePanel({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`learning-science${compact ? " learning-science-compact" : ""}`}>
      <div>
        <h2>Learning Science</h2>
        <p className="muted">Methods used in this review session.</p>
      </div>
      <div className="learning-science-grid">
        <p><strong>Spaced Repetition</strong> — difficult sentences return sooner; mastered sentences appear less often.</p>
        <p><strong>Retrieval Practice</strong> — recall the sentence before revealing the answer.</p>
        <p><strong>Interleaving</strong> — review mixes sentences from different lessons.</p>
        <p><strong>Generation Effect</strong> — fill blanks or produce translations yourself.</p>
        <p><strong>Desirable Difficulties</strong> — hints are gradually removed as memory improves.</p>
      </div>
      <details className="learning-science-more">
        <summary>Learn more</summary>
        <p className="muted">Fydor combines due cards, new cards, and occasional older cards, then adjusts timing and hints from your self-grade.</p>
      </details>
    </section>
  );
}
