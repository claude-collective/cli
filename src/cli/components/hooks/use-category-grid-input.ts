import { useCallback, useEffect } from "react";
import { useInput } from "ink";

import type { Subcategory, SkillId } from "../../types/index.js";
import type { CategoryOption, CategoryRow } from "../wizard/category-grid.js";

const FRAMEWORK_CATEGORY_ID = "framework";

// Locked = non-framework section when no framework is selected
export const isSectionLocked = (categoryId: Subcategory, categories: CategoryRow[]): boolean => {
  if (categoryId === FRAMEWORK_CATEGORY_ID) {
    return false;
  }

  const frameworkCategory = categories.find((cat) => cat.id === FRAMEWORK_CATEGORY_ID);
  if (!frameworkCategory) return false;

  return !frameworkCategory.options.some((opt) => opt.selected);
};

export const findValidStartColumn = (_options: CategoryOption[]): number => {
  return 0;
};

/** Find next unlocked section index (wrapping, direction: forward) */
export const findNextUnlockedIndex = (
  processed: { id: Subcategory; sortedOptions: CategoryOption[] }[],
  currentIndex: number,
  allCategories: CategoryRow[],
): number => {
  const length = processed.length;
  if (length === 0) return currentIndex;

  let index = currentIndex;
  let attempts = 0;

  while (attempts < length) {
    index += 1;
    if (index >= length) index = 0;

    const category = processed[index];
    if (category && !isSectionLocked(category.id, allCategories)) {
      return index;
    }

    attempts++;
  }

  return currentIndex;
};

type ProcessedCategory = CategoryRow & { sortedOptions: CategoryOption[] };

type UseCategoryGridInputOptions = {
  processedCategories: ProcessedCategory[];
  categories: CategoryRow[];
  focusedRow: number;
  focusedCol: number;
  setFocused: (row: number, col: number) => void;
  moveFocus: (direction: "up" | "down" | "left" | "right") => void;
  onToggle: (categoryId: Subcategory, technologyId: SkillId) => void;
  onToggleDescriptions: () => void;
};

export function useCategoryGridInput({
  processedCategories,
  categories,
  focusedRow,
  focusedCol,
  setFocused,
  moveFocus,
  onToggle,
  onToggleDescriptions,
}: UseCategoryGridInputOptions): void {
  const currentRow = processedCategories[focusedRow];
  const currentOptions = currentRow?.sortedOptions || [];
  const currentLocked = currentRow ? isSectionLocked(currentRow.id, categories) : false;

  // Adjust column when current row's options change externally (e.g. option becomes disabled)
  useEffect(() => {
    if (!currentRow) return;

    const maxCol = currentOptions.length - 1;
    if (focusedCol > maxCol) {
      const newCol = Math.max(0, maxCol);
      setFocused(focusedRow, newCol);
    }
  }, [focusedRow, currentOptions, focusedCol, setFocused, currentRow]);

  // Bounce off locked sections when a section becomes locked (e.g. framework deselected)
  useEffect(() => {
    if (currentRow && currentLocked) {
      const nextUnlocked = findNextUnlockedIndex(processedCategories, focusedRow, categories);
      if (nextUnlocked !== focusedRow) {
        const newRowOptions = processedCategories[nextUnlocked]?.sortedOptions || [];
        const newCol = findValidStartColumn(newRowOptions);
        setFocused(nextUnlocked, newCol);
      }
    }
  }, [currentRow, currentLocked, focusedRow, processedCategories, categories, setFocused]);

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
          const nextSection = findNextUnlockedIndex(processedCategories, focusedRow, categories);
          if (nextSection !== focusedRow) {
            const newRowOptions = processedCategories[nextSection]?.sortedOptions || [];
            const newCol = findValidStartColumn(newRowOptions);
            setFocused(nextSection, newCol);
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
          moveFocus("left");
        } else if (isRight) {
          if (currentLocked) return;
          moveFocus("right");
        } else if (isUp) {
          moveFocus("up");
        } else if (isDown) {
          moveFocus("down");
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
        onToggleDescriptions,
        setFocused,
        moveFocus,
      ],
    ),
  );
}
