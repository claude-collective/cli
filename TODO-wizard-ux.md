# Wizard UX Tasks

## Completed This Session

- [x] Remove "Agents Inc." branding from wizard progress/tab bar
- [x] Suppress "Source does not have a marketplace.json" warning (use verbose instead of warn)
- [x] Replace fixed `AVG_TAG_WIDTH` with actual tag width calculation in `estimateCategoryHeight`
- [x] Remove `AVG_TAG_WIDTH` constant from `SCROLL_VIEWPORT`
- [x] Remove all state icons from skill tags (no circles, checkmarks, exclamation marks)
- [x] Default dim borders for all tags; state-colored borders only on hover/focus
- [x] Stable skill ordering (no reordering based on recommended/discouraged/selected state)
- [x] Hotkey badge (E, D, P, G) highlights teal when active
- [x] Domain selection: spacebar toggles, ESC goes back, custom list replaces @inkjs/ui Select
- [x] Legend uses filled circle for active

## Outstanding

### 1. Build step still uses fixed height constraint on the grid container

`step-build.tsx:142` wraps `CategoryGrid` in `<Box ref={gridRef} flexGrow={1}>` and passes `availableHeight` computed from `useMeasuredHeight`. The `wizard-layout.tsx:95` sets `height={constrainedHeight}` when `store.step === "build"`. This constrains the entire build view to a fixed terminal height, which combined with the virtual scroll estimation, causes overflow when tags wrap.

**The user wants:** Simple natural scrolling — content flows, press down arrow and it scrolls if there isn't enough space. No fixed height on the grid container.

**Files:** `src/cli/components/wizard/step-build.tsx`, `src/cli/components/wizard/wizard-layout.tsx`

---

### 2. Marketplace label should show "agents-inc (public)" by default

Instead of the suppressed warning, the marketplace label should always render. Currently `getMarketplaceLabel()` returns the correct string but the label only shows when `marketplaceLabel` is truthy in `wizard-layout.tsx`. Verify the label actually renders — the user expects to see "Marketplace: agents-inc (public)" or similar.

**Files:** `src/cli/lib/loading/source-loader.ts`, `src/cli/components/wizard/wizard-layout.tsx`

---

### 3. Verify all changes actually render correctly

The agents reported success but the user says the build step is "still broken in the exact same way." Need to visually verify:

- No icons in skill tags
- No colored borders on unfocused tags
- Stable skill order
- Proper tag wrapping on narrow terminals

**Action:** Manual testing with `agentsinc init` or `agentsinc edit` in an 80-column terminal.
