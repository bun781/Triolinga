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
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ImportPreview } from "@/components/language/ImportPreview";
import type {
  LessonChunkInput,
  LessonGrammarInput,
  LessonImportInput,
  LessonImportPreviewResult,
  LessonImportSummary,
  LessonSentenceInput,
  LessonWordInput
} from "@/lib/language/types";

type BuilderMode = "builder" | "json";
type AnnotationKind = "word" | "grammar" | "chunk";

interface SelectedSpan {
  start: number;
  end: number;
  surface: string;
}

interface AnnotationDraft {
  kind: AnnotationKind;
  surface: string;
  lemma: string;
  pattern: string;
  meaning: string;
  explanation: string;
  role: string;
  chunkType: string;
  level: string;
  tags: string;
}

const sampleLesson = `{
  "language": "ko",
  "baseLanguage": "en",
  "title": "Beginner Korean Lesson 1",
  "description": "Basic greetings and movement",
  "source": "ai_generated",
  "level": "beginner",
  "tags": ["daily", "travel"],
  "sentences": [
    {
      "text": "저는 학교에 갑니다.",
      "translation": "I go to school.",
      "words": [
        {
          "surface": "저는",
          "lemma": "저",
          "meaning": "I / me",
          "role": "topic-marked pronoun"
        }
      ],
      "grammar": [
        {
          "pattern": "N은/는",
          "surface": "저는",
          "meaning": "Topic marker",
          "explanation": "Marks the topic of the sentence."
        }
      ],
      "chunks": [
        {
          "surface": "학교에 갑니다",
          "meaning": "go to school",
          "explanation": "A common movement phrase using destination marker 에.",
          "type": "phrase",
          "level": "beginner",
          "tags": ["movement", "school"]
        }
      ]
    }
  ]
}`;

const emptySentence: LessonSentenceInput = {
  text: "",
  translation: "",
  words: [],
  grammar: [],
  chunks: []
};

const initialLesson: LessonImportInput = {
  language: "ko",
  baseLanguage: "en",
  title: "New lesson",
  description: "",
  source: "lesson_builder",
  level: "beginner",
  tags: [],
  sentences: [{ ...emptySentence }]
};

function createDraft(surface = ""): AnnotationDraft {
  return {
    kind: "word",
    surface,
    lemma: "",
    pattern: "",
    meaning: "",
    explanation: "",
    role: "",
    chunkType: "phrase",
    level: "",
    tags: ""
  };
}

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

  const activeSentence = lesson.sentences[activeSentenceIndex] ?? emptySentence;
  const activeAnnotations = useMemo(
    () => [
      ...(activeSentence.words ?? []).map((item, index) => ({ kind: "word" as const, index, label: item.surface, detail: item.meaning })),
      ...(activeSentence.grammar ?? []).map((item, index) => ({ kind: "grammar" as const, index, label: item.surface ?? item.pattern, detail: item.meaning })),
      ...(activeSentence.chunks ?? []).map((item, index) => ({ kind: "chunk" as const, index, label: item.surface, detail: item.meaning }))
    ],
    [activeSentence]
  );

  function syncLesson(nextLesson: LessonImportInput) {
    setLesson(nextLesson);
    setSource(stringifyLesson(nextLesson));
    setPreview(null);
    setSummary(null);
    setStatus("");
    setErrors([]);
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

  function addSentence() {
    const nextLesson = { ...lesson, sentences: [...lesson.sentences, { ...emptySentence }] };
    syncLesson(nextLesson);
    setActiveSentenceIndex(nextLesson.sentences.length - 1);
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
    await withJsonSource(async (jsonSource) => {
      setLoading(true);
      setErrors([]);
      setStatus("");
      setSummary(null);

      const result = await fetch("/api/lessons/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: jsonSource })
      });
      const data = await result.json() as { preview?: LessonImportPreviewResult; errors?: string[]; error?: string };
      setLoading(false);

      if (!result.ok || !data.preview) {
        setPreview(null);
        setErrors(data.errors ?? [data.error ?? "Unable to validate lesson."]);
        return;
      }

      setPreview(data.preview);
      setStatus(modeLabel === "validate" ? "Validation passed." : "Preview ready.");
    });
  }

  async function importLesson() {
    await withJsonSource(async (jsonSource) => {
      setImporting(true);
      setErrors([]);
      setStatus("");
      const result = await fetch("/api/lessons/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: jsonSource })
      });
      const data = await result.json() as { result?: LessonImportSummary; error?: string; errors?: string[] };
      setImporting(false);

      if (!result.ok || !data.result) {
        setErrors(data.errors ?? [data.error ?? "Unable to import lesson."]);
        return;
      }

      setPreview(null);
      setSummary(data.result);
      setStatus("Lesson saved.");
    });
  }

  async function withJsonSource(callback: (jsonSource: string) => Promise<void>) {
    if (mode === "builder") {
      await callback(stringifyLesson(lesson));
      return;
    }

    try {
      const parsed = JSON.parse(source) as LessonImportInput;
      setLesson(parsed);
      await callback(source);
    } catch {
      setErrors(["Invalid JSON."]);
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setSource(text);
    try {
      setLesson(JSON.parse(text) as LessonImportInput);
      setMode("builder");
      setActiveSentenceIndex(0);
    } catch {
      setMode("json");
    }
    setPreview(null);
    setErrors([]);
    setStatus("");
    setSummary(null);
  }

  function loadSample() {
    setSource(sampleLesson);
    setLesson(JSON.parse(sampleLesson) as LessonImportInput);
    setMode("builder");
    setActiveSentenceIndex(0);
    setSelection(null);
    setDraft(createDraft());
    setPreview(null);
    setErrors([]);
    setStatus("");
    setSummary(null);
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Lesson Builder</h1>
          <p className="muted">Create import-ready lessons by selecting sentence text and attaching vocabulary, grammar, or chunk notes.</p>
        </div>
        <div className="row compact-row">
          <button className="button secondary" type="button" onClick={loadSample}>
            <Sparkles size={18} />
            Sample
          </button>
          <label className="button secondary">
            <FileJson size={18} />
            Upload
            <input className="hidden-input" type="file" accept="application/json,.json" onChange={(event) => readFile(event.target.files?.[0])} />
          </label>
        </div>
      </div>

      <div className="mode-tabs" role="tablist" aria-label="Import mode">
        <button className={mode === "builder" ? "active" : ""} type="button" onClick={() => setMode("builder")}>
          <BookOpen size={17} />
          Builder
        </button>
        <button className={mode === "json" ? "active" : ""} type="button" onClick={() => {
          setSource(stringifyLesson(lesson));
          setMode("json");
        }}>
          <FileJson size={17} />
          JSON
        </button>
      </div>

      {mode === "builder" ? (
        <div className="lesson-builder">
          <section className="card stack">
            <div className="grid grid-3">
              <label className="field">
                <span>Title</span>
                <input className="input" value={lesson.title} onChange={(event) => updateLessonField("title", event.target.value)} />
              </label>
              <label className="field">
                <span>Language</span>
                <input className="input" value={lesson.language} onChange={(event) => updateLessonField("language", event.target.value)} />
              </label>
              <label className="field">
                <span>Base language</span>
                <input className="input" value={lesson.baseLanguage} onChange={(event) => updateLessonField("baseLanguage", event.target.value)} />
              </label>
            </div>
            <div className="grid grid-3">
              <label className="field">
                <span>Level</span>
                <input className="input" value={lesson.level ?? ""} onChange={(event) => updateLessonField("level", event.target.value)} />
              </label>
              <label className="field">
                <span>Tags</span>
                <input className="input" value={(lesson.tags ?? []).join(", ")} onChange={(event) => updateLessonField("tags", splitTags(event.target.value))} />
              </label>
              <label className="field">
                <span>Source</span>
                <input className="input" value={lesson.source ?? ""} onChange={(event) => updateLessonField("source", event.target.value)} />
              </label>
            </div>
            <label className="field">
              <span>Description</span>
              <input className="input" value={lesson.description ?? ""} onChange={(event) => updateLessonField("description", event.target.value)} />
            </label>
          </section>

          <section className="builder-layout">
            <div className="stack">
              <section className="card stack">
                <div className="row">
                  <h2>Sentences</h2>
                  <button className="button secondary" type="button" onClick={addSentence}>
                    <Plus size={18} />
                    Add
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
                  <h2>Sentence</h2>
                  <button
                    className="icon-button"
                    type="button"
                    title="Remove sentence"
                    aria-label="Remove sentence"
                    disabled={lesson.sentences.length === 1}
                    onClick={() => removeSentence(activeSentenceIndex)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <label className="field">
                  <span>Text</span>
                  <textarea className="input sentence-input" value={activeSentence.text} onChange={(event) => updateSentence("text", event.target.value)} />
                </label>
                <label className="field">
                  <span>Translation</span>
                  <input className="input" value={activeSentence.translation ?? ""} onChange={(event) => updateSentence("translation", event.target.value)} />
                </label>
                <div className="selectable-sentence" onMouseUp={captureSelection} onKeyUp={captureSelection}>
                  {Array.from(activeSentence.text || "Type a sentence above.").map((char, index) => (
                    <span
                      data-char-index={activeSentence.text ? index : undefined}
                      key={`${char}-${index}`}
                      className={isCharAnnotated(activeSentence, char, index) ? "annotated-char" : undefined}
                    >
                      {char}
                    </span>
                  ))}
                </div>
              </section>
            </div>

            <aside className="stack">
              <section className="card stack">
                <div className="row">
                  <div>
                    <h2>Annotate</h2>
                    <p className="muted">{selection ? `Selected: ${selection.surface}` : "Select text in the sentence preview."}</p>
                  </div>
                  <Highlighter size={20} />
                </div>
                <div className="annotation-types">
                  {(["word", "grammar", "chunk"] as AnnotationKind[]).map((kind) => (
                    <button
                      className={draft.kind === kind ? "active" : ""}
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
                <button className="button" type="button" onClick={addAnnotation}>
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
                          <span className="pill">{annotation.kind}</span>
                          <strong>{annotation.label}</strong>
                          {annotation.detail ? <p className="muted">{annotation.detail}</p> : null}
                        </div>
                        <button className="icon-button" type="button" title="Remove annotation" aria-label="Remove annotation" onClick={() => removeAnnotation(annotation.kind, annotation.index)}>
                          <Trash2 size={17} />
                        </button>
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

      <section className="card action-bar">
        <div>
          <strong>{lesson.sentences.length} sentence{lesson.sentences.length === 1 ? "" : "s"}</strong>
          <p className="muted">Preview validates surfaces before saving.</p>
        </div>
        <div className="row compact-row">
          <button className="button secondary" type="button" disabled={loading} onClick={() => requestPreview("validate")}>
            Validate
          </button>
          <button className="button secondary" type="button" disabled={loading} onClick={() => requestPreview("preview")}>
            <Upload size={18} />
            {loading ? "Checking" : "Preview"}
          </button>
          <button className="button" type="button" disabled={importing} onClick={importLesson}>
            <Save size={18} />
            {importing ? "Saving" : "Save Lesson"}
          </button>
        </div>
      </section>

      {errors.length ? (
        <section className="card stack error-card">
          <h2>Validation Errors</h2>
          {errors.map((error) => <p key={error}>{error}</p>)}
        </section>
      ) : null}

      {status ? <section className="card success-card">{status}</section> : null}

      {summary ? (
        <section className="card stack">
          <h2>Import Summary</h2>
          <pre className="summary-json">{JSON.stringify(summary, null, 2)}</pre>
        </section>
      ) : null}

      {preview ? (
        <div className="import-preview-wrap">
          <ImportPreview
            preview={preview}
            importing={importing}
            onApprove={importLesson}
            onCancel={() => setPreview(null)}
          />
        </div>
      ) : null}
    </AppShell>
  );
}

function stringifyLesson(lesson: LessonImportInput): string {
  return JSON.stringify(cleanLesson(lesson), null, 2);
}

function cleanLesson(lesson: LessonImportInput): LessonImportInput {
  return dropEmpty({
    ...lesson,
    tags: lesson.tags?.filter(Boolean),
    sentences: lesson.sentences.map((sentence) => dropEmpty({
      ...sentence,
      words: sentence.words?.map((word) => dropEmpty(word)).filter((word) => word.surface),
      grammar: sentence.grammar?.map((grammar) => dropEmpty(grammar)).filter((grammar) => grammar.pattern),
      chunks: sentence.chunks?.map((chunk) => dropEmpty(chunk)).filter((chunk) => chunk.surface)
    }))
  });
}

function pruneEmpty<T extends object>(item: T): T {
  return dropEmpty(item);
}

function dropEmpty<T extends object>(item: T): T {
  return Object.fromEntries(
    Object.entries(item).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== "" && value !== undefined && value !== null;
    })
  ) as T;
}

function splitTags(value: string): string[] {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function getCharIndex(node: Node | null): number | null {
  const element = node instanceof Element ? node : node?.parentElement;
  const char = element?.closest<HTMLElement>("[data-char-index]");
  const value = char?.dataset.charIndex;
  return value === undefined ? null : Number(value);
}

function isCharAnnotated(sentence: LessonSentenceInput, char: string, index: number): boolean {
  if (!sentence.text || char.trim() === "") return false;
  const left = Array.from(sentence.text).slice(0, index).join("");
  const right = Array.from(sentence.text).slice(0, index + 1).join("");
  const surfaces = [
    ...(sentence.words ?? []).map((item) => item.surface),
    ...(sentence.grammar ?? []).map((item) => item.surface).filter(Boolean),
    ...(sentence.chunks ?? []).map((item) => item.surface)
  ];

  return surfaces.some((surface) => {
    if (!surface) return false;
    const start = sentence.text.indexOf(surface);
    if (start < 0) return false;
    const end = start + surface.length;
    return left.length >= start && right.length <= end;
  });
}
