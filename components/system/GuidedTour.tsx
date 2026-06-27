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
  targetSelectors?: string[];
  placement?: TourPlacement;
  primaryLabel?: string;
}

interface TourTargetState {
  rect: DOMRect;
  element: HTMLElement;
}

interface TourReplayDetail {
  scope?: string;
}

const TOUR_REPLAY_EVENT = "fydor-guided-tour:replay";

const tourCatalog: Record<string, TourStep[]> = {
  "/lessons/manage::builder": [
    {
      route: "/lessons/manage",
      section: "Lesson Manager",
      title: "Start from a sample lesson",
      description: "The builder tab is the easiest place to learn the lesson shape before you paste your own content.",
      details: [
        "Sample lesson fills the editor with a complete example you can safely edit.",
        "Builder mode shows the lesson as visible fields instead of raw JSON.",
        "Use this tab when you want to create or tweak a lesson by hand."
      ],
      targetSelectors: ['[data-tour="lesson-sample"]'],
      placement: "bottom"
    },
    {
      route: "/lessons/manage",
      section: "Lesson Manager",
      title: "Builder mode is the friendly editor",
      description: "Use Builder when you want a visible form and fast feedback while drafting lessons.",
      details: [
        "You can switch back and forth with JSON mode at any time.",
        "The Builder tab stays best when you are shaping one lesson sentence by sentence."
      ],
      targetSelectors: ['[data-tour="lesson-editor-mode"]'],
      placement: "bottom"
    },
    {
      route: "/lessons/manage",
      section: "Lesson Manager",
      title: "Check before you save",
      description: "Check catches format issues early, and Save commits the lesson once it looks right.",
      details: [
        "Use Check to spot missing fields or invalid lesson structure.",
        "Use Preview when you want to inspect the lesson before saving.",
        "Save writes the lesson into the local library."
      ],
      targetSelectors: ['[data-tour="lesson-check"]', '[data-tour="lesson-save"]'],
      placement: "top",
      primaryLabel: "Finish"
    }
  ],
  "/lessons/manage::json": [
    {
      route: "/lessons/manage",
      section: "Lesson Manager",
      title: "Paste complete lesson JSON here",
      description: "The JSON tab is for AI output or hand-written lesson files that are already structured.",
      details: [
        "Paste only valid JSON, without extra commentary around it.",
        "The JSON tab is useful when another tool already generated the lesson for you."
      ],
      targetSelectors: ['[data-tour="lesson-json-mode"]'],
      placement: "bottom"
    },
    {
      route: "/lessons/manage",
      section: "Lesson Manager",
      title: "Use the guide if the format is unclear",
      description: "Open the import help panel for schema guidance and prompt templates.",
      details: [
        "The guide explains required fields, optional fields, and examples.",
        "Prompt templates are ready to paste into ChatGPT or another assistant."
      ],
      targetSelectors: ['[data-tour="import-guide"]', '[data-tour="import-prompts"]'],
      placement: "bottom"
    },
    {
      route: "/lessons/manage",
      section: "Lesson Manager",
      title: "Validate before saving",
      description: "Check and Save still matter most on the JSON tab, because they catch bad lesson data before it reaches study mode.",
      details: [
        "Check gives you a fast validation pass.",
        "Save only when the lesson is structurally sound."
      ],
      targetSelectors: ['[data-tour="lesson-check"]', '[data-tour="lesson-save"]'],
      placement: "top",
      primaryLabel: "Finish"
    }
  ],
  "/lessons/manage::lessons": [
    {
      route: "/lessons/manage",
      section: "Lesson Library",
      title: "Browse your saved lessons",
      description: "The Lessons tab is the library view for opening, exporting, or deleting saved lessons.",
      details: [
        "New lesson creates a blank lesson in the editor.",
        "Saved lessons can be reopened for editing or exported as JSON.",
        "This tab is where you manage lessons after they are already saved."
      ],
      targetSelectors: ['[data-tour="lesson-library-new"]', '[data-tour="lesson-library-list"]'],
      placement: "bottom"
    },
    {
      route: "/lessons/manage",
      section: "Lesson Library",
      title: "Open, export, or delete a lesson",
      description: "Choose a lesson and use the action buttons on the right to work with it.",
      details: [
        "Open in editor returns the lesson to the builder.",
        "Export JSON lets you share or back up a lesson.",
        "Delete removes the lesson from the library."
      ],
      targetSelectors: ['[data-tour="lesson-library-actions"]'],
      placement: "left",
      primaryLabel: "Finish"
    }
  ],
  "/lessons/manage::help-guide": [
    {
      route: "/lessons/manage",
      section: "Import Help",
      title: "Read the lesson guide first",
      description: "The guide explains the lesson schema, required fields, and good examples before you paste AI output into the editor.",
      details: [
        "Use it when you are unsure what a lesson field should look like.",
        "The examples show the structure Fydor expects."
      ],
      targetSelectors: ['[data-tour="import-guide-panel"]'],
      placement: "right"
    },
    {
      route: "/lessons/manage",
      section: "Import Help",
      title: "Use prompt templates when you want AI help",
      description: "Prompt templates are the faster path if you want another model to draft the lesson for you.",
      details: [
        "The templates are designed to be copied into an AI tool and customized.",
        "Switch to the prompt tab when you want the assistant to do the drafting."
      ],
      targetSelectors: ['[data-tour="import-prompts"]'],
      placement: "right",
      primaryLabel: "Finish"
    }
  ],
  "/lessons/manage::help-prompts": [
    {
      route: "/lessons/manage",
      section: "Import Help",
      title: "Copy a template and customize it",
      description: "Prompt templates are ready-made instructions for lesson generation and cleanup.",
      details: [
        "Use Copy to move a template into your clipboard.",
        "Replace the language, topic, and difficulty to match your lesson."
      ],
      targetSelectors: ['[data-tour="import-prompts-panel"]'],
      placement: "right"
    },
    {
      route: "/lessons/manage",
      section: "Import Help",
      title: "Return to the guide if you need schema help",
      description: "The guide tab is better when you need to check fields, examples, or validation rules.",
      details: [
        "Go back to Guide when you need a schema refresher.",
        "Use Check in the editor once the JSON is ready."
      ],
      targetSelectors: ['[data-tour="import-guide"]'],
      placement: "right",
      primaryLabel: "Finish"
    }
  ],
  "/review::start": [
    {
      route: "/review",
      section: "Review",
      title: "Pick a review mix",
      description: "The Start tab is where you choose which lessons and which queue style to practice.",
      details: [
        "Select the lessons you want to include in the session.",
        "Start Mixed Review blends due, new, and later cards together.",
        "Due only and New only let you narrow the queue."
      ],
      targetSelectors: ['[data-tour="review-start-tabs"]', '[data-tour="review-start-mixed"]'],
      placement: "bottom"
    },
    {
      route: "/review",
      section: "Review",
      title: "Use the queue dashboard",
      description: "The dashboard shows how much due, new, and mastered material is waiting.",
      details: [
        "It helps you decide whether to do a quick pass or a longer mixed session.",
        "Reset Progress is there when you want to restart a lesson's review state."
      ],
      targetSelectors: ['[data-tour="review-queue-dashboard"]', '[data-tour="review-reset-progress"]'],
      placement: "right",
      primaryLabel: "Finish"
    }
  ],
  "/review::statistics": [
    {
      route: "/review",
      section: "Review",
      title: "See what still needs work",
      description: "The Statistics tab groups remembered and needs-review items so the next target is obvious.",
      details: [
        "Use the stat cards to jump between sentences, words, grammar, and chunks.",
        "Search and sort help you narrow the list when the deck gets larger."
      ],
      targetSelectors: ['[data-tour="review-statistics-tab"]', '[data-tour="review-stats-dashboard"]'],
      placement: "bottom"
    },
    {
      route: "/review",
      section: "Review",
      title: "Reset from the list when needed",
      description: "Each row can be reset independently if you want to clear progress on one item.",
      details: [
        "The reset action is useful when a card was marked too easily or needs a fresh start."
      ],
      targetSelectors: ['[data-tour="review-stats-list"]'],
      placement: "left",
      primaryLabel: "Finish"
    }
  ],
  "/fydor-exchange": [
    {
      route: "/fydor-exchange",
      section: "Fydor Exchange",
      title: "Install shared lesson packs",
      description: "The Install Pack area is where you preview and import a Fydor Pack from a file or pasted JSON.",
      details: [
        "Preview checks the pack structure before anything is installed.",
        "Duplicate handling decides whether old lessons are skipped, replaced, or kept."
      ],
      targetSelectors: ['[data-tour="exchange-install"]'],
      placement: "bottom"
    },
    {
      route: "/fydor-exchange",
      section: "Fydor Exchange",
      title: "Export your own packs",
      description: "The Share Pack area turns selected lessons into a portable .fydorpack file.",
      details: [
        "Pick one or more lessons, fill in metadata, then build a preview before exporting.",
        "Export all is handy when you want a pack from every saved lesson."
      ],
      targetSelectors: ['[data-tour="exchange-share"]'],
      placement: "bottom"
    },
    {
      route: "/fydor-exchange",
      section: "Fydor Exchange",
      title: "Manage installed packs",
      description: "My Packs keeps track of installed pack metadata so you can search and filter later.",
      details: [
        "Search by pack title, author, organization, tags, or included lessons.",
        "This view helps you inspect what is already installed on the device."
      ],
      targetSelectors: ['[data-tour="exchange-library"]'],
      placement: "top",
      primaryLabel: "Finish"
    }
  ],
  "/study/imported-content": [
    {
      route: "/study/imported-content",
      section: "Flashcards",
      title: "Choose a lesson to study",
      description: "Flashcards show one saved lesson at a time and let you switch between language groups and lesson sets.",
      details: [
        "Use the selectors to move between languages and lessons.",
        "The page opens to the currently selected lesson and remembers your last choice."
      ],
      targetSelectors: ['[data-tour="study-selector-bar"]'],
      placement: "bottom"
    },
    {
      route: "/study/imported-content",
      section: "Flashcards",
      title: "Reveal the sentence layer by layer",
      description: "Translation, words, grammar, and hints are meant to be opened gradually.",
      details: [
        "Try to answer before revealing anything.",
        "Translation should usually be the last thing you show yourself."
      ],
      targetSelectors: ['[data-tour="study-translation"]'],
      placement: "top",
      primaryLabel: "Finish"
    }
  ],
  "/study/fill-blank": [
    {
      route: "/study/fill-blank",
      section: "Fill Blank",
      title: "Use fill blank for active recall",
      description: "This mode turns saved lessons into a missing-word practice session.",
      details: [
        "It is useful when you recognize a sentence but still want to produce part of it yourself.",
        "The same lesson library powers this mode and the other study pages."
      ],
      targetSelectors: ['[data-tour="study-mode-title"]'],
      placement: "bottom",
      primaryLabel: "Finish"
    }
  ],
  "/study/multiple-choice": [
    {
      route: "/study/multiple-choice",
      section: "Multiple Choice",
      title: "Use multiple choice for faster recognition",
      description: "This mode quizzes the same saved lesson pool with answer choices instead of free recall.",
      details: [
        "It is helpful when you want a quicker pass or a lighter practice session.",
        "Use it alongside flashcards and fill blank, not as a replacement."
      ],
      targetSelectors: ['[data-tour="study-mode-title"]'],
      placement: "bottom",
      primaryLabel: "Finish"
    }
  ],
  "/learning-science": [
    {
      route: "/learning-science",
      section: "Learning Science",
      title: "The page explains why Fydor works",
      description: "This page summarizes the memory principles behind the review flow.",
      details: [
        "Retrieval practice and spaced repetition are the main ideas behind the review loop.",
        "The Start Review button takes you back into the practice flow."
      ],
      targetSelectors: ['[data-tour="learning-science-start"]', '[data-tour="learning-science-page"]'],
      placement: "left",
      primaryLabel: "Finish"
    }
  ]
};

export function createTourScope(route: string, tab?: string) {
  return tab ? `${route}::${tab}` : route;
}

export function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [activeScope, setActiveScope] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [target, setTarget] = useState<TourTargetState | null>(null);

  const activeSteps = useMemo(() => {
    if (!activeScope) return null;
    return getTourSteps(activeScope);
  }, [activeScope]);

  const activeStep = useMemo(() => {
    if (!activeSteps) return null;
    return activeSteps[activeStepIndex] ?? null;
  }, [activeStepIndex, activeSteps]);

  useEffect(() => {
    setMounted(true);

    function handleReplayTour(event: Event) {
      const detail = (event as CustomEvent<TourReplayDetail>).detail;
      const scope = resolveScope(detail?.scope ?? pathname);
      if (!getTourSteps(scope)) return;

      setActiveScope(scope);
      setActiveStepIndex(0);
      setTarget(null);
    }

    window.addEventListener(TOUR_REPLAY_EVENT, handleReplayTour as EventListener);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, handleReplayTour as EventListener);
  }, [pathname]);

  useEffect(() => {
    if (!mounted || !activeStep) return;

    const selectors = activeStep.targetSelectors ?? [];
    if (!selectors.length) {
      setTarget(null);
      return;
    }

    let animationFrame = 0;
    let interval = 0;

    function updateTarget() {
      const resolved = findTarget(selectors);
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

  if (!mounted || !activeSteps || !activeStep) {
    return null;
  }

  const isOnStepRoute = pathname === activeStep.route;
  const panelStyle = buildPanelStyle(target?.rect, activeStep.placement ?? "bottom");
  const spotlightStyle = target ? buildSpotlightStyle(target.rect) : undefined;

  function closeTour() {
    setActiveScope(null);
    setActiveStepIndex(0);
    setTarget(null);
  }

  function goToStep(stepIndex: number) {
    if (stepIndex < 0) return;
    const steps = activeSteps;
    if (!steps) return;
    if (stepIndex >= steps.length) {
      closeTour();
      return;
    }

    const nextStep = steps[stepIndex];
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
          <span className="guided-tour-step">{activeStepIndex + 1} of {activeSteps.length}</span>
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
        {!target && activeStep.targetSelectors?.length ? (
          <p className="guided-tour-note">I&apos;m waiting for the highlighted control to appear.</p>
        ) : null}
        {!activeStep.targetSelectors?.length ? (
          <p className="guided-tour-note">This step explains the current view without a spotlight target.</p>
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
          <button type="button" className="button secondary" onClick={closeTour}>
            Skip tour
          </button>
          <button type="button" className="button" onClick={() => goToStep(activeStepIndex + 1)}>
            {activeStep.primaryLabel ?? "Next"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function replayGuidedTour(scope?: string) {
  const resolvedScope = typeof window === "undefined"
    ? scope
    : resolveScope(scope ?? window.location.pathname);

  if (!resolvedScope || !getTourSteps(resolvedScope)) {
    return;
  }

  window.dispatchEvent(new CustomEvent<TourReplayDetail>(TOUR_REPLAY_EVENT, {
    detail: { scope: resolvedScope }
  }));
}

function getTourSteps(scope: string) {
  return tourCatalog[scope] ?? tourCatalog[scope.split("::")[0]] ?? null;
}

function resolveScope(scope: string) {
  if (tourCatalog[scope]) return scope;

  const alias = scopeAliases[scope];
  if (alias) return alias;

  const defaultScope = defaultScopes[scope];
  if (defaultScope) return defaultScope;

  return scope;
}

const scopeAliases: Record<string, string> = {
  "/": "/lessons/manage",
  "/lessons/import": "/lessons/manage",
  "/lessons/import/preview": "/lessons/manage"
};

const defaultScopes: Record<string, string> = {
  "/lessons/manage": "/lessons/manage::builder",
  "/review": "/review::start",
  "/fydor-exchange": "/fydor-exchange",
  "/study/imported-content": "/study/imported-content",
  "/study/fill-blank": "/study/fill-blank",
  "/study/multiple-choice": "/study/multiple-choice",
  "/learning-science": "/learning-science"
};

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
