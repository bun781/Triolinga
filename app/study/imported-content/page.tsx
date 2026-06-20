import { AppShell } from "@/components/AppShell";
import { InteractiveSentence } from "@/components/language/InteractiveSentence";
import { getLatestImportedLessonContent } from "@/lib/language/importedContent";

export const dynamic = "force-dynamic";

export default async function ImportedContentPage() {
  const content = await getLatestImportedLessonContent();

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Imported Content</h1>
          <p className="muted">A live view of the latest imported lesson and the records that now power study pages.</p>
        </div>
      </div>

      {!content ? (
        <section className="card">
          <p className="muted">No imported lesson yet.</p>
        </section>
      ) : (
        <div className="stack">
          <section className="card stack">
            <div className="row">
              <div>
                <h2>{content.lesson.title}</h2>
                <p className="muted">
                  {content.lesson.language.toUpperCase()} to {content.lesson.baseLanguage.toUpperCase()}
                </p>
              </div>
              <span className="pill">{content.lesson.level ?? "Lesson"}</span>
            </div>
            {content.lesson.description ? <p>{content.lesson.description}</p> : null}
            {content.lesson.tags.length ? <p className="muted">Tags: {content.lesson.tags.join(", ")}</p> : null}
          </section>

          {content.sentences.map((sentence, index) => (
            <article className="card stack" key={sentence.id}>
              <div className="row">
                <span className="pill">Sentence {index + 1}</span>
                <span className="muted">Imported from canonical content</span>
              </div>
              <p className="sentence-text">{sentence.text}</p>
              <p className="muted">{sentence.translation}</p>

              <section className="stack">
                <h3>Vocabulary</h3>
                <InteractiveSentence sentence={sentence.text} tokens={sentence.words.map((word) => ({
                  id: `${sentence.id}:${word.canonicalKey ?? word.surface}`,
                  text: word.surface,
                  meaning: word.meaning ?? null,
                  explanation: word.explanation ?? null,
                  canonicalKey: word.canonicalKey ?? null
                }))} />
              </section>

              <section className="stack">
                <h3>Grammar</h3>
                <InteractiveSentence sentence={sentence.text} tokens={sentence.grammar.map((grammar) => ({
                  id: `${sentence.id}:${grammar.surfaceText}`,
                  text: grammar.surfaceText,
                  meaning: grammar.pattern,
                  explanation: grammar.explanation ?? null,
                  canonicalKey: grammar.pattern
                }))} />
              </section>

              <section className="stack">
                <h3>Chunks</h3>
                <InteractiveSentence sentence={sentence.text} tokens={sentence.chunks.map((chunk) => ({
                  id: `${sentence.id}:${chunk.surfaceText}`,
                  text: chunk.surfaceText,
                  meaning: chunk.meaning ?? null,
                  explanation: chunk.explanation ?? null,
                  canonicalKey: chunk.type ?? null
                }))} />
              </section>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}

