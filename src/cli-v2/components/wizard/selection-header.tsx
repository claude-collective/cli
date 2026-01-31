import React from "react";
import { Box, Text } from "ink";
import { useWizardStore } from "../../stores/wizard-store.js";
import type { MergedSkillsMatrix } from "../../types-matrix.js";

interface SelectionHeaderProps {
  matrix: MergedSkillsMatrix;
}

export const SelectionHeader: React.FC<SelectionHeaderProps> = ({ matrix }) => {
  const selectedSkills = useWizardStore((state) => state.selectedSkills);

  if (selectedSkills.length === 0) {
    return null;
  }

  // Group skills by category (same logic as renderSelectionsHeader)
  const byCategory: Record<string, string[]> = {};
  for (const skillId of selectedSkills) {
    const skill = matrix.skills[skillId];
    if (!skill) continue;
    const category = matrix.categories[skill.category];
    const topCategory = category?.parent || skill.category;
    const categoryName = matrix.categories[topCategory]?.name || topCategory;

    if (!byCategory[categoryName]) {
      byCategory[categoryName] = [];
    }
    byCategory[categoryName].push(skill.alias || skill.name);
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Text dimColor>{"─".repeat(50)}</Text>
      <Text bold>  Selected:</Text>
      {Object.entries(byCategory).map(([category, skills]) => (
        <Text key={category}>
          {"  "}<Text color="cyan">{category}</Text>: {skills.join(", ")}
        </Text>
      ))}
      <Text dimColor>{"─".repeat(50)}</Text>
    </Box>
  );
};
