import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type {
  Domain,
  MergedSkillsMatrix,
  SkillId,
  Subcategory,
  SubcategorySelections,
} from "../../types/index.js";
import { validateBuildStep } from "../../lib/wizard/index.js";
import { CLI_COLORS, UI_SYMBOLS } from "../../consts.js";
import { useFrameworkFiltering } from "../hooks/use-framework-filtering.js";
import { CategoryGrid } from "./category-grid.js";
import { ViewTitle } from "./view-title.js";
import { getDomainDisplayName } from "./utils.js";

export type StepBuildProps = {
  matrix: MergedSkillsMatrix;
  domain: Domain;
  selectedDomains: Domain[];
  selections: SubcategorySelections;
  allSelections: SkillId[];
  showDescriptions: boolean;
  expertMode: boolean;
  /** For framework-first filtering on sub-domains (e.g., web-extras inherits from web) */
  parentDomainSelections?: SubcategorySelections;
  /** Skill IDs already installed on disk, shown with a dimmed checkmark */
  installedSkillIds?: SkillId[];
  onToggle: (subcategoryId: Subcategory, technologyId: SkillId) => void;
  onToggleDescriptions: () => void;
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

const LegendRow: React.FC = () => {
  return (
    <Box paddingLeft={1} columnGap={2}>
      <Text color={CLI_COLORS.PRIMARY}>{UI_SYMBOLS.SELECTED} active</Text>
      <Text color={CLI_COLORS.UNFOCUSED}>{UI_SYMBOLS.UNSELECTED} recommended</Text>
      <Text color={CLI_COLORS.WARNING}>{UI_SYMBOLS.DISCOURAGED} discouraged</Text>
      <Text color={CLI_COLORS.NEUTRAL}>{UI_SYMBOLS.DISABLED} disabled</Text>
    </Box>
  );
};

export const StepBuild: React.FC<StepBuildProps> = ({
  matrix,
  domain: activeDomain,
  selectedDomains,
  selections,
  allSelections,
  showDescriptions,
  expertMode,
  parentDomainSelections,
  installedSkillIds,
  onToggle,
  onToggleDescriptions,
  onContinue,
  onBack,
}) => {
  const [validationError, setValidationError] = useState<string | undefined>(undefined);

  const categories = useFrameworkFiltering({
    domain: activeDomain,
    allSelections,
    matrix,
    expertMode,
    selections,
    parentDomainSelections,
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
    <Box flexDirection="column" width="100%">
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
              <Text key={domain} color={isActive ? CLI_COLORS.PRIMARY : undefined}>
                {isActive ? UI_SYMBOLS.CURRENT : UI_SYMBOLS.UNSELECTED}{" "}
                {getDomainDisplayName(domain)}
              </Text>
            );
          })}
        </Box>
        <LegendRow />
      </Box>
      <ViewTitle>Customize your {getDomainDisplayName(activeDomain)} stack</ViewTitle>

      <CategoryGrid
        key={activeDomain}
        categories={categories}
        expertMode={expertMode}
        showDescriptions={showDescriptions}
        onToggle={onToggle}
        onToggleDescriptions={onToggleDescriptions}
      />

      <Footer validationError={validationError} />
    </Box>
  );
};
