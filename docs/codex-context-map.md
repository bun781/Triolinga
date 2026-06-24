# Codex Context Map

This repo is organized into small, labeled units so Codex can load only the slice that matters for the task.

## Load Order

1. `README.md` for product shape and local setup.
2. This file for chunk boundaries.
3. The smallest feature chunk that matches the request.

## Chunk Labels

### `chunk:web-shell`

- [app/layout.tsx](/Users/user/Habitz/app/layout.tsx)
- [components/AppShell.tsx](/Users/user/Habitz/components/AppShell.tsx)
- [app/page.tsx](/Users/user/Habitz/app/page.tsx)
- [app/global-error.tsx](/Users/user/Habitz/app/global-error.tsx)
- [app/error.tsx](/Users/user/Habitz/app/error.tsx)

### `chunk:lesson-import-ui`

- [app/admin/imports/page.tsx](/Users/user/Habitz/app/admin/imports/page.tsx)
- [components/admin-imports/LessonImportsPage.tsx](/Users/user/Habitz/components/admin-imports/LessonImportsPage.tsx)
- [components/admin-imports/LanguageField.tsx](/Users/user/Habitz/components/admin-imports/LanguageField.tsx)
- [components/admin-imports/lesson-import-utils.ts](/Users/user/Habitz/components/admin-imports/lesson-import-utils.ts)
- [components/language/ImportHelpPanel.tsx](/Users/user/Habitz/components/language/ImportHelpPanel.tsx)
- [components/language/ImportPreview.tsx](/Users/user/Habitz/components/language/ImportPreview.tsx)

### `chunk:imported-content-study`

- [app/study/imported-content/page.tsx](/Users/user/Habitz/app/study/imported-content/page.tsx)
- [components/imported-content/ImportedContentWorkspace.tsx](/Users/user/Habitz/components/imported-content/ImportedContentWorkspace.tsx)
- [components/imported-content/ImportedContentStudy.tsx](/Users/user/Habitz/components/imported-content/ImportedContentStudy.tsx)
- [components/imported-content/SentenceFlashcard.tsx](/Users/user/Habitz/components/imported-content/SentenceFlashcard.tsx)
- [components/imported-content/AnnotatedSentence.tsx](/Users/user/Habitz/components/imported-content/AnnotatedSentence.tsx)
- [components/imported-content/FillBlankMode.tsx](/Users/user/Habitz/components/imported-content/FillBlankMode.tsx)
- [components/imported-content/MultipleChoiceMode.tsx](/Users/user/Habitz/components/imported-content/MultipleChoiceMode.tsx)

### `chunk:review-system`

- [app/review/page.tsx](/Users/user/Habitz/app/review/page.tsx)
- [components/review/ReviewDeck.tsx](/Users/user/Habitz/components/review/ReviewDeck.tsx)
- [components/review/ReviewControls.tsx](/Users/user/Habitz/components/review/ReviewControls.tsx)
- [components/review/ReviewSentenceCard.tsx](/Users/user/Habitz/components/review/ReviewSentenceCard.tsx)
- [lib/review/algorithm.ts](/Users/user/Habitz/lib/review/algorithm.ts)
- [lib/review/useReviewDeck.ts](/Users/user/Habitz/lib/review/useReviewDeck.ts)
- [lib/review/useLessonReview.ts](/Users/user/Habitz/lib/review/useLessonReview.ts)

### `chunk:language-import-core`

- [lib/language/importLesson.ts](/Users/user/Habitz/lib/language/importLesson.ts)
- [lib/language/importSchema.ts](/Users/user/Habitz/lib/language/importSchema.ts)
- [lib/language/importResources.ts](/Users/user/Habitz/lib/language/importResources.ts)
- [lib/language/importedContent.ts](/Users/user/Habitz/lib/language/importedContent.ts)
- [lib/language/normalize.ts](/Users/user/Habitz/lib/language/normalize.ts)
- [lib/language/types.ts](/Users/user/Habitz/lib/language/types.ts)

### `chunk:speech`

- [lib/speech/speechService.ts](/Users/user/Habitz/lib/speech/speechService.ts)
- [lib/speech/useSpeechService.ts](/Users/user/Habitz/lib/speech/useSpeechService.ts)
- [lib/speech/useSpeechPlayback.ts](/Users/user/Habitz/lib/speech/useSpeechPlayback.ts)
- [lib/speech/speechPlayback.ts](/Users/user/Habitz/lib/speech/speechPlayback.ts)
- [lib/useSpeech.ts](/Users/user/Habitz/lib/useSpeech.ts)
- [components/ui/AudioButton.tsx](/Users/user/Habitz/components/ui/AudioButton.tsx)

### `chunk:tauri-lessons`

- [src-tauri/src/lessons/mod.rs](/Users/user/Habitz/src-tauri/src/lessons/mod.rs)
- [src-tauri/src/models.rs](/Users/user/Habitz/src-tauri/src/models.rs)
- [src-tauri/src/db.rs](/Users/user/Habitz/src-tauri/src/db.rs)
- [src-tauri/src/normalize.rs](/Users/user/Habitz/src-tauri/src/normalize.rs)

### `chunk:tests`

- [tests/unit/language-import.test.ts](/Users/user/Habitz/tests/unit/language-import.test.ts)
- [tests/unit/import-resources.test.tsx](/Users/user/Habitz/tests/unit/import-resources.test.tsx)
- [tests/unit/review.test.ts](/Users/user/Habitz/tests/unit/review.test.ts)
- [tests/unit/speech.test.tsx](/Users/user/Habitz/tests/unit/speech.test.tsx)
- [tests/unit/multiple-choice.test.ts](/Users/user/Habitz/tests/unit/multiple-choice.test.ts)
- [tests/unit/fill-blank.test.ts](/Users/user/Habitz/tests/unit/fill-blank.test.ts)
- [tests/unit/annotated-sentence.test.ts](/Users/user/Habitz/tests/unit/annotated-sentence.test.ts)

## Notes

- Load one chunk at a time unless a change crosses a boundary.
- Prefer the smallest helper file before the larger page or backend module.
- The admin import flow now has explicit helper chunks so the editor logic is easier to isolate.
