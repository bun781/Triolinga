"use client";

import { useEffect, useMemo, useState } from "react";
import { getLesson } from "@/lib/desktopApi";
import { groupLessonsByLanguage } from "@/lib/language/importResources";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import type { ChangeEvent } from "react";
import { readSessionProgress, writeSessionProgress } from "./sessionProgress";

const SELECTED_LESSON_KEY = "selected-lesson";

interface SelectedLessonProgress {
  lessonId: string;
}

export function useImportedLessonBrowser(initialLesson: StudyLesson | null, allLessons: StudyLessonMeta[]) {
  const languageGroups = useMemo(() => groupLessonsByLanguage(allLessons), [allLessons]);
  const [savedSelection] = useState(() => readSessionProgress(SELECTED_LESSON_KEY, validateSelectedLessonProgress));
  const savedLesson = savedSelection?.lessonId
    ? allLessons.find((item) => item.id === savedSelection.lessonId) ?? null
    : null;
  const [lesson, setLesson] = useState(initialLesson);
  const [selectedLessonId, setSelectedLessonId] = useState(initialLesson?.id ?? savedLesson?.id ?? allLessons[0]?.id ?? "");
  const [selectedLanguage, setSelectedLanguage] = useState(
    initialLesson?.language ?? savedLesson?.language ?? allLessons[0]?.language ?? ""
  );
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLesson) {
      setLesson(initialLesson);
      setSelectedLessonId(initialLesson.id);
      setSelectedLanguage(initialLesson.language);
    }
  }, [initialLesson]);

  useEffect(() => {
    if (!allLessons.length) {
      setLesson(null);
      setSelectedLessonId("");
      setSelectedLanguage("");
      return;
    }

    if (!selectedLessonId || !allLessons.some((item) => item.id === selectedLessonId)) {
      const fallback = savedSelection?.lessonId
        ? allLessons.find((item) => item.id === savedSelection.lessonId) ?? allLessons[0]
        : allLessons[0];
      setSelectedLessonId(fallback.id);
      setSelectedLanguage(fallback.language);
      writeSessionProgress(SELECTED_LESSON_KEY, { lessonId: fallback.id });
    }
  }, [allLessons, savedSelection?.lessonId, selectedLessonId]);

  const activeLanguageGroup = languageGroups.find((group) => group.language === selectedLanguage) ?? languageGroups[0] ?? null;
  const languageLessons = activeLanguageGroup?.lessons ?? [];

  useEffect(() => {
    if (!selectedLanguage && languageGroups[0]) {
      setSelectedLanguage(languageGroups[0].language);
    }
  }, [languageGroups, selectedLanguage]);

  useEffect(() => {
    if (!selectedLessonId || lesson?.id === selectedLessonId) return;

    let cancelled = false;
    setLoadingLesson(true);
    setError(null);

    getLesson(selectedLessonId)
      .then((next) => {
        if (cancelled) return;
        if (next) {
          setLesson(next);
          setSelectedLanguage(next.language);
        } else {
          setLesson(null);
          setError("Selected lesson could not be loaded.");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLesson(null);
          setError(err instanceof Error ? err.message : "Unable to load selected lesson.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLesson(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lesson?.id, selectedLessonId]);

  function switchLesson(lessonId: string) {
    setSelectedLessonId(lessonId);
    writeSessionProgress(SELECTED_LESSON_KEY, { lessonId });
    const selectedMeta = allLessons.find((item) => item.id === lessonId);
    if (selectedMeta) setSelectedLanguage(selectedMeta.language);
  }

  function handleLanguageChange(event: ChangeEvent<HTMLSelectElement>) {
    const language = event.target.value;
    setSelectedLanguage(language);
    const group = languageGroups.find((item) => item.language === language);
    const nextLesson = group?.lessons[0];
    if (nextLesson) void switchLesson(nextLesson.id);
  }

  return {
    handleLanguageChange,
    error,
    languageGroups,
    languageLessons,
    lesson,
    loadingLesson,
    selectedLessonId,
    selectedLanguage,
    switchLesson
  };
}

function validateSelectedLessonProgress(value: unknown): SelectedLessonProgress | null {
  if (!value || typeof value !== "object") return null;
  const lessonId = (value as Partial<SelectedLessonProgress>).lessonId;
  return typeof lessonId === "string" ? { lessonId } : null;
}
