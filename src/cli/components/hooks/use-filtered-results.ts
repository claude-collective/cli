import { useState, useMemo, useEffect, useCallback, useRef } from "react";

type UseFilteredResultsOptions<T> = {
  /** Items to filter */
  items: T[];
  /** Current search query */
  query: string;
  /** Filter predicate — returns true if item matches the query */
  filterFn: (item: T, query: string) => boolean;
  /** Number of visible rows in the scrollable viewport */
  maxVisible: number;
};

type UseFilteredResultsResult<T> = {
  /** Items that pass the filter */
  filteredResults: T[];
  /** Index clamped to valid range */
  safeFocusedIndex: number;
  /** The item at safeFocusedIndex, or undefined when empty */
  focusedItem: T | undefined;
  /** First visible row offset for windowed rendering */
  scrollOffset: number;
  /** Move focus up one row (clamped, adjusts scroll) */
  moveUp: () => void;
  /** Move focus down one row (clamped, adjusts scroll) */
  moveDown: () => void;
};

/**
 * Manages filtered list state: query-based filtering, focus tracking,
 * and scroll-offset synchronisation for windowed rendering.
 * Focus and scroll reset automatically when the query changes.
 */
export function useFilteredResults<T>({
  items,
  query,
  filterFn,
  maxVisible,
}: UseFilteredResultsOptions<T>): UseFilteredResultsResult<T> {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    setFocusedIndex(0);
    setScrollOffset(0);
  }, [query]);

  const filteredResults = useMemo(() => {
    return items.filter((item) => filterFn(item, query));
  }, [items, query, filterFn]);

  const safeFocusedIndex = Math.min(focusedIndex, Math.max(0, filteredResults.length - 1));
  const focusedItem = filteredResults[safeFocusedIndex] as T | undefined;

  // Refs for stable callback access (matches use-keyboard-navigation pattern)
  const safeFocusedIndexRef = useRef(safeFocusedIndex);
  const scrollOffsetRef = useRef(scrollOffset);
  const resultCountRef = useRef(filteredResults.length);

  useEffect(() => {
    safeFocusedIndexRef.current = safeFocusedIndex;
  }, [safeFocusedIndex]);

  useEffect(() => {
    scrollOffsetRef.current = scrollOffset;
  }, [scrollOffset]);

  useEffect(() => {
    resultCountRef.current = filteredResults.length;
  }, [filteredResults.length]);

  const moveUp = useCallback(() => {
    const current = safeFocusedIndexRef.current;
    if (current <= 0) return;
    const newIndex = current - 1;
    setFocusedIndex(newIndex);
    if (newIndex < scrollOffsetRef.current) {
      setScrollOffset(newIndex);
    }
  }, []);

  const moveDown = useCallback(() => {
    const current = safeFocusedIndexRef.current;
    if (current >= resultCountRef.current - 1) return;
    const newIndex = current + 1;
    setFocusedIndex(newIndex);
    if (newIndex >= scrollOffsetRef.current + maxVisible) {
      setScrollOffset(newIndex - maxVisible + 1);
    }
  }, [maxVisible]);

  return {
    filteredResults,
    safeFocusedIndex,
    focusedItem,
    scrollOffset,
    moveUp,
    moveDown,
  };
}
