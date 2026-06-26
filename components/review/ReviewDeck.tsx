"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarClock, CheckCircle2, Layers3, RotateCcw, Sparkles } from "lucide-react";
import { readSessionProgress, writeSessionProgress } from "@/components/imported-content/sessionProgress";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import { isSpaceKey, shouldIgnoreReviewHotkey, shouldRevealOnSpaceRelease } from "@/lib/review/keyboard";
import { buildInterleavedReviewQueue, getReviewShortcutAction } from "@/lib/review/queue";
import type { ReviewSourceBucket } from "@/lib/review/sessionSummary";
import type { ReviewResetScope, ReviewSentence } from "@/lib/review/types";
import { useReviewDeck } from "@/lib/review/useReviewDeck";
import { ReviewControls } from "./ReviewControls";
import { ReviewSentenceCard } from "./ReviewSentenceCard";
import { ReviewStatsBrowser } from "./ReviewStatsBrowser";

const REVIEW_REVEAL_PROGRESS_KEY = "review.reveal";

interface ReviewRevealProgress {
  sentenceId: string | null;
  revealed: boolean;
}

interface ReviewLessonOption {
  id: string;
  title: string;
}

interface ReviewDeckProps {
  allSentenceCount?: number;
  lessons?: StudyLessonMeta[];
  fullLessons?: StudyLesson[];
  sentenceCountByLesson?: Map<string, number>;
  selectedLessonIds?: string[];
  sentences: ReviewSentence[];
  onSelectedLessonIdsChange?: (lessonIds: string[]) => void;
  onResetProgress?: (scope: ReviewResetScope) => Promise<void> | void;
}

export function ReviewDeck({
  sentences,
  allSentenceCount,
  fullLessons = [],
  lessons = [],
  sentenceCountByLesson,
  selectedLessonIds = lessons.map((lesson) => lesson.id),
  onSelectedLessonIdsChange,
  onResetProgress
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
    startFocusedReview,
    returnToMenu,
    completedSession,
    shuffleEnabled,
    toggleShuffle
  } = useReviewDeck(sentences);
  const [revealed, setRevealed] = useState(false);
  const [menuView, setMenuView] = useState<"start" | "statistics">("start");
  const [confirmResetLesson, setConfirmResetLesson] = useState(false);
  const spacePressSentenceIdRef = useRef<string | null>(null);
  const availableBreakdown = summarizeAvailableSentences(sentences);
  const queueDashboard = buildQueueDashboard(sentences);
  const lessonTitleById = new Map(lessonOptions.map((lesson) => [lesson.id, lesson.title]));

  useEffect(() => {
    const saved = readSessionProgress(REVIEW_REVEAL_PROGRESS_KEY, validateReviewRevealProgress);
    setRevealed(Boolean(saved?.revealed && saved.sentenceId === (currentSentence?.id ?? null)));
    spacePressSentenceIdRef.current = null;
  }, [currentSentence?.id]);

  useEffect(() => {
    writeSessionProgress(REVIEW_REVEAL_PROGRESS_KEY, {
      sentenceId: currentSentence?.id ?? null,
      revealed
    } satisfies ReviewRevealProgress);
  }, [currentSentence?.id, revealed]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreReviewHotkey(event)) return;
      if (!started) return;
      if (isSpaceKey(event.key)) {
        event.preventDefault();
        spacePressSentenceIdRef.current = currentSentence?.id ?? null;
        return;
      }

      const decision = getReviewShortcutAction(event.key);
      if (decision && revealed) {
        event.preventDefault();
        void reviewCurrent(decision);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setRevealed(false);
        returnToMenu();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (shouldIgnoreReviewHotkey(event)) return;
      if (!started) return;
      if (!isSpaceKey(event.key)) return;

      event.preventDefault();
      if (!revealed && shouldRevealOnSpaceRelease(spacePressSentenceIdRef.current, currentSentence?.id ?? null)) {
        setRevealed(true);
      }
      spacePressSentenceIdRef.current = null;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [currentSentence?.id, revealed, returnToMenu, reviewCurrent, started]);

  function handleBackToMenu() {
    setRevealed(false);
    setMenuView("start");
    returnToMenu();
  }

  async function handleReset(scope: ReviewResetScope) {
    await onResetProgress?.(scope);
    setRevealed(false);
    returnToMenu();
  }

  const selectedLessonTitle = selectedLessonIds.length === 1
    ? lessonTitleById.get(selectedLessonIds[0]) ?? "selected lesson"
    : `${selectedLessonIds.length} selected lessons`;

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
            <ReviewMenuTabs active={menuView} onChange={setMenuView} />
            <p className="muted">Select at least one lesson to build a review queue.</p>
          </section>
          {menuView === "statistics" && onResetProgress ? (
            <ReviewStatsBrowser lessons={fullLessons} lessonTitleById={lessonTitleById} sentences={sentences} onReset={handleReset} />
          ) : null}
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
            <ReviewMenuTabs active={menuView} onChange={setMenuView} />
            {menuView === "start" ? (
              <>
                <ReviewQueueDashboard dashboard={queueDashboard} />
                <div className="review-start-actions">
                  <button className="button" type="button" onClick={() => startReview("mixed")}>
                    Start Mixed Review
                  </button>
                  <div className="review-filter-row" aria-label="Review filters">
                    <button className="button secondary" type="button" onClick={() => startReview("due")} disabled={queueDashboard.due === 0}>Due only</button>
                    <button className="button secondary" type="button" onClick={() => startReview("new")} disabled={queueDashboard.new === 0}>New only</button>
                    <button className="button secondary" type="button" onClick={() => startReview("all")}>All selected</button>
                    {onResetProgress && selectedLessonIds.length ? (
                      <button className="button secondary" type="button" onClick={() => setConfirmResetLesson(true)}>
                        <RotateCcw size={16} /> Reset Progress
                      </button>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </section>
          {menuView === "statistics" && onResetProgress ? (
            <ReviewStatsBrowser lessons={fullLessons} lessonTitleById={lessonTitleById} sentences={sentences} onReset={handleReset} />
          ) : null}
          <LearningSciencePanel />
          {confirmResetLesson ? (
            <div className="confirm-backdrop" role="presentation">
              <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-lesson-title">
                <h2 id="reset-lesson-title">Reset Lesson Progress?</h2>
                <p className="muted">This will clear remembered and needs-review status for {selectedLessonTitle}.</p>
                <div className="review-complete-actions">
                  <button type="button" className="button secondary" onClick={() => setConfirmResetLesson(false)}>Cancel</button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setConfirmResetLesson(false);
                      void Promise.all(selectedLessonIds.map((lessonId) => handleReset({ type: "lesson", lessonId })));
                    }}
                  >
                    Reset
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <ReviewSessionComplete
        availableBreakdown={availableBreakdown}
        completedSession={completedSession}
        lessonTitleById={lessonTitleById}
        onRetryWeakCards={() => {
          if (!completedSession?.summary.retrySentenceIds.length) return;
          startFocusedReview(completedSession.summary.retrySentenceIds, "Weak-card retry");
        }}
        onStartDue={() => startReview("due")}
        onStartMixed={() => startReview("mixed")}
        onStartNew={() => startReview("new")}
        onBack={handleBackToMenu}
      />
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
      <button className="button secondary review-back-button" type="button" onClick={handleBackToMenu}>
        Back
      </button>

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

function validateReviewRevealProgress(value: unknown): ReviewRevealProgress | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<ReviewRevealProgress>;
  if (item.sentenceId !== null && typeof item.sentenceId !== "string") return null;
  if (typeof item.revealed !== "boolean") return null;
  return { sentenceId: item.sentenceId ?? null, revealed: item.revealed };
}

function ReviewSessionComplete({
  availableBreakdown,
  completedSession,
  lessonTitleById,
  onBack,
  onRetryWeakCards,
  onStartDue,
  onStartMixed,
  onStartNew
}: {
  availableBreakdown: Record<ReviewSourceBucket, number>;
  completedSession: ReturnType<typeof useReviewDeck>["completedSession"];
  lessonTitleById: Map<string, string>;
  onBack: () => void;
  onRetryWeakCards: () => void;
  onStartDue: () => void;
  onStartMixed: () => void;
  onStartNew: () => void;
}) {
  const sessionSummary = completedSession?.summary;

  if (!sessionSummary) {
    return (
      <section className="card review-empty">
        <h2>Review queue complete</h2>
        <p className="muted">This review pass is complete. Start another mixed review whenever you are ready.</p>
        <div className="review-complete-actions">
          <button className="button" type="button" onClick={onStartMixed}>Start Mixed Review</button>
          <button className="button secondary" type="button" onClick={onStartDue} disabled={availableBreakdown.due === 0}>Due only</button>
          <button className="button secondary" type="button" onClick={onStartNew} disabled={availableBreakdown.new === 0}>New only</button>
          <button className="button secondary" type="button" onClick={onBack}>Back</button>
        </div>
      </section>
    );
  }

  const retryDisabled = sessionSummary.retrySentenceIds.length === 0;
  const strongestOutcome = sessionSummary.retrySoon === 0
    ? "Clean pass. Nothing needs an immediate retry."
    : `${sessionSummary.retrySoon} card${sessionSummary.retrySoon === 1 ? "" : "s"} should come back soon.`;

  return (
    <section className="card review-empty review-complete-card">
      <div className="review-complete-header">
        <div>
          <h2>{completedSession.label} complete</h2>
          <p className="muted">Strong recall rate {sessionSummary.strongRecallRate}%. {strongestOutcome}</p>
        </div>
        <span className="pill">Done</span>
      </div>

      <div className="review-summary">
        <span className="pill">Reviewed {sessionSummary.reviewed}</span>
        {sessionSummary.easy > 0 && <span className="pill grade-stat-easy">Easy {sessionSummary.easy}</span>}
        {sessionSummary.remembered > 0 && <span className="pill review-state-remembered">Remembered {sessionSummary.remembered}</span>}
        {sessionSummary.hard > 0 && <span className="pill grade-stat-hard">Hard {sessionSummary.hard}</span>}
        {sessionSummary.forgot > 0 && <span className="pill review-state-forgotten">Forgot {sessionSummary.forgot}</span>}
      </div>

      <div className="review-complete-grid">
        <StatBlock label="Needs another pass" value={sessionSummary.retrySoon} detail="Forgot + hard answers from this pass." />
        <StatBlock label="Recall promoted" value={sessionSummary.promotedRecallModes} detail="Cards pushed to a tougher recall mode." />
        <StatBlock label="Lessons mixed" value={sessionSummary.lessonCount} detail="Distinct lessons practiced in this session." />
        <StatBlock
          label="Queue mix"
          value={`${sessionSummary.dueCount}/${sessionSummary.newCount}/${sessionSummary.masteredCount}`}
          detail="Due / new / mastered cards reviewed."
        />
      </div>

      <div className="review-complete-focus">
        <h3>Focus next</h3>
        <p className="muted">Use the next pass to either clean up weak cards or shift into fresh material.</p>
        <div className="review-complete-actions">
          <button className="button" type="button" onClick={onRetryWeakCards} disabled={retryDisabled}>
            Retry Weak Cards
          </button>
          <button className="button secondary" type="button" onClick={onStartDue} disabled={availableBreakdown.due === 0}>
            Due Only
          </button>
          <button className="button secondary" type="button" onClick={onStartNew} disabled={availableBreakdown.new === 0}>
            New Only
          </button>
          <button className="button secondary" type="button" onClick={onStartMixed}>
            Mixed Again
          </button>
          <button className="button secondary" type="button" onClick={onBack}>
            Back
          </button>
        </div>
      </div>

      {sessionSummary.toughestLessons.length > 0 ? (
        <div className="review-complete-focus">
          <h3>Where recall slipped</h3>
          <div className="review-summary">
            {sessionSummary.toughestLessons.map((lesson) => (
              <span className="pill review-state-forgotten" key={lesson.lessonId}>
                {lessonTitleById.get(lesson.lessonId) ?? "Untitled lesson"} {lesson.misses}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReviewMenuTabs({
  active,
  onChange
}: {
  active: "start" | "statistics";
  onChange: (view: "start" | "statistics") => void;
}) {
  return (
    <div className="mode-tabs review-menu-tabs" role="tablist" aria-label="Review menu">
      <button type="button" className={active === "start" ? "active" : ""} onClick={() => onChange("start")}>
        Start
      </button>
      <button type="button" className={active === "statistics" ? "active" : ""} onClick={() => onChange("statistics")}>
        Statistics
      </button>
      <a className="button secondary" href="/study/imported-content">Back</a>
    </div>
  );
}

function StatBlock({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="review-complete-stat">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
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

interface ReviewQueueDashboardData {
  due: number;
  new: number;
  mastered: number;
  mixedCount: number;
  allCount: number;
  nextDueLabel: string;
}

function ReviewQueueDashboard({ dashboard }: { dashboard: ReviewQueueDashboardData }) {
  const mixedDetail = dashboard.mixedCount === dashboard.allCount
    ? "Mixed will include every selected sentence."
    : `Mixed will start ${dashboard.mixedCount} of ${dashboard.allCount} selected sentences.`;

  return (
    <section className="review-queue-dashboard" aria-label="Review queue dashboard">
      <div className="review-queue-dashboard-top">
        <div>
          <h2>Queue dashboard</h2>
          <p className="muted">{mixedDetail}</p>
        </div>
        <span className="pill">{dashboard.nextDueLabel}</span>
      </div>
      <div className="review-queue-stats">
        <QueueStat icon={<CalendarClock size={18} />} label="Due now" value={dashboard.due} detail="Reviewed cards ready again." />
        <QueueStat icon={<Sparkles size={18} />} label="New" value={dashboard.new} detail="Cards with no repetitions yet." />
        <QueueStat icon={<CheckCircle2 size={18} />} label="Not due" value={dashboard.mastered} detail="Reviewed cards waiting for later." />
        <QueueStat icon={<Layers3 size={18} />} label="Mixed size" value={dashboard.mixedCount} detail="What Start Mixed Review opens." />
      </div>
    </section>
  );
}

function QueueStat({
  icon,
  label,
  value,
  detail
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="review-queue-stat">
      <span className="review-queue-stat-icon" aria-hidden="true">{icon}</span>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
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
  const selectedCount = lessons.reduce((count, lesson) => count + (selected.has(lesson.id) ? (sentenceCountByLesson.get(lesson.id) ?? 0) : 0), 0);

  function toggleLesson(lessonId: string) {
    if (selected.has(lessonId)) {
      handleChange(selectedLessonIds.filter((id) => id !== lessonId));
      return;
    }
    handleChange([...selectedLessonIds, lessonId]);
  }

  return (
    <fieldset className="review-lesson-select">
      <div className="review-lesson-select-top">
        <legend>Lessons</legend>
        <span className="muted">{selectedCount} of {totalSentenceCount} sentences</span>
      </div>
      <div className="review-lesson-tools">
        <button className="button secondary" type="button" onClick={() => handleChange(lessons.map((lesson) => lesson.id))} disabled={allSelected}>
          Select all
        </button>
        <button className="button secondary" type="button" onClick={() => handleChange([])} disabled={!selectedLessonIds.length}>
          Clear
        </button>
      </div>
      <div className="review-lesson-checks">
        {lessons.map((lesson) => {
          const count = sentenceCountByLesson.get(lesson.id) ?? 0;
          return (
            <label className="review-lesson-check" key={lesson.id}>
              <input
                type="checkbox"
                checked={selected.has(lesson.id)}
                onChange={() => toggleLesson(lesson.id)}
              />
              <span>
                <strong>{lesson.title}</strong>
                <small>{count} sentences</small>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
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

function summarizeAvailableSentences(sentences: ReviewSentence[]) {
  const now = new Date();
  return sentences.reduce<Record<ReviewSourceBucket, number>>((totals, sentence) => {
    if ((sentence.repetitions ?? 0) === 0) totals.new += 1;
    else if (new Date(sentence.dueAt ?? 0).getTime() <= now.getTime()) totals.due += 1;
    else totals.mastered += 1;
    return totals;
  }, { due: 0, new: 0, mastered: 0 });
}

function buildQueueDashboard(sentences: ReviewSentence[]): ReviewQueueDashboardData {
  const now = new Date();
  const available = summarizeAvailableSentences(sentences);
  const mixedCount = buildInterleavedReviewQueue(sentences, {
    filter: "mixed",
    seed: 0,
    shuffled: false,
    now
  }).length;
  const nextDueAt = sentences
    .filter((sentence) => (sentence.repetitions ?? 0) > 0)
    .map((sentence) => sentence.dueAt ? new Date(sentence.dueAt) : null)
    .filter((date): date is Date => date instanceof Date && date.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  return {
    ...available,
    mixedCount,
    allCount: sentences.length,
    nextDueLabel: available.due > 0
      ? `${available.due} due now`
      : nextDueAt
        ? `Next due ${formatRelativeDueTime(nextDueAt, now)}`
        : "No scheduled due cards"
  };
}

function formatRelativeDueTime(dueAt: Date, now: Date) {
  const minutes = Math.max(1, Math.ceil((dueAt.getTime() - now.getTime()) / (60 * 1000)));
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.ceil(hours / 24);
  return `in ${days}d`;
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
