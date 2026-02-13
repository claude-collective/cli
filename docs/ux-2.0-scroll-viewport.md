# UX 2.0: Scroll & Viewport for Wizard Steps

## Problem

The build step renders all category sections at once. When the terminal is shorter than the content, Ink pushes everything upward and the user has to manually scroll their terminal to see the top. This is disorienting — the header, tabs, and top categories disappear off-screen.

Ink switches from differential rendering to full clear+rewrite when `outputHeight >= stdout.rows`, which also causes flickering.

## Ink's Constraints

| Capability                  | Status                                      |
| --------------------------- | ------------------------------------------- |
| `overflow: "scroll"`        | Does not exist                              |
| `maxHeight` on Box          | Not exposed (Yoga supports it, Ink doesn't) |
| `overflow: "hidden"` on Box | Clips content, no scroll                    |
| `height={N}` on Box         | Fixed height in lines                       |
| `<Static>`                  | Append-only log, not a pinned header        |
| Native scrollbar            | Does not exist                              |
| Scroll events               | Do not exist                                |

**Bottom line:** Ink is a layout engine, not a viewport engine. All scrolling must be implemented at the data level.

## Proven Pattern: Virtual Windowing

This codebase already uses virtual windowing in `skill-search.tsx`:

```typescript
const MAX_VISIBLE_RESULTS = 10;
const [scrollOffset, setScrollOffset] = useState(0);

// on navigation
if (newIndex < scrollOffset) setScrollOffset(newIndex);
if (newIndex >= scrollOffset + MAX_VISIBLE_RESULTS) {
  setScrollOffset(newIndex - MAX_VISIBLE_RESULTS + 1);
}

// render only the visible window
results.slice(scrollOffset, scrollOffset + MAX_VISIBLE_RESULTS);
```

`@inkjs/ui`'s `Select` and `MultiSelect` use the same approach with `visibleOptionCount` and `visibleFromIndex`/`visibleToIndex`.

## Proposed Approach for Build Step

### Layout Structure

```
┌─────────────────────────────────┐
│ [1] Intro [2] Stack [3] Build   │  ← always rendered (tabs)
├─────────────────────────────────┤
│ Web | Web-extras | API | ...    │  ← always rendered (domain tabs)
│                                 │
│   ▲ 2 more categories above    │  ← scroll indicator (when offset > 0)
│                                 │
│   Framework                     │  ┐
│   [react] [vue] [angular]       │  │
│                                 │  │
│   State Management              │  ├─ windowed content area
│   [zustand] [pinia] [jotai]     │  │  (stdout.rows - chrome)
│                                 │  │
│   Testing                       │  │
│   [vitest] [playwright]         │  ┘
│                                 │
│   ▼ 4 more categories below    │  ← scroll indicator (when more below)
│                                 │
├─────────────────────────────────┤
│ ↑↓ navigate  space toggle  ...  │  ← always rendered (footer)
└─────────────────────────────────┘
```

### Implementation Steps

1. **Get terminal height** via `useStdout()` → `stdout.rows`
2. **Calculate chrome height** (tabs + domain tabs + footer + padding) — measure or use known constants
3. **Compute available lines** = `stdout.rows - chromeHeight`
4. **Measure category sections** — each section is category name (1 line) + skill tags (varies with wrapping). Pre-compute or estimate heights per category.
5. **Track scroll state** — `scrollOffset` (first visible category index) in `CategoryGrid`
6. **Slice categories** — only render categories that fit within the available lines, starting from `scrollOffset`
7. **Scroll on navigation** — when focused category is outside the visible window, adjust `scrollOffset`
8. **Render scroll indicators** — show "N more above" / "N more below" when content is clipped

### Key Files

| File                                          | Change                                        |
| --------------------------------------------- | --------------------------------------------- |
| `src/cli/components/wizard/step-build.tsx`    | Pass available height to CategoryGrid         |
| `src/cli/components/wizard/category-grid.tsx` | Add windowing logic, scroll state, indicators |
| `src/cli/components/wizard/wizard-layout.tsx` | Measure chrome height or expose constants     |

### Complexity Considerations

- **Tag wrapping**: Skill tags use `flexWrap: "wrap"`, so a category's height depends on terminal width and number of skills. Heights need to be estimated or measured.
- **`measureElement`**: Ink provides this for getting computed Box dimensions, but it only works after render — creates a chicken-and-egg problem. May need a two-pass approach or conservative height estimates.
- **Resize handling**: `stdout` emits `resize` events. The windowing should recalculate on resize.
- **Focus tracking**: The current keyboard navigation in CategoryGrid needs to drive the scroll offset — when a user arrows into a category outside the viewport, it should scroll into view.

### Alternative: Simpler Collapsed Sections

Instead of full virtual windowing, categories could render in a collapsed state (name + skill count only) and expand on focus:

```
  Framework (3 skills)              ← collapsed
▸ State Management                  ← expanded (focused)
    [zustand] [pinia] [jotai]
  Testing (2 skills)                ← collapsed
  Data Fetching (3 skills)          ← collapsed
```

This naturally limits vertical space since only one category is expanded at a time. Simpler to implement but changes the UX more significantly — users can't scan all selections at a glance.

## References

- `src/cli/components/skill-search/skill-search.tsx` — existing virtual windowing implementation
- `node_modules/@inkjs/ui/build/components/select/use-select-state.js` — @inkjs/ui windowing
- `node_modules/ink/build/ink.js` lines 94-121 — Ink's height/render behavior
- `node_modules/ink/build/styles.d.ts` lines 224-240 — overflow/height props
