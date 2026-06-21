# Review System

This page is the standalone sentence review flow at `/review`.

## Flow

1. The server loads all reviewable sentences.
2. The client builds a session queue from the current review state.
3. One sentence is shown at a time.
4. `ArrowLeft` or the Not Remembered button marks a sentence as forgotten.
5. `ArrowRight` or the Remembered button marks a sentence as remembered.
6. Each answer is saved immediately and the local queue advances.
7. Shuffle rebuilds the queue without introducing duplicate review logic.

## Data Fields

The review system adds three sentence-level fields:

- `review_state` - one of `unknown`, `remembered`, or `forgotten`
- `review_streak` - consecutive remembered answers
- `reviewed_at` - timestamp of the last review action

## Algorithm

The review algorithm lives in `lib/review/algorithm.ts` so it can be replaced later without changing the UI.

- Forgotten sentences are placed before unknown sentences.
- Unknown sentences are placed before remembered sentences.
- Remembered sentences are pushed farther back as `review_streak` increases.
- Equal-priority sentences are shuffled with a seeded Fisher-Yates pass.

This is intentionally simple session logic, not a final spaced-repetition engine.

## Architecture

- `app/review/page.tsx` loads the data and renders the shell.
- `components/review/` owns the card and action buttons.
- `lib/review/useReviewDeck.ts` coordinates queue state, keyboard shortcuts, and persistence.
- `lib/review/reviewData.ts` handles database reads and writes.
- `lib/review/algorithm.ts` is the replaceable scheduling strategy.

## Notes

- Keyboard shortcuts are only active while the review component is mounted.
- The queue avoids repeating items within a cycle.
- Shuffle rebuilds the order without changing the sentence state model.
