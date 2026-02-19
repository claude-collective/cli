import { Box, Text, useInput } from "ink";
import React, { useState } from "react";
import { CLI_COLORS } from "../../consts.js";
import { validateBuildStep } from "../../lib/wizard/index.js";
import type {
  Domain,
  MergedSkillsMatrix,
  SkillId,
  Subcategory,
  SubcategorySelections,
} from "../../types/index.js";
import { useFrameworkFiltering } from "../hooks/use-framework-filtering.js";
import { useMeasuredHeight } from "../hooks/use-measured-height.js";
import { CategoryGrid } from "./category-grid.js";
import { getDomainDisplayName } from "./utils.js";
import { ViewTitle } from "./view-title.js";

export type StepBuildProps = {
  matrix: MergedSkillsMatrix;
  domain: Domain;
  selectedDomains: Domain[];
  selections: SubcategorySelections;
  allSelections: SkillId[];
  showLabels: boolean;
  expertMode: boolean;
  /** Skill IDs already installed on disk, shown with a dimmed checkmark */
  installedSkillIds?: SkillId[];
  onToggle: (subcategoryId: Subcategory, technologyId: SkillId) => void;
  onToggleLabels: () => void;
  onContinue: () => void;
  onBack: () => void;
};

type FooterProps = {
  validationError?: string;
};

const Footer: React.FC<FooterProps> = ({ validationError }) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      {validationError && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={CLI_COLORS.WARNING}>{validationError}</Text>
          <Text dimColor>Press ESC to go back, or select a skill and press ENTER to continue.</Text>
        </Box>
      )}
    </Box>
  );
};

export const StepBuild: React.FC<StepBuildProps> = ({
  matrix,
  domain: activeDomain,
  selectedDomains,
  selections,
  allSelections,
  showLabels,
  expertMode,
  installedSkillIds,
  onToggle,
  onToggleLabels,
  onContinue,
  onBack,
}) => {
  const [validationError, setValidationError] = useState<string | undefined>(undefined);
  const { ref: gridRef, measuredHeight: gridHeight } = useMeasuredHeight();

  const categories = useFrameworkFiltering({
    domain: activeDomain,
    allSelections,
    matrix,
    expertMode,
    selections,
    installedSkillIds,
  });

  useInput((_input, key) => {
    if (key.return) {
      const validation = validateBuildStep(categories, selections);
      if (validation.valid) {
        setValidationError(undefined);
        onContinue();
      } else {
        setValidationError(validation.message);
      }
    } else if (key.escape) {
      setValidationError(undefined);
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
          {selectedDomains.map((domain) => {
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
          expertMode={expertMode}
          showLabels={showLabels}
          onToggle={onToggle}
          onToggleLabels={onToggleLabels}
        />
      </Box>

      <Footer validationError={validationError} />
    </Box>
  );
};
