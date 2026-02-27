import { useCallback, useEffect, useRef, useState } from "react";
import { type DOMElement, measureElement } from "ink";
import { SCROLL_VIEWPORT } from "../../consts.js";

export type UseSectionScrollOptions = {
  sectionCount: number;
  focusedIndex: number;
  availableHeight: number;
};

export type UseSectionScrollResult = {
  setSectionRef: (index: number, el: DOMElement | null) => void;
  scrollEnabled: boolean;
  scrollTopPx: number;
};

/**
 * Shared pixel-offset scroll hook for views with variable-height sections.
 *
 * Manages section refs, height measurement, and scroll position to keep the
 * focused section visible within a constrained viewport. Extracted from the
 * identical scroll plumbing in category-grid.tsx and source-grid.tsx.
 */
export function useSectionScroll({
  sectionCount,
  focusedIndex,
  availableHeight,
}: UseSectionScrollOptions): UseSectionScrollResult {
  const sectionRefs = useRef<(DOMElement | null)[]>([]);
  const [sectionHeights, setSectionHeights] = useState<number[]>([]);
  const [scrollTopPx, setScrollTopPx] = useState(0);

  const setSectionRef = useCallback((index: number, el: DOMElement | null) => {
    sectionRefs.current[index] = el;
  }, []);

  // Measure section heights on every render
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

  // Keep focused section visible
  useEffect(() => {
    if (!scrollEnabled || sectionHeights.length === 0) return;

    let topOfFocused = 0;
    for (let i = 0; i < focusedIndex; i++) {
      topOfFocused += sectionHeights[i] ?? 0;
    }
    const focusedHeight = sectionHeights[focusedIndex] ?? 0;
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
  }, [focusedIndex, sectionHeights, scrollEnabled, availableHeight]);

  return { setSectionRef, scrollEnabled, scrollTopPx };
}

/**
 * Pure function for row-based scroll offset computation.
 *
 * For views with uniform 1-line rows (step-agents, checkbox-grid, step-settings),
 * computes the scroll offset (in rows) to keep `focusedRow` visible within
 * a viewport of `viewportHeight` rows.
 */
export function computeRowScrollTop(
  focusedRow: number,
  currentScrollTop: number,
  viewportHeight: number,
): number {
  if (focusedRow < currentScrollTop) {
    return focusedRow;
  }
  if (focusedRow + 1 > currentScrollTop + viewportHeight) {
    return focusedRow + 1 - viewportHeight;
  }
  return currentScrollTop;
}
