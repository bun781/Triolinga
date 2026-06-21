"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ImportedContentStudy } from "@/components/imported-content/ImportedContentStudy";
import { PageState } from "@/components/system/PageState";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import { getLesson, getLessons } from "@/lib/desktopApi";

export default function ImportedContentPage() {
  const [allLessons, setAllLessons] = useState<StudyLessonMeta[]>([]);
  const [latestLesson, setLatestLesson] = useState<StudyLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLessons() {
      const lessons = await getLessons();
      const firstLesson = lessons[0] ? await getLesson(lessons[0].id) : null;

      if (!cancelled) {
        setAllLessons(lessons);
        setLatestLesson(firstLesson);
      }
    }

    loadLessons()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load imported lessons.");
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
      <div className="topbar">
        <div>
          <h1>Lesson Library</h1>
          <p className="muted">Study and review saved lessons sentence by sentence.</p>
        </div>
      </div>

      {loading ? (
        <PageState eyebrow="Loading" title="Loading lessons" description="Opening your local lesson library." />
      ) : error ? (
        <PageState
          eyebrow="Storage error"
          tone="error"
          title="Lesson Library failed to load"
          description={error}
          actions={<a className="button" href="/study/imported-content">Retry</a>}
        />
      ) : allLessons.length ? (
        <ImportedContentStudy lesson={latestLesson} allLessons={allLessons} />
      ) : (
        <PageState
          eyebrow="No data yet"
          title="No lessons in the library"
          description="Save a lesson first. When lessons exist, this page will show them grouped by language and let you study them sentence by sentence."
          actions={<a className="button" href="/admin/imports">Import a lesson</a>}
        />
      )}
    </AppShell>
  );
}
