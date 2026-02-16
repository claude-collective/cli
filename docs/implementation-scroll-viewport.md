# Implementation Plan: Wizard Scroll Viewport System

> Task U9 - Fixed Height for Main CLI Content with Dynamic Terminal Resize Handling

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Decisions](#architecture-decisions)
3. [Type Definitions](#type-definitions)
4. [Component Changes](#component-changes)
5. [Implementation Steps](#implementation-steps)
6. [Testing Strategy](#testing-strategy)
7. [Edge Cases](#edge-cases)
8. [Success Criteria](#success-criteria)

---

## Overview

The wizard's Build step renders all category sections at once. When terminal height is
shorter than the content, Ink pushes everything upward, causing the header, tabs, and
top categories to disappear off-screen. Additionally, Ink switches from differential
rendering to full clear+rewrite when `outputHeight >= stdout.rows`, causing flickering.

This implementation adds a **virtual scroll viewport** to the CategoryGrid component,
limiting the number of visible category rows to what fits within the available terminal
height. It reuses the proven virtual windowing pattern already established in
`skill-search.tsx` and `use-filtered-results.ts`.

### What Gets Built

1. **`useTerminalDimensions` hook** - Reactive terminal size tracking with resize events
2. **`useVirtualScroll` hook** - Category-level virtual windowing with height estimation
3. **Modified `CategoryGrid`** - Scroll-aware rendering with indicators
4. **Modified `StepBuild`** - Passes available height to CategoryGrid
5. **New constants** - Chrome height measurements, scroll indicator text

### What Does NOT Get Built

- No changes to other wizard steps (approach, stack, sources, confirm)
- No changes to the Zustand store (scroll state is local to CategoryGrid)
- No custom scroll bar widget
- No horizontal scrolling

---

## Architecture Decisions

### AD1: Category-Level Windowing (Not Line-Level)

**Decision:** Scroll granularity is at the category (row) level, not the terminal line level.

**Rationale:** The existing `CategoryGrid` renders category sections as discrete units.
Each `CategorySection` has a variable height (category name + wrapped skill tags).
Line-level windowing would require measuring each category's rendered height in
terminal lines, which creates a chicken-and-egg problem with Ink (you can only measure
after render). Category-level windowing avoids this entirely - we estimate how many
categories fit and slice at category boundaries.

**Pattern precedent:** `skill-search.tsx` uses item-level windowing with
`MAX_VISIBLE_RESULTS` (line 139: `results.slice(scrollOffset, scrollOffset + MAX_VISIBLE_RESULTS)`).

### AD2: Height Estimation Over Measurement

**Decision:** Estimate category heights using a formula rather than using Ink's
`measureElement` post-render.

**Rationale:** `measureElement` only works after render, creating a flash of
unstyled/overflow content on first paint. A conservative height estimate per category
(name line + estimated tag rows based on option count and terminal width) provides a
good-enough approximation without the rendering flash. The estimate can be tuned based
on real usage.

**Formula:**
```
categoryHeight = CATEGORY_NAME_LINES + ceil(optionCount * AVG_TAG_WIDTH / terminalWidth) + CATEGORY_MARGIN
```

### AD3: Scroll State Local to CategoryGrid

**Decision:** Keep `scrollOffset` in CategoryGrid's local React state, not in the
Zustand wizard store.

**Rationale:** Scroll position is view-level state, not application state. It resets
when switching domains (CategoryGrid re-mounts via `key={activeDomain}`). The wizard
store tracks selection state that persists across navigation; scroll position should
not be persisted. This follows the existing pattern where `useFocusedListItem` uses
local `useState`.

### AD4: Subscribe to stdout resize for Reactivity

**Decision:** Use `useStdout().stdout.on('resize', ...)` rather than polling.

**Rationale:** Ink's `useStdout` hook provides direct access to the underlying Node.js
stdout stream. The `resize` event fires whenever the terminal dimensions change. This
is more efficient than polling and is the standard Node.js approach. Ink itself uses
this internally for its rendering decisions.

### AD5: Scroll Indicators as Text Elements

**Decision:** Show "N more categories above/below" as dimmed Text elements, not as
ASCII art scrollbar.

**Rationale:** Keeps implementation minimal and consistent with existing UI styling.
The indicators consume 1 line each and provide clear, accessible feedback about
scrollable content. This matches the information-dense but visually clean style of
the existing wizard.

---

## Type Definitions

All new types follow existing conventions: type-only exports, named aliases,
co-located with their consumers.

### New Types in `src/cli/components/hooks/use-terminal-dimensions.ts`

```typescript
/**
 * Reactive terminal dimensions.
 * Updates automatically when the terminal is resized.
 */
export type TerminalDimensions = {
  /** Terminal width in columns */
  columns: number;
  /** Terminal height in rows */
  rows: number;
};
```

### New Types in `src/cli/components/hooks/use-virtual-scroll.ts`

```typescript
/**
 * Input for the virtual scroll hook.
 * Accepts items (categories) and constraints to determine visibility.
 */
export type UseVirtualScrollOptions<T> = {
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

/**
 * Output from the virtual scroll hook.
 * Provides the visible window and scroll position info.
 */
export type UseVirtualScrollResult<T> = {
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
```

### New Constants in `src/cli/consts.ts`

```typescript
export const SCROLL_VIEWPORT = {
  /** Lines consumed by wizard tabs row (border + tabs + border) */
  WIZARD_TABS_HEIGHT: 3,
  /** Lines consumed by marketplace label (when present) */
  MARKETPLACE_LABEL_HEIGHT: 2,
  /** Lines consumed by domain tabs + legend row + view title in StepBuild */
  BUILD_STEP_CHROME_HEIGHT: 4,
  /** Lines consumed by wizard footer (hotkeys row + mode toggles row + footer bar) */
  WIZARD_FOOTER_HEIGHT: 5,
  /** Lines consumed by the outer layout padding (paddingX on WizardLayout) */
  LAYOUT_PADDING_HEIGHT: 2,
  /** Height of the "N more above" scroll indicator */
  SCROLL_INDICATOR_HEIGHT: 1,
  /** Estimated lines per category name row (including top margin) */
  CATEGORY_NAME_LINES: 2,
  /** Estimated average width of a single skill tag in characters (borders + padding + label) */
  AVG_TAG_WIDTH: 22,
  /** Margin between category sections (marginTop on CategorySection) */
  CATEGORY_MARGIN_LINES: 1,
  /** Minimum rows to show at least 1 category before enabling scroll */
  MIN_VIEWPORT_ROWS: 5,
  /** Minimum terminal height to show the wizard at all */
  MIN_TERMINAL_HEIGHT: 15,
} as const;
```

---

## Component Changes

### 1. New Hook: `src/cli/components/hooks/use-terminal-dimensions.ts`

**Purpose:** Reactively track terminal width and height, re-rendering consumers on resize.

**Pattern:** Follows the same structure as existing hooks (`use-filtered-results.ts`,
`use-focused-list-item.ts`) - named export, typed options/result, `useEffect` for
side-effect cleanup.

```typescript
import { useState, useEffect } from "react";
import { useStdout } from "ink";

const DEFAULT_COLUMNS = 80;
const DEFAULT_ROWS = 24;

export type TerminalDimensions = {
  columns: number;
  rows: number;
};

/**
 * Tracks terminal dimensions reactively. Re-renders on resize.
 *
 * Falls back to DEFAULT_COLUMNS x DEFAULT_ROWS when stdout is not a TTY
 * (e.g., piped output, CI environments, tests).
 */
export function useTerminalDimensions(): TerminalDimensions {
  const { stdout } = useStdout();

  const [dimensions, setDimensions] = useState<TerminalDimensions>(() => ({
    columns: stdout.columns || DEFAULT_COLUMNS,
    rows: stdout.rows || DEFAULT_ROWS,
  }));

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        columns: stdout.columns || DEFAULT_COLUMNS,
        rows: stdout.rows || DEFAULT_ROWS,
      });
    };

    stdout.on("resize", handleResize);
    return () => {
      stdout.off("resize", handleResize);
    };
  }, [stdout]);

  return dimensions;
}
```

**Design notes:**
- `useState` initializer function avoids re-reading stdout on every render.
- Cleanup via `stdout.off` prevents memory leaks.
- Default values match common terminal defaults.
- No debouncing - Ink already batches renders, so rapid resize events are coalesced
  by React's batching. If jitter is observed in practice, a `RESIZE_DEBOUNCE_MS`
  constant can be added later (keep it simple initially).

---

### 2. New Hook: `src/cli/components/hooks/use-virtual-scroll.ts`

**Purpose:** Given a list of items, available height, and focused index, compute which
items are visible in the scroll viewport.

**Pattern:** Follows `use-filtered-results.ts` - pure computation with `useMemo`, no
side effects, returns a result object.

```typescript
import { useMemo } from "react";
import { SCROLL_VIEWPORT } from "../../consts.js";

export type UseVirtualScrollOptions<T> = {
  items: T[];
  availableHeight: number;
  focusedIndex: number;
  estimateItemHeight: (item: T, terminalWidth: number) => number;
  terminalWidth: number;
};

export type UseVirtualScrollResult<T> = {
  visibleItems: T[];
  startIndex: number;
  endIndex: number;
  hiddenAbove: number;
  hiddenBelow: number;
  isScrollable: boolean;
};

/**
 * Virtual scroll windowing for variable-height items.
 *
 * Computes a contiguous window of items that fits within `availableHeight`,
 * ensuring the `focusedIndex` item is always visible. When the focused item
 * moves outside the current window, the window shifts to include it.
 *
 * Height is estimated per-item via `estimateItemHeight` rather than measured
 * post-render, avoiding the chicken-and-egg measurement problem with Ink.
 */
export function useVirtualScroll<T>({
  items,
  availableHeight,
  focusedIndex,
  estimateItemHeight,
  terminalWidth,
}: UseVirtualScrollOptions<T>): UseVirtualScrollResult<T> {
  return useMemo(() => {
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

    // Compute cumulative heights
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
  }, [items, availableHeight, focusedIndex, estimateItemHeight, terminalWidth]);
}
```

**Design notes:**
- Pure `useMemo` - no state, no effects. Recomputes whenever inputs change.
- Bidirectional expansion from focused item ensures focus is always visible.
- `MIN_VIEWPORT_ROWS` prevents the viewport from collapsing to zero on tiny terminals.
- The algorithm is O(n) where n is the number of categories (typically 5-15).

---

### 3. Modified: `src/cli/components/wizard/category-grid.tsx`

**Changes:**
- Accept new `availableHeight` and `terminalWidth` props
- Use `useVirtualScroll` to compute visible categories
- Render scroll indicators when content is clipped
- Map between visible indices and original indices for focus tracking

```typescript
// --- New imports ---
import { useVirtualScroll } from "../hooks/use-virtual-scroll.js";
import { SCROLL_VIEWPORT } from "../../consts.js";

// --- New props added to CategoryGridProps ---
export type CategoryGridProps = {
  categories: CategoryRow[];
  showDescriptions: boolean;
  expertMode: boolean;
  onToggle: (categoryId: Subcategory, technologyId: SkillId) => void;
  onToggleDescriptions: () => void;
  defaultFocusedRow?: number;
  defaultFocusedCol?: number;
  onFocusChange?: (row: number, col: number) => void;
  /** Available height in terminal rows for the category list. When undefined, all categories render. */
  availableHeight?: number;
  /** Terminal width in columns, used for tag wrapping estimation. */
  terminalWidth?: number;
};

// --- New height estimation function ---
/**
 * Estimate the rendered height of a category section in terminal rows.
 *
 * Each category consists of:
 * - 1 line for the category name (+ margin-top)
 * - N lines for the skill tags (based on count and terminal width wrapping)
 *
 * Tag wrapping: skill tags use flexWrap="wrap". Each tag is approximately
 * AVG_TAG_WIDTH chars wide. The number of rows is ceil(tags * tagWidth / terminalWidth).
 */
const estimateCategoryHeight = (
  category: { sortedOptions: CategoryOption[] },
  terminalWidth: number,
): number => {
  const { CATEGORY_NAME_LINES, AVG_TAG_WIDTH, CATEGORY_MARGIN_LINES } = SCROLL_VIEWPORT;
  const optionCount = category.sortedOptions.length;
  const tagsPerRow = Math.max(1, Math.floor(terminalWidth / AVG_TAG_WIDTH));
  const tagRows = Math.ceil(optionCount / tagsPerRow);
  return CATEGORY_NAME_LINES + tagRows + CATEGORY_MARGIN_LINES;
};

// --- New scroll indicator component ---
type ScrollIndicatorProps = {
  count: number;
  direction: "above" | "below";
};

const ScrollIndicator: React.FC<ScrollIndicatorProps> = ({ count, direction }) => {
  if (count === 0) return null;

  const arrow = direction === "above" ? "\u25B2" : "\u25BC";
  const label = `${arrow} ${count} more ${count === 1 ? "category" : "categories"} ${direction}`;

  return (
    <Box paddingLeft={1} marginTop={direction === "below" ? 1 : 0}>
      <Text dimColor>{label}</Text>
    </Box>
  );
};

// --- Modified CategoryGrid render ---
export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  showDescriptions,
  expertMode,
  onToggle,
  onToggleDescriptions,
  defaultFocusedRow = 0,
  defaultFocusedCol = 0,
  onFocusChange,
  availableHeight,
  terminalWidth,
}) => {
  const processedCategories = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        sortedOptions: sortOptions(category.options, expertMode),
      })),
    [categories, expertMode],
  );

  // Focus management operates on ALL categories (not just visible ones)
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

  const adjustCol = useCallback(
    (row: number, clampedCol: number): number => {
      const options = processedCategories[row]?.sortedOptions || [];
      if (options[clampedCol]?.state === "disabled") {
        return findValidStartColumn(options);
      }
      return clampedCol;
    },
    [processedCategories],
  );

  const { focusedRow, focusedCol, setFocused, moveFocus } = useFocusedListItem(
    processedCategories.length,
    getColCount,
    {
      wrap: true,
      isRowLocked,
      findValidCol,
      adjustCol,
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
    onToggleDescriptions,
  });

  // Virtual scroll: only compute when height constraints are provided
  const { visibleItems, startIndex, hiddenAbove, hiddenBelow, isScrollable } = useVirtualScroll({
    items: processedCategories,
    availableHeight: availableHeight ?? Infinity,
    focusedIndex: focusedRow,
    estimateItemHeight: estimateCategoryHeight,
    terminalWidth: terminalWidth ?? 80,
  });

  if (categories.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No categories to display.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {isScrollable && <ScrollIndicator count={hiddenAbove} direction="above" />}

      {visibleItems.map((category, visibleIndex) => {
        const originalIndex = startIndex + visibleIndex;
        const isLocked = isSectionLocked(category.id, categories);

        return (
          <CategorySection
            key={category.id}
            category={category}
            options={category.sortedOptions}
            isLocked={isLocked}
            isFocused={originalIndex === focusedRow}
            focusedOptionIndex={focusedCol}
            showDescriptions={showDescriptions}
          />
        );
      })}

      {isScrollable && <ScrollIndicator count={hiddenBelow} direction="below" />}
    </Box>
  );
};
```

**Key design decisions for CategoryGrid:**

1. **Focus management is unchanged.** `useFocusedListItem` still operates on the full
   `processedCategories` array. Focus row/col indices refer to the original array.
   Only the _rendering_ is windowed.

2. **Original indices are preserved.** `startIndex + visibleIndex` maps back to the
   original category index for focus comparison (`originalIndex === focusedRow`).

3. **Backward compatible.** When `availableHeight` is not provided (undefined),
   `useVirtualScroll` receives `Infinity` and returns all items (no scrolling).
   Existing consumers (tests, other steps) continue to work unchanged.

---

### 4. Modified: `src/cli/components/wizard/step-build.tsx`

**Changes:**
- Import and use `useTerminalDimensions`
- Calculate available height for CategoryGrid
- Pass height and width to CategoryGrid

```typescript
// --- New import ---
import { useTerminalDimensions } from "../hooks/use-terminal-dimensions.js";
import { SCROLL_VIEWPORT } from "../../consts.js";

// --- Inside StepBuild component ---
export const StepBuild: React.FC<StepBuildProps> = ({ /* ... existing props ... */ }) => {
  const [validationError, setValidationError] = useState<string | undefined>(undefined);
  const { columns, rows } = useTerminalDimensions();

  const categories = useFrameworkFiltering({
    domain: activeDomain,
    allSelections,
    matrix,
    expertMode,
    selections,
    parentDomainSelections,
    installedSkillIds,
  });

  // Calculate available height for the category grid viewport.
  // Total chrome = wizard tabs + marketplace label + build step chrome + footer + padding
  const chromeHeight =
    SCROLL_VIEWPORT.WIZARD_TABS_HEIGHT +
    SCROLL_VIEWPORT.BUILD_STEP_CHROME_HEIGHT +
    SCROLL_VIEWPORT.WIZARD_FOOTER_HEIGHT +
    SCROLL_VIEWPORT.LAYOUT_PADDING_HEIGHT;

  const availableHeight = Math.max(
    SCROLL_VIEWPORT.MIN_VIEWPORT_ROWS,
    rows - chromeHeight,
  );

  useInput((_input, key) => { /* ... unchanged ... */ });

  return (
    <Box flexDirection="column" width="100%">
      {/* ... domain tabs, legend row, ViewTitle - unchanged ... */}

      <CategoryGrid
        key={activeDomain}
        categories={categories}
        expertMode={expertMode}
        showDescriptions={showDescriptions}
        onToggle={onToggle}
        onToggleDescriptions={onToggleDescriptions}
        availableHeight={availableHeight}
        terminalWidth={columns}
      />

      <Footer validationError={validationError} />
    </Box>
  );
};
```

**Design notes:**
- Chrome height is calculated from named constants, not magic numbers.
- `Math.max(MIN_VIEWPORT_ROWS, ...)` ensures at least some content is visible even
  on extremely small terminals.
- The `columns` value is passed through for tag wrapping estimation.
- The domain tabs, legend, and view title are "chrome" that always renders.

---

### 5. Modified: `src/cli/components/wizard/wizard.tsx` (Optional Enhancement)

**Changes:**
- Add minimum terminal height check alongside the existing width check.

```typescript
// In wizard.tsx, near line 48
const MIN_TERMINAL_WIDTH = 80;
const MIN_TERMINAL_HEIGHT = SCROLL_VIEWPORT.MIN_TERMINAL_HEIGHT;

// In the render, alongside the existing isNarrowTerminal check:
const terminalHeight = stdout.rows || DEFAULT_ROWS;
const isNarrowTerminal = terminalWidth < MIN_TERMINAL_WIDTH;
const isShortTerminal = terminalHeight < MIN_TERMINAL_HEIGHT;

if (isNarrowTerminal || isShortTerminal) {
  const issue = isNarrowTerminal
    ? `too narrow (${terminalWidth} columns, need ${MIN_TERMINAL_WIDTH})`
    : `too short (${terminalHeight} rows, need ${MIN_TERMINAL_HEIGHT})`;

  return (
    <ThemeProvider theme={cliTheme}>
      <Box flexDirection="column" padding={1}>
        <Text color={CLI_COLORS.WARNING}>
          Terminal {issue}. Please resize your terminal.
        </Text>
      </Box>
    </ThemeProvider>
  );
}
```

**Note:** This is a minor quality-of-life enhancement. The scroll viewport handles
small terminals gracefully, but showing a warning when the terminal is too small to
display even one category provides better UX.

---

### 6. `src/cli/stores/wizard-store.ts` - No Changes Needed

Scroll state is view-level, not application state. The scroll offset is computed
reactively from `focusedRow` via `useVirtualScroll`, so no Zustand state is needed.
The store already resets focus when domains change (CategoryGrid re-mounts via `key`).

---

## Implementation Steps

Ordered sequence with estimated effort and dependencies.

### Step 1: Add Constants (5 min)

**File:** `src/cli/consts.ts`
**Action:** Add `SCROLL_VIEWPORT` constant object
**Lines added:** ~20
**Dependencies:** None
**Risk:** Low - additive only

### Step 2: Create `useTerminalDimensions` Hook (15 min)

**File:** `src/cli/components/hooks/use-terminal-dimensions.ts` (new)
**Action:** Create hook with resize event subscription
**Lines:** ~35
**Dependencies:** None
**Risk:** Low - standard React hook pattern

### Step 3: Create `useVirtualScroll` Hook (30 min)

**File:** `src/cli/components/hooks/use-virtual-scroll.ts` (new)
**Action:** Implement virtual windowing with height estimation
**Lines:** ~100
**Dependencies:** Step 1 (constants)
**Risk:** Medium - bidirectional expansion algorithm needs testing

### Step 4: Modify CategoryGrid (45 min)

**File:** `src/cli/components/wizard/category-grid.tsx`
**Action:** Add optional props, integrate `useVirtualScroll`, add scroll indicators
**Lines changed:** ~50 added, ~10 modified
**Dependencies:** Steps 2, 3
**Risk:** Medium - must maintain backward compatibility with existing tests

### Step 5: Modify StepBuild (15 min)

**File:** `src/cli/components/wizard/step-build.tsx`
**Action:** Import hooks, calculate chrome height, pass to CategoryGrid
**Lines changed:** ~15 added
**Dependencies:** Steps 2, 4
**Risk:** Low - additive props only

### Step 6: Optional - Add Terminal Height Check to Wizard (10 min)

**File:** `src/cli/components/wizard/wizard.tsx`
**Action:** Add MIN_TERMINAL_HEIGHT guard
**Lines changed:** ~15 modified
**Dependencies:** Step 1
**Risk:** Low - extends existing pattern

### Step 7: Write Tests (60 min)

**Files:**
- `src/cli/components/hooks/use-terminal-dimensions.test.ts` (new)
- `src/cli/components/hooks/use-virtual-scroll.test.ts` (new)
- Updates to `src/cli/components/wizard/category-grid.test.tsx`
**Dependencies:** Steps 2, 3, 4
**Risk:** Low - follows existing test patterns

### Step 8: Manual Testing and Tuning (30 min)

**Action:** Run wizard in various terminal sizes, tune height estimates
**Dependencies:** All steps complete
**Risk:** Low - iterative tuning

**Total estimated time:** ~3.5 hours

---

## Testing Strategy

### Unit Tests

#### `use-terminal-dimensions.test.ts`

Test the hook in isolation by mocking Ink's `useStdout`.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react-hooks";
// Note: may need Ink wrapper for useStdout

describe("useTerminalDimensions", () => {
  it("should return initial dimensions from stdout", () => {
    // Mock stdout.columns = 120, stdout.rows = 40
    // Verify hook returns { columns: 120, rows: 40 }
  });

  it("should fall back to defaults when stdout has no dimensions", () => {
    // Mock stdout.columns = undefined, stdout.rows = undefined
    // Verify hook returns { columns: 80, rows: 24 }
  });

  it("should update dimensions on resize event", () => {
    // Mock stdout, emit 'resize' event with new dimensions
    // Verify hook returns updated values
  });

  it("should clean up resize listener on unmount", () => {
    // Verify stdout.off is called on cleanup
  });
});
```

#### `use-virtual-scroll.test.ts`

Test the windowing algorithm with various scenarios.

```typescript
import { describe, it, expect } from "vitest";
import { useVirtualScroll } from "./use-virtual-scroll";

// Helper: create items with known heights
const createItem = (height: number) => ({ height });
const heightEstimator = (item: { height: number }) => item.height;

describe("useVirtualScroll", () => {
  describe("no scrolling needed", () => {
    it("should return all items when total height fits", () => {
      // 3 items, height 5 each, available 20
      // All items visible, isScrollable = false
    });

    it("should return empty result for empty items", () => {
      // items = [], any height
      // visibleItems = [], isScrollable = false
    });
  });

  describe("scrolling required", () => {
    it("should window items around focused index", () => {
      // 10 items, height 3 each, available 12
      // Focused at index 5
      // Should show ~3-4 items centered around index 5
    });

    it("should show correct hiddenAbove and hiddenBelow counts", () => {
      // Verify counts match sliced positions
    });

    it("should keep focused item visible when at start", () => {
      // focusedIndex = 0
      // First items should be visible
    });

    it("should keep focused item visible when at end", () => {
      // focusedIndex = last
      // Last items should be visible
    });

    it("should handle focused index at boundary", () => {
      // focusedIndex right at viewport edge
      // Should scroll to include it
    });
  });

  describe("variable heights", () => {
    it("should handle items with different heights", () => {
      // Items with heights [2, 5, 3, 8, 2], available 10
      // Verify correct windowing
    });

    it("should handle very tall single item", () => {
      // One item taller than viewport
      // Should still show it (even if it overflows)
    });
  });

  describe("edge cases", () => {
    it("should handle availableHeight of 0", () => {
      // Degenerate case - should show at least MIN_VIEWPORT_ROWS worth
    });

    it("should handle single item", () => {
      // 1 item, any height
      // Should always be visible
    });

    it("should clamp focused index to valid range", () => {
      // focusedIndex = 100, items.length = 5
      // Should not crash, treat as last item
    });
  });
});
```

#### Updates to `category-grid.test.tsx`

Add tests for the scroll viewport integration.

```typescript
describe("scroll viewport", () => {
  it("should render all categories when no height constraint", () => {
    // Default (no availableHeight) - all categories visible
    const { lastFrame, unmount } = renderGrid();
    cleanup = unmount;
    expect(lastFrame()).toContain("Framework");
    expect(lastFrame()).toContain("Analytics");
  });

  it("should render scroll indicators when height is constrained", () => {
    // Small availableHeight, many categories
    const { lastFrame, unmount } = renderGrid({
      categories: categoriesWithFramework,
      availableHeight: 8,
      terminalWidth: 120,
    });
    cleanup = unmount;
    const output = lastFrame();
    // Should show "N more categories below"
    expect(output).toContain("more categories below");
  });

  it("should not render scroll indicators when all content fits", () => {
    const { lastFrame, unmount } = renderGrid({
      categories: [createCategory("forms", "Forms", [createOption("web-test-a", "A")])],
      availableHeight: 100,
      terminalWidth: 120,
    });
    cleanup = unmount;
    expect(lastFrame()).not.toContain("more categories");
  });

  it("should keep focused category visible when scrolling down", async () => {
    const onFocusChange = vi.fn();
    const { stdin, lastFrame, unmount } = renderGrid({
      categories: categoriesWithFramework,
      availableHeight: 6,
      terminalWidth: 120,
      defaultFocusedRow: 0,
      onFocusChange,
    });
    cleanup = unmount;

    await delay(RENDER_DELAY_MS);
    // Navigate down past viewport
    await stdin.write(ARROW_DOWN);
    await delay(INPUT_DELAY_MS);
    await stdin.write(ARROW_DOWN);
    await delay(INPUT_DELAY_MS);

    // Focused category should still be in output
    expect(lastFrame()).toContain("Client State");
  });
});
```

### Integration Tests

Manual integration testing is recommended for the viewport system because:

1. Ink's test renderer (`ink-testing-library`) does not simulate terminal dimensions
   accurately - `stdout.columns` and `stdout.rows` are typically undefined in test.
2. The visual correctness of scroll indicators requires visual inspection.
3. Resize behavior requires dynamic terminal manipulation.

**Manual test matrix:**

| Terminal Size | Expected Behavior |
|---|---|
| 120x40 (normal) | All categories visible, no scroll indicators |
| 120x24 (standard) | Top categories visible, "N more below" indicator |
| 120x15 (minimal) | 1-2 categories visible, both indicators when navigating |
| 120x12 (tiny) | "Terminal too short" warning |
| Resize 40->24 | Live recalculation, scroll indicators appear |
| Resize 24->40 | Scroll indicators disappear, all categories shown |
| 80x24 (narrow) | Tag wrapping changes, fewer tags per row, more scroll |

---

## Edge Cases

### E1: Terminal Too Small to Show Any Categories

**Scenario:** `stdout.rows < MIN_TERMINAL_HEIGHT` (e.g., 10 rows)
**Handling:** Wizard shows "Terminal too short" warning message (Step 6).
**Fallback:** If Step 6 is deferred, `MIN_VIEWPORT_ROWS` ensures at least some content
renders, even if it overflows.

### E2: Rapid Terminal Resize

**Scenario:** User drags terminal edge quickly, firing many resize events.
**Handling:** React batches state updates from rapid `setDimensions` calls. Ink
coalesces renders. No debouncing needed initially. If jitter is observed, add
`setTimeout`-based debounce (50ms) to `useTerminalDimensions`.

### E3: Empty Categories (No Skills)

**Scenario:** Domain has zero categories (e.g., no skills matched after filtering).
**Handling:** CategoryGrid already handles this case (renders "No categories to
display"). `useVirtualScroll` returns empty result for empty input. No change needed.

### E4: Single Very Tall Category

**Scenario:** One category has 20+ skills that wrap into many rows, exceeding viewport.
**Handling:** The category is shown even if it overflows. Virtual scroll operates at
category boundaries, not line boundaries. The individual category section may extend
beyond the viewport height, but this is acceptable - the user can still navigate and
Ink handles the overflow via its existing rewrite behavior.

**Future improvement:** Could collapse non-focused categories to header-only to save
space (the "alternative" mentioned in `ux-2.0-scroll-viewport.md`). Not in scope.

### E5: Domain Switch Resets Scroll

**Scenario:** User scrolls down in "web" domain, then switches to "api" domain.
**Handling:** CategoryGrid already re-mounts on domain switch (`key={activeDomain}`).
This naturally resets all local state including scroll position. Focus resets to row 0
via `defaultFocusedRow`. `useVirtualScroll` starts fresh.

### E6: Descriptions Toggle Changes Heights

**Scenario:** User presses `d` to toggle descriptions, changing category heights.
**Handling:** `showDescriptions` is in the props. When it changes, `processedCategories`
re-renders and `useVirtualScroll` recomputes with potentially different height estimates.
The height estimation function should account for descriptions when enabled.

**Implementation detail:** When `showDescriptions` is true, add extra height per option
that has a `stateReason`. This can be an additional parameter to the estimator or
factored into the category processing:

```typescript
const estimateCategoryHeight = (
  category: ProcessedCategory,
  terminalWidth: number,
  showDescriptions: boolean,
): number => {
  const { CATEGORY_NAME_LINES, AVG_TAG_WIDTH, CATEGORY_MARGIN_LINES } = SCROLL_VIEWPORT;
  const optionCount = category.sortedOptions.length;
  const tagsPerRow = Math.max(1, Math.floor(terminalWidth / AVG_TAG_WIDTH));
  const tagRows = Math.ceil(optionCount / tagsPerRow);
  const descriptionRows = showDescriptions
    ? category.sortedOptions.filter((o) => o.stateReason).length
    : 0;
  return CATEGORY_NAME_LINES + tagRows + descriptionRows + CATEGORY_MARGIN_LINES;
};
```

### E7: All Categories Locked Except Framework

**Scenario:** No framework selected, all non-framework categories are locked.
**Handling:** Locked categories are still rendered (they show dimmed). The virtual
scroll includes them in height calculations. Navigation skips locked rows via
existing `isRowLocked` logic. No special scroll handling needed.

### E8: Expert Mode Changes Option Order

**Scenario:** Toggling expert mode reorders options within categories, potentially
changing heights.
**Handling:** `processedCategories` recalculates via `useMemo`. `useVirtualScroll`
recomputes since `items` dependency changed. Heights re-estimated with new order
(different option counts per row due to disabled option positioning). No special
handling needed.

### E9: Non-TTY Environments (CI, Piped Output)

**Scenario:** `stdout.columns` and `stdout.rows` are undefined.
**Handling:** `useTerminalDimensions` falls back to `DEFAULT_COLUMNS` (80) and
`DEFAULT_ROWS` (24). The viewport calculates based on these defaults. This matches
the existing pattern in `wizard.tsx` (line 65: `stdout.columns || MIN_TERMINAL_WIDTH`).

---

## Success Criteria

### SC1: No Content Overflow

The wizard's Build step never causes Ink to switch to full clear+rewrite mode. The
rendered content height stays within `stdout.rows` at all times.

**Verification:** Run wizard in a 24-row terminal with a domain that has 10+ categories.
Observe no flickering and no content pushed above the visible area.

### SC2: Scroll Indicators Show When Needed

When categories overflow the viewport, "N more categories above" and "N more categories
below" indicators appear with accurate counts.

**Verification:** Navigate through categories in a constrained terminal. Verify counts
update as focus moves.

### SC3: Focus Drives Scrolling

When the user navigates (arrow keys or j/k) to a category outside the visible window,
the viewport scrolls to include it. The focused category is always visible.

**Verification:** Start at first category, press down repeatedly. When reaching a
category below the viewport, the view should scroll down. Same for scrolling up.

### SC4: Resize Updates Viewport

When the terminal is resized, the viewport recalculates immediately. Growing the
terminal shows more categories; shrinking shows fewer with scroll indicators.

**Verification:** Start wizard, resize terminal from 40 to 20 rows. Scroll indicators
should appear. Resize back to 40 rows. Indicators should disappear.

### SC5: Backward Compatibility

All existing CategoryGrid tests pass without modification (when `availableHeight` is
not provided).

**Verification:** Run `vitest run src/cli/components/wizard/category-grid.test.tsx`.
All tests pass.

### SC6: Domain Switching Resets Scroll

Switching domains (Tab key) resets the scroll position to the top.

**Verification:** Scroll down in "web" domain, switch to "api". CategoryGrid should
show the first categories.

### SC7: No Zustand Store Changes

The wizard store remains unchanged. Scroll position is ephemeral view state.

**Verification:** `git diff src/cli/stores/wizard-store.ts` shows no changes.

---

## File Inventory

| File | Action | Lines Est. |
|---|---|---|
| `src/cli/consts.ts` | Modified | +20 |
| `src/cli/components/hooks/use-terminal-dimensions.ts` | New | ~35 |
| `src/cli/components/hooks/use-virtual-scroll.ts` | New | ~100 |
| `src/cli/components/wizard/category-grid.tsx` | Modified | +60 |
| `src/cli/components/wizard/step-build.tsx` | Modified | +15 |
| `src/cli/components/wizard/wizard.tsx` | Modified (optional) | +15 |
| `src/cli/components/hooks/use-terminal-dimensions.test.ts` | New | ~40 |
| `src/cli/components/hooks/use-virtual-scroll.test.ts` | New | ~120 |
| `src/cli/components/wizard/category-grid.test.tsx` | Modified | +40 |

**Total new/modified lines:** ~445
**New files:** 4 (2 hooks + 2 test files)
**Modified files:** 3-4

---

## References

- `src/cli/components/skill-search/skill-search.tsx` - Existing virtual windowing
- `src/cli/components/hooks/use-filtered-results.ts` - Scroll offset tracking pattern
- `src/cli/components/hooks/use-focused-list-item.ts` - 2D grid focus management
- `docs/ux-2.0-scroll-viewport.md` - Problem statement and UX design
- `docs/architecture.md` - Type system and coding conventions
