# components/review/ — Agent Guide

## What This Folder Owns

Review session UI only. Rendering cards, displaying recall modes, and wiring grade buttons to callbacks.

## Key Files

| File | Role |
|---|---|
| `ReviewDeck.tsx` | Orchestrates the full review session — manages current card, submission, session end |
| `ReviewSentenceCard.tsx` | Renders a single sentence card based on the current `recallMode` |
| `ReviewControls.tsx` | Grade buttons: forgot / hard / remembered / easy |
| `ReviewStatsBrowser.tsx` | Session stats and progress display |

## Related Files (outside this folder)

- `lib/review/useReviewDeck.ts` — React hook that drives `ReviewDeck.tsx`; keyboard shortcuts and deck state live here
- `lib/review/queue.ts` — builds the ordered list of sentence IDs the deck consumes
- `lib/review/scheduler.ts` — computes the next due date after a grade; do not replicate this logic here
- `lib/review/types.ts` — `ReviewSentence`, `ReviewGrade`, `RecallMode` types
- `lib/desktopApi.ts` — `getReviewQueue` and `updateReviewItem` Tauri calls

## What Not to Modify From Here

- SRS scheduling math — belongs in `lib/review/scheduler.ts`
- Queue building and interleaving — belongs in `lib/review/queue.ts`
- Recall mode progression — belongs in `lib/review/recallModes.ts`
- Database reads/writes — belongs in `lib/review/reviewData.ts`

## Common Mistakes to Avoid

- Do not add SRS interval constants or scheduling conditions inside component files.
- Do not read from or write to `reviewItems` directly from a component — use the hook or `lib/review/reviewData.ts`.
- Do not add a new recall mode here without also updating `recallModes.ts` and `ReviewSentenceCard.tsx` together.
