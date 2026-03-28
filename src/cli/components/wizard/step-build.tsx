import { Box, useInput } from "ink";
import React, { useCallback, useEffect, useState } from "react";
import type { Domain, SkillId, Category, CategorySelections } from "../../types/index.js";
import type { SkillConfig } from "../../types/config.js";
import { UI_LAYOUT, UI_MESSAGES } from "../../consts.js";
import { getSkillById } from "../../lib/matrix/matrix-provider.js";
import { useFrameworkFiltering } from "../hooks/use-framework-filtering.js";
import { useMeasuredHeight } from "../hooks/use-measured-height.js";
import { useWizardStore } from "../../stores/wizard-store.js";
import { CategoryGrid } from "./category-grid.js";
import { Toast } from "./toast.js";

export type StepBuildProps = {
  domain: Domain;
  selectedDomains: Domain[];
  selections: CategorySelections;
  allSelections: SkillId[];
  showLabels: boolean;
  filterIncompatible: boolean;
  /** Skill IDs already installed on disk, shown with a dimmed checkmark */
  installedSkillIds?: SkillId[];
  onToggle: (categoryId: Category, technologyId: SkillId) => void;
  onToggleLabels: () => void;
  onToggleFilterIncompatible: () => void;
  onContinue: () => void;
  onBack: () => void;
};

export const StepBuild: React.FC<StepBuildProps> = ({
  domain: activeDomain,
  selectedDomains,
  selections,
  allSelections,
  showLabels,
  filterIncompatible,
  installedSkillIds,
  onToggle,
  onToggleLabels,
  onToggleFilterIncompatible,
  onContinue,
  onBack,
}) => {
  const { ref: gridRef, measuredHeight: gridHeight } = useMeasuredHeight();
  const skillConfigs = useWizardStore((s) => s.skillConfigs);
  const lockedSkillIds = useWizardStore((s) => s.lockedSkillIds);
  const [lockedToast, setLockedToast] = useState<string | null>(null);

  useEffect(() => {
    if (!lockedToast) return;
    const timer = setTimeout(() => setLockedToast(null), UI_LAYOUT.COPIED_MESSAGE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [lockedToast]);

  const handleLockedToggleAttempt = useCallback(
    (skillId: SkillId) => {
      const displayName = getSkillById(skillId).displayName;
      setLockedToast(`${displayName} ${UI_MESSAGES.GLOBALLY_INSTALLED}`);
    },
    [],
  );

  const handleLockedCategoryAttempt = useCallback(() => {
    setLockedToast(UI_MESSAGES.GLOBALLY_LOCKED_CATEGORY);
  }, []);

  const handleFocusedSkillChange = useCallback(
    (id: SkillId | null) => useWizardStore.getState().setFocusedSkillId(id),
    [],
  );

  const categories = useFrameworkFiltering({
    domain: activeDomain,
    allSelections,
    selections,
    installedSkillIds,
    skillConfigs,
    filterIncompatible,
    lockedSkillIds,
  });

  useInput((_input, key) => {
    if (key.return) {
      onContinue();
    } else if (key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" width="100%" flexGrow={1} flexBasis={0}>
      <Box ref={gridRef} flexGrow={1} flexBasis={0}>
        <CategoryGrid
          key={activeDomain}
          categories={categories}
          availableHeight={gridHeight}
          showLabels={showLabels}
          onToggle={onToggle}
          onToggleLabels={onToggleLabels}
          onToggleFilterIncompatible={onToggleFilterIncompatible}
          onFocusedSkillChange={handleFocusedSkillChange}
          onLockedToggleAttempt={handleLockedToggleAttempt}
          onLockedCategoryAttempt={handleLockedCategoryAttempt}
        />
      </Box>
      {lockedToast && <Toast>{lockedToast}</Toast>}
    </Box>
  );
};
