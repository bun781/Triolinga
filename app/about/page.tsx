"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";

const githubUrl = "https://github.com/bun781/Triolinga";

export default function AboutPage() {
  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>About Us</h1>
          <p className="muted">What Fydor is, why it exists, and where the code lives.</p>
        </div>
        <Link className="button" href={githubUrl} target="_blank" rel="noreferrer">
          View on GitHub
        </Link>
      </div>

      <section className="grid grid-2 about-page">
        <article className="card stack about-hero">
          <span className="pill pill-accent">Local-first language learning</span>
          <h2>Fydor turns lesson material into structured study.</h2>
          <p>
            Fydor is a language learning app built around a simple loop: create or import lessons,
            validate the content, study in different practice modes, and review the sentences you forget.
            It is designed to keep learning lightweight, portable, and focused on real usage.
          </p>
          <p className="muted">
            The repository is named <strong>Habitz</strong>, but the app itself is branded as <strong>Fydor</strong>.
          </p>
        </article>

        <article className="card stack">
          <h2>What it does</h2>
          <div className="stack about-list">
            <p><strong>Lesson building:</strong> create structured lesson content and keep it organized.</p>
            <p><strong>Study modes:</strong> practice with imported content, fill-in-the-blank, and multiple choice.</p>
            <p><strong>Review queue:</strong> revisit forgotten sentences sooner with spaced repetition.</p>
            <p><strong>Sharing:</strong> export and import lessons through Fydor Exchange.</p>
          </div>
        </article>

        <article className="card stack">
          <h2>Source and project home</h2>
          <p>
            The full app source is available on GitHub. That is the best place to inspect the codebase,
            follow changes, and learn how the study system is built.
          </p>
          <Link className="button secondary" href={githubUrl} target="_blank" rel="noreferrer">
            Open repository
          </Link>
        </article>

        <article className="card stack">
          <h2>Built for</h2>
          <p>
            People who want a simple, local-first way to turn language materials into reusable study sessions
            without subscriptions, paywalls, or unnecessary friction.
          </p>
        </article>
      </section>
    </AppShell>
  );
}
