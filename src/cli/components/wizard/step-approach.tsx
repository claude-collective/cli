import React, { useCallback } from "react";
import { Box, Text } from "ink";
import { useWizardStore } from "../../stores/wizard-store.js";
import { useKeyboardNavigation } from "../hooks/use-keyboard-navigation.js";
import { MenuItem } from "./menu-item.js";
import { ViewTitle } from "./view-title.js";

const APPROACH_OPTIONS = [
  {
    value: "stack",
    label: "Use a stack",
  },
  {
    value: "scratch",
    label: "Start from scratch",
  },
] as const;

export const StepApproach: React.FC = () => {
  const { setStep, setApproach } = useWizardStore();

  const handleEnter = useCallback(
    (index: number) => {
      const option = APPROACH_OPTIONS[index];
      if (option) {
        if (option.value === "stack") {
          setApproach("stack");
          setStep("stack");
        } else if (option.value === "scratch") {
          setApproach("scratch");
          setStep("stack");
        }
      }
    },
    [setApproach, setStep],
  );

  const { focusedIndex } = useKeyboardNavigation(APPROACH_OPTIONS.length, {
    onEnter: handleEnter,
  });

  return (
    <Box flexDirection="column">
      <ViewTitle>How would you like to set up your stack?</ViewTitle>
      <Box flexDirection="column" marginTop={1}>
        {APPROACH_OPTIONS.map((option, index) => (
          <MenuItem key={option.value} label={option.label} isFocused={index === focusedIndex} />
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {"\u2191"}/{"\u2193"} navigate  ENTER select
        </Text>
      </Box>
    </Box>
  );
};
