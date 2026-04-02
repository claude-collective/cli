# Component Patterns

**Last Updated:** 2026-04-02

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
  hooks/                     # React hooks (16 hooks, 3 test files)
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
  wizard/                    # Wizard step components (24 source files, 15 test files)
    wizard.tsx               # Main wizard orchestrator
    wizard-layout.tsx        # Layout wrapper (tabs + content + info panel)
    wizard-tabs.tsx          # Step progress indicator tabs
    step-stack.tsx           # Stack selection step
    step-build.tsx           # Technology selection step
    step-sources.tsx         # Source selection step
    step-agents.tsx          # Agent selection step
    step-confirm.tsx         # Confirmation step (scrollable, delegates to SkillAgentSummary)
    step-settings.tsx        # Settings overlay
    step-refine.tsx          # Refine sub-step component
    category-grid.tsx        # Category grid layout
    checkbox-grid.tsx        # Skill toggle grid
    domain-selection.tsx     # Domain tab selector
    section-progress.tsx     # Category completion progress
    selection-card.tsx       # Selected item card
    skill-agent-summary.tsx  # 2-box skill/agent listing with scope labels (used by StepConfirm and InfoPanel)
    source-grid.tsx          # Per-skill source picker (inline layout with column headers)
    search-modal.tsx         # Bound skill search modal
    stack-selection.tsx      # Stack list component
    menu-item.tsx            # Menu item component
    info-panel.tsx           # Marketplace/stack header + scrollable SkillAgentSummary
    toast.tsx                # Toast notification component (styled text block)
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
- Colors from `CLI_COLORS` constant (`src/cli/consts.ts:185-196`)
- Store access via `useWizardStore()` selectors
- No SCSS/CSS - all styling via Ink props

## Color Constants (`src/cli/consts.ts:185-196`)

| Constant    | Value     | Usage                             |
| ----------- | --------- | --------------------------------- |
| `PRIMARY`   | "cyan"    | Headers, focus                    |
| `SUCCESS`   | "green"   | Checkmarks, success               |
| `ERROR`     | "red"     | Errors                            |
| `WARNING`   | "yellow"  | Warnings                          |
| `INFO`      | "blue"    | Info text                         |
| `NEUTRAL`   | "gray"    | Dimmed text                       |
| `FOCUS`     | "cyan"    | Focused elements                  |
| `UNFOCUSED` | "white"   | Unfocused elements                |
| `WHITE`     | "white"   | Default text                      |
| `LABEL_BG`  | "#383838" | Background for scope/focus labels |

## UI Symbols (`src/cli/consts.ts:99-115`)

| Symbol               | Value           | Usage                               |
| -------------------- | --------------- | ----------------------------------- |
| `CHECKBOX_CHECKED`   | `[x]`           | Selected checkbox                   |
| `CHECKBOX_UNCHECKED` | `[ ]`           | Unselected checkbox                 |
| `CHEVRON`            | unicode chevron | Navigation indicator                |
| `CHEVRON_SPACER`     | space           | Non-focused spacer                  |
| `SELECTED`           | checkmark       | Selected item                       |
| `UNSELECTED`         | circle          | Unselected item                     |
| `CURRENT`            | filled circle   | Current focus                       |
| `SKIPPED`            | dash            | Skipped step                        |
| `DISABLED`           | dash            | Disabled item                       |
| `DISCOURAGED`        | `!`             | Warning indicator                   |
| `LOCK`               | lock emoji      | Locked/read-only items              |
| `EJECT`              | eject symbol    | Local/ejected skill indicator       |
| `BULLET`             | bullet dot      | List item marker in confirm/summary |
| `SCROLL_UP`          | triangle up     | Scroll indicator                    |
| `SCROLL_DOWN`        | triangle down   | Scroll indicator                    |

## SelectList Component (`src/cli/components/common/select-list.tsx`)

Generic keyboard-navigable list component. Consumed by `src/cli/commands/init.tsx` (project dashboard) and `src/cli/components/wizard/search-modal.tsx` (bound skill search).

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

## Grid Types

### OptionState (`src/cli/types/matrix.ts:302-306`)

Discriminated union for skill option advisory state. Imported by `category-grid.tsx` from `types/index.js`:

```typescript
type OptionState =
  | { status: "normal" }
  | { status: "recommended"; reason: string }
  | { status: "discouraged"; reason: string }
  | { status: "incompatible"; reason: string };
```

### CategoryOption and CategoryRow (`src/cli/components/wizard/category-grid.tsx:12-35`)

Types for the build step skill selection grid:

```typescript
type CategoryOption = {
  id: SkillId;
  state: OptionState;
  selected: boolean;
  local?: boolean;
  installed?: boolean;
  scope?: "project" | "global";
  locked?: boolean;
  hasUnmetRequirements?: boolean;
  unmetRequirementsReason?: string;
  requiredBy?: string;
};

type CategoryRow = {
  id: Category;
  displayName: string;
  required: boolean;
  exclusive: boolean;
  options: CategoryOption[];
};
```

**Consumers:** `category-grid.tsx` (defines both types), `use-category-grid-input.ts` (imports both), `use-framework-filtering.ts` (imports `CategoryRow` only), `src/cli/lib/wizard/build-step-logic.ts` (imports both). Note: `checkbox-grid.tsx` does NOT use these types -- it has its own `CheckboxItem<T>` / `CheckboxGridProps<T>`.

## Hotkeys Registry (`src/cli/components/wizard/hotkeys.ts`)

Centralized hotkey definitions. Each hotkey has a `key` (for matching) and `label` (for display). Used by step components, `wizard-layout.tsx`, and `wizard.tsx`.

**Character hotkeys:**

| Export                       | Key | Context                          |
| ---------------------------- | --- | -------------------------------- |
| `HOTKEY_INFO`                | I   | Global (toggle info panel)       |
| `HOTKEY_ACCEPT_DEFAULTS`     | A   | Build step (with stack selected) |
| `HOTKEY_SCOPE`               | S   | Build/agents step                |
| `HOTKEY_SETTINGS`            | S   | Sources step                     |
| `HOTKEY_TOGGLE_LABELS`       | D   | Build step                       |
| `HOTKEY_FILTER_INCOMPATIBLE` | F   | Build step                       |
| `HOTKEY_SET_ALL_LOCAL`       | L   | Sources step (customize view)    |
| `HOTKEY_SET_ALL_PLUGIN`      | P   | Sources step (customize view)    |
| `HOTKEY_ADD_SOURCE`          | A   | Settings step                    |
| `HOTKEY_COPY_LINK`           | C   | Skill search                     |

**Structural key labels** (display-only, for footer hints): `KEY_LABEL_ENTER`, `KEY_LABEL_ESC`, `KEY_LABEL_SPACE`, `KEY_LABEL_TAB`, `KEY_LABEL_DEL`, `KEY_LABEL_ARROWS`, `KEY_LABEL_ARROWS_VERT`, `KEY_LABEL_VIM`, `KEY_LABEL_VIM_VERT`.

Helper: `isHotkey(input, hotkey)` for case-insensitive matching.

## InfoPanel (`src/cli/components/wizard/info-panel.tsx`)

Scrollable panel showing marketplace/stack header and a skill/agent summary. Toggled via `HOTKEY_INFO` (I key). Rendered inside `wizard-layout.tsx` when `showInfo` store state is true (gated by `FEATURE_FLAGS.INFO_PANEL`, currently enabled).

**Exports:** `InfoPanel` (React.FC, no props -- reads `skillConfigs`, `agentConfigs`, `selectedStackId`, and `enabledSources` from wizard store).

**Layout:**

- Header: marketplace source names + selected stack name (bordered bottom separator)
- Body: `SkillAgentSummary` component for skill/agent listing
- Scrollable via `useMeasuredHeight()` + manual `scrollOffset` state

**Consumers:** `wizard-layout.tsx`

## SkillAgentSummary (`src/cli/components/wizard/skill-agent-summary.tsx`)

Two-column (skills | agents) summary component with scope labels (Project/Global), eject icons for local skills, and diff markers (+/- for added/removed items in edit mode). Uses `UI_SYMBOLS.BULLET` for existing items.

**Exports:**

- `SkillAgentSummaryProps` type -- `{ skillConfigs?: SkillConfig[]; agentConfigs?: AgentScopeConfig[] }`
- `SkillAgentSummary` (React.FC) -- main summary component
- `TableHeader` (React.FC) -- bold yellow section header
- `ScopeLabel` (React.FC) -- white-on-LABEL_BG scope badge
- `EjectIcon` (React.FC) -- yellow eject symbol for local/ejected skills

**Store access:** Reads `installedSkillConfigs` and `installedAgentConfigs` from wizard store to compute diffs (new/removed items).

**Consumers:** `step-confirm.tsx`, `info-panel.tsx`

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

For long skill lists that exceed terminal height. Constants in `SCROLL_VIEWPORT` (`src/cli/consts.ts:157-168`):

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
