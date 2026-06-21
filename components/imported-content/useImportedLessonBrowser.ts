"use client";

import { useEffect, useMemo, useState } from "react";
import { getLesson } from "@/lib/desktopApi";
import { groupLessonsByLanguage } from "@/lib/language/importResources";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import type { ChangeEvent } from "react";

export function useImportedLessonBrowser(initialLesson: StudyLesson | null, allLessons: StudyLessonMeta[]) {
  const languageGroups = useMemo(() => groupLessonsByLanguage(allLessons), [allLessons]);
  const [lesson, setLesson] = useState(initialLesson);
  const [selectedLanguage, setSelectedLanguage] = useState(
    initialLesson?.language ?? allLessons[0]?.language ?? ""
  );
  const [loadingLesson, setLoadingLesson] = useState(false);

  useEffect(() => {
    setLesson(initialLesson);
    setSelectedLanguage(initialLesson?.language ?? allLessons[0]?.language ?? "");
  }, [allLessons, initialLesson]);

  const activeLanguageGroup = languageGroups.find((group) => group.language === selectedLanguage) ?? languageGroups[0] ?? null;
  const languageLessons = activeLanguageGroup?.lessons ?? [];

  useEffect(() => {
    if (!selectedLanguage && languageGroups[0]) {
      setSelectedLanguage(languageGroups[0].language);
    }
  }, [languageGroups, selectedLanguage]);

  async function switchLesson(lessonId: string) {
    setLoadingLesson(true);
    try {
      const next = await getLesson(lessonId);
      if (next) {
        setLesson(next);
        setSelectedLanguage(next.language);
      }
    } finally {
      setLoadingLesson(false);
    }
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
    languageGroups,
    languageLessons,
    lesson,
    loadingLesson,
    selectedLanguage,
    switchLesson
  };
}
