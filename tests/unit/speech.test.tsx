import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Tooltip } from "@/components/ui/Tooltip";
import { createSpeechPlaybackController } from "@/lib/speech/speechPlayback";
import { createSpeechService, type SpeechProvider } from "@/lib/speech/speechService";

class FakeSpeechProvider implements SpeechProvider {
  supported = true;
  calls: Array<{ text: string; options: Record<string, unknown> }> = [];
  cancelCount = 0;

  cancel() {
    this.cancelCount += 1;
  }

  speak(text: string, options: Record<string, unknown>) {
    this.calls.push({ text, options });
  }
}

describe("speech service", () => {
  it("passes language and rate into the provider", () => {
    const provider = new FakeSpeechProvider();
    const speech = createSpeechService("ko", provider);

    speech.speak("안녕하세요", { rate: 0.8 });

    expect(provider.calls).toEqual([
      {
        text: "안녕하세요",
        options: {
          lang: "ko",
          rate: 0.8
        }
      }
    ]);
  });
});

describe("speech playback controller", () => {
  it("delays a normal click so double-clicks can replace it", () => {
    vi.useFakeTimers();
    const speak = vi.fn();
    const speakSlow = vi.fn();
    const controller = createSpeechPlaybackController({ speak, speakSlow }, 180);

    controller.click();
    vi.advanceTimersByTime(179);
    expect(speak).not.toHaveBeenCalled();

    controller.doubleClick();
    expect(speakSlow).toHaveBeenCalledTimes(1);
    expect(speak).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();
    expect(speak).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("plays the normal speed sentence on a single click", () => {
    vi.useFakeTimers();
    const speak = vi.fn();
    const speakSlow = vi.fn();
    const controller = createSpeechPlaybackController({ speak, speakSlow }, 180);

    controller.click();
    vi.advanceTimersByTime(180);

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speakSlow).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("tooltip", () => {
  it("renders a tooltip association for assistive technology", () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Remove this sentence.">
        <button type="button">Remove</button>
      </Tooltip>
    );

    expect(html).toContain('role="tooltip"');
    expect(html).toContain("Remove this sentence.");
    expect(html).toContain("aria-describedby");
  });
});
