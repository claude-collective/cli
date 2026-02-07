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
import type { MergedSkillsMatrix } from "../../types-matrix.js";
import { getAvailableSkills } from "../../lib/matrix-resolver.js";
import {
  CategoryGrid,
  type CategoryRow,
  type CategoryOption,
  type OptionState,
} from "./category-grid.js";
import { ViewTitle } from "./view-title.js";
import { getDomainDisplayName } from "./utils.js";

// Types

export interface StepBuildProps {
  /** Skills matrix for category/skill lookup */
  matrix: MergedSkillsMatrix;
  /** Current domain being configured (e.g., 'web', 'api') */
  domain: string;
  /** All selected domains (for progress indicator) */
  selectedDomains: string[];
  /** Current selections by subcategory */
  selections: Record<string, string[]>;
  /** All current selections (for state calculation across domains) */
  allSelections: string[];
  /** Grid focus state */
  focusedRow: number;
  focusedCol: number;
  /** UI toggles */
  showDescriptions: boolean;
  expertMode: boolean;
  /** Callbacks */
  onToggle: (subcategoryId: string, technologyId: string) => void;
  onFocusChange: (row: number, col: number) => void;
  onToggleDescriptions: () => void;
  onContinue: () => void;
  onBack: () => void;
}

// Constants

/** Framework subcategory ID for web domain (framework-first filtering) */
const FRAMEWORK_SUBCATEGORY_ID = "framework";

/** Web domain ID where framework-first flow applies */
const WEB_DOMAIN_ID = "web";

// Validation

export interface BuildStepValidation {
  valid: boolean;
  message?: string;
}

/**
 * Validate that required categories have at least one selection.
 */
export function validateBuildStep(
  categories: CategoryRow[],
  selections: Record<string, string[]>,
): BuildStepValidation {
  for (const category of categories) {
    if (category.required) {
      const categorySelections = selections[category.id] || [];
      if (categorySelections.length === 0) {
        return {
          valid: false,
          message: `Please select a ${category.name}`,
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
 * Uses name with author suffix stripped for accurate display.
 * e.g., "React (@vince)" -> "React", "SCSS Modules (@vince)" -> "SCSS Modules"
 */
export function getDisplayLabel(skill: { alias?: string; name: string }): string {
  // Strip author suffix like " (@vince)" from name
  // This preserves the original capitalization (e.g., "SCSS Modules" stays as-is)
  const authorPattern = /\s*\(@[^)]+\)\s*$/;
  return skill.name.replace(authorPattern, "");
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
function isFrameworkSelected(selections: Record<string, string[]>): boolean {
  const frameworkSelections = selections[FRAMEWORK_SUBCATEGORY_ID] ?? [];
  return frameworkSelections.length > 0;
}

/**
 * Get the selected framework skill ID(s) from selections.
 * Returns the full skill IDs (e.g., "web-framework-react").
 */
function getSelectedFrameworks(
  selections: Record<string, string[]>,
  matrix: MergedSkillsMatrix,
): string[] {
  const frameworkSelections = selections[FRAMEWORK_SUBCATEGORY_ID] ?? [];
  // Resolve aliases to full skill IDs
  return frameworkSelections.map((alias) => {
    return matrix.aliases[alias] ?? alias;
  });
}

/**
 * Check if a skill is compatible with any of the selected frameworks.
 * Uses the skill's compatibleWith field from metadata.
 */
function isCompatibleWithSelectedFrameworks(
  skillId: string,
  selectedFrameworkIds: string[],
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
 * Determine if a subcategory should be shown based on framework-first flow.
 *
 * IMPORTANT: All sections are ALWAYS visible. The "locked" state in CategoryGrid
 * handles dimming and preventing navigation until a framework is selected.
 * We do NOT hide sections.
 */
function shouldShowSubcategory(
  _subcategoryId: string,
  _domain: string,
  _frameworkSelected: boolean,
): boolean {
  // All sections are always visible
  // Locking (dimming + preventing navigation) is handled by CategoryGrid
  return true;
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
  domain: string,
  allSelections: string[],
  matrix: MergedSkillsMatrix,
  expertMode: boolean,
  selections: Record<string, string[]>,
): CategoryRow[] {
  // Check framework selection for framework-first flow
  const frameworkSelected = isFrameworkSelected(selections);
  const selectedFrameworkIds = frameworkSelected ? getSelectedFrameworks(selections, matrix) : [];

  // Get subcategories for the current domain (categories with parent and matching domain)
  const subcategories = Object.values(matrix.categories)
    .filter((cat) => cat.domain === domain && cat.parent)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Filter subcategories based on framework-first flow
  const visibleSubcategories = subcategories.filter((cat) =>
    shouldShowSubcategory(cat.id, domain, frameworkSelected),
  );

  // Build CategoryRow for each visible subcategory
  const categoryRows: CategoryRow[] = visibleSubcategories.map((cat) => {
    // Get available skills with computed states
    const skillOptions = getAvailableSkills(cat.id, allSelections, matrix, {
      expertMode,
    });

    // For web domain (non-framework categories), filter by compatibility
    // Framework category itself doesn't need filtering
    const filteredSkillOptions =
      domain === WEB_DOMAIN_ID && cat.id !== FRAMEWORK_SUBCATEGORY_ID && frameworkSelected
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
      name: cat.name,
      required: cat.required ?? false,
      exclusive: cat.exclusive ?? true,
      options,
    };
  });

  // Filter out categories with no options (after compatibility filtering)
  return categoryRows.filter((row) => row.options.length > 0);
}

interface FooterProps {
  validationError?: string;
}

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
    <Box justifyContent="flex-end">
      <Box paddingLeft={1} columnGap={2} position="absolute" marginTop={-1}>
        <Text color="cyan">active</Text>
        <Text color="#fff">recommended</Text>
        <Text color="yellow">discouraged</Text>
        <Text color="gray">disabled</Text>
      </Box>
    </Box>
  );
};

export const StepBuild: React.FC<StepBuildProps> = ({
  matrix,
  domain,
  selectedDomains,
  selections,
  allSelections,
  focusedRow,
  focusedCol,
  showDescriptions,
  expertMode,
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
    domain,
    allSelections,
    matrix,
    expertMode,
    selections,
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
    <Box flexDirection="column">
      <LegendRow />
      <ViewTitle>Customise your {getDomainDisplayName(domain)} stack</ViewTitle>

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
