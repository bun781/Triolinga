"use client";

import { AppShell } from "@/components/AppShell";
import { ImportedContentWorkspace } from "@/components/imported-content/ImportedContentWorkspace";

export default function ImportedContentPage() {
  return (
    <AppShell>
      <ImportedContentWorkspace />
    </AppShell>
  );
}
