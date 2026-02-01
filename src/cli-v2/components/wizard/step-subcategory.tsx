import React, { useState } from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import { useWizardStore } from "../../stores/wizard-store.js";
import {
  getSubcategories,
  getAvailableSkills,
  isCategoryAllDisabled,
  getDependentSkills,
  resolveAlias,
  type SkillCheckOptions,
} from "../../lib/matrix-resolver.js";
import type { MergedSkillsMatrix } from "../../types-matrix.js";
import { Confirm } from "../common/confirm.js";

const BACK_VALUE = "__back__";

type ViewMode = "subcategory" | "skill";

interface StepSubcategoryProps {
  matrix: MergedSkillsMatrix;
}

/**
 * Collects all dependent skills recursively for a given skill ID.
 * Used when deselecting a skill to warn about cascade deselection.
 */
function collectAllDependents(
  skillId: string,
  currentSelections: string[],
  matrix: MergedSkillsMatrix,
): string[] {
  const allDependents: string[] = [];
  const visited = new Set<string>();
  const queue = [skillId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const directDependents = getDependentSkills(
      current,
      currentSelections,
      matrix,
    );

    for (const dependent of directDependents) {
      if (!visited.has(dependent) && !allDependents.includes(dependent)) {
        allDependents.push(dependent);
        queue.push(dependent);
      }
    }
  }

  return allDependents;
}

/**
 * Formats a skill option for display in the Select component.
 */
function formatSkillOption(skill: {
  id: string;
  name: string;
  description?: string;
  selected: boolean;
  disabled: boolean;
  disabledReason?: string;
  discouraged?: boolean;
  recommended?: boolean;
}): {
  value: string;
  label: string;
} {
  let label = skill.name;

  if (skill.selected) {
    label = `✓ ${skill.name}`;
  } else if (skill.disabled) {
    const shortReason =
      skill.disabledReason?.split(" (")[0]?.toLowerCase() ||
      "requirements not met";
    label = `${skill.name} (disabled, ${shortReason})`;
  } else if (skill.discouraged) {
    label = `${skill.name} (not recommended)`;
  } else if (skill.recommended) {
    label = `${skill.name} (recommended)`;
  }

  return {
    value: skill.id,
    label,
  };
}

export const StepSubcategory: React.FC<StepSubcategoryProps> = ({ matrix }) => {
  const {
    currentTopCategory,
    currentSubcategory,
    selectedSkills,
    expertMode,
    setStep,
    setSubcategory,
    toggleSkill,
    goBack,
    setLastSelectedSubcategory,
    setLastSelectedSkill,
    markCategoryVisited,
  } = useWizardStore();

  const [viewMode, setViewMode] = useState<ViewMode>(
    currentSubcategory ? "skill" : "subcategory",
  );
  const [confirmDeselect, setConfirmDeselect] = useState<{
    skillId: string;
    skillName: string;
    dependents: string[];
  } | null>(null);

  if (!currentTopCategory) {
    // Should not happen, but handle gracefully
    goBack();
    return null;
  }

  const topCategory = matrix.categories[currentTopCategory];
  const subcategoryIds = getSubcategories(currentTopCategory, matrix);
  const checkOptions: SkillCheckOptions = { expertMode };

  // Handle subcategory selection view
  if (viewMode === "subcategory") {
    const subcategoryOptions = subcategoryIds.map((subId) => {
      const sub = matrix.categories[subId];
      const skills = getAvailableSkills(
        subId,
        selectedSkills,
        matrix,
        checkOptions,
      );
      const selectedInCategory = skills.filter((s) => s.selected);
      const hasSelection = selectedInCategory.length > 0;

      const categoryDisabled = isCategoryAllDisabled(
        subId,
        selectedSkills,
        matrix,
        checkOptions,
      );

      let label: string;
      if (hasSelection) {
        label = `${sub.name} (${selectedInCategory[0].name} selected)`;
      } else if (categoryDisabled.disabled) {
        const shortReason =
          categoryDisabled.reason?.toLowerCase() || "requirements not met";
        label = `${sub.name} (disabled, ${shortReason})`;
      } else if (sub.required) {
        label = `${sub.name} (required)`;
      } else {
        label = sub.name;
      }

      return {
        value: subId,
        label,
      };
    });

    const options = [
      { value: BACK_VALUE, label: "← Back" },
      ...subcategoryOptions,
    ];

    const handleSubcategorySelect = (value: string) => {
      if (value === BACK_VALUE) {
        if (currentTopCategory) {
          markCategoryVisited(currentTopCategory);
        }
        setSubcategory(null);
        setLastSelectedSubcategory(null);
        goBack();
        return;
      }

      setLastSelectedSubcategory(value);
      setSubcategory(value);
      setViewMode("skill");
    };

    return (
      <Box flexDirection="column">
        <Text bold>{topCategory.name} - Select a subcategory:</Text>
        <Box marginTop={1}>
          <Select options={options} onChange={handleSubcategorySelect} />
        </Box>
      </Box>
    );
  }

  // Handle skill selection view (when a subcategory is selected)
  if (!currentSubcategory) {
    // Should not happen in skill mode
    setViewMode("subcategory");
    return null;
  }

  const subcategory = matrix.categories[currentSubcategory];
  const skills = getAvailableSkills(
    currentSubcategory,
    selectedSkills,
    matrix,
    checkOptions,
  );

  const skillOptions = skills.map(formatSkillOption);
  const options = [{ value: BACK_VALUE, label: "← Back" }, ...skillOptions];

  const handleSkillSelect = (value: string) => {
    if (value === BACK_VALUE) {
      setSubcategory(null);
      setLastSelectedSkill(null);
      setViewMode("subcategory");
      return;
    }

    const selectedSkillId = value;
    setLastSelectedSkill(selectedSkillId);

    const selectedOption = skills.find((s) => s.id === selectedSkillId);

    // Ignore disabled skills
    if (selectedOption?.disabled) {
      return;
    }

    const alreadySelected = selectedSkills.includes(selectedSkillId);

    if (alreadySelected) {
      // Check if deselecting would affect dependents
      const allDependents = collectAllDependents(
        selectedSkillId,
        selectedSkills,
        matrix,
      );

      if (allDependents.length > 0) {
        const skillName =
          matrix.skills[resolveAlias(selectedSkillId, matrix)]?.name ||
          selectedSkillId;

        // Show confirmation dialog
        setConfirmDeselect({
          skillId: selectedSkillId,
          skillName,
          dependents: allDependents,
        });
        return;
      }

      // No dependents, just toggle off
      toggleSkill(selectedSkillId);
    } else {
      // Selecting a skill - handle exclusive categories
      if (subcategory?.exclusive) {
        // First, remove all skills in this category
        const skillsToRemove = selectedSkills.filter((id) => {
          const skill = matrix.skills[id];
          return skill?.category === currentSubcategory;
        });
        skillsToRemove.forEach((id) => {
          if (selectedSkills.includes(id)) {
            toggleSkill(id);
          }
        });
      }

      // Then add the new skill
      toggleSkill(selectedSkillId);
    }
  };

  // Handle deselection confirmation
  if (confirmDeselect) {
    const dependentNames = confirmDeselect.dependents
      .map((id) => matrix.skills[id]?.name || id)
      .join(", ");

    const message = `Deselecting ${confirmDeselect.skillName} will also remove: ${dependentNames}. Continue?`;

    return (
      <Confirm
        message={message}
        defaultValue={false}
        onConfirm={() => {
          // Remove the skill and all dependents
          const toRemove = new Set([
            confirmDeselect.skillId,
            ...confirmDeselect.dependents,
          ]);
          toRemove.forEach((id) => {
            if (selectedSkills.includes(id)) {
              toggleSkill(id);
            }
          });
          setConfirmDeselect(null);
        }}
        onCancel={() => {
          // Just close the confirm dialog
          setConfirmDeselect(null);
        }}
      />
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>{subcategory.name}:</Text>
      <Box marginTop={1}>
        <Select options={options} onChange={handleSkillSelect} />
      </Box>
    </Box>
  );
};
