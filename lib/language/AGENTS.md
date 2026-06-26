# lib/language/ — Agent Guide

## What This Folder Owns

Lesson import validation, import orchestration (TypeScript side), content transformation, text normalization, and deduplication logic. Also owns the SRS scheduling variant used in non-review study modes.

## Key Files

| File | Role |
|---|---|
| `types.ts` | `LessonImportInput`, `LessonSentenceInput`, `LessonImportSummary`, `LessonImportPreviewResult` |
| `importSchema.ts` | Zod schemas — validates user-supplied lesson JSON before any processing |
| `importLesson.ts` | TypeScript import orchestrator — used for web-based preview only |
| `importResources.ts` | Resource/asset import handling |
| `importedContent.ts` | Content transformation helpers |
| `normalize.ts` | `buildCanonicalKey`, `hashLessonSource` — text normalization for deduplication |
| `srs.ts` | SRS scheduling for the study (non-review) mode |

## Related Files (outside this folder)

- `src-tauri/src/lessons/mod.rs` — Rust import orchestrator; this is the authoritative importer for production writes
- `src-tauri/src/normalize.rs` — Rust normalization; must stay in sync with `normalize.ts`
- `lib/desktopApi.ts` — `previewLessonImport` and `importLesson` invoke calls
- `db/schema.ts` — `lessons`, `sentences`, `learningItems`, and link table definitions

## What Not to Modify Without Review

- **`importSchema.ts`** — Zod shape changes affect what JSON the user can submit; must be backward-compatible or coordinated with the Rust parser in `lessons/mod.rs`.
- **`normalize.ts`** — normalization logic is mirrored in Rust. Changing one without the other breaks deduplication across runtimes.

## Common Mistakes to Avoid

- Do not perform actual DB writes from the TypeScript import path in production — the Rust `import_lesson` command owns that.
- Do not add a second normalization implementation — changes to canonical key logic must be reflected in both `normalize.ts` and `src-tauri/src/normalize.rs`.
- Do not validate lesson JSON outside of `importSchema.ts` — that is the single validation gate.
