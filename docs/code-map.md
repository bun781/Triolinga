# Fydor Codebase Map

Last updated: 2026-06-27. Verify file existence before acting on this map — it can go stale.

---

## App Routes / Pages (`app/`)

| Route | File | Owns |
|---|---|---|
| `/` | `app/page.tsx` | Home / landing page |
| `/review` | `app/review/page.tsx` | Review session entry point — renders `ReviewDeck` |
| `/study/imported-content` | `app/study/imported-content/page.tsx` | Main study mode (progressive reveal) |
| `/study/fill-blank` | `app/study/fill-blank/page.tsx` | Fill-in-the-blank study variant |
| `/study/multiple-choice` | `app/study/multiple-choice/page.tsx` | Multiple-choice study variant |
| `/study/sentence-forge` | `app/study/sentence-forge/page.tsx` | Sentence construction mode |
| `/lessons/manage` | `app/lessons/manage/page.tsx` | Lesson list and management |
| `/lessons/import` | `app/lessons/import/page.tsx` | Lesson import form |
| `/lessons/import/preview` | `app/lessons/import/preview/page.tsx` | Import preview before committing |
| `/admin/imports` | `app/admin/imports/page.tsx` | Admin import interface |
| `/fydor-exchange` | `app/fydor-exchange/page.tsx` | Pack sharing and exchange |
| `/learning-science` | `app/learning-science/page.tsx` | Learning reference page |

API routes live under `app/api/` but are mostly thin wrappers. The real logic lives in `lib/`.

Do not add business logic directly to page files.

---

## Components (`components/`)

### `components/review/`
Review session UI. Owns the card deck display, grade controls, and stats browser.

| File | Owns |
|---|---|
| `ReviewDeck.tsx` | Full review session — card rendering, grade submission, session flow |
| `ReviewSentenceCard.tsx` | Individual card layout per recall mode |
| `ReviewControls.tsx` | Grade buttons (forgot / hard / remembered / easy) |
| `ReviewStatsBrowser.tsx` | Session stats and progress display |

Do not put SRS logic here — that belongs in `lib/review/`.

### `components/imported-content/`
Study mode UI for imported lessons. Handles all four exercise modes.

| File | Owns |
|---|---|
| `ImportedContentStudy.tsx` | Study session orchestrator — mode switching, progress |
| `SentenceFlashcard.tsx` | Base flashcard layout with audio and translation |
| `FillBlankMode.tsx` | Fill-in-the-blank exercise UI |
| `MultipleChoiceMode.tsx` | Multiple choice exercise UI |
| `AnnotatedSentence.tsx` | Sentence with interactive word/grammar highlights |
| `CheckpointQuiz.tsx` | Checkpoint quiz between lesson sections |
| `InteractiveToken.tsx` | Clickable word/grammar token with tooltip |
| `ProgressiveRevealControls.tsx` | Progressive disclosure buttons |
| `RelatedSentences.tsx` | Related example sentence display |
| `StudyDetailsPanel.tsx` | Detail sidebar |
| `sessionProgress.ts` | In-session progress tracking (not SRS) |
| `useImportedLessonBrowser.ts` | Hook for navigating sentences within a lesson |

### `components/admin-imports/`
Admin interface for importing and managing lessons.

| File | Owns |
|---|---|
| `LessonImportsPage.tsx` | Main import UI — JSON input, preview, submit |
| `LessonLibraryPanel.tsx` | Lesson library list widget |
| `LanguageField.tsx` | Language selection input |
| `lesson-import-utils.ts` | Local helpers for the import form |

### `components/language/`
Supplementary import UI.

| File | Owns |
|---|---|
| `ImportHelpPanel.tsx` | Help text for the import format |
| `ImportPreview.tsx` | Preview rendering of a parsed lesson |

### `components/ui/`
Reusable UI primitives.

| File | Owns |
|---|---|
| `AudioButton.tsx` | Play/stop button for audio |
| `Tooltip.tsx` | Tooltip wrapper |

### `components/system/`
App-level components.

| File | Owns |
|---|---|
| `AppShell.tsx` | Root layout wrapper (in `components/`) |
| `GuidedTour.tsx` | First-run guided tour |
| `PageState.tsx` | Loading/error/empty page states |

---

## Review System (`lib/review/`)

The SRS review loop. This is core product logic — change carefully.

| File | Owns |
|---|---|
| `types.ts` | `ReviewSentence`, `ReviewGrade`, `SentenceReviewState`, `RecallMode` type definitions |
| `queue.ts` | `buildInterleavedReviewQueue` — sorts and interleaves due/fresh/mastered sentences |
| `scheduler.ts` | `applyReviewDecision`, `scheduleNextDueAt` — SRS math and state transitions |
| `recallModes.ts` | `progressRecallMode` — state machine for the 5-mode recall progression |
| `reviewData.ts` | `getReviewSentences`, `saveReviewDecision` — DB read/write via Drizzle |
| `algorithm.ts` | Re-exports from `queue.ts` for backward compatibility |
| `useReviewDeck.ts` | React hook wiring keyboard shortcuts and deck state |
| `useLessonReview.ts` | React hook for lesson-scoped review |
| `sessionSummary.ts` | Calculates end-of-session statistics |
| `keyboard.ts` | Keyboard shortcut handler definitions |

**What not to change here without deep review:**
- `queue.ts` — the interleaving ratios (30% fresh, 12% mastered) are intentional
- `scheduler.ts` — interval values (10min / 1day / 3day / 7day) match the Rust side in `review.rs`
- `recallModes.ts` — the 5-mode order is the product's core progression model

---

## Lesson Library (`lib/language/`)

Lesson import, validation, and normalization. Also handles study-mode content transformation.

| File | Owns |
|---|---|
| `types.ts` | `LessonImportInput`, `LessonSentenceInput`, `LessonImportSummary`, `LessonImportPreviewResult` |
| `importSchema.ts` | Zod schemas — validates user-supplied lesson JSON |
| `importLesson.ts` | TypeScript-side import orchestrator (used for web-based preview) |
| `importResources.ts` | Resource/asset handling during import |
| `importedContent.ts` | Content transformation helpers |
| `normalize.ts` | `buildCanonicalKey`, `hashLessonSource` — text normalization for deduplication |
| `srs.ts` | SRS scheduling logic for the study (non-review) mode |

Do not duplicate normalization logic — `lib/language/normalize.ts` and `src-tauri/src/normalize.rs` must stay in sync.

---

## Import/Export System

Import lives across two layers:

| Layer | File | Owns |
|---|---|---|
| Schema validation | `lib/language/importSchema.ts` | Zod — validates lesson JSON shape |
| TypeScript orchestrator | `lib/language/importLesson.ts` | Preview-only import (web layer) |
| Rust orchestrator | `src-tauri/src/lessons/mod.rs` | Actual commit to SQLite; deduplication |
| Fydor pack format | `lib/fydor-pack.ts` | `.fydorpack` Zod schema and interfaces |
| Frontend bridge | `lib/desktopApi.ts` | `previewLessonImport`, `importLesson` invoke calls |

The Rust side is the authoritative importer for production. The TS-side `importLesson.ts` is used only for web-mode preview.

---

## Tauri Backend (`src-tauri/src/`)

All Tauri commands are registered in `main.rs`. The command implementations are split by domain.

| File | Owns |
|---|---|
| `main.rs` | App setup, command handler registration |
| `lessons/mod.rs` | `get_lessons`, `get_lesson`, `export_lesson`, `update_lesson`, `delete_lesson`, `preview_lesson_import`, `import_lesson` |
| `review.rs` | `get_review_queue`, `update_review_item`, `reset_review_progress` |
| `db.rs` | SQLite open, schema setup, legacy PGlite data migration |
| `models.rs` | Rust structs mirroring TypeScript types (`StudyLesson`, `ReviewSentence`, etc.) |
| `normalize.rs` | Rust text normalization — must stay in sync with `lib/language/normalize.ts` |
| `settings.rs` | `save_user_settings` command |

The frontend calls these via `lib/desktopApi.ts`. Command name strings in `invoke("...")` and `#[tauri::command]` must match exactly.

---

## Database / Persistence (`db/`, `lib/server/`)

| File | Owns |
|---|---|
| `db/schema.ts` | Drizzle table definitions — source of truth for DB shape |
| `db/migrations/` | SQL migration files applied in order |
| `lib/server/db.ts` | PGlite singleton initialization and migration runner (Next.js server-side) |
| `lib/server/pglitePath.ts` | OS-specific app data path resolution |

**Key tables:** `lessons`, `sentences`, `learningItems`, `reviewItems`, `lessonSentences`, `sentenceVocabularyLinks`, `sentenceGrammarLinks`, `sentenceChunkLinks`

Adding columns to `db/schema.ts` requires a new migration file in `db/migrations/`. Do not skip this.

The Tauri desktop app uses SQLite directly (via `src-tauri/src/db.rs`). The Next.js dev server uses PGlite (via `lib/server/db.ts`). They share the same schema shape but are separate runtimes.

---

## Shared Utilities

| File | Owns |
|---|---|
| `lib/desktopApi.ts` | All `invoke()` calls to Tauri — single point of contact between frontend and Rust |
| `lib/fydor-pack.ts` | `.fydorpack` format Zod schema and TypeScript interfaces |
| `lib/imported-content/types.ts` | `StudyLesson`, `StudySentence`, `StudyWord`, `StudyGrammar`, `StudyChunk` |
| `lib/imported-content/study-utils.ts` | Study session calculations |
| `lib/imported-content/text-spans.ts` | Text span / highlight logic |
| `lib/speech/` | `speechService.ts`, `speechPlayback.ts`, `useSpeechService.ts`, `useSpeechPlayback.ts` |

---

## Recommended Manual Corrections

- Verify that `lib/language/importedContent.ts` and `lib/language/importResources.ts` are still in use — they were present during mapping but may be legacy.
- The empty `lib/` subdirectories (`ai/`, `curriculum/`, `learning/`, `presets/`, `security/`, `validation/`) are placeholders. Confirm before adding code there.
- `components/imported-content/sessionProgress.ts` — confirm whether this is the canonical session progress tracker or whether `components/imported-content/useImportedLessonBrowser.ts` supersedes it.
