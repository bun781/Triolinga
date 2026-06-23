"use client";

import { AppShell } from "@/components/AppShell";
import { ImportedContentWorkspace } from "@/components/imported-content/ImportedContentWorkspace";

export default function FillBlankPage() {
  return (
    <AppShell>
      <ImportedContentWorkspace mode="fill-blank" />
    </AppShell>
  );
}
