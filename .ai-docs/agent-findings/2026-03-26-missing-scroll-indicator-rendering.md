---
type: standard-gap
severity: medium
affected_files:
  - src/cli/components/wizard/category-grid.tsx
  - src/cli/components/wizard/step-agents.tsx
  - src/cli/components/wizard/stack-selection.tsx
  - src/cli/components/wizard/source-grid.tsx
  - src/cli/components/wizard/checkbox-grid.tsx
  - src/cli/components/wizard/step-settings.tsx
  - src/cli/consts.ts
standards_docs:
  - .ai-docs/reference/component-patterns.md
date: 2026-03-26
reporting_agent: code-explorer
category: ux
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

Scroll indicators are defined but never rendered. The codebase has:

1. **UI symbol definitions** in `consts.ts` (lines 111-112):
   - `SCROLL_UP: "\u25B2"` (▲)
   - `SCROLL_DOWN: "\u25BC"` (▼)

2. **Constants for indicator layout** in `SCROLL_VIEWPORT` (lines 150-161):
   - `SCROLL_INDICATOR_HEIGHT: 1`
   - Used by `use-virtual-scroll.ts` for space reservation

3. **Tracking data but not displaying it**:
   - `use-virtual-scroll.ts` computes `hiddenAbove` and `hiddenBelow`
   - All scroll hooks track `scrollEnabled` state
   - No component consumes these to render indicators

**Result:** When users scroll, they get no visual feedback that:

- More content exists above or below
- How many items are hidden
- Their current scroll position in the list

This creates a usability problem for lists that exceed terminal height (e.g., agents list with 20+ agents in a short terminal).

## Fix Applied

None — discovery only. This requires UX/component design decisions (where to render indicators, what format, etc.).

## Proposed Standard

Document a scroll indicator pattern in `.ai-docs/reference/component-patterns.md`:

1. **When to show scroll indicators:**
   - When `scrollEnabled === true`
   - At the top of viewport if `scrollTop > 0` or `hiddenAbove > 0`
   - At the bottom of viewport if content exists below visible range

2. **Recommended format:**
   - Row-based: `▲ 3 more above` / `▼ 5 more below`
   - Section-based: `▲ Categories above` / `▼ Categories below`
   - Or minimal: Just the arrow symbols

3. **Implementation location:**
   - Render in outer scroll container, not as part of item list
   - Top indicator: above `marginTop` shift
   - Bottom indicator: after item list

4. **Add to component-patterns.md** (new subsection under "Virtual Scrolling"):

   ```markdown
   ### Scroll Indicators

   When content exceeds viewport and `scrollEnabled === true`, render visual indicators.

   **Top indicator** (when scrolled down):

   - Show above viewport: `{scrollTop > 0 && <Text dimColor>▲ ... more above</Text>}`

   **Bottom indicator** (when more content below):

   - Show below viewport: `{hiddenBelow > 0 && <Text dimColor>▼ ... more below</Text>}`

   Use `UI_SYMBOLS.SCROLL_UP` and `UI_SYMBOLS.SCROLL_DOWN` for the arrow glyphs.
   ```
