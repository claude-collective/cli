import React from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import { useWizardStore } from "../../stores/wizard-store.js";
import { validateSelection } from "../../lib/matrix-resolver.js";
import type { MergedSkillsMatrix } from "../../types-matrix.js";

interface StepConfirmProps {
  matrix: MergedSkillsMatrix;
  onComplete: () => void;
}

const BACK_VALUE = "_back";
const CONFIRM_VALUE = "_confirm";

export const StepConfirm: React.FC<StepConfirmProps> = ({
  matrix,
  onComplete,
}) => {
  const { selectedSkills, goBack } = useWizardStore();

  // Validate selection
  const validation = validateSelection(selectedSkills, matrix);

  // Build options
  const options = [
    { value: BACK_VALUE, label: "← Back" },
    ...(validation.valid
      ? [{ value: CONFIRM_VALUE, label: "✓ Confirm and continue" }]
      : []),
  ];

  const handleSelect = (value: string) => {
    if (value === BACK_VALUE) {
      goBack();
      return;
    }
    if (value === CONFIRM_VALUE) {
      onComplete();
    }
  };

  return (
    <Box flexDirection="column">
      <Text bold>Selected Skills:</Text>
      <Box flexDirection="column" marginTop={1} marginBottom={1}>
        {selectedSkills.length === 0 ? (
          <Text dimColor> No skills selected</Text>
        ) : (
          selectedSkills.map((skillId) => {
            const skill = matrix.skills[skillId];
            if (!skill) return null;
            const category = matrix.categories[skill.category];
            return (
              <Text key={skillId}>
                {"  "}
                <Text color="green">+</Text> {skill.name}{" "}
                <Text dimColor>({category?.name || skill.category})</Text>
              </Text>
            );
          })
        )}
      </Box>

      {/* Display validation errors */}
      {validation.errors.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="red">
            Errors:
          </Text>
          {validation.errors.map((error, idx) => (
            <Text key={idx}>
              {"  "}
              <Text color="red">x</Text> {error.message}
            </Text>
          ))}
        </Box>
      )}

      {/* Display validation warnings */}
      {validation.warnings.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="yellow">
            Warnings:
          </Text>
          {validation.warnings.map((warning, idx) => (
            <Text key={idx}>
              {"  "}
              <Text color="yellow">!</Text> {warning.message}
            </Text>
          ))}
        </Box>
      )}

      <Text>
        {validation.valid
          ? "Confirm your selection?"
          : "Selection has errors. What would you like to do?"}
      </Text>
      <Box marginTop={1}>
        <Select options={options} onChange={handleSelect} />
      </Box>
    </Box>
  );
};
