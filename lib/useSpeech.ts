"use client";

import { useCallback } from "react";
import { useSpeechService } from "@/lib/speech/useSpeechService";

export function useSpeech(language: string) {
  const speech = useSpeechService(language);

  const speak = useCallback((text: string) => speech.speak(text), [speech]);

  return speak;
}
