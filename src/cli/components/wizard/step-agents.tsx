import { Box, Text, useInput } from "ink";
import React, { useRef, useState } from "react";
import { CLI_COLORS, SCROLL_VIEWPORT, UI_SYMBOLS } from "../../consts.js";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { AgentName } from "../../types/index.js";
import { useMeasuredHeight } from "../hooks/use-measured-height.js";

type AgentItem = {
  id: AgentName;
  label: string;
  description: string;
};

type AgentGroup = {
  label: string;
  items: AgentItem[];
};

const AGENT_GROUPS: AgentGroup[] = [
  {
    label: "Web",
    items: [
      {
        id: "web-developer",
        label: "Web Developer",
        description: "Frontend features, components, TypeScript",
      },
      { id: "web-reviewer", label: "Web Reviewer", description: "UI component code review" },
      { id: "web-researcher", label: "Web Researcher", description: "Frontend pattern discovery" },
      {
        id: "web-tester",
        label: "Web Tester",
        description: "Frontend tests, E2E, component tests",
      },
      { id: "web-pm", label: "Web PM", description: "Implementation specs and planning" },
      {
        id: "web-architecture",
        label: "Web Architecture",
        description: "App scaffolding, foundational patterns",
      },
      {
        id: "web-pattern-critique",
        label: "Pattern Critique",
        description: "Critique patterns against industry standards",
      },
    ],
  },
  {
    label: "API",
    items: [
      {
        id: "api-developer",
        label: "API Developer",
        description: "Backend routes, database, middleware",
      },
      { id: "api-reviewer", label: "API Reviewer", description: "Backend and config code review" },
      { id: "api-researcher", label: "API Researcher", description: "Backend pattern discovery" },
    ],
  },
  {
    label: "CLI",
    items: [
      {
        id: "cli-developer",
        label: "CLI Developer",
        description: "CLI commands, interactive prompts",
      },
      { id: "cli-tester", label: "CLI Tester", description: "CLI application tests" },
      { id: "cli-reviewer", label: "CLI Reviewer", description: "CLI code review" },
      { id: "cli-migrator", label: "CLI Migrator", description: "Commander.js to oclif migration" },
    ],
  },
  {
    label: "Meta",
    items: [
      {
        id: "pattern-scout",
        label: "Pattern Scout",
        description: "Extract codebase patterns and standards",
      },
      { id: "agent-summoner", label: "Agent Summoner", description: "Create and improve agents" },
      {
        id: "skill-summoner",
        label: "Skill Summoner",
        description: "Create technology-specific skills",
      },
      { id: "documentor", label: "Documentor", description: "AI-focused documentation" },
    ],
  },
];

type FocusId = AgentName | "continue";

const FOCUSABLE_IDS: FocusId[] = [
  ...AGENT_GROUPS.flatMap((group) => group.items.map((a) => a.id)),
  "continue",
];

type ListRow =
  | { type: "header"; label: string }
  | { type: "spacer" }
  | { type: "agent"; agent: AgentItem };

const FLAT_ROWS: ListRow[] = AGENT_GROUPS.flatMap((group, groupIndex): ListRow[] => [
  ...(groupIndex > 0 ? [{ type: "spacer" as const }] : []),
  { type: "header" as const, label: group.label },
  ...group.items.map((agent): ListRow => ({ type: "agent", agent })),
]);

export const StepAgents: React.FC = () => {
  const store = useWizardStore();
  const [focusedId, setFocusedId] = useState<FocusId>(FOCUSABLE_IDS[0]!);
  const { ref: listRef, measuredHeight: listHeight } = useMeasuredHeight();

  const scrollTopRef = useRef(0);
  const scrollEnabled = listHeight > 0 && listHeight >= SCROLL_VIEWPORT.MIN_VIEWPORT_ROWS;

  if (scrollEnabled && focusedId !== "continue") {
    const rowIndex = FLAT_ROWS.findIndex(
      (row) => row.type === "agent" && row.agent.id === focusedId,
    );
    if (rowIndex >= 0) {
      if (rowIndex < scrollTopRef.current) {
        scrollTopRef.current = rowIndex;
      } else if (rowIndex + 1 > scrollTopRef.current + listHeight) {
        scrollTopRef.current = rowIndex + 1 - listHeight;
      }
    }
  }

  useInput((input, key) => {
    if (key.escape) {
      store.goBack();
      return;
    }

    const currentIdx = FOCUSABLE_IDS.indexOf(focusedId);

    if (key.upArrow || input === "k") {
      const nextIdx = currentIdx <= 0 ? FOCUSABLE_IDS.length - 1 : currentIdx - 1;
      setFocusedId(FOCUSABLE_IDS[nextIdx]!);
      return;
    }

    if (key.downArrow || input === "j") {
      const nextIdx = currentIdx >= FOCUSABLE_IDS.length - 1 ? 0 : currentIdx + 1;
      setFocusedId(FOCUSABLE_IDS[nextIdx]!);
      return;
    }

    if (key.return) {
      store.setStep("confirm");
      return;
    }

    if (input === " " && focusedId !== "continue") {
      store.toggleAgent(focusedId);
    }
  });

  const selectedCount = store.selectedAgents.length;
  const continueLabel =
    selectedCount > 0 ? `Continue with ${selectedCount} agent(s)` : "Continue without agents";

  const isContinueFocused = focusedId === "continue";

  const rowElements = FLAT_ROWS.map((row, index) => {
    switch (row.type) {
      case "header":
        return (
          <Box key={`header-${row.label}`} flexShrink={0}>
            <Text dimColor bold>
              {"  "}
              {row.label}
            </Text>
          </Box>
        );
      case "spacer":
        return (
          <Box key={`spacer-${index}`} flexShrink={0}>
            <Text> </Text>
          </Box>
        );
      case "agent": {
        const isFocused = row.agent.id === focusedId;
        const isSelected = store.selectedAgents.includes(row.agent.id);
        const checkbox = isSelected ? "[\u2713]" : "[ ]";
        const pointer = isFocused ? UI_SYMBOLS.CURRENT : " ";
        return (
          <Box key={row.agent.id} flexShrink={0}>
            <Text>
              <Text color={isFocused ? CLI_COLORS.PRIMARY : undefined}>{pointer}</Text>
              <Text
                color={isSelected || isFocused ? CLI_COLORS.PRIMARY : undefined}
                bold={isFocused}
              >
                {" "}
                {checkbox} {row.agent.label}
              </Text>
              <Text dimColor> - {row.agent.description}</Text>
            </Text>
          </Box>
        );
      }
    }
  });

  return (
    <Box flexDirection="column" width="100%" flexGrow={1} flexBasis={0}>
      <Text bold>Select agents to compile:</Text>
      <Text dimColor>Toggle agents on/off, then continue</Text>

      {!scrollEnabled ? (
        <Box ref={listRef} flexDirection="column" flexGrow={1} flexBasis={0} overflow="hidden">
          {rowElements}
        </Box>
      ) : (
        <Box ref={listRef} flexDirection="column" flexGrow={1} flexBasis={0}>
          <Box flexDirection="column" overflow="hidden" flexGrow={1}>
            <Box
              flexDirection="column"
              marginTop={scrollTopRef.current > 0 ? -scrollTopRef.current : 0}
              flexShrink={0}
            >
              {rowElements}
            </Box>
          </Box>
        </Box>
      )}

      <Text color={isContinueFocused ? CLI_COLORS.PRIMARY : undefined} bold={isContinueFocused}>
        {isContinueFocused ? UI_SYMBOLS.CURRENT : " "} {"\u2192"} {continueLabel}
      </Text>
    </Box>
  );
};
