"use client";

import { useMemo } from "react";
import { createSpeechService, type SpeechService } from "./speechService";

export function useSpeechService(language: string): SpeechService {
  return useMemo(() => createSpeechService(language), [language]);
}
