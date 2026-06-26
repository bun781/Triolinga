"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ReviewDeck } from "@/components/review/ReviewDeck";
import { PageState } from "@/components/system/PageState";
import { getLessons, getReviewQueue } from "@/lib/desktopApi";
import type { StudyLessonMeta } from "@/lib/imported-content/types";
import type { ReviewSentence } from "@/lib/review/types";

export default function ReviewPage() {
  const [sentences, setSentences] = useState<ReviewSentence[]>([]);
  const [lessons, setLessons] = useState<StudyLessonMeta[]>([]);
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
      .then(([queue, lessonList]) => {
        if (cancelled) return;
        setSentences(queue);
        setLessons(lessonList);
        setSelectedLessonIds(getAvailableLessonIds(queue, lessonList));
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
          sentenceCountByLesson={sentenceCountByLesson}
          selectedLessonIds={selectedLessonIds}
          sentences={filteredSentences}
          onSelectedLessonIdsChange={setSelectedLessonIds}
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
  if (!selectedLessonIds.length) return sentences;
  const selected = new Set(selectedLessonIds);
  return sentences.filter((sentence) => sentence.lessonId && selected.has(sentence.lessonId));
}
