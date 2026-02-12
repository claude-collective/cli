import React, { useCallback, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { sortBy } from "remeda";
import type { SkillId, Subcategory } from "../../types/index.js";

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
  focusedRow: number;
  focusedCol: number;
  showDescriptions: boolean;
  expertMode: boolean;
  onToggle: (categoryId: Subcategory, technologyId: SkillId) => void;
  onFocusChange: (row: number, col: number) => void;
  onToggleDescriptions: () => void;
};

const SYMBOL_REQUIRED = "*";
const BG_SELECTED = "cyan";
const BG_FOCUSED = "#333";
const FRAMEWORK_CATEGORY_ID = "framework";

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

const findValidStartColumn = (options: CategoryOption[]): number => {
  for (let i = 0; i < options.length; i++) {
    if (options[i] && options[i].state !== "disabled") {
      return i;
    }
  }
  return 0;
};

// Locked = non-framework section when no framework is selected
const isSectionLocked = (categoryId: Subcategory, categories: CategoryRow[]): boolean => {
  if (categoryId === FRAMEWORK_CATEGORY_ID) {
    return false;
  }

  const frameworkCategory = categories.find((cat) => cat.id === FRAMEWORK_CATEGORY_ID);
  if (!frameworkCategory) return false;

  return !frameworkCategory.options.some((opt) => opt.selected);
};

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

    if (index < 0) index = length - 1;
    if (index >= length) index = 0;

    const category = categories[index];
    if (category && !isSectionLocked(category.id, allCategories)) {
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
        {option.installed && (
          <Text dimColor>✓ </Text>
        )}
        {option.label}{" "}
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
  const processedCategories = categories.map((category) => ({
    ...category,
    sortedOptions: sortOptions(category.options, expertMode),
  }));

  const currentRow = processedCategories[focusedRow];
  const currentOptions = currentRow?.sortedOptions || [];
  const currentLocked = currentRow ? isSectionLocked(currentRow.id, categories) : false;

  useEffect(() => {
    if (!currentRow) return;

    const maxCol = currentOptions.length - 1;
    if (focusedCol > maxCol) {
      const newCol = Math.max(0, maxCol);
      onFocusChange(focusedRow, newCol);
    } else if (currentOptions[focusedCol]?.state === "disabled") {
      const validCol = findValidStartColumn(currentOptions);
      if (validCol !== focusedCol) {
        onFocusChange(focusedRow, validCol);
      }
    }
  }, [focusedRow, currentOptions, focusedCol, onFocusChange, currentRow]);

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
        if (key.tab && key.shift) {
          onToggleDescriptions();
          return;
        }

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

        if (input === "d" || input === "D") {
          onToggleDescriptions();
          return;
        }

        if (input === " ") {
          if (currentLocked) return;
          const currentOption = currentOptions[focusedCol];
          if (currentOption && currentOption.state !== "disabled") {
            onToggle(currentRow.id, currentOption.id);
          }
          return;
        }

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
          const newRow = findNextUnlockedSection(processedCategories, focusedRow, -1, categories);
          const newRowOptions = processedCategories[newRow]?.sortedOptions || [];
          let newCol = Math.min(focusedCol, newRowOptions.length - 1);
          if (newRowOptions[newCol]?.state === "disabled") {
            newCol = findValidStartColumn(newRowOptions);
          }
          onFocusChange(newRow, newCol);
        } else if (isDown) {
          const newRow = findNextUnlockedSection(processedCategories, focusedRow, 1, categories);
          const newRowOptions = processedCategories[newRow]?.sortedOptions || [];
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
