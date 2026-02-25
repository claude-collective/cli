# Component Patterns

**Last Updated:** 2026-02-25

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
    spinner.tsx              # Loading spinner
  hooks/                     # React hooks (14 hooks)
    use-build-step-props.ts
    use-category-grid-input.ts
    use-filtered-results.ts
    use-focused-list-item.ts
    use-framework-filtering.ts
    use-keyboard-navigation.ts
    use-measured-height.ts
    use-modal-state.ts
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
  wizard/                    # Wizard step components (22 source files)
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
    category-grid.tsx        # Subcategory grid layout
    checkbox-grid.tsx        # Skill toggle grid
    domain-selection.tsx     # Domain tab selector
    section-progress.tsx     # Category completion progress
    selection-card.tsx       # Selected item card
    source-grid.tsx          # Per-skill source picker
    search-modal.tsx         # Bound skill search modal
    stack-selection.tsx      # Stack list component
    menu-item.tsx            # Menu item component
    help-modal.tsx           # Help/hotkey reference
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
- Colors from `CLI_COLORS` constant (`src/cli/consts.ts:166-176`)
- Store access via `useWizardStore()` selectors
- No SCSS/CSS - all styling via Ink props

## Color Constants (`src/cli/consts.ts:166-176`)

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

## UI Symbols (`src/cli/consts.ts:95-108`)

| Symbol               | Value           | Usage                |
| -------------------- | --------------- | -------------------- |
| `CHECKBOX_CHECKED`   | `[x]`           | Selected checkbox    |
| `CHECKBOX_UNCHECKED` | `[ ]`           | Unselected checkbox  |
| `CHEVRON`            | unicode chevron | Navigation indicator |
| `SELECTED`           | checkmark       | Selected item        |
| `UNSELECTED`         | circle          | Unselected item      |
| `CURRENT`            | filled circle   | Current focus        |
| `SKIPPED`            | dash            | Skipped step         |
| `DISABLED`           | dash            | Disabled item        |
| `DISCOURAGED`        | `!`             | Warning indicator    |
| `SCROLL_UP`          | triangle up     | Scroll indicator     |
| `SCROLL_DOWN`        | triangle down   | Scroll indicator     |

## Grid Types (`src/cli/components/wizard/category-grid.tsx:10-28`)

Types for the build step skill selection grid:

```typescript
type OptionState = "normal" | "recommended" | "discouraged" | "disabled";

type CategoryOption = {
  id: SkillId;
  label: string;
  state: OptionState;
  stateReason?: string;
  selected: boolean;
  local?: boolean;
  installed?: boolean;
};

type CategoryRow = {
  id: Subcategory;
  displayName: string;
  required: boolean;
  exclusive: boolean;
  options: CategoryOption[];
};
```

Used by `category-grid.tsx`, `checkbox-grid.tsx`, `use-category-grid-input.ts`, and `build-step-logic.ts`.

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

For long skill lists that exceed terminal height. Constants in `SCROLL_VIEWPORT` (`src/cli/consts.ts:145-156`):

- `SCROLL_INDICATOR_HEIGHT: 1`
- `MIN_VIEWPORT_ROWS: 5`
- `MIN_TERMINAL_HEIGHT: 15`
