# Annotated Sentence Highlighting in Lesson Library

When the translation is revealed on a flashcard, the sentence text switches from plain text to an annotated view. Each annotated span is colored by kind and shows a tooltip on hover.

---

## How it works

### 1. Data source

Annotations are stored in the database as `sentenceVocabularyLinks`, `sentenceGrammarLinks`, and `sentenceChunkLinks` rows. These are loaded into the `StudySentence` type at query time:

```ts
interface StudySentence {
  text: string;
  words: StudyWord[];    // surface, displayText, meaning, explanation
  grammar: StudyGrammar[]; // surfaceText, pattern, meaning, explanation
  chunks: StudyChunk[];  // surfaceText, meaning, explanation
}
```

Each annotation carries a `surface` (or `surfaceText`) string — the exact substring of the sentence where it appears — and optional `meaning` / `explanation` fields used in the tooltip.

### 2. Building annotation ranges

`buildRuns()` in `AnnotatedSentence.tsx` converts the sentence into a flat list of display runs:

1. **Find ranges** — for each word, grammar rule, and chunk, `indexOf(surface)` locates the start position in the sentence string. The end is `start + surface.length`.

2. **Resolve priority** — a character may fall inside multiple overlapping annotations. Priority is `word > grammar > chunk`, matching the lesson builder's behavior. A per-character map (`charMap`) stores the winning `AnnotationRange` for each index.

3. **Group into runs** — consecutive characters that share the same `AnnotationRange` object (by reference) form a single annotated run. Gaps between annotations form plain-text runs.

```
"나는 학교에 가요"
 ^^^^             → word (나는)
       ^^^^^^     → chunk (학교에)
              ^^  → grammar (가요)
```

Result: `[annotated("나는"), plain(" "), annotated("학교에"), plain(" "), annotated("가요")]`

### 3. Rendering

`AnnotatedSentence` renders the runs inside a `<p className="sentence-text">`:

- **Plain runs** → bare `<span>`
- **Annotated runs** → a CSS-hover tooltip structure using `<span>` elements so the markup stays valid inside `<p>`:

```html
<span class="tooltip-wrap tooltip-bottom sentence-annotated-wrap">
  <span class="annotated-{kind} sentence-annotated" aria-describedby="…">
    {text}
  </span>
  <span class="tooltip-bubble" role="tooltip">
    <span class="tooltip-stack">
      <strong>{displayText}</strong>
      <span>{meaning}</span>
      <span class="muted">{explanation}</span>
    </span>
  </span>
</span>
```

The tooltip is shown/hidden entirely via CSS (`.tooltip-wrap:hover .tooltip-bubble { opacity: 1 }`), so no JS event handlers are needed.

### 4. Color coding

Reuses the same CSS variables and classes as the lesson builder:

| Kind    | Class              | Color variable  |
|---------|--------------------|-----------------|
| word    | `.annotated-word`  | `--word` (blue) |
| grammar | `.annotated-grammar` | `--grammar` (purple) |
| chunk   | `.annotated-chunk` | `--chunk` (green) |

Each class applies a tinted background (`--{kind}-bg`) and a solid bottom border.

### 5. Trigger

In `SentenceFlashcard.tsx`, the sentence line conditionally renders:

```tsx
{reveal.translation ? (
  <AnnotatedSentence sentence={sentence} />
) : (
  <p className="sentence-text">{sentence.text}</p>
)}
```

The switch happens the moment `reveal.translation` becomes `true` (user clicks the translation area or the Reveal button).

---

## Key files

| File | Role |
|------|------|
| `components/imported-content/AnnotatedSentence.tsx` | Run-building logic and annotated render |
| `components/imported-content/SentenceFlashcard.tsx` | Conditional render trigger |
| `app/globals.css` | `.sentence-annotated`, `.sentence-annotated-wrap` additions; shared `.annotated-*` and `.tooltip-*` classes |
| `lib/imported-content/types.ts` | `StudySentence`, `StudyWord`, `StudyGrammar`, `StudyChunk` interfaces |
