# lib/review/ — Agent Guide

## What This Folder Owns

The SRS (spaced repetition) algorithm, review queue logic, recall mode state machine, database access for review data, and React hooks that wire these together.

## Key Files

| File | Role |
|---|---|
| `types.ts` | Canonical type definitions: `ReviewSentence`, `ReviewGrade`, `RecallMode`, `SentenceReviewState` |
| `queue.ts` | `buildInterleavedReviewQueue` — orders and interleaves due / fresh / mastered sentences |
| `scheduler.ts` | `applyReviewDecision`, `scheduleNextDueAt` — SRS math and state transitions |
| `recallModes.ts` | `progressRecallMode` — the 5-mode recall progression state machine |
| `reviewData.ts` | `getReviewSentences`, `saveReviewDecision` — all DB reads and writes for review |
| `algorithm.ts` | Re-exports from `queue.ts` (backward-compatibility shim — do not add new exports here) |
| `useReviewDeck.ts` | React hook: keyboard shortcuts, deck navigation, grade submission |
| `useLessonReview.ts` | React hook: lesson-scoped review session |
| `sessionSummary.ts` | End-of-session statistics computation |
| `keyboard.ts` | Keyboard shortcut handler definitions |

## Related Files (outside this folder)

- `components/review/ReviewDeck.tsx` — primary consumer of `useReviewDeck`
- `src-tauri/src/review.rs` — Rust-side command implementations for `get_review_queue`, `update_review_item`, `reset_review_progress`
- `lib/desktopApi.ts` — frontend `invoke()` calls that call the Rust commands
- `db/schema.ts` — `reviewItems` and `sentences` table definitions

## What Not to Modify Without Deep Review

- **`queue.ts`** — the interleaving ratios (30% fresh blend, 12% mastered blend) are deliberate product decisions.
- **`scheduler.ts`** — interval values (10 min / 1 day / 3 days / 7 days) must match the Rust implementation in `src-tauri/src/review.rs`. If you change one, change both.
- **`recallModes.ts`** — the 5-mode order (`full_support → translation_hidden → sentence_only → fill_blank → reverse_translate`) is the core progression model. Do not reorder or add modes without updating `ReviewSentenceCard.tsx`.

## Common Mistakes to Avoid

- Do not duplicate SRS interval constants — they exist in both TypeScript (`scheduler.ts`) and Rust (`review.rs`) and must be kept in sync.
- Do not add database queries inside hook files — DB logic belongs in `reviewData.ts`.
- Do not create a parallel state store (e.g., localStorage, Zustand) that shadows `reviewItems` — the DB is the single source of truth.
