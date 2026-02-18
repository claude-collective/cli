import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Box, type DOMElement, Text, measureElement } from "ink";

import { CLI_COLORS, SCROLL_VIEWPORT } from "../../consts.js";
import type { SkillId, Subcategory } from "../../types/index.js";
import { isSectionLocked, useCategoryGridInput } from "../hooks/use-category-grid-input.js";
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
  /** Available height in terminal lines for the scrollable viewport. 0 = no constraint. */
  availableHeight?: number;
  showLabels: boolean;
  expertMode: boolean;
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

/**
 * Priority order for skill states in the initial sort.
 * Lower numbers appear first. Selected skills are sorted above all states.
 */
const STATE_PRIORITY: Record<OptionState, number> = {
  recommended: 0,
  normal: 1,
  discouraged: 2,
  disabled: 3,
};

/**
 * Sort options by: selected first, then by state priority.
 * Within each group, original matrix order is preserved (stable sort).
 */
const stableSortByState = (options: CategoryOption[]): CategoryOption[] => {
  return [...options].sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1;
    return STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state];
  });
};

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
  if (isLocked || option.state === "disabled") return "(disabled)";
  if (option.state === "recommended") return "(recommended)";
  if (option.state === "discouraged") return "(discouraged)";
  return null;
};

const SkillTag: React.FC<SkillTagProps> = ({ option, isFocused, isLocked, showLabels }) => {
  const getTextColor = (): string => {
    if (isLocked || option.state === "disabled") return CLI_COLORS.NEUTRAL;
    if (option.selected) return CLI_COLORS.PRIMARY;
    if (option.state === "recommended") return CLI_COLORS.UNFOCUSED;
    if (option.state === "discouraged") return CLI_COLORS.WARNING;
    // Normal unselected: muted color to clearly contrast with selected (cyan) skills
    return CLI_COLORS.NEUTRAL;
  };

  const getStateBorderColor = (): string => {
    if (isLocked || option.state === "disabled") return CLI_COLORS.NEUTRAL;
    if (option.selected) return CLI_COLORS.PRIMARY;
    if (option.state === "recommended") return CLI_COLORS.UNFOCUSED;
    if (option.state === "discouraged") return CLI_COLORS.WARNING;
    return CLI_COLORS.UNFOCUSED;
  };

  const isBold = isFocused || option.selected;
  const textColor = getTextColor();
  const compatibilityLabel = showLabels ? getCompatibilityLabel(option, isLocked) : null;

  return (
    <Box
      marginRight={1}
      borderColor={isFocused ? getStateBorderColor() : CLI_COLORS.NEUTRAL}
      borderStyle="single"
      borderDimColor={!isFocused}
      flexShrink={0}
    >
      <>
        <Text color={textColor} bold={isBold} dimColor={false}>
          {" "}
          {option.label}{" "}
        </Text>
        {compatibilityLabel && <Text dimColor>{compatibilityLabel} </Text>}
      </>
    </Box>
  );
};

type CategorySectionProps = {
  category: CategoryRow;
  options: CategoryOption[];
  isLocked: boolean;
  isFocused: boolean;
  focusedOptionIndex: number;
  showLabels: boolean;
};

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  options,
  isLocked,
  isFocused,
  focusedOptionIndex,
  showLabels,
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
  expertMode,
  onToggle,
  onToggleLabels,
  defaultFocusedRow = 0,
  defaultFocusedCol = 0,
  onFocusChange,
}) => {
  // Cache the initial sort order per category so toggling selections does not reorder skills.
  // The ref resets when the component remounts (e.g., domain change via key={activeDomain}).
  const initialOrderRef = useRef<Map<string, SkillId[]>>(new Map());

  const processedCategories = useMemo(
    () =>
      categories.map((category) => {
        const cached = initialOrderRef.current.get(category.id);
        if (cached) {
          const orderMap = new Map(cached.map((id, idx) => [id, idx]));
          const sorted = [...category.options].sort((a, b) => {
            const aIdx = orderMap.get(a.id) ?? Infinity;
            const bIdx = orderMap.get(b.id) ?? Infinity;
            return aIdx - bIdx;
          });
          return { ...category, sortedOptions: sorted };
        }
        const sorted = stableSortByState(category.options);
        initialOrderRef.current.set(
          category.id,
          sorted.map((o) => o.id),
        );
        return { ...category, sortedOptions: sorted };
      }),
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

  const sectionRefs = useRef<(DOMElement | null)[]>([]);
  const [sectionHeights, setSectionHeights] = useState<number[]>([]);
  const [scrollTopPx, setScrollTopPx] = useState(0);

  const setSectionRef = useCallback((index: number, el: DOMElement | null) => {
    sectionRefs.current[index] = el;
  }, []);

  useEffect(() => {
    const heights = sectionRefs.current.map((el) => {
      if (el) {
        const { height } = measureElement(el);
        return height;
      }
      return 0;
    });
    setSectionHeights((prev) => {
      if (prev.length === heights.length && prev.every((h, i) => h === heights[i])) {
        return prev;
      }
      return heights;
    });
  });

  const scrollEnabled = availableHeight > 0 && availableHeight >= SCROLL_VIEWPORT.MIN_VIEWPORT_ROWS;

  useEffect(() => {
    if (!scrollEnabled || sectionHeights.length === 0) return;

    let topOfFocused = 0;
    for (let i = 0; i < focusedRow; i++) {
      topOfFocused += sectionHeights[i] ?? 0;
    }
    const focusedHeight = sectionHeights[focusedRow] ?? 0;
    const bottomOfFocused = topOfFocused + focusedHeight;

    setScrollTopPx((prev) => {
      if (topOfFocused < prev) {
        return topOfFocused;
      }
      if (bottomOfFocused > prev + availableHeight) {
        return bottomOfFocused - availableHeight;
      }
      return prev;
    });
  }, [focusedRow, sectionHeights, scrollEnabled, availableHeight]);

  if (categories.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No categories to display.</Text>
      </Box>
    );
  }

  const sectionElements = processedCategories.map((category, index) => {
    const isLocked = isSectionLocked(category.id, categories);

    return (
      <Box key={category.id} ref={(el) => setSectionRef(index, el)} flexShrink={0}>
        <CategorySection
          category={category}
          options={category.sortedOptions}
          isLocked={isLocked}
          isFocused={index === focusedRow}
          focusedOptionIndex={focusedCol}
          showLabels={showLabels}
        />
      </Box>
    );
  });

  // When no height constraint, render flat (tests, or before first measurement)
  if (!scrollEnabled) {
    return (
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {sectionElements}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={availableHeight} overflow="hidden">
      <Box flexDirection="column" marginTop={scrollTopPx > 0 ? -scrollTopPx : 0} flexShrink={0}>
        {sectionElements}
      </Box>
    </Box>
  );
};
