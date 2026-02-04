/**
 * CategoryGrid component - 2D grid selection for wizard Build step.
 *
 * Displays categories as rows with technology options as columns.
 * Supports keyboard navigation (arrows, vim keys) and visual states.
 *
 * Visual states:
 * - ● selected (green)
 * - ⭐ recommended (green text, shows hint)
 * - ⚠ discouraged (yellow/dim, shows warning)
 * - ✗ disabled (gray + strikethrough-like)
 * - ○ normal (white)
 * - > focus indicator (cyan/bold)
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
  /** Focused row index */
  focusedRow: number;
  /** Focused column index */
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

/** Symbol for selected option */
const SYMBOL_SELECTED = "\u25CF"; // ●

/** Symbol for unselected option */
const SYMBOL_UNSELECTED = "\u25CB"; // ○

/** Symbol for disabled option */
const SYMBOL_DISABLED = "\u2717"; // ✗

/** Symbol for recommended option */
const SYMBOL_RECOMMENDED = "\u2B50"; // ⭐

/** Symbol for discouraged option */
const SYMBOL_DISCOURAGED = "\u26A0"; // ⚠

/** Focus indicator */
const SYMBOL_FOCUS = ">";

/** Required indicator */
const SYMBOL_REQUIRED = "*";

/** Minimum column width for option labels */
const MIN_OPTION_WIDTH = 12;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the visual symbol for an option based on its state and selection.
 */
const getOptionSymbol = (option: CategoryOption): string => {
  if (option.state === "disabled") {
    return SYMBOL_DISABLED;
  }
  return option.selected ? SYMBOL_SELECTED : SYMBOL_UNSELECTED;
};

/**
 * Get the state indicator symbol (if any) for an option.
 */
const getStateIndicator = (option: CategoryOption): string | null => {
  if (option.state === "recommended") {
    return SYMBOL_RECOMMENDED;
  }
  if (option.state === "discouraged") {
    return SYMBOL_DISCOURAGED;
  }
  return null;
};

/**
 * Get the color for the option symbol based on state and selection.
 */
const getSymbolColor = (option: CategoryOption): string | undefined => {
  if (option.state === "disabled") {
    return "gray";
  }
  if (option.selected) {
    return "green";
  }
  return undefined;
};

/**
 * Get the color for the option label based on state.
 */
const getLabelColor = (
  option: CategoryOption,
  isFocused: boolean,
): string | undefined => {
  if (option.state === "disabled") {
    return "gray";
  }
  if (isFocused) {
    return "cyan";
  }
  if (option.state === "recommended") {
    return "green";
  }
  if (option.state === "discouraged") {
    return "yellow";
  }
  return undefined;
};

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
        [Tab] Show descriptions: {showDescriptions ? "ON" : "OFF"}
      </Text>
      <Text dimColor>[e] Expert Mode: {expertMode ? "ON" : "OFF"}</Text>
    </Box>
  );
};

interface OptionCellProps {
  option: CategoryOption;
  isFocused: boolean;
  showDescription: boolean;
}

const OptionCell: React.FC<OptionCellProps> = ({
  option,
  isFocused,
  showDescription,
}) => {
  const symbol = getOptionSymbol(option);
  const symbolColor = getSymbolColor(option);
  const labelColor = getLabelColor(option, isFocused);
  const stateIndicator = getStateIndicator(option);
  const isDimmed =
    option.state === "disabled" || option.state === "discouraged";

  return (
    <Box flexDirection="column" minWidth={MIN_OPTION_WIDTH} marginRight={1}>
      <Box flexDirection="row">
        {/* Focus indicator */}
        <Text color="cyan" bold>
          {isFocused ? SYMBOL_FOCUS : " "}
        </Text>
        <Text> </Text>

        {/* Selection symbol */}
        <Text
          color={symbolColor}
          dimColor={isDimmed && option.state === "discouraged"}
        >
          {symbol}
        </Text>
        <Text> </Text>

        {/* Label */}
        <Text
          color={labelColor}
          dimColor={option.state === "disabled"}
          bold={isFocused}
          strikethrough={option.state === "disabled"}
        >
          {option.label}
        </Text>

        {/* State indicator */}
        {stateIndicator && (
          <>
            <Text> </Text>
            <Text color={option.state === "recommended" ? "green" : "yellow"}>
              {stateIndicator}
            </Text>
          </>
        )}
      </Box>

      {/* Description/reason (shown when descriptions enabled) */}
      {showDescription && option.stateReason && (
        <Box marginLeft={4}>
          <Text dimColor wrap="truncate-end">
            {option.stateReason}
          </Text>
        </Box>
      )}
    </Box>
  );
};

interface CategoryRowComponentProps {
  category: CategoryRow;
  options: CategoryOption[];
  focusedCol: number;
  isRowFocused: boolean;
  showDescriptions: boolean;
}

const CategoryRowComponent: React.FC<CategoryRowComponentProps> = ({
  category,
  options,
  focusedCol,
  isRowFocused,
  showDescriptions,
}) => {
  return (
    <Box
      flexDirection="row"
      alignItems="flex-start"
      marginBottom={showDescriptions ? 1 : 0}
    >
      {/* Category name column */}
      <Box minWidth={16} marginRight={2}>
        <Text bold={isRowFocused} color={isRowFocused ? "cyan" : undefined}>
          {category.name}
          {category.required && <Text color="red"> {SYMBOL_REQUIRED}</Text>}
        </Text>
      </Box>

      {/* Options */}
      <Box flexDirection="row" flexWrap="wrap">
        {options.map((option, index) => (
          <OptionCell
            key={option.id}
            option={option}
            isFocused={isRowFocused && index === focusedCol}
            showDescription={showDescriptions}
          />
        ))}
      </Box>

      {/* Optional indicator */}
      {!category.required && (
        <Box marginLeft={1}>
          <Text dimColor>(optional)</Text>
        </Box>
      )}
    </Box>
  );
};

const LegendRow: React.FC = () => {
  return (
    <Box marginTop={1}>
      <Text dimColor>
        Legend: <Text color="green">{SYMBOL_SELECTED}</Text> selected{"   "}
        <Text color="green">{SYMBOL_RECOMMENDED}</Text> recommended{"   "}
        <Text color="yellow">{SYMBOL_DISCOURAGED}</Text> discouraged{"   "}
        <Text color="gray">{SYMBOL_DISABLED}</Text> disabled
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
        },
      ) => {
        // Toggle descriptions with Tab
        if (key.tab) {
          onToggleDescriptions();
          return;
        }

        // Toggle expert mode with 'e'
        if (input === "e" || input === "E") {
          onToggleExpertMode();
          return;
        }

        // Toggle selection with Space
        if (input === " ") {
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
          const newCol = findNextValidOption(
            currentOptions,
            focusedCol,
            -1,
            true,
          );
          onFocusChange(focusedRow, newCol);
        } else if (isRight) {
          const newCol = findNextValidOption(
            currentOptions,
            focusedCol,
            1,
            true,
          );
          onFocusChange(focusedRow, newCol);
        } else if (isUp) {
          // Move to previous row
          const newRow =
            focusedRow <= 0 ? processedCategories.length - 1 : focusedRow - 1;
          const newRowOptions =
            processedCategories[newRow]?.sortedOptions || [];
          // Try to keep same column, or find valid one
          let newCol = Math.min(focusedCol, newRowOptions.length - 1);
          if (newRowOptions[newCol]?.state === "disabled") {
            newCol = findValidStartColumn(newRowOptions);
          }
          onFocusChange(newRow, newCol);
        } else if (isDown) {
          // Move to next row
          const newRow =
            focusedRow >= processedCategories.length - 1 ? 0 : focusedRow + 1;
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
        processedCategories,
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

      {/* Category rows */}
      {processedCategories.map((category, rowIndex) => (
        <CategoryRowComponent
          key={category.id}
          category={category}
          options={category.sortedOptions}
          focusedCol={focusedCol}
          isRowFocused={rowIndex === focusedRow}
          showDescriptions={showDescriptions}
        />
      ))}

      {/* Legend */}
      <LegendRow />
    </Box>
  );
};
