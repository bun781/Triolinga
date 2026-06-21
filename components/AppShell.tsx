"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GuidedTour, replayGuidedTour } from "@/components/system/GuidedTour";

const navLinks: Array<{ href: Route<string>; label: string }> = [
  { href: "/admin/imports", label: "Lesson Builder" },
  { href: "/study/imported-content", label: "Lesson Library" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Fydor</div>
        <div className="sidebar-note" aria-label="Project note">
          <span className="pill pill-accent">Free for the people</span>
          <p>Open access by design. No paywall, no subscriptions.</p>
          <button type="button" className="button secondary sidebar-replay" onClick={replayGuidedTour}>
            Replay tutorial
          </button>
        </div>
        <nav aria-label="Primary navigation">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              data-tour={href === "/study/imported-content" ? "nav-library" : undefined}
              className={pathname === href || pathname.startsWith(href + "/") ? "nav-active" : ""}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main">{children}</main>
      <GuidedTour />
    </div>
  );
}
