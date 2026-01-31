import React from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { MergedSkillsMatrix } from "../../types-matrix.js";

interface StepStackProps {
  matrix: MergedSkillsMatrix;
}

export const StepStack: React.FC<StepStackProps> = ({ matrix }) => {
  const { selectStack, setStep, goBack } = useWizardStore();

  // Build options from matrix.suggestedStacks
  const options = [
    { value: "_back", label: "← Back" },
    ...matrix.suggestedStacks.map((stack) => ({
      value: stack.id,
      label: `${stack.name} - ${stack.description}`,
    })),
  ];

  const handleSelect = (value: string) => {
    if (value === "_back") {
      goBack();
      return;
    }

    const stack = matrix.suggestedStacks.find((s) => s.id === value);
    if (stack) {
      selectStack(stack);
      setStep("confirm");
    }
  };

  return (
    <Box flexDirection="column">
      <Text bold>Select a pre-built template:</Text>
      <Box marginTop={1}>
        <Select options={options} onChange={handleSelect} />
      </Box>
    </Box>
  );
};
