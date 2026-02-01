import React from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import { useWizardStore } from "../../stores/wizard-store.js";

const EXPERT_MODE_VALUE = "__expert_mode__";
const INSTALL_MODE_VALUE = "__install_mode__";

export const StepApproach: React.FC = () => {
  const {
    expertMode,
    installMode,
    toggleExpertMode,
    toggleInstallMode,
    setStep,
    setLastSelectedApproach,
    lastSelectedApproach,
  } = useWizardStore();

  // Build options matching the original wizard
  const options = [
    {
      value: "stack",
      label: "Use a pre-built template",
    },
    {
      value: "scratch",
      label: "Start from scratch",
    },
    {
      value: EXPERT_MODE_VALUE,
      label: expertMode ? "Expert Mode: ON" : "Expert Mode: OFF",
    },
    {
      value: INSTALL_MODE_VALUE,
      label:
        installMode === "local"
          ? "Install Mode: Local"
          : "Install Mode: Plugin",
    },
  ];

  const handleSelect = (value: string) => {
    // Handle mode toggles - stay on this step
    if (value === EXPERT_MODE_VALUE) {
      setLastSelectedApproach(EXPERT_MODE_VALUE);
      toggleExpertMode();
      return;
    }

    if (value === INSTALL_MODE_VALUE) {
      setLastSelectedApproach(INSTALL_MODE_VALUE);
      toggleInstallMode();
      return;
    }

    // Clear lastSelectedApproach when moving to a new step
    setLastSelectedApproach(null);

    // Navigate to next step
    if (value === "stack") {
      setStep("stack");
    } else if (value === "scratch") {
      setStep("category");
    }
  };

  return (
    <Box flexDirection="column">
      {/* Mode status display */}
      <Box marginBottom={1} flexDirection="column">
        {expertMode && (
          <Text color="yellow">
            Expert Mode is ON <Text dimColor>- conflict checking disabled</Text>
          </Text>
        )}
        <Text color="cyan">
          Install Mode: {installMode === "plugin" ? "Plugin" : "Local"}
          <Text dimColor>
            {installMode === "plugin"
              ? " - native Claude plugins"
              : " - copy to .claude/skills/"}
          </Text>
        </Text>
      </Box>

      <Text>How would you like to set up your stack?</Text>
      <Box marginTop={1}>
        <Select
          options={options}
          defaultValue={lastSelectedApproach || undefined}
          onChange={handleSelect}
        />
      </Box>
    </Box>
  );
};
