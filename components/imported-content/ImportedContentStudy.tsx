"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ItemFamiliarity,
  RevealState,
  StudyLesson,
  StudyLessonMeta
} from "@/lib/imported-content/types";
import { formatLanguageLabel, groupLessonsByLanguage } from "@/lib/language/importResources";
import { CheckpointQuiz } from "./CheckpointQuiz";
import { SentenceFlashcard } from "./SentenceFlashcard";

interface Props {
  lesson: StudyLesson | null;
  allLessons: StudyLessonMeta[];
}

const DEFAULT_REVEAL: RevealState = {
  translation: false,
  wordMeanings: false,
  grammar: false,
  hint: false
};

export function ImportedContentStudy({ lesson: initialLesson, allLessons }: Props) {
  const [lesson, setLesson] = useState(initialLesson);
  const [selectedLanguage, setSelectedLanguage] = useState(initialLesson?.language ?? allLessons[0]?.language ?? "");
  const [cardIndex, setCardIndex] = useState(0);
  const [quizPendingAt, setQuizPendingAt] = useState<number | null>(null);
  const [reveal, setReveal] = useState<RevealState>(DEFAULT_REVEAL);
  const [sessionFamiliarity, setSessionFamiliarity] = useState<Map<string, ItemFamiliarity>>(new Map());
  const [cardGrades, setCardGrades] = useState<Map<number, string>>(new Map());
  const [loadingLesson, setLoadingLesson] = useState(false);
  const languageGroups = groupLessonsByLanguage(allLessons);

  const sentence = lesson?.sentences[cardIndex] ?? null;
  const total = lesson?.sentences.length ?? 0;
  const activeLanguageGroup = languageGroups.find((group) => group.language === selectedLanguage) ?? languageGroups[0] ?? null;
  const languageLessons = activeLanguageGroup?.lessons ?? [];

  const handlePrev = useCallback(() => {
    setCardIndex((i) => Math.max(0, i - 1));
    setReveal(DEFAULT_REVEAL);
  }, []);

  const handleNext = useCallback(() => {
    const next = cardIndex + 1;
    if (next >= total) return;
    // Checkpoint quiz after every 5 cards
    if (next % 5 === 0) {
      setQuizPendingAt(next);
      return;
    }
    setCardIndex(next);
    setReveal(DEFAULT_REVEAL);
  }, [cardIndex, total]);

  const handleQuizDone = useCallback(() => {
    const nextIdx = quizPendingAt ?? cardIndex + 1;
    setQuizPendingAt(null);
    setCardIndex(nextIdx);
    setReveal(DEFAULT_REVEAL);
  }, [quizPendingAt, cardIndex]);

  const handleRevealTranslation = useCallback(() => {
    setReveal((r) => ({ ...r, translation: true }));
  }, []);

  const handleToggleWordMeanings = useCallback(() => {
    setReveal((r) => ({ ...r, wordMeanings: !r.wordMeanings }));
  }, []);

  const handleToggleGrammar = useCallback(() => {
    setReveal((r) => ({ ...r, grammar: !r.grammar }));
  }, []);

  const handleToggleHint = useCallback(() => {
    setReveal((r) => ({ ...r, hint: !r.hint }));
  }, []);

  const handleGrade = useCallback(
    (grade: "easy" | "correct" | "hard" | "failed") => {
      if (!sentence) return;
      setCardGrades((prev) => new Map(prev).set(cardIndex, grade));

      // Update session familiarity for all items in the sentence
      const familiarity: ItemFamiliarity =
        grade === "easy" || grade === "correct" ? "known" : "learning";

      setSessionFamiliarity((prev) => {
        const next = new Map(prev);
        for (const w of sentence.words) next.set(w.canonicalKey, familiarity);
        for (const g of sentence.grammar) next.set(g.canonicalKey, familiarity);
        for (const c of sentence.chunks) next.set(c.canonicalKey, familiarity);
        return next;
      });
    },
    [cardIndex, sentence]
  );

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case "ArrowLeft":
          handlePrev();
          break;
        case "ArrowRight":
          handleNext();
          break;
        case " ":
          e.preventDefault();
          handleRevealTranslation();
          break;
        case "h":
        case "H":
          handleToggleHint();
          break;
        case "w":
        case "W":
          handleToggleWordMeanings();
          break;
        case "g":
        case "G":
          handleToggleGrammar();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePrev, handleNext, handleRevealTranslation, handleToggleHint, handleToggleWordMeanings, handleToggleGrammar]);

  async function switchLesson(lessonId: string) {
    setLoadingLesson(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}`);
      const data = (await res.json()) as { lesson: StudyLesson | null };
      if (data.lesson) {
        setLesson(data.lesson);
        setSelectedLanguage(data.lesson.language);
        setCardIndex(0);
        setQuizPendingAt(null);
        setReveal(DEFAULT_REVEAL);
        setSessionFamiliarity(new Map());
        setCardGrades(new Map());
      }
    } finally {
      setLoadingLesson(false);
    }
  }

  if (!lesson) {
    return (
      <section className="card stack">
        <p className="muted">No lessons yet. Save a lesson to start studying.</p>
      </section>
    );
  }

  const recentSentences = lesson.sentences.slice(Math.max(0, cardIndex - 4), cardIndex + 1);

  return (
    <div className="study-shell stack">
      {languageGroups.length > 1 ? (
        <section className="card stack language-browser">
          <div className="row">
            <div>
              <h2>Languages</h2>
              <p className="muted">Browse saved lessons by target language.</p>
            </div>
            <span className="pill">{languageGroups.length} languages</span>
          </div>
          <div className="language-tabs">
            {languageGroups.map((group) => (
              <button
                className={group.language === selectedLanguage ? "active" : ""}
                key={group.language}
                type="button"
                disabled={loadingLesson}
                onClick={() => {
                  const nextLesson = group.lessons[0];
                  if (!nextLesson) return;
                  void switchLesson(nextLesson.id);
                }}
              >
                <span>{group.label}</span>
                <small>{group.lessons.length}</small>
              </button>
            ))}
          </div>
          {languageLessons.length > 1 ? (
            <select
              className="input"
              value={lesson.id}
              disabled={loadingLesson}
              onChange={(e) => void switchLesson(e.target.value)}
            >
              {languageLessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} ({l.sentenceCount} cards)
                </option>
              ))}
            </select>
          ) : null}
        </section>
      ) : null}

      {quizPendingAt !== null ? (
        <CheckpointQuiz
          sentences={recentSentences}
          allSentences={lesson.sentences}
          onComplete={handleQuizDone}
        />
      ) : sentence ? (
        <SentenceFlashcard
          key={`${lesson.id}:${cardIndex}`}
          sentence={sentence}
          cardIndex={cardIndex}
          totalCards={total}
          lessonTitle={lesson.title}
          language={lesson.language}
          allSentences={lesson.sentences}
          reveal={reveal}
          sessionFamiliarity={sessionFamiliarity}
          currentGrade={cardGrades.get(cardIndex) ?? null}
          onRevealTranslation={handleRevealTranslation}
          onToggleWordMeanings={handleToggleWordMeanings}
          onToggleGrammar={handleToggleGrammar}
          onToggleHint={handleToggleHint}
          onGrade={handleGrade}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      ) : null}
    </div>
  );
}
