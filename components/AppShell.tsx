"use client";

import {
  BookOpen,
  Brain,
  Boxes,
  ClipboardList,
  HelpCircle,
  Layers3,
  Library,
  Menu,
  PencilRuler,
  RectangleEllipsis
} from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import fyLogo from "@/Fy.png";
import { GuidedTour, replayGuidedTour } from "@/components/system/GuidedTour";
import { readSessionProgress, writeSessionProgress } from "@/components/imported-content/sessionProgress";

const APP_SHELL_PROGRESS_KEY = "app-shell";

interface AppShellProgress {
  sidebarPinned: boolean;
}

const navSections: Array<{
  label: string;
  links: Array<{ href: Route<string>; label: string; icon: React.ComponentType<{ size?: number }> }>;
}> = [
  {
    label: "Create",
    links: [
      { href: "/admin/imports", label: "Builder", icon: PencilRuler },
      { href: "/lessons/manage", label: "Lessons", icon: Library },
      { href: "/fydor-exchange", label: "Fydor Exchange", icon: Boxes }
    ]
  },
  {
    label: "Study",
    links: [
      { href: "/review", label: "Review", icon: ClipboardList },
      { href: "/study/imported-content", label: "Flashcards", icon: Layers3 },
      { href: "/study/fill-blank", label: "Fill Blank", icon: RectangleEllipsis },
      { href: "/study/multiple-choice", label: "Multiple Choice", icon: BookOpen }
    ]
  },
  {
    label: "Reference",
    links: [
      { href: "/learning-science", label: "Learning Science", icon: Brain }
    ]
  }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarPinned, setSidebarPinned] = useState(() => (
    readSessionProgress(APP_SHELL_PROGRESS_KEY, validateAppShellProgress)?.sidebarPinned ?? false
  ));

  useEffect(() => {
    writeSessionProgress(APP_SHELL_PROGRESS_KEY, { sidebarPinned } satisfies AppShellProgress);
  }, [sidebarPinned]);

  return (
    <div className={`app-shell${sidebarPinned ? " sidebar-pinned" : ""}`}>
      <Link href="/" className="app-brand" aria-label="Fydor home">
        <Image className="app-brand-mark" src={fyLogo} alt="" aria-hidden="true" priority />
        <span className="app-brand-name">Fydor</span>
      </Link>
      <aside className="sidebar" aria-label="App navigation">
        <div className="sidebar-top">
          <button
            type="button"
            className="icon-button sidebar-toggle"
            aria-label={sidebarPinned ? "Collapse navigation" : "Expand navigation"}
            aria-pressed={sidebarPinned}
            onClick={() => setSidebarPinned((current) => !current)}
          >
            <Menu size={19} />
          </button>
        </div>

        <nav aria-label="Primary navigation">
          {navSections.map((section) => (
            <div className="sidebar-section" key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  data-tour={href === "/lessons/manage" ? "nav-library" : undefined}
                  className={pathname === href || pathname.startsWith(href + "/") ? "nav-active" : ""}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <button
          type="button"
          className="icon-button sidebar-help"
          aria-label="Open page guide"
          onClick={() => replayGuidedTour()}
        >
          <HelpCircle size={17} />
        </button>

        <div className="sidebar-note" aria-label="Project note">
          <span className="pill pill-accent">Free for the people</span>
          <p>Open access by design. No paywall, no subscriptions.</p>
        </div>
      </aside>
      <main className="main">{children}</main>
      <GuidedTour />
    </div>
  );
}

function validateAppShellProgress(value: unknown): AppShellProgress | null {
  if (!value || typeof value !== "object") return null;
  const sidebarPinned = (value as Partial<AppShellProgress>).sidebarPinned;
  return typeof sidebarPinned === "boolean" ? { sidebarPinned } : null;
}
