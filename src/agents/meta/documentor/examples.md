## Example Documentation Sessions

### Example 1: Initial Session (No Map Exists)

**User Request:** "Document the codebase for other agents"

**Action:**

1. Use Glob to find major areas (features, stores, components)
2. Create initial DOCUMENTATION_MAP.md with all areas marked "not started"
3. Recommend starting with most critical area
4. Update map with initial structure

---

### Example 2: Documenting Stores

**User Request:** "Document the state management"

**Action:**

1. Glob to find all stores: `**/stores/*.ts` (kebab-case files)
2. Read each store file completely
3. Identify patterns (Zustand `create<State>()`? Context? Other?)
4. Map relationships between stores and consuming components
5. Create `store-map.md` using template
6. Update `DOCUMENTATION_MAP.md` marking stores as complete

---

### Example 3: Validating Documentation

**User Request:** "Validate the component patterns documentation"

**Action:**

1. Read `component-patterns.md`
2. Extract all file path claims
3. Verify each path exists
4. Use Glob/Grep to verify pattern claims
5. Check for new patterns since doc was created
6. Update doc with findings and report drift

---

## Example Output: Store/State Map

````markdown
# Store/State Map

**Last Updated:** 2025-01-24

## State Management Library

**Library:** Zustand
**Pattern:** `create<State>()` stores with selectors

## Stores

| Store       | File Path                        | Purpose           | Key Actions                      |
| ----------- | -------------------------------- | ----------------- | -------------------------------- |
| WizardStore | `src/cli/stores/wizard-store.ts` | Wizard flow state | `toggleSkill()`, `resetWizard()` |

## Store Relationships

- WizardStore consumed by wizard step components (`step-build.tsx`, `step-stack.tsx`, etc.)
- No root store pattern; each store is independent

## Usage Pattern

```typescript
import { useWizardStore } from "../../stores/wizard-store.js";
const domains = useWizardStore((s) => s.domains);
```
````

**Example files:** `src/cli/components/wizard/step-build.tsx`

````

---

## Example Output: Anti-Patterns

```markdown
# Anti-Patterns

**Last Updated:** 2025-01-24

## State Management

### Inline Test Data Construction

**What:** Constructing test configs, matrices, or skills inline instead of using factories

**Where:** [document actual locations found]

**Why wrong:** Violates project convention; bypasses shared test helpers; leads to stale/inconsistent test data

**Do instead:**
```typescript
import { createMockSkill, createMockMatrix } from "../__tests__/helpers.js";
const skill = createMockSkill("web-framework-react", "web/framework");
````

**Correct pattern:** `src/cli/lib/__tests__/helpers.ts` (factory functions)

````

---

## Example Output: Feature Map

```markdown
# Feature: Editor

**Last Updated:** 2025-01-24

## Overview

**Purpose:** Interactive wizard for configuring agent/skill stacks
**Entry Point:** `src/cli/commands/init.ts` (oclif command)
**Main Component:** `src/cli/components/wizard/wizard.tsx`

## File Structure

````

src/cli/components/wizard/
├── wizard.tsx # Main wizard orchestrator
├── step-stack.tsx # Stack selection step
├── step-build.tsx # Build configuration step
├── step-sources.tsx # Source selection step
├── step-confirm.tsx # Confirmation step
└── utils.ts # Wizard utility functions

```

## Key Files

| File               | Lines | Purpose              |
| ------------------ | ----- | -------------------- |
| `wizard.tsx`       | ~200  | Step orchestration   |
| `step-build.tsx`   | ~300  | Skill selection UI   |
| `wizard-store.ts`  | ~500  | Zustand state store  |
```
