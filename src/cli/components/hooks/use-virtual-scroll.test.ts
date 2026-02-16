import { describe, it, expect } from "vitest";
import { computeVirtualScroll, type VirtualScrollOptions } from "./use-virtual-scroll";

type TestItem = { height: number };

const createItem = (height: number): TestItem => ({ height });
const heightEstimator = (item: TestItem): number => item.height;

const DEFAULT_WIDTH = 120;

const compute = (overrides: Partial<VirtualScrollOptions<TestItem>> = {}) =>
  computeVirtualScroll<TestItem>({
    items: [],
    availableHeight: 20,
    focusedIndex: 0,
    estimateItemHeight: heightEstimator,
    terminalWidth: DEFAULT_WIDTH,
    ...overrides,
  });

describe("computeVirtualScroll", () => {
  describe("no scrolling needed", () => {
    it("should return all items when total height fits", () => {
      const items = [createItem(5), createItem(5), createItem(5)];
      const result = compute({ items, availableHeight: 20 });

      expect(result.visibleItems).toEqual(items);
      expect(result.startIndex).toBe(0);
      expect(result.endIndex).toBe(3);
      expect(result.hiddenAbove).toBe(0);
      expect(result.hiddenBelow).toBe(0);
      expect(result.isScrollable).toBe(false);
    });

    it("should return empty result for empty items", () => {
      const result = compute({ items: [], availableHeight: 20 });

      expect(result.visibleItems).toEqual([]);
      expect(result.startIndex).toBe(0);
      expect(result.endIndex).toBe(0);
      expect(result.hiddenAbove).toBe(0);
      expect(result.hiddenBelow).toBe(0);
      expect(result.isScrollable).toBe(false);
    });

    it("should return all items when total height equals available", () => {
      const items = [createItem(5), createItem(5)];
      const result = compute({ items, availableHeight: 10 });

      expect(result.isScrollable).toBe(false);
      expect(result.visibleItems).toEqual(items);
    });
  });

  describe("scrolling required", () => {
    it("should window items around focused index", () => {
      // 10 items, height 3 each = total 30. Available 12 - 2 indicators = 10 viewport.
      // Each item is 3 high, so 3 items fit (9 <= 10, 4 items = 12 > 10).
      const items = Array.from({ length: 10 }, () => createItem(3));
      const result = compute({ items, availableHeight: 12, focusedIndex: 5 });

      expect(result.isScrollable).toBe(true);
      // Focused at 5, expanding down then up within 10 rows of viewport
      expect(result.visibleItems.length).toBeGreaterThanOrEqual(3);
      // Focused item (index 5) should be in the visible window
      expect(result.startIndex).toBeLessThanOrEqual(5);
      expect(result.endIndex).toBeGreaterThan(5);
    });

    it("should show correct hiddenAbove and hiddenBelow counts", () => {
      const items = Array.from({ length: 10 }, () => createItem(3));
      const result = compute({ items, availableHeight: 12, focusedIndex: 5 });

      expect(result.hiddenAbove).toBe(result.startIndex);
      expect(result.hiddenBelow).toBe(10 - result.endIndex);
      expect(result.hiddenAbove + result.hiddenBelow + (result.endIndex - result.startIndex)).toBe(
        10,
      );
    });

    it("should keep focused item visible when at start", () => {
      const items = Array.from({ length: 10 }, () => createItem(3));
      const result = compute({ items, availableHeight: 12, focusedIndex: 0 });

      expect(result.startIndex).toBe(0);
      expect(result.hiddenAbove).toBe(0);
      expect(result.hiddenBelow).toBeGreaterThan(0);
    });

    it("should keep focused item visible when at end", () => {
      const items = Array.from({ length: 10 }, () => createItem(3));
      const result = compute({ items, availableHeight: 12, focusedIndex: 9 });

      expect(result.endIndex).toBe(10);
      expect(result.hiddenBelow).toBe(0);
      expect(result.hiddenAbove).toBeGreaterThan(0);
    });

    it("should keep focused item visible when at boundary", () => {
      const items = Array.from({ length: 10 }, () => createItem(3));
      const result = compute({ items, availableHeight: 12, focusedIndex: 7 });

      // Index 7 should be visible
      expect(result.startIndex).toBeLessThanOrEqual(7);
      expect(result.endIndex).toBeGreaterThan(7);
    });
  });

  describe("variable heights", () => {
    it("should handle items with different heights", () => {
      const items = [createItem(2), createItem(5), createItem(3), createItem(8), createItem(2)];
      // Total = 20. Available 10 - 2 = 8 viewport
      const result = compute({ items, availableHeight: 10, focusedIndex: 2 });

      expect(result.isScrollable).toBe(true);
      // Item at index 2 (height 3) should be visible
      expect(result.startIndex).toBeLessThanOrEqual(2);
      expect(result.endIndex).toBeGreaterThan(2);
    });

    it("should handle very tall single item", () => {
      // One item taller than viewport
      const items = [createItem(2), createItem(20), createItem(2)];
      const result = compute({ items, availableHeight: 10, focusedIndex: 1 });

      expect(result.isScrollable).toBe(true);
      // The tall item should still be included (even if it overflows)
      expect(result.startIndex).toBeLessThanOrEqual(1);
      expect(result.endIndex).toBeGreaterThan(1);
    });
  });

  describe("edge cases", () => {
    it("should handle availableHeight of 0", () => {
      const items = [createItem(5), createItem(5)];
      const result = compute({ items, availableHeight: 0, focusedIndex: 0 });

      // MIN_VIEWPORT_ROWS ensures at least some rows
      expect(result.isScrollable).toBe(true);
      expect(result.visibleItems.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle single item that fits", () => {
      const items = [createItem(3)];
      const result = compute({ items, availableHeight: 10, focusedIndex: 0 });

      expect(result.visibleItems).toEqual(items);
      expect(result.isScrollable).toBe(false);
    });

    it("should clamp focused index to valid range when too high", () => {
      const items = Array.from({ length: 5 }, () => createItem(3));
      const result = compute({ items, availableHeight: 8, focusedIndex: 100 });

      // Should not crash, should treat as last item
      expect(result.endIndex).toBe(5);
      expect(result.isScrollable).toBe(true);
    });

    it("should clamp negative focused index to 0", () => {
      const items = Array.from({ length: 5 }, () => createItem(3));
      const result = compute({ items, availableHeight: 8, focusedIndex: -1 });

      expect(result.startIndex).toBe(0);
      expect(result.isScrollable).toBe(true);
    });

    it("should handle Infinity availableHeight (no constraint)", () => {
      const items = Array.from({ length: 50 }, () => createItem(3));
      const result = compute({ items, availableHeight: Infinity, focusedIndex: 0 });

      expect(result.isScrollable).toBe(false);
      expect(result.visibleItems.length).toBe(50);
    });
  });

  describe("focus-driven scrolling", () => {
    it("should shift window when focused index moves down", () => {
      const items = Array.from({ length: 10 }, () => createItem(3));

      const result0 = compute({ items, availableHeight: 12, focusedIndex: 0 });
      const result5 = compute({ items, availableHeight: 12, focusedIndex: 5 });

      // Window should have shifted down
      expect(result5.startIndex).toBeGreaterThan(result0.startIndex);
    });

    it("should shift window when focused index moves up", () => {
      const items = Array.from({ length: 10 }, () => createItem(3));

      const result9 = compute({ items, availableHeight: 12, focusedIndex: 9 });
      const result2 = compute({ items, availableHeight: 12, focusedIndex: 2 });

      // Window should have shifted up
      expect(result2.startIndex).toBeLessThan(result9.startIndex);
    });
  });
});
