# Lesson Import System

This document is a handoff guide for future agents working on the lesson import pipeline.

## Purpose

The importer is the canonical content-ingestion path for:

- vocabulary
- grammar
- chunks and expressions
- sentences
- hover explanations
- future SRS and reviews
- future quizzes

Imported content must feed the real learning system. It is not allowed to live in import-only tables.

## Entry Points

- Admin import UI: `/admin/imports`
- Legacy redirect: `/lessons/import`
- Preview API: `POST /api/lessons/import/preview`
- Import API: `POST /api/lessons/import`
- Imported content demo page: `/study/imported-content`

## JSON Contract

Required fields:

- `language`
- `baseLanguage`
- `sentences`
- `sentences[].text`

Optional fields:

- `title`
- `description`
- `source`
- `level`
- `tags`
- `sentences[].translation`
- `sentences[].words`
- `sentences[].grammar`
- `sentences[].chunks`

Validation rules:

- Reject malformed JSON.
- Reject empty lessons.
- Reject duplicate sentence text inside one lesson.
- `word.surface` is required if a word entry exists.
- `grammar.pattern` is required if a grammar entry exists.
- `chunk.surface` is required if a chunk entry exists.
- If `word.surface`, `grammar.surface`, or `chunk.surface` is provided, it must appear in `sentence.text`.
- Revalidate server-side before preview and import.

## Canonical Keys

The app derives all canonical keys. Import files never provide database IDs.

- Sentence key: `language + normalized sentence text`
- Vocabulary key: `language + normalized lemma if present, else normalized surface`
- Grammar key: `language + normalized pattern`
- Chunk key: `language + normalized surface`

Normalization lives in `lib/language/normalize.ts`.

## Database Model

Reused tables:

- `lessons`
- `sentences`
- `learning_items`
- `drills`
- `review_states`
- `sentence_review_attempts`

Import-specific additions:

- `lesson_sentences`
- `sentence_vocabulary_links`
- `sentence_grammar_links`
- `sentence_chunk_links`

Schema lives in `db/schema.ts`.
Migration lives in `db/migrations/0002_lesson_import.sql`.

## Import Flow

The server-side flow is:

1. Parse JSON in `lib/language/importSchema.ts`.
2. Validate required fields and surface checks.
3. Build a preview in `lib/language/importLesson.ts`.
4. Compare against existing lessons, sentences, and learning items.
5. Block imports if there is a canonical item type conflict.
6. Write everything in a single transaction.
7. Create or reuse sentences by canonical sentence key.
8. Create or reuse learning items by canonical key.
9. Create exact-surface sentence links.
10. Create drills and review states for Sentence Forge.

Important behavior:

- Existing meanings and explanations are never overwritten.
- Missing meaning or explanation fields may be filled in.
- Duplicate links are suppressed.
- Transaction rollback should leave the database unchanged on error.

## How Study Pages Consume Imported Data

### Sentence Forge

`lib/language/studyQueue.ts` reads `drills`, `review_states`, `sentences`, `sentence_tokens`, and `learning_items`.

Imported lessons become available to Sentence Forge because import creates the same drill and review records that the queue expects.

### Imported Content Demo

`lib/language/importedContent.ts` reads the latest lesson from:

- `lessons`
- `lesson_sentences`
- `sentences`
- `sentence_vocabulary_links`
- `sentence_grammar_links`
- `sentence_chunk_links`
- `learning_items`

The demo page at `/study/imported-content` renders:

- sentence text
- translation
- level and tags
- hoverable vocabulary
- grammar explanations
- chunk explanations

## UI Behavior

The admin page at `/admin/imports` supports:

- paste JSON
- upload JSON file
- load sample JSON
- validate
- preview
- import
- import summary

Preview shows:

- lesson title
- language and base language
- level and tags
- sentence count
- sentence text and translation
- words
- grammar
- chunks
- validation errors

## Tests

Core tests live in `tests/unit/language-import.test.ts` and cover:

- valid import
- malformed JSON
- duplicate sentence text
- surface mismatches
- vocabulary deduplication
- grammar deduplication
- chunk deduplication
- duplicate links
- rollback on failure

## Extension Points

If you need to extend the importer, these are the main files:

- validation: `lib/language/importSchema.ts`
- normalization and keys: `lib/language/normalize.ts`
- persistence and preview: `lib/language/importLesson.ts`
- content readback: `lib/language/importedContent.ts`
- admin UI: `app/admin/imports/page.tsx`
- demo reader: `app/study/imported-content/page.tsx`

## Known Limitations

- Surface matching is normalized string matching, not a tokenizer-aware parser.
- The demo reader shows the latest imported lesson only.
- The importer blocks canonical type conflicts instead of merging them.
- Overwrite mode is not implemented yet.

## Good Next Steps

- Add tokenizer or span-aware parsing for better hover highlighting.
- Add a full lesson browser instead of only the latest imported lesson demo.
- Add overwrite mode for controlled updates.
- Add vocabulary, grammar, and chunk-specific SRS queues.
- Reuse the same canonical records for quiz generation.

