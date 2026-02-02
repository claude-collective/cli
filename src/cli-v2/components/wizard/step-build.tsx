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

/**
 * Build CategoryRow[] from matrix for a specific domain.
 *
 * Filters subcategories by domain and builds options using getAvailableSkills.
 */
function buildCategoriesForDomain(
  domain: string,
  allSelections: string[],
  matrix: MergedSkillsMatrix,
  expertMode: boolean,
): CategoryRow[] {
  // Get subcategories for the current domain (categories with parent and matching domain)
  const subcategories = Object.values(matrix.categories)
    .filter((cat) => cat.domain === domain && cat.parent)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Build CategoryRow for each subcategory
  const categoryRows: CategoryRow[] = subcategories.map((cat) => {
    // Get available skills with computed states
    const skillOptions = getAvailableSkills(cat.id, allSelections, matrix, {
      expertMode,
    });

    // Map skills to CategoryOption[]
    const options: CategoryOption[] = skillOptions.map((skill) => ({
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

  return categoryRows;
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
  return displayNames[domain] || domain.charAt(0).toUpperCase() + domain.slice(1);
}

/**
 * Count selected options across categories.
 */
function countSelections(categories: CategoryRow[]): { selected: number; total: number } {
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
        Configure your <Text color="cyan">{getDomainDisplayName(domain)}</Text> stack:
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
  showContinueHint: boolean;
  validationError?: string;
}

const Footer: React.FC<FooterProps> = ({ showContinueHint, validationError }) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Validation error message */}
      {validationError && (
        <Box marginBottom={1}>
          <Text color="yellow">{validationError}</Text>
        </Box>
      )}

      {/* Keyboard shortcuts help */}
      <Text dimColor>
        {"\u2190"}/{"\u2192"} options   {"\u2191"}/{"\u2193"} categories   SPACE select   TAB descriptions   E expert   ENTER continue   ESC back
      </Text>
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
  const [validationError, setValidationError] = useState<string | undefined>(undefined);

  // Build categories for the current domain
  const categories = buildCategoriesForDomain(
    domain,
    allSelections,
    matrix,
    expertMode,
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
      <Footer showContinueHint validationError={validationError} />
    </Box>
  );
};
