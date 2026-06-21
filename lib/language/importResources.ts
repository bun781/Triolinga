import type { StudyLessonMeta } from "@/lib/imported-content/types";

export interface ImportGuideExample {
  title: string;
  description: string;
  json: string;
}

export interface ImportGuideSection {
  title: string;
  description: string;
  items?: string[];
  examples?: ImportGuideExample[];
}

export interface ImportPromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
}

export interface LanguageLessonGroup {
  language: string;
  label: string;
  lessons: StudyLessonMeta[];
}

const preferredLanguageOrder = ["ko", "zh", "ja", "vi"];

const languageLabels: Record<string, string> = {
  ko: "Korean",
  zh: "Chinese",
  ja: "Japanese",
  vi: "Vietnamese"
};

export const importGuideSections: ImportGuideSection[] = [
  {
    title: "Supported JSON format",
    description:
      "Each lesson is one JSON object. The importer reads the lesson metadata first, then walks each sentence and its attached vocabulary, grammar, and chunk notes."
  },
  {
    title: "Required fields",
    description: "These fields must be present for the importer to accept the file.",
    items: [
      "`language`",
      "`baseLanguage`",
      "`title`",
      "`sentences`",
      "`sentences[].text`"
    ]
  },
  {
    title: "Optional fields",
    description: "Use these to make the lesson richer, but they are not required for a valid file.",
    items: [
      "`description`",
      "`source`",
      "`level`",
      "`tags`",
      "`sentences[].translation`",
      "`sentences[].words`",
      "`sentences[].grammar`",
      "`sentences[].chunks`"
    ]
  },
  {
    title: "Examples",
    description: "Use these as a starting point for human-authored or AI-generated lesson files.",
    examples: [
      {
        title: "Minimal lesson",
        description: "The smallest valid shape: metadata plus one sentence and a translation.",
        json: `{
  "language": "ko",
  "baseLanguage": "en",
  "title": "Korean Greeting Lesson",
  "sentences": [
    {
      "text": "안녕하세요.",
      "translation": "Hello."
    }
  ]
}`
      },
      {
        title: "Annotated lesson",
        description: "A richer lesson with vocabulary, grammar, and a chunk note.",
        json: `{
  "language": "ja",
  "baseLanguage": "en",
  "title": "Japanese Beginner Lesson",
  "description": "Greetings and simple movement",
  "level": "beginner",
  "tags": ["daily", "travel"],
  "sentences": [
    {
      "text": "私は学校に行きます。",
      "translation": "I go to school.",
      "words": [
        {
          "surface": "私は",
          "lemma": "私",
          "meaning": "I / me"
        }
      ],
      "grammar": [
        {
          "pattern": "Nは",
          "surface": "私は",
          "meaning": "Topic marker"
        }
      ],
      "chunks": [
        {
          "surface": "学校に行きます",
          "meaning": "go to school",
          "explanation": "A common destination phrase."
        }
      ]
    }
  ]
}`
      }
    ]
  },
  {
    title: "Common mistakes",
    description: "These issues are the most common reasons a file is rejected.",
    items: [
      "Leaving `sentences` empty.",
      "Omitting `sentences[].text` or `title`.",
      "Using duplicate sentence text in the same lesson.",
      "Adding a `word.surface`, `grammar.surface`, or `chunk.surface` that does not appear in the sentence text.",
      "Providing JSON with trailing comments or other non-JSON syntax."
    ]
  }
];

export const importPromptTemplates: ImportPromptTemplate[] = [
  {
    id: "beginner",
    title: "Beginner lessons",
    description: "Create simple lessons with short sentences, common words, and a light annotation set.",
    prompt: `Generate one valid lesson JSON object for a beginner language lesson.

Rules:
- Return JSON only. No markdown, no code fences, no commentary.
- Use this schema: language, baseLanguage, title, description, source, level, tags, sentences.
- Include at least 3 sentences, each with translation.
- Add word annotations for useful vocabulary.
- Add grammar annotations for one beginner grammar point.
- Add chunk annotations only when a short phrase is useful for study.
- Keep every word.surface, grammar.surface, and chunk.surface present inside the sentence text.
- Do not invent database IDs or extra top-level keys.

Lesson requirements:
- language: the target language code.
- baseLanguage: the learner's base language code.
- title: a concise lesson title.
- description: one short sentence describing the lesson.
- source: "ai_generated" or another short source label.
- level: "beginner".
- tags: a short array of topic labels.

Output a fully valid JSON object that can be pasted into the lesson builder.`
  },
  {
    id: "intermediate",
    title: "Intermediate lessons",
    description: "Create longer lessons with richer grammar, more vocabulary variety, and natural examples.",
    prompt: `Generate one valid lesson JSON object for an intermediate language lesson.

Rules:
- Return JSON only. No markdown, no code fences, no commentary.
- Keep the JSON strict and valid for the lesson importer.
- Include 4 to 6 sentences that show a mix of declarative, question, and polite forms.
- Add vocabulary annotations for non-trivial words or expressions.
- Add grammar annotations for patterns worth studying.
- Add chunk annotations for reusable phrases, clauses, or collocations.
- Avoid duplicate sentences and avoid duplicate learning-item surfaces unless they serve a real study purpose.
- Keep all annotated surfaces visible in the sentence text.
- Do not include any field that is not part of the lesson schema.

Lesson requirements:
- language: the target language code.
- baseLanguage: the learner's base language code.
- title: a focused lesson title.
- description: a short summary of the topic.
- source: a short source label such as "ai_generated".
- level: "intermediate".
- tags: topic labels such as travel, work, conversation, or culture.

Output a single JSON object that the importer can validate directly.`
  },
  {
    id: "vocabulary",
    title: "Vocabulary lists",
    description: "Build lessons around grouped vocabulary with short example sentences for each cluster.",
    prompt: `Generate one valid lesson JSON object for a vocabulary-focused lesson.

Rules:
- Return JSON only. No markdown, no code fences, no commentary.
- Organize the lesson around themed vocabulary groups.
- Include at least 3 sentences, and make each sentence demonstrate the vocabulary in context.
- Add one or more word annotations per sentence.
- Add chunk annotations when a short phrase helps memory.
- Use grammar annotations only if they support the vocabulary example naturally.
- Keep the sentence text, translations, and annotations aligned.

Lesson requirements:
- language: the target language code.
- baseLanguage: the learner's base language code.
- title: a lesson title that names the vocabulary theme.
- description: a short description of the word set.
- source: a short source label such as "ai_generated".
- level: "beginner" or "intermediate" depending on the difficulty.
- tags: labels for the topic and word family.

Output a lesson JSON object that the importer can save without edits.`
  },
  {
    id: "grammar",
    title: "Grammar lessons",
    description: "Generate lessons that center on one grammar point with clear examples and explanation notes.",
    prompt: `Generate one valid lesson JSON object for a grammar-focused lesson.

Rules:
- Return JSON only. No markdown, no code fences, no commentary.
- Focus the lesson on a single grammar pattern or a tightly related set of patterns.
- Include at least 3 sentences that clearly show the grammar point in context.
- Add grammar annotations on the exact pattern or surface form.
- Add vocabulary annotations for key words that support the explanation.
- Add chunk annotations for reusable clauses or expressions when helpful.
- Keep explanations short, practical, and learner-friendly.

Lesson requirements:
- language: the target language code.
- baseLanguage: the learner's base language code.
- title: a lesson title that names the grammar point.
- description: a short explanation of what the lesson teaches.
- source: a short source label such as "ai_generated".
- level: "beginner" or "intermediate".
- tags: topic labels plus the grammar theme.

Output a valid JSON object that matches the lesson importer schema exactly.`
  }
];

export function formatLanguageLabel(language: string): string {
  return languageLabels[language.toLowerCase()] ?? language.toUpperCase();
}

export function groupLessonsByLanguage(lessons: StudyLessonMeta[]): LanguageLessonGroup[] {
  const groups = new Map<string, StudyLessonMeta[]>();

  for (const lesson of lessons) {
    const existing = groups.get(lesson.language);
    if (existing) {
      existing.push(lesson);
    } else {
      groups.set(lesson.language, [lesson]);
    }
  }

  return [...groups.entries()]
    .map(([language, groupedLessons]) => ({
      language,
      label: formatLanguageLabel(language),
      lessons: groupedLessons
    }))
    .sort((a, b) => compareLanguages(a.language, b.language) || a.label.localeCompare(b.label));
}

function compareLanguages(a: string, b: string): number {
  const aRank = preferredLanguageOrder.indexOf(a.toLowerCase());
  const bRank = preferredLanguageOrder.indexOf(b.toLowerCase());

  if (aRank !== -1 || bRank !== -1) {
    const normalizedARank = aRank === -1 ? Number.POSITIVE_INFINITY : aRank;
    const normalizedBRank = bRank === -1 ? Number.POSITIVE_INFINITY : bRank;
    return normalizedARank - normalizedBRank;
  }

  return a.localeCompare(b);
}
