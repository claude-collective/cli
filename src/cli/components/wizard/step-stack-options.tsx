/**
 * StepStackOptions component - Options after stack selection.
 *
 * After selecting a pre-built stack, user can:
 * 1. Continue with defaults -> goes to refine step
 * 2. Customize technologies -> goes to build step (pre-populated)
 *
 * Keyboard: Enter to select, Escape to go back
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import { Select } from "@inkjs/ui";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { MergedSkillsMatrix } from "../../types-matrix.js";

// =============================================================================
// Constants
// =============================================================================

const BACK_VALUE = "_back";
const DEFAULTS_VALUE = "defaults";
const CUSTOMIZE_VALUE = "customize";

// =============================================================================
// Types
// =============================================================================

export interface StepStackOptionsProps {
  /** Stack name for display */
  stackName: string;
  /** Number of technologies in the stack */
  technologyCount: number;
  /** Skills matrix for looking up stack configuration */
  matrix: MergedSkillsMatrix;
}

// =============================================================================
// Component
// =============================================================================

export const StepStackOptions: React.FC<StepStackOptionsProps> = ({
  stackName,
  technologyCount,
  matrix,
}) => {
  const {
    setStep,
    setStackAction,
    populateFromStack,
    selectedStackId,
    goBack,
  } = useWizardStore();

  const options = [
    { value: BACK_VALUE, label: "\u2190 Back" },
    {
      value: DEFAULTS_VALUE,
      label: `Continue with defaults (${technologyCount} technologies)`,
    },
    {
      value: CUSTOMIZE_VALUE,
      label: "Customize technologies",
    },
  ];

  const handleSelect = (value: string) => {
    if (value === BACK_VALUE) {
      goBack();
      return;
    }

    if (value === DEFAULTS_VALUE) {
      setStackAction("defaults");
      setStep("refine");
      return;
    }

    if (value === CUSTOMIZE_VALUE) {
      setStackAction("customize");

      // Pre-populate domainSelections with stack's default technology selections
      const stack = matrix.suggestedStacks.find(
        (s) => s.id === selectedStackId,
      );
      if (stack) {
        // Build a stack-like structure from the resolved stack's skills
        // The resolved stack has allSkillIds, but we need the technology aliases
        // from the original stack definition. Use the matrix's aliasesReverse.
        const stackAgents: Record<string, Record<string, string>> = {};

        // For each skill in the stack, find its category and add to the structure
        for (const skillId of stack.allSkillIds) {
          const skill = matrix.skills[skillId];
          if (skill?.category) {
            // Find which agent this skill belongs to based on skill category
            // Map category to a default agent (web-developer for web skills, etc.)
            const domain = matrix.categories[skill.category]?.domain;
            if (domain) {
              if (!stackAgents[domain]) {
                stackAgents[domain] = {};
              }
              // Use alias if available, otherwise fall back to skill id
              stackAgents[domain][skill.category] = skill.alias || skill.id;
            }
          }
        }

        populateFromStack({ agents: stackAgents }, matrix.categories);
      }

      setStep("build");
      return;
    }
  };

  return (
    <Box flexDirection="column">
      <Text bold>
        You selected: <Text color="cyan">{stackName}</Text>
      </Text>
      <Text> </Text>
      <Text>What would you like to do?</Text>
      <Box marginTop={1}>
        <Select options={options} onChange={handleSelect} />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {"\u2191"}/{"\u2193"} navigate ENTER select ESC back
        </Text>
      </Box>
    </Box>
  );
};
