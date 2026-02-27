import React, { useCallback, useMemo } from "react";

import { Box, Text } from "ink";

import { CLI_COLORS } from "../../consts.js";
import type { SkillId, Subcategory } from "../../types/index.js";
import { isSectionLocked, useCategoryGridInput } from "../hooks/use-category-grid-input.js";
import { useFocusedListItem } from "../hooks/use-focused-list-item.js";
import { useSectionScroll } from "../hooks/use-section-scroll.js";

export type OptionState = "normal" | "recommended" | "discouraged";

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
  /** Available height in terminal lines for the scrollable viewport. 0 = no constraint. */
  availableHeight?: number;
  showLabels: boolean;
  onToggle: (categoryId: Subcategory, technologyId: SkillId) => void;
  onToggleLabels: () => void;
  /** Optional initial focus row (default: 0). Use with React `key` to reset. */
  defaultFocusedRow?: number;
  /** Optional initial focus col (default: 0). Use with React `key` to reset. */
  defaultFocusedCol?: number;
  /** Optional callback fired whenever the focused position changes */
  onFocusChange?: (row: number, col: number) => void;
};

const SYMBOL_REQUIRED = "*";

const findNextValidOption = (
  options: CategoryOption[],
  currentIndex: number,
  direction: 1 | -1,
  wrap = true,
): number => {
  const length = options.length;
  if (length === 0) return currentIndex;

  let index = currentIndex + direction;

  if (wrap) {
    if (index < 0) index = length - 1;
    if (index >= length) index = 0;
  } else {
    if (index < 0) index = 0;
    if (index >= length) index = length - 1;
  }

  return index;
};

type SkillTagProps = {
  option: CategoryOption;
  isFocused: boolean;
  isLocked: boolean;
  showLabels: boolean;
};

const getCompatibilityLabel = (option: CategoryOption, isLocked: boolean): string | null => {
  if (option.selected) return "(selected)";
  if (isLocked) return "(disabled)";
  if (option.state === "recommended") return "(recommended)";
  if (option.state === "discouraged") return "(discouraged)";
  return null;
};

const SkillTag: React.FC<SkillTagProps> = ({ option, isFocused, isLocked, showLabels }) => {
  const getTextColor = (): string => {
    if (isLocked) return CLI_COLORS.NEUTRAL;
    if (option.selected) return CLI_COLORS.PRIMARY;
    if (option.state === "recommended") return CLI_COLORS.UNFOCUSED;
    if (option.state === "discouraged") return CLI_COLORS.WARNING;

    return CLI_COLORS.NEUTRAL;
  };

  const getStateBorderColor = (): string => {
    if (isLocked) return CLI_COLORS.NEUTRAL;
    if (option.selected) return CLI_COLORS.PRIMARY;
    if (option.state === "recommended") return CLI_COLORS.UNFOCUSED;
    if (option.state === "discouraged") return CLI_COLORS.WARNING;
    return CLI_COLORS.UNFOCUSED;
  };

  const textColor = getTextColor();
  const compatibilityLabel = showLabels ? getCompatibilityLabel(option, isLocked) : null;

  return (
    <Box
      marginRight={1}
      borderColor={isFocused ? getStateBorderColor() : CLI_COLORS.NEUTRAL}
      borderStyle="single"
      flexShrink={0}
    >
      <>
        <Text color={textColor} bold>
          {" "}
          {option.label}{" "}
        </Text>
        {compatibilityLabel && <Text dimColor>{compatibilityLabel} </Text>}
      </>
    </Box>
  );
};

type CategorySectionProps = {
  isFirst: boolean;
  category: CategoryRow;
  options: CategoryOption[];
  isLocked: boolean;
  isFocused: boolean;
  focusedOptionIndex: number;
  showLabels: boolean;
};

const CategorySection: React.FC<CategorySectionProps> = ({
  isFirst,
  category,
  options,
  isLocked,
  isFocused,
  focusedOptionIndex,
  showLabels,
}) => {
  const selectedCount = options.filter((o) => o.selected).length;

  const selectionCounter = category.exclusive
    ? `(${selectedCount} of 1)`
    : `(${selectedCount} selected)`;

  return (
    <Box flexDirection="column" marginTop={isFirst ? 0 : 1}>
      <Box flexDirection="row">
        <Text dimColor={isLocked} color={isFocused ? "#fff" : "gray"}>
          {category.displayName}
        </Text>
        {category.required && (
          <Text color={isLocked ? CLI_COLORS.NEUTRAL : CLI_COLORS.ERROR} dimColor={isLocked}>
            {" "}
            {SYMBOL_REQUIRED}
          </Text>
        )}
        {selectionCounter && <Text dimColor> {selectionCounter}</Text>}
      </Box>

      <Box flexDirection="row" flexWrap="wrap" marginTop={0}>
        {options.map((option, index) => (
          <SkillTag
            key={option.id}
            option={option}
            isFocused={isFocused && index === focusedOptionIndex && !isLocked}
            isLocked={isLocked}
            showLabels={showLabels}
          />
        ))}
      </Box>
    </Box>
  );
};

type ProcessedCategory = CategoryRow & { sortedOptions: CategoryOption[] };

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  availableHeight = 0,
  showLabels,
  onToggle,
  onToggleLabels,
  defaultFocusedRow = 0,
  defaultFocusedCol = 0,
  onFocusChange,
}) => {
  const processedCategories = useMemo(
    () => categories.map((category) => ({ ...category, sortedOptions: category.options })),
    [categories],
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

  const { focusedRow, focusedCol, setFocused, moveFocus } = useFocusedListItem(
    processedCategories.length,
    getColCount,
    {
      wrap: true,
      isRowLocked,
      findValidCol,
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
    onToggleLabels,
  });

  const { setSectionRef, scrollEnabled, scrollTopPx } = useSectionScroll({
    sectionCount: processedCategories.length,
    focusedIndex: focusedRow,
    availableHeight,
  });

  if (categories.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No categories to display.</Text>
      </Box>
    );
  }

  const noShrink = scrollEnabled ? { flexShrink: 0 } : {};

  const sectionElements = processedCategories.map((category, index) => {
    const isLocked = isSectionLocked(category.id, categories);

    return (
      <Box key={category.id} ref={(el) => setSectionRef(index, el)} {...noShrink}>
        <CategorySection
          category={category}
          options={category.sortedOptions}
          isLocked={isLocked}
          isFocused={index === focusedRow}
          focusedOptionIndex={focusedCol}
          showLabels={showLabels}
          isFirst={index === 0}
        />
      </Box>
    );
  });

  return (
    <Box
      flexDirection="column"
      {...(scrollEnabled
        ? { height: availableHeight, overflow: "hidden" as const }
        : { flexGrow: 1 })}
    >
      <Box flexDirection="column" marginTop={scrollTopPx > 0 ? -scrollTopPx : 0} {...noShrink}>
        {sectionElements}
      </Box>
    </Box>
  );
};
