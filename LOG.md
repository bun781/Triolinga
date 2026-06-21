# Lesson Import System Log

## Review System Addendum

The new sentence review tab lives at `/review` and uses a separate queue strategy from Sentence Forge so it can be swapped for SRS later without changing the UI.

### Files Added

- `app/api/review/route.ts`
- `app/review/page.tsx`
- `components/review/ReviewControls.tsx`
- `components/review/ReviewDeck.tsx`
- `components/review/ReviewSentenceCard.tsx`
- `db/migrations/0002_review_system.sql`
- `docs/review-system.md`
- `lib/review/algorithm.ts`
- `lib/review/reviewData.ts`
- `lib/review/types.ts`
- `lib/review/useReviewDeck.ts`
- `tests/unit/review.test.ts`

### Schema Changes

- `sentences.review_state`
- `sentences.review_streak`
- `sentences.reviewed_at`

### Behavior

- Left arrow and Not Remembered mark a sentence as forgotten.
- Right arrow and Remembered mark a sentence as remembered.
- Forgotten items are surfaced first in the next queue cycle.
- Remembered items drift back as their streak increases.
- Shuffle rebuilds the queue without changing the underlying state fields.

## Files Changed

- `app/admin/imports/page.tsx`
- `app/api/lessons/import/preview/route.ts`
- `app/api/lessons/import/route.ts`
- `app/layout.tsx`
- `app/lessons/import/page.tsx`
- `app/lessons/import/preview/page.tsx`
- `app/page.tsx`
- `app/study/imported-content/page.tsx`
- `app/globals.css`
- `components/AppShell.tsx`
- `components/language/ImportPreview.tsx`
- `db/schema.ts`
- `db/migrations/0002_lesson_import.sql`
- `lib/language/importSchema.ts`
- `lib/language/importLesson.ts`
- `lib/language/importedContent.ts`
- `lib/language/generateDrills.ts`
- `lib/language/normalize.ts`
- `lib/language/types.ts`
- `tests/unit/language-import.test.ts`

## Schema Changes

- `lessons`
  - Added `description`
  - Added `source`
  - Added `tags`
- Added `lesson_sentences`
  - Links lessons to reusable sentence rows
  - Preserves lesson ordering with `position`
- Added `sentence_vocabulary_links`
  - Stores exact surface text for sentence-to-vocabulary hover links
- Added `sentence_grammar_links`
  - Stores exact surface text for sentence-to-grammar hover links
- Added `sentence_chunk_links`
  - Stores exact surface text for sentence-to-chunk hover links

Existing tables reused:

- `sentences`
- `learning_items`
- `drills`
- `review_states`
- `sentence_review_attempts`

## Import Flow

1. Parse JSON on the server.
2. Reject malformed JSON, empty lessons, duplicate sentences, and surface mismatches.
3. Build a preview against existing lessons, sentences, and learning items.
4. Block imports when a canonical item type conflict is detected.
5. Write the lesson in a single transaction.
6. Create or reuse sentences by canonical sentence key.
7. Create or reuse learning items by canonical key.
8. Create exact-surface links for vocabulary, grammar, and chunks.
9. Reuse the same imported sentences for Sentence Forge drills and review states.

## Study Page Connections

- `/study/imported-content` reads the latest imported lesson from the database.
- It renders sentence text, translation, level, and tags.
- It uses the sentence-to-vocabulary, sentence-to-grammar, and sentence-to-chunk link tables to show hoverable explanations.
- Sentence Forge still reads from `drills` and `review_states`, so imported lessons can flow into the existing study queue.

## Known Limitations

- The importer currently blocks canonical item type conflicts instead of trying to merge them.
- Imported lessons are shown in a single latest-lesson demo view rather than a full lesson browser.
- Surface matching is normalized string matching, not a tokenizer-aware alignment pass.
- The demo page shows linked explanations but does not yet highlight exact spans inline inside the sentence text.

## Future Improvements

- Add tokenizer/parser support for language-specific segmentation.
- Store richer token spans so hover links can highlight exact substrings inline.
- Add overwrite mode for controlled content updates.
- Add SRS queues for standalone vocabulary, grammar, and chunk study modes.
- Add quiz generators that reuse the same canonical sentence/item/link records.
