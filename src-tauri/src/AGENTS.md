# src-tauri/src/ — Agent Guide

## What This Folder Owns

The Rust Tauri desktop backend. All persistent data operations (read, write, import, export) for the production app go through commands registered here. The frontend calls these via `lib/desktopApi.ts` using `invoke("command_name")`.

## Key Files

| File | Role |
|---|---|
| `main.rs` | App entry point — sets up DB, registers all command handlers |
| `lessons/mod.rs` | Lesson CRUD and import/export: `get_lessons`, `get_lesson`, `export_lesson`, `update_lesson`, `delete_lesson`, `preview_lesson_import`, `import_lesson` |
| `review.rs` | Review commands: `get_review_queue`, `update_review_item`, `reset_review_progress` |
| `db.rs` | SQLite open + schema migrations + legacy PGlite data migration |
| `models.rs` | Rust structs mirroring TypeScript types — shared shape between frontend and backend |
| `normalize.rs` | Text normalization — must stay in sync with `lib/language/normalize.ts` |
| `settings.rs` | `save_user_settings` command |

## Related Files (outside this folder)

- `lib/desktopApi.ts` — every `invoke("...")` call; command name strings here must exactly match `#[tauri::command]` names in Rust
- `lib/review/scheduler.ts` — TS-side SRS intervals; must match the intervals in `review.rs`
- `lib/language/normalize.ts` — TS-side normalization; must match `normalize.rs`
- `db/schema.ts` — Drizzle schema used by the Next.js side (same logical shape as the SQLite schema here)

## What Not to Change Without Authorization

- **Command names** — the string in `invoke("command_name")` and the `#[tauri::command]` attribute must match. Renaming either side alone breaks the app silently.
- **`models.rs`** — struct field names are serialized to JSON for the frontend. Renaming fields is a breaking change.
- **`db.rs`** — schema migration logic; only add migrations, never remove or reorder them.
- **`review.rs` SRS intervals** — must stay in sync with `lib/review/scheduler.ts`.

## Common Mistakes to Avoid

- Do not add a new Tauri command without registering it in `main.rs` under `invoke_handler`.
- Do not change a command's parameter names without also updating the corresponding `invoke(...)` call in `lib/desktopApi.ts`.
- Do not modify `normalize.rs` without making the equivalent change in `lib/language/normalize.ts`.
- Do not add SQL schema changes directly to `db.rs` migration logic without considering whether the Next.js PGlite side (`db/migrations/`) also needs the same change.
