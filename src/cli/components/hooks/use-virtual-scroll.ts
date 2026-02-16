import { useMemo } from "react";
import { SCROLL_VIEWPORT } from "../../consts.js";

export type VirtualScrollOptions<T> = {
  /** All items to potentially display */
  items: T[];
  /** Maximum height in terminal rows for the scrollable area */
  availableHeight: number;
  /** Current focused item index (drives auto-scroll) */
  focusedIndex: number;
  /** Estimate the height of a single item in terminal rows */
  estimateItemHeight: (item: T, terminalWidth: number) => number;
  /** Current terminal width (for tag wrapping estimation) */
  terminalWidth: number;
};

export type VirtualScrollResult<T> = {
  /** Items visible in the current viewport window */
  visibleItems: T[];
  /** Index of the first visible item in the original array */
  startIndex: number;
  /** Index past the last visible item in the original array */
  endIndex: number;
  /** Number of items hidden above the viewport */
  hiddenAbove: number;
  /** Number of items hidden below the viewport */
  hiddenBelow: number;
  /** Whether the content is scrollable (total items exceed viewport) */
  isScrollable: boolean;
};

/**
 * Pure computation for virtual scroll windowing.
 *
 * Computes a contiguous window of items that fits within `availableHeight`,
 * ensuring the `focusedIndex` item is always visible. When the focused item
 * moves outside the current window, the window shifts to include it.
 *
 * Height is estimated per-item via `estimateItemHeight` rather than measured
 * post-render, avoiding the chicken-and-egg measurement problem with Ink.
 */
export function computeVirtualScroll<T>({
  items,
  availableHeight,
  focusedIndex,
  estimateItemHeight,
  terminalWidth,
}: VirtualScrollOptions<T>): VirtualScrollResult<T> {
  const totalItems = items.length;

  if (totalItems === 0) {
    return {
      visibleItems: [],
      startIndex: 0,
      endIndex: 0,
      hiddenAbove: 0,
      hiddenBelow: 0,
      isScrollable: false,
    };
  }

  // Compute heights for each item
  const heights = items.map((item) => estimateItemHeight(item, terminalWidth));
  const totalHeight = heights.reduce((sum, h) => sum + h, 0);

  // If everything fits, no scrolling needed
  if (totalHeight <= availableHeight) {
    return {
      visibleItems: items,
      startIndex: 0,
      endIndex: totalItems,
      hiddenAbove: 0,
      hiddenBelow: 0,
      isScrollable: false,
    };
  }

  // Reserve space for scroll indicators when content overflows
  const viewportHeight = Math.max(
    SCROLL_VIEWPORT.MIN_VIEWPORT_ROWS,
    availableHeight - SCROLL_VIEWPORT.SCROLL_INDICATOR_HEIGHT * 2,
  );

  // Clamp focused index
  const safeFocused = Math.max(0, Math.min(focusedIndex, totalItems - 1));

  // Find a window that includes the focused item and fills the viewport.
  // Strategy: start from focused item and expand outward.
  let startIndex = safeFocused;
  let endIndex = safeFocused + 1;
  let usedHeight = heights[safeFocused] ?? 0;

  // Expand downward first
  while (endIndex < totalItems) {
    const nextHeight = heights[endIndex] ?? 0;
    if (usedHeight + nextHeight > viewportHeight) break;
    usedHeight += nextHeight;
    endIndex++;
  }

  // Expand upward with remaining space
  while (startIndex > 0) {
    const prevHeight = heights[startIndex - 1] ?? 0;
    if (usedHeight + prevHeight > viewportHeight) break;
    usedHeight += prevHeight;
    startIndex--;
  }

  // If we still have room after expanding up, try expanding down again
  while (endIndex < totalItems) {
    const nextHeight = heights[endIndex] ?? 0;
    if (usedHeight + nextHeight > viewportHeight) break;
    usedHeight += nextHeight;
    endIndex++;
  }

  return {
    visibleItems: items.slice(startIndex, endIndex),
    startIndex,
    endIndex,
    hiddenAbove: startIndex,
    hiddenBelow: totalItems - endIndex,
    isScrollable: true,
  };
}

/**
 * React hook wrapper around `computeVirtualScroll`.
 * Memoizes the result based on input changes.
 */
export function useVirtualScroll<T>(options: VirtualScrollOptions<T>): VirtualScrollResult<T> {
  const { items, availableHeight, focusedIndex, estimateItemHeight, terminalWidth } = options;
  return useMemo(
    () => computeVirtualScroll(options),
    [items, availableHeight, focusedIndex, estimateItemHeight, terminalWidth],
  );
}
