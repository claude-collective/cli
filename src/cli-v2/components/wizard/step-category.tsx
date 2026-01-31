import React from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import { useWizardStore } from "../../stores/wizard-store.js";
import { getTopLevelCategories } from "../../lib/matrix-resolver.js";
import type { MergedSkillsMatrix } from "../../types-matrix.js";

const BACK_VALUE = "__back__";
const CONTINUE_VALUE = "__continue__";

interface StepCategoryProps {
  matrix: MergedSkillsMatrix;
}

export const StepCategory: React.FC<StepCategoryProps> = ({ matrix }) => {
  const {
    selectedSkills,
    visitedCategories,
    setCategory,
    setStep,
    goBack,
    markCategoryVisited,
  } = useWizardStore();

  const topCategoryIds = getTopLevelCategories(matrix);
  const unvisitedCategories = topCategoryIds.filter(
    (catId) => !visitedCategories.has(catId),
  );

  // Build options
  const options: Array<{ value: string; label: string }> = [
    { value: BACK_VALUE, label: "← Back" },
  ];

  // Add continue option if skills selected
  if (selectedSkills.length > 0) {
    options.push({
      value: CONTINUE_VALUE,
      label: `→ Continue with ${selectedSkills.length} skill(s)`,
    });
  }

  // Add category options with unvisited indicators
  for (const catId of topCategoryIds) {
    const cat = matrix.categories[catId];
    const isVisited = visitedCategories.has(catId);
    const label = isVisited ? cat.name : `${cat.name} (new)`;
    options.push({ value: catId, label });
  }

  const handleSelect = (value: string) => {
    if (value === BACK_VALUE) {
      goBack();
      return;
    }
    if (value === CONTINUE_VALUE) {
      setStep("confirm");
      return;
    }

    setCategory(value);
    markCategoryVisited(value);
    setStep("subcategory");
  };

  return (
    <Box flexDirection="column">
      <Text bold>
        Select a category to configure ({unvisitedCategories.length} remaining):
      </Text>
      <Box marginTop={1}>
        <Select options={options} onChange={handleSelect} />
      </Box>
    </Box>
  );
};
