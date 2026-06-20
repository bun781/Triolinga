import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateSentenceForgeDrills } from "@/lib/language/generateDrills";
import { parseLessonJson } from "@/lib/language/importSchema";
import { buildCanonicalKey, normalizeSentenceText } from "@/lib/language/normalize";
import { scheduleSentenceReview } from "@/lib/language/srs";
import {
  lessonSentences,
  learningItems,
  lessons,
  reviewStates,
  sentenceChunkLinks,
  sentenceGrammarLinks,
  sentenceVocabularyLinks,
  sentences,
  drills
} from "@/db/schema";

const mockDb: MockDb = createMockDb(createStore());
vi.mock("@/lib/server/db", () => ({ db: mockDb }));

const importLessonModule = await import("@/lib/language/importLesson");
const { importApprovedLesson, buildImportPreview } = importLessonModule;

beforeEach(() => {
  mockDb.resetStore(createStore());
});

describe("lesson import validation", () => {
  it("parses a valid lesson and builds a preview", async () => {
    const lesson = buildLesson([
      {
        text: "저는 학교에 갑니다.",
        translation: "I go to school.",
        words: [{ surface: "저는", lemma: "저", meaning: "I / me", role: "topic-marked pronoun" }],
        grammar: [{ pattern: "N은/는", surface: "저는", meaning: "Topic marker" }],
        chunks: [{ surface: "학교에 갑니다", meaning: "go to school", type: "phrase" }]
      }
    ]);

    const parsed = parseLessonJson(JSON.stringify(lesson));
    expect(parsed.errors).toEqual([]);
    expect(parsed.lesson?.title).toBe("Beginner Korean Lesson 1");

    const preview = await buildImportPreview(parsed.lesson!);
    expect(preview.lesson.title).toBe("Beginner Korean Lesson 1");
    expect(preview.sentenceCount).toBe(1);
    expect(preview.vocabulary).toHaveLength(1);
    expect(preview.grammar).toHaveLength(1);
    expect(preview.chunks).toHaveLength(1);

    const summary = await importApprovedLesson(parsed.lesson!);
    expect(summary).toEqual({
      lessonCreated: true,
      sentencesImported: 1,
      sentencesSkipped: 0,
      vocabularyCreated: 1,
      vocabularyReused: 0,
      grammarCreated: 1,
      grammarReused: 0,
      chunksCreated: 1,
      chunksReused: 0,
      linksCreated: 4,
      errors: []
    });
  });

  it("rejects malformed json", () => {
    expect(parseLessonJson("{")).toEqual({ errors: ["Invalid JSON."] });
  });

  it("rejects duplicate sentence text", () => {
    const lesson = buildLesson([
      { text: "안녕하세요.", translation: "Hello." },
      { text: "안녕하세요.", translation: "Hello again." }
    ]);

    const parsed = parseLessonJson(JSON.stringify(lesson));
    expect(parsed.errors).toContain("Duplicate sentence text at sentence 2.");
  });

  it("rejects surface mismatches", () => {
    const lesson = buildLesson([
      {
        text: "저는 학교에 갑니다.",
        translation: "I go to school.",
        words: [{ surface: "오류", lemma: "오류" }],
        grammar: [{ pattern: "N은/는", surface: "없음" }],
        chunks: [{ surface: "없음" }]
      }
    ]);

    const parsed = parseLessonJson(JSON.stringify(lesson));
    expect(parsed.errors).toEqual([
      'Sentence 1: word surface "오류" does not appear in the sentence.',
      'Sentence 1: grammar surface "없음" does not appear in the sentence.',
      'Sentence 1: chunk surface "없음" does not appear in the sentence.'
    ]);
  });

  it("deduplicates vocabulary across sentences", async () => {
    const lesson = buildLesson([
      {
        text: "저는 학교에 갑니다.",
        translation: "I go to school.",
        words: [{ surface: "저는", lemma: "저", meaning: "I / me" }]
      },
      {
        text: "저도 갑니다.",
        translation: "I also go.",
        words: [{ surface: "저도", lemma: "저", meaning: "I / me" }]
      }
    ]);

    const summary = await importApprovedLesson(parseLessonJson(JSON.stringify(lesson)).lesson!);
    expect(summary.vocabularyCreated).toBe(1);
    expect(summary.vocabularyReused).toBe(1);
  });

  it("deduplicates grammar patterns across sentences", async () => {
    const lesson = buildLesson([
      {
        text: "저는 학교에 갑니다.",
        translation: "I go to school.",
        grammar: [{ pattern: "N은/는", surface: "저는", meaning: "Topic marker" }]
      },
      {
        text: "나는 시장에 갑니다.",
        translation: "I go to the market.",
        grammar: [{ pattern: "N은/는", surface: "나는", meaning: "Topic marker" }]
      }
    ]);

    const summary = await importApprovedLesson(parseLessonJson(JSON.stringify(lesson)).lesson!);
    expect(summary.grammarCreated).toBe(1);
    expect(summary.grammarReused).toBe(1);
  });

  it("deduplicates chunks across sentences", async () => {
    const lesson = buildLesson([
      {
        text: "저는 학교에 갑니다.",
        translation: "I go to school.",
        chunks: [{ surface: "학교에 갑니다", meaning: "go to school" }]
      },
      {
        text: "그는 학교에 갑니다.",
        translation: "He goes to school.",
        chunks: [{ surface: "학교에 갑니다", meaning: "go to school" }]
      }
    ]);

    const summary = await importApprovedLesson(parseLessonJson(JSON.stringify(lesson)).lesson!);
    expect(summary.chunksCreated).toBe(1);
    expect(summary.chunksReused).toBe(1);
  });

  it("skips duplicate links for repeated surfaces", async () => {
    const lesson = buildLesson([
      {
        text: "저는 저를 좋아합니다.",
        translation: "I like myself.",
        words: [
          { surface: "저", lemma: "저", meaning: "I / me" },
          { surface: "저", lemma: "저", meaning: "I / me" }
        ]
      }
    ]);

    await importApprovedLesson(parseLessonJson(JSON.stringify(lesson)).lesson!);
    expect(mockDb.store.sentenceVocabularyLinks).toHaveLength(1);
  });

  it("rolls back the transaction on failure", async () => {
    const failingStore = createStore();
    mockDb.resetStore(failingStore, { failOnInsertTable: sentenceChunkLinks });

    const lesson = buildLesson([
      {
        text: "저는 학교에 갑니다.",
        translation: "I go to school.",
        words: [{ surface: "저는", lemma: "저", meaning: "I / me" }],
        chunks: [{ surface: "학교에 갑니다", meaning: "go to school" }]
      }
    ]);

    await expect(importApprovedLesson(parseLessonJson(JSON.stringify(lesson)).lesson!)).rejects.toThrow("Simulated insert failure.");
    expect(failingStore.lessons).toHaveLength(0);
    expect(failingStore.sentences).toHaveLength(0);
    expect(failingStore.learningItems).toHaveLength(0);
    expect(failingStore.lessonSentences).toHaveLength(0);
  });
});

describe("sentence forge generation", () => {
  it("creates the required five drills for a sentence", () => {
    const drills = generateSentenceForgeDrills({
      text: "寿司を食べたい。",
      translation: "I want to eat sushi.",
      words: [{ surface: "寿司" }],
      chunks: [{ surface: "食べたい" }]
    });

    expect(drills.map((drill) => drill.type)).toEqual([
      "recall",
      "reconstruction",
      "cloze",
      "transformation",
      "original_sentence"
    ]);
    expect(drills[2].answer).toBe("食べたい");
  });
});

describe("language normalization and srs", () => {
  it("normalizes sentence text for duplicate detection", () => {
    expect(normalizeSentenceText("  I   WANT  sushi  ")).toBe("i want sushi");
  });

  it("builds canonical keys from language and normalized content", () => {
    expect(buildCanonicalKey("ko", "저는")).toBe("ko:저는");
  });

  it("uses fixed sentence review intervals", () => {
    const reviewedAt = new Date("2026-06-20T00:00:00.000Z");

    expect(scheduleSentenceReview("failed", reviewedAt).nextReviewAt.toISOString()).toBe("2026-06-21T00:00:00.000Z");
    expect(scheduleSentenceReview("hard", reviewedAt).nextReviewAt.toISOString()).toBe("2026-06-23T00:00:00.000Z");
    expect(scheduleSentenceReview("correct", reviewedAt).nextReviewAt.toISOString()).toBe("2026-06-27T00:00:00.000Z");
    expect(scheduleSentenceReview("easy", reviewedAt).nextReviewAt.toISOString()).toBe("2026-07-04T00:00:00.000Z");
  });
});

function buildLesson(sentencesInput: Array<Record<string, unknown>>) {
  return {
    language: "ko",
    baseLanguage: "en",
    title: "Beginner Korean Lesson 1",
    description: "Basic greetings and movement",
    source: "ai_generated",
    level: "beginner",
    tags: ["daily", "travel"],
    sentences: sentencesInput
  };
}

function createStore() {
  return {
    lessons: [] as Array<Record<string, unknown>>,
    sentences: [] as Array<Record<string, unknown>>,
    learningItems: [] as Array<Record<string, unknown>>,
    lessonSentences: [] as Array<Record<string, unknown>>,
    sentenceVocabularyLinks: [] as Array<Record<string, unknown>>,
    sentenceGrammarLinks: [] as Array<Record<string, unknown>>,
    sentenceChunkLinks: [] as Array<Record<string, unknown>>,
    drills: [] as Array<Record<string, unknown>>,
    reviewStates: [] as Array<Record<string, unknown>>
  };
}

type Store = ReturnType<typeof createStore>;

interface MockDb {
  store: Store;
  resetStore(store: Store, options?: { failOnInsertTable?: unknown }): void;
  select(projection?: unknown): SelectQuery;
  insert(table: unknown): InsertQuery;
  update(table: unknown): UpdateQuery;
  transaction<T>(callback: (tx: MockDb) => Promise<T>): Promise<T>;
}

function createMockDb(initialStore: Store, initialOptions: { failOnInsertTable?: unknown } = {}): MockDb {
  let store = initialStore;
  let options = initialOptions;
  let counter = 0;

  const api: MockDb = {
    get store() {
      return store;
    },
    resetStore(nextStore: Store, nextOptions: { failOnInsertTable?: unknown } = {}) {
      store = nextStore;
      options = nextOptions;
      counter = 0;
    },
    select(projection?: unknown) {
      void projection;
      return new SelectQuery(() => store);
    },
    insert(table: unknown) {
      return new InsertQuery(() => store, table, () => options.failOnInsertTable, () => `${++counter}`);
    },
    update(table: unknown) {
      return new UpdateQuery(() => store, table);
    },
    async transaction<T>(callback: (tx: MockDb) => Promise<T>) {
      const snapshot = structuredClone(store);

      try {
        return await callback(api);
      } catch (error) {
        const rolledBack = structuredClone(snapshot);
        for (const key of Object.keys(store)) {
          delete (store as Record<string, unknown>)[key];
        }
        Object.assign(store, rolledBack);
        throw error;
      }
    }
  };

  return api;
}

class SelectQuery {
  private table: unknown;
  private limitCount: number | undefined;

  constructor(private readonly getStore: () => Store) {}

  from(table: unknown) {
    this.table = table;
    return this;
  }

  where(condition?: unknown) {
    void condition;
    return this;
  }

  orderBy(...args: unknown[]) {
    void args;
    return this;
  }

  innerJoin(...args: unknown[]) {
    void args;
    return this;
  }

  limit(value: number) {
    this.limitCount = value;
    return this;
  }

  then<TResult1 = unknown[], TResult2 = never>(resolve?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null, reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }

  private execute() {
    const store = this.getStore();
    if (this.table === lessons) {
      return store.lessons.map((row) => ({ id: row.id })).slice(0, this.limitCount ?? Infinity);
    }

    if (this.table === sentences) {
      return store.sentences.map((row) => ({ id: row.id, normalizedText: row.normalizedText }));
    }

    if (this.table === learningItems) {
      return store.learningItems.map((row) => ({
        id: row.id,
        canonicalKey: row.canonicalKey,
        type: row.type,
        displayText: row.displayText,
        meaning: row.meaning ?? null,
        explanation: row.explanation ?? null
      }));
    }

    return [];
  }
}

class InsertQuery {
  private rows: Record<string, unknown>[] = [];

  constructor(
    private readonly getStore: () => Store,
    private readonly table: unknown,
    private readonly getFailOnInsertTable: () => unknown,
    private readonly nextId: () => string
  ) {}

  values(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.rows = Array.isArray(values) ? values : [values];
    return this;
  }

  returning(projection?: unknown) {
    void projection;
    if (this.table === this.getFailOnInsertTable()) {
      throw new Error("Simulated insert failure.");
    }

    return Promise.resolve(this.rows.map((row) => this.insertRow(row)));
  }

  private insertRow(row: Record<string, unknown>) {
    const store = this.getStore();
    if (this.table === lessons) {
      const inserted = { id: `lesson-${this.nextId()}`, ...row };
      store.lessons.push(inserted);
      return inserted;
    }

    if (this.table === learningItems) {
      const inserted = { id: `item-${this.nextId()}`, ...row };
      store.learningItems.push(inserted);
      return inserted;
    }

    if (this.table === sentences) {
      const inserted = { id: `sentence-${this.nextId()}`, ...row };
      store.sentences.push(inserted);
      return inserted;
    }

    if (this.table === lessonSentences) {
      const inserted = { id: `lesson-sentence-${this.nextId()}`, ...row };
      store.lessonSentences.push(inserted);
      return inserted;
    }

    if (this.table === sentenceVocabularyLinks) {
      const inserted = { id: `vocab-link-${this.nextId()}`, ...row };
      store.sentenceVocabularyLinks.push(inserted);
      return inserted;
    }

    if (this.table === sentenceGrammarLinks) {
      const inserted = { id: `grammar-link-${this.nextId()}`, ...row };
      store.sentenceGrammarLinks.push(inserted);
      return inserted;
    }

    if (this.table === sentenceChunkLinks) {
      const inserted = { id: `chunk-link-${this.nextId()}`, ...row };
      store.sentenceChunkLinks.push(inserted);
      return inserted;
    }

    if (this.table === drills) {
      const inserted = { id: `drill-${this.nextId()}`, ...row };
      store.drills.push(inserted);
      return inserted;
    }

    if (this.table === reviewStates) {
      const inserted = { id: `review-${this.nextId()}`, ...row };
      store.reviewStates.push(inserted);
      return inserted;
    }

    return row;
  }
}

class UpdateQuery {
  constructor(private readonly getStore: () => Store, private readonly table: unknown) {}

  set(patch?: Record<string, unknown>) {
    void patch;
    return this;
  }

  where(condition?: unknown) {
    void condition;
    return Promise.resolve();
  }
}
