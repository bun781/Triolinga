import { describe, expect, it } from "vitest";
import { importGuideSections, importPromptTemplates } from "@/lib/language/importResources";

describe("import resources", () => {
  it("contains guide coverage for format, fields, examples, and mistakes", () => {
    expect(importGuideSections.map((section) => section.title)).toEqual([
      "Supported JSON format",
      "Required fields",
      "Optional fields",
      "Examples",
      "Common mistakes"
    ]);
  });

  it("provides copyable prompt templates for each lesson type", () => {
    expect(importPromptTemplates.map((template) => template.id)).toEqual([
      "beginner",
      "intermediate",
      "vocabulary",
      "grammar"
    ]);

    for (const template of importPromptTemplates) {
      expect(template.prompt).toContain("Return JSON only");
      expect(template.prompt.length).toBeGreaterThan(200);
    }
  });
});
