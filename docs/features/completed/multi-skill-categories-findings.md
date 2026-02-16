# Multi-Skill Categories: System Investigation Findings

**Investigation Date:** 2026-02-13
**Context:** User observed that "methodology" is a skill category with 4-5 different methodology skills, raising the question of how the system handles multiple skills per category and whether this is intentional or a limitation.

---

## Executive Summary

**The system fully supports multiple skills per subcategory.** This is an intentional design feature, not a limitation. Categories have an `exclusive` flag that determines whether users can select:

- **One skill only** (`exclusive: true`) — e.g., framework, styling
- **Multiple skills** (`exclusive: false`) — e.g., methodology, testing, utilities

The "methodology" subcategory is correctly configured as `exclusive: false` and contains **6 methodology skills**, allowing users to select any combination. However, there is a critical limitation in how **stacks** represent these selections.

---

## Current State: How Categories Work

### 1. Category Definition

From `config/skills-matrix.yaml`:

```yaml
methodology:
  id: methodology
  displayName: Methodology
  description: Development methodology and engineering principles
  domain: shared
  exclusive: false # ← Allows multiple selections
  required: false
  order: 4
```

### 2. Exclusive vs Multi-Select Categories

| Category Type    | `exclusive` | Behavior                                       | Examples                                           |
| ---------------- | ----------- | ---------------------------------------------- | -------------------------------------------------- |
| **Exclusive**    | `true`      | Only ONE skill can be selected at a time       | `framework`, `styling`, `api`, `database`          |
| **Multi-Select** | `false`     | MULTIPLE skills can be selected simultaneously | `methodology`, `testing`, `ui-components`, `forms` |

### 3. Methodology Skills

The system has **6 methodology skills** (not 4-5 as initially observed):

1. `meta-methodology-investigation-requirements`
2. `meta-methodology-anti-over-engineering`
3. `meta-methodology-success-criteria`
4. `meta-methodology-write-verification`
5. `meta-methodology-improvement-protocol`
6. `meta-methodology-context-management`

**All 6 are preselected by default** in the wizard via `DEFAULT_PRESELECTED_SKILLS` constant (`src/cli/consts.ts:48-55`).

### 4. Selection Storage in Wizard

The wizard stores selections as:

```typescript
// wizard-store.ts
domainSelections: DomainSelections;
// = Partial<Record<Domain, Partial<Record<Subcategory, SkillId[]>>>>
//                                                     ^^^^^^^^^^^^^^
//                                                     ARRAY of skill IDs
```

**Key insight:** The wizard **always stores an array** of `SkillId[]` per subcategory, regardless of whether the category is exclusive or multi-select. The distinction is enforced at the **UI toggle logic** level:

```typescript
// wizard-store.ts:216-239
toggleTechnology: (domain, subcategory, technology, exclusive) => {
  if (exclusive) {
    newSelections = isSelected ? [] : [technology]; // Single-item array or empty
  } else {
    newSelections = isSelected
      ? currentSelections.filter((t) => t !== technology) // Remove from array
      : [...currentSelections, technology]; // Add to array
  }
};
```

---

## THE CRITICAL LIMITATION: Stack Configuration

### Problem: `StackAgentConfig` Only Allows One Skill Per Subcategory

From `src/cli/types/stacks.ts`:

```typescript
/** Maps subcategory IDs to skill IDs (e.g., { framework: "web-framework-react" }) */
export type StackAgentConfig = Partial<Record<Subcategory, SkillId>>;
//                                                           ^^^^^^^
//                                                           SINGLE SkillId
```

This type is used in:

```typescript
export type Stack = {
  id: string;
  name: string;
  description: string;
  /** Agent configurations mapping agent IDs to their technology selections */
  agents: Partial<Record<AgentName, StackAgentConfig>>;
  //                                 ^^^^^^^^^^^^^^^^^
  //                                 ONE skill per subcategory
};
```

### Current Stack Behavior

From `config/stacks.yaml`, stacks can only define **one methodology skill** per agent:

```yaml
agents:
  skill-summoner:
    methodology: meta-methodology-improvement-protocol # ← Only ONE
    research: meta-research-research-methodology
  agent-summoner:
    methodology: meta-methodology-improvement-protocol # ← Only ONE
    research: meta-research-research-methodology
  pattern-scout:
    methodology: meta-methodology-investigation-requirements # ← Only ONE
```

**This is inconsistent with the wizard, which allows selecting multiple methodology skills.**

### Impact

1. **Stacks cannot pre-populate multiple methodology skills** — Users must manually add additional methodology skills after loading a stack template.
2. **Stack definitions are artificially limited** — Cannot express "this agent uses investigation-requirements AND anti-over-engineering."
3. **Type inconsistency** — Wizard uses `SkillId[]`, stacks use `SkillId`.

---

## How Multi-Select Categories Work in Practice

### Wizard Flow (Current — Works Correctly)

1. User selects approach: "stack" or "scratch"
2. **If "stack":**
   - Stack loads with `populateFromStack()` (wizard-store.ts:129-166)
   - Stack selections → wizard `domainSelections` (converts `SkillId` → `SkillId[]`)
   - **Limitation:** Only one skill per subcategory is populated
3. **If "scratch":**
   - User manually selects skills
   - For `exclusive: false` categories, multiple skills can be selected
4. **Build step** (step-build.tsx):
   - CategoryGrid renders each subcategory as a row
   - Options are skills within that subcategory
   - User toggles skills (checkbox behavior for multi-select)
5. **Config generation** (config-generator.ts):
   - Wizard selections → `ProjectConfig` with all selected skills
   - Multi-select categories → multiple skills in agent config

### Example: Methodology Category in Wizard

```typescript
// User selections in wizard store:
domainSelections = {
  shared: {
    methodology: [
      "meta-methodology-investigation-requirements",
      "meta-methodology-anti-over-engineering",
      "meta-methodology-success-criteria",
    ],
  },
};
```

This works correctly and all 3 skills are included in the generated config.

### Example: Methodology in Stack (Current Limitation)

```yaml
# config/stacks.yaml
agents:
  web-developer:
    methodology: meta-methodology-investigation-requirements # ← Can only specify ONE
```

After loading this stack, the wizard will only pre-populate `investigation-requirements`. Users must manually add the others.

---

## Which Subcategories Are Multi-Select?

From `config/skills-matrix.yaml`, here are all **multi-select** (`exclusive: false`) categories:

### Web Domain

- `forms` — Form libraries (can have both react-hook-form AND zod-validation)
- `testing` — Testing tools (can have vitest AND playwright-e2e)
- `ui-components` — Component libraries (can have shadcn-ui AND radix-ui)
- `mocking` — API mocking (currently only MSW, but designed for multiple)
- `error-handling` — Error patterns (can select multiple approaches)
- `file-upload` — File upload patterns (can select multiple)
- `files` — Image handling (can select multiple utilities)
- `utilities` — Utility libraries (date-fns, etc. — can select multiple)
- `animation` — Animation libraries (can select multiple)
- `pwa` — PWA features (can select multiple patterns)
- `accessibility` — Accessibility patterns (can select multiple)
- `web-performance` — Performance patterns (can select multiple)

### API Domain

- `observability` — Logging, monitoring (can have multiple tools)
- `analytics` — Analytics providers (can have multiple)
- `performance` — Performance patterns (can select multiple)

### Shared Domain

- `tooling` — Build tools (ESLint, Prettier, TypeScript — multiple)
- `security` — Security patterns (can select multiple)
- `methodology` — Development methodology (can select multiple principles)
- `research` — Research patterns (can select multiple)
- `reviewing` — Code review patterns (can select multiple)
- `ci-cd` — CI/CD pipelines (can have multiple)

### CLI Domain

- `cli-testing` — CLI testing utilities (can select multiple)

---

## Recommendations

### Option 1: Extend Stack Type to Support Arrays (Recommended)

**Change `StackAgentConfig` to allow arrays:**

```typescript
// src/cli/types/stacks.ts
export type StackAgentConfig = Partial<Record<Subcategory, SkillId | SkillId[]>>;
//                                                          ^^^^^^^^^^^^^^^^^^^^
//                                                          Union type
```

**YAML example:**

```yaml
agents:
  web-developer:
    framework: web-framework-react
    styling: web-styling-scss-modules
    methodology: # ← Now accepts array
      - meta-methodology-investigation-requirements
      - meta-methodology-anti-over-engineering
      - meta-methodology-success-criteria
    testing: # ← Array for multi-select category
      - web-testing-vitest
      - web-testing-playwright-e2e
```

**Pros:**

- Expressive: Can define multiple skills per subcategory in stacks
- Consistent: Matches wizard storage (`SkillId[]`)
- Backward compatible: Single `SkillId` still works (union type)

**Cons:**

- Requires updates to stack loading logic
- Zod schema must handle union type
- YAML serialization must support both forms

### Option 2: Keep Current Limitation, Document It

**Keep `StackAgentConfig` as-is (`SkillId` only).**

**Documentation change:**

```yaml
# config/stacks.yaml
# NOTE: Stacks can only specify ONE skill per subcategory.
# For multi-select categories (methodology, testing, forms, etc.),
# additional skills must be manually selected in the wizard.
```

**Pros:**

- Zero code changes
- Simplest solution

**Cons:**

- Permanent limitation in stack expressiveness
- User confusion when methodology requires manual additions
- Inconsistency between wizard (array) and stacks (single)

### Option 3: Separate Multi-Select Categories in Stacks

**Add a new field `additional_skills` to stack agent config:**

```yaml
agents:
  web-developer:
    framework: web-framework-react
    methodology: meta-methodology-investigation-requirements
    additional_skills:
      - meta-methodology-anti-over-engineering
      - meta-methodology-success-criteria
```

**Pros:**

- Backward compatible
- Separates "primary" from "additional" skills

**Cons:**

- Adds complexity
- Unclear semantics (what makes a skill "additional"?)
- Doesn't solve the type limitation

---

## Affected Files (If Implementing Option 1)

### Type Definitions

- `src/cli/types/stacks.ts` — Change `StackAgentConfig` to `SkillId | SkillId[]`
- `src/cli/types/matrix.ts` — Update `ResolvedStack.skills` type if needed

### Zod Schemas

- `src/cli/lib/schemas.ts` — Update `stackAgentConfigSchema` to handle union type:
  ```typescript
  const stackAgentConfigSchema = z.record(z.union([skillIdSchema, z.array(skillIdSchema)]));
  ```

### Stack Loading

- `src/cli/lib/stacks/stacks-loader.ts` — Update `resolveAgentConfigToSkills()` to handle arrays:
  ```typescript
  export function resolveAgentConfigToSkills(agentConfig: StackAgentConfig): SkillReference[] {
    const skillRefs: SkillReference[] = [];
    for (const [subcategory, value] of Object.entries(agentConfig)) {
      const skillIds = Array.isArray(value) ? value : [value]; // Normalize to array
      for (const skillId of skillIds) {
        // ... existing logic
      }
    }
    return skillRefs;
  }
  ```

### Wizard Population

- `src/cli/stores/wizard-store.ts` — Update `populateFromStack()` to handle arrays:
  ```typescript
  for (const [subcategoryId, skillIdOrArray] of Object.entries(agentConfig)) {
    const skillIds = Array.isArray(skillIdOrArray) ? skillIdOrArray : [skillIdOrArray];
    // ... existing logic
  }
  ```

### Stack Compilation

- `src/cli/lib/stacks/stack-plugin-compiler.ts` — Handle arrays in `buildAgentSkills()`
- `src/cli/lib/configuration/config-generator.ts` — Ensure `buildStackProperty()` outputs arrays correctly

### Tests

- `src/cli/lib/__tests__/helpers.ts` — Update `createMockStack()` to test array values
- `src/cli/lib/stacks/__tests__/stacks-loader.test.ts` — Add tests for array handling
- All integration tests that use stacks

### Documentation

- `config/stacks.yaml` — Add examples showing array syntax
- `docs/reference/architecture.md` — Update stack type documentation

**Estimated files to change:** 8-10 core files + 15-20 test files

---

## Testing Impact

Current test infrastructure assumes `SkillId` for stacks:

```typescript
// helpers.ts
export function createMockStack(overrides?: Partial<Stack>): Stack {
  return {
    agents: {
      "web-developer": {
        framework: "web-framework-react",
        methodology: "meta-methodology-investigation-requirements", // ← Single value
      },
    },
    ...overrides,
  };
}
```

**All stack-related tests must be updated** to handle union types.

---

## User Experience Considerations

### Current UX (With Limitation)

1. User loads "Vince Stack"
2. Stack populates `methodology: investigation-requirements`
3. User sees only 1 methodology skill selected
4. User must **manually discover** that they can select more methodology skills
5. User manually adds the other 5 methodology skills

**Problem:** Friction and missed skills.

### Improved UX (With Option 1)

1. User loads "Vince Stack"
2. Stack populates all 6 methodology skills at once
3. User sees complete methodology configuration
4. User can proceed or customize

**Benefit:** Zero friction, complete stack representation.

---

## Conclusion

The system **does support multiple skills per category** at the wizard level. The limitation is purely in the **stack definition type**, which currently restricts stacks to one skill per subcategory.

**Recommendation:** Implement **Option 1** to extend `StackAgentConfig` to support `SkillId | SkillId[]`. This aligns stacks with the wizard's capabilities and provides a better user experience, especially for methodology and other multi-select categories.

**Priority:** Medium-high. The current limitation is not a blocker (users can manually add skills), but it creates friction and inconsistency in the system's design.
