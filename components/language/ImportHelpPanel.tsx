"use client";

import { Check, Copy, HelpCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { importGuideSections, importPromptTemplates } from "@/lib/language/importResources";
import { Tooltip } from "@/components/ui/Tooltip";
import { createTourScope, replayGuidedTour } from "@/components/system/GuidedTour";

type HelpTab = "guide" | "prompts";

export function ImportHelpPanel() {
  const [tab, setTab] = useState<HelpTab>("guide");
  const [isOpen, setIsOpen] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const copiedTemplate = useMemo(
    () => importPromptTemplates.find((template) => template.id === copiedPromptId) ?? null,
    [copiedPromptId]
  );

  useEffect(() => {
    if (!copiedTemplate) return;
    const timeout = window.setTimeout(() => setCopiedPromptId(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [copiedTemplate]);

  async function copyPrompt(prompt: string, id: string) {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPromptId(id);
    } catch {
      setCopiedPromptId(null);
    }
  }

  function toggleHelp() {
    setIsOpen((current) => !current);
  }

  return (
    <div className="import-help-toggle">
      <Tooltip content="Show guide and prompt templates.">
        <button
          className={`icon-button import-help-button${isOpen ? " active" : ""}`}
          type="button"
          aria-label="Help"
          aria-expanded={isOpen}
          data-tour="import-guide"
          onClick={toggleHelp}
        >
          <HelpCircle size={17} />
        </button>
      </Tooltip>

      {isOpen ? (
        <section className="card stack import-help-panel">
          <div className="row">
            <div>
              <h2>Guide & prompt templates</h2>
              <p className="muted">Use the guide to validate lesson JSON, or copy a prompt template into your AI model of choice.</p>
            </div>
          </div>

      <div className="mode-tabs import-help-tabs" role="tablist" aria-label="Lesson import help">
        <button className={tab === "guide" ? "active" : ""} type="button" onClick={() => setTab("guide")}>
          Guide
        </button>
        <button className={tab === "prompts" ? "active" : ""} type="button" data-tour="import-prompts" onClick={() => setTab("prompts")}>
          Prompt templates
        </button>
        <Tooltip content={tab === "guide" ? "Open the guide walkthrough." : "Open the prompt template walkthrough."}>
          <button
            className="icon-button"
            type="button"
            aria-label="Open import help walkthrough"
            onClick={() => replayGuidedTour(createTourScope("/lessons/manage", tab === "guide" ? "help-guide" : "help-prompts"))}
          >
            <HelpCircle size={17} />
          </button>
        </Tooltip>
      </div>

          {tab === "guide" ? (
            <div className="stack" data-tour="import-guide-panel">
              {importGuideSections.map((section) => (
                <article className="help-section" key={section.title}>
                  <h3>{section.title}</h3>
                  <p className="muted">{section.description}</p>
                  {section.items ? (
                    <ul className="help-list">
                      {section.items.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : null}
                  {section.examples ? (
                    <div className="help-examples">
                      {section.examples.map((example) => (
                        <article className="help-example" key={example.title}>
                          <div className="row">
                            <strong>{example.title}</strong>
                            <span className="pill">{example.description}</span>
                          </div>
                          <pre className="summary-json help-code">{example.json}</pre>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="stack" data-tour="import-prompts-panel">
              {importPromptTemplates.map((template) => (
                <article className="help-section stack" key={template.id}>
                  <div className="row">
                    <div>
                      <h3>{template.title}</h3>
                      <p className="muted">{template.description}</p>
                    </div>
                    <Tooltip content="Copy this prompt template.">
                      <button className="button secondary" type="button" onClick={() => void copyPrompt(template.prompt, template.id)}>
                        {copiedPromptId === template.id ? <Check size={16} /> : <Copy size={16} />}
                        {copiedPromptId === template.id ? "Copied" : "Copy"}
                      </button>
                    </Tooltip>
                  </div>
                  <pre className="summary-json help-code">{template.prompt}</pre>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
