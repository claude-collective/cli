# D-59: Unified Scrolling Across All Wizard Views

**Status:** Refinement complete
**Priority:** High (wizard UX)
**Complexity:** Medium

## Implementation Overview

Extract a shared `useSectionScroll` hook (pixel-offset scroll) and `computeRowScrollTop` helper (row-based scroll) from the duplicated code in `category-grid.tsx`, `source-grid.tsx`, and `step-agents.tsx`. Then apply scrolling to 3 new views: `stack-selection.tsx` (pixel-offset, for variable-height `SelectionCard` items), `checkbox-grid.tsx` (row-based, for domain selection items), and `step-settings.tsx` (row-based, for source list only). Phase 1 refactors existing views with zero behavior change. Phases 2-4 add scrolling to new targets. Each view keeps control over what scrolls (sub-region vs whole view).

---

## Resolved Questions

### 1. Should we extract a shared scroll hook?

**Yes.** Extract a shared `useSectionScroll` hook that encapsulates the existing `useMeasuredHeight` + `sectionRefs` + `scrollTopPx` pattern. Use it in all views that need scrolling -- both existing (category-grid, source-grid, step-agents) and new targets (stack-selection, checkbox-grid, step-settings).

### 2. Can scrolling be handled at the root level (WizardLayout)?

**Investigated, not feasible.** WizardLayout renders a `<Box flexDirection="column" flexGrow={1} flexBasis={0}>` wrapper around `{children}` (line 117), which fills the remaining vertical space. However, root-level scrolling cannot work because:

- Different views have different fixed headers/footers *within* their content area (e.g., domain tabs in step-build, source choice header in step-sources, title + continue footer in checkbox-grid).
- Some views use pixel-offset scroll (variable-height sections), others use row-based scroll (uniform-height rows).
- Some views scroll only a sub-region (step-settings scrolls only the source list, not the add input or keyboard hints).
- Some views don't scroll at all (step-confirm).

The WizardLayout already provides the height constraint (`height={terminalHeight}` on the root Box). Each view's `useMeasuredHeight` already leverages this to compute available space. The right approach is a **shared hook** that each scrollable view opts into, not root-level overflow handling.

### 3. Should we use `use-virtual-scroll.ts` instead?

**No.** Stick with the existing `useMeasuredHeight` + `marginTop` pixel-offset pattern. The virtual scroll hook is a fundamentally different approach (estimates heights, slices item arrays). The marginTop approach is proven in 3 views, keeps all items in the DOM, and measures actual rendered heights. No reason to switch.

### 4. Should scroll indicators be added?

**No.** No scroll indicators. The existing 3 implementations don't render them, and none will be added. Scrolling is implicit -- users discover content by navigating up/down.

---

## Current State Analysis

### 3 Existing Scrolling Implementations

#### 1. `category-grid.tsx` (lines 166-384) -- pixel-offset scroll

**Used by:** `step-build.tsx` (skill selection per domain)

**How it works:**
- Receives `availableHeight` as a prop (measured by parent `step-build.tsx` via `useMeasuredHeight`)
- Stores refs to each `CategorySection` via `sectionRefs`
- Measures each section height on every render via `measureElement()` into `sectionHeights[]`
- Tracks `scrollTopPx` state, adjusted when `focusedRow` changes
- Scroll logic: if top of focused section is above viewport, scroll up to it. If bottom of focused section is below viewport, scroll down.
- Renders: `<Box height={availableHeight} overflow="hidden"><Box marginTop={-scrollTopPx}>{sections}</Box></Box>`
- Gate: `scrollEnabled = availableHeight > 0 && availableHeight >= SCROLL_VIEWPORT.MIN_VIEWPORT_ROWS`
- When not scroll-enabled: renders flat `<Box flexGrow={1} overflow="hidden">{sections}</Box>`

**Key detail:** Scroll offset is in **pixels** (Yoga layout units), because sections have variable height depending on how many skill tags wrap.

#### 2. `source-grid.tsx` (lines 166-311) -- pixel-offset scroll (identical pattern)

**Used by:** `step-sources.tsx` (customize skill sources view)

**How it works:** Exact same pattern as `category-grid.tsx`:
- `sectionRefs`, `sectionHeights[]`, `scrollTopPx` state
- Same `measureElement()` on every render
- Same scroll adjustment logic (identical code)
- Same gate condition
- Same render structure with `<Box height={availableHeight} overflow="hidden"><Box marginTop={-scrollTopPx}>...</Box></Box>`

**Key detail:** Also pixel-based because `SourceSection` rows have variable height (source tags can wrap).

#### 3. `step-agents.tsx` (lines 176-192) -- row-based scroll

**Used by:** wizard's agents step directly

**How it works:**
- Uses `useMeasuredHeight()` internally (not passed as prop)
- Tracks `scrollTopRef` (ref, not state) for row-based offset
- Each `flatRows` item is assumed to be exactly 1 terminal line
- Scroll logic: if focused row index is above `scrollTopRef`, move top to it. If focused row index + 1 exceeds `scrollTopRef + listHeight`, scroll down.
- Renders: `<Box ref={listRef} flexGrow={1} flexBasis={0}><Box overflow="hidden" flexGrow={1}><Box marginTop={-scrollTopRef.current}>...</Box></Box></Box>`
- Gate: `scrollEnabled = listHeight > 0 && listHeight >= SCROLL_VIEWPORT.MIN_VIEWPORT_ROWS`
- When not scroll-enabled: render flat with overflow="hidden"

**Key difference from category-grid/source-grid:** Uses row indices (1 row = 1 line) instead of pixel offsets. Uses a `ref` instead of state for `scrollTop` (avoids re-render, relies on parent re-render from focus state change).

---

## Pattern Comparison

| Aspect | category-grid | source-grid | step-agents |
|--------|---------------|-------------|-------------|
| Scroll unit | Pixels (Yoga) | Pixels (Yoga) | Rows (1 line each) |
| Height source | `availableHeight` prop | `availableHeight` prop | `useMeasuredHeight()` internal |
| Scroll state | `useState` (`scrollTopPx`) | `useState` (`scrollTopPx`) | `useRef` (`scrollTopRef`) |
| Section measurement | Per-section `measureElement` | Per-section `measureElement` | None (assumes 1 line/row) |
| Section refs | `sectionRefs.current[]` | `sectionRefs.current[]` | None |
| Focus tracking | `focusedRow` index | `focusedRow` index | `focusedId` -> `flatRows.findIndex()` |
| Gate condition | Same | Same | Same |
| Render structure | `<Box height><Box marginTop>` | `<Box height><Box marginTop>` | `<Box ref flexGrow><Box overflow><Box marginTop>` |
| Items in DOM | All | All | All |

### Commonalities (shared across all 3)

1. Gate: `scrollEnabled = height > 0 && height >= SCROLL_VIEWPORT.MIN_VIEWPORT_ROWS`
2. Container: `overflow="hidden"` with negative `marginTop` to hide content above
3. All items remain rendered in the DOM (no virtualization)
4. Focused item is always kept visible
5. "Ensure focused visible" algorithm: if above viewport scroll up, if below viewport scroll down

### Differences

1. **Pixel vs row offset**: category-grid and source-grid measure actual pixel heights; step-agents assumes uniform 1-line rows.
2. **State vs ref**: category-grid and source-grid use `useState` for scroll position; step-agents uses `useRef`.
3. **Height measurement**: category-grid and source-grid measure their own sections; step-agents has no section measurement.
4. **Height ownership**: category-grid and source-grid receive `availableHeight` as a prop from parent; step-agents measures its own height.

---

## Design: Shared `useSectionScroll` Hook

### Why a shared hook instead of root-level scrolling

Root-level scrolling in WizardLayout was investigated and is not feasible (see Resolved Question 2 above). The shared hook approach is the right solution because:

- It eliminates ~40 lines of duplicated code currently copy-pasted between category-grid and source-grid
- It gives each view control over what scrolls (the whole view, or just a sub-region)
- It uses the exact existing pattern -- `useMeasuredHeight` + `sectionRefs` + `measureElement` + `marginTop` pixel offset -- no new approach

### Hook API

```typescript
// src/cli/components/hooks/use-section-scroll.ts

type UseSectionScrollOptions = {
  sectionCount: number;
  focusedIndex: number;
  availableHeight: number;
};

type UseSectionScrollResult = {
  setSectionRef: (index: number, el: DOMElement | null) => void;
  scrollEnabled: boolean;
  scrollTopPx: number;
};

function useSectionScroll(options: UseSectionScrollOptions): UseSectionScrollResult;
```

### What the hook encapsulates

Extracted directly from the identical code in `category-grid.tsx` (lines 278-339) and `source-grid.tsx` (lines 166-211):

1. `sectionRefs` -- `useRef<(DOMElement | null)[]>([])`
2. `sectionHeights` -- `useState<number[]>([])`
3. `scrollTopPx` -- `useState(0)`
4. `setSectionRef` callback -- sets `sectionRefs.current[index]`
5. Height measurement effect -- runs every render, calls `measureElement()` on each ref, updates `sectionHeights` with equality check
6. Gate condition -- `scrollEnabled = availableHeight > 0 && availableHeight >= SCROLL_VIEWPORT.MIN_VIEWPORT_ROWS`
7. Scroll adjustment effect -- computes `topOfFocused` / `bottomOfFocused` from `sectionHeights`, adjusts `scrollTopPx` to keep focused section visible

### Row-based scroll helper

For views with uniform 1-line rows (step-agents, checkbox-grid, step-settings), the scroll logic is ~10 lines and uses a different mechanism (ref instead of state, row indices instead of pixel offsets). Rather than forcing these into the pixel-offset hook, extract a pure function:

```typescript
// Also in use-section-scroll.ts

function computeRowScrollTop(
  focusedRow: number,
  currentScrollTop: number,
  viewportHeight: number,
): number;
```

This replaces the inline scroll math in step-agents and will be used by checkbox-grid and step-settings.

### Consumers after refactor

| View | Uses | Currently |
|------|------|-----------|
| `category-grid.tsx` | `useSectionScroll` | Inline pixel-offset (refactor) |
| `source-grid.tsx` | `useSectionScroll` | Inline pixel-offset (refactor) |
| `stack-selection.tsx` | `useSectionScroll` | No scroll (new) |
| `step-agents.tsx` | `computeRowScrollTop` | Inline row-based (refactor) |
| `checkbox-grid.tsx` | `computeRowScrollTop` | No scroll (new) |
| `step-settings.tsx` | `computeRowScrollTop` | No scroll (new) |

---

## Scroll Implementation for Each Target View

### Target 1: `stack-selection.tsx` (highest priority)

**Current state:** No scroll. Renders `SelectionCard` components (bordered boxes with padding) in a flat column. Each card is ~5-6 lines tall. With 4+ custom stacks, this can easily overflow.

**Layout structure:**
```
<Box flexDirection="column">
  <ViewTitle>Choose a stack</ViewTitle>
  <Box flexDirection="column">
    {stacks.map(stack => <SelectionCard .../>)}
    <SelectionCard label="Start from scratch" .../>
  </Box>
</Box>
```

**Recommended approach:** Pixel-offset scroll via `useSectionScroll` hook, because `SelectionCard` items have variable height (bordered boxes with padding, descriptions of varying length).

**Implementation plan:**
1. `stack-selection.tsx` accepts `availableHeight` as a prop.
2. Calls `useSectionScroll({ sectionCount, focusedIndex, availableHeight })`.
3. Wraps each `SelectionCard` in `<Box ref={(el) => setSectionRef(index, el)} flexShrink={0}>`.
4. Renders scroll container: `<Box height={availableHeight} overflow="hidden"><Box marginTop={-scrollTopPx}>...</Box></Box>`.
5. When `!scrollEnabled`, renders flat with `<Box flexGrow={1} overflow="hidden">`.

**Changes required:**
- `step-stack.tsx`: Add `useMeasuredHeight()`, pass `availableHeight` to both `StackSelection` and `DomainSelection`. Restructure JSX to introduce a measured container `<Box ref={ref} flexGrow={1} flexBasis={0}>` wrapping the children.
- `stack-selection.tsx`: Accept `availableHeight` prop. Use `useSectionScroll` hook. Add scroll container render.
- `selection-card.tsx`: No changes needed.

### Target 2: `checkbox-grid.tsx` (used by `DomainSelection`)

**Current state:** No scroll. Renders a flat list of checkbox items + a continue option. Each item is exactly 1 line.

**Layout structure:**
```
<Box flexDirection="column">
  <ViewTitle>{title}</ViewTitle>
  {subtitle && <Text>...</Text>}
  {items.map(item => <Text>...</Text>)}
  <Text>{continue option}</Text>
  {selection summary}
</Box>
```

**Recommended approach:** Row-based scroll via `computeRowScrollTop`, because each item is a single line.

**Implementation plan:**
1. Accept `availableHeight` as a prop (measured by parent `DomainSelection` -> `step-stack.tsx`).
2. The items (excluding title, subtitle, continue, and summary) are the scrollable region.
3. Track `scrollTop` using `computeRowScrollTop` based on `focusedIndex`.
4. Only scroll the items list, keeping title/subtitle and continue/summary outside the scroll container.

**Key consideration:** The title/subtitle and continue/summary must remain visible (outside the scroll region). Only the checkbox items scroll. This means the scroll container wraps only the items, not the full component.

**Changes required:**
- `checkbox-grid.tsx`: Accept `availableHeight` prop. Split render into header (title+subtitle), scrollable body (items), and footer (continue + summary). Use `computeRowScrollTop` for scroll logic.
- `domain-selection.tsx`: Pass `availableHeight` from parent.
- `step-stack.tsx`: Pass `availableHeight` to `DomainSelection` which passes it to `CheckboxGrid`.

### Target 3: `step-settings.tsx` (lowest priority)

**Current state:** No scroll. Renders a bordered list of sources, an "Add source" input, status messages, local skill counts, and keyboard hints.

**Layout structure:**
```
<Box flexDirection="column" paddingX={2}>
  <ViewTitle>Skill Sources</ViewTitle>
  <Text bold>Configured marketplaces:</Text>
  <Box borderStyle="round"> {/* source list */}
    {sources.map(source => <Box>...</Box>)}
  </Box>
  <Box borderStyle="round"> {/* add source input */} </Box>
  {statusMessage}
  <Box> {/* local skills/plugins counts */} </Box>
  <Box> {/* keyboard hints */} </Box>
</Box>
```

**Recommended approach:** Scroll only the source list (Option A). The bordered `<Box>` containing sources gets a height constraint and scrolls internally using `computeRowScrollTop`. The rest of the UI stays outside. Source list items are 1 line each, so row-based scroll works.

**Implementation plan:**
1. `step-settings.tsx` uses `useMeasuredHeight()` on the source list area (wrap in a `flexGrow={1}` Box).
2. Use `computeRowScrollTop` for `focusedIndex` within the source list.
3. Wrap the source list items in a scroll container with `overflow="hidden"` and negative `marginTop`.

**Changes required:**
- `step-settings.tsx`: Add `useMeasuredHeight()` on the source list container. Use `computeRowScrollTop`. Wrap source items in scroll container.

---

## Step-by-Step Implementation Plan

### Phase 1: Extract shared hook + refactor existing views

1. **Create `src/cli/components/hooks/use-section-scroll.ts`**: Extract the pixel-offset scroll pattern from category-grid/source-grid into `useSectionScroll` hook. Export `computeRowScrollTop` pure function from the same file.

2. **Refactor `category-grid.tsx`**: Replace inline scroll plumbing (~40 lines) with `useSectionScroll` call. No behavior change.

3. **Refactor `source-grid.tsx`**: Same as above.

4. **Refactor `step-agents.tsx`**: Replace inline row-based scroll math with `computeRowScrollTop`. No behavior change.

5. **Test**: All existing tests must pass with zero behavior change.

### Phase 2: `step-stack.tsx` + `stack-selection.tsx` (highest priority)

1. **`step-stack.tsx`**: Add `useMeasuredHeight()`. Wrap children in a `<Box ref={ref} flexGrow={1} flexBasis={0}>` to measure available height. Pass `availableHeight` to both `StackSelection` and `DomainSelection`.

2. **`stack-selection.tsx`**: Accept `availableHeight` prop. Use `useSectionScroll` hook. Wrap each `SelectionCard` in a measured `<Box ref>`. Add conditional scroll/flat render.

3. **Test:** Verify with a matrix that has 6+ stacks. Verify focus navigation scrolls correctly.

### Phase 3: `checkbox-grid.tsx` (medium priority)

1. **`checkbox-grid.tsx`**: Accept optional `availableHeight` prop. Split the component render into:
   - Header: `<ViewTitle>` + subtitle (always visible)
   - Scrollable body: checkbox items only
   - Footer: continue option + selection summary (always visible)

2. Use `computeRowScrollTop` for scroll logic. Gate on `availableHeight`.

3. **`domain-selection.tsx`**: Pass `availableHeight` through to `CheckboxGrid`.

4. **Test:** Verify with a matrix that has 8+ domains.

### Phase 4: `step-settings.tsx` (lower priority)

1. **`step-settings.tsx`**: Add `useMeasuredHeight()` on the source list area. Restructure to isolate the scrollable source list from the fixed header/footer elements.

2. Use `computeRowScrollTop` for `focusedIndex` within the source list.

3. **Test:** Verify with 10+ configured sources.

---

## Edge Cases

### Terminal resize during scroll

**Already handled.** `useMeasuredHeight()` listens for `stdout.on("resize")` and re-measures. The `scrollTopPx` adjustment effect runs on every `availableHeight` change, so the scroll position auto-corrects.

For the `useSectionScroll` hook, the `measureElement` effect runs on every render, which means section heights are re-measured after resize. The scroll adjustment effect depends on `availableHeight`, which also changes on resize.

### Empty content

- **stack-selection**: Always has at least 1 item (the "Start from scratch" option). No empty state needed.
- **checkbox-grid**: Could theoretically have 0 items, but `DomainSelection` always derives domains from the matrix. If somehow 0 domains, no scroll needed.
- **step-settings**: Always has at least the default public source. Empty state is "Loading..." which is rendered before the scroll container.

### Single item (no overflow)

When content fits within `availableHeight`, `scrollEnabled` is false and the flat (non-scroll) render path is used. This is already handled by the gate condition.

### `availableHeight = 0` (before first measurement)

`useMeasuredHeight()` returns 0 before the first layout pass. The gate condition `availableHeight > 0` prevents scroll from being enabled. Content renders flat, which is correct for the first frame. On the next frame, measurement completes and scroll activates if needed.

### Focus on "continue" or "add" items outside the scroll region

- **stack-selection**: The "Start from scratch" card is part of the scrollable list (it's just another card), so no special handling needed.
- **checkbox-grid**: The continue option is outside the scrollable region. When `focusedIndex === items.length` (continue), the scroll position should remain at the bottom, showing the last few items. This needs explicit handling: when focus moves to continue, scroll to show the bottom of the items list.
- **step-settings**: The "Add source" input is outside the scrollable source list. When the add modal is open, scroll position is irrelevant (modal overlays). No special handling needed.

### Selection cards with very long descriptions

`SelectionCard` renders bordered boxes. If a description wraps to multiple lines, the pixel-offset measurement via `measureElement` handles this correctly (it measures actual rendered height). No special handling needed.

---

## Test Plan

### Unit tests for the shared hook

Write unit tests for `useSectionScroll` similar to `use-virtual-scroll.test.ts`:
- Section fully visible -> scrollTopPx = 0
- Focus moves below viewport -> scrollTopPx adjusts to show focused section
- Focus moves above viewport -> scrollTopPx adjusts to show focused section
- `availableHeight = 0` -> scrollEnabled = false
- `availableHeight < MIN_VIEWPORT_ROWS` -> scrollEnabled = false

Write unit tests for `computeRowScrollTop`:
- Focused row within viewport -> no change
- Focused row below viewport -> scroll down
- Focused row above viewport -> scroll up

### Component tests for new scroll targets

- Render `StackSelection` with many stacks and a small `availableHeight` -- verify scrolling
- Render `CheckboxGrid` with many items and a small `availableHeight` -- verify scrolling
- Render step-settings with many sources -- verify source list scrolling

### Integration tests (manual verification)

1. **step-stack (StackSelection):**
   - Create a test matrix with 8+ stacks
   - Verify initial render shows first stacks
   - Arrow down to scroll through all stacks
   - Arrow up to scroll back to top
   - Verify "Start from scratch" is reachable
   - Resize terminal while scrolled -- verify layout adjusts

2. **checkbox-grid (DomainSelection):**
   - Create a test matrix with 10+ domains
   - Verify initial render shows first domains
   - Navigate through all domains
   - Verify continue option is always visible
   - Verify selection summary is always visible

3. **step-settings:**
   - Configure 10+ marketplace sources
   - Verify source list scrolls
   - Verify add input and keyboard hints remain visible
   - Verify delete of a scrolled source adjusts focus correctly

### Existing test compatibility

All existing tests for `category-grid.tsx`, `source-grid.tsx`, and `step-agents.tsx` must continue to pass. Phase 1 (refactoring existing views to use the shared hook) must produce zero behavior change.

For new target components, `availableHeight` defaults to 0 (or undefined -> 0), so existing tests that don't provide it will see no behavior change.

---

## Files Changed Summary

### Phase 1: Shared Hook + Refactor Existing Views

| File | Action | Description |
|------|--------|-------------|
| `src/cli/components/hooks/use-section-scroll.ts` | Create | Shared `useSectionScroll` hook + `computeRowScrollTop` pure function |
| `src/cli/components/hooks/use-section-scroll.test.ts` | Create | Unit tests for hook and helper function |
| `src/cli/components/wizard/category-grid.tsx` | Modify | Replace ~40 lines of inline scroll plumbing with `useSectionScroll` |
| `src/cli/components/wizard/source-grid.tsx` | Modify | Replace ~40 lines of inline scroll plumbing with `useSectionScroll` |
| `src/cli/components/wizard/step-agents.tsx` | Modify | Replace inline row-based scroll math with `computeRowScrollTop` |

### Phase 2: Stack Selection Scrolling

| File | Action | Description |
|------|--------|-------------|
| `src/cli/components/wizard/step-stack.tsx` | Modify | Add `useMeasuredHeight()`, pass `availableHeight` to children, add flex layout |
| `src/cli/components/wizard/stack-selection.tsx` | Modify | Add `availableHeight` prop, use `useSectionScroll` hook, add scroll container |

### Phase 3: Checkbox Grid Scrolling

| File | Action | Description |
|------|--------|-------------|
| `src/cli/components/wizard/checkbox-grid.tsx` | Modify | Add optional `availableHeight` prop, split into header/body/footer, use `computeRowScrollTop` |
| `src/cli/components/wizard/domain-selection.tsx` | Modify | Pass `availableHeight` through to `CheckboxGrid` |

### Phase 4: Settings Scrolling

| File | Action | Description |
|------|--------|-------------|
| `src/cli/components/wizard/step-settings.tsx` | Modify | Add `useMeasuredHeight()` on source list area, use `computeRowScrollTop` for source list |

### Tests

| File | Action | Description |
|------|--------|-------------|
| `src/cli/components/hooks/use-section-scroll.test.ts` | Create (Phase 1) | Unit tests for `useSectionScroll` and `computeRowScrollTop` |
| `src/cli/components/wizard/stack-selection.test.tsx` | Create or modify (Phase 2) | Tests for scroll behavior with many stacks |
| `src/cli/components/wizard/checkbox-grid.test.tsx` | Create or modify (Phase 3) | Tests for scroll behavior with many items |
