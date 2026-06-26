"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ReviewDeck } from "@/components/review/ReviewDeck";
import { PageState } from "@/components/system/PageState";
import { getLesson, getLessons, getReviewQueue, resetReviewProgress } from "@/lib/desktopApi";
import { readSessionProgress, writeSessionProgress } from "@/components/imported-content/sessionProgress";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import type { ReviewResetScope, ReviewSentence } from "@/lib/review/types";

const REVIEW_SELECTION_KEY = "review.selected-lessons";

interface ReviewSelectionProgress {
  lessonIds: string[];
}

export default function ReviewPage() {
  const [sentences, setSentences] = useState<ReviewSentence[]>([]);
  const [lessons, setLessons] = useState<StudyLessonMeta[]>([]);
  const [fullLessons, setFullLessons] = useState<StudyLesson[]>([]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filteredSentences = useMemo(
    () => filterSentencesByLesson(sentences, selectedLessonIds),
    [selectedLessonIds, sentences]
  );
  const sentenceCountByLesson = useMemo(() => getSentenceCountByLesson(sentences), [sentences]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getReviewQueue(), getLessons()])
      .then(async ([queue, lessonList]) => {
        if (cancelled) return;
        const loadedLessons = await Promise.all(lessonList.map((item) => getLesson(item.id)));
        if (cancelled) return;
        const availableLessonIds = getAvailableLessonIds(queue, lessonList);
        const savedSelection = readSessionProgress(REVIEW_SELECTION_KEY, validateReviewSelectionProgress);
        const restoredLessonIds = savedSelection
          ? savedSelection.lessonIds.filter((id) => availableLessonIds.includes(id))
          : [];

        setSentences(queue);
        setLessons(lessonList);
        setFullLessons(loadedLessons.filter((item): item is StudyLesson => Boolean(item)));
        setSelectedLessonIds(restoredLessonIds.length ? restoredLessonIds : availableLessonIds);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load review sentences.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleResetProgress(scope: ReviewResetScope) {
    await resetReviewProgress(scope);
    const queue = await getReviewQueue();
    setSentences(queue);
  }

  return (
    <AppShell>
      {loading ? (
        <PageState eyebrow="Loading" title="Loading review" description="Preparing your sentence queue." />
      ) : error ? (
        <PageState
          eyebrow="Storage error"
          tone="error"
          title="Review failed to load"
          description={error}
          actions={<a className="button" href="/review">Retry</a>}
        />
      ) : sentences.length ? (
        <ReviewDeck
          allSentenceCount={sentences.length}
          lessons={lessons}
          fullLessons={filterLessonsByLesson(fullLessons, selectedLessonIds)}
          sentenceCountByLesson={sentenceCountByLesson}
          selectedLessonIds={selectedLessonIds}
          sentences={filteredSentences}
          onResetProgress={handleResetProgress}
          onSelectedLessonIdsChange={(lessonIds) => {
            setSelectedLessonIds(lessonIds);
            writeSessionProgress(REVIEW_SELECTION_KEY, { lessonIds });
          }}
        />
      ) : (
        <PageState
          eyebrow="No data yet"
          title="No sentences to review"
          description="Import a lesson first. Once a lesson saves sentences into the database, they will appear here for review."
          actions={<a className="button" href="/lessons/manage">Open lesson manager</a>}
        />
      )}
    </AppShell>
  );
}

function filterLessonsByLesson(lessons: StudyLesson[], selectedLessonIds: string[]) {
  if (!selectedLessonIds.length) return [];
  const selected = new Set(selectedLessonIds);
  return lessons.filter((lesson) => selected.has(lesson.id));
}

function validateReviewSelectionProgress(value: unknown): ReviewSelectionProgress | null {
  if (!value || typeof value !== "object") return null;
  const lessonIds = (value as Partial<ReviewSelectionProgress>).lessonIds;
  return Array.isArray(lessonIds) && lessonIds.every((id) => typeof id === "string")
    ? { lessonIds }
    : null;
}

function getSentenceCountByLesson(sentences: ReviewSentence[]) {
  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    if (!sentence.lessonId) continue;
    counts.set(sentence.lessonId, (counts.get(sentence.lessonId) ?? 0) + 1);
  }
  return counts;
}

function getAvailableLessonIds(sentences: ReviewSentence[], lessons: StudyLessonMeta[]) {
  const lessonIds = lessons.length
    ? lessons.map((lesson) => lesson.id)
    : sentences.flatMap((sentence) => sentence.lessonId ? [sentence.lessonId] : []);
  return [...new Set(lessonIds)];
}

function filterSentencesByLesson(
  sentences: ReviewSentence[],
  selectedLessonIds: string[]
) {
  if (!sentences.some((sentence) => sentence.lessonId)) return sentences;
  if (!selectedLessonIds.length) return [];
  const selected = new Set(selectedLessonIds);
  return sentences.filter((sentence) => sentence.lessonId && selected.has(sentence.lessonId));
}
