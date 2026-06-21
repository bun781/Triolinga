"use client";

import { useCallback, useEffect, useMemo } from "react";
import { createSpeechPlaybackController } from "./speechPlayback";
import { useSpeechService } from "./useSpeechService";

export function useSpeechPlayback(text: string, language: string) {
  const speech = useSpeechService(language);

  const speak = useCallback((rate = 1) => {
    speech.speak(text, { rate });
  }, [speech, text]);

  const playback = useMemo(
    () => createSpeechPlaybackController({
      speak: () => speak(1),
      speakSlow: () => speak(0.8)
    }),
    [speak]
  );

  useEffect(() => () => playback.cancel(), [playback]);

  return {
    supported: speech.supported,
    cancel: speech.cancel.bind(speech),
    speak: () => speak(1),
    speakSlow: () => speak(0.8),
    onClick: playback.click,
    onDoubleClick: playback.doubleClick
  };
}
