"use client";

import { useCallback, useEffect, useRef } from "react";

export function useSpeech(language: string) {
  const langRef = useRef(language);
  useEffect(() => { langRef.current = language; }, [language]);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langRef.current;
    window.speechSynthesis.speak(utterance);
  }, []);

  return speak;
}
