# Documentation Bible -- Agents Inc. CLI

> **CRITICAL: THIS DOCUMENTATION IS FOR AI AGENTS ONLY**
>
> This is NOT human documentation. This is machine-readable, AI-optimized documentation designed for LLM context windows, pattern recognition, and structured extraction. Humans should use traditional documentation.

---

## CORE PRINCIPLES - DISPLAY AT START OF EVERY DOCUMENTATION SESSION

**1. Investigation First** - Never document code you haven't read. Base all claims on actual file contents.

**2. AI-Centric Focus** - Structure for AI parsing: tables, explicit paths, code blocks. No tutorials or explanations.

**3. Path Verification** - Every file path MUST be verified to exist before documenting.

**4. prompt-bible Alignment** - All documentation techniques trace to proven prompt engineering principles.

**5. Write Verification** - Re-read every file after editing. Never report success without verification.

**DISPLAY THESE 5 PRINCIPLES AT THE START OF EVERY DOCUMENTATION SESSION TO MAINTAIN INSTRUCTION CONTINUITY.**

---

## Table of Contents

1. [Document Hierarchy (V2)](#document-hierarchy-v2)
2. [File Types and Standards (V2)](#file-types-and-standards-v2)
3. [CLI-Specific Documentation Categories](#cli-specific-documentation-categories)
4. [Why AI Agents Need Different Documentation](#why-ai-agents-need-different-documentation)
5. [prompt-bible Alignment](#prompt_bible-alignment)
6. [AI Processing Guidelines](#ai-processing-guidelines)
7. [Progressive Loading Strategy](#progressive-loading-strategy)
8. [Core Separation Principle](#core-separation-principle)
9. [Documentation Types and Tiers](#documentation-types-and-tiers)
10. [Directory Structure Standard](#directory-structure-standard)
11. [Templates](#templates)
12. [CLI-Specific Templates](#cli-specific-templates)
13. [Hash Verification Standards](#hash-verification-standards)
14. [Auggie MCP Verification](#auggie-mcp-verification)
15. [Quality Standards](#quality-standards)
16. [CLI Anti-Patterns in Documentation](#cli-anti-patterns-in-documentation)
17. [Error Handling and Validation](#error-handling-and-validation)
18. [When to Create Documentation](#when-to-create-documentation)
19. [CLI Decision Framework](#cli-decision-framework)
20. [CLI Validation Process](#cli-validation-process)
21. [Cross-Referencing Skills](#cross-referencing-skills)
22. [Self-Correction Triggers](#self-correction-triggers)
23. [Session Workflow](#session-workflow)
24. [Documentation Agent Maintenance](#documentation-agent-maintenance)
25. [Critical Reminders](#critical-reminders)
26. [Research Sources & Techniques](#research-sources--techniques)

---

## Document Hierarchy (V2)

### Entry Point Priority Order

When AI agents need documentation, they should load files in this order:

| Priority | File                     | Purpose                                | When to Load                            |
| -------- | ------------------------ | -------------------------------------- | --------------------------------------- |
| **1st**  | `llms.txt`               | Quick orientation                      | ALWAYS first - fastest context          |
| **2nd**  | `CONCEPTS.md`            | Semantic discovery by keyword/alias    | When searching for something by concept |
| **3rd**  | `_quick/*.md`            | Task-specific micro-entry points       | For common tasks (add panel, fix bug)   |
| **4th**  | `INDEX.md`               | Full navigation index                  | When need complete doc listing          |
| **5th**  | Feature docs             | Deep dives (README, STORE-API, flows/) | When need detailed feature info         |
| **6th**  | `documentation-bible.md` | Standards and templates                | ONLY when updating documentation        |
| **7th**  | `PITFALLS.md`            | Common anti-patterns                   | When coding a feature to avoid mistakes |

### Loading Decision Tree

```
Need to work on a feature?
|
+-> Load llms.txt FIRST (30 seconds orientation)
|     |
|     +-> Need to find something by keyword?
|     |     +-> Load CONCEPTS.md (semantic lookup)
|     |
|     +-> Doing a common task?
|     |     +-> Load _quick/[task].md (15 lines, direct files)
|     |
|     +-> Need full feature understanding?
|           +-> Load features/[name]/README.md
|           +-> Then flows/[flow].md as needed

Need to add/update documentation?
|
+-> Load documentation-bible.md
```

### Example: "Add a new panel to batch"

```
OPTIMAL LOADING ORDER:
1. llms.txt                    # quick orientation
2. _quick/add-panel.md         # 20 lines - exact files to modify
3. (optional) FILE-MAP.md      # Only if need more context

TOTAL: ~70 lines vs 500+ lines if loading full README
```

---

## File Types and Standards (V2)

### llms.txt Standards

**Location:** `.ai-docs/llms.txt`

**Purpose:** Ultra-light entry point following [llmstxt.org](https://llmstxt.org/) standard.

**Requirements:**

- MUST include: Quick Start, Core Entry Points table, Documentation links
- Links ONLY to files that actually exist (verify with Read tool)
- Updated when new features or entry points are added
- Can include additional sections (Feature Deep Dives, etc.) if they provide direct value

**Required Sections:**

```markdown
# [Project Name] - AI Documentation

> Brief description

## Quick Start

[3-4 lines pointing to most common docs]

## Core Entry Points

| Feature | Route | Store | Entry Point |
[Table of main features]

## Documentation

[Links to key docs - verify all exist]

## Concept Lookup

Link to CONCEPTS.md

## Optional (Deep Dives)

[Links to detailed docs for reference]
```

**When to Update:**

- New feature added
- Route changed
- Store renamed
- Entry point modified

---

### CONCEPTS.md Standards

**Location:** `.ai-docs/CONCEPTS.md`

**Purpose:** Semantic discovery layer. Enables finding documentation by concept, keyword, or alias instead of knowing exact file names.

**Requirements:**

- Include 3+ aliases/keywords per concept
- Tables with: Concept | Aliases | Primary Doc | Store Method
- Cross-reference `_quick/` docs for common tasks
- Keep Last Updated date current

**Required Sections:**

```markdown
# Concept Index

> Purpose statement

**Last Updated:** [YYYY-MM-DD]

## [Feature] Concepts

| Concept    | Aliases / Keywords  | Primary Doc            | Store Method     |
| ---------- | ------------------- | ---------------------- | ---------------- |
| **Export** | download, save, zip | `flows/export-flow.md` | `store.export()` |

## UI Component Concepts

| Concept | Aliases | Component | File |

## Store Concepts

| Concept | Aliases | Store | Purpose | Key Methods |

## Common Tasks -> Quick Docs

| Task | Keywords | Quick Doc | Primary Files |
```

**When to Update:**

- New concept/feature added
- Terminology changed
- New aliases discovered during usage
- New `_quick/` doc created

---

### \_quick/\*.md Standards

**Location:** `.ai-docs/_quick/`

**Purpose:** Ultra-focused micro-docs for common tasks. Each file points directly to files that need modification.

**Requirements:**

- Keep each file focused on a single task
- MUST have "Files to Modify" section with numbered steps
- MUST have "Reference Docs" section at bottom
- All file paths MUST be verified to exist
- One task per file
- File naming: `[verb]-[noun].md` (e.g., `add-panel.md`, `fix-export-bug.md`)

**Template:**

```markdown
# Quick: [Task Name]

## Files to Modify (in order)

1. **[Purpose]**: `/path/to/file.ts`
   - What to change

2. **[Purpose]**: `/path/to/file.tsx`
   - What to change

## Reference Docs

- Full details: `features/[name]/[doc].md`
- Patterns: `skill: [skill-name]`
```

**Example (from `_quick/add-panel.md`):**

```markdown
# Quick: Add a New Panel to Batch

## Files to Modify (in order)

1. **Define panel ID**: `/src/lib/batch/components/BatchSideNavLayout/types.ts`
   - Add to `BatchPanelId` enum

2. **Create component**: `/src/lib/batch/components/Batch[Name]/Batch[Name].tsx`
   - Follow pattern from `BatchPlacement.tsx` or `BatchAIShadows.tsx`

3. **Add to navigation**: `/src/lib/batch/components/BatchSideNavLayout/SideNavigation.tsx`
   - Add icon and panel entry

4. **Register in layout**: `/src/lib/batch/components/BatchSideNavLayout/PinnedPanel.tsx`
   - Add case for new panel ID

## Reference Docs

- Full component list: `features/batch/FILE-MAP.md`
- Common tasks: `features/batch/COMMON-TASKS.md`
```

**When to Create:**

- Task is performed frequently (3+ times)
- Task involves modifying multiple files in sequence
- Task has a clear, repeatable pattern

---

### PITFALLS.md Standards

**Location:** `.ai-docs/PITFALLS.md` or `.ai-docs/features/[feature]/PITFALLS.md`

**Purpose:** Document common mistakes and anti-patterns specific to this codebase. Prevents AI agents from introducing bugs that senior developers would catch in code review.

**Requirements:**

- Organize by category (MobX, React, Testing, etc.)
- Include WRONG and CORRECT code examples
- Explain WHY the anti-pattern is problematic
- Reference ADRs where architectural decisions explain the pattern

**Template:**

````markdown
# Common Pitfalls - [Feature/Area]

> Anti-patterns and mistakes to avoid

## [Category]

### [Pitfall Name]

**Severity:** CRITICAL | HIGH | MEDIUM

**WRONG:**

```[language]
// Anti-pattern code
```
````

**CORRECT:**

```[language]
// Correct pattern
```

**Why:** Explanation of the issue

**Related:** ADR-XXX, flow-doc.md

````

**When to Create:**
- When a pattern causes recurring bugs
- When code review consistently catches the same issues
- When Auggie identifies common mistakes in the codebase

---

### _decisions/*.md Standards (ADRs)

**Location:** `.ai-docs/_decisions/`

**Purpose:** Architecture Decision Records. Document WHY architectural decisions were made to prevent AI agents from "helpfully" refactoring things that would break the system.

**Requirements:**
- Follow ADR format: Status, Context, Decision, Consequences
- MUST include "DO NOT" section for architectural guardrails
- Numbered sequentially: `000-template.md`, `001-engine-delegation.md`, etc.
- Status values: `Proposed` | `Accepted` | `Deprecated` | `Superseded by ADR-XXX`

**Template (from `_decisions/000-template.md`):**

```markdown
# ADR-XXX: [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Context
What is the issue that we're seeing that motivates this decision?

## Decision
What is the change that we're proposing and/or doing?

## Consequences

### Easier
- What becomes easier

### Harder
- What becomes harder

## DO NOT
- **DO NOT [specific anti-pattern]**
  - Explanation of why this would break things
````

**Example (from `001-engine-delegation.md`):**

```markdown
# ADR-001: BatchStore Delegates All Mutations to EngineStore

## Status

Accepted

## Context

Batch operations require image processing handled by WASM-based engine...

## Decision

BatchStore does NOT store batch items directly. Instead:

1. BatchStore provides high-level methods
2. These methods call `engineStore.update({ batch: {...} })`
3. Engine processes the update
4. BatchStore reads state from `engineStore.view.batch`

## Consequences

### Easier

- Single source of truth (engine)
- Undo/redo handled by engine

### Harder

- Cannot modify batch state without engine
- Debugging requires checking both layers

## DO NOT

- **DO NOT store items, background, shadow directly in BatchStore**
- **DO NOT bypass engineStore.update() for batch changes**
- **DO NOT create parallel state that duplicates engine state**
```

**When to Create:**

- Architectural decision that's not obvious
- Decision that might be "refactored" by AI without understanding
- Pattern that seems wrong but is intentional
- Decision that has trade-offs worth documenting

---

### \_session/ Standards

**Location:** `.ai-docs/_session/`

**Purpose:** Working memory for Claude during long, multi-step tasks.

**Requirements:**

- Contains only temporary working files
- Clear at start of each documentation session
- NOT committed to git (except `README.md` and `.gitignore`)
- Files created during tasks, deleted when done

**Structure:**

```
_session/
  .gitignore       # Ignores all files except README.md and .gitignore
  README.md        # Usage instructions (committed)
  current-task.md  # Created during work (not committed)
```

**`.gitignore` content:**

```
*
!.gitignore
!README.md
```

**Usage Pattern:**

```markdown
# Current Task: [Task Name]

## Discovered

- Finding 1
- Finding 2

## Files Modified

- [x] File 1 - completed
- [ ] File 2 - pending

## Blocked On

- Question or dependency
```

---

## Hash Verification Standards

**Purpose:** Track file changes between documentation updates. If a hash doesn't match, the file has been modified and documentation may need updating.

### Hash Format

- 6-character git hash prefix
- Generated with: `git hash-object <file> | cut -c1-6`

### FILE-MAP.md Hash Column

All FILE-MAP.md documents MUST include a Hash column:

```markdown
| File                                 | Purpose    | Hash     | Related       | Tests   | Verified |
| ------------------------------------ | ---------- | -------- | ------------- | ------- | -------- |
| `/src/lib/batch/store/BatchStore.ts` | Main store | `d8063b` | `EngineStore` | All E2E | Y        |
```

### Hash Verification Workflow

```
For each file in FILE-MAP:
1. Run: git hash-object <path> | cut -c1-6
2. Compare result with documented Hash
3. If hash differs:
   - Mark Verified as ?
   - Investigate what changed
   - Update documentation if needed
   - Update hash when doc is current
```

### Verified Column Values

| Value | Meaning                              |
| ----- | ------------------------------------ |
| Y     | Hash verified, documentation current |
| ?     | Hash changed, needs investigation    |
| N     | Known outdated, needs update         |

---

## CLI-Specific Documentation Categories

### 1. Command Patterns

**What to document:** oclif command structure, flags, BaseCommand usage, error handling, exit codes.

**Key files:**

| File                        | Purpose                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/base-command.ts`   | Shared base class with `handleError()`, `logSuccess()`, `sourceConfig` getter                                               |
| `src/cli/lib/exit-codes.ts` | Named exit code constants: `SUCCESS`, `ERROR`, `INVALID_ARGS`, `NETWORK_ERROR`, `CANCELLED`                                 |
| `src/cli/utils/errors.ts`   | `getErrorMessage(error)` for unknown error values                                                                           |
| `src/cli/utils/messages.ts` | Centralized message constants: `ERROR_MESSAGES`, `SUCCESS_MESSAGES`, `STATUS_MESSAGES`, `DRY_RUN_MESSAGES`, `INFO_MESSAGES` |
| `src/cli/commands/`         | All command implementations                                                                                                 |

**Pattern to document:**

```typescript
// From src/cli/commands/compile.ts
import { BaseCommand } from "../base-command";
import { EXIT_CODES } from "../lib/exit-codes";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "../utils/messages";

export default class Compile extends BaseCommand {
  static flags = {
    /* oclif flag definitions */
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Compile);
    // Use this.handleError(error) for catch-all errors
    // Use this.error(message, { exit: EXIT_CODES.INVALID_ARGS }) for specific exits
    // Use this.logSuccess(message) for success output
  }
}
```

**Document for each command:**

- Flag definitions and defaults
- Exit code paths (which `EXIT_CODES.*` constant and when)
- Error handling strategy (handleError vs specific exit)
- Message constant usage from `utils/messages.ts`

---

### 2. Wizard Flow

**What to document:** Step navigation, Zustand state, Ink components, `useInput` hooks.

**Key files:**

| File                                         | Purpose                                                           |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `src/cli/stores/wizard-store.ts`             | Zustand store with `WizardStep` type and all wizard state/actions |
| `src/cli/components/wizard/wizard.tsx`       | Root wizard component, step rendering, keyboard input             |
| `src/cli/components/wizard/step-stack.tsx`   | Stack selection step                                              |
| `src/cli/components/wizard/step-build.tsx`   | Technology selection (CategoryGrid) step                          |
| `src/cli/components/wizard/step-sources.tsx` | Source customization step                                         |
| `src/cli/components/wizard/step-confirm.tsx` | Final confirmation step                                           |

**Step flow:**

```
stack -> build -> sources -> confirm
```

**Step types** (from `src/cli/stores/wizard-store.ts:111-115`):

```typescript
export type WizardStep =
  | "stack" // Select stack or "Start from scratch", then domain selection
  | "build" // CategoryGrid for technology selection
  | "sources" // Choose skill sources (recommended vs custom)
  | "confirm"; // Final confirmation
```

**Store pattern** (Zustand with actions):

```typescript
// From src/cli/stores/wizard-store.ts
import { create } from "zustand";

export type WizardState = {
  step: WizardStep;
  approach: "stack" | "scratch" | null;
  // ... state fields

  // Actions
  setStep: (step: WizardStep) => void;
  toggleSkill: (domain: Domain, subcat: Subcategory, skillId: SkillId) => void;
  // ... more actions
};

export const useWizardStore = create<WizardState>()((set, get) => ({
  // state + action implementations
}));
```

**Document for wizard flows:**

- State shape and key fields
- Action names and what they mutate
- Step transition conditions
- Keyboard shortcuts (`useInput` bindings)
- Component tree per step

---

### 3. Agent/Skill Compilation

**What to document:** The pipeline from loading through compilation to output.

**Key files:**

| File                                          | Purpose                                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/cli/lib/compiler.ts`                     | Main compilation: Liquid templates, agent assembly, output validation               |
| `src/cli/lib/skills/skill-plugin-compiler.ts` | Skill plugin compilation: reads SKILL.md + metadata.yaml, generates plugin manifest |
| `src/cli/lib/stacks/stack-plugin-compiler.ts` | Stack compilation: loads stack config, resolves agents, compiles via Liquid         |
| `src/cli/lib/loading/`                        | YAML/file loading utilities, source resolution                                      |
| `src/cli/lib/resolver.ts`                     | Agent resolution logic                                                              |

**Pipeline flow:**

```
Load source config
  -> Discover skills (skill-plugin-compiler.ts)
  -> Load agent definitions (agents/)
  -> Resolve agent-to-skill mappings (resolver.ts)
  -> Compile agents via Liquid templates (compiler.ts)
  -> Validate compiled output (output-validator.ts)
  -> Write to .claude/agents/ and .claude/skills/
```

**Document for compilation:**

- Input files and their schemas
- Transformation steps with file references
- Output file structure
- Validation rules applied

---

### 4. Test Infrastructure

**What to document:** Test helpers, fixtures, factories, temp directory management.

**Key files:**

| File                                                   | Purpose                                                                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `src/cli/lib/__tests__/helpers.ts`                     | Shared factories: `createMockSkill()`, `createMockAgent()`, `createMockCategory()`, temp dir helpers, `runCliCommand()` |
| `src/cli/lib/__tests__/fixtures/create-test-source.ts` | Integration test source factory: `TestSkill`, `TestAgent`, `TestMatrix`, `TestProjectConfig` interfaces                 |
| `src/cli/lib/__tests__/test-fixtures.ts`               | Named skill fixtures via `getTestSkill()`                                                                               |
| `src/cli/lib/__tests__/test-constants.ts`              | Shared test constants                                                                                                   |

**Factory pattern:**

```typescript
// From src/cli/lib/__tests__/helpers.ts
export function createMockSkill(
  id: SkillId,
  category: CategoryPath,
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return { id, description: `${id} skill`, category, ...overrides };
}
```

**Temp directory pattern:**

```typescript
import { createTempDir, cleanupTempDir } from "../__tests__/helpers.js";

let tempDir: string;
beforeEach(async () => {
  tempDir = await createTempDir();
});
afterEach(async () => {
  await cleanupTempDir(tempDir);
});
```

**Document for test infrastructure:**

- Available factory functions with signatures
- Fixture interfaces and their fields
- Temp directory lifecycle helpers
- How to run tests: `npm test`, `vitest run`

---

### 5. Type System

**What to document:** Branded types, template literal types, boundary casts, typed helpers.

**Key files:**

| File                            | Purpose                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `src/cli/types/matrix.ts`       | `Domain`, `Subcategory`, `ModelName`, `PermissionMode` union types, `SkillAlias` |
| `src/cli/types/skills.ts`       | `SkillId` (template literal), `CategoryPath`, `SkillDisplayName`                 |
| `src/cli/types/agents.ts`       | `AgentName` type                                                                 |
| `src/cli/types/config.ts`       | `CompileConfig`, `ProjectConfig`, `ValidationResult`                             |
| `src/cli/types/index.ts`        | Re-exports all type modules                                                      |
| `src/cli/utils/typed-object.ts` | `typedEntries<K,V>()` and `typedKeys<K>()` -- replaces raw `Object.entries/keys` |
| `src/cli/lib/schemas.ts`        | Zod schemas for all YAML/JSON parse boundaries                                   |

**Template literal types:**

```typescript
// SkillId: 3+ segment format
type SkillId = `${SkillIdPrefix}-${string}-${string}`;

// Domain: finite union
type Domain = "web" | "web-extras" | "api" | "cli" | "mobile" | "shared";
```

**Typed object helpers** (from `src/cli/utils/typed-object.ts`):

```typescript
// Use these instead of Object.entries/Object.keys
import { typedEntries, typedKeys } from "../utils/typed-object.js";

// Preserves key types without boundary casts
const entries = typedEntries(record); // [K, V][] not [string, V][]
```

**Boundary cast rules:**

- Cast only at data entry points (YAML parse, JSON parse, CLI args)
- Every cast MUST have a comment explaining why
- Use Zod schemas at parse boundaries (prefer `safeLoadYamlFile()`)

**Document for type system:**

- Type definitions with their source files
- Where boundary casts are allowed (and must be commented)
- Which helpers replace raw Object methods
- Zod schema locations and usage patterns

---

### 6. Configuration

**What to document:** Config loading, resolution hierarchy, Zod validation at parse boundaries.

**Key files:**

| File                                  | Purpose                                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/cli/lib/configuration/config.ts` | Config loading, merging, resolution, `ResolvedConfig` type                                |
| `src/cli/lib/configuration/index.ts`  | Public API exports                                                                        |
| `src/cli/lib/schemas.ts`              | Zod schemas: `projectConfigLoaderSchema`, `settingsFileSchema`, `marketplaceSchema`, etc. |
| `src/cli/consts.ts`                   | `CLAUDE_DIR`, `CLAUDE_SRC_DIR`, `STANDARD_FILES`, `STANDARD_DIRS`                         |

**Config resolution pattern:**

```
flag > env > project (.claude-src/config.yaml) > global (~/.config/) > default
```

**Zod validation at boundaries:**

```typescript
// Use safeLoadYamlFile for file-based config
import { safeLoadYamlFile } from "./utils/yaml.js";
const data = await safeLoadYamlFile(filePath, projectConfigLoaderSchema);
if (!data) return null;

// Use safeParse for inline validation
const parsed = schema.safeParse(rawData);
if (!parsed.success) {
  warn(`Invalid: ${formatZodErrors(parsed.error.issues)}`);
  return null;
}
```

**Document for configuration:**

- File paths for each config layer
- Schema used at each parse boundary
- Resolution precedence with examples
- Constants used for file/dir names

---

### 7. Ink UI Patterns

**What to document:** Box/Text layout, `useInput` keyboard handling, color and symbol constants.

**Key files:**

| File                                          | Purpose                                                             |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `src/cli/consts.ts`                           | `CLI_COLORS`, `UI_SYMBOLS`, `UI_LAYOUT`, `SCROLL_VIEWPORT`          |
| `src/cli/components/wizard/category-grid.tsx` | Complex Ink component with virtual scroll, keyboard navigation      |
| `src/cli/components/wizard/wizard-layout.tsx` | Layout wrapper with padding, dimensions                             |
| `src/cli/components/hooks/`                   | Custom hooks: `use-virtual-scroll.ts`, `use-terminal-dimensions.ts` |

**Component pattern:**

```tsx
// Named export, no default export
// From src/cli/components/wizard/category-grid.tsx
import React from "react";
import { Box, Text } from "ink";
import { CLI_COLORS, UI_SYMBOLS } from "../../consts.js";

export type CategoryGridProps = {
  categories: CategoryRow[];
  onToggle: (categoryId: Subcategory, technologyId: SkillId) => void;
  availableHeight?: number;
};

export const CategoryGrid: React.FC<CategoryGridProps> = ({ categories, onToggle }) => {
  // useInput for keyboard handling
  // Box/Text for layout (no DOM, no CSS)
  return (
    <Box flexDirection="column">
      <Text color={CLI_COLORS.PRIMARY}>Category Name</Text>
    </Box>
  );
};
```

**Color constants** (from `src/cli/consts.ts:171-180`):

```typescript
export const CLI_COLORS = {
  PRIMARY: "cyan",
  SUCCESS: "green",
  ERROR: "red",
  WARNING: "yellow",
  INFO: "blue",
  NEUTRAL: "gray",
  FOCUS: "cyan",
  UNFOCUSED: "white",
} as const;
```

**Symbol constants** (from `src/cli/consts.ts:93-106`):

```typescript
export const UI_SYMBOLS = {
  CHECKBOX_CHECKED: "[x]",
  CHECKBOX_UNCHECKED: "[ ]",
  CHEVRON: "\u276F",
  SELECTED: "\u2713",
  UNSELECTED: "\u25CB",
  CURRENT: "\u25CF",
  SCROLL_UP: "\u25B2",
  SCROLL_DOWN: "\u25BC",
  // ...
} as const;
```

**Document for Ink UI:**

- Component tree with parent-child relationships
- Props types exported alongside components
- Keyboard bindings per component (`useInput` handlers)
- Color and symbol constant usage (never hardcode values)

---

## Auggie MCP Verification

**Note:** Auggie MCP is project-specific. If your project doesn't have Auggie, use Glob/Grep/Read tools for verification instead.

### Purpose

The Auggie MCP server (`mcp__auggie-context__query_codebase`) provides deep codebase understanding for documentation verification. Use it to discover undocumented features, verify documentation accuracy, and find relationships that grep/glob would miss.

### When to Use Auggie

| Task                        | Auggie Query Example                               |
| --------------------------- | -------------------------------------------------- |
| Verify store methods        | "What actions does the wizard store have?"         |
| Discover command patterns   | "List all oclif commands with their file paths"    |
| Verify compilation pipeline | "What steps does the compilation pipeline follow?" |
| Find architectural patterns | "How does {feature} work architecturally?"         |
| Discover undocumented areas | "What features exist that aren't documented?"      |
| Find common pitfalls        | "What anti-patterns exist in {area}?"              |

### Verification Workflow

```
For each documentation file:
1. Read the document
2. Query Auggie to verify claims
3. Compare Auggie response with documented content
4. Note discrepancies
5. Update documentation
6. Query Auggie for missing content
```

### Workspace Root

Always use: `workspace_root: "/path/to/your/project"`

### Example Queries

```
# Verify store API documentation
"What are all the actions and state fields of the wizard store?"

# Discover undocumented flows
"What user flows exist in the wizard initialization feature?"

# Find anti-patterns
"What common mistakes are made when working with the compilation pipeline?"

# Verify component relationships
"What components depend on useWizardStore and how do they access it?"
```

---

## Why AI Agents Need Different Documentation

### AI Cognitive Characteristics

AI agents process documentation fundamentally differently than humans:

| Characteristic             | AI Agent                               | Human                   |
| -------------------------- | -------------------------------------- | ----------------------- |
| **Context Window**         | Limited tokens (~100-200k)             | Unlimited memory access |
| **Reading Style**          | Pattern matching, keyword extraction   | Narrative comprehension |
| **Preferred Format**       | Tables, lists, code blocks             | Prose, tutorials        |
| **Information Preference** | Explicit, concrete, absolute paths     | Implicit, contextual    |
| **Disambiguation**         | Requires consistent terminology        | Can infer from context  |
| **Navigation**             | Heading hierarchy, structured sections | Scanning, browsing      |

### What AI Agents Need from Documentation

AI agents need answers to:

| Question                         | What AI Needs                                            |
| -------------------------------- | -------------------------------------------------------- |
| "Where is the file for X?"       | Absolute file path: `/src/lib/batch/store/BatchStore.ts` |
| "What happens when user does Y?" | Step-by-step flow with file:line references              |
| "How do these relate?"           | Dependency diagram or table                              |
| "Which files for task Z?"        | Ordered list of files to modify                          |

### What AI Agents Do NOT Need

- **Tutorials** - AI doesn't learn, it executes
- **Motivation** - AI doesn't need to understand WHY architecturally
- **History** - AI doesn't care how we got here
- **Best practices theory** - AI needs concrete patterns, not principles

### The Explicit Over Implicit Rule

**AI cannot infer. AI requires explicit information.**

```markdown
BAD (implicit):
"The store handles authentication"

GOOD (explicit):
"AuthStore at `/src/lib/auth/store/AuthStore.ts` handles authentication via:

- `login(email, password)` - Firebase authentication
- `logout()` - Clears session and redirects to `/login`"
```

---

## prompt-bible Alignment

This documentation system implements proven prompt engineering techniques from the canonical prompt-bible.

**Reference:** `docs/standards/content/prompt-bible.md`

**Key techniques applied to documentation:**

| Technique                    | Application to Documentation                    |
| ---------------------------- | ----------------------------------------------- |
| **Self-Reminder Loops**      | Every doc starts with "DISPLAY CORE PRINCIPLES" |
| **Emphatic Repetition**      | Critical rules at TOP and BOTTOM of documents   |
| **XML Semantic Boundaries**  | Use XML tags for structured sections            |
| **Investigation-First**      | Never document code you haven't read            |
| **Write Verification**       | Re-read files after writing to verify changes   |
| **Positive Framing**         | "You MUST" instead of "Don't"                   |
| **Self-Correction Triggers** | Table of "If you notice X, stop and do Y"       |

**See prompt-bible.md for complete technique descriptions and evidence.**

---

## AI Processing Guidelines

### How AI Should Read This Documentation

```
Documentation Loading Decision Tree (V2):

Need to work on a feature?
|
+-> Load llms.txt FIRST (quick orientation)
|
+-> Searching by keyword/concept?
|     +-> Load CONCEPTS.md
|
+-> Common task (add panel, fix bug)?
|     +-> Load _quick/[task].md
|
+-> Need feature deep dive?
|     +-> Load features/[name]/README.md
|     +-> Then flows/[relevant-flow].md
|     +-> Reference skill: [pattern-skill]
|
+-> Need to understand architecture?
|     +-> Load 01-architecture-overview.md
|     +-> Check _decisions/ for WHY choices were made
|
+-> Need to update documentation?
      +-> Load documentation-bible.md (this file)
```

### Formatting Preferences for AI

**Tables > Prose**

```markdown
GOOD (table - AI can extract structured data):
| File | Purpose |
|------|---------|
| `/src/lib/batch/store/BatchStore.ts` | Main store |

BAD (prose - harder to parse):
The BatchStore is located in the batch lib directory in the store folder.
```

**Code Blocks > Descriptions**

````markdown
GOOD (code block - exact pattern):

```typescript
const { batchStore } = useStores();
batchStore.addItems(files);
```
````

BAD (description):
You access the batch store through useStores and call addItems.

````

**Absolute Paths > Relative References**
```markdown
GOOD: `/src/lib/batch/store/BatchStore.ts`
BAD: "the batch store file"
BAD: `./store/BatchStore.ts`
````

**Consistent Terminology**

```markdown
GOOD (consistent):

- "BatchStore" (always)
- "batch feature" (always)

BAD (inconsistent):

- "BatchStore" / "batch store" / "the store"
- "batch feature" / "batch mode" / "bulk processing"
```

### Heading Hierarchy for Navigation

AI uses headings to navigate. Follow this hierarchy:

```markdown
# Document Title (H1 - one per document)

## Major Section (H2 - navigation target)

### Subsection (H3 - detail level)

#### Minor detail (H4 - rarely used)
```

---

## Progressive Loading Strategy

### The Problem

AI agents have limited context windows. Loading unnecessary documentation wastes tokens.

### The Principle

**Load documentation progressively - start with llms.txt, then feature overview, then specific docs.**

Only load what you need for the current task. Don't pre-load everything.

### Loading Tiers (V2 Updated)

| Tier         | What to Load                       | When                             |
| ------------ | ---------------------------------- | -------------------------------- |
| **Tier 0**   | llms.txt                           | ALWAYS first - quick orientation |
| **Tier 0.5** | CONCEPTS.md                        | When searching by keyword        |
| **Tier 1**   | \_quick/\*.md                      | For common tasks                 |
| **Tier 2**   | features/[name]/README.md          | When working on a feature        |
| **Tier 3**   | flows/[flow].md or COMMON-TASKS.md | For specific task                |
| **Tier 4**   | STORE-API.md or FILE-MAP.md        | When need full reference         |
| **Tier 5**   | \_decisions/\*.md                  | When need to understand WHY      |

### Cross-Reference Instead of Duplicate

**Rule:** If information exists elsewhere, cross-reference it.

```markdown
GOOD (cross-reference):

## For HOW Patterns

- Zustand patterns: `skill: web/state/zustand`
- CLI framework: `skill: cli/framework/oclif-ink`

BAD (duplication):

## Zustand Patterns

[Duplicates 500 lines from skill file]
```

### Decision: When to Load What

```
Task: "Add new background option to batch"

Load Order:
1. llms.txt                           # Quick orientation
2. _quick/add-background-option.md    # Direct file list (if exists)
3. features/batch/README.md           # Understand architecture
4. features/batch/flows/backgrounds-flow.md  # Specific flow
5. Reference skill: frontend-mobx-state-work  # HOW patterns

NOT Needed:
- features/batch/STORE-API.md (full API not needed for this task)
- features/batch/flows/export-flow.md (different flow)
- documentation-bible.md (not updating docs)
```

---

## Core Separation Principle

```
.claude/skills/  =  HOW to code (patterns, conventions, standards)
.claude/docs/    =  WHERE to code (feature locations, file maps, flows)
```

### Skills (HOW)

Skills document:

- Coding patterns (Zustand, oclif, Ink, testing)
- Conventions (naming, file structure)
- Best practices specific to this codebase
- Anti-patterns to avoid

**Location:** `/.claude/skills/`

**Example skills:**

- `cli/framework/oclif-ink` - oclif command and Ink component patterns
- `web/state/zustand` - Zustand state management patterns
- `cli/testing/vitest` - Testing patterns for the CLI

### AI-Docs (WHERE)

AI-docs document:

- Feature locations and file maps
- User flows (what happens when...)
- Store API references
- Common modification tasks
- Component relationships

**Location:** `.claude/docs/`

### The Connection

When an agent needs to modify a feature:

1. Load the feature's `.claude/docs/` to know WHERE files are
2. Reference `.claude/skills/` to know HOW to write code

**You MUST NOT duplicate HOW patterns in .claude/docs** - cross-reference skills instead.

---

## Documentation Types and Tiers

### Tier 0: Ultra-Light Entry (llms.txt)

**Purpose:** Quick orientation and navigation entry point

**Location:** `.ai-docs/llms.txt`

**Content:**

- Quick start (3 lines)
- Core entry points table
- Documentation links
- Concept lookup link

**When to update:** New feature added, routes changed

---

### Tier 0.5: Semantic Discovery (CONCEPTS.md)

**Purpose:** Find docs by keyword/alias

**Location:** `.ai-docs/CONCEPTS.md`

**Content:**

- Feature concepts with aliases
- UI component mappings
- Store concept lookups
- Common tasks to \_quick/ docs

**When to update:** New concepts added, terminology changed

---

### Tier 1: Task Micro-Entries (\_quick/\*.md)

**Purpose:** Ultra-focused task guides

**Location:** `.ai-docs/_quick/`

**Content:**

- Files to modify (ordered)
- Reference docs links

**When to update:** File paths change, new common tasks identified

---

### Tier 2: Feature Overview (README.md)

**Purpose:** Quick orientation for a feature

**Location:** `.ai-docs/features/[feature]/README.md`

**Content:**

- Quick reference table (route, entry, store, directory)
- Architecture diagram (Component -> Store -> Engine)
- Documentation index for the feature
- Store dependencies table
- Key files listing
- E2E test coverage
- Skills cross-references

**Format:** Tables for quick lookup, diagrams for relationships

---

### Tier 3: File Maps (FILE-MAP.md)

**Purpose:** Answer "where is the file for X?"

**Location:** `.ai-docs/features/[feature]/FILE-MAP.md`

**Content:**

- Every file in the feature with purpose
- Hash column for change detection
- Test coverage per file
- Organized by category (Routes, Containers, Store, Components)
- Related files column
- Type exports documentation
- Import dependency graph

**Format:** Tables organized by category with hash verification

---

### Tier 4: Flow Documentation (flows/\*.md)

**Purpose:** Answer "what happens when user does X?"

**Location:** `.ai-docs/features/[feature]/flows/[flow-name].md`

**Content:**

- Quick reference (route, entry, store)
- Files to modify table
- Step-by-step user journey (collapsible)
- State properties involved
- E2E test coverage
- Test IDs table

**Format:** Tiered - quick reference at top, details in collapsible sections

---

### Tier 5: API Reference (STORE-API.md)

**Purpose:** Complete method/function documentation

**Location:** `.ai-docs/features/[feature]/STORE-API.md`

**Content:**

- Constructor dependencies
- Observable properties
- Computed properties
- All methods with:
  - Signature
  - Parameters
  - Return type
  - Behavior description
  - Paywall/permission notes
- View properties (from engine)
- Type exports

**Format:** API documentation style with code examples

---

### Tier 6: Task Guides (COMMON-TASKS.md)

**Purpose:** Answer "how do I add/modify X?"

**Location:** `.ai-docs/features/[feature]/COMMON-TASKS.md`

**Content:**

- Common modifications as tasks
- Files to modify per task (ordered steps)
- Pattern examples (code snippets)
- Quick reference key files table

**Format:** Task -> Steps -> Files table with code examples

---

### Tier 7: Architecture Decisions (\_decisions/\*.md)

**Purpose:** Document WHY decisions were made

**Location:** `.ai-docs/_decisions/`

**Content:**

- Status (Accepted, Deprecated, etc.)
- Context (problem being solved)
- Decision (what was chosen)
- Consequences (easier/harder)
- DO NOT section (anti-patterns)

**Format:** ADR format with explicit guardrails

---

## Directory Structure Standard

```
.ai-docs/
  llms.txt                        # V2: Entry point with navigation
  CONCEPTS.md                     # V2: Semantic discovery layer
  INDEX.md                        # Navigation index
  documentation-bible.md          # THIS FILE - standards
  PROGRESS.md                     # Session tracking
  PITFALLS.md                     # Common anti-patterns (global)

  _quick/                         # V2: Task micro-entries
    add-panel.md
    add-background-option.md
    add-placement-preset.md
    fix-export-bug.md
    add-paywall-check.md

  _decisions/                     # V2: Architecture Decision Records
    000-template.md
    001-engine-delegation.md
    002-store-dependencies.md

  _session/                       # V2: Claude working memory
    .gitignore
    README.md

  _archive/                       # Deprecated docs

  01-architecture-overview.md     # Core docs
  02-directory-structure.md
  ...

  features/
    [feature-name]/
      README.md                   # Feature overview (Tier 2)
      FILE-MAP.md                 # File listing with hashes (Tier 3)
      STORE-API.md                # Store API reference (Tier 5)
      COMMON-TASKS.md             # Modification guide (Tier 6)
      PITFALLS.md                 # Feature-specific anti-patterns
      flows/
        [flow-name].md            # User journey docs (Tier 4)
```

### File Naming

- All lowercase with hyphens: `upload-flow.md`, `FILE-MAP.md`
- Feature directories: lowercase with hyphens: `batch/`, `brand-kit/`
- Standard file names: `README.md`, `FILE-MAP.md`, `STORE-API.md`, `COMMON-TASKS.md`, `PITFALLS.md`
- Flow files: `[action]-flow.md` (e.g., `upload-flow.md`, `export-flow.md`)
- Quick files: `[verb]-[noun].md` (e.g., `add-panel.md`, `fix-export-bug.md`)
- Decision files: `[number]-[topic].md` (e.g., `001-engine-delegation.md`)

---

## Templates

### prompt-bible Techniques Used in Templates

All templates implement:

- **Self-reminder at top** - Core principles display instruction
- **Tables for AI parsing** - Structured data extraction
- **Explicit paths** - No ambiguous references
- **Collapsible details** - Progressive disclosure
- **Critical reminders at bottom** - Emphatic repetition

---

### Template: llms.txt

```markdown
# [Project Name] - AI Documentation

> AI-optimized documentation for [project]. Start here to understand
> where to find code and documentation for any feature.

## Quick Start

For [feature] work, load: `features/[feature]/README.md`
For architecture questions, load: `01-architecture-overview.md`
For coding patterns, use: `skill: cli/framework/oclif-ink`
For finding docs by keyword, load: `CONCEPTS.md`

## Core Entry Points

| Feature   | Route      | Store               | Entry Point     |
| --------- | ---------- | ------------------- | --------------- |
| [Feature] | `/[route]` | `[Feature]Store.ts` | `[Feature].tsx` |

## Documentation

- [Feature Name](./features/[feature]/README.md): Description
- [Architecture](./01-architecture-overview.md): System design
- [Routing](./04-routing-system.md): Router setup
- [Stores](./05-mobx-stores.md): State management

## Concept Lookup

See [CONCEPTS.md](./CONCEPTS.md) for finding docs by keyword/alias.

## Optional (Deep Dives)

- [Store API](./features/[feature]/STORE-API.md): Full method reference
- [File Map](./features/[feature]/FILE-MAP.md): All files with purposes
```

---

### Template: CONCEPTS.md

```markdown
# Concept Index

> **Purpose**: Semantic discovery layer for AI documentation.
> Use this to find documentation by concept, keyword, or alias.
> If you're looking for something and don't know the exact term, check here first.

**Last Updated:** [YYYY-MM-DD]

---

## [Feature] Concepts

| Concept       | Aliases / Keywords     | Primary Doc       | Store Method       |
| ------------- | ---------------------- | ----------------- | ------------------ |
| **[Concept]** | alias1, alias2, alias3 | `flows/[flow].md` | `store.[method]()` |

---

## UI Component Concepts

| Concept         | Aliases        | Component       | File               |
| --------------- | -------------- | --------------- | ------------------ |
| **[Component]** | alias1, alias2 | `ComponentName` | `path/to/file.tsx` |

---

## Store Concepts

| Concept     | Aliases        | Store       | Purpose     | Key Methods              |
| ----------- | -------------- | ----------- | ----------- | ------------------------ |
| **[Store]** | alias1, alias2 | `StoreName` | Description | `method1()`, `method2()` |

---

## Common Tasks -> Quick Docs

| Task               | Keywords           | Quick Doc          | Primary Files |
| ------------------ | ------------------ | ------------------ | ------------- |
| [Task description] | keyword1, keyword2 | `_quick/[task].md` | Key files     |

---

## CRITICAL REMINDERS

**(Update this file when new concepts are added)**

**(Verify links when documentation structure changes)**
```

---

### Template: \_quick/\*.md

```markdown
# Quick: [Task Name]

## Files to Modify (in order)

1. **[Purpose]**: `/path/to/file.ts`
   - What to change

2. **[Purpose]**: `/path/to/file.tsx`
   - What to change

3. **[Purpose]**: `/path/to/file.ts`
   - What to change

## Reference Docs

- Full details: `features/[name]/[doc].md`
- Patterns: `skill: [skill-name]`
```

---

### Template: PITFALLS.md

````markdown
# Common Pitfalls - [Feature/Area]

> Anti-patterns and mistakes to avoid. These patterns cause bugs that would be caught in code review.

**Last Updated:** [YYYY-MM-DD]

---

## [Category Name]

### [Pitfall Name]

**Severity:** CRITICAL | HIGH | MEDIUM

**WRONG:**

```[language]
// Anti-pattern code with explanation
```
````

**CORRECT:**

```[language]
// Correct pattern with explanation
```

**Why:** Explanation of why the anti-pattern causes problems.

**Related:** ADR-XXX, flow-doc.md

---

## CRITICAL REMINDERS

**(Check PITFALLS.md before implementing features in this area)**

**(Add new pitfalls when code review catches recurring issues)**

````

---

### Template: _decisions/*.md

```markdown
# ADR-XXX: [Title]

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Context

[What is the issue that motivates this decision?]

## Decision

[What is the change being proposed/made?]

## Consequences

### Easier
- [What becomes easier]

### Harder
- [What becomes harder]

## DO NOT

- **DO NOT [anti-pattern 1]**
  - Explanation

- **DO NOT [anti-pattern 2]**
  - Explanation

## Related Files

- **File**: `/path/to/file.ts`
````

---

### Template: Feature README.md

```markdown
# [Feature Name] Feature

> **CORE PRINCIPLES:** Investigation first, AI-centric focus, path verification, prompt-bible alignment, write verification.

## Quick Reference

| Property            | Value                                         |
| ------------------- | --------------------------------------------- |
| **Route**           | `/[route]`                                    |
| **Entry Component** | `/src/routes/[route].lazy.tsx`                |
| **Main Container**  | `/src/lib/[feature]/containers/[Feature].tsx` |
| **Store**           | `/src/lib/[feature]/store/[Feature]Store.ts`  |
| **Directory**       | `/src/lib/[feature]/`                         |
| **E2E Tests**       | `/e2e/tests/[feature]/`                       |
| **Components**      | [X] `.tsx` files                              |
| **Flow Docs**       | [X] documented flows                          |
| **Last Verified**   | [YYYY-MM-DD]                                  |

---

## Documentation Index

| Document                             | Purpose                                  |
| ------------------------------------ | ---------------------------------------- |
| [README.md](./README.md)             | Overview, architecture, key files        |
| [FILE-MAP.md](./FILE-MAP.md)         | Complete file listing with purposes      |
| [STORE-API.md](./STORE-API.md)       | [Feature]Store API reference             |
| [COMMON-TASKS.md](./COMMON-TASKS.md) | Quick reference for common modifications |

### Flow Documentation

| Flow        | File                                 | Description |
| ----------- | ------------------------------------ | ----------- |
| [Flow Name] | [flow-name.md](./flows/flow-name.md) | Description |

---

## Architecture

### High-Level Component Tree
```

/[route] route
|
v
+------------------+
| [route].lazy.tsx | Route component
+------------------+
|
v
+------------------+
| [Feature].tsx | Main container
+------------------+
|
+---> [Components...]

```

### Data Flow

```

+----------------+ +----------------+ +------------------+
| UI Component | --> | [Feature]Store | --> | [External System] |
| | | | | |
+----------------+ +----------------+ +------------------+
^ |
| v
+------------- state <-------------- update

```

---

## Store Dependencies

| Store | Purpose | Key Methods |
|-------|---------|-------------|
| `[Feature]Store` | Main operations | `method1()`, `method2()` |
| `OtherStore` | Supporting functionality | `method()` |

---

## Key Files

### Routes

| File | Purpose |
|------|---------|
| `/src/routes/[route].tsx` | Route definition |
| `/src/routes/[route].lazy.tsx` | Lazy-loaded route component |

### Core

| File | Purpose |
|------|---------|
| `/src/lib/[feature]/containers/[Feature].tsx` | Main container |
| `/src/lib/[feature]/store/[Feature]Store.ts` | State store |

---

## For HOW-TO Patterns

Cross-reference skills for implementation patterns:

- CLI framework: `skill: cli/framework/oclif-ink`
- Zustand state: `skill: web/state/zustand`
- Testing patterns: `skill: cli/testing/vitest`

---

## E2E Test Files

| Test File | Coverage | Flow Doc |
|-----------|----------|----------|
| `[feature]-[area].e2e.ts` | Description | [flow.md](./flows/flow.md) |

---

## CRITICAL REMINDERS

**(You MUST verify all file paths exist before using this documentation)**

**(You MUST cross-reference skills for HOW patterns - do not duplicate)**

**(You MUST update this README if architecture changes)**
```

---

### Template: FILE-MAP.md

````markdown
# [Feature] File Map

> **CORE PRINCIPLES:** Investigation first, AI-centric focus, path verification.

Every file in `/src/lib/[feature]/` with purpose and test coverage.

**Last Verified:** [YYYY-MM-DD]

---

## Hash Verification

**Purpose:** Track file changes between documentation updates.

**How to regenerate a hash:**

```bash
git hash-object <file> | cut -c1-6
```
````

**Workflow:**

1. Run: `git hash-object <path> | cut -c1-6`
2. Compare with documented Hash
3. If differs: mark Verified as `?` and investigate
4. Update docs and hash when current

---

## Routes

| File                      | Purpose          | Hash     | Related            | Tests | Verified |
| ------------------------- | ---------------- | -------- | ------------------ | ----- | -------- |
| `/src/routes/[route].tsx` | Route definition | `a3f2c1` | `[route].lazy.tsx` | -     | Y        |

---

## Containers

| File                                          | Purpose        | Hash     | Related          | Tests         | Verified |
| --------------------------------------------- | -------------- | -------- | ---------------- | ------------- | -------- |
| `/src/lib/[feature]/containers/[Feature].tsx` | Main container | `b4e5d2` | `[Feature]Store` | All E2E tests | Y        |

---

## Store

| File                                         | Purpose    | Hash     | Related         | Tests         | Verified |
| -------------------------------------------- | ---------- | -------- | --------------- | ------------- | -------- |
| `/src/lib/[feature]/store/[Feature]Store.ts` | MobX store | `c5f6e3` | Dependencies... | All E2E tests | Y        |

See [STORE-API.md](./STORE-API.md) for complete API reference.

---

## Components - [Category]

| File                                            | Purpose     | Hash     | Related       | Tests              | Verified |
| ----------------------------------------------- | ----------- | -------- | ------------- | ------------------ | -------- |
| `/src/lib/[feature]/components/[Component].tsx` | Description | `d6g7f4` | Related files | `test-file.e2e.ts` | Y        |

---

## E2E Test Files

| Test File                                      | Hash     | Components Covered | Verified |
| ---------------------------------------------- | -------- | ------------------ | -------- |
| `/e2e/tests/[feature]/[feature]-[area].e2e.ts` | `e7h8g5` | Components tested  | Y        |

---

## CRITICAL REMINDERS

**(Every file path in this document MUST be verified to exist)**

**(Update the Hash column when files change)**

**(Update the Verified column when paths and hashes are confirmed)**

**(Add new files when they are created)**

````

---

### Template: Flow Document (flows/*.md)

```markdown
# Flow: [Flow Name]

> **CORE PRINCIPLES:** Investigation first, AI-centric focus, path verification.

## Quick Reference

| Property | Value |
|----------|-------|
| **Route** | `/[route]` |
| **Entry** | `[Component]` or `[Store.method()]` |
| **Store** | `[Feature]Store.[method]()` |
| **Key Files** | [X] |
| **Last Verified** | [YYYY-MM-DD] |

## Files to Modify

| Task | File | Verified |
|------|------|----------|
| Change [X] UI | `/src/lib/[feature]/components/[Component].tsx` | Y |
| Change [X] logic | `/src/lib/[feature]/store/[Feature]Store.ts` (see `[method]`) | Y |
| Add [X] | `/src/lib/[feature]/components/[NewComponent].tsx` | Y |

---

## Flow

<details>
<summary>Step-by-step (click to expand)</summary>

### Step 1: [Entry Point]

1. User [action]
2. Component renders...
3. Store method called...

### Step 2: [Processing]

```typescript
// Key code snippet showing the pattern
method = () => {
  // Step by step what happens
}
````

### Step 3: [Completion]

1. State updates
2. UI re-renders
3. Notification shown

</details>

---

## State

| Property         | Description                   |
| ---------------- | ----------------------------- |
| `store.property` | Description of what it tracks |

---

## E2E Test Coverage

From `/e2e/tests/[feature]/[feature]-[area].e2e.ts`:

- Test case 1
- Test case 2
- Test case 3

---

## Test IDs

| Test ID     | Element     |
| ----------- | ----------- |
| `test-id-1` | Description |
| `test-id-2` | Description |

---

## CRITICAL REMINDERS

**(All file paths MUST be verified to exist)**

**(Update "Last Verified" when documentation is validated)**

**(Cross-reference skills for HOW patterns)**

````

---

### Template: STORE-API.md

```markdown
# [Feature]Store API Reference

> **CORE PRINCIPLES:** Investigation first, AI-centric focus, path verification.

Complete API reference for `/src/lib/[feature]/store/[Feature]Store.ts`

**Last Verified:** [YYYY-MM-DD]

---

## Constructor Dependencies

```typescript
type [Feature]StoreDependencies = {
  store1: Store1;
  store2: Store2;
  // ...
};
````

---

## Observable Properties

| Property    | Type       | Description | Verified |
| ----------- | ---------- | ----------- | -------- |
| `property1` | `boolean`  | Description | Y        |
| `property2` | `string[]` | Description | Y        |

---

## Computed Properties

| Property    | Type      | Description | Verified |
| ----------- | --------- | ----------- | -------- |
| `computed1` | `boolean` | Returns X   | Y        |

---

## Methods

### [Category Name]

#### `methodName(params)`

Description of what this method does.

```typescript
methodName = (param: Type) => ReturnType;

type ParamType = {
  field: string;
};
```

**Behavior:**

1. Step 1
2. Step 2
3. Step 3

**Paywall:** [If applicable] Requires Pro subscription.

**Verified:** Y

---

## View Properties (from Engine)

Accessed via `store.view`:

| Property            | Type      | Description      | Verified |
| ------------------- | --------- | ---------------- | -------- |
| `view.items`        | `Item[]`  | All items        | Y        |
| `view.isProcessing` | `boolean` | Processing state | Y        |

---

## Type Exports

```typescript
export type ExportedType = {
  field: string;
};
```

---

## CRITICAL REMINDERS

**(All methods MUST match actual code signatures)**

**(Update "Last Verified" when API is validated)**

**(Note breaking changes when API changes)**

````

---

### Template: COMMON-TASKS.md

```markdown
# Common Tasks - [Feature] Feature

> **CORE PRINCIPLES:** Investigation first, AI-centric focus, path verification.

Quick reference for common modifications to the [feature] feature.

**Last Verified:** [YYYY-MM-DD]

---

## [Task Category]

**Example:** [Specific example]

### Files to Modify

| Step | File | Change | Verified |
|------|------|--------|----------|
| 1 | `/path/to/file.ts` | Add X to enum | Y |
| 2 | `/path/to/component.tsx` | Add UI element | Y |
| 3 | `/path/to/store.ts` | Add method if needed | Y |
| 4 | `/e2e/tests/[feature]/test.e2e.ts` | Add E2E test | Y |

### Pattern

```typescript
// Example code showing the pattern
````

---

## Quick Reference: Key Files

| Area           | Primary File                                  | Verified |
| -------------- | --------------------------------------------- | -------- |
| Store logic    | `/src/lib/[feature]/store/[Feature]Store.ts`  | Y        |
| Main container | `/src/lib/[feature]/containers/[Feature].tsx` | Y        |
| E2E tests      | `/e2e/tests/[feature]/*.e2e.ts`               | Y        |

---

## For HOW Patterns

Cross-reference skills:

- CLI framework: `skill: cli/framework/oclif-ink`
- Zustand state: `skill: web/state/zustand`
- Testing patterns: `skill: cli/testing/vitest`

---

## CRITICAL REMINDERS

**(All file paths MUST be verified to exist)**

**(Follow patterns from skills, not from this document)**

**(Update tasks when common modifications change)**

`````

---

## CLI-Specific Templates

### Template: Store/State Map (Zustand)

**Purpose:** Document Zustand store architecture for agents that need to modify wizard state or understand data flow.

````markdown
# Store Map: [Store Name]

**Last Updated:** [date]
**File:** `src/cli/stores/wizard-store.ts`

## State Management

**Library:** Zustand (via `create<WizardState>()`)
**Pattern:** Single store with actions and getters as properties
**Access:** `useWizardStore()` selector hook (no provider needed)

## State Fields

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `step` | `WizardStep` | `"stack"` | Current wizard step |
| `approach` | `"stack" \| "scratch" \| null` | `null` | User's selection approach |

## Actions

| Action | Signature | Mutates | Purpose |
|--------|-----------|---------|---------|
| `setStep` | `(step: WizardStep) => void` | `step` | Navigate between wizard steps |
| `toggleSkill` | `(domain, subcat, skillId) => void` | `domainSelections` | Toggle skill selection |

## Usage Pattern

```typescript
// In Ink components -- use selectors for performance
import { useWizardStore } from "../../stores/wizard-store.js";

const step = useWizardStore((s) => s.step);
const setStep = useWizardStore((s) => s.setStep);

// Or destructure the full store (less common)
const store = useWizardStore();
store.toggleSkill(domain, subcat, skillId);
`````

**Example files using this pattern:**

- `src/cli/components/wizard/wizard.tsx:62`
- `src/cli/components/wizard/step-build.tsx`
- `src/cli/components/wizard/step-stack.tsx`

`````

---

### Template: Feature Map (Compilation Pipeline)

**Purpose:** Document feature boundaries, entry points, and data flow through the compilation pipeline.

````markdown
# Feature Map: Compilation Pipeline

**Last Updated:** [date]

## Overview

**Purpose:** Compile agent source files + skill content into standalone agent markdown files
**Entry Point:** `src/cli/commands/compile.ts` (oclif command)
**Output:** `.claude/agents/*.md` and `.claude/skills/*/`

## File Structure

```
src/cli/lib/
├── compiler.ts                  # Liquid template engine, agent assembly
├── resolver.ts                  # Agent-to-skill mapping resolution
├── loading/                     # File and source loading utilities
├── skills/
│   └── skill-plugin-compiler.ts # SKILL.md + metadata.yaml -> plugin
├── stacks/
│   ├── stacks-loader.ts         # Stack config loading
│   └── stack-plugin-compiler.ts # Stack -> compiled agents
└── plugins/                     # Plugin discovery and manifest generation
```

## Data Flow

1. **Command invoked** -- `compile.ts` parses flags, calls `resolveSource()`
2. **Skills loaded** -- `loadSkillsFromDir()` reads SKILL.md frontmatter
3. **Agents resolved** -- `resolveAgents()` maps agents to skill assignments
4. **Templates compiled** -- `compiler.ts` runs Liquid with sanitized data
5. **Output validated** -- `validateCompiledAgent()` checks required XML tags
6. **Files written** -- Output to `.claude/agents/` and `.claude/skills/`

## Key Dependencies

| Module | Used By | Purpose |
|--------|---------|---------|
| `liquidjs` | `compiler.ts` | Template rendering |
| `remeda` | Multiple | Functional utilities (`pipe`, `uniqueBy`, `filter`) |
| `yaml` | Multiple | YAML parse/stringify |
| `zod` | `schemas.ts` | Runtime validation at parse boundaries |
`````

---

### Template: Component Patterns (Ink Terminal UI)

**Purpose:** Document Ink component conventions so agents produce consistent terminal UI.

````markdown
# Component Patterns: Ink Terminal UI

**Last Updated:** [date]

## File Structure

**Convention:** kebab-case files, named exports only

```
src/cli/components/wizard/
├── category-grid.tsx        # Complex grid with virtual scroll
├── category-grid.test.tsx   # Co-located test
├── wizard-layout.tsx        # Layout wrapper
├── wizard-tabs.tsx          # Tab navigation
└── utils.ts                 # Shared component utilities
```

## Component Definition Pattern

```tsx
// Named export (no default export)
// Props type exported alongside component
import React from "react";
import { Box, Text } from "ink";
import { CLI_COLORS, UI_SYMBOLS } from "../../consts.js";
import type { SkillId, Subcategory } from "../../types/index.js";

export type CategoryGridProps = {
  categories: CategoryRow[];
  onToggle: (categoryId: Subcategory, technologyId: SkillId) => void;
  availableHeight?: number;
};

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  onToggle,
  availableHeight,
}) => {
  return (
    <Box flexDirection="column">
      <Text color={CLI_COLORS.PRIMARY}>Content</Text>
    </Box>
  );
};
```

## Keyboard Input Pattern

```tsx
import { useInput } from "ink";

useInput((input, key) => {
  if (key.upArrow) moveFocus(-1);
  if (key.downArrow) moveFocus(1);
  if (key.return) confirmSelection();
  if (input === "q") exit();
});
```

## Styling Rules

- Use `CLI_COLORS.*` constants from `src/cli/consts.ts` -- never hardcode color strings
- Use `UI_SYMBOLS.*` constants -- never hardcode Unicode symbols
- Use `<Box>` for layout (flexDirection, padding, margin)
- Use `<Text>` for styled text (color, bold, dimColor)
- No CSS, no SCSS, no style objects -- Ink uses props
````

---

### Template: User Flows (Wizard)

**Purpose:** Map how CLI features flow through the codebase, step by step.

````markdown
# User Flow: Wizard Initialization

**User Goal:** Set up skills and agents for a new project

## Flow

1. **User runs `cc init`**
   - Command: `src/cli/commands/init.tsx`
   - Parses flags (source, dry-run, refresh, local)
   - Loads skills matrix via `loadSkillsMatrixFromSource()`

2. **Wizard renders**
   - Component: `src/cli/components/wizard/wizard.tsx`
   - Store initializes: `useWizardStore()` with default state
   - First step: `"stack"` -- user selects a stack or "Start from scratch"

3. **User selects technologies**
   - Step: `"build"` -- `src/cli/components/wizard/step-build.tsx`
   - Component: `CategoryGrid` renders skills by domain/subcategory
   - Store action: `store.toggleSkill(domain, subcat, skillId)`

4. **User customizes sources**
   - Step: `"sources"` -- `src/cli/components/wizard/step-sources.tsx`
   - Source grid shows available marketplaces
   - Store action: `store.setSourceSelection(skillId, sourceId)`

5. **User confirms**
   - Step: `"confirm"` -- wizard calls `onComplete(result)`
   - Result type: `WizardResultV2` with selectedSkills, installMode, etc.
   - Command handles installation based on result

## State Changes

```
Initial:   { step: "stack", approach: null, domainSelections: {} }
After stack: { step: "build", approach: "stack", selectedStack: "react-full" }
After build: { step: "sources", domainSelections: { web: { framework: { ... } } } }
After confirm: onComplete() called with WizardResultV2
```

## Files Involved

- `src/cli/commands/init.tsx` -- command entry point
- `src/cli/components/wizard/wizard.tsx` -- root wizard
- `src/cli/components/wizard/step-*.tsx` -- individual steps
- `src/cli/stores/wizard-store.ts` -- state management
- `src/cli/lib/installation/` -- post-wizard installation logic
````

---

### Template: Anti-Patterns (CLI Codebase)

**Purpose:** Document specific patterns to avoid, with concrete file references and correct alternatives.

````markdown
# Anti-Patterns: CLI Codebase

**Last Updated:** [date]

## Magic Numbers

**What it is:** Using raw numbers instead of named constants.

```typescript
// BAD
process.exit(1);
this.error(message, { exit: 2 });

// GOOD -- use EXIT_CODES from src/cli/lib/exit-codes.ts
import { EXIT_CODES } from "../lib/exit-codes.js";
process.exit(EXIT_CODES.ERROR);
this.error(message, { exit: EXIT_CODES.INVALID_ARGS });
```

## Hardcoded File Names

**What it is:** String literals for standard file names instead of constants.

```typescript
// BAD
const metadataPath = path.join(dir, "metadata.yaml");

// GOOD -- use STANDARD_FILES from src/cli/consts.ts
import { STANDARD_FILES } from "../consts.js";
const metadataPath = path.join(dir, STANDARD_FILES.METADATA_YAML);
```

## Raw Object.entries/Object.keys

**What it is:** Using untyped Object methods that lose key types.

```typescript
// BAD -- key type widens to string
Object.entries(record).forEach(([key, value]) => {
  /* key is string */
});

// GOOD -- preserves key type
import { typedEntries } from "../utils/typed-object.js";
typedEntries(record).forEach(([key, value]) => {
  /* key is K */
});
```

## Default Exports

**What it is:** Using `export default` anywhere except oclif command classes.

```typescript
// BAD -- non-command default export
export default function helper() {}

// GOOD -- named export only
export function helper() {}
```

**Note:** oclif command classes use `export default class` by convention. All other modules use named exports.

## Untyped any

**What it is:** Using `any` without an explicit justification comment.

```typescript
// BAD
const data: any = parseYaml(content);

// GOOD -- Zod schema at boundary
const parsed = schema.safeParse(parseYaml(content));
if (!parsed.success) return null;
```

## console.log in Production

**What it is:** Using `console.log` instead of oclif's `this.log()` or the logger utilities.

```typescript
// BAD
console.log("Loading skills...");

// GOOD -- in commands
this.log(STATUS_MESSAGES.LOADING_SKILLS);

// GOOD -- in library code
import { log, verbose, warn } from "../utils/logger.js";
verbose(`Resolved source path: '${sourcePath}'`);
```
````

---

## Quality Standards

### Investigation-First Protocol

**CRITICAL: Never document code you haven't read.**

Before documenting ANY feature:

1. **Use Glob** to find all relevant files
2. **Read key files completely** - stores, containers, key components
3. **Read E2E tests** to understand user flows
4. **Use Grep** to find patterns and relationships
5. **Verify every file path** exists before documenting

### Path Verification

Every file path in documentation MUST be verified:

```

GOOD: `/src/lib/batch/store/BatchStore.ts` (verified with Read tool)
BAD: `/src/lib/batch/BatchStore.ts` (assumed, not verified)

```

**Verification Status Indicators:**

- Y - Verified - Path confirmed to exist
- ? - Unverified - Path not yet confirmed
- N - Invalid - Path no longer exists

### Method Verification

Every store method documented MUST match actual code:

1. Read the store file
2. Verify method name and signature
3. Verify behavior description matches implementation
4. Note any paywall/permission checks

### E2E Coverage Mapping

Flow documents SHOULD map to E2E test files:

1. Read E2E tests in `/e2e/tests/[feature]/`
2. Identify what each test covers
3. Create flow docs that match test coverage
4. Reference test file in flow doc

---

## CLI Anti-Patterns in Documentation

### Vague Pattern Claims

```markdown
-- BAD: Vague, unverifiable
"The codebase uses Zustand for state management."

-- GOOD: Specific, verifiable
"Wizard state is managed by Zustand in `src/cli/stores/wizard-store.ts`.
The store is created via `create<WizardState>()` and accessed in components
via `useWizardStore()` selectors."
```

### Missing File References

```markdown
-- BAD: No path
"Exit codes are defined as named constants."

-- GOOD: Exact location
"Exit codes are defined in `src/cli/lib/exit-codes.ts` as the `EXIT_CODES` object
with values: SUCCESS (0), ERROR (1), INVALID_ARGS (2), NETWORK_ERROR (3), CANCELLED (4)."
```

### Tutorial-Style Writing

```markdown
-- BAD: Explains how Zustand works
"Zustand is a lightweight state management library. You create a store using
the `create` function, which returns a hook..."

-- GOOD: Documents how THIS codebase uses it
"Store pattern: `create<WizardState>()` with actions as properties.
Access via `useWizardStore()`. No Provider wrapper needed.
File: `src/cli/stores/wizard-store.ts`."
```

### Documenting General Knowledge

```markdown
-- BAD: Documents what oclif is
"oclif is a framework for building CLIs in Node.js. Commands extend a base
class and define flags..."

-- GOOD: Documents this project's oclif patterns
"Commands extend `BaseCommand` from `src/cli/base-command.ts`, which provides
`handleError()`, `logSuccess()`, and `sourceConfig` getter. Base flags include
`--dry-run` and `--source`."
```

### Stale Examples

```markdown
-- BAD: Invented code example
"// Typical command pattern
class MyCommand extends BaseCommand {
async run() { /_ ... _/ }
}"

-- GOOD: Example from actual source
"// From src/cli/commands/compile.ts:1-4
import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command';
import { EXIT_CODES } from '../lib/exit-codes';
```

### Documenting WHY Instead of WHERE/HOW

```markdown
-- BAD: Explains motivation
"We chose Zustand over Redux because it has less boilerplate and integrates
well with React hooks..."

-- GOOD: Documents location and usage
"State: `src/cli/stores/wizard-store.ts` (Zustand)
Pattern: `create<WizardState>()` with inline actions
Access: `useWizardStore()` hook with selectors"
```

---

## Error Handling and Validation

### What to Do If Documentation is Wrong

| Issue                     | Detection                      | Action                        |
| ------------------------- | ------------------------------ | ----------------------------- |
| File path doesn't exist   | Read tool returns error        | Update doc, mark as N         |
| Method signature changed  | Code doesn't match doc         | Update STORE-API.md           |
| Flow description outdated | E2E test shows different steps | Update flow doc               |
| Missing documentation     | Feature exists without docs    | Create docs from scratch      |
| Hash mismatch             | `git hash-object` differs      | Investigate, update if needed |

### Staleness Detection

Documentation includes "Last Verified" dates and hash columns. Review documentation when:

- Hash doesn't match (file was modified)
- Making changes to the feature
- Feature has been modified by others
- Starting work on a feature after time away

### Confidence Indicators

Use these indicators in documentation:

| Indicator | Meaning                      |
| --------- | ---------------------------- |
| Y         | Verified against actual code |
| ?         | Assumed but not verified     |
| N         | Known to be outdated/wrong   |

### Fallback When Documentation is Missing

If documentation doesn't exist for a feature:

1. Check llms.txt for quick orientation
2. Check CONCEPTS.md for related concepts
3. Check INDEX.md for related features
4. Use Glob to find feature directory
5. Read key files: store, main container, route
6. Create documentation following templates

---

## When to Create Documentation

### New Feature Implemented

Create complete feature documentation:

- `features/[feature]/README.md`
- `features/[feature]/FILE-MAP.md`
- `features/[feature]/STORE-API.md` (if has store)
- `features/[feature]/COMMON-TASKS.md`
- `features/[feature]/flows/` for each major user journey

Update V2 navigation:

- Add to `llms.txt` Core Entry Points
- Add concepts to `CONCEPTS.md`
- Create `_quick/` docs for common tasks
- Create `_decisions/` for non-obvious architectural choices

### New User Flow Added

Create flow document:

- `features/[feature]/flows/[flow-name].md`
- Update README.md flow index
- Add to CONCEPTS.md if new concept

### Store API Changed

Update store documentation:

- `features/[feature]/STORE-API.md`
- Update any affected flow docs
- Update CONCEPTS.md if new methods

### Common Task Identified

Add to task guide:

- `features/[feature]/COMMON-TASKS.md`
- Create `_quick/[task].md` if performed frequently

### Files Reorganized

Update file maps:

- `features/[feature]/FILE-MAP.md`
- Update hashes for moved/modified files
- Update any path references in other docs

### New E2E Test Added

- Create flow doc if represents new user journey
- Or update existing flow doc with test reference

### Architectural Decision Made

Create ADR:

- `_decisions/[number]-[topic].md`
- Document context, decision, consequences, DO NOTs

---

## CLI Decision Framework

### When to Document

```
Will this help an AI agent implement features in this codebase?
|-- YES: Document it
|-- NO: Skip it

Is this specific to this codebase or general knowledge?
|-- Specific (file paths, patterns, conventions): Document with references
|-- General (how Zustand works, what oclif is): Skip -- agents already know

Can every claim be verified in the actual code?
|-- YES: Document with file:line references
|-- NO: Do not document (too abstract)

Does this describe WHERE or HOW, not WHY?
|-- WHERE/HOW: Good for documentation
|-- WHY: Skip (that belongs in human docs or architecture decisions)
```

### What to Document Per Area

| Area        | Document                                                   | Skip                   |
| ----------- | ---------------------------------------------------------- | ---------------------- |
| Commands    | Flags, exit codes, error handling, message constants       | General oclif tutorial |
| Wizard      | Step flow, store actions, keyboard bindings, state shape   | React basics           |
| Compilation | Pipeline steps, file I/O, template variables               | How Liquid works       |
| Testing     | Factory signatures, fixture interfaces, temp dir lifecycle | Vitest fundamentals    |
| Types       | Branded types, boundary cast locations, typed helpers      | TypeScript basics      |
| Config      | Resolution precedence, Zod schemas, file paths             | YAML syntax            |
| UI          | Color/symbol constants, Box/Text patterns, useInput        | Ink library docs       |

### What Goes Stale Fast

These areas change frequently and need regular validation:

- **Wizard store** -- new steps, actions, or state fields added with features
- **Compilation pipeline** -- new plugin types, validation rules
- **Type definitions** -- new union members, schema changes
- **Constants** -- new entries in `CLI_COLORS`, `UI_SYMBOLS`, `STANDARD_FILES`

These areas are stable and need less frequent validation:

- **BaseCommand pattern** -- rarely changes
- **Test infrastructure** -- factory signatures are stable
- **Exit code constants** -- additions are rare
- **Error handling pattern** -- established convention

---

## CLI Validation Process

### Step 1: Verify File Paths

Every documented file path must exist. Use `Glob` or `Read` to confirm.

```
For each path referenced in documentation:
  Read the file -> exists?
    YES -> check line references match content
    NO -> remove or update the reference
```

### Step 2: Verify Pattern Claims

If documentation says "all commands use `BaseCommand`", verify:

```
Glob("src/cli/commands/**/*.ts")
Grep("extends BaseCommand", path="src/cli/commands/")
Compare file count vs grep match count
```

### Step 3: Verify Code Examples

Every code example should come from actual source files, not invented patterns. For each example:

1. Identify the source file and approximate lines
2. Read the file to confirm the pattern still exists
3. Update the example if the code has drifted

### Step 4: Check for Undocumented Changes

Search for patterns that may have been added since the documentation was written:

```
Grep("EXIT_CODES\\.", path="src/cli/") -> compare against documented exit codes
Grep("CLI_COLORS\\.", path="src/cli/") -> compare against documented colors
Grep("STANDARD_FILES\\.", path="src/cli/") -> compare against documented file constants
```

### Step 5: Update Documentation Map

After validation, update the documentation map with:

- Status (valid, drifted, invalid)
- Date validated
- Next validation date (7 days for volatile areas, 30 days for stable areas)

---

## Cross-Referencing Skills

### When to Reference Skills

Documentation should reference skills for HOW patterns instead of duplicating:

```markdown
## For HOW-TO Patterns

Cross-reference skills for implementation patterns:

- CLI framework: `skill: cli/framework/oclif-ink`
- Zustand state: `skill: web/state/zustand`
- Testing patterns: `skill: cli/testing/vitest`
- TypeScript types: `skill: cli/types/conventions`
- Configuration: `skill: cli/config/resolution`
```

### Never Duplicate

| Should Be in .ai-docs   | Should Be in Skills  |
| ----------------------- | -------------------- |
| File locations          | Coding patterns      |
| User flows              | Best practices       |
| Store API methods       | Convention standards |
| Component relationships | Anti-patterns        |
| Test IDs                | Testing patterns     |

---

## Self-Correction Triggers

**If you notice yourself doing these, STOP and correct:**

| Trigger                                             | Correction                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Documenting without reading code first              | Stop. Read the actual files.                                                                   |
| Using generic descriptions instead of file paths    | Stop. Replace with specific paths.                                                             |
| Describing patterns based on assumptions            | Stop. Verify with Grep/Glob.                                                                   |
| Skipping the documentation map update               | Stop. Update PROGRESS.md.                                                                      |
| Reporting success without verifying paths exist     | Stop. Use Read to confirm.                                                                     |
| Writing tutorial-style content                      | Stop. Focus on WHERE and HOW, not WHY.                                                         |
| Duplicating skill content                           | Stop. Add cross-reference instead.                                                             |
| Creating docs without tiered structure              | Stop. Use the templates.                                                                       |
| Skipping "Last Verified" date                       | Stop. Add verification date.                                                                   |
| Missing critical reminders section                  | Stop. Add critical reminders at bottom.                                                        |
| Loading documentation-bible.md first                | Stop. Load llms.txt first unless updating docs.                                                |
| ADRs without DO NOT section                         | Stop. Add guardrails.                                                                          |
| Skipping hash updates in FILE-MAP                   | Stop. Update hashes when files change.                                                         |
| Not using Auggie for verification                   | Stop. Use Glob/Grep/Read to verify your documentation claims (or Auggie if available).         |
| Missing PITFALLS for complex features               | Stop. Document common mistakes discovered during review.                                       |
| Documenting store methods without code verification | Stop. Read actual source files (or use Auggie if available) to get accurate method signatures. |

---

## Session Workflow

### Starting a Documentation Session

1. **Display Core Principles** - Always start with principles
2. **Read llms.txt** - Quick orientation
3. **Read CONCEPTS.md** - If searching by keyword
4. **Read PROGRESS.md** - See what's been done
5. **Identify target** - What needs documentation?
6. **Investigate thoroughly** - Glob, Read, Grep

### During Documentation

1. **Use templates** - Don't invent new formats
2. **Verify paths** - Read files to confirm they exist
3. **Cross-reference skills** - Don't duplicate HOW content
4. **Follow tier structure** - llms.txt -> CONCEPTS -> \_quick -> README -> flows -> API -> tasks
5. **Add verification dates** - Mark when verified
6. **Add hashes** - For FILE-MAP entries
7. **Include critical reminders** - At bottom of every doc

### Ending a Documentation Session

1. **Verify all writes** - Re-read files to confirm changes
2. **Update PROGRESS.md** - Log session work
3. **Update llms.txt** - If new features/entry points added
4. **Update CONCEPTS.md** - If new concepts added
5. **Update INDEX.md** - If new docs added
6. **Clear \_session/** - Remove working memory files
7. **Display Core Principles** - End with principles

### Session Progress Format

```markdown
### Session [N] - [DATE]

**Duration:** ~[X] minutes
**Status:** [What was completed]

**Investigation Completed:**

- Read [files...]
- Found [patterns...]
- Verified [paths...]

**Documents Created/Updated:**

- `path/to/doc.md` - Description

**V2 Updates:**

- llms.txt: [updated/unchanged]
- CONCEPTS.md: [updated/unchanged]
- \_quick/: [files added/updated]
- \_decisions/: [ADRs added/updated]

**Verification:**

- All file paths verified to exist
- All flow docs map to E2E tests
- All hashes updated
- README and FILE-MAP aligned
- Critical reminders included
```

---

## Documentation Agent Maintenance

### Daily Tasks

1. **Verify file hashes** in FILE-MAP
   - Run `git hash-object <file> | cut -c1-6` for changed files
   - Mark mismatches as `?` in Verified column
   - Investigate and update docs if needed

2. **Clear `_session/` folder**
   - Remove all files except README.md and .gitignore
   - Start each session with clean working memory

3. **Check llms.txt links**
   - Verify all linked files exist
   - Update if files moved/renamed

### Weekly Tasks

1. **Regenerate `_quick/` files**
   - Check if file paths have changed
   - Verify steps still accurate
   - Add new common tasks if patterns emerged

2. **Update CONCEPTS.md**
   - Add new concepts/aliases discovered
   - Update doc links if changed
   - Add new feature concepts

3. **Review ADRs**
   - Check if any decisions need updating
   - Mark deprecated decisions
   - Add new ADRs for new architectural choices

### On Structure Changes

When files are moved, renamed, or restructured:

1. **Update llms.txt**
   - Update Core Entry Points table
   - Update documentation links

2. **Update INDEX.md**
   - Update all file references
   - Update navigation sections

3. **Update CONCEPTS.md**
   - Update doc links
   - Update file paths in tables

4. **Update \_quick/\*.md**
   - Update all file paths
   - Verify steps still accurate

5. **Update FILE-MAP.md**
   - Update file paths
   - Regenerate hashes
   - Mark as verified

6. **Update flow docs**
   - Update file references
   - Update code snippets if changed

---

## Critical Reminders

**THESE REMINDERS ARE REPEATED AT DOCUMENT END BECAUSE LLMs WEIGHT INFORMATION AT START AND END MORE HEAVILY.**

---

### CRITICAL: Investigation First

**(You MUST read actual code files before documenting - never document based on assumptions)**

**(You MUST verify every file path you document actually exists using Read tool)**

### CRITICAL: Write Verification

**(You MUST re-read files after editing to verify changes were written)**

**(You MUST NOT report success without verification)**

### CRITICAL: Path Verification

**(Every file path MUST be absolute: `/src/lib/batch/store/BatchStore.ts`)**

**(Every file path MUST be verified with Read tool)**

**(Every file path MUST include verification indicator: Y or ?)**

### CRITICAL: Hash Verification

**(FILE-MAP.md MUST include Hash column with 6-char git hash)**

**(Update hashes when files are modified)**

**(Mark Verified as ? when hash doesn't match)**

### CRITICAL: Progressive Loading (V2)

**(You MUST load llms.txt FIRST for quick orientation)**

**(You MUST use CONCEPTS.md for keyword/alias lookup)**

**(You MUST use \_quick/\*.md for common tasks)**

**(You MUST NOT load documentation-bible.md unless updating docs)**

### CRITICAL: No Duplication

**(You MUST NOT duplicate content - cross-reference instead)**

**(You MUST reference prompt-bible.md for technique details, not rewrite them)**

**(You MUST reference skills for HOW patterns, not duplicate them in .ai-docs)**

### CRITICAL: V2 Standards

**(llms.txt should include all essential navigation - no arbitrary line limits)**

**(\_quick/\*.md files should be focused on a single task)**

**(\_decisions/\*.md MUST include DO NOT section)**

**(CONCEPTS.md MUST include 3+ aliases per concept)**

### CRITICAL: Auggie Verification (if available)

**(Use Auggie MCP (if available) or Glob/Grep/Read tools to verify store methods and action signatures)**

**(Use Auggie MCP (if available) or Glob/Grep/Read tools to discover undocumented features)**

**(Use Auggie MCP (if available) or Glob/Grep/Read tools to find common pitfalls and anti-patterns)**

---

## DISPLAY CORE PRINCIPLES AT START AND END OF EVERY DOCUMENTATION SESSION

**1. Investigation First** - Never document code you haven't read.

**2. AI-Centric Focus** - Structure for AI parsing: tables, explicit paths, code blocks.

**3. Path Verification** - Every file path MUST be verified to exist.

**4. prompt-bible Alignment** - All techniques trace to proven prompt engineering.

**5. Write Verification** - Re-read every file after editing. Never report success without verification.

---

## Research Sources & Techniques

This documentation system is built on proven patterns from industry research. Each technique has a specific purpose for AI agent effectiveness.

### Techniques Summary

| Technique                         | Source                                                                                         | Why We Use It                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **llms.txt Standard**             | [llmstxt.org](https://llmstxt.org/)                                                            | Lightweight entry point optimized for LLM context windows. Reduces token usage by 90% vs loading full docs.       |
| **Context Engineering**           | [Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Structured information hierarchy for AI agents. Progressive disclosure prevents context window overflow.          |
| **Diataxis Framework**            | [diataxis.fr](https://diataxis.fr/)                                                            | Four-quadrant doc structure (tutorials, how-tos, reference, explanation). We focus on reference + how-tos for AI. |
| **Architecture Decision Records** | [ADR on GitHub](https://github.com/joelparkerhenderson/architecture-decision-record)           | Documents WHY decisions were made. Prevents AI from "helpfully" refactoring intentional patterns.                 |
| **Semantic Discovery**            | [Biel.ai](https://biel.ai/blog/optimizing-docs-for-ai-agents-complete-guide)                   | Alias-based concept lookup (CONCEPTS.md). AI can find docs even with imprecise terminology.                       |
| **Structured Markup**             | [Stripe Markdoc](https://stripe.com/blog/markdoc)                                              | Tables and code blocks over prose. AI extracts structured data more reliably than parsing paragraphs.             |

### Technique Details

#### 1. llms.txt Standard

**Source**: [llmstxt.org](https://llmstxt.org/)

Ultra-light entry point (~50 lines) that AI loads first. Contains:

- Quick start pointers to feature docs
- Core entry points table (routes, stores, components)
- Links to deeper documentation

**Benefit**: AI gets oriented in seconds without consuming context window on irrelevant details.

#### 2. Context Engineering for AI Agents

**Source**: [Anthropic Engineering Blog](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

Key principles applied:

- **Progressive loading**: Load docs in tiers (llms.txt -> README -> flows -> API)
- **Explicit over implicit**: Absolute paths, not "the batch store"
- **Self-reminder loops**: Critical principles at start AND end of documents
- **Verification requirements**: Re-read files after editing

**Benefit**: AI maintains accuracy over long sessions, doesn't hallucinate paths.

#### 3. Diataxis Documentation Framework

**Source**: [diataxis.fr](https://diataxis.fr/)

Four documentation types:

- **Tutorials** (learning-oriented) - NOT used for AI docs
- **How-to guides** (task-oriented) - `_quick/*.md`, `COMMON-TASKS.md`
- **Reference** (information-oriented) - `STORE-API.md`, `FILE-MAP.md`
- **Explanation** (understanding-oriented) - `_decisions/*.md`

**Benefit**: Clear separation between "how to do X" and "what is X" reduces confusion.

#### 4. Architecture Decision Records (ADRs)

**Source**: [ADR GitHub](https://github.com/joelparkerhenderson/architecture-decision-record)

Documents architectural decisions with:

- Context (why was this needed?)
- Decision (what was chosen?)
- Consequences (what's easier/harder?)
- **DO NOT section** (anti-patterns to avoid)

**Benefit**: AI understands WHY code is structured a certain way, won't "improve" intentional patterns.

#### 5. Semantic Discovery Layer

**Source**: [Biel.ai AI-Optimized Docs Guide](https://biel.ai/blog/optimizing-docs-for-ai-agents-complete-guide)

CONCEPTS.md provides alias-based lookup:

- "download" -> finds export docs
- "padding" -> finds positioning docs
- 3+ aliases per concept

**Benefit**: AI finds relevant docs even when user uses different terminology.

#### 6. Structured Markup for AI Parsing

**Source**: [Stripe Markdoc Blog](https://stripe.com/blog/markdoc)

Prioritize:

- **Tables** over prose (AI extracts structured data)
- **Code blocks** over descriptions (exact patterns)
- **Absolute paths** over relative references (no ambiguity)
- **Consistent terminology** (same term everywhere)

**Benefit**: AI pattern-matches reliably, doesn't misinterpret prose.

---

## Version History

| Version   | Date           | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0.0     | 2025-12-02     | Initial Documentation Bible created                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2.0.0     | 2025-12-02     | ENHANCED: Added prompt-bible alignment, AI processing guidelines, token efficiency, error handling, verification indicators, critical reminders at bottom                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 3.0.0     | 2025-12-02     | SIMPLIFIED: Removed specific token budgets (premature optimization), replaced with progressive loading principle. Replaced prompt-bible technique rewrites with cross-reference to canonical source at `docs/bibles/prompt-bible.md`. Reduced maintenance overhead.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **4.0.0** | **2025-12-02** | **V2 SYSTEM: Added document hierarchy (llms.txt first), file type standards (llms.txt, CONCEPTS.md, \_quick/, \_decisions/, \_session/), hash verification standards, documentation agent maintenance workflow, templates for all V2 file types, updated progressive loading strategy, added self-correction triggers for V2 patterns.**                                                                                                                                                                                                                                                                                                                                                           |
| 4.1.0     | 2025-12-03     | Renamed "Container" to "Entry Point" in templates for clarity. Added Research Sources & Techniques section documenting the industry research behind each documentation pattern (llmstxt.org, Anthropic Context Engineering, Diataxis, ADRs, Biel.ai, Stripe Markdoc).                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 4.2.0     | 2025-12-03     | Removed arbitrary 20-line limit for \_quick/\*.md files. Files should be constrained by their purpose (single task focus) not arbitrary line counts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 4.3.0     | 2025-12-03     | Added Auggie MCP Verification section. Added PITFALLS.md standards as new documentation type. Added Auggie-based self-correction triggers. Updated Entry Point Priority Order to include PITFALLS.md.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **5.0.0** | **2026-02-16** | **CLI ADAPTATION: Added CLI-Specific Documentation Categories (7 areas: Command Patterns, Wizard Flow, Agent/Skill Compilation, Test Infrastructure, Type System, Configuration, Ink UI Patterns). Added CLI-Specific Templates (store map, feature map, component patterns, user flows, anti-patterns). Added CLI Decision Framework with "When to Document" tree and "What to Document Per Area" table. Added CLI Validation Process with grep-based verification. Added CLI Anti-Patterns in Documentation section. Adapted for Agents Inc. CLI codebase (oclif + Ink + Zustand). Updated skill cross-references to CLI equivalents. Updated Core Separation Principle paths for CLI project.** |
