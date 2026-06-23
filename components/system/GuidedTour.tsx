"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";

type TourPlacement = "top" | "bottom" | "left" | "right";

interface TourStep {
  route: Route<string>;
  section: string;
  title: string;
  description: string;
  details?: string[];
  targetSelectors: string[];
  placement?: TourPlacement;
  primaryLabel?: string;
}

interface TourTargetState {
  rect: DOMRect;
  element: HTMLElement;
}

const TOUR_STATE_KEY = "fydor-guided-tour-state-v1";
const TOUR_REPLAY_EVENT = "fydor-guided-tour:replay";

const tourSteps: TourStep[] = [
  {
    route: "/admin/imports",
    section: "Start here",
    title: "Fydor turns lessons into study cards",
    description: "The usual flow is: make or paste a lesson, check it, save it, then study it from saved lessons.",
    details: [
      "A lesson is built from sentences, translations, vocabulary, grammar notes, and useful phrase chunks.",
      "You can write those details yourself or ask an AI assistant to prepare the lesson JSON for you.",
      "Use the Sample lesson button when you want a safe first example before making your own."
    ],
    targetSelectors: ['[data-tour="lesson-sample"]'],
    placement: "bottom",
    primaryLabel: "Next"
  },
  {
    route: "/admin/imports",
    section: "Lesson Builder",
    title: "Start from an example",
    description: "Click Sample lesson to load a complete beginner lesson. It is the easiest way to see the shape Fydor expects.",
    details: [
      "After it loads, read the title, language, sentence, translation, and annotation fields.",
      "Nothing is sent anywhere by this button. It only fills the editor with local sample content.",
      "You can replace the sample text with your own once the structure feels familiar."
    ],
    targetSelectors: ['[data-tour="lesson-sample"]'],
    placement: "bottom",
    primaryLabel: "Next"
  },
  {
    route: "/admin/imports",
    section: "Lesson Builder",
    title: "Choose the editor that feels comfortable",
    description: "Builder mode is friendlier for manual editing. JSON mode is better when you paste output from an AI assistant.",
    details: [
      "Use Builder when you want visible fields and buttons.",
      "Use JSON when an AI gives you a full lesson file to paste in.",
      "Both modes describe the same lesson, so you can switch between them."
    ],
    targetSelectors: ['[data-tour="lesson-editor-mode"]'],
    placement: "bottom",
    primaryLabel: "Next"
  },
  {
    route: "/admin/imports",
    section: "AI help",
    title: "Use the guide when the format is confusing",
    description: "The Guide explains the required fields, optional fields, examples, and common mistakes.",
    details: [
      "Open this when Check says the JSON is invalid.",
      "Compare your lesson with the examples instead of trying to memorize every field.",
      "The most important fields are title, language, baseLanguage, and at least one sentence with text and translation."
    ],
    targetSelectors: ['[data-tour="import-guide"]'],
    placement: "bottom",
    primaryLabel: "Next"
  },
  {
    route: "/admin/imports",
    section: "AI help",
    title: "Copy a prompt if you are new to LLMs",
    description: "Prompts are ready-made instructions you can paste into ChatGPT or another AI assistant.",
    details: [
      "Pick the prompt closest to what you want: beginner, intermediate, vocabulary, or grammar.",
      "Replace the language, topic, and number of sentences with your goal.",
      "Ask follow-up requests plainly, like: make it easier, add pronunciation notes, or fix the JSON error."
    ],
    targetSelectors: ['[data-tour="import-prompts"]'],
    placement: "bottom",
    primaryLabel: "Next"
  },
  {
    route: "/admin/imports",
    section: "AI help",
    title: "Paste AI output into JSON mode",
    description: "When the AI returns a lesson, paste only the JSON into this editor. Avoid copying extra explanation around it.",
    details: [
      "Good AI output usually starts with { and ends with }.",
      "If the AI includes notes before or after the JSON, delete those notes before checking.",
      "If Check fails, paste the error back into the AI and ask it to return corrected JSON only."
    ],
    targetSelectors: ['[data-tour="lesson-json-mode"]', '[data-tour="lesson-editor-mode"]'],
    placement: "bottom",
    primaryLabel: "Next"
  },
  {
    route: "/admin/imports",
    section: "Check and Save",
    title: "Check before saving",
    description: "Check validates the lesson and shows format problems early. Preview shows what will be saved.",
    details: [
      "Use Check after manual edits or after pasting AI-generated JSON.",
      "Use Preview when you want to inspect vocabulary, grammar, chunks, and duplicate warnings.",
      "Validation errors are normal while drafting; they are clues, not failures."
    ],
    targetSelectors: ['[data-tour="lesson-check"]'],
    placement: "top",
    primaryLabel: "Next"
  },
  {
    route: "/admin/imports",
    section: "Check and Save",
    title: "Save the lesson",
    description: "When the lesson looks right, save it so it appears in your saved lessons.",
    details: [
      "Saved lessons stay on your device.",
      "After saving, go to Saved Lessons to study the lesson sentence by sentence.",
      "You can come back later and import more lessons for the same language."
    ],
    targetSelectors: ['[data-tour="lesson-save"]'],
    placement: "top",
    primaryLabel: "Next"
  },
  {
    route: "/study/imported-content",
    section: "Study",
    title: "Open Saved Lessons",
    description: "This sidebar link takes you from lesson building to studying the lessons you saved.",
    details: [
      "If saved lessons are empty, Fydor will point you back to the builder.",
      "Once lessons exist, you can choose a language and lesson from the selectors.",
      "Use this page for focused sentence-by-sentence study."
    ],
    targetSelectors: ['[data-tour="nav-library"]'],
    placement: "right",
    primaryLabel: "Next"
  },
  {
    route: "/study/imported-content",
    section: "Study",
    title: "Start a review pass",
    description: "Start Review turns the saved lesson into a review session. You decide whether each card was remembered or forgotten.",
    details: [
      "Do not worry about getting every card right at first.",
      "Marking a card as forgotten helps Fydor keep it in your learning pile.",
      "Short, honest review sessions are better than forcing long perfect sessions."
    ],
    targetSelectors: ['[data-tour="study-start-review"]', '[data-tour="study-import"]'],
    placement: "top",
    primaryLabel: "Next"
  },
  {
    route: "/study/imported-content",
    section: "Study",
    title: "Reveal one layer at a time",
    description: "Translation, words, grammar, and hints can be turned on separately while you study.",
    details: [
      "First try to understand the sentence without help.",
      "Reveal hints, words, or grammar when you are stuck.",
      "Reveal the translation last, then grade yourself honestly."
    ],
    targetSelectors: ['[data-tour="study-translation"]'],
    placement: "top",
    primaryLabel: "Finish"
  }
];

export function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [target, setTarget] = useState<TourTargetState | null>(null);
  const [completed, setCompleted] = useState(false);

  const activeStep = useMemo(() => {
    if (activeStepIndex === null) return null;
    return tourSteps[activeStepIndex] ?? null;
  }, [activeStepIndex]);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = window.localStorage.getItem(TOUR_STATE_KEY);
      if (!raw) {
        setActiveStepIndex(0);
        setCompleted(false);
        return;
      }

      const parsed = JSON.parse(raw) as { completed?: boolean; stepIndex?: number };
      if (parsed.completed) {
        setCompleted(true);
        setActiveStepIndex(null);
        return;
      }

      const nextIndex = Number.isInteger(parsed.stepIndex) ? Math.min(Math.max(parsed.stepIndex ?? 0, 0), tourSteps.length - 1) : 0;
      setActiveStepIndex(nextIndex);
      setCompleted(false);
    } catch {
      setActiveStepIndex(0);
      setCompleted(false);
    }
  }, []);

  useEffect(() => {
    function handleReplayTour() {
      const firstStep = tourSteps[0];
      try {
        window.localStorage.setItem(TOUR_STATE_KEY, JSON.stringify({ completed: false, stepIndex: 0 }));
      } catch {
        // Ignore storage failures and keep the in-memory state working.
      }

      setCompleted(false);
      setActiveStepIndex(0);
      setTarget(null);

      if (pathname !== firstStep.route) {
        router.push(firstStep.route);
      }
    }

    window.addEventListener(TOUR_REPLAY_EVENT, handleReplayTour);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, handleReplayTour);
  }, [pathname, router]);

  useEffect(() => {
    if (!mounted || activeStepIndex === null) return;
    try {
      window.localStorage.setItem(TOUR_STATE_KEY, JSON.stringify({ completed: false, stepIndex: activeStepIndex }));
    } catch {
      // Ignore storage errors and keep the in-memory state working.
    }
  }, [mounted, activeStepIndex]);

  useEffect(() => {
    const currentStep = activeStep;
    if (!mounted || !currentStep) return;
    const stepSelectors = currentStep.targetSelectors;

    let animationFrame = 0;
    let interval = 0;

    function updateTarget() {
      const resolved = findTarget(stepSelectors);
      if (!resolved) {
        setTarget(null);
        return false;
      }

      const rect = resolved.getBoundingClientRect();
      setTarget({ rect, element: resolved });
      if (interval) {
        window.clearInterval(interval);
        interval = 0;
      }
      return true;
    }

    animationFrame = window.requestAnimationFrame(() => {
      const found = updateTarget();
      if (!found) {
        interval = window.setInterval(updateTarget, 250);
      }
    });

    function handleScroll() {
      updateTarget();
    }

    function handleResize() {
      updateTarget();
    }

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearInterval(interval);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [activeStep, mounted, pathname]);

  if (!mounted || pathname === "/" || completed || activeStepIndex === null || !activeStep) {
    return null;
  }

  const isOnStepRoute = pathname === activeStep.route;
  const panelStyle = buildPanelStyle(target?.rect, activeStep.placement ?? "bottom");
  const spotlightStyle = target ? buildSpotlightStyle(target.rect) : undefined;

  function completeTour() {
    try {
      window.localStorage.setItem(TOUR_STATE_KEY, JSON.stringify({ completed: true, stepIndex: activeStepIndex }));
    } catch {
      // Ignore storage failures.
    }
    setCompleted(true);
    setTarget(null);
  }

  function goToStep(stepIndex: number) {
    if (stepIndex < 0) {
      return;
    }

    if (stepIndex >= tourSteps.length) {
      completeTour();
      return;
    }

    const nextStep = tourSteps[stepIndex];
    setActiveStepIndex(stepIndex);
    setTarget(null);
    if (pathname !== nextStep.route) {
      router.push(nextStep.route);
    }
  }

  return (
    <div className="guided-tour-layer" aria-hidden="false">
      <div className="guided-tour-backdrop" />
      {target ? <div className="guided-tour-spotlight" style={spotlightStyle} /> : null}
      <section className="guided-tour-panel card" style={panelStyle} role="dialog" aria-modal="true" aria-labelledby="guided-tour-title">
        <div className="guided-tour-meta">
          <span className="page-state-eyebrow">{activeStep.section}</span>
          <span className="guided-tour-step">{activeStepIndex + 1} of {tourSteps.length}</span>
        </div>
        <h1 id="guided-tour-title">{activeStep.title}</h1>
        <p className="muted">{activeStep.description}</p>
        {activeStep.details?.length ? (
          <ol className="guided-tour-detail-list">
            {activeStep.details.map((detail) => <li key={detail}>{detail}</li>)}
          </ol>
        ) : null}
        {!isOnStepRoute ? (
          <p className="guided-tour-note">You are on a different page, so this step will move you to the right screen.</p>
        ) : null}
        {!target ? (
          <p className="guided-tour-note">I&apos;m waiting for the highlighted control to appear.</p>
        ) : null}
        <div className="page-state-actions guided-tour-actions">
          <button
            type="button"
            className="button secondary"
            disabled={activeStepIndex === 0}
            onClick={() => goToStep(activeStepIndex - 1)}
          >
            Back
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              try {
                window.localStorage.setItem(TOUR_STATE_KEY, JSON.stringify({ completed: true, stepIndex: activeStepIndex }));
              } catch {
                // Ignore storage failures.
              }
              setCompleted(true);
            }}
          >
            Skip tour
          </button>
          <button
            type="button"
            className="button"
            onClick={() => goToStep(activeStepIndex + 1)}
          >
            {activeStep.primaryLabel ?? "Next"}
          </button>
        </div>
      </section>
    </div>
  );
}

function findTarget(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const match = document.querySelector<HTMLElement>(selector);
    if (!match) continue;
    if (!isVisible(match)) continue;
    return match;
  }

  return null;
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function buildPanelStyle(rect: DOMRect | undefined, placement: TourPlacement): CSSProperties {
  const width = Math.min(420, typeof window !== "undefined" ? window.innerWidth - 24 : 420);
  const margin = 20;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const estimatedPanelHeight = Math.min(420, viewportHeight - margin * 2);
  const maxTop = Math.max(margin, viewportHeight - estimatedPanelHeight - margin);
  const clampTop = (value: number) => Math.max(margin, Math.min(value, maxTop));

  let left = margin;
  let top = maxTop;

  if (rect) {
    if (placement === "right") {
      left = Math.min(rect.right + margin, viewportWidth - width - margin);
      top = clampTop(rect.top - 8);
    } else if (placement === "top") {
      left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
      top = clampTop(rect.top - estimatedPanelHeight - margin);
    } else if (placement === "bottom") {
      left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
      top = clampTop(rect.bottom + margin);
    } else {
      left = Math.max(margin, rect.left - width - margin);
      top = clampTop(rect.top);
    }
  }

  return {
    left,
    top,
    width
  };
}

function buildSpotlightStyle(rect: DOMRect): CSSProperties {
  return {
    left: Math.max(8, rect.left - 10),
    top: Math.max(8, rect.top - 10),
    width: rect.width + 20,
    height: rect.height + 20
  };
}

export function replayGuidedTour() {
  try {
    window.localStorage.setItem(TOUR_STATE_KEY, JSON.stringify({ completed: false, stepIndex: 0 }));
  } catch {
    // Ignore storage failures and keep the replay action best-effort.
  }

  window.dispatchEvent(new Event(TOUR_REPLAY_EVENT));
}
