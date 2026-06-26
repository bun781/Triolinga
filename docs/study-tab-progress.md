# Study Tab Progress Persistence

## What changed

Study progress no longer resets when moving between the Flashcards, Fill Blank, and Multiple Choice tabs. Each mode saves its in-progress state to `sessionStorage` and restores it when the tab remounts.

## How it works

`components/imported-content/sessionProgress.ts` centralizes safe reads and writes:

* All keys share the `fydor.study-progress` prefix.
* JSON parsing failures are ignored.
* Storage failures do not block the study UI.

Each study mode validates saved data before using it:

* Flashcards restores card index, card order, reveal state, random order, grades, review marks, and session familiarity.
* Fill Blank restores selected lessons, test setup, active deck, current question, answers, submitted cards, score, and completion state.
* Multiple Choice restores selected lessons, test setup, active deck, current question, answers, submitted cards, score, and completion state.

The lesson browser also stores the selected lesson id, so switching tabs keeps the same lesson context.

## Files

* `components/imported-content/sessionProgress.ts`
* `components/imported-content/useImportedLessonBrowser.ts`
* `components/imported-content/ImportedContentStudy.tsx`
* `components/imported-content/FillBlankMode.tsx`
* `components/imported-content/MultipleChoiceMode.tsx`
* `components/imported-content/ImportedContentWorkspace.tsx`

## Verification

Ran:

```bash
npm run typecheck
```

The progress fix was committed as `b5bc084 Persist study tab progress`.
