export interface SpeechPlaybackActions {
  speak: () => void;
  speakSlow: () => void;
}

export function createSpeechPlaybackController(actions: SpeechPlaybackActions, delayMs = 180) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  return {
    click() {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        actions.speak();
      }, delayMs);
    },
    doubleClick() {
      clearTimer();
      actions.speakSlow();
    },
    cancel() {
      clearTimer();
    }
  };
}
