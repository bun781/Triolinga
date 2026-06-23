"use client";

import { useEffect, useState } from "react";
import { Download, Upload } from "lucide-react";
import { PageState } from "@/components/system/PageState";
import { exportLesson, getLessons } from "@/lib/desktopApi";
import type { StudyLessonMeta } from "@/lib/imported-content/types";
import { useImportedLessonBrowser } from "./useImportedLessonBrowser";
import { ImportedContentStudy } from "./ImportedContentStudy";
import { MultipleChoiceMode } from "./MultipleChoiceMode";
import { FillBlankMode } from "./FillBlankMode";

type StudyMode = "lesson" | "fill-blank" | "multiple-choice";

interface Props {
  mode?: StudyMode;
}

const LESSON_IMPORT_DRAFT_KEY = "fydor:lesson-import-draft";

const modeContent: Record<StudyMode, { title: string; description: string }> = {
  lesson: {
    title: "Saved Lessons",
    description: "Study and review saved lessons sentence by sentence."
  },
  "fill-blank": {
    title: "Fill Blank",
    description: "Practice active recall by filling missing words, grammar patterns, and chunks."
  },
  "multiple-choice": {
    title: "Multiple Choice",
    description: "Quiz yourself on the same imported lesson pool with multiple-choice prompts."
  }
};

export function ImportedContentWorkspace({ mode = "lesson" }: Props) {
  const content = modeContent[mode];
  const [allLessons, setAllLessons] = useState<StudyLessonMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLessons() {
      const lessons = await getLessons();

      if (!cancelled) {
        setAllLessons(lessons);
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

  const browser = useImportedLessonBrowser(null, allLessons);

  if (loading) {
    return <PageState eyebrow="Loading" title="Loading lessons" description="Opening your saved lessons." />;
  }

  if (error) {
    return (
      <PageState
        eyebrow="Storage error"
        tone="error"
        title="Saved Lessons failed to load"
        description={error}
        actions={<a className="button" href="/study/imported-content">Retry</a>}
      />
    );
  }

  if (!allLessons.length) {
    return (
      <PageState
        eyebrow="No data yet"
        title="No saved lessons yet"
        description="Save a lesson first. When lessons exist, this page will show them grouped by language and let you study them sentence by sentence."
        actions={<a className="button" href="/admin/imports">Import a lesson</a>}
      />
    );
  }

  async function downloadActiveLesson() {
    if (!browser.lesson || browser.loadingLesson) return;

    try {
      setActionError(null);
      const lesson = await exportLesson(browser.lesson.id);
      const blob = new Blob([JSON.stringify(lesson, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const filename = `${slugifyLessonTitle(lesson.title)}.json`;

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      anchor.click();

      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to export the lesson.");
    }
  }

  async function importLessonFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();

    try {
      JSON.parse(text);
    } catch {
      setActionError("The selected file is not valid JSON.");
      return;
    }

    setActionError(null);
    window.localStorage.setItem(LESSON_IMPORT_DRAFT_KEY, text);
    window.location.href = "/admin/imports";
  }

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h1>{content.title}</h1>
          <p className="muted">{content.description}</p>
        </div>
        <div className="row compact-row">
          <button className="button secondary" type="button" disabled={!browser.lesson || browser.loadingLesson} onClick={() => void downloadActiveLesson()}>
            <Download size={18} />
            Export JSON
          </button>
          <label className="button secondary">
            <Upload size={18} />
            Import lesson
            <input className="hidden-input" type="file" accept="application/json,.json" onChange={(event) => void importLessonFile(event.target.files?.[0])} />
          </label>
        </div>
      </div>

      {actionError ? <p className="review-error">{actionError}</p> : null}

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
            value={browser.selectedLessonId}
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

      {browser.error ? <p className="review-error">{browser.error}</p> : null}

      {mode === "lesson" ? (
        <ImportedContentStudy lesson={browser.lesson} loadingLesson={browser.loadingLesson} />
      ) : mode === "fill-blank" ? (
        <FillBlankMode lesson={browser.lesson} />
      ) : (
        <MultipleChoiceMode lesson={browser.lesson} />
      )}
    </div>
  );
}

function slugifyLessonTitle(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "lesson";
}
