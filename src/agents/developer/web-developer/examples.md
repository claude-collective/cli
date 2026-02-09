## Example Implementation Output

Here's what a complete, high-quality frontend developer output looks like:

````markdown
# Implementation: Add Dark Mode Toggle to Settings Panel

## Investigation Notes

**Files Read:**

- src/components/SettingsPanel.tsx:67-134 - Settings use controlled inputs with Zustand store
- src/styles/theme.scss:12-45 - Theme tokens use CSS custom properties with cascade layers
- src/stores/ThemeStore.ts:1-89 - Store uses persist middleware for localStorage

**Patterns Found:**

- Settings items use Switch component with label prop (SettingsPanel.tsx:112)
- Zustand with persist middleware, actions defined inline (ThemeStore.ts:45-67)
- CSS custom properties scoped to `[data-theme]` selector (theme.scss:12)

**Existing Code Reused:**

- Switch component from `@repo/ui/switch` - handles accessibility and styling
- useThemeStore hook - consistent with other settings

## Implementation Plan

1. Add darkMode state and toggleDarkMode action to ThemeStore.ts
2. Create DarkModeToggle component following Switch pattern
3. Add toggle to SettingsPanel
4. Add dark mode color tokens to theme.scss
5. Apply data-theme attribute in App.tsx

## Changes Made

### 1. ThemeStore.ts (+12 lines)

Added to existing store:

```tsx
darkMode: false,
toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
```
````

### 2. dark-mode-toggle.tsx (new file, 18 lines)

```tsx
import { Switch } from "@repo/ui/switch";
import { useThemeStore } from "../stores/ThemeStore";

export function DarkModeToggle({ className }: { className?: string }) {
  const { darkMode, toggleDarkMode } = useThemeStore();
  return (
    <Switch label="Dark mode" checked={darkMode} onChange={toggleDarkMode} className={className} />
  );
}
```

### 3. theme.scss (+8 lines)

```scss
[data-theme="dark"] {
  --color-background: var(--gray-900);
  --color-surface: var(--gray-800);
  --color-text-primary: var(--gray-50);
  --color-border: var(--gray-700);
}
```

### 4. SettingsPanel.tsx (+2 lines)

- Imported DarkModeToggle
- Added `<DarkModeToggle />` to settings list

### 5. App.tsx (+3 lines)

- Applied `data-theme={darkMode ? "dark" : "light"}` to root

## Verification

**Success Criteria:**

- [x] Toggle appears in settings panel (visually verified)
- [x] Clicking toggle changes theme (tested)
- [x] Theme persists across reload (localStorage verified)

**Quality Checks:**

- [x] Keyboard accessible (Switch handles this)
- [x] No new dependencies
- [x] Follows existing patterns

**Build Status:**

- [x] `bun test` passes
- [x] `bun build` succeeds
- [x] No type/lint errors

## Summary

**Files:** 5 changed (+43 lines)
**Scope:** Added only toggle + persistence. Did NOT add system preference detection or transition animations (not in spec).
**For Reviewer:** Verify theme.scss color choices match design system.

```

```
