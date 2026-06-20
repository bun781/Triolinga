"use client";

import { FileJson, Sparkles, Upload } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ImportPreview } from "@/components/language/ImportPreview";
import type { LessonImportPreviewResult, LessonImportSummary } from "@/lib/language/types";

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

export default function LessonImportsPage() {
  const [source, setSource] = useState(sampleLesson);
  const [preview, setPreview] = useState<LessonImportPreviewResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<LessonImportSummary | null>(null);

  async function requestPreview(mode: "validate" | "preview") {
    setLoading(true);
    setErrors([]);
    setStatus("");
    setSummary(null);

    const result = await fetch("/api/lessons/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source })
    });
    const data = await result.json() as { preview?: LessonImportPreviewResult; errors?: string[]; error?: string };
    setLoading(false);

    if (!result.ok || !data.preview) {
      setPreview(null);
      setErrors(data.errors ?? [data.error ?? "Unable to validate lesson."]);
      return;
    }

    setPreview(data.preview);
    setStatus(mode === "validate" ? "Validation passed." : "Preview ready.");
  }

  async function importLesson() {
    setImporting(true);
    setErrors([]);
    setStatus("");
    const result = await fetch("/api/lessons/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source })
    });
    const data = await result.json() as { result?: LessonImportSummary; error?: string; errors?: string[] };
    setImporting(false);

    if (!result.ok || !data.result) {
      setErrors(data.errors ?? [data.error ?? "Unable to import lesson."]);
      return;
    }

    setPreview(null);
    setSummary(data.result);
    setStatus("Import complete.");
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    setSource(await file.text());
    setPreview(null);
    setErrors([]);
    setStatus("");
    setSummary(null);
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Lesson Import</h1>
          <p className="muted">Validate imported content, preview the canonical records, then write them into the learning system.</p>
        </div>
        <div className="row">
          <button className="button secondary" type="button" onClick={() => {
            setSource(sampleLesson);
            setPreview(null);
            setErrors([]);
            setStatus("");
            setSummary(null);
          }}>
            <Sparkles size={18} />
            Sample JSON
          </button>
          <label className="button secondary">
            <FileJson size={18} />
            Upload JSON
            <input className="hidden-input" type="file" accept="application/json,.json" onChange={(event) => readFile(event.target.files?.[0])} />
          </label>
        </div>
      </div>

      <section className="card stack">
        <textarea className="input code-input" value={source} onChange={(event) => setSource(event.target.value)} aria-label="Lesson JSON" />
        <div className="row">
          <button className="button secondary" type="button" disabled={loading} onClick={() => requestPreview("validate")}>
            Validate
          </button>
          <div className="row">
            <button className="button secondary" type="button" disabled={loading} onClick={() => requestPreview("preview")}>
              <Upload size={18} />
              {loading ? "Checking" : "Preview"}
            </button>
            <button className="button" type="button" disabled={importing} onClick={importLesson}>
              <Upload size={18} />
              {importing ? "Importing" : "Import"}
            </button>
          </div>
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

