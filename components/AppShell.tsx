"use client";

import {
  BookOpen,
  Brain,
  Boxes,
  ClipboardList,
  Layers3,
  Library,
  Menu,
  PencilRuler,
  RectangleEllipsis
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GuidedTour, replayGuidedTour } from "@/components/system/GuidedTour";

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
  const [sidebarPinned, setSidebarPinned] = useState(false);

  return (
    <div className={`app-shell${sidebarPinned ? " sidebar-pinned" : ""}`}>
      <Link href="/" className="app-brand" aria-label="Fydor home">
        <span className="app-brand-mark" aria-hidden="true">F</span>
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

        <div className="sidebar-note" aria-label="Project note">
          <span className="pill pill-accent">Free for the people</span>
          <p>Open access by design. No paywall, no subscriptions.</p>
          <button type="button" className="button secondary sidebar-replay" onClick={replayGuidedTour}>
            Replay tutorial
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
      <GuidedTour />
    </div>
  );
}
