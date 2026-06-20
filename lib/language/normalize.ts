import { createHash } from "node:crypto";

export function normalizeSentenceText(text: string): string {
  return normalizeText(text).toLocaleLowerCase();
}

export function normalizeCanonicalText(text: string): string {
  return normalizeText(text).toLocaleLowerCase();
}

export function buildCanonicalKey(language: string, value: string): string {
  return `${normalizeCanonicalText(language)}:${normalizeCanonicalText(value)}`;
}

export function hashLessonSource(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function normalizeText(text: string): string {
  return text.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

