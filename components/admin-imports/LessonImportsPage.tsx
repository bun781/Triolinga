"use client";

import {
  BookOpen,
  Check,
  FileJson,
  Highlighter,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LanguageField } from "@/components/admin-imports/LanguageField";
import { ImportHelpPanel } from "@/components/language/ImportHelpPanel";
import { ImportPreview } from "@/components/language/ImportPreview";
import { Tooltip } from "@/components/ui/Tooltip";
import { getLessons, importLesson as importLessonApi, previewLessonImport } from "@/lib/desktopApi";
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

type BuilderMode = "builder" | "json";
type AnnotationKind = AnnotationDraft["kind"];

// Chunk: editor state and data loading
export default function LessonImportsPage() {
  const [mode, setMode] = useState<BuilderMode>("builder");
  const [lesson, setLesson] = useState<LessonImportInput>(initialLesson);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(0);
  const [selection, setSelection] = useState<SelectedSpan | null>(null);
  const [draft, setDraft] = useState<AnnotationDraft>(createDraft());
  const [source, setSource] = useState(() => stringifyLesson(initialLesson));
  const [preview, setPreview] = useState<LessonImportPreviewResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<LessonImportSummary | null>(null);
  const [lessonOptions, setLessonOptions] = useState<StudyLessonMeta[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [targetLessonId, setTargetLessonId] = useState("new");

  const activeSentence = lesson.sentences[activeSentenceIndex] ?? createEmptySentence();
  const appendingToExistingLesson = targetLessonId !== "new";
  const activeAnnotations = useMemo(
    () => [
      ...(activeSentence.words ?? []).map((item, index) => ({ kind: "word" as const, index, label: item.surface, detail: item.meaning })),
      ...(activeSentence.grammar ?? []).map((item, index) => ({ kind: "grammar" as const, index, label: item.surface ?? item.pattern, detail: item.meaning })),
      ...(activeSentence.chunks ?? []).map((item, index) => ({ kind: "chunk" as const, index, label: item.surface, detail: item.meaning }))
    ],
    [activeSentence]
  );

  useEffect(() => {
    let cancelled = false;

    getLessons()
      .then((items) => {
        if (!cancelled) setLessonOptions(items);
      })
      .catch((error) => {
        if (!cancelled) setErrors([error instanceof Error ? error.message : "Unable to load lessons."]);
      })
      .finally(() => {
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

  function syncLesson(nextLesson: LessonImportInput) {
    setLesson(nextLesson);
    setSource(stringifyLesson(nextLesson));
    setPreview(null);
    setSummary(null);
    setStatus("");
    setErrors([]);
  }

  function loadLessonSource(text: string, fallbackMode: BuilderMode) {
    setSource(text);
    setTargetLessonId("new");
    setActiveSentenceIndex(0);
    setSelection(null);
    setDraft(createDraft());
    setPreview(null);
    setErrors([]);
    setStatus("");
    setSummary(null);

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

  async function importLesson() {
    await withJsonSource(async (jsonSource, lessonId) => {
      setImporting(true);
      setErrors([]);
      setStatus("");
      try {
        const result = await importLessonApi(jsonSource, lessonId);
        setPreview(null);
        setSummary(result);
        setStatus(lessonId ? "Sentences appended." : "Lesson saved.");
      } catch (error) {
        setErrors([error instanceof Error ? error.message : "Unable to import lesson."]);
      } finally {
        setImporting(false);
      }
    });
  }

  async function withJsonSource(callback: (jsonSource: string, lessonId?: string) => Promise<void>) {
    const lessonId = appendingToExistingLesson ? targetLessonId : undefined;

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

  async function readFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    loadLessonSource(text, "json");
  }

  const selectedLesson = lessonOptions.find((item) => item.id === targetLessonId) ?? null;

  function loadSample() {
    loadLessonSource(sampleLesson, "builder");
  }

  // Chunk: rendered editor layout
  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Lesson Builder</h1>
          <p className="muted">Create lesson files, validate the JSON, and save lessons with vocabulary, grammar, and chunk notes.</p>
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
            </div>
            <span className="sentence-count-badge">
              {lesson.sentences.length} sentence{lesson.sentences.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="lesson-builder-topbar-right">
            <ImportHelpPanel />
            <div className="lesson-builder-actions">
              <button className="button secondary compact-button" type="button" data-tour="lesson-check" disabled={loading} onClick={() => requestPreview("validate")}>
                <Check size={16} />
                Check
              </button>
              <button className="button secondary compact-button" type="button" disabled={loading} onClick={() => requestPreview("preview")}>
                <Upload size={16} />
                {loading ? "Checking…" : "Preview"}
              </button>
              <button className="button compact-button" type="button" data-tour="lesson-save" disabled={importing} onClick={importLesson}>
                <Save size={16} />
                {importing ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>

        <div className="lesson-meta-grid">
          <label className="field lesson-meta-title">
            <span>Title</span>
            <input className="input" value={lesson.title} onChange={(event) => updateLessonField("title", event.target.value)} />
          </label>
          <LanguageField label="Language" value={lesson.language} onChange={(value) => updateLessonField("language", value)} />
          <LanguageField label="Base" value={lesson.baseLanguage} onChange={(value) => updateLessonField("baseLanguage", value)} />
          <label className="field">
            <span>Level</span>
            <input className="input" value={lesson.level ?? ""} onChange={(event) => updateLessonField("level", event.target.value)} />
          </label>
          <label className="field">
            <span>Source</span>
            <input className="input" value={lesson.source ?? ""} onChange={(event) => updateLessonField("source", event.target.value)} />
          </label>
          <label className="field lesson-meta-tags">
            <span>Tags</span>
            <input className="input" value={(lesson.tags ?? []).join(", ")} onChange={(event) => updateLessonField("tags", splitTags(event.target.value))} />
          </label>
          <label className="field lesson-meta-description">
            <span>Description</span>
            <input className="input" value={lesson.description ?? ""} onChange={(event) => updateLessonField("description", event.target.value)} />
          </label>
          <label className="field lesson-meta-description">
            <span>Import target</span>
            <select
              className="input"
              disabled={lessonsLoading}
              value={targetLessonId}
              onChange={(event) => {
                setTargetLessonId(event.target.value);
                setPreview(null);
                setSummary(null);
                setStatus("");
              }}
            >
              <option value="new">Create new lesson</option>
              {lessonOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.language})
                </option>
              ))}
            </select>
            <span className="muted">
              {selectedLesson ? "Imported sentences will be appended to the selected lesson." : "Choose an existing lesson to append sentences instead of creating a new lesson."}
            </span>
          </label>
        </div>
      </section>

      {mode === "builder" ? (
        <div className="lesson-builder">
          <section className="builder-layout">
            <div className="stack">
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
            approveLabel={appendingToExistingLesson ? "Append sentences" : "Save lesson"}
            onApprove={importLesson}
            onCancel={() => setPreview(null)}
          />
        </div>
      ) : null}
    </AppShell>
  );
}
