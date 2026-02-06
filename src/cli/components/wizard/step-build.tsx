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
import { SectionProgress } from "./section-progress.js";
import { WizardFooter } from "./wizard-footer.js";

// =============================================================================
// Types
// =============================================================================

export interface StepBuildProps {
  /** Skills matrix for category/skill lookup */
  matrix: MergedSkillsMatrix;
  /** Current domain being configured (e.g., 'web', 'api') */
  domain: string;
  /** All selected domains (for progress indicator) */
  selectedDomains: string[];
  /** Current domain index (0-based) */
  currentDomainIndex: number;
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
  onToggleExpertMode: () => void;
  onContinue: () => void;
  onBack: () => void;
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum number of domains to show progress indicator */
const MIN_DOMAINS_FOR_PROGRESS = 2;

/** Framework subcategory ID for web domain (framework-first filtering) */
const FRAMEWORK_SUBCATEGORY_ID = "framework";

/** Web domain ID where framework-first flow applies */
const WEB_DOMAIN_ID = "web";

// =============================================================================
// Validation
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Validate that required categories have at least one selection.
 */
export function validateBuildStep(
  categories: CategoryRow[],
  selections: Record<string, string[]>,
): ValidationResult {
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

// =============================================================================
// Helper Functions
// =============================================================================

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
export function getDisplayLabel(skill: {
  alias?: string;
  name: string;
}): string {
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

// =============================================================================
// Framework-First Flow (Web Domain)
// =============================================================================

/**
 * Check if a framework is selected in the current selections.
 * Framework skills are in the "framework" subcategory.
 */
function isFrameworkSelected(
  selections: Record<string, string[]>,
): boolean {
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
  return selectedFrameworkIds.some((frameworkId) =>
    skill.compatibleWith.includes(frameworkId),
  );
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
  const selectedFrameworkIds = frameworkSelected
    ? getSelectedFrameworks(selections, matrix)
    : [];

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
      domain === WEB_DOMAIN_ID &&
      cat.id !== FRAMEWORK_SUBCATEGORY_ID &&
      frameworkSelected
        ? skillOptions.filter((skill) =>
            isCompatibleWithSelectedFrameworks(
              skill.id,
              selectedFrameworkIds,
              matrix,
            ),
          )
        : skillOptions;

    // Map skills to CategoryOption[]
    const options: CategoryOption[] = filteredSkillOptions.map((skill) => ({
      id: skill.alias || skill.id, // Use alias for selection tracking
      label: getDisplayLabel(skill), // Clean display name without author
      state: computeOptionState(skill),
      stateReason: getStateReason(skill),
      selected: skill.selected,
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

/**
 * Get display name for a domain.
 */
function getDomainDisplayName(domain: string): string {
  const displayNames: Record<string, string> = {
    web: "Web",
    api: "API",
    cli: "CLI",
    mobile: "Mobile",
    shared: "Shared",
  };
  return (
    displayNames[domain] || domain.charAt(0).toUpperCase() + domain.slice(1)
  );
}

/**
 * Count selected options across categories.
 */
function countSelections(categories: CategoryRow[]): {
  selected: number;
  total: number;
} {
  let selected = 0;
  let total = 0;
  for (const category of categories) {
    for (const option of category.options) {
      if (option.state !== "disabled") {
        total++;
        if (option.selected) {
          selected++;
        }
      }
    }
  }
  return { selected, total };
}

// =============================================================================
// Header Component (Domain info with selection count)
// =============================================================================

interface HeaderProps {
  domain: string;
  selectionCount: { selected: number; total: number };
}

const Header: React.FC<HeaderProps> = ({ domain, selectionCount }) => {
  return (
    <Box justifyContent="space-between" marginBottom={1}>
      <Text bold>
        Configure your <Text color="cyan">{getDomainDisplayName(domain)}</Text>{" "}
        stack:
      </Text>
      <Text dimColor>
        {selectionCount.selected}/{selectionCount.total} selected
      </Text>
    </Box>
  );
};

// =============================================================================
// Footer Component (Keyboard Help)
// =============================================================================

interface FooterProps {
  validationError?: string;
}

const Footer: React.FC<FooterProps> = ({ validationError }) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Validation error message */}
      {validationError && (
        <Box marginBottom={1}>
          <Text color="yellow">{validationError}</Text>
        </Box>
      )}

      {/* Keyboard shortcuts help - split layout */}
      <WizardFooter
        navigation={"\u2190/\u2192 options  \u2191/\u2193 categories  SPACE select  TAB desc  E expert"}
        action="ENTER continue  ESC back"
      />
    </Box>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const StepBuild: React.FC<StepBuildProps> = ({
  matrix,
  domain,
  selectedDomains,
  currentDomainIndex,
  selections,
  allSelections,
  focusedRow,
  focusedCol,
  showDescriptions,
  expertMode,
  onToggle,
  onFocusChange,
  onToggleDescriptions,
  onToggleExpertMode,
  onContinue,
  onBack,
}) => {
  // Validation state for showing error messages
  const [validationError, setValidationError] = useState<string | undefined>(
    undefined,
  );

  // Build categories for the current domain (with framework-first filtering)
  const categories = buildCategoriesForDomain(
    domain,
    allSelections,
    matrix,
    expertMode,
    selections,
  );

  // Selection count for header
  const selectionCount = countSelections(categories);

  // Multi-domain progress
  const showProgress = selectedDomains.length >= MIN_DOMAINS_FOR_PROGRESS;
  const isLastDomain = currentDomainIndex === selectedDomains.length - 1;
  const nextDomain = isLastDomain
    ? undefined
    : selectedDomains[currentDomainIndex + 1];

  // Handle keyboard input for Enter and Escape
  useInput((input, key) => {
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
      {/* Header with domain and selection count */}
      <Header domain={domain} selectionCount={selectionCount} />

      {/* Progress indicator for multi-domain */}
      {showProgress && (
        <SectionProgress
          label="Domain"
          current={getDomainDisplayName(domain)}
          index={currentDomainIndex + 1}
          total={selectedDomains.length}
          next={nextDomain ? getDomainDisplayName(nextDomain) : undefined}
        />
      )}

      {/* Category grid */}
      <CategoryGrid
        categories={categories}
        focusedRow={focusedRow}
        focusedCol={focusedCol}
        showDescriptions={showDescriptions}
        expertMode={expertMode}
        onToggle={onToggle}
        onFocusChange={onFocusChange}
        onToggleDescriptions={onToggleDescriptions}
        onToggleExpertMode={onToggleExpertMode}
      />

      {/* Footer with keyboard hints */}
      <Footer validationError={validationError} />
    </Box>
  );
};
