import { useCallback, useEffect, useRef } from "react";
import { useInput } from "ink";

import type { Subcategory, SkillId } from "../../types/index.js";
import type { CategoryOption, CategoryRow } from "../wizard/category-grid.js";

const FRAMEWORK_CATEGORY_ID = "web-framework";

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
  onToggleLabels: () => void;
};

export function useCategoryGridInput({
  processedCategories,
  categories,
  focusedRow,
  focusedCol,
  setFocused,
  moveFocus,
  onToggle,
  onToggleLabels,
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

  // Store the latest handler in a ref so that the useInput effect never needs to
  // re-register on the event emitter. This avoids a stale-closure race condition
  // where, after a domain switch (CategoryGrid remount via key={activeDomain}),
  // the useInput effect may not yet have re-registered the updated handler when
  // the first keypress arrives — causing the first space press to be silently lost.
  type InputKey = {
    leftArrow: boolean;
    rightArrow: boolean;
    upArrow: boolean;
    downArrow: boolean;
    tab: boolean;
    shift: boolean;
  };

  const handlerRef = useRef<((input: string, key: InputKey) => void) | null>(null);
  handlerRef.current = (input: string, key: InputKey) => {
    if (key.tab && key.shift) {
      onToggleLabels();
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
      onToggleLabels();
      return;
    }

    if (input === " ") {
      if (currentLocked) return;
      const currentOption = currentOptions[focusedCol];
      if (currentOption) {
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
  };

  // Stable handler reference — never changes, so useInput's effect registers once
  const stableHandler = useCallback((input: string, key: InputKey) => {
    handlerRef.current?.(input, key);
  }, []);

  useInput(stableHandler);
}
