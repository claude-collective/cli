import { Box, Text, useInput } from "ink";
import React, { useMemo, useState } from "react";
import { CLI_COLORS, UI_SYMBOLS } from "../../consts.js";
import { useRowScroll } from "../hooks/use-row-scroll.js";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { AgentName, MergedSkillsMatrix } from "../../types/index.js";
import { typedKeys } from "../../utils/typed-object.js";
import { useMeasuredHeight } from "../hooks/use-measured-height.js";
import { getDomainDisplayName } from "./utils.js";
import { ViewTitle } from "./view-title.js";

type AgentItem = {
  id: AgentName;
  label: string;
  description: string;
};

type AgentGroup = {
  label: string;
  items: AgentItem[];
};

const BUILT_IN_AGENT_GROUPS: AgentGroup[] = [
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
        label: "Web Pattern Critique",
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

/** IDs of all built-in agents for fast lookup. */
const BUILT_IN_AGENT_IDS = new Set<string>(
  BUILT_IN_AGENT_GROUPS.flatMap((group) => group.items.map((a) => a.id)),
);

/** Convert a kebab-case agent ID to a title-case label. */
function agentIdToLabel(id: string): string {
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type FocusId = AgentName | "continue";

type ListRow =
  | { type: "header"; label: string }
  | { type: "spacer" }
  | { type: "agent"; agent: AgentItem };

function buildAgentGroups(matrix: MergedSkillsMatrix): AgentGroup[] {
  const customAgentIds: string[] = [];
  for (const stack of matrix.suggestedStacks) {
    for (const agentName of typedKeys(stack.skills)) {
      if (!BUILT_IN_AGENT_IDS.has(agentName) && !customAgentIds.includes(agentName)) {
        customAgentIds.push(agentName);
      }
    }
  }

  if (customAgentIds.length === 0) return BUILT_IN_AGENT_GROUPS;

  // Group custom agents by explicit domain (from metadata.yaml) or kebab prefix fallback
  const customGroupMap = new Map<string, AgentItem[]>();
  for (const agentId of customAgentIds) {
    // Boundary cast: custom agent names from matrix stacks are not in the AgentName union
    const explicitDomain = matrix.agentDefinedDomains?.[agentId as AgentName];
    const domainKey = explicitDomain ?? (agentId.split("-")[0] || "custom");
    const groupLabel = getDomainDisplayName(domainKey);
    if (!customGroupMap.has(groupLabel)) {
      customGroupMap.set(groupLabel, []);
    }
    customGroupMap.get(groupLabel)!.push({
      id: agentId as AgentName,
      label: agentIdToLabel(agentId),
      description: "Custom agent",
    });
  }

  const customGroups: AgentGroup[] = [];
  for (const [label, items] of customGroupMap) {
    customGroups.push({ label, items });
  }

  return [...BUILT_IN_AGENT_GROUPS, ...customGroups];
}

function buildFlatRows(groups: AgentGroup[]): ListRow[] {
  return groups.flatMap((group, groupIndex): ListRow[] => [
    ...(groupIndex > 0 ? [{ type: "spacer" as const }] : []),
    { type: "header" as const, label: group.label },
    ...group.items.map((agent): ListRow => ({ type: "agent", agent })),
  ]);
}

function buildFocusableIds(groups: AgentGroup[]): FocusId[] {
  return [...groups.flatMap((group) => group.items.map((a) => a.id)), "continue"];
}

type StepAgentsProps = {
  matrix: MergedSkillsMatrix;
};

export const StepAgents: React.FC<StepAgentsProps> = ({ matrix }) => {
  const store = useWizardStore();

  const agentGroups = useMemo(() => buildAgentGroups(matrix), [matrix]);
  const flatRows = useMemo(() => buildFlatRows(agentGroups), [agentGroups]);
  const focusableIds = useMemo(() => buildFocusableIds(agentGroups), [agentGroups]);

  const [focusedId, setFocusedId] = useState<FocusId>(focusableIds[0]!);
  const { ref: listRef, measuredHeight: listHeight } = useMeasuredHeight();

  const focusedRowIndex = focusedId !== "continue"
    ? flatRows.findIndex((row) => row.type === "agent" && row.agent.id === focusedId)
    : -1;
  const { scrollEnabled, scrollTop } = useRowScroll({
    focusedIndex: Math.max(0, focusedRowIndex),
    itemCount: flatRows.length,
    availableHeight: listHeight,
  });

  useInput((input, key) => {
    if (key.escape) {
      store.goBack();
      return;
    }

    const currentIdx = focusableIds.indexOf(focusedId);

    if (key.upArrow || input === "k") {
      const nextIdx = currentIdx <= 0 ? focusableIds.length - 1 : currentIdx - 1;
      setFocusedId(focusableIds[nextIdx]!);
      return;
    }

    if (key.downArrow || input === "j") {
      const nextIdx = currentIdx >= focusableIds.length - 1 ? 0 : currentIdx + 1;
      setFocusedId(focusableIds[nextIdx]!);
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

  const rowElements = flatRows.map((row, index) => {
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
      <ViewTitle>Select agents to compile:</ViewTitle>

      <Box ref={listRef} flexDirection="column" flexGrow={1} flexBasis={0}>
        <Box
          flexDirection="column"
          flexGrow={1}
          {...(scrollEnabled && { overflow: "hidden" as const })}
        >
          <Box
            flexDirection="column"
            marginTop={scrollTop > 0 ? -scrollTop : 0}
            {...(scrollEnabled && { flexShrink: 0 })}
          >
            {rowElements}
          </Box>
        </Box>
      </Box>

      <Text color={isContinueFocused ? CLI_COLORS.PRIMARY : undefined} bold={isContinueFocused}>
        {isContinueFocused ? UI_SYMBOLS.CURRENT : " "} {"\u2192"} {continueLabel}
      </Text>
    </Box>
  );
};
