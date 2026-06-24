"use client";

import { useEffect, useMemo, useState } from "react";
import { languageOptions } from "@/lib/language/importResources";
import { formatLanguageDisplay, resolveLanguageValue } from "./lesson-import-utils";

interface LanguageFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function LanguageField({ label, value, onChange }: LanguageFieldProps) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setDraft(formatLanguageDisplay(value));
  }, [value]);

  const filteredOptions = useMemo(() => {
    const normalized = draft.trim().toLowerCase();

    if (!normalized) {
      return languageOptions.slice(0, 10);
    }

    return languageOptions
      .filter((option) => (
        option.code.includes(normalized) ||
        option.label.toLowerCase().includes(normalized)
      ))
      .slice(0, 10);
  }, [draft]);

  return (
    <label className="field searchable-field">
      <span>{label}</span>
      <div className="searchable-input-shell">
        <input
          className="input"
          value={draft}
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 100);
            setDraft(formatLanguageDisplay(resolveLanguageValue(draft)));
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDraft(nextValue);
            onChange(resolveLanguageValue(nextValue));
          }}
          onFocus={() => setFocused(true)}
          placeholder="Type a language or code"
        />
        {focused && filteredOptions.length ? (
          <div className="searchable-options" role="listbox" aria-label={`${label} suggestions`}>
            {filteredOptions.map((option) => (
              <button
                className="searchable-option"
                key={option.code}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option.code);
                  setDraft(formatLanguageDisplay(option.code));
                  setFocused(false);
                }}
              >
                <strong>{option.label}</strong>
                <span>{option.code}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  );
}
