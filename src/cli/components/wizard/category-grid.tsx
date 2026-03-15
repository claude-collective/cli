import React, { useCallback, useMemo, useRef } from "react";

import { Box, Text } from "ink";

import { CLI_COLORS } from "../../consts.js";
import { getSkillById } from "../../lib/matrix/matrix-provider.js";
import type { Category, OptionState, SkillId } from "../../types/index.js";
import { isSectionLocked, useCategoryGridInput } from "../hooks/use-category-grid-input.js";
import { useFocusedListItem } from "../hooks/use-focused-list-item.js";
import { useSectionScroll } from "../hooks/use-section-scroll.js";

export type CategoryOption = {
  id: SkillId;
  state: OptionState;
  selected: boolean;
  local?: boolean;
  installed?: boolean;
  scope?: "project" | "global";
  /** True when selected but has unmet dependency requirements (shown dimmed) */
  hasUnmetRequirements?: boolean;
  /** Explains unmet requirements (shown in label when D pressed) */
  unmetRequirementsReason?: string;
};

export type CategoryRow = {
  id: Category;
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
  onToggle: (categoryId: Category, technologyId: SkillId) => void;
  onToggleLabels: () => void;
  /** Optional initial focus row (default: 0). Use with React `key` to reset. */
  defaultFocusedRow?: number;
  /** Optional initial focus col (default: 0). Use with React `key` to reset. */
  defaultFocusedCol?: number;
  /** Optional callback fired whenever the focused position changes */
  onFocusChange?: (row: number, col: number) => void;
  /** Optional callback fired with the resolved SkillId of the focused cell */
  onFocusedSkillChange?: (skillId: SkillId | null) => void;
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

const getCompatibilityLabel = (option: CategoryOption): string | null => {
  if (option.selected && option.hasUnmetRequirements && option.unmetRequirementsReason) {
    return `(${option.unmetRequirementsReason})`;
  }
  if (option.selected) return null;
  if (option.state.status === "incompatible") return "(incompatible)";
  if (option.state.status === "recommended") return "(recommended)";
  if (option.state.status === "discouraged") return "(discouraged)";
  return null;
};

const SkillTag: React.FC<SkillTagProps> = ({ option, isFocused, isLocked, showLabels }) => {
  const getTextColor = (): string => {
    if (option.selected) return CLI_COLORS.PRIMARY;
    if (option.state.status === "incompatible") return CLI_COLORS.ERROR;
    if (option.state.status === "recommended") return CLI_COLORS.UNFOCUSED;
    if (option.state.status === "discouraged") return CLI_COLORS.WARNING;

    return CLI_COLORS.NEUTRAL;
  };

  const getStateBorderColor = (): string => {
    if (option.selected) return CLI_COLORS.PRIMARY;
    if (option.state.status === "incompatible") return CLI_COLORS.ERROR;
    if (option.state.status === "recommended") return CLI_COLORS.UNFOCUSED;
    if (option.state.status === "discouraged") return CLI_COLORS.WARNING;
    return CLI_COLORS.UNFOCUSED;
  };

  const textColor = getTextColor();
  const hasUnmetDeps = option.selected && !!option.hasUnmetRequirements;
  const compatibilityLabel = hasUnmetDeps
    ? getCompatibilityLabel(option)
    : showLabels && isFocused
      ? getCompatibilityLabel(option)
      : null;

  return (
    <Box
      marginRight={1}
      borderColor={isFocused ? getStateBorderColor() : CLI_COLORS.NEUTRAL}
      borderStyle="single"
      flexShrink={0}
    >
      <>
        <Text color={textColor} bold dimColor={option.selected && !!option.hasUnmetRequirements}>
          {" "}
          {getSkillById(option.id).displayName}{" "}
        </Text>
        {option.scope && <Text dimColor>{option.scope === "global" ? "G " : "P "}</Text>}
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

  const selectionCounter = category.exclusive ? `(${selectedCount} of 1)` : null;

  return (
    <Box flexDirection="column" marginTop={isFirst ? 0 : 1}>
      <Box flexDirection="row">
        {isFocused ? (
          <Text color="#000" backgroundColor={CLI_COLORS.WHITE}>
            {` ${category.displayName}${category.required ? ` ${SYMBOL_REQUIRED}` : ""}${selectionCounter ? ` ${selectionCounter}` : ""} `}
          </Text>
        ) : (
          <>
            <Text color="gray">{category.displayName}</Text>
            {category.required && <Text color={CLI_COLORS.ERROR}> {SYMBOL_REQUIRED}</Text>}
            {selectionCounter && <Text dimColor> {selectionCounter}</Text>}
          </>
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
  onToggle,
  onToggleLabels,
  defaultFocusedRow = 0,
  defaultFocusedCol = 0,
  onFocusChange,
  onFocusedSkillChange,
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

  const handleFocusChange = useCallback(
    (row: number, col: number) => {
      if (showLabels) onToggleLabels();
      onFocusChange?.(row, col);
      const skill = processedCategories[row]?.sortedOptions[col];
      onFocusedSkillChange?.(skill?.id ?? null);
    },
    [showLabels, onToggleLabels, onFocusChange, processedCategories, onFocusedSkillChange],
  );

  const { focusedRow, focusedCol, setFocused, moveFocus } = useFocusedListItem(
    processedCategories.length,
    getColCount,
    {
      wrap: true,
      isRowLocked,
      findValidCol,
      onChange: handleFocusChange,
      initialRow: defaultFocusedRow,
      initialCol: defaultFocusedCol,
    },
  );

  const mountedRef = useRef(false);
  if (!mountedRef.current) {
    mountedRef.current = true;
    const skill = processedCategories[defaultFocusedRow]?.sortedOptions[defaultFocusedCol];
    onFocusedSkillChange?.(skill?.id ?? null);
  }

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
