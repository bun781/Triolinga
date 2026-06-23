"use client";

import { invoke } from "@tauri-apps/api/core";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import type { LessonImportInput, LessonImportPreviewResult, LessonImportSummary } from "@/lib/language/types";
import type { ReviewDecision, ReviewSentence } from "@/lib/review/types";

export async function getLessons(): Promise<StudyLessonMeta[]> {
  return invoke("get_lessons");
}

export async function getLesson(lessonId: string): Promise<StudyLesson | null> {
  return invoke("get_lesson", { lessonId });
}

export async function exportLesson(lessonId: string): Promise<LessonImportInput> {
  return invoke("export_lesson", { lessonId });
}

export async function previewLessonImport(source: string, lessonId?: string): Promise<LessonImportPreviewResult> {
  return invoke("preview_lesson_import", { source, ...(lessonId ? { lessonId } : {}) });
}

export async function importLesson(source: string, lessonId?: string): Promise<LessonImportSummary> {
  return invoke("import_lesson", { source, ...(lessonId ? { lessonId } : {}) });
}

export async function getReviewQueue(): Promise<ReviewSentence[]> {
  return invoke("get_review_queue");
}

export async function updateReviewItem(sentenceId: string, decision: ReviewDecision): Promise<ReviewSentence> {
  return invoke("update_review_item", { sentenceId, decision });
}

export async function saveUserSettings(settings: Record<string, unknown>): Promise<void> {
  await invoke("save_user_settings", { settings });
}
