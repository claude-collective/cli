import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { sortBy } from "remeda";
import type { Domain, MergedSkillsMatrix, SkillId, Subcategory, SubcategorySelections } from "../../types/index.js";
import { getAvailableSkills, resolveAlias } from "../../lib/matrix/index.js";
import {
  CategoryGrid,
  type CategoryRow,
  type CategoryOption,
  type OptionState,
} from "./category-grid.js";
import { ViewTitle } from "./view-title.js";
import { getDomainDisplayName } from "./utils.js";

export type StepBuildProps = {
  matrix: MergedSkillsMatrix;
  domain: Domain;
  selectedDomains: Domain[];
  selections: SubcategorySelections;
  allSelections: SkillId[];
  focusedRow: number;
  focusedCol: number;
  showDescriptions: boolean;
  expertMode: boolean;
  /** For framework-first filtering on sub-domains (e.g., web-extras inherits from web) */
  parentDomainSelections?: SubcategorySelections;
  /** Skill IDs already installed on disk, shown with a dimmed checkmark */
  installedSkillIds?: SkillId[];
  onToggle: (subcategoryId: Subcategory, technologyId: SkillId) => void;
  onFocusChange: (row: number, col: number) => void;
  onToggleDescriptions: () => void;
  onContinue: () => void;
  onBack: () => void;
};

const FRAMEWORK_SUBCATEGORY_ID = "framework";
const WEB_DOMAIN_ID = "web";

export type BuildStepValidation = {
  valid: boolean;
  message?: string;
};

export function validateBuildStep(
  categories: CategoryRow[],
  selections: SubcategorySelections,
): BuildStepValidation {
  for (const category of categories) {
    if (category.required) {
      const categorySelections = selections[category.id] || [];
      if (categorySelections.length === 0) {
        return {
          valid: false,
          message: `Please select a ${category.displayName}`,
        };
      }
    }
  }
  return { valid: true };
}

function computeOptionState(skill: {
  disabled: boolean;
  discouraged: boolean;
  recommended: boolean;
}): OptionState {
  if (skill.disabled) {
    return "disabled";
  }
  if (skill.discouraged) {
    return "discouraged";
  }
  if (skill.recommended) {
    return "recommended";
  }
  return "normal";
}

export function getDisplayLabel(skill: { displayName?: string; id: string }): string {
  return skill.displayName || skill.id;
}

function getStateReason(skill: {
  disabled: boolean;
  disabledReason?: string;
  discouraged: boolean;
  discouragedReason?: string;
  recommended: boolean;
  recommendedReason?: string;
}): string | undefined {
  if (skill.disabled && skill.disabledReason) {
    return skill.disabledReason;
  }
  if (skill.discouraged && skill.discouragedReason) {
    return skill.discouragedReason;
  }
  if (skill.recommended && skill.recommendedReason) {
    return skill.recommendedReason;
  }
  return undefined;
}

function isFrameworkSelected(selections: SubcategorySelections): boolean {
  const frameworkSelections = selections[FRAMEWORK_SUBCATEGORY_ID] ?? [];
  return frameworkSelections.length > 0;
}

function getSelectedFrameworks(
  selections: SubcategorySelections,
  matrix: MergedSkillsMatrix,
): SkillId[] {
  const frameworkSelections = selections[FRAMEWORK_SUBCATEGORY_ID] ?? [];
  // Resolve aliases to full skill IDs
  return frameworkSelections.map((alias) => resolveAlias(alias, matrix));
}

function isCompatibleWithSelectedFrameworks(
  skillId: SkillId,
  selectedFrameworkIds: SkillId[],
  matrix: MergedSkillsMatrix,
): boolean {
  const skill = matrix.skills[skillId];
  if (!skill) return false;

  // No compatibleWith = compatible with all (allows legacy skills to appear)
  if (skill.compatibleWith.length === 0) {
    return true;
  }

  return selectedFrameworkIds.some((frameworkId) => skill.compatibleWith.includes(frameworkId));
}

// Build CategoryRow[] from matrix for a domain, with framework-first filtering for web
function buildCategoriesForDomain(
  domain: Domain,
  allSelections: SkillId[],
  matrix: MergedSkillsMatrix,
  expertMode: boolean,
  selections: SubcategorySelections,
  parentDomainSelections?: SubcategorySelections,
  installedSkillIds?: SkillId[],
): CategoryRow[] {
  // For sub-domains (e.g., web-extras), use parent domain selections for framework checks
  const frameworkSource = parentDomainSelections ?? selections;
  const frameworkSelected = isFrameworkSelected(frameworkSource);
  const selectedFrameworkIds = frameworkSelected
    ? getSelectedFrameworks(frameworkSource, matrix)
    : [];

  const subcategories = sortBy(
    Object.values(matrix.categories).filter((cat) => cat.domain === domain),
    (cat) => cat.order ?? 0,
  );

  // All sections always visible; locking is handled by CategoryGrid
  const categoryRows: CategoryRow[] = subcategories.map((cat) => {
    const skillOptions = getAvailableSkills(cat.id, allSelections, matrix, {
      expertMode,
    });

    // Filter by framework compatibility (skip framework category itself)
    const useFrameworkFilter =
      (domain === WEB_DOMAIN_ID || parentDomainSelections !== undefined) &&
      cat.id !== FRAMEWORK_SUBCATEGORY_ID &&
      frameworkSelected;
    const filteredSkillOptions = useFrameworkFilter
      ? skillOptions.filter((skill) =>
          isCompatibleWithSelectedFrameworks(skill.id, selectedFrameworkIds, matrix),
        )
      : skillOptions;

    const options: CategoryOption[] = filteredSkillOptions.map((skill) => ({
      id: skill.id,
      label: getDisplayLabel(skill),
      state: computeOptionState(skill),
      stateReason: getStateReason(skill),
      selected: skill.selected,
      local: matrix.skills[skill.id]?.local,
      installed: installedSkillIds?.includes(skill.id) || false,
    }));

    return {
      id: cat.id,
      displayName: cat.displayName,
      required: cat.required ?? false,
      exclusive: cat.exclusive ?? true,
      options,
    };
  });

  return categoryRows.filter((row) => row.options.length > 0);
}

type FooterProps = {
  validationError?: string;
};

const Footer: React.FC<FooterProps> = ({ validationError }) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      {validationError && (
        <Box marginBottom={1}>
          <Text color="yellow">{validationError}</Text>
        </Box>
      )}
    </Box>
  );
};

const LegendRow: React.FC = () => {
  return (
    <Box paddingLeft={1} columnGap={2}>
      <Text color="cyan">active</Text>
      <Text color="#fff">recommended</Text>
      <Text color="yellow">discouraged</Text>
      <Text color="gray">disabled</Text>
    </Box>
  );
};

export const StepBuild: React.FC<StepBuildProps> = ({
  matrix,
  domain: activeDomain,
  selectedDomains,
  selections,
  allSelections,
  focusedRow,
  focusedCol,
  showDescriptions,
  expertMode,
  parentDomainSelections,
  installedSkillIds,
  onToggle,
  onFocusChange,
  onToggleDescriptions,
  onContinue,
  onBack,
}) => {
  const [validationError, setValidationError] = useState<string | undefined>(undefined);

  const categories = buildCategoriesForDomain(
    activeDomain,
    allSelections,
    matrix,
    expertMode,
    selections,
    parentDomainSelections,
    installedSkillIds,
  );

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
        borderColor="gray"
        borderStyle="single"
      >
        <Box columnGap={2} flexDirection="row">
          {selectedDomains.map((domain) => (
            <Text key={domain} color={domain === activeDomain ? "cyan" : undefined}>
              {getDomainDisplayName(domain)}
            </Text>
          ))}
        </Box>
        <LegendRow />
      </Box>
      <ViewTitle>Customise your {getDomainDisplayName(activeDomain)} stack</ViewTitle>

      <CategoryGrid
        categories={categories}
        focusedRow={focusedRow}
        focusedCol={focusedCol}
        expertMode={expertMode}
        showDescriptions={showDescriptions}
        onToggle={onToggle}
        onFocusChange={onFocusChange}
        onToggleDescriptions={onToggleDescriptions}
      />

      <Footer validationError={validationError} />
    </Box>
  );
};
