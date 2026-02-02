/**
 * StepStack component - Dual-purpose step for stack selection or domain selection.
 *
 * Stack path (approach === "stack"):
 *   - Shows list of pre-built stacks from matrix.suggestedStacks
 *   - Selecting a stack populates domainSelections and goes to stack-options
 *
 * Scratch path (approach === "scratch"):
 *   - Shows multi-select of domains (Web, API, CLI, Mobile)
 *   - User selects which domains to configure
 *   - Continue goes to build step for first selected domain
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
const CONTINUE_VALUE = "_continue";

/** Available domains for scratch path */
const AVAILABLE_DOMAINS = [
  { id: "web", label: "Web", description: "Frontend web applications" },
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
  const { selectStack, setStep, goBack } = useWizardStore();

  // Build options from matrix.suggestedStacks
  const options = [
    { value: BACK_VALUE, label: "\u2190 Back" },
    ...matrix.suggestedStacks.map((stack) => ({
      value: stack.id,
      label: `${stack.name} - ${stack.description}`,
    })),
  ];

  const handleSelect = (value: string) => {
    if (value === BACK_VALUE) {
      goBack();
      return;
    }

    const stack = matrix.suggestedStacks.find((s) => s.id === value);
    if (stack) {
      selectStack(stack.id);
      setStep("stack-options");
    }
  };

  return (
    <Box flexDirection="column">
      <Text bold>Select a pre-built template:</Text>
      <Box marginTop={1}>
        <Select options={options} onChange={handleSelect} />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {"\u2191"}/{"\u2193"} navigate   ENTER select   ESC back
        </Text>
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
      ? [{ value: CONTINUE_VALUE, label: `\u2192 Continue with ${selectedDomains.length} domain(s)` }]
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
            Selected:{" "}
            <Text color="cyan">{selectedDomains.join(", ")}</Text>
          </Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color="yellow">Please select at least one domain</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>
          {"\u2191"}/{"\u2193"} navigate   ENTER toggle/select   ESC back
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
