"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";

type TourPlacement = "top" | "bottom" | "left" | "right";

interface TourStep {
  route: Route<string>;
  title: string;
  description: string;
  targetSelectors: string[];
  placement?: TourPlacement;
  primaryLabel?: string;
}

interface TourTargetState {
  rect: DOMRect;
  element: HTMLElement;
}

const TOUR_STATE_KEY = "fydor-guided-tour-state-v1";

const tourSteps: TourStep[] = [
  {
    route: "/admin/imports",
    title: "Is this your first time using Fydor to help you learn a language?",
    description: "Start with a sample lesson so you can see the builder, save it, and move into the library.",
    targetSelectors: ['[data-tour="lesson-sample"]'],
    placement: "bottom",
    primaryLabel: "Next"
  },
  {
    route: "/admin/imports",
    title: "Save the lesson",
    description: "When the lesson looks right, save it so it appears in your local lesson library.",
    targetSelectors: ['[data-tour="lesson-save"]'],
    placement: "top",
    primaryLabel: "Next"
  },
  {
    route: "/study/imported-content",
    title: "Open the Lesson Library",
    description: "This sidebar link takes you from lesson building to studying the lessons you saved.",
    targetSelectors: ['[data-tour="nav-library"]'],
    placement: "right",
    primaryLabel: "Next"
  },
  {
    route: "/study/imported-content",
    title: "Start a study pass",
    description: "Use Start Review when a lesson is ready. If the library is empty, this page will guide you toward importing one.",
    targetSelectors: ['[data-tour="study-start-review"]', '[data-tour="study-import"]'],
    placement: "top",
    primaryLabel: "Next"
  },
  {
    route: "/study/imported-content",
    title: "Reveal one layer at a time",
    description: "Translation, words, grammar, and hints can be turned on separately while you study.",
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
          <span className="page-state-eyebrow">Guided tour</span>
          <span className="guided-tour-step">{activeStepIndex + 1} of {tourSteps.length}</span>
        </div>
        <h1 id="guided-tour-title">{activeStep.title}</h1>
        <p className="muted">{activeStep.description}</p>
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
  const width = Math.min(360, typeof window !== "undefined" ? window.innerWidth - 24 : 360);
  const margin = 20;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;

  let left = margin;
  let top = viewportHeight - 220 - margin;

  if (rect) {
    if (placement === "right") {
      left = Math.min(rect.right + margin, viewportWidth - width - margin);
      top = Math.max(margin, Math.min(rect.top - 8, viewportHeight - 260 - margin));
    } else if (placement === "top") {
      left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
      top = Math.max(margin, rect.top - 260 - margin);
    } else if (placement === "bottom") {
      left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
      top = Math.min(viewportHeight - 260 - margin, rect.bottom + margin);
    } else {
      left = Math.max(margin, rect.left - width - margin);
      top = Math.max(margin, Math.min(rect.top, viewportHeight - 260 - margin));
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
