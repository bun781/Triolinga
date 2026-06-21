export interface SpeechOptions {
  lang?: string;
  pitch?: number;
  rate?: number;
  volume?: number;
}

export interface SpeechProvider {
  readonly supported: boolean;
  cancel(): void;
  speak(text: string, options: SpeechOptions): void;
}

class BrowserSpeechProvider implements SpeechProvider {
  readonly supported = typeof window !== "undefined" && "speechSynthesis" in window;

  cancel() {
    if (!this.supported) return;
    window.speechSynthesis.cancel();
  }

  speak(text: string, options: SpeechOptions) {
    if (!this.supported) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang ?? "en";
    if (options.pitch !== undefined) utterance.pitch = options.pitch;
    if (options.rate !== undefined) utterance.rate = options.rate;
    if (options.volume !== undefined) utterance.volume = options.volume;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }
}

class SilentSpeechProvider implements SpeechProvider {
  readonly supported = false;
  cancel() {}
  speak() {}
}

export class SpeechService {
  constructor(
    private readonly language: string,
    private readonly provider: SpeechProvider = createSpeechProvider()
  ) {}

  get supported() {
    return this.provider.supported;
  }

  cancel() {
    this.provider.cancel();
  }

  speak(text: string, options: Omit<SpeechOptions, "lang"> = {}) {
    this.provider.speak(text, {
      lang: this.language,
      ...options
    });
  }
}

export function createSpeechService(language: string, provider?: SpeechProvider) {
  return new SpeechService(language, provider);
}

export function createSpeechProvider() {
  if (typeof window === "undefined") return new SilentSpeechProvider();
  return new BrowserSpeechProvider();
}
