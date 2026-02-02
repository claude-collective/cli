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
}

// =============================================================================
// Component
// =============================================================================

export const StepStackOptions: React.FC<StepStackOptionsProps> = ({
  stackName,
  technologyCount,
}) => {
  const { setStep, setStackAction, goBack } = useWizardStore();

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
      setStep("build");
      return;
    }
  };

  return (
    <Box flexDirection="column">
      <Text bold>
        You selected:{" "}
        <Text color="cyan">{stackName}</Text>
      </Text>
      <Text> </Text>
      <Text>What would you like to do?</Text>
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
