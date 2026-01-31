# P2-16: Stacks as Visual Hierarchy (Pre-Selection Groups)

## Summary

Simplify the stack concept from a complex, special-cased data model to a simple pre-selection mechanism. Stacks become curated skill lists that pre-populate the wizard - nothing more. After selection, all paths converge to the same compilation flow.

## Problem Statement

### Current Complexity

The current implementation treats stacks as a fundamentally different entity:

1. **Separate data structures:**
   - `SuggestedStack` in `skills-matrix.yaml` (for wizard display)
   - `ResolvedStack` in `types-matrix.ts` (merged for wizard)
   - `StackConfig` in `src/types.ts` (for compilation)
   - `config.yaml` per stack in `src/stacks/{id}/`

2. **Special code paths:**
   - `loadStack()` - dedicated loader for stack configs
   - `stackToCompileConfig()` - conversion function
   - `resolveStackSkills()` - special skill resolution
   - `compileStackPlugin()` - separate compilation entry point
   - `installStackAsPlugin()` - separate installation flow

3. **State pollution in wizard:**
   - `selectedStack: ResolvedStack | null` tracked separately
   - `stack_review` step that only exists for stacks
   - Different confirmation logic based on stack vs scratch

4. **Conceptual overhead:**
   - Users must understand "stacks" vs "skills"
   - Stack installation differs from skill installation
   - Stack editing requires special handling

### User Impact

- Confusion about what a "stack" is
- Two mental models for the same outcome (skills selection)
- Stack-specific bugs don't occur in scratch selection (and vice versa)

## Proposed Solution

### Core Principle

**A stack is just a pre-selection group.** It's a named list of skill IDs that pre-populates `selectedSkills` in the wizard. That's it.

### Data Model Changes

#### Before: skills-matrix.yaml

```yaml
suggested_stacks:
  - id: nextjs-fullstack
    name: Fullstack React
    description: Production-ready React with complete backend infrastructure
    audience: [production, startups, fullstack]
    skills:
      frontend:
        framework: react
        meta-framework: nextjs-app-router
        # ... 20+ nested categorized skills
      backend:
        api: hono
        # ...
    philosophy: "Production-ready from day one"
```

#### After: skills-matrix.yaml

```yaml
presets:
  - id: nextjs-fullstack
    name: Fullstack React
    description: Production-ready React with complete backend infrastructure
    skills:
      - react
      - nextjs-app-router
      - scss-modules
      - zustand
      - react-query
      - react-hook-form
      - zod-validation
      - vitest
      - react-testing-library
      - playwright-e2e
      - msw
      - accessibility
      - frontend-performance
      - hono
      - drizzle
      - better-auth
      - posthog
      - posthog-flags
      - resend
      - axiom-pino-sentry
      - github-actions
      - backend-performance
      - backend-testing
      - security
      - turborepo
      - env
      - tooling
      - reviewing
      - research-methodology
```

**Changes:**

- Rename `suggested_stacks` to `presets` (clearer terminology)
- Flatten `skills` from `Record<string, Record<string, string>>` to `string[]`
- Remove `audience` (display-only, not used)
- Remove `philosophy` (move to optional config, not selection)
- Keep only: `id`, `name`, `description`, `skills[]`

#### Types Changes

```typescript
// BEFORE: types-matrix.ts
export interface SuggestedStack {
  id: string;
  name: string;
  description: string;
  audience: string[];
  skills: Record<string, Record<string, string>>;
  philosophy: string;
}

export interface ResolvedStack {
  id: string;
  name: string;
  description: string;
  audience: string[];
  skills: Record<string, Record<string, string>>;
  allSkillIds: string[];
  philosophy: string;
}

// AFTER: types-matrix.ts
export interface SkillPreset {
  id: string;
  name: string;
  description: string;
  skills: string[]; // Flat list of skill aliases
}

// ResolvedStack removed entirely
```

```typescript
// BEFORE: wizard.ts
export interface WizardState {
  selectedSkills: string[];
  selectedStack: ResolvedStack | null;
  // ...
}

export interface WizardResult {
  selectedSkills: string[];
  selectedStack: ResolvedStack | null;
  // ...
}

// AFTER: wizard.ts
export interface WizardState {
  selectedSkills: string[];
  selectedPreset: string | null; // Just the preset ID for display
  // ...
}

export interface WizardResult {
  selectedSkills: string[];
  // No selectedStack - we only care about the final skills
  // ...
}
```

### Wizard Flow Changes

#### Before

```
approach -> stack -> stack_review -> (edit?) -> category -> subcategory -> confirm
                \-> scratch -----> category -> subcategory -> confirm
```

The `stack_review` step exists because stacks are "special" and users might want to review before committing.

#### After

```
approach -> (preset selection) -> category -> subcategory -> confirm
        \-> scratch ------------> category -> subcategory -> confirm
```

- Preset selection pre-populates `selectedSkills`
- User lands directly in category view (same as scratch)
- No `stack_review` step - user can immediately see what's selected
- "Continue" button available since skills are pre-selected

**Key insight:** The "review" was only needed because users couldn't see/modify stack selections. With presets, they land in the normal flow with pre-selections visible.

### File Impact Analysis

| File                       | Current Role                                                | Change                                             |
| -------------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| `types-matrix.ts`          | Defines `SuggestedStack`, `ResolvedStack`                   | Replace with `SkillPreset`, remove `ResolvedStack` |
| `skills-matrix.yaml`       | Contains nested `suggested_stacks`                          | Rename to `presets` with flat skill lists          |
| `wizard.ts`                | Tracks `selectedStack`, has `stack_review` step             | Remove `stack_review`, simplify state              |
| `init.ts`                  | Different paths for stack vs scratch                        | Single unified path                                |
| `config-generator.ts`      | `generateConfigFromStack()` vs `generateConfigFromSkills()` | Only `generateConfigFromSkills()`                  |
| `stack-plugin-compiler.ts` | Compiles stack as special entity                            | Remove or repurpose                                |
| `stack-installer.ts`       | Stack-specific installation                                 | Remove                                             |
| `compile-stack.ts`         | `build:stack` command                                       | Deprecate or remove                                |
| `loader.ts`                | `loadStack()`, `loadStackSkills()`                          | Remove                                             |
| `resolver.ts`              | `resolveStackSkills()`, `stackToCompileConfig()`            | Remove                                             |

### Commands Impact

| Command          | Current                          | After                                       |
| ---------------- | -------------------------------- | ------------------------------------------- |
| `cc init`        | Stack path vs scratch path       | Single path with optional preset            |
| `cc edit`        | Works on either                  | No change                                   |
| `cc compile`     | Uses config.yaml                 | No change                                   |
| `cc build:stack` | Compiles standalone stack plugin | Remove (or keep for marketplace publishers) |

### Migration Path

#### Phase 1: Data Structure (Non-Breaking)

1. Add `presets` alongside `suggested_stacks` in skills-matrix.yaml
2. Update matrix merger to handle both formats
3. Keep `SuggestedStack` for backward compatibility

#### Phase 2: Wizard Simplification

1. Remove `stack_review` step
2. Preset selection sets `selectedSkills` and goes to `category`
3. Add visual indicator of preset origin (e.g., "Starting from: Fullstack React")

#### Phase 3: Code Cleanup

1. Remove `selectedStack` from WizardState/WizardResult
2. Remove stack-specific compilation paths in init.ts
3. Remove `loadStack()`, `resolveStackSkills()`, etc.
4. Deprecate/remove `build:stack` command

#### Phase 4: Schema Migration

1. Remove `suggested_stacks` from skills-matrix.yaml
2. Remove `SuggestedStack`, `ResolvedStack` types
3. Update all tests

### Success Criteria

1. **Single compilation path:** All skill selections (preset or scratch) use same code
2. **No `selectedStack` state:** WizardResult only contains `selectedSkills`
3. **No `stack_review` step:** Preset selection goes directly to category view
4. **Flat preset format:** Presets are `{ id, name, description, skills: string[] }`
5. **Fewer types:** Remove `SuggestedStack`, `ResolvedStack`, simplify to `SkillPreset`
6. **Fewer files:** Remove stack-installer.ts, simplify stack-plugin-compiler.ts

### Out of Scope

1. **Marketplace stack publishing:** Keep `build:stack` for marketplace publishers who need standalone stack plugins
2. **Stack-specific CLAUDE.md:** Philosophy/principles can be part of project config, not selection
3. **Stack validation rules:** If preset skills have conflicts, show same errors as scratch selection

### Risk Assessment

| Risk                               | Likelihood | Impact | Mitigation                              |
| ---------------------------------- | ---------- | ------ | --------------------------------------- |
| Existing stack configs break       | High       | Medium | Phase 1 provides backward compatibility |
| Users expect "stack" terminology   | Medium     | Low    | Clear messaging in wizard               |
| Marketplace publishers need stacks | Medium     | Low    | Keep build:stack for publishing         |

### Questions for Discussion

1. **Terminology:** "Presets" vs "Templates" vs "Stacks" - which is clearest?
2. **Philosophy/principles:** Should these move to a separate "flavors" concept, or just documentation?
3. **build:stack command:** Keep for marketplace publishers, or remove entirely?

## Appendix: Code References

### Current Stack Flow (init.ts)

```typescript
// Lines 195-288 - Stack-specific branch
if (result.installMode === "plugin") {
  if (result.selectedStack) {
    // Install stack as ONE native plugin
    const installResult = await installStackAsPlugin({...});
  } else {
    // Fallback to Local Mode
  }
}
```

### Current Stack State (wizard.ts)

```typescript
// Lines 33-47 - WizardState includes selectedStack
export interface WizardState {
  selectedSkills: string[];
  selectedStack: ResolvedStack | null;
  // ...
}

// Lines 593-641 - stack_review case
case "stack": {
  const stack = matrix.suggestedStacks.find((s) => s.id === result);
  if (stack) {
    state.selectedStack = stack;
    state.selectedSkills = [...stack.allSkillIds];
    state.currentStep = "stack_review";
  }
}
```

### Current Stack Types (types-matrix.ts)

```typescript
// Lines 166-188 - SuggestedStack
export interface SuggestedStack {
  id: string;
  name: string;
  description: string;
  audience: string[];
  skills: Record<string, Record<string, string>>;
  philosophy: string;
}

// Lines 428-449 - ResolvedStack
export interface ResolvedStack {
  id: string;
  name: string;
  description: string;
  audience: string[];
  skills: Record<string, Record<string, string>>;
  allSkillIds: string[];
  philosophy: string;
}
```
