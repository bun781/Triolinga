"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, RotateCcw, Search } from "lucide-react";
import type { StudyLesson } from "@/lib/imported-content/types";
import type { ReviewResetScope, ReviewSentence } from "@/lib/review/types";

type StatKey =
  | "remembered-sentences"
  | "needs-sentences"
  | "remembered-words"
  | "needs-words"
  | "remembered-grammar"
  | "needs-grammar"
  | "remembered-chunks"
  | "needs-chunks";

type SortKey = "text" | "lesson" | "status";
type SortDirection = "asc" | "desc";

interface ReviewStatsBrowserProps {
  lessons: StudyLesson[];
  lessonTitleById: Map<string, string>;
  sentences: ReviewSentence[];
  onReset: (scope: ReviewResetScope) => Promise<void> | void;
}

interface StatItem {
  id: string;
  type: "sentence" | "word" | "grammar" | "chunk";
  text: string;
  detail: string;
  lessonId: string;
  lessonTitle: string;
  status: "remembered" | "needs-review" | "unseen";
  sentenceIds: string[];
  canonicalKey?: string;
}

export function ReviewStatsBrowser({ lessons, lessonTitleById, sentences, onReset }: ReviewStatsBrowserProps) {
  const [activeKey, setActiveKey] = useState<StatKey>("needs-sentences");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [confirm, setConfirm] = useState<{ title: string; description: string; scope: ReviewResetScope } | null>(null);
  const stats = useMemo(() => buildReviewStats(sentences, lessons, lessonTitleById), [lessonTitleById, lessons, sentences]);
  const active = stats[activeKey];
  const overviewCharts = useMemo(() => [
    {
      label: "Sentences",
      remembered: stats["remembered-sentences"].items.length,
      needsReview: stats["needs-sentences"].items.length
    },
    {
      label: "Words",
      remembered: stats["remembered-words"].items.length,
      needsReview: stats["needs-words"].items.length
    },
    {
      label: "Grammar",
      remembered: stats["remembered-grammar"].items.length,
      needsReview: stats["needs-grammar"].items.length
    },
    {
      label: "Chunks",
      remembered: stats["remembered-chunks"].items.length,
      needsReview: stats["needs-chunks"].items.length
    }
  ], [stats]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const rows = normalized
      ? active.items.filter((item) => `${item.text} ${item.detail} ${item.lessonTitle}`.toLowerCase().includes(normalized))
      : active.items;
    return [...rows].sort((a, b) => compareStatItems(a, b, sortKey, sortDirection));
  }, [active.items, query, sortDirection, sortKey]);

  async function confirmReset() {
    if (!confirm) return;
    const scope = confirm.scope;
    setConfirm(null);
    await onReset(scope);
  }

  return (
    <section className="review-stats-browser">
      <div className="review-queue-dashboard-top">
        <div>
          <h2>Statistics dashboard</h2>
          <p className="muted">{active.detail}</p>
        </div>
        <span className="pill">{filtered.length} items</span>
      </div>

      <div className="review-stats-overview">
        {overviewCharts.map((chart) => (
          <StatPieCard
            key={chart.label}
            label={chart.label}
            remembered={chart.remembered}
            needsReview={chart.needsReview}
          />
        ))}
      </div>

      <div className="review-stats-grid">
        {(Object.keys(stats) as StatKey[]).map((key) => {
          const stat = stats[key];
          return (
            <button
              type="button"
              className={`review-stat-card${activeKey === key ? " active" : ""}`}
              key={key}
              onClick={() => {
                setActiveKey(key);
                setQuery("");
              }}
            >
              <strong>{stat.items.length}</strong>
              <span>{stat.label}</span>
              <small>{stat.detail}</small>
            </button>
          );
        })}
      </div>

      <div className="review-stat-list card">
        <div className="review-stat-list-top">
          <div>
            <h2>{active.label}</h2>
            <p className="muted">{active.detail}</p>
          </div>
          <div className="review-stat-tools">
            <label className="review-stat-search">
              <Search size={16} aria-hidden="true" />
              <input
                className="input"
                value={query}
                placeholder="Search"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select className="input selector-compact" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
              <option value="status">Status</option>
              <option value="text">Text</option>
              <option value="lesson">Lesson</option>
            </select>
            <button
              type="button"
              className="button secondary icon-only"
              title={sortDirection === "asc" ? "Sort ascending" : "Sort descending"}
              onClick={() => setSortDirection((value) => value === "asc" ? "desc" : "asc")}
            >
              {sortDirection === "asc" ? <ArrowDownAZ size={18} /> : <ArrowUpAZ size={18} />}
            </button>
          </div>
        </div>

        {filtered.length ? (
          <div className="review-stat-results">
            {filtered.map((item) => (
              <div className="review-stat-row" key={`${item.type}:${item.id}`}>
                <a href={`/study/imported-content?lessonId=${encodeURIComponent(item.lessonId)}&sentenceId=${encodeURIComponent(item.sentenceIds[0] ?? "")}`}>
                  <strong>{item.text}</strong>
                  <span>{item.detail}</span>
                  <small>{item.lessonTitle}</small>
                </a>
                <span className={`pill ${item.status === "remembered" ? "review-state-remembered" : item.status === "needs-review" ? "review-state-forgotten" : ""}`}>
                  {formatStatus(item.status)}
                </span>
                <button
                  type="button"
                  className="button secondary icon-only"
                  title={`Reset ${item.text}`}
                  onClick={() => setConfirm({
                    title: `Reset ${formatItemType(item.type)} Progress?`,
                    description: `This will restore ${item.text} to an unseen state.`,
                    scope: getResetScope(item)
                  })}
                >
                  <RotateCcw size={17} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="review-stat-empty">
            <h3>{query ? "No matches found." : active.emptyTitle}</h3>
            <p className="muted">{query ? "Try a different search or sorting option." : active.emptyDescription}</p>
          </div>
        )}
      </div>

      {confirm ? (
        <div className="confirm-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="review-reset-title">
            <h2 id="review-reset-title">{confirm.title}</h2>
            <p className="muted">{confirm.description}</p>
            <div className="review-complete-actions">
              <button type="button" className="button secondary" onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="button" onClick={() => void confirmReset()}>Reset</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function StatPieCard({
  label,
  remembered,
  needsReview
}: {
  label: string;
  remembered: number;
  needsReview: number;
}) {
  const total = remembered + needsReview;
  const rememberedShare = total > 0 ? remembered / total : 0;
  const needsShare = total > 0 ? needsReview / total : 0;
  const radius = 24;
  const size = 72;
  const circumference = 2 * Math.PI * radius;
  const rememberedLength = circumference * rememberedShare;
  const needsLength = circumference * needsShare;

  return (
    <article className="review-stat-pie card">
      <div className="review-stat-pie-chart" aria-hidden="true">
        <svg viewBox={`0 0 ${size} ${size}`} role="presentation">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="review-stat-pie-track"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          {total > 0 ? (
            <>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                className="review-stat-pie-remembered"
                strokeDasharray={`${rememberedLength} ${circumference - rememberedLength}`}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                className="review-stat-pie-needs"
                strokeDasharray={`${needsLength} ${circumference - needsLength}`}
                strokeDashoffset={-rememberedLength}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            </>
          ) : null}
        </svg>
        <strong>{total}</strong>
      </div>
      <div className="review-stat-pie-copy">
        <span>{label}</span>
        <small>{remembered} remembered · {needsReview} need review</small>
      </div>
    </article>
  );
}

function buildReviewStats(sentences: ReviewSentence[], lessons: StudyLesson[], lessonTitleById: Map<string, string>) {
  const sentenceById = new Map(sentences.map((sentence) => [sentence.id, sentence]));
  const sentenceItems = sentences.map((sentence): StatItem => ({
    id: sentence.id,
    type: "sentence",
    text: sentence.text,
    detail: sentence.translation,
    lessonId: sentence.lessonId ?? "",
    lessonTitle: lessonTitleById.get(sentence.lessonId ?? "") ?? "Untitled lesson",
    status: getReviewStatus(sentence),
    sentenceIds: [sentence.id]
  }));
  const items = buildLearningItemStats(lessons, sentenceById, lessonTitleById);

  return {
    "remembered-sentences": makeStat("Remembered Sentences", "Sentences marked remembered.", sentenceItems.filter((item) => item.status === "remembered"), "No remembered sentences yet.", "Start a review and mark sentences remembered to fill this list."),
    "needs-sentences": makeStat("Needs Review Sentences", "Forgotten or currently due sentences.", sentenceItems.filter((item) => item.status === "needs-review"), "No sentences need review.", "Start with new cards or come back when more cards are due."),
    "remembered-words": makeStat("Remembered Words", "Words whose linked sentences are remembered.", items.filter((item) => item.type === "word" && item.status === "remembered"), "No remembered words yet.", "Mark linked sentences remembered to build vocabulary confidence."),
    "needs-words": makeStat("Needs Review Words", "Words linked to forgotten or due sentences.", items.filter((item) => item.type === "word" && item.status === "needs-review"), "No words need review.", "Words will appear here when linked sentences are due or missed."),
    "remembered-grammar": makeStat("Remembered Grammar", "Grammar linked only to remembered sentences.", items.filter((item) => item.type === "grammar" && item.status === "remembered"), "No remembered grammar yet.", "Review grammar-bearing sentences to fill this list."),
    "needs-grammar": makeStat("Needs Review Grammar", "Grammar linked to forgotten or due sentences.", items.filter((item) => item.type === "grammar" && item.status === "needs-review"), "No grammar needs review.", "Grammar will appear here when linked sentences are due or missed."),
    "remembered-chunks": makeStat("Remembered Chunks", "Chunks linked only to remembered sentences.", items.filter((item) => item.type === "chunk" && item.status === "remembered"), "No remembered chunks yet.", "Remember sentences with chunks to fill this list."),
    "needs-chunks": makeStat("Needs Review Chunks", "Chunks linked to forgotten or due sentences.", items.filter((item) => item.type === "chunk" && item.status === "needs-review"), "No chunks need review.", "Chunks will appear here when linked sentences are due or missed.")
  };
}

function makeStat(label: string, detail: string, items: StatItem[], emptyTitle: string, emptyDescription: string) {
  return { label, detail, items, emptyTitle, emptyDescription };
}

function buildLearningItemStats(lessons: StudyLesson[], sentenceById: Map<string, ReviewSentence>, lessonTitleById: Map<string, string>): StatItem[] {
  const groups = new Map<string, StatItem & { statuses: StatItem["status"][] }>();
  for (const lesson of lessons) {
    for (const sentence of lesson.sentences) {
      const reviewSentence = sentenceById.get(sentence.id);
      if (!reviewSentence) continue;
      const status = getReviewStatus(reviewSentence);
      for (const word of sentence.words) {
        addLearningItem(groups, "word", word.canonicalKey, word.displayText || word.surface, word.meaning ?? "", lesson.id, lessonTitleById.get(lesson.id) ?? lesson.title, sentence.id, status);
      }
      for (const grammar of sentence.grammar) {
        addLearningItem(groups, "grammar", grammar.canonicalKey, grammar.pattern || grammar.surfaceText, grammar.meaning ?? "", lesson.id, lessonTitleById.get(lesson.id) ?? lesson.title, sentence.id, status);
      }
      for (const chunk of sentence.chunks) {
        addLearningItem(groups, "chunk", chunk.canonicalKey, chunk.surfaceText, chunk.meaning ?? "", lesson.id, lessonTitleById.get(lesson.id) ?? lesson.title, sentence.id, status);
      }
    }
  }

  return [...groups.values()].map(({ statuses, ...item }) => ({
    ...item,
    status: statuses.some((status) => status === "needs-review")
      ? "needs-review"
      : statuses.every((status) => status === "remembered")
        ? "remembered"
        : "unseen"
  }));
}

function addLearningItem(
  groups: Map<string, StatItem & { statuses: StatItem["status"][] }>,
  type: "word" | "grammar" | "chunk",
  canonicalKey: string,
  text: string,
  detail: string,
  lessonId: string,
  lessonTitle: string,
  sentenceId: string,
  status: StatItem["status"]
) {
  const key = `${type}:${canonicalKey}:${lessonId}`;
  const existing = groups.get(key);
  if (existing) {
    existing.statuses.push(status);
    if (!existing.sentenceIds.includes(sentenceId)) existing.sentenceIds.push(sentenceId);
    return;
  }
  groups.set(key, { id: key, type, text, detail, lessonId, lessonTitle, status, sentenceIds: [sentenceId], canonicalKey, statuses: [status] });
}

function getReviewStatus(sentence: ReviewSentence): StatItem["status"] {
  if (sentence.reviewState === "forgotten") return "needs-review";
  if (sentence.reviewState === "remembered") {
    const dueAt = sentence.dueAt ? new Date(sentence.dueAt).getTime() : Number.POSITIVE_INFINITY;
    return dueAt <= Date.now() ? "needs-review" : "remembered";
  }
  return "unseen";
}

function compareStatItems(a: StatItem, b: StatItem, sortKey: SortKey, direction: SortDirection) {
  const multiplier = direction === "asc" ? 1 : -1;
  const left = sortKey === "lesson" ? a.lessonTitle : sortKey === "status" ? a.status : a.text;
  const right = sortKey === "lesson" ? b.lessonTitle : sortKey === "status" ? b.status : b.text;
  return left.localeCompare(right) * multiplier || a.text.localeCompare(b.text);
}

function getResetScope(item: StatItem): ReviewResetScope {
  if (item.type === "sentence") return { type: "sentence", sentenceId: item.id };
  return { type: "item", itemType: item.type, canonicalKey: item.canonicalKey ?? item.text, lessonId: item.lessonId };
}

function formatStatus(status: StatItem["status"]) {
  if (status === "remembered") return "Remembered";
  if (status === "needs-review") return "Needs Review";
  return "Unseen";
}

function formatItemType(type: StatItem["type"]) {
  if (type === "sentence") return "Sentence";
  if (type === "word") return "Word";
  if (type === "grammar") return "Grammar";
  return "Chunk";
}
