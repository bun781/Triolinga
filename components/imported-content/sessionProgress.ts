"use client";

const STORAGE_PREFIX = "fydor.study-progress";

export function readSessionProgress<T>(key: string, validate: (value: unknown) => T | null): T | null {
  if (typeof window === "undefined") return null;

  try {
    const storageKey = formatKey(key);
    const raw = window.localStorage.getItem(storageKey) ?? window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const value = validate(JSON.parse(raw));
    if (value) writeSessionProgress(key, value);
    return value;
  } catch {
    return null;
  }
}

export function writeSessionProgress<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  const serialized = JSON.stringify(value);
  const storageKey = formatKey(key);

  try {
    window.localStorage.setItem(storageKey, serialized);
  } catch {
    try {
      window.sessionStorage.setItem(storageKey, serialized);
    } catch {
      // Keep study sessions usable if browser storage is unavailable.
    }
  }
}

export function clearSessionProgress(key: string) {
  if (typeof window === "undefined") return;

  const storageKey = formatKey(key);
  try {
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Clearing progress is best-effort; callers still reset in-memory state.
  }
}

function formatKey(key: string) {
  return `${STORAGE_PREFIX}.${key}`;
}
