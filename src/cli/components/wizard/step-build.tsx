/**
 * StepBuild component - Main Build step for domain-based technology selection.
 *
 * Uses CategoryGrid for 2D grid selection and SectionProgress for multi-domain
 * progress indication. Replaces the old linear category->subcategory flow.
 *
 * This component is stateless - all state is managed via props from the parent
 * wizard component, following React's controlled component pattern.
 */
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { sortBy } from "remeda";
import type { Domain, MergedSkillsMatrix, SkillId, Subcategory, SubcategorySelections } from "../../types/index.js";
import { getAvailableSkills, resolveAlias } from "../../lib/matrix-resolver.js";
import {
  CategoryGrid,
  type CategoryRow,
  type CategoryOption,
  type OptionState,
} from "./category-grid.js";
import { ViewTitle } from "./view-title.js";
import { getDomainDisplayName } from "./utils.js";

// Types

export type StepBuildProps = {
  /** Skills matrix for category/skill lookup */
  matrix: MergedSkillsMatrix;
  /** Current domain being configured (e.g., 'web', 'api') */
  domain: Domain;
  /** All selected domains (for progress indicator) */
  selectedDomains: Domain[];
  /** Current selections by subcategory */
  selections: SubcategorySelections;
  /** All current selections (for state calculation across domains) */
  allSelections: SkillId[];
  /** Grid focus state */
  focusedRow: number;
  focusedCol: number;
  /** UI toggles */
  showDescriptions: boolean;
  expertMode: boolean;
  /** Parent domain selections for framework-first filtering on sub-domains (e.g., web-extras inherits from web) */
  parentDomainSelections?: SubcategorySelections;
  /** Callbacks */
  onToggle: (subcategoryId: Subcategory, technologyId: SkillId) => void;
  onFocusChange: (row: number, col: number) => void;
  onToggleDescriptions: () => void;
  onContinue: () => void;
  onBack: () => void;
};

// Constants

/** Framework subcategory ID for web domain (framework-first filtering) */
const FRAMEWORK_SUBCATEGORY_ID = "framework";

/** Web domain ID where framework-first flow applies */
const WEB_DOMAIN_ID = "web";

// Validation

export type BuildStepValidation = {
  valid: boolean;
  message?: string;
};

/**
 * Validate that required categories have at least one selection.
 */
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

// Helper Functions

/**
 * Compute option state from skill flags.
 */
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

/**
 * Get clean display label for a skill option.
 * Uses displayName if available, otherwise falls back to the skill ID.
 * e.g., "react" from displayName, "web-framework-react" from ID
 */
export function getDisplayLabel(skill: { displayName?: string; id: string }): string {
  return skill.displayName || skill.id;
}

/**
 * Get state reason from skill flags.
 */
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

// Framework-First Flow (Web Domain)

/**
 * Check if a framework is selected in the current selections.
 * Framework skills are in the "framework" subcategory.
 */
function isFrameworkSelected(selections: SubcategorySelections): boolean {
  const frameworkSelections = selections[FRAMEWORK_SUBCATEGORY_ID] ?? [];
  return frameworkSelections.length > 0;
}

/**
 * Get the selected framework skill ID(s) from selections.
 * Returns the full skill IDs (e.g., "web-framework-react").
 */
function getSelectedFrameworks(
  selections: SubcategorySelections,
  matrix: MergedSkillsMatrix,
): SkillId[] {
  const frameworkSelections = selections[FRAMEWORK_SUBCATEGORY_ID] ?? [];
  // Resolve aliases to full skill IDs
  return frameworkSelections.map((alias) => resolveAlias(alias, matrix));
}

/**
 * Check if a skill is compatible with any of the selected frameworks.
 * Uses the skill's compatibleWith field from metadata.
 */
function isCompatibleWithSelectedFrameworks(
  skillId: SkillId,
  selectedFrameworkIds: SkillId[],
  matrix: MergedSkillsMatrix,
): boolean {
  const skill = matrix.skills[skillId];
  if (!skill) return false;

  // If skill has no compatibleWith defined, assume it's compatible with all
  // (this allows legacy skills without metadata to still appear)
  if (skill.compatibleWith.length === 0) {
    return true;
  }

  // Check if any selected framework is in the skill's compatibleWith list
  return selectedFrameworkIds.some((frameworkId) => skill.compatibleWith.includes(frameworkId));
}

/**
 * Build CategoryRow[] from matrix for a specific domain.
 *
 * Filters subcategories by domain and builds options using getAvailableSkills.
 * For web domain, implements framework-first flow:
 * - Initially shows only "framework" subcategory
 * - After framework selection, shows skills compatible with selected framework
 */
function buildCategoriesForDomain(
  domain: Domain,
  allSelections: SkillId[],
  matrix: MergedSkillsMatrix,
  expertMode: boolean,
  selections: SubcategorySelections,
  parentDomainSelections?: SubcategorySelections,
): CategoryRow[] {
  // Check framework selection for framework-first flow
  // For sub-domains (e.g., web-extras), use parent domain selections for framework checks
  const frameworkSource = parentDomainSelections ?? selections;
  const frameworkSelected = isFrameworkSelected(frameworkSource);
  const selectedFrameworkIds = frameworkSelected
    ? getSelectedFrameworks(frameworkSource, matrix)
    : [];

  // Get categories for the current domain
  const subcategories = sortBy(
    Object.values(matrix.categories).filter((cat) => cat.domain === domain),
    (cat) => cat.order ?? 0,
  );

  // Build CategoryRow for each subcategory
  // All sections are always visible — locking (dimming + preventing navigation)
  // is handled by CategoryGrid when no framework is selected.
  const categoryRows: CategoryRow[] = subcategories.map((cat) => {
    // Get available skills with computed states
    const skillOptions = getAvailableSkills(cat.id, allSelections, matrix, {
      expertMode,
    });

    // For web domain or sub-domains with parent selections, filter by framework compatibility
    // Framework category itself doesn't need filtering
    const useFrameworkFilter =
      (domain === WEB_DOMAIN_ID || parentDomainSelections !== undefined) &&
      cat.id !== FRAMEWORK_SUBCATEGORY_ID &&
      frameworkSelected;
    const filteredSkillOptions = useFrameworkFilter
      ? skillOptions.filter((skill) =>
          isCompatibleWithSelectedFrameworks(skill.id, selectedFrameworkIds, matrix),
        )
      : skillOptions;

    // Map skills to CategoryOption[]
    const options: CategoryOption[] = filteredSkillOptions.map((skill) => ({
      id: skill.id,
      label: getDisplayLabel(skill), // Clean display name without author
      state: computeOptionState(skill),
      stateReason: getStateReason(skill),
      selected: skill.selected,
      local: matrix.skills[skill.id]?.local,
    }));

    return {
      id: cat.id,
      displayName: cat.displayName,
      required: cat.required ?? false,
      exclusive: cat.exclusive ?? true,
      options,
    };
  });

  // Filter out categories with no options (after compatibility filtering)
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
  onToggle,
  onFocusChange,
  onToggleDescriptions,
  onContinue,
  onBack,
}) => {
  // Validation state for showing error messages
  const [validationError, setValidationError] = useState<string | undefined>(undefined);

  // Build categories for the current domain (with framework-first filtering)
  const categories = buildCategoriesForDomain(
    activeDomain,
    allSelections,
    matrix,
    expertMode,
    selections,
    parentDomainSelections,
  );

  // Handle keyboard input for Enter and Escape
  useInput((_input, key) => {
    if (key.return) {
      // Validate before continuing
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
