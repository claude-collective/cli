/**
 * CategoryGrid component - Section-based selection for wizard Build step.
 *
 * Displays categories as sections with technology options as horizontal tags.
 * Supports keyboard navigation (arrows, vim keys) and visual states.
 *
 * Visual states:
 * - Selected: cyan background + black text
 * - Recommended: cyan text (no background)
 * - Focused: gray background
 * - Disabled: dimmed text
 * - Normal: plain text
 * - Locked section: visible but dimmed, not navigable
 *
 * Section layout: Each category is a section with header, underline, and flowing tags.
 */
import React, { useCallback, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { sortBy } from "remeda";
import type { SkillId, Subcategory } from "../../types-matrix.js";

// Types

export type OptionState = "normal" | "recommended" | "discouraged" | "disabled";

export interface CategoryOption {
  id: SkillId;
  label: string;
  state: OptionState;
  stateReason?: string;
  selected: boolean;
  local?: boolean;
}

export interface CategoryRow {
  id: Subcategory;
  name: string;
  required: boolean;
  exclusive: boolean;
  options: CategoryOption[];
}

export interface CategoryGridProps {
  /** Categories to display (filtered by domain from matrix) */
  categories: CategoryRow[];
  /** Focused row index (section index) */
  focusedRow: number;
  /** Focused column index (option index within section) */
  focusedCol: number;
  /** Show descriptions under each technology */
  showDescriptions: boolean;
  /** Expert mode - shows all options, disables smart ordering */
  expertMode: boolean;
  /** Called when user toggles a technology */
  onToggle: (categoryId: Subcategory, technologyId: SkillId) => void;
  /** Called when focus changes */
  onFocusChange: (row: number, col: number) => void;
  /** Called when show descriptions is toggled */
  onToggleDescriptions: () => void;
}

// Constants

/** Required indicator */
const SYMBOL_REQUIRED = "*";

/** Background colors for different states */
const BG_SELECTED = "cyan"; // Cyan background for selected
const BG_FOCUSED = "#333"; // Dark gray for focused

/** Framework category ID for locking logic */
const FRAMEWORK_CATEGORY_ID = "framework";

// Helper Functions

/**
 * Sort options based on state (recommended first, discouraged last).
 * In expert mode, returns options as-is.
 */
const sortOptions = (options: CategoryOption[], expertMode: boolean): CategoryOption[] => {
  if (expertMode) {
    return options;
  }

  const stateOrder: Record<OptionState, number> = {
    recommended: 0,
    normal: 1,
    discouraged: 2,
    disabled: 3,
  };

  return sortBy([...options], (o) => stateOrder[o.state]);
};

/**
 * Find the next non-disabled option index in a direction.
 * Returns current index if no valid option found.
 */
const findNextValidOption = (
  options: CategoryOption[],
  currentIndex: number,
  direction: 1 | -1,
  wrap: boolean = true,
): number => {
  const length = options.length;
  if (length === 0) return currentIndex;

  let index = currentIndex;
  let attempts = 0;

  while (attempts < length) {
    index += direction;

    if (wrap) {
      // Wrap around
      if (index < 0) index = length - 1;
      if (index >= length) index = 0;
    } else {
      // Clamp to bounds
      if (index < 0) index = 0;
      if (index >= length) index = length - 1;
    }

    if (options[index] && options[index].state !== "disabled") {
      return index;
    }

    attempts++;
  }

  // All options are disabled, return current
  return currentIndex;
};

/**
 * Find a valid starting column for a row.
 * Returns 0 if all options are disabled.
 */
const findValidStartColumn = (options: CategoryOption[]): number => {
  for (let i = 0; i < options.length; i++) {
    if (options[i] && options[i].state !== "disabled") {
      return i;
    }
  }
  return 0;
};

/**
 * Check if a section is locked (for framework-first flow).
 * A section is locked if:
 * - It's not the framework section
 * - No framework has been selected yet
 */
const isSectionLocked = (categoryId: Subcategory, categories: CategoryRow[]): boolean => {
  // Framework section is never locked
  if (categoryId === FRAMEWORK_CATEGORY_ID) {
    return false;
  }

  // Find framework category and check if any option is selected
  const frameworkCategory = categories.find((cat) => cat.id === FRAMEWORK_CATEGORY_ID);

  if (!frameworkCategory) {
    // No framework category exists, nothing is locked
    return false;
  }

  // Check if any framework option is selected
  const hasFrameworkSelected = frameworkCategory.options.some((opt) => opt.selected);

  // Lock if no framework is selected
  return !hasFrameworkSelected;
};

/**
 * Find the next unlocked section index in a direction.
 */
const findNextUnlockedSection = (
  categories: { id: Subcategory; sortedOptions: CategoryOption[] }[],
  currentIndex: number,
  direction: 1 | -1,
  allCategories: CategoryRow[],
): number => {
  const length = categories.length;
  if (length === 0) return currentIndex;

  let index = currentIndex;
  let attempts = 0;

  while (attempts < length) {
    index += direction;

    // Wrap around
    if (index < 0) index = length - 1;
    if (index >= length) index = 0;

    const category = categories[index];
    if (category && !isSectionLocked(category.id, allCategories)) {
      return index;
    }

    attempts++;
  }

  // All sections are locked (shouldn't happen), return current
  return currentIndex;
};

interface SkillTagProps {
  option: CategoryOption;
  isFocused: boolean;
  isLocked: boolean;
}

const SkillTag: React.FC<SkillTagProps> = ({ option, isFocused, isLocked }) => {
  const getColor = (): { text: string; border: string } | undefined => {
    if (isLocked || option.state === "disabled") {
      return {
        text: "gray",
        border: "gray",
      };
    }
    if (option.selected) {
      return {
        text: "cyan",
        border: "cyan",
      };
    }
    if (option.state === "recommended") {
      return {
        text: "white",
        border: "gray",
      };
    }
    if (option.state === "discouraged") {
      return {
        text: "yellow",
        border: "yellow",
      };
    }
    return undefined;
  };

  const isBold = isFocused || option.selected;
  const isDimmed = isLocked || option.state === "disabled";
  const focusBorderColor = option.selected ? "cyan" : "white";

  return (
    <Box
      marginRight={1}
      borderColor={isFocused ? focusBorderColor : getColor()?.border}
      borderStyle="single"
      borderDimColor={isDimmed}
    >
      <Text color={getColor()?.text} bold={isBold} dimColor={false}>
        {" "}
        {option.local && (
          <>
            <Text backgroundColor="gray"> L </Text>{" "}
          </>
        )}
        {option.label}{" "}
      </Text>
    </Box>
  );
};

interface CategorySectionProps {
  category: CategoryRow;
  options: CategoryOption[];
  isLocked: boolean;
  isFocused: boolean;
  focusedOptionIndex: number;
  showDescriptions: boolean;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  options,
  isLocked,
  isFocused,
  focusedOptionIndex,
  showDescriptions,
}) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row">
        <Text dimColor={isLocked}>{category.name}</Text>
        {category.required && (
          <Text color={isLocked ? "gray" : "red"} dimColor={isLocked}>
            {" "}
            {SYMBOL_REQUIRED}
          </Text>
        )}
      </Box>

      <Box flexDirection="row" flexWrap="wrap" marginTop={0}>
        {options.map((option, index) => (
          <Box key={option.id} flexDirection="column">
            <SkillTag
              option={option}
              isFocused={isFocused && index === focusedOptionIndex && !isLocked}
              isLocked={isLocked}
            />
            {showDescriptions && option.stateReason && !isLocked && (
              <Box marginLeft={1} marginBottom={0}>
                <Text dimColor wrap="truncate-end">
                  {option.stateReason}
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// Main Component

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  focusedRow,
  focusedCol,
  showDescriptions,
  expertMode,
  onToggle,
  onFocusChange,
  onToggleDescriptions,
}) => {
  // Process categories with sorted options
  const processedCategories = categories.map((category) => ({
    ...category,
    sortedOptions: sortOptions(category.options, expertMode),
  }));

  // Get current row and its options
  const currentRow = processedCategories[focusedRow];
  const currentOptions = currentRow?.sortedOptions || [];
  const currentLocked = currentRow ? isSectionLocked(currentRow.id, categories) : false;

  // Ensure focusedCol is valid when row changes or options change
  useEffect(() => {
    if (!currentRow) return;

    const maxCol = currentOptions.length - 1;
    if (focusedCol > maxCol) {
      // Clamp to max column
      const newCol = Math.max(0, maxCol);
      onFocusChange(focusedRow, newCol);
    } else if (currentOptions[focusedCol]?.state === "disabled") {
      // Current option is disabled, find a valid one
      const validCol = findValidStartColumn(currentOptions);
      if (validCol !== focusedCol) {
        onFocusChange(focusedRow, validCol);
      }
    }
  }, [focusedRow, currentOptions, focusedCol, onFocusChange, currentRow]);

  // If current section is locked, move to first unlocked section
  useEffect(() => {
    if (currentRow && currentLocked) {
      const unlockedIndex = findNextUnlockedSection(processedCategories, focusedRow, 1, categories);
      if (unlockedIndex !== focusedRow) {
        const newRowOptions = processedCategories[unlockedIndex]?.sortedOptions || [];
        const newCol = findValidStartColumn(newRowOptions);
        onFocusChange(unlockedIndex, newCol);
      }
    }
  }, [currentRow, currentLocked, focusedRow, processedCategories, categories, onFocusChange]);

  // Handle keyboard navigation
  useInput(
    useCallback(
      (
        input: string,
        key: {
          leftArrow: boolean;
          rightArrow: boolean;
          upArrow: boolean;
          downArrow: boolean;
          tab: boolean;
          shift: boolean;
        },
      ) => {
        // Toggle descriptions with Shift+Tab (Tab now jumps sections)
        if (key.tab && key.shift) {
          onToggleDescriptions();
          return;
        }

        // Tab jumps to next unlocked section
        if (key.tab && !key.shift) {
          const nextSection = findNextUnlockedSection(
            processedCategories,
            focusedRow,
            1,
            categories,
          );
          if (nextSection !== focusedRow) {
            const newRowOptions = processedCategories[nextSection]?.sortedOptions || [];
            const newCol = findValidStartColumn(newRowOptions);
            onFocusChange(nextSection, newCol);
          }
          return;
        }

        // Toggle descriptions with 'd'
        if (input === "d" || input === "D") {
          onToggleDescriptions();
          return;
        }

        // Toggle selection with Space (only if section is unlocked)
        if (input === " ") {
          if (currentLocked) return;
          const currentOption = currentOptions[focusedCol];
          if (currentOption && currentOption.state !== "disabled") {
            onToggle(currentRow.id, currentOption.id);
          }
          return;
        }

        // Navigation
        const isLeft = key.leftArrow || input === "h";
        const isRight = key.rightArrow || input === "l";
        const isUp = key.upArrow || input === "k";
        const isDown = key.downArrow || input === "j";

        if (isLeft) {
          if (currentLocked) return;
          const newCol = findNextValidOption(currentOptions, focusedCol, -1, true);
          onFocusChange(focusedRow, newCol);
        } else if (isRight) {
          if (currentLocked) return;
          const newCol = findNextValidOption(currentOptions, focusedCol, 1, true);
          onFocusChange(focusedRow, newCol);
        } else if (isUp) {
          // Move to previous unlocked section
          const newRow = findNextUnlockedSection(processedCategories, focusedRow, -1, categories);
          const newRowOptions = processedCategories[newRow]?.sortedOptions || [];
          // Try to keep same column, or find valid one
          let newCol = Math.min(focusedCol, newRowOptions.length - 1);
          if (newRowOptions[newCol]?.state === "disabled") {
            newCol = findValidStartColumn(newRowOptions);
          }
          onFocusChange(newRow, newCol);
        } else if (isDown) {
          // Move to next unlocked section
          const newRow = findNextUnlockedSection(processedCategories, focusedRow, 1, categories);
          const newRowOptions = processedCategories[newRow]?.sortedOptions || [];
          // Try to keep same column, or find valid one
          let newCol = Math.min(focusedCol, newRowOptions.length - 1);
          if (newRowOptions[newCol]?.state === "disabled") {
            newCol = findValidStartColumn(newRowOptions);
          }
          onFocusChange(newRow, newCol);
        }
      },
      [
        focusedRow,
        focusedCol,
        currentOptions,
        currentRow,
        currentLocked,
        processedCategories,
        categories,
        onToggle,
        onFocusChange,
        onToggleDescriptions,
      ],
    ),
  );

  if (categories.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No categories to display.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {processedCategories.map((category, rowIndex) => {
        const isLocked = isSectionLocked(category.id, categories);

        return (
          <CategorySection
            key={category.id}
            category={category}
            options={category.sortedOptions}
            isLocked={isLocked}
            isFocused={rowIndex === focusedRow}
            focusedOptionIndex={focusedCol}
            showDescriptions={showDescriptions}
          />
        );
      })}
    </Box>
  );
};
