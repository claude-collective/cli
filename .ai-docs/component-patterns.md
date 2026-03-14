# Component Patterns

**Last Updated:** 2026-03-14

## Rendering Library

**Library:** Ink v5 (React-based terminal rendering)
**Theme:** `@inkjs/ui` ThemeProvider with custom theme
**Styling:** Inline Ink props (`color`, `bold`, `dimColor`) + `CLI_COLORS` constants

## Component Structure

### Directory Layout

```
src/cli/components/
  common/                    # Shared UI components
    confirm.tsx              # Y/N confirmation prompt
    confirm.test.tsx
    message.tsx              # Styled message display
    select-list.tsx          # Generic keyboard-navigable list
    spinner.tsx              # Loading spinner
  hooks/                     # React hooks (16 hooks)
    use-build-step-props.ts
    use-category-grid-input.ts
    use-filtered-results.ts
    use-focused-list-item.ts
    use-framework-filtering.ts
    use-keyboard-navigation.ts
    use-measured-height.ts
    use-modal-state.ts
    use-row-scroll.ts
    use-section-scroll.ts
    use-source-grid-search-modal.ts
    use-source-operations.ts
    use-terminal-dimensions.ts
    use-text-input.ts
    use-virtual-scroll.ts
    use-wizard-initialization.ts
  skill-search/              # Skill search component
    index.ts
    skill-search.tsx
  themes/
    default.ts               # CLI theme configuration
  wizard/                    # Wizard step components (23 source files)
    wizard.tsx               # Main wizard orchestrator
    wizard-layout.tsx        # Layout wrapper (tabs + content)
    wizard-tabs.tsx          # Step progress indicator tabs
    view-title.tsx           # Step title component
    step-stack.tsx           # Stack selection step
    step-build.tsx           # Technology selection step
    step-sources.tsx         # Source selection step
    step-agents.tsx          # Agent selection step
    step-confirm.tsx         # Confirmation step
    step-settings.tsx        # Settings overlay
    step-refine.tsx          # Refine sub-step component
    category-grid.tsx        # Category grid layout
    checkbox-grid.tsx        # Skill toggle grid
    domain-selection.tsx     # Domain tab selector
    section-progress.tsx     # Category completion progress
    selection-card.tsx       # Selected item card
    source-grid.tsx          # Per-skill source picker
    search-modal.tsx         # Bound skill search modal
    stack-selection.tsx      # Stack list component
    menu-item.tsx            # Menu item component
    help-modal.tsx           # Help/hotkey reference
    hotkeys.ts               # Centralized hotkey registry
    utils.ts                 # Wizard utility functions
```

## Component Definition Pattern

**Standard pattern (named export, functional component, Ink elements):**

```typescript
import React from "react";
import { Box, Text } from "ink";
import { CLI_COLORS } from "../../consts.js";
import { useWizardStore } from "../../stores/wizard-store.js";

type StepBuildProps = {
  matrix: MergedSkillsMatrix;
  // ...
};

export const StepBuild: React.FC<StepBuildProps> = ({ matrix }) => {
  const store = useWizardStore();

  return (
    <Box flexDirection="column">
      <Text color={CLI_COLORS.PRIMARY}>Build Step</Text>
    </Box>
  );
};
```

**Key patterns:**

- Named exports only (no default exports)
- `React.FC<Props>` type annotation
- Ink primitives: `<Box>`, `<Text>`, `useInput()`, `useApp()`, `useStdout()`
- Colors from `CLI_COLORS` constant (`src/cli/consts.ts:178-188`)
- Store access via `useWizardStore()` selectors
- No SCSS/CSS - all styling via Ink props

## Color Constants (`src/cli/consts.ts:178-188`)

| Constant    | Value    | Usage               |
| ----------- | -------- | ------------------- |
| `PRIMARY`   | "cyan"   | Headers, focus      |
| `SUCCESS`   | "green"  | Checkmarks, success |
| `ERROR`     | "red"    | Errors              |
| `WARNING`   | "yellow" | Warnings            |
| `INFO`      | "blue"   | Info text           |
| `NEUTRAL`   | "gray"   | Dimmed text         |
| `FOCUS`     | "cyan"   | Focused elements    |
| `UNFOCUSED` | "white"  | Unfocused elements  |
| `WHITE`     | "white"  | Default text        |

## UI Symbols (`src/cli/consts.ts:100-113`)

| Symbol               | Value           | Usage                |
| -------------------- | --------------- | -------------------- |
| `CHECKBOX_CHECKED`   | `[x]`           | Selected checkbox    |
| `CHECKBOX_UNCHECKED` | `[ ]`           | Unselected checkbox  |
| `CHEVRON`            | unicode chevron | Navigation indicator |
| `CHEVRON_SPACER`     | space           | Non-focused spacer   |
| `SELECTED`           | checkmark       | Selected item        |
| `UNSELECTED`         | circle          | Unselected item      |
| `CURRENT`            | filled circle   | Current focus        |
| `SKIPPED`            | dash            | Skipped step         |
| `DISABLED`           | dash            | Disabled item        |
| `DISCOURAGED`        | `!`             | Warning indicator    |
| `SCROLL_UP`          | triangle up     | Scroll indicator     |
| `SCROLL_DOWN`        | triangle down   | Scroll indicator     |

## SelectList Component (`src/cli/components/common/select-list.tsx`)

Generic keyboard-navigable list component. Used by Dashboard and other prompt views.

```typescript
type SelectListItem<T> = { value: T; label: string };

type SelectListProps<T> = {
  items: SelectListItem<T>[];
  onSelect: (value: T) => void;
  onCancel?: () => void;
  renderItem?: (item: SelectListItem<T>, isFocused: boolean) => React.ReactNode;
  active?: boolean;
};
```

## Grid Types (`src/cli/components/wizard/category-grid.tsx:12-30`)

Types for the build step skill selection grid:

```typescript
type OptionState = "normal" | "recommended" | "discouraged";

type CategoryOption = {
  id: SkillId;
  state: OptionState;
  stateReason?: string;
  selected: boolean;
  local?: boolean;
  installed?: boolean;
  scope?: "project" | "global";
};

type CategoryRow = {
  id: Category;
  displayName: string;
  required: boolean;
  exclusive: boolean;
  options: CategoryOption[];
};
```

Used by `category-grid.tsx`, `checkbox-grid.tsx`, `use-category-grid-input.ts`, `use-framework-filtering.ts`, and `src/cli/lib/wizard/build-step-logic.ts`.

## Hotkeys Registry (`src/cli/components/wizard/hotkeys.ts`)

Centralized hotkey definitions. Each hotkey has a `key` (for matching) and `label` (for display). Used by step components and `help-modal.tsx`.

**Character hotkeys:**

| Export                   | Key | Context                       |
| ------------------------ | --- | ----------------------------- |
| `HOTKEY_HELP`            | ?   | Global (all steps)            |
| `HOTKEY_ACCEPT_DEFAULTS` | A   | Global (all steps)            |
| `HOTKEY_SCOPE`           | S   | Build/agents step             |
| `HOTKEY_SETTINGS`        | S   | Sources step                  |
| `HOTKEY_TOGGLE_LABELS`   | D   | Build step                    |
| `HOTKEY_SET_ALL_LOCAL`   | L   | Sources step (customize view) |
| `HOTKEY_SET_ALL_PLUGIN`  | P   | Sources step (customize view) |
| `HOTKEY_ADD_SOURCE`      | A   | Settings step                 |
| `HOTKEY_COPY_LINK`       | C   | Skill search                  |

**Structural key labels** (display-only, for footer hints): `KEY_LABEL_ENTER`, `KEY_LABEL_ESC`, `KEY_LABEL_SPACE`, `KEY_LABEL_TAB`, `KEY_LABEL_DEL`, `KEY_LABEL_ARROWS`, `KEY_LABEL_ARROWS_VERT`, `KEY_LABEL_VIM`, `KEY_LABEL_VIM_VERT`.

Helper: `isHotkey(input, hotkey)` for case-insensitive matching.

## Hook Patterns

### Store Access

```typescript
// Select specific fields (prevents unnecessary re-renders)
const step = useWizardStore((s) => s.step);
const toggleTechnology = useWizardStore((s) => s.toggleTechnology);
```

### Keyboard Input

```typescript
import { useInput } from "ink";

useInput((input, key) => {
  if (key.return) handleConfirm();
  if (key.escape) handleCancel();
  if (key.upArrow) handleUp();
  if (key.downArrow) handleDown();
});
```

### Terminal Dimensions

```typescript
import { useTerminalDimensions } from "../hooks/use-terminal-dimensions.js";

const { width, height } = useTerminalDimensions();
```

## Theme

**File:** `src/cli/components/themes/default.ts`

Provides `cliTheme` for `@inkjs/ui` `ThemeProvider`. Applied in `wizard.tsx`:

```tsx
<ThemeProvider theme={cliTheme}>{/* wizard content */}</ThemeProvider>
```

## Testing Pattern

Wizard components have co-located test files using Vitest + ink-testing-library:

```
step-build.tsx
step-build.test.tsx
```

Test files use:

- `ink-testing-library` for rendering
- `createMockSkill()`, `createMockMatrix()`, `createMockCategory()` from `helpers.ts`
- Test constants from `test-constants.ts` (keyboard escape sequences, timing delays)

## Virtual Scrolling

**File:** `src/cli/components/hooks/use-virtual-scroll.ts`

For long skill lists that exceed terminal height. Constants in `SCROLL_VIEWPORT` (`src/cli/consts.ts:150-161`):

| Constant                  | Value | Purpose                                    |
| ------------------------- | ----- | ------------------------------------------ |
| `SCROLL_INDICATOR_HEIGHT` | 1     | Height of scroll indicator line            |
| `CATEGORY_NAME_LINES`     | 2     | Lines per category name row (incl. margin) |
| `CATEGORY_MARGIN_LINES`   | 1     | Margin between category sections           |
| `MIN_VIEWPORT_ROWS`       | 5     | Minimum rows before enabling scroll        |
| `MIN_TERMINAL_HEIGHT`     | 15    | Minimum terminal height for wizard display |

### Section Scroll (`use-section-scroll.ts`)

Pixel-offset scroll for views with variable-height sections (e.g., category grid).

### Row Scroll (`use-row-scroll.ts`)

Row-based scroll for views with uniform 1-line rows (e.g., agent list, source list).
