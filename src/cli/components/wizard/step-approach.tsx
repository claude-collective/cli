import React, { useState } from "react";
import { Box, useInput } from "ink";
import { useWizardStore } from "../../stores/wizard-store.js";
import { MenuItem } from "./menu-item.js";
import { ViewTitle } from "./view-title.js";

const INITIAL_FOCUSED_INDEX = 0;

const APPROACH_OPTIONS = [
  {
    value: "stack",
    label: "Use a pre-built template",
  },
  {
    value: "scratch",
    label: "Start from scratch",
  },
] as const;

export const StepApproach: React.FC = () => {
  const { setStep, setApproach } = useWizardStore();
  const [focusedIndex, setFocusedIndex] = useState(INITIAL_FOCUSED_INDEX);

  const optionCount = APPROACH_OPTIONS.length;

  useInput((input, key) => {
    if (key.return) {
      const option = APPROACH_OPTIONS[focusedIndex];
      if (option) {
        if (option.value === "stack") {
          setApproach("stack");
          setStep("stack");
        } else if (option.value === "scratch") {
          setApproach("scratch");
          setStep("stack");
        }
      }
      return;
    }

    if (key.upArrow || input === "k") {
      setFocusedIndex((prev) => (prev - 1 + optionCount) % optionCount);
      return;
    }
    if (key.downArrow || input === "j") {
      setFocusedIndex((prev) => (prev + 1) % optionCount);
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <ViewTitle>How would you like to set up your stack?</ViewTitle>
      <Box flexDirection="column" marginTop={1}>
        {APPROACH_OPTIONS.map((option, index) => (
          <MenuItem key={option.value} label={option.label} isFocused={index === focusedIndex} />
        ))}
      </Box>
    </Box>
  );
};
