"use client";

import Link from "next/link";
import {
  Archive,
  CheckCircle2,
  Download,
  FileUp,
  Filter,
  PackageCheck,
  PackageOpen,
  Search,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  countSentences,
  createFydorPack,
  estimatePackSize,
  lessonKey,
  parseFydorPack,
  slugifyPackTitle,
  type FydorPack,
  type FydorPackValidation
} from "@/lib/fydor-pack";
import { exportLesson, getLessons, importLesson, updateLesson } from "@/lib/desktopApi";
import type { StudyLessonMeta } from "@/lib/imported-content/types";
import type { LessonImportInput } from "@/lib/language/types";

type DuplicateMode = "skip" | "replace" | "keep";

interface InstalledPackRecord {
  id: string;
  title: string;
  description?: string;
  author?: string;
  organization?: string;
  version: string;
  license?: string;
  language: string;
  baseLanguage: string;
  level?: string;
  tags: string[];
  installedAt: string;
  lessonTitles: string[];
  lessonIds: string[];
  sentenceCount: number;
}

interface InstallSummary {
  installed: number;
  skipped: number;
  replaced: number;
  sentenceCount: number;
  details: string[];
}

const INSTALLED_PACKS_KEY = "fydor.exchange.installedPacks.v1";

const emptyPackSource = "";

export default function FydorExchangePage() {
  const [lessons, setLessons] = useState<StudyLessonMeta[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [installedPacks, setInstalledPacks] = useState<InstalledPackRecord[]>([]);
  const [packSource, setPackSource] = useState(emptyPackSource);
  const [packPreview, setPackPreview] = useState<FydorPackValidation | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("skip");
  const [selectedInstallLessons, setSelectedInstallLessons] = useState<Set<number>>(new Set());
  const [installing, setInstalling] = useState(false);
  const [installSummary, setInstallSummary] = useState<InstallSummary | null>(null);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportPreview, setExportPreview] = useState<FydorPack | null>(null);
  const [metadata, setMetadata] = useState({
    title: "My Fydor Pack",
    description: "",
    author: "",
    organization: "",
    version: "1.0.0",
    license: "CC BY",
    tags: ""
  });
  const [packSearch, setPackSearch] = useState("");
  const [packLanguage, setPackLanguage] = useState("all");
  const [packLevel, setPackLevel] = useState("all");

  useEffect(() => {
    refreshLessons();
    setInstalledPacks(readInstalledPacks());
  }, []);

  const existingLessonByKey = useMemo(() => {
    const map = new Map<string, StudyLessonMeta>();
    lessons.forEach((lesson) => {
      map.set(lessonKey({
        title: lesson.title,
        language: lesson.language,
        baseLanguage: lesson.baseLanguage
      }), lesson);
    });
    return map;
  }, [lessons]);

  const duplicateIndexes = useMemo(() => {
    const duplicates = new Set<number>();
    packPreview?.pack?.lessons.forEach((lesson, index) => {
      if (existingLessonByKey.has(lessonKey(lesson))) duplicates.add(index);
    });
    return duplicates;
  }, [existingLessonByKey, packPreview]);

  const filteredInstalledPacks = useMemo(() => {
    const query = packSearch.trim().toLowerCase();
    return installedPacks.filter((pack) => {
      const matchesQuery = !query || [
        pack.title,
        pack.author,
        pack.organization,
        pack.tags.join(" "),
        pack.lessonTitles.join(" ")
      ].filter(Boolean).join(" ").toLowerCase().includes(query);
      const matchesLanguage = packLanguage === "all" || pack.language === packLanguage;
      const matchesLevel = packLevel === "all" || (pack.level ?? "none") === packLevel;
      return matchesQuery && matchesLanguage && matchesLevel;
    });
  }, [installedPacks, packLanguage, packLevel, packSearch]);

  const packLanguages = Array.from(new Set(installedPacks.map((pack) => pack.language))).sort();
  const packLevels = Array.from(new Set(installedPacks.map((pack) => pack.level ?? "none"))).sort();

  async function refreshLessons() {
    setLessonsLoading(true);
    try {
      setLessons(await getLessons());
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load lessons."]);
    } finally {
      setLessonsLoading(false);
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setPackSource(text);
    previewPack(text);
  }

  function previewPack(source = packSource) {
    setErrors([]);
    setStatus("");
    setInstallSummary(null);
    const validation = parseFydorPack(source);
    setPackPreview(validation);
    if (validation.pack) {
      setSelectedInstallLessons(new Set(validation.pack.lessons.map((_, index) => index)));
      setStatus(validation.errors.length ? "" : "Pack preview ready.");
    } else {
      setSelectedInstallLessons(new Set());
      setErrors(validation.errors);
    }
  }

  async function installSelectedLessons() {
    const pack = packPreview?.pack;
    if (!pack) return;

    const lessonsToInstall = pack.lessons
      .map((lesson, index) => ({ lesson, index }))
      .filter((item) => selectedInstallLessons.has(item.index));

    if (!lessonsToInstall.length) {
      setErrors(["Select at least one lesson to install."]);
      return;
    }

    setInstalling(true);
    setErrors([]);
    setStatus("");
    setInstallSummary(null);

    const summary: InstallSummary = {
      installed: 0,
      skipped: 0,
      replaced: 0,
      sentenceCount: 0,
      details: []
    };
    const installedLessonTitles: string[] = [];
    const installedLessonIds: string[] = [];

    try {
      for (const { lesson, index } of lessonsToInstall) {
        const existing = existingLessonByKey.get(lessonKey(lesson));
        if (existing && duplicateMode === "skip") {
          summary.skipped += 1;
          summary.details.push(`Skipped ${lesson.title}.`);
          continue;
        }

        if (existing && duplicateMode === "replace") {
          const result = await updateLesson(existing.id, JSON.stringify(withPackSource(lesson, pack), null, 2));
          if (result.errors.length) throw new Error(result.errors.join("\n"));
          summary.replaced += 1;
          summary.sentenceCount += lesson.sentences.length;
          summary.details.push(`Replaced ${lesson.title}.`);
          installedLessonTitles.push(lesson.title);
          installedLessonIds.push(existing.id);
          continue;
        }

        const lessonForImport = existing ? copyLessonTitle(lesson, index) : lesson;
        const result = await importLesson(JSON.stringify(withPackSource(lessonForImport, pack), null, 2));
        if (result.errors.length) throw new Error(result.errors.join("\n"));
        summary.installed += result.lessonCreated || result.sentencesImported > 0 ? 1 : 0;
        summary.sentenceCount += lessonForImport.sentences.length;
        summary.details.push(`Installed ${lessonForImport.title}.`);
        installedLessonTitles.push(lessonForImport.title);
      }

      const refreshedLessons = await getLessons();
      setLessons(refreshedLessons);
      const refreshedByKey = new Map(refreshedLessons.map((lesson) => [
        lessonKey({ title: lesson.title, language: lesson.language, baseLanguage: lesson.baseLanguage }),
        lesson
      ]));
      installedLessonIds.push(...installedLessonTitles
        .map((title) => refreshedByKey.get(lessonKey({ title, language: pack.language, baseLanguage: pack.baseLanguage }))?.id)
        .filter((id): id is string => Boolean(id)));

      if (installedLessonTitles.length) {
        const nextPacks = upsertInstalledPack(installedPacks, {
          id: pack.id,
          title: pack.title,
          description: pack.description,
          author: pack.author?.name,
          organization: pack.author?.organization,
          version: pack.version,
          license: pack.license,
          language: pack.language,
          baseLanguage: pack.baseLanguage,
          level: pack.level,
          tags: pack.tags ?? [],
          installedAt: new Date().toISOString(),
          lessonTitles: Array.from(new Set(installedLessonTitles)),
          lessonIds: Array.from(new Set(installedLessonIds)),
          sentenceCount: summary.sentenceCount
        });
        setInstalledPacks(nextPacks);
        writeInstalledPacks(nextPacks);
      }

      setInstallSummary(summary);
      setStatus("Pack install complete.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to install this pack."]);
    } finally {
      setInstalling(false);
    }
  }

  function toggleExportLesson(lessonId: string) {
    setSelectedLessonIds((current) => {
      const next = new Set(current);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
    setExportPreview(null);
  }

  function selectAllLessons() {
    setSelectedLessonIds(new Set(lessons.map((lesson) => lesson.id)));
    setExportPreview(null);
  }

  async function buildExportPreview(ids = selectedLessonIds) {
    if (!ids.size) {
      setErrors(["Select one or more lessons to export."]);
      return null;
    }

    setExporting(true);
    setErrors([]);
    setStatus("");
    try {
      const exportedLessons = await Promise.all([...ids].map((lessonId) => exportLesson(lessonId)));
      const pack = createFydorPack({
        title: metadata.title,
        description: metadata.description,
        author: {
          name: metadata.author,
          organization: metadata.organization
        },
        version: metadata.version,
        license: metadata.license,
        tags: splitTags(metadata.tags),
        lessons: exportedLessons
      });
      setExportPreview(pack);
      setStatus("Export preview ready.");
      return pack;
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to export lessons."]);
      return null;
    } finally {
      setExporting(false);
    }
  }

  async function exportSelectedPack(ids = selectedLessonIds) {
    const pack = exportPreview && ids === selectedLessonIds ? exportPreview : await buildExportPreview(ids);
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugifyPackTitle(pack.title)}.fydorpack`;
    link.click();
    window.URL.revokeObjectURL(url);
    setStatus(`Exported ${pack.title}.`);
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Fydor Exchange</h1>
          <p className="muted">Import, share, and manage lesson packs.</p>
        </div>
        <span className="pill pill-accent">Fydor Packs</span>
      </div>

      {errors.length ? (
        <section className="card error-card exchange-status-card">
          <PackageOpen size={18} />
          <div>
            {errors.map((error) => <p key={error}>{error}</p>)}
          </div>
        </section>
      ) : null}
      {status ? (
        <section className="card success-card exchange-status-card">
          <CheckCircle2 size={18} />
          <p>{status}</p>
        </section>
      ) : null}

      <div className="exchange-grid">
        <section className="card stack exchange-section">
          <div className="exchange-section-heading">
            <FileUp size={20} />
            <div>
              <h2>Install Pack</h2>
              <p className="muted">Import a lesson pack shared by a teacher or another Fydor user.</p>
            </div>
          </div>

          <div className="exchange-actions">
            <label className="button secondary">
              <Upload size={18} />
              Select file
              <input className="hidden-input" type="file" accept=".fydorpack,application/json,.json" onChange={(event) => readFile(event.target.files?.[0])} />
            </label>
            <button className="button secondary" type="button" onClick={() => previewPack()}>
              <PackageOpen size={18} />
              Preview pack
            </button>
          </div>

          <label className="field">
            <span>Advanced pack data</span>
            <textarea
              className="input code-input exchange-pack-input"
              value={packSource}
              placeholder="Paste Fydor Pack data here."
              onChange={(event) => {
                setPackSource(event.target.value);
                setPackPreview(null);
                setInstallSummary(null);
              }}
            />
          </label>

          {packPreview?.pack ? (
            <PackPreview
              validation={packPreview}
              duplicateIndexes={duplicateIndexes}
              selectedLessons={selectedInstallLessons}
              duplicateMode={duplicateMode}
              installing={installing}
              onToggleLesson={(index) => setSelectedInstallLessons((current) => {
                const next = new Set(current);
                if (next.has(index)) next.delete(index);
                else next.add(index);
                return next;
              })}
              onDuplicateModeChange={setDuplicateMode}
              onInstall={installSelectedLessons}
            />
          ) : null}

          {installSummary ? (
            <section className="exchange-summary">
              <h3>Install Summary</h3>
              <div className="exchange-stat-row">
                <span><strong>{installSummary.installed}</strong> installed</span>
                <span><strong>{installSummary.skipped}</strong> skipped</span>
                <span><strong>{installSummary.replaced}</strong> replaced</span>
                <span><strong>{installSummary.sentenceCount}</strong> sentences</span>
              </div>
              <div className="exchange-actions">
                <Link className="button secondary" href="/lessons/manage">Go to Lessons</Link>
                <Link className="button" href="/review">Start Review</Link>
              </div>
            </section>
          ) : null}
        </section>

        <section className="card stack exchange-section">
          <div className="exchange-section-heading">
            <Download size={20} />
            <div>
              <h2>Share Pack</h2>
              <p className="muted">Export your lessons as a Fydor Pack.</p>
            </div>
          </div>

          <div className="exchange-select-all">
            <button className="button secondary" type="button" disabled={lessonsLoading || lessons.length === 0} onClick={selectAllLessons}>
              Select all lessons
            </button>
            <button className="button secondary" type="button" disabled={selectedLessonIds.size === 0} onClick={() => {
              setSelectedLessonIds(new Set());
              setExportPreview(null);
            }}>
              Clear
            </button>
          </div>

          <div className="exchange-lesson-picker">
            {lessonsLoading ? <p className="muted">Loading lessons...</p> : null}
            {!lessonsLoading && lessons.length === 0 ? <p className="muted">No lessons yet. Create or install a lesson before exporting a pack.</p> : null}
            {lessons.map((lesson) => (
              <label className="exchange-check-row" key={lesson.id}>
                <input type="checkbox" checked={selectedLessonIds.has(lesson.id)} onChange={() => toggleExportLesson(lesson.id)} />
                <span>
                  <strong>{lesson.title}</strong>
                  <small>{lesson.sentenceCount} sentences · {lesson.language} to {lesson.baseLanguage}</small>
                </span>
              </label>
            ))}
          </div>

          <div className="exchange-meta-grid">
            <label className="field">
              <span>Pack title</span>
              <input className="input" value={metadata.title} onChange={(event) => {
                setMetadata({ ...metadata, title: event.target.value });
                setExportPreview(null);
              }} />
            </label>
            <label className="field">
              <span>Version</span>
              <input className="input" value={metadata.version} onChange={(event) => {
                setMetadata({ ...metadata, version: event.target.value });
                setExportPreview(null);
              }} />
            </label>
            <label className="field exchange-wide-field">
              <span>Description</span>
              <textarea className="input small-textarea" value={metadata.description} onChange={(event) => {
                setMetadata({ ...metadata, description: event.target.value });
                setExportPreview(null);
              }} />
            </label>
            <label className="field">
              <span>Author</span>
              <input className="input" value={metadata.author} onChange={(event) => {
                setMetadata({ ...metadata, author: event.target.value });
                setExportPreview(null);
              }} />
            </label>
            <label className="field">
              <span>Organization</span>
              <input className="input" value={metadata.organization} onChange={(event) => {
                setMetadata({ ...metadata, organization: event.target.value });
                setExportPreview(null);
              }} />
            </label>
            <label className="field">
              <span>License</span>
              <input className="input" value={metadata.license} onChange={(event) => {
                setMetadata({ ...metadata, license: event.target.value });
                setExportPreview(null);
              }} />
            </label>
            <label className="field">
              <span>Tags</span>
              <input className="input" value={metadata.tags} placeholder="hsk, beginner" onChange={(event) => {
                setMetadata({ ...metadata, tags: event.target.value });
                setExportPreview(null);
              }} />
            </label>
          </div>

          <div className="exchange-actions">
            <button className="button secondary" type="button" disabled={exporting || selectedLessonIds.size === 0} onClick={() => buildExportPreview()}>
              <PackageCheck size={18} />
              {exporting ? "Building..." : "Show preview"}
            </button>
            <button className="button" type="button" disabled={exporting || selectedLessonIds.size === 0} onClick={() => exportSelectedPack()}>
              <Download size={18} />
              Export selected
            </button>
            <button className="button secondary" type="button" disabled={exporting || lessons.length === 0} onClick={() => exportSelectedPack(new Set(lessons.map((lesson) => lesson.id)))}>
              Export all
            </button>
          </div>

          {exportPreview ? (
            <section className="exchange-summary">
              <h3>Export Preview</h3>
              <div className="exchange-stat-row">
                <span><strong>{exportPreview.title}</strong></span>
                <span>{exportPreview.lessons.length} lessons</span>
                <span>{countSentences(exportPreview.lessons)} sentences</span>
                <span>{exportPreview.language} to {exportPreview.baseLanguage}</span>
                <span>{estimatePackSize(exportPreview)}</span>
              </div>
            </section>
          ) : null}
        </section>

        <section className="card stack exchange-section exchange-my-packs">
          <div className="exchange-section-heading">
            <Archive size={20} />
            <div>
              <h2>My Packs</h2>
              <p className="muted">Manage installed lesson packs.</p>
            </div>
          </div>

          <div className="exchange-filter-row">
            <label className="exchange-search">
              <Search size={16} />
              <input value={packSearch} placeholder="Search packs" onChange={(event) => setPackSearch(event.target.value)} />
            </label>
            <label className="exchange-select-filter">
              <Filter size={16} />
              <select value={packLanguage} onChange={(event) => setPackLanguage(event.target.value)}>
                <option value="all">All languages</option>
                {packLanguages.map((language) => <option key={language} value={language}>{language}</option>)}
              </select>
            </label>
            <select className="input exchange-level-select" value={packLevel} onChange={(event) => setPackLevel(event.target.value)}>
              <option value="all">All levels</option>
              {packLevels.map((level) => <option key={level} value={level}>{level === "none" ? "No level" : level}</option>)}
            </select>
          </div>

          {installedPacks.length === 0 ? (
            <div className="exchange-empty">
              <h3>No installed packs yet</h3>
              <p className="muted">Installed pack metadata will appear here after you preview and install a Fydor Pack.</p>
            </div>
          ) : null}

          <div className="exchange-pack-list">
            {filteredInstalledPacks.map((pack) => (
              <article className="exchange-pack-row" key={`${pack.id}-${pack.installedAt}`}>
                <div className="exchange-pack-row-top">
                  <div>
                    <h3>{pack.title}</h3>
                    <p className="muted">
                      {pack.author || pack.organization ? [pack.author, pack.organization].filter(Boolean).join(", ") : "Unknown author"} · v{pack.version}
                    </p>
                  </div>
                  <span className="pill">{pack.language} to {pack.baseLanguage}</span>
                </div>
                {pack.description ? <p>{pack.description}</p> : null}
                <div className="exchange-stat-row">
                  <span>{pack.lessonTitles.length} lessons</span>
                  <span>{pack.sentenceCount} sentences</span>
                  {pack.level ? <span>{pack.level}</span> : null}
                  {pack.license ? <span>{pack.license}</span> : null}
                </div>
                {pack.tags.length ? <div className="inline-tags">{pack.tags.map((tag) => <span className="tag-chip static" key={tag}>{tag}</span>)}</div> : null}
                <details className="exchange-pack-lessons">
                  <summary>Lessons in this pack</summary>
                  <ul>
                    {pack.lessonTitles.map((title) => <li key={title}>{title}</li>)}
                  </ul>
                </details>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function PackPreview({
  validation,
  duplicateIndexes,
  selectedLessons,
  duplicateMode,
  installing,
  onToggleLesson,
  onDuplicateModeChange,
  onInstall
}: {
  validation: FydorPackValidation;
  duplicateIndexes: Set<number>;
  selectedLessons: Set<number>;
  duplicateMode: DuplicateMode;
  installing: boolean;
  onToggleLesson: (index: number) => void;
  onDuplicateModeChange: (mode: DuplicateMode) => void;
  onInstall: () => void;
}) {
  const pack = validation.pack;
  if (!pack) return null;
  const canInstall = validation.errors.length === 0 && selectedLessons.size > 0;

  return (
    <section className="exchange-preview">
      <div className="exchange-pack-row-top">
        <div>
          <h3>{pack.title}</h3>
          <p className="muted">{pack.description || "No pack description."}</p>
        </div>
        <span className={`pill ${canInstall ? "status-new" : "status-conflict"}`}>
          {canInstall ? "Ready to install" : "Cannot install"}
        </span>
      </div>

      <div className="exchange-stat-row">
        <span>{pack.author?.name || "Unknown author"}</span>
        <span>v{pack.version}</span>
        {pack.license ? <span>{pack.license}</span> : null}
        <span>{pack.language} to {pack.baseLanguage}</span>
        {pack.level ? <span>{pack.level}</span> : null}
        <span>{validation.lessonCount} lessons</span>
        <span>{validation.sentenceCount} sentences</span>
      </div>

      {pack.tags?.length ? <div className="inline-tags">{pack.tags.map((tag) => <span className="tag-chip static" key={tag}>{tag}</span>)}</div> : null}

      <div className="exchange-validation-list">
        <span className="pill status-new">valid pack structure</span>
        <span className={`pill ${validation.lessonErrors.length ? "status-conflict" : "status-new"}`}>
          {validation.lessonErrors.length ? "lesson schema issues" : "valid lesson schema"}
        </span>
        <span className={duplicateIndexes.size ? "pill status-conflict" : "pill status-new"}>
          {duplicateIndexes.size} duplicate warning{duplicateIndexes.size === 1 ? "" : "s"}
        </span>
      </div>

      {validation.warnings.length ? (
        <div className="notice warn exchange-warning-list">
          <div>{validation.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
        </div>
      ) : null}

      <div className="exchange-duplicate-controls">
        {(["skip", "replace", "keep"] as DuplicateMode[]).map((mode) => (
          <label className="exchange-radio" key={mode}>
            <input type="radio" checked={duplicateMode === mode} onChange={() => onDuplicateModeChange(mode)} />
            <span>{mode === "skip" ? "Skip existing" : mode === "replace" ? "Replace existing" : "Keep both"}</span>
          </label>
        ))}
      </div>

      <div className="exchange-lesson-picker">
        {pack.lessons.map((lesson, index) => (
          <label className="exchange-check-row" key={`${lesson.title}-${index}`}>
            <input type="checkbox" checked={selectedLessons.has(index)} onChange={() => onToggleLesson(index)} />
            <span>
              <strong>{lesson.title}</strong>
              <small>
                {lesson.sentences.length} sentences
                {duplicateIndexes.has(index) ? " · already installed" : ""}
              </small>
            </span>
          </label>
        ))}
      </div>

      <button className="button" type="button" disabled={!canInstall || installing} onClick={onInstall}>
        <PackageCheck size={18} />
        {installing ? "Installing..." : "Install selected lessons"}
      </button>
    </section>
  );
}

function withPackSource(lesson: LessonImportInput, pack: FydorPack): LessonImportInput {
  return {
    ...lesson,
    source: `Fydor Pack: ${pack.title} (${pack.id}@${pack.version})`
  };
}

function copyLessonTitle(lesson: LessonImportInput, index: number): LessonImportInput {
  return {
    ...lesson,
    title: `${lesson.title} (Pack copy ${index + 1})`
  };
}

function splitTags(value: string): string[] {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function readInstalledPacks(): InstalledPackRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const source = window.localStorage.getItem(INSTALLED_PACKS_KEY);
    if (!source) return [];
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeInstalledPacks(packs: InstalledPackRecord[]) {
  window.localStorage.setItem(INSTALLED_PACKS_KEY, JSON.stringify(packs));
}

function upsertInstalledPack(packs: InstalledPackRecord[], nextPack: InstalledPackRecord): InstalledPackRecord[] {
  const existing = packs.filter((pack) => pack.id !== nextPack.id);
  return [nextPack, ...existing];
}
