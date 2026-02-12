import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Select } from "@inkjs/ui";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { Domain, MergedSkillsMatrix } from "../../types/index.js";
import { MenuItem } from "./menu-item.js";
import { ViewTitle } from "./view-title.js";

const BACK_VALUE = "_back";
const CONTINUE_VALUE = "_continue";
const INITIAL_FOCUSED_INDEX = 0;

const AVAILABLE_DOMAINS: Array<{ id: Domain; label: string; description: string }> = [
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

type StepStackProps = {
  matrix: MergedSkillsMatrix;
};

type StackSelectionProps = {
  matrix: MergedSkillsMatrix;
};

const StackSelection: React.FC<StackSelectionProps> = ({ matrix }) => {
  const { selectStack, setStep, setStackAction, populateFromSkillIds, goBack } = useWizardStore();
  const [focusedIndex, setFocusedIndex] = useState(INITIAL_FOCUSED_INDEX);

  const stacks = matrix.suggestedStacks;
  const stackCount = stacks.length;

  useInput((input, key) => {
    if (key.escape) {
      goBack();
      return;
    }

    if (key.return && stackCount > 0) {
      const focusedStack = stacks[focusedIndex];
      if (focusedStack) {
        selectStack(focusedStack.id);
        setStackAction("customize");

        const resolvedStack = matrix.suggestedStacks.find((s) => s.id === focusedStack.id);
        if (resolvedStack) {
          populateFromSkillIds(resolvedStack.allSkillIds, matrix.skills, matrix.categories);
        }

        setStep("build");
      }
      return;
    }

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

const DomainSelection: React.FC = () => {
  const { selectedDomains, toggleDomain, setStep, goBack } = useWizardStore();

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

    // Toggle domain selection (value comes from Select UI component - data boundary)
    toggleDomain(value as Domain);
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

export const StepStack: React.FC<StepStackProps> = ({ matrix }) => {
  const { approach } = useWizardStore();

  if (approach === "stack") {
    return <StackSelection matrix={matrix} />;
  }

  // approach === "scratch"
  return <DomainSelection />;
};
