import { Box, Text, useInput } from "ink";
import React, { useCallback, useMemo } from "react";
import { CLI_COLORS } from "../../consts.js";
import type { Domain, SkillId, Category, CategorySelections } from "../../types/index.js";
import { useFrameworkFiltering } from "../hooks/use-framework-filtering.js";
import { useMeasuredHeight } from "../hooks/use-measured-height.js";
import { useWizardStore } from "../../stores/wizard-store.js";
import { CategoryGrid } from "./category-grid.js";
import { getDomainDisplayName, orderDomains } from "./utils.js";
import { ViewTitle } from "./view-title.js";

export type StepBuildProps = {
  domain: Domain;
  selectedDomains: Domain[];
  selections: CategorySelections;
  allSelections: SkillId[];
  showLabels: boolean;
  /** Skill IDs already installed on disk, shown with a dimmed checkmark */
  installedSkillIds?: SkillId[];
  onToggle: (categoryId: Category, technologyId: SkillId) => void;
  onToggleLabels: () => void;
  onContinue: () => void;
  onBack: () => void;
};

export const StepBuild: React.FC<StepBuildProps> = ({
  domain: activeDomain,
  selectedDomains,
  selections,
  allSelections,
  showLabels,
  installedSkillIds,
  onToggle,
  onToggleLabels,
  onContinue,
  onBack,
}) => {
  const { ref: gridRef, measuredHeight: gridHeight } = useMeasuredHeight();
  const skillConfigs = useWizardStore((s) => s.skillConfigs);

  const handleFocusedSkillChange = useCallback(
    (id: SkillId | null) => useWizardStore.getState().setFocusedSkillId(id),
    [],
  );

  const orderedDomains = useMemo(() => orderDomains(selectedDomains), [selectedDomains]);

  const categories = useFrameworkFiltering({
    domain: activeDomain,
    allSelections,
    selections,
    installedSkillIds,
    skillConfigs,
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
      <Box
        columnGap={2}
        flexDirection="row"
        justifyContent="space-between"
        marginBottom={1}
        paddingRight={1}
        marginTop={-1}
        borderTop={false}
        borderRight={false}
        borderLeft={false}
        borderColor={CLI_COLORS.NEUTRAL}
        borderStyle="single"
      >
        <Box columnGap={2} flexDirection="row">
          {orderedDomains.map((domain) => {
            const isActive = domain === activeDomain;
            return (
              <Text key={domain} color={isActive ? CLI_COLORS.WARNING : undefined} bold={isActive}>
                {getDomainDisplayName(domain)}
              </Text>
            );
          })}
        </Box>
      </Box>
      <ViewTitle>{`Customize your ${getDomainDisplayName(activeDomain)} stack`}</ViewTitle>

      <Box ref={gridRef} flexGrow={1} flexBasis={0}>
        <CategoryGrid
          key={activeDomain}
          categories={categories}
          availableHeight={gridHeight}
          showLabels={showLabels}
          onToggle={onToggle}
          onToggleLabels={onToggleLabels}
          onFocusedSkillChange={handleFocusedSkillChange}
        />
      </Box>

    </Box>
  );
};
