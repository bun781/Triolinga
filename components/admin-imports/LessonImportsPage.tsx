"use client";

import {
  BookOpen,
  Check,
  FileJson,
  Highlighter,
  Library,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { LessonLibraryPanel } from "@/components/admin-imports/LessonLibraryPanel";
import { LanguageField } from "@/components/admin-imports/LanguageField";
import { ImportHelpPanel } from "@/components/language/ImportHelpPanel";
import { ImportPreview } from "@/components/language/ImportPreview";
import { Tooltip } from "@/components/ui/Tooltip";
import { readSessionProgress, writeSessionProgress } from "@/components/imported-content/sessionProgress";
import {
  deleteLesson as deleteLessonApi,
  exportLesson as exportLessonApi,
  getLessons,
  importLesson as importLessonApi,
  previewLessonImport,
  updateLesson as updateLessonApi
} from "@/lib/desktopApi";
import type { StudyLessonMeta } from "@/lib/imported-content/types";
import type {
  LessonChunkInput,
  LessonGrammarInput,
  LessonImportInput,
  LessonImportPreviewResult,
  LessonImportSummary,
  LessonSentenceInput,
  LessonWordInput
} from "@/lib/language/types";
import {
  LESSON_IMPORT_DRAFT_KEY,
  createDraft,
  createEmptySentence,
  getCharAnnotationClassName,
  getCharIndex,
  initialLesson,
  pruneEmpty,
  sampleLesson,
  splitTags,
  stringifyLesson
} from "./lesson-import-utils";
import type { AnnotationDraft, SelectedSpan } from "./lesson-import-utils";

type WorkspaceMode = "builder" | "json" | "lessons";
type AnnotationKind = AnnotationDraft["kind"];

interface LessonImportsPageProps {
  initialMode?: WorkspaceMode;
}

const LESSON_MANAGER_PROGRESS_KEY = "lesson-manager.workspace";

interface LessonManagerProgress {
  mode: WorkspaceMode;
  lesson: LessonImportInput;
  activeSentenceIndex: number;
  draft: AnnotationDraft;
  source: string;
  appendSource: string;
  targetLessonId: string;
  editorLessonId: string | null;
  selectedLibraryLessonId: string | null;
}

// Chunk: editor state and data loading
export default function LessonImportsPage({ initialMode = "builder" }: LessonImportsPageProps) {
  const [savedProgress] = useState(() => readSessionProgress(LESSON_MANAGER_PROGRESS_KEY, validateLessonManagerProgress));
  const initialEditorLesson = savedProgress?.lesson ?? initialLesson;
  const [mode, setMode] = useState<WorkspaceMode>(savedProgress?.mode ?? initialMode);
  const [lesson, setLesson] = useState<LessonImportInput>(initialEditorLesson);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(() => (
    clampSentenceIndex(savedProgress?.activeSentenceIndex ?? 0, initialEditorLesson)
  ));
  const [selection, setSelection] = useState<SelectedSpan | null>(null);
  const [draft, setDraft] = useState<AnnotationDraft>(savedProgress?.draft ?? createDraft());
  const [source, setSource] = useState(() => savedProgress?.source ?? stringifyLesson(initialEditorLesson));
  const [appendSource, setAppendSource] = useState(savedProgress?.appendSource ?? "");
  const [preview, setPreview] = useState<LessonImportPreviewResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<LessonImportSummary | null>(null);
  const [lessonOptions, setLessonOptions] = useState<StudyLessonMeta[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [targetLessonId, setTargetLessonId] = useState(savedProgress?.targetLessonId ?? "new");
  const [editorLessonId, setEditorLessonId] = useState<string | null>(savedProgress?.editorLessonId ?? null);
  const [selectedLibraryLessonId, setSelectedLibraryLessonId] = useState<string | null>(savedProgress?.selectedLibraryLessonId ?? null);

  const activeSentence = lesson.sentences[activeSentenceIndex] ?? createEmptySentence();
  const appendingToExistingLesson = editorLessonId === null && targetLessonId !== "new";
  const editingExistingLesson = editorLessonId !== null;
  const activeAnnotations = useMemo(
    () => [
      ...(activeSentence.words ?? []).map((item, index) => ({ kind: "word" as const, index, label: item.surface, detail: item.meaning })),
      ...(activeSentence.grammar ?? []).map((item, index) => ({ kind: "grammar" as const, index, label: item.surface ?? item.pattern, detail: item.meaning })),
      ...(activeSentence.chunks ?? []).map((item, index) => ({ kind: "chunk" as const, index, label: item.surface, detail: item.meaning }))
    ],
    [activeSentence]
  );
  const currentTargetLessonId = editorLessonId ?? (targetLessonId !== "new" ? targetLessonId : undefined);
  const canAppendSentenceJson = Boolean(currentTargetLessonId);
  const usingAppendSentenceJson = canAppendSentenceJson && appendSource.trim().length > 0;
  const saveActionLabel = usingAppendSentenceJson ? "Append" : editingExistingLesson ? "Update" : "Save";
  const targetLesson = lessonOptions.find((item) => item.id === targetLessonId);
  const appendJsonPlaceholder = `{
  "text": "你好。",
  "translation": "Hello.",
  "words": [
    {
      "surface": "你好",
      "meaning": "hello"
    }
  ]
}`;

  useEffect(() => {
    let cancelled = false;

    refreshLessons().finally(() => {
      if (!cancelled) setLessonsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const importedSource = window.localStorage.getItem(LESSON_IMPORT_DRAFT_KEY);
    if (!importedSource) return;

    window.localStorage.removeItem(LESSON_IMPORT_DRAFT_KEY);
    loadLessonSource(importedSource, "builder");
  }, []);

  useEffect(() => {
    writeSessionProgress(LESSON_MANAGER_PROGRESS_KEY, {
      mode,
      lesson,
      activeSentenceIndex,
      draft,
      source,
      appendSource,
      targetLessonId,
      editorLessonId,
      selectedLibraryLessonId
    } satisfies LessonManagerProgress);
  }, [activeSentenceIndex, appendSource, draft, editorLessonId, lesson, mode, selectedLibraryLessonId, source, targetLessonId]);

  function syncLesson(nextLesson: LessonImportInput) {
    setLesson(nextLesson);
    setSource(stringifyLesson(nextLesson));
    setPreview(null);
    setSummary(null);
    setStatus("");
    setErrors([]);
  }

  async function refreshLessons() {
    try {
      const items = await getLessons();
      setLessonOptions(items);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load lessons."]);
    }
  }

  function loadLessonSource(text: string, fallbackMode: WorkspaceMode, lessonId: string | null = null) {
    setSource(text);
    setTargetLessonId("new");
    setEditorLessonId(lessonId);
    setSelectedLibraryLessonId(lessonId);
    setActiveSentenceIndex(0);
    setSelection(null);
    setDraft(createDraft());
    setPreview(null);
    setErrors([]);
    setStatus("");
    setSummary(null);
    setAppendSource("");

    try {
      setLesson(JSON.parse(text) as LessonImportInput);
      setMode("builder");
    } catch {
      setMode(fallbackMode);
    }
  }

  function updateLessonField<K extends keyof LessonImportInput>(field: K, value: LessonImportInput[K]) {
    syncLesson({ ...lesson, [field]: value });
  }

  function addTagFromValue(value: string) {
    const nextTags = splitTags(value);
    if (!nextTags.length) return;
    updateLessonField("tags", Array.from(new Set([...(lesson.tags ?? []), ...nextTags])));
  }

  function removeLessonTag(tagToRemove: string) {
    updateLessonField("tags", (lesson.tags ?? []).filter((tag) => tag !== tagToRemove));
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addTagFromValue(event.currentTarget.value);
    event.currentTarget.value = "";
  }

  function updateSentence(field: keyof LessonSentenceInput, value: string) {
    const sentences = lesson.sentences.map((sentence, index) => (
      index === activeSentenceIndex ? { ...sentence, [field]: value } : sentence
    ));
    syncLesson({ ...lesson, sentences });
    setSelection(null);
    setDraft(createDraft());
  }

  function addSentence(afterIndex = activeSentenceIndex) {
    const nextSentence = createEmptySentence();
    const sentences = [...lesson.sentences];
    sentences.splice(Math.min(afterIndex + 1, sentences.length), 0, nextSentence);
    syncLesson({ ...lesson, sentences });
    setActiveSentenceIndex(Math.min(afterIndex + 1, sentences.length - 1));
    setSelection(null);
    setDraft(createDraft());
  }

  function removeSentence(indexToRemove: number) {
    if (lesson.sentences.length === 1) return;
    const sentences = lesson.sentences.filter((_, index) => index !== indexToRemove);
    const nextIndex = Math.min(activeSentenceIndex, sentences.length - 1);
    syncLesson({ ...lesson, sentences });
    setActiveSentenceIndex(nextIndex);
    setSelection(null);
    setDraft(createDraft());
  }

  function captureSelection() {
    const browserSelection = window.getSelection();
    if (!browserSelection || browserSelection.isCollapsed) return;

    const anchor = getCharIndex(browserSelection.anchorNode);
    const focus = getCharIndex(browserSelection.focusNode);
    if (anchor === null || focus === null) return;

    const start = Math.min(anchor, focus);
    const end = Math.max(anchor, focus);
    const chars = Array.from(activeSentence.text);
    const surface = chars.slice(start, end + 1).join("").trim();
    browserSelection.removeAllRanges();

    if (!surface) return;
    const selected = { start, end, surface };
    setSelection(selected);
    setDraft((current) => ({
      ...createDraft(surface),
      kind: current.kind,
      pattern: current.kind === "grammar" ? surface : ""
    }));
  }

  function addAnnotation() {
    const surface = draft.surface.trim();
    if (!surface) {
      setErrors(["Select text in the sentence or enter a surface manually."]);
      return;
    }

    const sentence = lesson.sentences[activeSentenceIndex];
    let nextSentence: LessonSentenceInput;

    if (draft.kind === "word") {
      const word: LessonWordInput = pruneEmpty({
        surface,
        lemma: draft.lemma,
        meaning: draft.meaning,
        role: draft.role,
        explanation: draft.explanation
      });
      nextSentence = { ...sentence, words: [...(sentence.words ?? []), word] };
    } else if (draft.kind === "grammar") {
      const grammar: LessonGrammarInput = pruneEmpty({
        pattern: draft.pattern.trim() || surface,
        surface,
        meaning: draft.meaning,
        explanation: draft.explanation
      });
      nextSentence = { ...sentence, grammar: [...(sentence.grammar ?? []), grammar] };
    } else {
      const chunk: LessonChunkInput = pruneEmpty({
        surface,
        meaning: draft.meaning,
        explanation: draft.explanation,
        type: draft.chunkType,
        level: draft.level,
        tags: splitTags(draft.tags)
      });
      nextSentence = { ...sentence, chunks: [...(sentence.chunks ?? []), chunk] };
    }

    const sentences = lesson.sentences.map((item, index) => index === activeSentenceIndex ? nextSentence : item);
    syncLesson({ ...lesson, sentences });
    setSelection(null);
    setDraft(createDraft());
  }

  function removeAnnotation(kind: AnnotationKind, annotationIndex: number) {
    const sentence = lesson.sentences[activeSentenceIndex];
    const nextSentence = {
      ...sentence,
      words: kind === "word" ? (sentence.words ?? []).filter((_, index) => index !== annotationIndex) : sentence.words,
      grammar: kind === "grammar" ? (sentence.grammar ?? []).filter((_, index) => index !== annotationIndex) : sentence.grammar,
      chunks: kind === "chunk" ? (sentence.chunks ?? []).filter((_, index) => index !== annotationIndex) : sentence.chunks
    };
    const sentences = lesson.sentences.map((item, index) => index === activeSentenceIndex ? nextSentence : item);
    syncLesson({ ...lesson, sentences });
  }

  async function requestPreview(modeLabel: "validate" | "preview") {
    await withJsonSource(async (jsonSource, lessonId) => {
      setLoading(true);
      setErrors([]);
      setStatus("");
      setSummary(null);

      try {
        const nextPreview = await previewLessonImport(jsonSource, lessonId);
        setPreview(nextPreview);
        setStatus(modeLabel === "validate" ? "Validation passed." : "Preview ready.");
      } catch (error) {
        setPreview(null);
        setErrors([error instanceof Error ? error.message : "Unable to validate lesson."]);
      } finally {
        setLoading(false);
      }
    });
  }

  async function saveLesson() {
    await withJsonSource(async (jsonSource, lessonId) => {
      setImporting(true);
      setErrors([]);
      setStatus("");
      try {
        const shouldAppendSentenceJson = Boolean(lessonId && appendSource.trim());
        const result = shouldAppendSentenceJson
          ? await importLessonApi(jsonSource, lessonId)
          : editorLessonId
            ? await updateLessonApi(editorLessonId, jsonSource)
            : await importLessonApi(jsonSource, lessonId);
        setPreview(null);
        setSummary(result);
        setStatus(shouldAppendSentenceJson ? "Sentences appended." : editorLessonId ? "Lesson updated." : lessonId ? "Sentences appended." : "Lesson saved.");
        await refreshLessons();
      } catch (error) {
        setErrors([error instanceof Error ? error.message : "Unable to import lesson."]);
      } finally {
        setImporting(false);
      }
    });
  }

  async function withJsonSource(callback: (jsonSource: string, lessonId?: string) => Promise<void>) {
    const lessonId = currentTargetLessonId;

    if (lessonId && appendSource.trim()) {
      try {
        await callback(buildAppendJsonSource(appendSource, lessonId), lessonId);
      } catch (error) {
        setErrors([error instanceof Error ? error.message : "Invalid append sentence JSON."]);
      }
      return;
    }

    if (mode === "builder") {
      await callback(stringifyLesson(lesson), lessonId);
      return;
    }

    try {
      const parsed = JSON.parse(source) as LessonImportInput;
      setLesson(parsed);
      await callback(source, lessonId);
    } catch {
      setErrors(["Invalid JSON."]);
    }
  }

  function buildAppendJsonSource(jsonSource: string, lessonId: string): string {
    const target = lessonOptions.find((item) => item.id === lessonId);
    const targetLanguage = target?.language ?? (editorLessonId === lessonId ? lesson.language : undefined);
    const targetBaseLanguage = target?.baseLanguage ?? (editorLessonId === lessonId ? lesson.baseLanguage : undefined);
    const targetTitle = target?.title ?? (editorLessonId === lessonId ? lesson.title : undefined);

    if (!targetLanguage || !targetBaseLanguage || !targetTitle) {
      throw new Error("Choose an existing lesson before appending sentence JSON.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonSource);
    } catch {
      throw new Error("Invalid append sentence JSON.");
    }

    const sentences = extractAppendSentences(parsed);
    if (!sentences.length) {
      throw new Error("Append JSON must be a sentence object, an array of sentence objects, or an object with a sentences array.");
    }

    const appendLesson: LessonImportInput = {
      language: targetLanguage,
      baseLanguage: targetBaseLanguage,
      title: targetTitle,
      description: target?.description ?? lesson.description ?? undefined,
      level: target?.level ?? lesson.level ?? undefined,
      tags: target?.tags ?? lesson.tags,
      source: "json_append",
      sentences
    };

    return JSON.stringify(appendLesson);
  }

  function extractAppendSentences(value: unknown): LessonSentenceInput[] {
    if (Array.isArray(value)) {
      return value as LessonSentenceInput[];
    }

    if (isRecord(value) && Array.isArray(value.sentences)) {
      return value.sentences as LessonSentenceInput[];
    }

    if (isRecord(value) && isRecord(value.sentence)) {
      return [value.sentence as unknown as LessonSentenceInput];
    }

    if (isRecord(value) && typeof value.text === "string") {
      return [value as unknown as LessonSentenceInput];
    }

    return [];
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    loadLessonSource(text, "json");
  }

  function loadSample() {
    loadLessonSource(sampleLesson, "builder");
  }

  async function openLessonInEditor(lessonId: string) {
    try {
      const exportedLesson = await exportLessonApi(lessonId);
      loadLessonSource(stringifyLesson(exportedLesson), "builder", lessonId);
      setMode("builder");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to open the selected lesson."]);
    }
  }

  function startNewLesson() {
    loadLessonSource(stringifyLesson(initialLesson), "builder", null);
    setMode("builder");
  }

  async function exportLessonToFile(lessonId: string) {
    try {
      const exportedLesson = await exportLessonApi(lessonId);
      const blob = new Blob([JSON.stringify(exportedLesson, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugifyLessonTitle(exportedLesson.title)}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
      setStatus(`Exported ${exportedLesson.title}.`);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to export lesson."]);
    }
  }

  async function deleteLesson(lessonId: string) {
    const lesson = lessonOptions.find((item) => item.id === lessonId);
    if (!window.confirm(`Delete ${lesson?.title ?? "this lesson"}? This cannot be undone.`)) return;

    try {
      await deleteLessonApi(lessonId);
      await refreshLessons();
      if (editorLessonId === lessonId) {
        startNewLesson();
      }
      if (selectedLibraryLessonId === lessonId) {
        setSelectedLibraryLessonId(null);
      }
      setStatus("Lesson deleted.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to delete lesson."]);
    }
  }

function slugifyLessonTitle(title: string) {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "lesson";
  }

  // Chunk: rendered editor layout
  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Lesson Manager</h1>
          <p className="muted">Add, import, export, rename, edit, and delete lessons from one place.</p>
        </div>
        <div className="row compact-row">
          <button className="button secondary" type="button" data-tour="lesson-sample" onClick={loadSample}>
            <Sparkles size={18} />
            Sample lesson
          </button>
          <label className="button secondary">
            <FileJson size={18} />
            Upload
            <input className="hidden-input" type="file" accept="application/json,.json" onChange={(event) => readFile(event.target.files?.[0])} />
          </label>
        </div>
      </div>

      <section className="card lesson-builder-top">
        <div className="lesson-builder-topbar">
          <div className="lesson-builder-topbar-left">
            <div className="mode-tabs" role="tablist" aria-label="Lesson editor mode">
              <button className={mode === "builder" ? "active" : ""} type="button" data-tour="lesson-editor-mode" onClick={() => setMode("builder")}>
                <BookOpen size={17} />
                Builder
              </button>
              <button className={mode === "json" ? "active" : ""} type="button" onClick={() => {
                setSource(stringifyLesson(lesson));
                setMode("json");
              }} data-tour="lesson-json-mode">
                <FileJson size={17} />
                JSON
              </button>
              <button className={mode === "lessons" ? "active" : ""} type="button" onClick={() => setMode("lessons")}>
                <Library size={17} />
                Lessons
              </button>
            </div>
          </div>
        </div>

        {mode === "lessons" ? (
          <p className="muted lesson-mode-note">
            Browse saved lessons, export them, or open one in the editor to rename and modify it.
          </p>
        ) : (
          <>
            <div className="lesson-builder-topbar-right">
              <div className="lesson-builder-actions">
                <button className="button secondary compact-button" type="button" data-tour="lesson-check" disabled={loading} onClick={() => requestPreview("validate")}>
                  <Check size={16} />
                  Check
                </button>
                <button className="button secondary compact-button" type="button" disabled={loading} onClick={() => requestPreview("preview")}>
                  <Upload size={16} />
                  {loading ? "Checking…" : "Preview"}
                </button>
                <button className="button compact-button" type="button" data-tour="lesson-save" disabled={importing} onClick={saveLesson}>
                  <Save size={16} />
                  {importing ? "Saving…" : saveActionLabel}
                </button>
              </div>
              <ImportHelpPanel />
            </div>

            <div className="lesson-meta-compact">
              <div className="lesson-title-block">
                <input
                  className="lesson-title-input"
                  value={lesson.title}
                  placeholder="Lesson title"
                  aria-label="Lesson title"
                  onChange={(event) => updateLessonField("title", event.target.value)}
                />
                <span className="lesson-sentence-count">
                  {lesson.sentences.length} sentence{lesson.sentences.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="lesson-meta-inline" aria-label="Lesson metadata">
                <LanguageField
                  label="Language"
                  value={lesson.language}
                  className="compact-language-field"
                  inputClassName="input compact-meta-input"
                  onChange={(value) => updateLessonField("language", value)}
                />
                <span className="meta-separator" aria-hidden="true">-&gt;</span>
                <LanguageField
                  label="Base"
                  value={lesson.baseLanguage}
                  className="compact-language-field"
                  inputClassName="input compact-meta-input"
                  onChange={(value) => updateLessonField("baseLanguage", value)}
                />
                <span className="meta-separator" aria-hidden="true">.</span>
                <label className="field compact-field">
                  <span>Level</span>
                  <input
                    className="input compact-meta-input"
                    value={lesson.level ?? ""}
                    placeholder="Level"
                    onChange={(event) => updateLessonField("level", event.target.value)}
                  />
                </label>
                <span className="meta-separator" aria-hidden="true">.</span>
                <label className="field compact-field">
                  <span>Source</span>
                  <input
                    className="input compact-meta-input"
                    value={lesson.source ?? ""}
                    placeholder="Source"
                    onChange={(event) => updateLessonField("source", event.target.value)}
                  />
                </label>
              </div>

              <input
                className="input compact-description-input"
                value={lesson.description ?? ""}
                placeholder="Description"
                aria-label="Description"
                onChange={(event) => updateLessonField("description", event.target.value)}
              />

              <div className="lesson-meta-footer">
                <div className="tag-editor" aria-label="Lesson tags">
                  {(lesson.tags ?? []).map((tag) => (
                    <button className="tag-chip" key={tag} type="button" title={`Remove ${tag}`} onClick={() => removeLessonTag(tag)}>
                      {tag}
                      <span aria-hidden="true">x</span>
                    </button>
                  ))}
                  <input
                    className="tag-input"
                    placeholder={(lesson.tags ?? []).length ? "Add tag" : "Add tags"}
                    aria-label="Add lesson tag"
                    onKeyDown={handleTagKeyDown}
                    onBlur={(event) => {
                      addTagFromValue(event.currentTarget.value);
                      event.currentTarget.value = "";
                    }}
                  />
                </div>

                <div className="lesson-target-compact">
                  <span>Target:</span>
                  {editingExistingLesson ? (
                    <strong>Current lesson</strong>
                  ) : (
                    <select
                      className="compact-target-select"
                      disabled={lessonsLoading}
                      value={targetLessonId}
                      aria-label="Import target"
                      onChange={(event) => {
                        setTargetLessonId(event.target.value);
                        if (event.target.value === "new") setAppendSource("");
                        setPreview(null);
                        setSummary(null);
                        setStatus("");
                      }}
                    >
                      <option value="new">New lesson</option>
                      {lessonOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title} ({item.language})
                        </option>
                      ))}
                    </select>
                  )}
                  <small>{editingExistingLesson ? "Updates in place" : targetLesson ? "Appends sentences" : "Creates a lesson"}</small>
                </div>
              </div>
            </div>

            {canAppendSentenceJson ? (
              <section className="append-json-panel stack">
                <div className="row">
                  <div>
                    <h2>Append Sentence JSON</h2>
                    <p className="muted">Paste here to append to the selected lesson instead of updating the full lesson.</p>
                  </div>
                  <button
                    className="button secondary compact-button"
                    type="button"
                    onClick={() => {
                      setAppendSource("");
                      setPreview(null);
                      setSummary(null);
                    }}
                  >
                    Clear
                  </button>
                </div>
                <textarea
                  className="input code-input append-json-input"
                  value={appendSource}
                  placeholder={appendJsonPlaceholder}
                  onChange={(event) => {
                    setAppendSource(event.target.value);
                    setPreview(null);
                    setSummary(null);
                    setStatus("");
                  }}
                  aria-label="Append sentence JSON"
                />
              </section>
            ) : null}
          </>
        )}
      </section>

      {mode === "lessons" ? (
        <LessonLibraryPanel
          lessons={lessonOptions}
          loading={lessonsLoading}
          selectedLessonId={selectedLibraryLessonId}
          onSelectLesson={setSelectedLibraryLessonId}
          onNewLesson={startNewLesson}
          onEditLesson={openLessonInEditor}
          onExportLesson={exportLessonToFile}
          onDeleteLesson={deleteLesson}
        />
      ) : mode === "builder" ? (
        <div className="lesson-builder">
          <section className="builder-layout">
            <div className="stack">
              <section className="card stack">
                <div className="row">
                  <div>
                    <h2>Sentence {activeSentenceIndex + 1}</h2>
                    {selection && <p className="muted">Selected: <strong>{selection.surface}</strong></p>}
                  </div>
                  <Tooltip content="Remove this sentence.">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Remove sentence"
                      disabled={lesson.sentences.length === 1}
                      onClick={() => removeSentence(activeSentenceIndex)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Add a sentence after this one.">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Add sentence after this one"
                      onClick={() => addSentence(activeSentenceIndex)}
                    >
                      <Plus size={18} />
                    </button>
                  </Tooltip>
                </div>
                <div className="selectable-sentence" onMouseUp={captureSelection} onKeyUp={captureSelection}>
                  {activeSentence.text ? (
                    Array.from(activeSentence.text).map((char, index) => {
                      const annotationClassName = getCharAnnotationClassName(activeSentence, char, index);
                      return (
                        <span
                          data-char-index={index}
                          key={`${char}-${index}`}
                          className={annotationClassName}
                        >
                          {char}
                        </span>
                      );
                    })
                  ) : (
                    <span className="sentence-placeholder">Type a sentence below…</span>
                  )}
                </div>
                <label className="field">
                  <span>Text</span>
                  <textarea className="input sentence-input" value={activeSentence.text} onChange={(event) => updateSentence("text", event.target.value)} />
                </label>
                <label className="field">
                  <span>Translation</span>
                  <input className="input" value={activeSentence.translation ?? ""} onChange={(event) => updateSentence("translation", event.target.value)} />
                </label>
              </section>

              <section className="card stack">
                <div className="row">
                  <h2>Sentences</h2>
                  <button
                    className="button secondary"
                    type="button"
                    title="Add a new sentence after the active one"
                    onClick={() => addSentence()}
                  >
                    <Plus size={18} />
                    Add sentence
                  </button>
                </div>
                <div className="sentence-tabs">
                  {lesson.sentences.map((sentence, index) => (
                    <button
                      className={index === activeSentenceIndex ? "active" : ""}
                      key={`${index}-${sentence.text}`}
                      type="button"
                      onClick={() => {
                        setActiveSentenceIndex(index);
                        setSelection(null);
                        setDraft(createDraft());
                      }}
                    >
                      <span>{index + 1}</span>
                      {sentence.text || "Untitled sentence"}
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <aside className="stack">
              <section className="card stack">
                <div className="row">
                  <h2>Annotate</h2>
                  <Highlighter size={18} />
                </div>
                <div className="annotation-types">
                  {(["word", "grammar", "chunk"] as AnnotationKind[]).map((kind) => (
                    <button
                      className={`kind-${kind}${draft.kind === kind ? " active" : ""}`}
                      key={kind}
                      type="button"
                      onClick={() => setDraft((current) => ({
                        ...current,
                        kind,
                        pattern: kind === "grammar" && !current.pattern ? current.surface : current.pattern
                      }))}
                    >
                      {kind}
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>Surface</span>
                  <input className="input" value={draft.surface} onChange={(event) => setDraft({ ...draft, surface: event.target.value })} />
                </label>
                {draft.kind === "word" ? (
                  <>
                    <label className="field">
                      <span>Lemma</span>
                      <input className="input" value={draft.lemma} onChange={(event) => setDraft({ ...draft, lemma: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Role</span>
                      <input className="input" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} />
                    </label>
                  </>
                ) : null}
                {draft.kind === "grammar" ? (
                  <label className="field">
                    <span>Pattern</span>
                    <input className="input" value={draft.pattern} onChange={(event) => setDraft({ ...draft, pattern: event.target.value })} />
                  </label>
                ) : null}
                {draft.kind === "chunk" ? (
                  <>
                    <label className="field">
                      <span>Type</span>
                      <input className="input" value={draft.chunkType} onChange={(event) => setDraft({ ...draft, chunkType: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Tags</span>
                      <input className="input" value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} />
                    </label>
                  </>
                ) : null}
                <label className="field">
                  <span>Meaning</span>
                  <input className="input" value={draft.meaning} onChange={(event) => setDraft({ ...draft, meaning: event.target.value })} />
                </label>
                <label className="field">
                  <span>Explanation</span>
                  <textarea className="input small-textarea" value={draft.explanation} onChange={(event) => setDraft({ ...draft, explanation: event.target.value })} />
                </label>
                <button className={`button kind-${draft.kind}`} type="button" onClick={addAnnotation}>
                  <Check size={18} />
                  Add annotation
                </button>
              </section>

              <section className="card stack">
                <h2>Current Notes</h2>
                {activeAnnotations.length ? (
                  <div className="annotation-list">
                    {activeAnnotations.map((annotation) => (
                      <div className="annotation-row" key={`${annotation.kind}-${annotation.index}-${annotation.label}`}>
                        <div>
                          <span className={`pill pill-${annotation.kind}`}>{annotation.kind}</span>
                          <strong>{annotation.label}</strong>
                          {annotation.detail ? <p className="muted">{annotation.detail}</p> : null}
                        </div>
                        <Tooltip content="Remove this annotation.">
                          <button className="icon-button" type="button" aria-label="Remove annotation" onClick={() => removeAnnotation(annotation.kind, annotation.index)}>
                            <Trash2 size={17} />
                          </button>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                ) : <p className="muted">No annotations yet.</p>}
              </section>
            </aside>
          </section>
        </div>
      ) : (
        <section className="card stack">
          <textarea className="input code-input" value={source} onChange={(event) => {
            setSource(event.target.value);
            setPreview(null);
            setSummary(null);
          }} aria-label="Lesson JSON" />
        </section>
      )}

      {errors.length ? (
        <section className="card stack error-card">
          <h2>Validation Errors</h2>
          {errors.map((error) => <p key={error}>{error}</p>)}
        </section>
      ) : null}

      {status ? <section className="card success-card">{status}</section> : null}

      {summary ? (
        <section className="card stack">
          <h2>Save Summary</h2>
          <pre className="summary-json">{JSON.stringify(summary, null, 2)}</pre>
        </section>
      ) : null}

      {preview ? (
        <div className="import-preview-wrap">
          <ImportPreview
            preview={preview}
            importing={importing}
            approveLabel={usingAppendSentenceJson || appendingToExistingLesson ? "Append sentences" : editingExistingLesson ? "Update lesson" : "Save lesson"}
            onApprove={saveLesson}
            onCancel={() => setPreview(null)}
          />
        </div>
      ) : null}
    </AppShell>
  );
}

function validateLessonManagerProgress(value: unknown): LessonManagerProgress | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<LessonManagerProgress>;

  if (!isWorkspaceMode(item.mode)) return null;
  if (!isLessonImportInput(item.lesson)) return null;
  if (typeof item.activeSentenceIndex !== "number" || !Number.isInteger(item.activeSentenceIndex)) return null;
  if (!isAnnotationDraft(item.draft)) return null;
  if (typeof item.source !== "string") return null;
  if (typeof item.appendSource !== "string") return null;
  if (typeof item.targetLessonId !== "string") return null;
  if (item.editorLessonId !== null && typeof item.editorLessonId !== "string") return null;
  if (item.selectedLibraryLessonId !== null && typeof item.selectedLibraryLessonId !== "string") return null;

  return {
    mode: item.mode,
    lesson: item.lesson,
    activeSentenceIndex: clampSentenceIndex(item.activeSentenceIndex, item.lesson),
    draft: item.draft,
    source: item.source,
    appendSource: item.appendSource,
    targetLessonId: item.targetLessonId,
    editorLessonId: item.editorLessonId,
    selectedLibraryLessonId: item.selectedLibraryLessonId
  };
}

function clampSentenceIndex(index: number, lesson: LessonImportInput) {
  return Math.min(Math.max(0, index), Math.max(0, lesson.sentences.length - 1));
}

function isWorkspaceMode(value: unknown): value is WorkspaceMode {
  return value === "builder" || value === "json" || value === "lessons";
}

function isLessonImportInput(value: unknown): value is LessonImportInput {
  if (!value || typeof value !== "object") return false;
  const lesson = value as Partial<LessonImportInput>;
  return (
    typeof lesson.language === "string" &&
    typeof lesson.baseLanguage === "string" &&
    typeof lesson.title === "string" &&
    Array.isArray(lesson.sentences)
  );
}

function isAnnotationDraft(value: unknown): value is AnnotationDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<AnnotationDraft>;
  return (
    (draft.kind === "word" || draft.kind === "grammar" || draft.kind === "chunk") &&
    typeof draft.surface === "string" &&
    typeof draft.lemma === "string" &&
    typeof draft.pattern === "string" &&
    typeof draft.meaning === "string" &&
    typeof draft.explanation === "string" &&
    typeof draft.role === "string" &&
    typeof draft.chunkType === "string" &&
    typeof draft.level === "string" &&
    typeof draft.tags === "string"
  );
}
