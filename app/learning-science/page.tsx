"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function LearningSciencePage() {
  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Learning Science</h1>
          <p className="muted">The study principles behind Fydor review.</p>
        </div>
        <Link className="button" href="/review">Start Review</Link>
      </div>

      <section className="learning-science learning-science-page">
        <div>
          <h2>Review Methods</h2>
          <p className="muted">Fydor uses lightweight memory mechanics built around sentences.</p>
        </div>
        <div className="learning-science-grid">
          <p><strong>Spaced Repetition</strong> - difficult sentences return sooner; mastered sentences appear less often.</p>
          <p><strong>Retrieval Practice</strong> - recall the sentence before revealing the answer.</p>
          <p><strong>Interleaving</strong> - review mixes sentences from different lessons.</p>
          <p><strong>Generation Effect</strong> - fill blanks or produce translations yourself.</p>
          <p><strong>Desirable Difficulties</strong> - hints are gradually removed as memory improves.</p>
          <p><strong>Portable Content</strong> - lesson packs keep practice material dependency-free and teacher-shareable.</p>
        </div>
      </section>
    </AppShell>
  );
}
