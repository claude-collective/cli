/**
 * StepStack component - Dual-purpose step for stack selection or domain selection.
 *
 * Stack path (approach === "stack"):
 *   - Shows list of pre-built stacks using MenuItem for chevron + label pattern
 *   - Keyboard navigation with arrow keys, Enter to select, Escape to go back
 *   - Focused item has cyan chevron and label
 *
 * Scratch path (approach === "scratch"):
 *   - Shows multi-select of domains (Web, API, CLI, Mobile)
 *   - User selects which domains to configure
 *   - Continue goes to build step for first selected domain
 */
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Select } from "@inkjs/ui";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { MergedSkillsMatrix } from "../../types-matrix.js";
import { MenuItem } from "./menu-item.js";
import { ViewTitle } from "./view-title.js";

// =============================================================================
// Constants
// =============================================================================

const BACK_VALUE = "_back";
const CONTINUE_VALUE = "_continue";

/** Default focused index starts at first stack item (0) */
const INITIAL_FOCUSED_INDEX = 0;

/** Available domains for scratch path */
const AVAILABLE_DOMAINS = [
  { id: "web", label: "Web", description: "Frontend web applications" },
  {
    id: "web-extras",
    label: "Web Extras",
    description: "Animation, files, realtime, PWA, accessibility",
  },
  { id: "api", label: "API", description: "Backend APIs and services" },
  { id: "cli", label: "CLI", description: "Command-line tools" },
  { id: "mobile", label: "Mobile", description: "Mobile applications" },
];

// =============================================================================
// Types
// =============================================================================

interface StepStackProps {
  matrix: MergedSkillsMatrix;
}

// =============================================================================
// Stack Selection Sub-component
// =============================================================================

interface StackSelectionProps {
  matrix: MergedSkillsMatrix;
}

const StackSelection: React.FC<StackSelectionProps> = ({ matrix }) => {
  const { selectStack, setStep, setStackAction, populateFromStack, goBack } = useWizardStore();
  const [focusedIndex, setFocusedIndex] = useState(INITIAL_FOCUSED_INDEX);

  const stacks = matrix.suggestedStacks;
  const stackCount = stacks.length;

  useInput((input, key) => {
    // Escape to go back
    if (key.escape) {
      goBack();
      return;
    }

    // Enter to select the focused stack
    if (key.return && stackCount > 0) {
      const focusedStack = stacks[focusedIndex];
      if (focusedStack) {
        selectStack(focusedStack.id);
        setStackAction("customize");

        // Pre-populate domainSelections from the stack's skill mappings
        const resolvedStack = matrix.suggestedStacks.find((s) => s.id === focusedStack.id);
        if (resolvedStack) {
          // Build one pseudo-agent per skill so populateFromStack can handle
          // categories with multiple skills (e.g. testing: vitest + playwright-e2e)
          // without overwriting. populateFromStack deduplicates internally.
          const pseudoAgents: Record<string, Record<string, string>> = {};

          for (let i = 0; i < resolvedStack.allSkillIds.length; i++) {
            const skillId = resolvedStack.allSkillIds[i];
            const skill = matrix.skills[skillId];
            if (skill?.category) {
              const displayId = skill.alias || skill.id;
              pseudoAgents[`s${i}`] = { [skill.category]: displayId };
            }
          }

          populateFromStack({ agents: pseudoAgents }, matrix.categories);
        }

        setStep("build");
      }
      return;
    }

    // Arrow key navigation (clamped at boundaries)
    if (key.upArrow || input === "k") {
      setFocusedIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow || input === "j") {
      setFocusedIndex((prev) => Math.min(stackCount - 1, prev + 1));
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <ViewTitle>Select a pre-built template</ViewTitle>
      <Box flexDirection="column" marginTop={1}>
        {stacks.map((stack, index) => (
          <MenuItem
            key={stack.id}
            label={stack.name}
            description={stack.description}
            isFocused={index === focusedIndex}
          />
        ))}
      </Box>
    </Box>
  );
};

// =============================================================================
// Domain Selection Sub-component
// =============================================================================

const DomainSelection: React.FC = () => {
  const { selectedDomains, toggleDomain, setStep, goBack } = useWizardStore();

  // Build options with checkboxes showing selection state
  const domainOptions = AVAILABLE_DOMAINS.map((domain) => {
    const isSelected = selectedDomains.includes(domain.id);
    const checkbox = isSelected ? "[\u2713]" : "[ ]";
    return {
      value: domain.id,
      label: `${checkbox} ${domain.label} - ${domain.description}`,
    };
  });

  const options = [
    { value: BACK_VALUE, label: "\u2190 Back" },
    ...domainOptions,
    ...(selectedDomains.length > 0
      ? [
          {
            value: CONTINUE_VALUE,
            label: `\u2192 Continue with ${selectedDomains.length} domain(s)`,
          },
        ]
      : []),
  ];

  const handleSelect = (value: string) => {
    if (value === BACK_VALUE) {
      goBack();
      return;
    }

    if (value === CONTINUE_VALUE) {
      if (selectedDomains.length > 0) {
        setStep("build");
      }
      return;
    }

    // Toggle domain selection
    toggleDomain(value);
  };

  return (
    <Box flexDirection="column">
      <Text bold>Select domains to configure:</Text>
      <Text dimColor>Select one or more domains, then continue</Text>
      <Box marginTop={1}>
        <Select options={options} onChange={handleSelect} />
      </Box>
      {selectedDomains.length > 0 ? (
        <Box marginTop={1}>
          <Text>
            Selected: <Text color="cyan">{selectedDomains.join(", ")}</Text>
          </Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color="yellow">Please select at least one domain</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>
          {"\u2191"}/{"\u2193"} navigate ENTER toggle/select ESC back
        </Text>
      </Box>
    </Box>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const StepStack: React.FC<StepStackProps> = ({ matrix }) => {
  const { approach } = useWizardStore();

  if (approach === "stack") {
    return <StackSelection matrix={matrix} />;
  }

  // approach === "scratch"
  return <DomainSelection />;
};
