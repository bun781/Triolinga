# AGENTS.md — Fydor (Habitz) Coding Agent Guide

## Scope Rules

- Work on the smallest possible file set for each task. Do not scan or rewrite the whole repository.
- Before editing, identify the exact file(s) responsible for the behavior being changed.
- Do not move, rename, or restructure files or folders.
- Do not change imports unless the task explicitly requires it.
- Do not create new abstractions, barrel exports, or shared utilities unless explicitly asked.
- Do not refactor code that is unrelated to the task at hand.
- Do not introduce a second state system when one already exists (e.g., do not add Zustand if local state already works; do not add a second DB access layer).

## What Not to Change Without Clear Authorization

- `db/schema.ts` — changing this requires a new Drizzle migration
- `src-tauri/src/` — Rust Tauri commands are the source of truth for all data persistence; changing function signatures breaks the frontend invoke calls in `lib/desktopApi.ts`
- `lib/review/scheduler.ts` and `lib/review/queue.ts` — SRS scheduling and queue logic
- `lib/review/recallModes.ts` — recall mode progression state machine
- `lib/language/importSchema.ts` — Zod schemas for lesson JSON validation
- `lib/server/db.ts` — singleton database initialization

## Project Map

```
/
├── app/                    Next.js App Router pages and API routes
├── components/             React UI components, organized by feature
│   ├── review/             Review deck UI (ReviewDeck, ReviewControls, ReviewSentenceCard)
│   ├── imported-content/   Study mode UI (4 exercise modes, flashcards)
│   ├── admin-imports/      Admin lesson import interface
│   ├── language/           Import preview and help UI
│   ├── system/             App shell, guided tour, page state
│   └── ui/                 Reusable primitives (AudioButton, Tooltip)
├── lib/                    Business logic and utilities
│   ├── review/             SRS algorithm, queue builder, data access, React hooks
│   ├── language/           Lesson import, Zod schema validation, normalization
│   ├── imported-content/   Study mode types and utilities
│   ├── server/             PGlite DB initialization (server-side only)
│   └── speech/             Audio playback and Web Speech API wrappers
├── db/                     Drizzle schema + SQL migrations
├── src-tauri/              Rust Tauri desktop backend
│   └── src/
│       ├── main.rs         Command registration
│       ├── lessons/mod.rs  Lesson CRUD + import/export commands
│       ├── review.rs       Review queue and SRS update commands
│       ├── db.rs           SQLite setup + legacy migration
│       ├── models.rs       Rust structs mirroring TS types
│       ├── normalize.rs    Text normalization (Rust)
│       └── settings.rs     User settings persistence
├── docs/                   Architecture and feature documentation
└── lib/desktopApi.ts       Frontend bridge — all Tauri invoke() calls live here
```

## Feature Ownership Map

| Feature | Primary Files |
|---|---|
| Review queue building | `lib/review/queue.ts` |
| SRS scheduling | `lib/review/scheduler.ts` |
| Recall mode progression | `lib/review/recallModes.ts` |
| Review DB reads/writes | `lib/review/reviewData.ts` |
| Review UI | `components/review/ReviewDeck.tsx`, `ReviewSentenceCard.tsx` |
| Lesson import validation | `lib/language/importSchema.ts` |
| Lesson import logic | `lib/language/importLesson.ts` |
| Text normalization | `lib/language/normalize.ts`, `src-tauri/src/normalize.rs` |
| Study mode UI | `components/imported-content/` |
| Tauri commands (all) | `src-tauri/src/lessons/mod.rs`, `src-tauri/src/review.rs` |
| Tauri invoke bridge | `lib/desktopApi.ts` |
| Database schema | `db/schema.ts` |
| Database initialization | `lib/server/db.ts` |
| Fydor pack format | `lib/fydor-pack.ts` |

## Validation Order

1. `npm run typecheck` — TypeScript must pass before anything else
2. `npm test` — run Vitest suite
3. Manual smoke test of affected route only if typecheck passes

Do not run `npm run build` or `npm run tauri:build` unless TypeScript passes first.

## Rules Against Common Agent Mistakes

- **No duplicate state systems.** Review state lives in `reviewItems` table and is updated via Tauri commands. Do not mirror it in React state or localStorage.
- **No unrelated refactors.** If a file has style issues unrelated to your task, leave it alone.
- **No repository-wide inspection.** Read only the files needed for the current task.
- **No schema changes without migrations.** Adding a column to `db/schema.ts` requires a corresponding SQL file in `db/migrations/`.
- **Tauri command names are shared contracts.** The string in `invoke("command_name")` in `lib/desktopApi.ts` must exactly match the `#[tauri::command]` name in Rust. Do not rename either side independently.
