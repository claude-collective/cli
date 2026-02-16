import React, { useCallback, useMemo } from "react";

import { Box, Text } from "ink";
import { sortBy } from "remeda";

import type { SkillId, Subcategory } from "../../types/index.js";
import { CLI_COLORS, SCROLL_VIEWPORT, UI_SYMBOLS } from "../../consts.js";
import { useVirtualScroll } from "../hooks/use-virtual-scroll.js";
import {
  findValidStartColumn,
  isSectionLocked,
  useCategoryGridInput,
} from "../hooks/use-category-grid-input.js";
import { useFocusedListItem } from "../hooks/use-focused-list-item.js";

export type OptionState = "normal" | "recommended" | "discouraged" | "disabled";

export type CategoryOption = {
  id: SkillId;
  label: string;
  state: OptionState;
  stateReason?: string;
  selected: boolean;
  local?: boolean;
  installed?: boolean;
};

export type CategoryRow = {
  id: Subcategory;
  displayName: string;
  required: boolean;
  exclusive: boolean;
  options: CategoryOption[];
};

export type CategoryGridProps = {
  categories: CategoryRow[];
  showDescriptions: boolean;
  expertMode: boolean;
  onToggle: (categoryId: Subcategory, technologyId: SkillId) => void;
  onToggleDescriptions: () => void;
  /** Optional initial focus row (default: 0). Use with React `key` to reset. */
  defaultFocusedRow?: number;
  /** Optional initial focus col (default: 0). Use with React `key` to reset. */
  defaultFocusedCol?: number;
  /** Optional callback fired whenever the focused position changes */
  onFocusChange?: (row: number, col: number) => void;
  /** Available height in terminal rows for the category list. When undefined, all categories render. */
  availableHeight?: number;
  /** Terminal width in columns, used for tag wrapping estimation. */
  terminalWidth?: number;
};

const SYMBOL_REQUIRED = "*";

// Recommended first, discouraged last. Expert mode preserves original order.
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

const findNextValidOption = (
  options: CategoryOption[],
  currentIndex: number,
  direction: 1 | -1,
  wrap = true,
): number => {
  const length = options.length;
  if (length === 0) return currentIndex;

  let index = currentIndex;
  let attempts = 0;

  while (attempts < length) {
    index += direction;

    if (wrap) {
      if (index < 0) index = length - 1;
      if (index >= length) index = 0;
    } else {
      if (index < 0) index = 0;
      if (index >= length) index = length - 1;
    }

    if (options[index] && options[index].state !== "disabled") {
      return index;
    }

    attempts++;
  }

  return currentIndex;
};

type SkillTagProps = {
  option: CategoryOption;
  isFocused: boolean;
  isLocked: boolean;
};

const getStateSuffix = (state: OptionState, isLocked: boolean): string | null => {
  if (isLocked || state === "disabled") return "(disabled)";
  if (state === "recommended") return "(recommended)";
  if (state === "discouraged") return "(discouraged)";
  return null;
};

const getStateSymbol = (option: CategoryOption, isLocked: boolean): string => {
  if (isLocked || option.state === "disabled") return UI_SYMBOLS.DISABLED;
  if (option.selected) return UI_SYMBOLS.SELECTED;
  if (option.state === "discouraged") return UI_SYMBOLS.DISCOURAGED;
  return UI_SYMBOLS.UNSELECTED;
};

const SkillTag: React.FC<SkillTagProps> = ({ option, isFocused, isLocked }) => {
  const getColor = (): { text: string; border: string } => {
    if (isLocked || option.state === "disabled") {
      return {
        text: CLI_COLORS.NEUTRAL,
        border: CLI_COLORS.NEUTRAL,
      };
    }
    if (option.selected) {
      return {
        text: CLI_COLORS.PRIMARY,
        border: CLI_COLORS.PRIMARY,
      };
    }
    if (option.state === "recommended") {
      return {
        text: CLI_COLORS.UNFOCUSED,
        border: CLI_COLORS.NEUTRAL,
      };
    }
    if (option.state === "discouraged") {
      return {
        text: CLI_COLORS.WARNING,
        border: CLI_COLORS.WARNING,
      };
    }
    // Normal unselected: muted color to clearly contrast with selected (cyan) skills
    return {
      text: CLI_COLORS.NEUTRAL,
      border: CLI_COLORS.NEUTRAL,
    };
  };

  const isBold = isFocused || option.selected;
  const isDimmed = isLocked || option.state === "disabled";
  const isBorderDimmed = isDimmed || (!option.selected && !isFocused);
  const focusBorderColor = option.selected ? CLI_COLORS.PRIMARY : CLI_COLORS.UNFOCUSED;
  const colors = getColor();
  const stateSuffix = getStateSuffix(option.state, isLocked);
  const stateSymbol = getStateSymbol(option, isLocked);

  return (
    <Box
      marginRight={1}
      borderColor={isFocused ? focusBorderColor : colors.border}
      borderStyle="single"
      borderDimColor={isBorderDimmed}
    >
      <Text color={colors.text} bold={isBold} dimColor={false}>
        {" "}
        {option.local && (
          <>
            <Text backgroundColor={CLI_COLORS.NEUTRAL}> L </Text>{" "}
          </>
        )}
        {option.installed && <Text dimColor>{UI_SYMBOLS.SELECTED} </Text>}
        {!option.installed && <Text dimColor={isDimmed}>{stateSymbol} </Text>}
        {option.label}
        {stateSuffix && <Text dimColor> {stateSuffix}</Text>}{" "}
      </Text>
    </Box>
  );
};

type CategorySectionProps = {
  category: CategoryRow;
  options: CategoryOption[];
  isLocked: boolean;
  isFocused: boolean;
  focusedOptionIndex: number;
  showDescriptions: boolean;
};

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
        <Text dimColor={isLocked}>{category.displayName}</Text>
        {category.required && (
          <Text color={isLocked ? CLI_COLORS.NEUTRAL : CLI_COLORS.ERROR} dimColor={isLocked}>
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

type ProcessedCategory = CategoryRow & { sortedOptions: CategoryOption[] };

/**
 * Estimate the rendered height of a category section in terminal rows.
 *
 * Each category consists of:
 * - 1 line for the category name (+ margin-top)
 * - N lines for the skill tags (based on count and terminal width wrapping)
 *
 * Tag wrapping: skill tags use flexWrap="wrap". Each tag is approximately
 * AVG_TAG_WIDTH chars wide. The number of rows is ceil(tags * tagWidth / terminalWidth).
 */
const estimateCategoryHeight = (category: ProcessedCategory, terminalWidth: number): number => {
  const { CATEGORY_NAME_LINES, AVG_TAG_WIDTH, CATEGORY_MARGIN_LINES } = SCROLL_VIEWPORT;
  const optionCount = category.sortedOptions.length;
  const tagsPerRow = Math.max(1, Math.floor(terminalWidth / AVG_TAG_WIDTH));
  const tagRows = Math.ceil(optionCount / tagsPerRow);
  return CATEGORY_NAME_LINES + tagRows + CATEGORY_MARGIN_LINES;
};

type ScrollIndicatorProps = {
  count: number;
  direction: "above" | "below";
};

const ScrollIndicator: React.FC<ScrollIndicatorProps> = ({ count, direction }) => {
  if (count === 0) return null;

  const arrow = direction === "above" ? UI_SYMBOLS.SCROLL_UP : UI_SYMBOLS.SCROLL_DOWN;
  const label = `${arrow} ${count} more ${count === 1 ? "category" : "categories"} ${direction}`;

  return (
    <Box paddingLeft={1} marginTop={direction === "below" ? 1 : 0}>
      <Text dimColor>{label}</Text>
    </Box>
  );
};

const DEFAULT_TERMINAL_WIDTH = 80;

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  showDescriptions,
  expertMode,
  onToggle,
  onToggleDescriptions,
  defaultFocusedRow = 0,
  defaultFocusedCol = 0,
  onFocusChange,
  availableHeight,
  terminalWidth,
}) => {
  const processedCategories = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        sortedOptions: sortOptions(category.options, expertMode),
      })),
    [categories, expertMode],
  );

  const getColCount = useCallback(
    (row: number): number => processedCategories[row]?.sortedOptions.length ?? 0,
    [processedCategories],
  );

  const isRowLocked = useCallback(
    (row: number): boolean => {
      const cat = processedCategories[row];
      return cat ? isSectionLocked(cat.id, categories) : false;
    },
    [processedCategories, categories],
  );

  const findValidCol = useCallback(
    (row: number, currentCol: number, direction: 1 | -1): number => {
      const options = processedCategories[row]?.sortedOptions || [];
      const catId = processedCategories[row]?.id;
      if (catId && isSectionLocked(catId, categories)) return currentCol;
      return findNextValidOption(options, currentCol, direction, true);
    },
    [processedCategories, categories],
  );

  const adjustCol = useCallback(
    (row: number, clampedCol: number): number => {
      const options = processedCategories[row]?.sortedOptions || [];
      if (options[clampedCol]?.state === "disabled") {
        return findValidStartColumn(options);
      }
      return clampedCol;
    },
    [processedCategories],
  );

  const { focusedRow, focusedCol, setFocused, moveFocus } = useFocusedListItem(
    processedCategories.length,
    getColCount,
    {
      wrap: true,
      isRowLocked,
      findValidCol,
      adjustCol,
      onChange: onFocusChange,
      initialRow: defaultFocusedRow,
      initialCol: defaultFocusedCol,
    },
  );

  useCategoryGridInput({
    processedCategories,
    categories,
    focusedRow,
    focusedCol,
    setFocused,
    moveFocus,
    onToggle,
    onToggleDescriptions,
  });

  const { visibleItems, startIndex, hiddenAbove, hiddenBelow, isScrollable } = useVirtualScroll({
    items: processedCategories,
    availableHeight: availableHeight ?? Infinity,
    focusedIndex: focusedRow,
    estimateItemHeight: estimateCategoryHeight,
    terminalWidth: terminalWidth ?? DEFAULT_TERMINAL_WIDTH,
  });

  if (categories.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No categories to display.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {isScrollable && <ScrollIndicator count={hiddenAbove} direction="above" />}

      {visibleItems.map((category, visibleIndex) => {
        const originalIndex = startIndex + visibleIndex;
        const isLocked = isSectionLocked(category.id, categories);

        return (
          <CategorySection
            key={category.id}
            category={category}
            options={category.sortedOptions}
            isLocked={isLocked}
            isFocused={originalIndex === focusedRow}
            focusedOptionIndex={focusedCol}
            showDescriptions={showDescriptions}
          />
        );
      })}

      {isScrollable && <ScrollIndicator count={hiddenBelow} direction="below" />}
    </Box>
  );
};
