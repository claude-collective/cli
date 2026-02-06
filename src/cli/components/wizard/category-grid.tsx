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

// =============================================================================
// Types
// =============================================================================

export type OptionState = "normal" | "recommended" | "discouraged" | "disabled";

export interface CategoryOption {
  id: string;
  label: string;
  state: OptionState;
  stateReason?: string;
  selected: boolean;
}

export interface CategoryRow {
  id: string;
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
  onToggle: (categoryId: string, technologyId: string) => void;
  /** Called when focus changes */
  onFocusChange: (row: number, col: number) => void;
  /** Called when show descriptions is toggled */
  onToggleDescriptions: () => void;
  /** Called when expert mode is toggled */
  onToggleExpertMode: () => void;
}

// =============================================================================
// Constants
// =============================================================================

/** Required indicator */
const SYMBOL_REQUIRED = "*";

/** Background colors for different states */
const BG_SELECTED = "cyan"; // Cyan background for selected
const BG_FOCUSED = "#333333"; // Dark gray for focused

/** Framework category ID for locking logic */
const FRAMEWORK_CATEGORY_ID = "framework";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sort options based on state (recommended first, discouraged last).
 * In expert mode, returns options as-is.
 */
const sortOptions = (
  options: CategoryOption[],
  expertMode: boolean,
): CategoryOption[] => {
  if (expertMode) {
    return options;
  }

  const stateOrder: Record<OptionState, number> = {
    recommended: 0,
    normal: 1,
    discouraged: 2,
    disabled: 3,
  };

  return [...options].sort((a, b) => {
    return stateOrder[a.state] - stateOrder[b.state];
  });
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
const isSectionLocked = (
  categoryId: string,
  categories: CategoryRow[],
): boolean => {
  // Framework section is never locked
  if (categoryId === FRAMEWORK_CATEGORY_ID) {
    return false;
  }

  // Find framework category and check if any option is selected
  const frameworkCategory = categories.find(
    (cat) => cat.id === FRAMEWORK_CATEGORY_ID,
  );

  if (!frameworkCategory) {
    // No framework category exists, nothing is locked
    return false;
  }

  // Check if any framework option is selected
  const hasFrameworkSelected = frameworkCategory.options.some(
    (opt) => opt.selected,
  );

  // Lock if no framework is selected
  return !hasFrameworkSelected;
};

/**
 * Find the next unlocked section index in a direction.
 */
const findNextUnlockedSection = (
  categories: { id: string; sortedOptions: CategoryOption[] }[],
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

// =============================================================================
// Sub-Components
// =============================================================================

interface HeaderRowProps {
  showDescriptions: boolean;
  expertMode: boolean;
}

const HeaderRow: React.FC<HeaderRowProps> = ({
  showDescriptions,
  expertMode,
}) => {
  return (
    <Box flexDirection="row" justifyContent="flex-end" marginBottom={1} gap={2}>
      <Text dimColor>
        [d] Descriptions: {showDescriptions ? "ON" : "OFF"}
      </Text>
      <Text dimColor>[e] Expert Mode: {expertMode ? "ON" : "OFF"}</Text>
    </Box>
  );
};

interface SkillTagProps {
  option: CategoryOption;
  isFocused: boolean;
  isLocked: boolean;
}

const SkillTag: React.FC<SkillTagProps> = ({ option, isFocused, isLocked }) => {
  // Determine background color
  // Selected: cyan background, Recommended: NO background (just cyan text)
  const getBackground = (): string | undefined => {
    if (isLocked) return undefined;
    if (option.selected) return BG_SELECTED; // Only selected gets background
    if (isFocused) return BG_FOCUSED;
    return undefined; // Recommended does NOT get background
  };

  // Determine text color
  // Selected: black text (on cyan bg), Recommended: cyan text (no bg)
  const getColor = (): string | undefined => {
    if (isLocked) return "gray";
    if (option.selected) return "black"; // Selected = black text on cyan
    if (option.state === "recommended") return "cyan"; // Recommended = cyan text only
    if (option.state === "disabled") return "gray";
    if (option.state === "discouraged") return "yellow";
    return undefined;
  };

  const isDimmed = isLocked || option.state === "disabled";
  const isBold = isFocused && !isLocked;

  return (
    <Box marginRight={1}>
      <Text
        backgroundColor={getBackground()}
        color={getColor()}
        dimColor={isDimmed}
        bold={isBold}
      >
        {" "}
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
  // Generate underline matching header length
  const underline = "\u2500".repeat(category.name.length + (category.required ? 2 : 0));

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Section header */}
      <Box flexDirection="row">
        <Text
          bold={isFocused && !isLocked}
          color={isLocked ? "gray" : isFocused ? "cyan" : undefined}
          dimColor={isLocked}
        >
          {category.name}
        </Text>
        {category.required && (
          <Text color={isLocked ? "gray" : "red"} dimColor={isLocked}>
            {" "}
            {SYMBOL_REQUIRED}
          </Text>
        )}
      </Box>

      {/* Underline below header */}
      <Text dimColor={isLocked} color={isLocked ? "gray" : undefined}>
        {underline}
      </Text>

      {/* Skills as flowing tags */}
      <Box flexDirection="row" flexWrap="wrap" marginTop={0}>
        {options.map((option, index) => (
          <Box key={option.id} flexDirection="column">
            <SkillTag
              option={option}
              isFocused={isFocused && index === focusedOptionIndex && !isLocked}
              isLocked={isLocked}
            />
            {/* Description below tag when enabled */}
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

const LegendRow: React.FC = () => {
  return (
    <Box marginTop={1}>
      <Text dimColor>
        Legend:{" "}
        <Text backgroundColor={BG_SELECTED} color="black">
          {" "}
          selected{" "}
        </Text>
        {"  "}
        <Text color="cyan">recommended</Text>
        {"  "}
        <Text color="yellow">discouraged</Text>
        {"  "}
        <Text color="gray">disabled</Text>
      </Text>
    </Box>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  focusedRow,
  focusedCol,
  showDescriptions,
  expertMode,
  onToggle,
  onFocusChange,
  onToggleDescriptions,
  onToggleExpertMode,
}) => {
  // Process categories with sorted options
  const processedCategories = categories.map((category) => ({
    ...category,
    sortedOptions: sortOptions(category.options, expertMode),
  }));

  // Get current row and its options
  const currentRow = processedCategories[focusedRow];
  const currentOptions = currentRow?.sortedOptions || [];
  const currentLocked = currentRow
    ? isSectionLocked(currentRow.id, categories)
    : false;

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
      const unlockedIndex = findNextUnlockedSection(
        processedCategories,
        focusedRow,
        1,
        categories,
      );
      if (unlockedIndex !== focusedRow) {
        const newRowOptions =
          processedCategories[unlockedIndex]?.sortedOptions || [];
        const newCol = findValidStartColumn(newRowOptions);
        onFocusChange(unlockedIndex, newCol);
      }
    }
  }, [
    currentRow,
    currentLocked,
    focusedRow,
    processedCategories,
    categories,
    onFocusChange,
  ]);

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
            const newRowOptions =
              processedCategories[nextSection]?.sortedOptions || [];
            const newCol = findValidStartColumn(newRowOptions);
            onFocusChange(nextSection, newCol);
          }
          return;
        }

        // Toggle expert mode with 'e'
        if (input === "e" || input === "E") {
          onToggleExpertMode();
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
          const newCol = findNextValidOption(
            currentOptions,
            focusedCol,
            -1,
            true,
          );
          onFocusChange(focusedRow, newCol);
        } else if (isRight) {
          if (currentLocked) return;
          const newCol = findNextValidOption(
            currentOptions,
            focusedCol,
            1,
            true,
          );
          onFocusChange(focusedRow, newCol);
        } else if (isUp) {
          // Move to previous unlocked section
          const newRow = findNextUnlockedSection(
            processedCategories,
            focusedRow,
            -1,
            categories,
          );
          const newRowOptions =
            processedCategories[newRow]?.sortedOptions || [];
          // Try to keep same column, or find valid one
          let newCol = Math.min(focusedCol, newRowOptions.length - 1);
          if (newRowOptions[newCol]?.state === "disabled") {
            newCol = findValidStartColumn(newRowOptions);
          }
          onFocusChange(newRow, newCol);
        } else if (isDown) {
          // Move to next unlocked section
          const newRow = findNextUnlockedSection(
            processedCategories,
            focusedRow,
            1,
            categories,
          );
          const newRowOptions =
            processedCategories[newRow]?.sortedOptions || [];
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
        onToggleExpertMode,
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
      {/* Header with toggles */}
      <HeaderRow showDescriptions={showDescriptions} expertMode={expertMode} />

      {/* Category sections */}
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

      {/* Legend */}
      <LegendRow />
    </Box>
  );
};
