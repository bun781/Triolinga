export interface StudyLessonMeta {
  id: string;
  language: string;
  baseLanguage: string;
  title: string;
  description: string | null;
  level: string | null;
  tags: string[];
  sentenceCount: number;
}

export interface StudyWord {
  surface: string;
  displayText: string;
  meaning: string | null;
  explanation: string | null;
  commonMistakes: string[];
  canonicalKey: string;
}

export interface StudyGrammar {
  surfaceText: string;
  pattern: string;
  meaning: string | null;
  explanation: string | null;
  commonMistakes: string[];
  canonicalKey: string;
}

export interface StudyChunk {
  surfaceText: string;
  meaning: string | null;
  explanation: string | null;
  canonicalKey: string;
}

export interface StudySentence {
  id: string;
  text: string;
  translation: string;
  audioUrl: string | null;
  words: StudyWord[];
  grammar: StudyGrammar[];
  chunks: StudyChunk[];
}

export interface StudyLesson {
  id: string;
  language: string;
  baseLanguage: string;
  title: string;
  description: string | null;
  level: string | null;
  tags: string[];
  sentences: StudySentence[];
}

export type SelectedItem =
  | { kind: "word"; data: StudyWord }
  | { kind: "grammar"; data: StudyGrammar }
  | { kind: "chunk"; data: StudyChunk };

export interface RevealState {
  translation: boolean;
  wordMeanings: boolean;
  grammar: boolean;
  hint: boolean;
}

export type ItemFamiliarity = "known" | "learning";

export interface QuizQuestion {
  type: "multiple-choice" | "fill-blank";
  prompt: string;
  options?: string[];
  answer: string;
  sentenceId: string;
  focusType?: "word" | "sentence";
  focusText?: string;
}
