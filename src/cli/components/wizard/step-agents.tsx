import React from "react";
import type { AgentName } from "../../types/index.js";
import { useWizardStore } from "../../stores/wizard-store.js";
import { CheckboxGrid, type CheckboxItem } from "./checkbox-grid.js";

const AVAILABLE_AGENTS: CheckboxItem<AgentName>[] = [
  { id: "web-developer", label: "Web Developer", description: "Frontend features, components, TypeScript" },
  { id: "api-developer", label: "API Developer", description: "Backend routes, database, middleware" },
  { id: "cli-developer", label: "CLI Developer", description: "CLI commands, interactive prompts" },
  { id: "web-architecture", label: "Web Architecture", description: "App scaffolding, foundational patterns" },
  { id: "web-reviewer", label: "Web Reviewer", description: "UI component code review" },
  { id: "api-reviewer", label: "API Reviewer", description: "Backend and config code review" },
  { id: "cli-reviewer", label: "CLI Reviewer", description: "CLI code review" },
  { id: "web-researcher", label: "Web Researcher", description: "Frontend pattern discovery" },
  { id: "api-researcher", label: "API Researcher", description: "Backend pattern discovery" },
  { id: "web-tester", label: "Web Tester", description: "Frontend tests, E2E, component tests" },
  { id: "cli-tester", label: "CLI Tester", description: "CLI application tests" },
  { id: "web-pm", label: "Web PM", description: "Implementation specs and planning" },
  { id: "pattern-scout", label: "Pattern Scout", description: "Extract codebase patterns and standards" },
  { id: "web-pattern-critique", label: "Pattern Critique", description: "Critique patterns against industry standards" },
  { id: "agent-summoner", label: "Agent Summoner", description: "Create and improve agents" },
  { id: "skill-summoner", label: "Skill Summoner", description: "Create technology-specific skills" },
  { id: "documentor", label: "Documentor", description: "AI-focused documentation" },
  { id: "cli-migrator", label: "CLI Migrator", description: "Commander.js to oclif migration" },
];

export const StepAgents: React.FC = () => {
  const store = useWizardStore();

  return (
    <CheckboxGrid
      title="Select agents to compile:"
      subtitle="Toggle agents on/off, then continue"
      items={AVAILABLE_AGENTS}
      selectedIds={store.selectedAgents}
      onToggle={store.toggleAgent}
      onContinue={() => store.setStep("confirm")}
      onBack={store.goBack}
      continueLabel={(count) => `Continue with ${count} agent(s)`}
      emptyMessage="Please select at least one agent"
    />
  );
};
