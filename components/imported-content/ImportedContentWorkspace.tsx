"use client";

import { useEffect, useState } from "react";
import { PageState } from "@/components/system/PageState";
import { getLesson, getLessons } from "@/lib/desktopApi";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import { useImportedLessonBrowser } from "./useImportedLessonBrowser";
import { ImportedContentStudy } from "./ImportedContentStudy";
import { MultipleChoiceMode } from "./MultipleChoiceMode";

type StudyMode = "lesson" | "multiple-choice";

interface Props {
  initialMode?: StudyMode;
}

const modeLabels: Record<StudyMode, string> = {
  lesson: "Imported lesson",
  "multiple-choice": "Multiple choice"
};

export function ImportedContentWorkspace({ initialMode = "lesson" }: Props) {
  const [mode, setMode] = useState<StudyMode>(initialMode);
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

  const browser = useImportedLessonBrowser(latestLesson, allLessons);

  if (loading) {
    return <PageState eyebrow="Loading" title="Loading lessons" description="Opening your local lesson library." />;
  }

  if (error) {
    return (
      <PageState
        eyebrow="Storage error"
        tone="error"
        title="Lesson Library failed to load"
        description={error}
        actions={<a className="button" href="/study/imported-content">Retry</a>}
      />
    );
  }

  if (!allLessons.length) {
    return (
      <PageState
        eyebrow="No data yet"
        title="No lessons in the library"
        description="Save a lesson first. When lessons exist, this page will show them grouped by language and let you study them sentence by sentence."
        actions={<a className="button" href="/admin/imports">Import a lesson</a>}
      />
    );
  }

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h1>{modeLabels[mode]}</h1>
          <p className="muted">
            {mode === "lesson"
              ? "Study and review saved lessons sentence by sentence."
              : "Quiz yourself on the same imported lesson pool with multiple-choice prompts."}
          </p>
        </div>
      </div>

      <div className="mode-tabs study-mode-tabs" role="tablist" aria-label="Imported lesson modes">
        <button type="button" className={mode === "lesson" ? "active" : ""} onClick={() => setMode("lesson")}>
          Imported lesson
        </button>
        <button
          type="button"
          className={mode === "multiple-choice" ? "active" : ""} onClick={() => setMode("multiple-choice")}
        >
          Multiple choice
        </button>
      </div>

      <div className="lesson-selector-bar">
        {browser.languageGroups.length > 1 ? (
          <select
            className="input selector-compact"
            value={browser.selectedLanguage}
            disabled={browser.loadingLesson}
            onChange={browser.handleLanguageChange}
          >
            {browser.languageGroups.map((group) => (
              <option key={group.language} value={group.language}>
                {group.label}
              </option>
            ))}
          </select>
        ) : null}

        {browser.languageLessons.length > 1 ? (
          <select
            className="input selector-compact"
            value={browser.lesson?.id ?? ""}
            disabled={browser.loadingLesson}
            onChange={(event) => void browser.switchLesson(event.target.value)}
          >
            {browser.languageLessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
        ) : null}

        {browser.loadingLesson ? <span className="pill">Loading lesson…</span> : null}
      </div>

      {mode === "lesson" ? (
        <ImportedContentStudy lesson={browser.lesson} allLessons={allLessons} />
      ) : (
        <MultipleChoiceMode lesson={browser.lesson} />
      )}
    </div>
  );
}
