"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import type { LessonImportPreviewItem, LessonImportPreviewResult } from "@/lib/language/types";

interface ImportPreviewProps {
  preview: LessonImportPreviewResult;
  importing: boolean;
  onApprove: () => void;
  onCancel: () => void;
}

export function ImportPreview({ preview, importing, onApprove, onCancel }: ImportPreviewProps) {
  const blocked = preview.duplicateImport || preview.validationErrors.length > 0;

  return (
    <div className="stack">
      <section className="card stack">
        <div className="row">
          <div>
            <h2>{preview.lesson.title}</h2>
            <p className="muted">
              {preview.lesson.language.toUpperCase()} to {preview.lesson.baseLanguage.toUpperCase()}
            </p>
          </div>
          <span className="pill">{preview.lesson.level ?? "Lesson"}</span>
        </div>
        {preview.lesson.description ? <p>{preview.lesson.description}</p> : null}
        {preview.lesson.tags.length ? <p className="muted">Tags: {preview.lesson.tags.join(", ")}</p> : null}
        {preview.duplicateImport ? <StatusMessage text="This lesson has already been imported." /> : null}
        {preview.validationErrors.length ? (
          <div className="notice-list">
            {preview.validationErrors.map((error) => <StatusMessage key={error} text={error} />)}
          </div>
        ) : null}
      </section>

      <section className="grid grid-3">
        <InfoCard title="Sentences" value={String(preview.sentenceCount)} />
        <InfoCard title="Vocabulary" value={`${preview.vocabulary.filter((item) => item.status === "new").length} new / ${preview.vocabulary.filter((item) => item.status === "existing").length} reused`} />
        <InfoCard title="Grammar + Chunks" value={`${preview.grammar.length + preview.chunks.length} items`} />
      </section>

      <section className="grid grid-3">
        <ItemGroup title="Vocabulary" items={preview.vocabulary} />
        <ItemGroup title="Grammar" items={preview.grammar} />
        <ItemGroup title="Chunks" items={preview.chunks} />
      </section>

      <section className="stack">
        {preview.sentences.map((sentence) => (
          <article className="card stack" key={`${sentence.index}-${sentence.text}`}>
            <div className="row">
              <span className="pill">Sentence {sentence.index + 1}</span>
              {sentence.duplicateSentence ? <span className="pill status-conflict">duplicate</span> : null}
            </div>
            <p className="sentence-text">{sentence.text}</p>
            <p className="muted">{sentence.translation}</p>

            {sentence.words.length ? (
              <div className="inline-tags">
                {sentence.words.map((word) => (
                  <span className="token-chip static token-chip-word" key={`${word.surface}-${word.lemma ?? ""}`}>{word.surface}</span>
                ))}
              </div>
            ) : null}

            {sentence.grammar.length ? (
              <div className="inline-tags">
                {sentence.grammar.map((grammar) => (
                  <span className="token-chip static token-chip-grammar" key={`${grammar.pattern}-${grammar.surface ?? ""}`}>{grammar.surface ?? grammar.pattern}</span>
                ))}
              </div>
            ) : null}

            {sentence.chunks.length ? (
              <div className="inline-tags">
                {sentence.chunks.map((chunk) => (
                  <span className="token-chip static token-chip-chunk" key={`${chunk.surface}-${chunk.type ?? ""}`}>{chunk.surface}</span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <div className="row">
        <button className="button secondary" type="button" onClick={onCancel}>
          <X size={18} />
          Cancel
        </button>
        <button className="button" type="button" disabled={blocked || importing} onClick={onApprove}>
          <Check size={18} />
          {importing ? "Importing" : "Import"}
        </button>
      </div>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="card stack">
      <p className="muted">{title}</p>
      <strong>{value}</strong>
    </article>
  );
}

function ItemGroup({
  title,
  items
}: {
  title: string;
  items: LessonImportPreviewItem[];
}) {
  return (
    <article className="card stack">
      <h3>{title}</h3>
      {items.length ? items.map((item) => (
        <div className="item-row" key={item.canonicalKey}>
          <div>
            <strong>{item.displayText}</strong>
            {item.meaning ? <p className="muted">{item.meaning}</p> : null}
            {item.explanation ? <p className="muted">{item.explanation}</p> : null}
          </div>
          <span className={`pill status-${item.status}`}>{item.status}</span>
        </div>
      )) : <p className="muted">No items detected.</p>}
    </article>
  );
}

function StatusMessage({ text }: { text: string }) {
  return (
    <div className="notice warn">
      <AlertTriangle size={16} />
      <span>{text}</span>
    </div>
  );
}
