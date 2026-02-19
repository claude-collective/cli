# D-31: Prefix Categories with Domain -- Migration Plan

## Goal

Rename all bare subcategory keys to domain-prefixed form (`framework` -> `web-framework`, `api` -> `api-api`, etc.) so that the `Subcategory` type, `CategoryPath` type, YAML configs, JSON schemas, and all metadata.yaml files across repos use consistent `domain-subcategory` paths.

**Separator: `-` (hyphen), NOT `/` (slash).** This avoids confusion with file paths. For example: `web-framework`, `web-animation`, `shared-methodology`, `api-database`.

---

## Current -> Target Mapping

Derived from `config/skills-matrix.yaml` which is the canonical source of truth for domain-to-subcategory mapping.

| #   | Current Subcategory  | Domain     | New Value                | Notes                                                                     |
| --- | -------------------- | ---------- | ------------------------ | ------------------------------------------------------------------------- |
| 1   | `framework`          | web        | `web-framework`          |                                                                           |
| 2   | ~~`meta-framework`~~ | ~~web~~    | ~~`web-meta-framework`~~ | **Removed by D-35** — merged into `framework` before D-31 runs            |
| 3   | `styling`            | web        | `web-styling`            |                                                                           |
| 4   | `client-state`       | web        | `web-client-state`       |                                                                           |
| 5   | `server-state`       | web        | `web-server-state`       |                                                                           |
| 6   | `forms`              | web        | `web-forms`              |                                                                           |
| 7   | `testing`            | web        | `web-testing`            |                                                                           |
| 8   | `ui-components`      | web        | `web-ui-components`      |                                                                           |
| 9   | `mocking`            | web        | `web-mocking`            |                                                                           |
| 10  | `error-handling`     | web-extras | `web-error-handling`     | YAML domain is `web-extras`, prefixed as `web-` (D-33 removes web-extras) |
| 11  | `i18n`               | web        | `web-i18n`               |                                                                           |
| 12  | `file-upload`        | web-extras | `web-file-upload`        | YAML domain is `web-extras`, prefixed as `web-`                           |
| 13  | `files`              | web-extras | `web-files`              | YAML domain is `web-extras`, prefixed as `web-`                           |
| 14  | `utilities`          | web-extras | `web-utilities`          | YAML domain is `web-extras`, prefixed as `web-`                           |
| 15  | `realtime`           | web-extras | `web-realtime`           | YAML domain is `web-extras`, prefixed as `web-`                           |
| 16  | `animation`          | web-extras | `web-animation`          | YAML domain is `web-extras`, prefixed as `web-`                           |
| 17  | `pwa`                | web-extras | `web-pwa`                | YAML domain is `web-extras`, prefixed as `web-`                           |
| 18  | `accessibility`      | web-extras | `web-accessibility`      | YAML domain is `web-extras`, prefixed as `web-`                           |
| 19  | `web-performance`    | web        | `web-performance`        | Already prefixed — no change                                              |
| 20  | `api`                | api        | `api-api`                |                                                                           |
| 21  | `database`           | api        | `api-database`           |                                                                           |
| 22  | `auth`               | api        | `api-auth`               |                                                                           |
| 23  | `observability`      | api        | `api-observability`      |                                                                           |
| 24  | `analytics`          | api        | `api-analytics`          |                                                                           |
| 25  | `email`              | api        | `api-email`              |                                                                           |
| 26  | `performance`        | api        | `api-performance`        |                                                                           |
| 27  | `mobile-framework`   | mobile     | `mobile-framework`       | Already prefixed — no change                                              |
| 28  | `monorepo`           | shared     | `shared-monorepo`        |                                                                           |
| 29  | `tooling`            | shared     | `shared-tooling`         |                                                                           |
| 30  | `security`           | shared     | `shared-security`        |                                                                           |
| 31  | `methodology`        | shared     | `shared-methodology`     |                                                                           |
| 32  | `research`           | shared     | `shared-research`        |                                                                           |
| 33  | `reviewing`          | shared     | `shared-reviewing`       |                                                                           |
| 34  | `ci-cd`              | shared     | `shared-ci-cd`           |                                                                           |
| 35  | `cli-framework`      | cli        | `cli-framework`          | Already prefixed — no change                                              |
| 36  | `cli-prompts`        | cli        | `cli-prompts`            | Already prefixed — no change                                              |
| 37  | `cli-testing`        | cli        | `cli-testing`            | Already prefixed — no change                                              |

**Stacks-only keys (not in skills-matrix.yaml categories but used in stacks.yaml):**

| #   | Current Key      | Domain       | New Value            | Notes                                                  |
| --- | ---------------- | ------------ | -------------------- | ------------------------------------------------------ |
| 38  | `base-framework` | (stack-only) | `web-base-framework` | Used to assign base React framework in Remix/RN stacks |
| 39  | `platform`       | (stack-only) | `mobile-platform`    | Used to assign Expo in RN stack                        |

---

## Phase 1: Type System (CLI repo)

### File: `src/cli/types/matrix.ts`

**Lines 8-47: `Subcategory` union type**

Change all 39 values from bare names to domain-prefixed form (37 category keys + 2 stacks-only keys: `base-framework`, `platform`):

```typescript
// BEFORE
export type Subcategory = "framework" | "meta-framework" | "testing";
// ...

// AFTER
export type Subcategory = "web-framework" | "web-testing";
// ...
```

**Line 5: `Domain` type** -- NO CHANGE needed. Domains stay as-is.

**Line 66: `CategoryMap`** -- No change (uses `Subcategory` which will update automatically).

**Line 77: `DomainSelections`** -- No change (uses `Subcategory` which will update automatically).

**Line 81: `CategoryDefinition.id`** -- Type is `Subcategory`, values in YAML change. No type code change needed.

**Line 169: `SuggestedStack.skills`** -- Uses `Subcategory`, auto-updates.

**Line 275: `ResolvedStack.skills`** -- Uses `Subcategory`, auto-updates.

### File: `src/cli/types/skills.ts`

**Lines 124-128: `CategoryPath` type**

```typescript
// BEFORE
export type CategoryPath =
  | `${SkillIdPrefix}/${string}`
  | `${SkillIdPrefix}-${string}`
  | Subcategory
  | "local";

// AFTER -- the `Subcategory` branch now has "domain-subcategory" format (hyphen separator)
// which overlaps with `${SkillIdPrefix}-${string}` for most values.
// Consider simplification:
export type CategoryPath = `${SkillIdPrefix}-${string}` | Subcategory | "local";
// Subcategory now IS domain-prefixed with "-": "web-framework", "api-database", etc.
// The Subcategory branch matches `${SkillIdPrefix}-${string}` for web/api/cli/mobile
// but NOT for "web-..." or "shared-..." since those are not SkillIdPrefix values.
// Decision: Keep Subcategory branch to cover web- and shared- paths.
// The SkillIdPrefix union is: "web" | "api" | "cli" | "mobile" | "infra" | "meta" | "security"
// Missing from SkillIdPrefix: "shared" (web-extras is now under "web")
// Options:
//   A) Add "shared" to SkillIdPrefix (but it isn't a skill ID prefix)
//   B) Keep Subcategory as explicit branch (current approach works)
//   C) Create separate DomainPrefix type for CategoryPath
// RECOMMENDATION: Option B -- keep Subcategory branch. No type change needed.
// NOTE: The `${SkillIdPrefix}/${string}` branch (slash) can likely be REMOVED
// since we no longer use "/" as separator. Keep only if needed for backward compat.
```

**Lines 135-136: `SubcategorySelections`** -- Uses `Subcategory`, auto-updates.

**Lines 142-143: `ResolvedSubcategorySkills`** -- Uses `Subcategory`, auto-updates.

### File: `src/cli/types/stacks.ts`

**Line 6: `StackAgentConfig`** -- Uses `Subcategory`, auto-updates.

### File: `src/cli/lib/schemas.ts`

**Lines 60-98: `SUBCATEGORY_VALUES` array**

Change all 37 values to domain-prefixed form:

```typescript
const SUBCATEGORY_VALUES = [
  "web-framework",
  "web-meta-framework",
  "web-styling",
  "web-client-state",
  // ... all 37 values
] as const;
```

**Line 101: `subcategorySchema`** -- No code change (derived from SUBCATEGORY_VALUES).

**Line 108: `stackSubcategorySchema`**

Change extended keys:

```typescript
// BEFORE
export const stackSubcategorySchema = z.enum([...SUBCATEGORY_VALUES, "base-framework", "platform"]);

// AFTER
export const stackSubcategorySchema = z.enum([
  ...SUBCATEGORY_VALUES,
  "web-base-framework",
  "mobile-platform",
]);
```

**Lines 244-255: `categoryPathSchema`**

The `refine` function currently checks:

1. `val === "local"` -- keep
2. Regex `^(web|api|cli|mobile|infra|meta|security)/.+$` -- slash-based, can be REMOVED since we now use `-` separator
3. Regex `^(web|api|cli|mobile|infra|meta|security)-.+$` -- this already matches the new hyphen-separated format for most domains. But NOT for `web-` or `shared-` -- need to add those.
4. Falls back to `subcategorySchema.safeParse(val)` -- this will now only match domain-prefixed values

**CHANGE NEEDED**: Update regex on line 247 to match all domain prefixes with `-` separator:

```typescript
if (/^(web|api|cli|mobile|infra|meta|security|shared)-.+$/.test(val)) return true;
```

The slash-based regex (check #2) can be removed or kept for backward compat during transition.

**Lines 369-385: `stackSubcategoryValues` / `stackAgentConfigSchema`** -- No code change (derived from `stackSubcategorySchema`).

**Line 452: `categoryDefinitionSchema`** -- `id: subcategorySchema` -- auto-updates since subcategorySchema changes.

**Lines 502-511: `skillsMatrixConfigSchema`** -- `z.record(subcategorySchema, ...)` -- auto-updates.

### File: `src/cli/consts.ts` (if applicable)

Search for any hardcoded subcategory strings. None found based on investigation -- the consts file uses `STANDARD_FILES.*` and `STANDARD_DIRS.*`, not subcategory values.

---

## Phase 2: YAML Configs (CLI repo)

### File: `config/skills-matrix.yaml`

**Lines 16-371: `categories` section**

Change ALL 37 category keys and their `id` fields:

```yaml
# BEFORE
categories:
  framework:
    id: framework
    displayName: Framework
    domain: web
    # ...

# AFTER
categories:
  web-framework:
    id: web-framework
    displayName: Framework
    domain: web
    # ...
```

**Count:** 37 category entries, each with both a key change and an `id` field change = 74 individual value changes.

The `domain` field on each category becomes REDUNDANT since the domain is now embedded in the key. However, keeping it avoids code changes in domain-filtering logic that reads `category.domain`. **Decision: Keep `domain` field for now; removing it is a separate cleanup task.**

### File: `config/stacks.yaml`

**All subcategory keys used as agent config keys in stack definitions.**

Unique subcategory keys and their occurrence counts:

- `methodology`: 102 occurrences -> `shared-methodology`
- `testing`: 82 -> `web-testing`
- `framework`: 63 -> `web-framework`
- `observability`: 60 -> `api-observability`
- `database`: 60 -> `api-database`
- `auth`: 60 -> `api-auth`
- `api`: 60 -> `api-api`
- `client-state`: 45 -> `web-client-state`
- `reviewing`: 44 -> `shared-reviewing`
- `server-state`: 18 -> `web-server-state`
- `base-framework`: 18 -> `web-base-framework`
- `mocking`: 10 -> `web-mocking`
- `styling`: 9 -> `web-styling`
- `platform`: 9 -> `mobile-platform`
- ~~`meta-framework`: 9 -> `web-meta-framework`~~ **Removed by D-35**
- `email`: 9 -> `api-email`
- `ci-cd`: 9 -> `shared-ci-cd`
- `analytics`: 9 -> `api-analytics`
- `cli-framework`: 8 -> `cli-framework`
- `accessibility`: 8 -> `web-accessibility`
- `research`: 3 -> `shared-research`

**Total key occurrences: ~686 individual key renames in stacks.yaml.**

### File: `src/cli/defaults/agent-mappings.yaml`

**`preloadedSkills` section — REMOVED (dead code).** This section was never consumed by any TypeScript code. Actual preloading is determined by `stacks.yaml`'s per-skill `preloaded: true/false` flags. Removed from the file, schema, and type.

**`subcategoryAliases` section — REMOVED (dead code).** Never consumed by any TypeScript code. Post-D-31 the aliases would have been redundant anyway since category values are already domain-prefixed.

**Lines 8-89: `skillToAgents` section**

These use path patterns like `"web-*"`, `"api-*"`, `"web-testing"`, `"api-testing"`, `"web-mocks"`. These are already domain-prefixed path patterns and should NOT need changing (they match the new category format natively).

**Lines 177-257: `agentSkillPrefixes` section** -- Uses domain prefixes (`web`, `api`, `cli`, etc.), NOT subcategory values. No change needed.

---

## Phase 3: JSON Schemas (CLI repo)

### File: `src/schemas/skills-matrix.schema.json`

**3 locations with subcategory enums:**

1. **Lines 15-53: `categories.propertyNames.enum`** -- 37 values, all must change to domain-prefixed form.

2. **Lines 60-98: `categories.additionalProperties.properties.id.enum`** -- 37 values, all must change.

3. **Lines 131-168: `categories.required`** -- 37 values, all must change.

**Total: 111 individual string replacements.**

### File: `src/schemas/stacks.schema.json`

**Lines 34-73: `agents.additionalProperties.propertyNames.enum`** -- 37 + 2 (base-framework, platform) = 39 values, all must change.

**Total: 39 individual string replacements.**

### File: `src/schemas/project-config.schema.json`

**Lines 50-90: `stack.additionalProperties.propertyNames.enum`** -- 37 + 2 = 39 values, all must change.

**Total: 39 individual string replacements.**

### File: `src/schemas/stack.schema.json`

No subcategory enum found -- uses free-form strings for `agentSkills` property names. No change needed.

### Files NOT needing changes:

- `src/schemas/agent.schema.json` -- no subcategory refs
- `src/schemas/agent-frontmatter.schema.json` -- no subcategory refs
- `src/schemas/hooks.schema.json` -- no subcategory refs
- `src/schemas/marketplace.schema.json` -- no subcategory refs
- `src/schemas/metadata.schema.json` -- no subcategory refs
- `src/schemas/plugin.schema.json` -- no subcategory refs
- `src/schemas/skill-frontmatter.schema.json` -- no subcategory refs
- `src/schemas/project-source-config.schema.json` -- no subcategory refs

---

## Phase 4: Source Code (CLI repo)

### 4A: Files with `as Subcategory` casts (29 occurrences across codebase)

These casts exist because values that should be `Subcategory` typed are coming from string contexts. After the rename, the CAST PATTERN stays the same but the VALUES being cast change.

| File                                            | Lines | Cast Pattern                    | Change Needed                                  |
| ----------------------------------------------- | ----- | ------------------------------- | ---------------------------------------------- |
| `src/cli/stores/wizard-store.ts`                | 126   | `skill.category as Subcategory` | No change -- cast stays, runtime values change |
| `src/cli/lib/matrix/matrix-resolver.ts`         | 420   | `categoryId as Subcategory`     | No change -- cast stays                        |
| `src/cli/lib/matrix/matrix-health-check.ts`     | 133   | `skill.category as Subcategory` | No change -- cast stays                        |
| `src/cli/lib/configuration/config-generator.ts` | 63    | `(...) as Subcategory`          | **CHANGE NEEDED** -- see below                 |

### 4B: `extractSubcategoryFromPath` function

**File: `src/cli/lib/configuration/config-generator.ts` (lines 59-64)**

```typescript
function extractSubcategoryFromPath(categoryPath: CategoryPath): Subcategory | undefined {
  if (categoryPath === "local") return undefined;
  const parts = categoryPath.split("/");
  return (parts.length >= 2 ? parts[1] : parts[0]) as Subcategory;
}
```

**After the rename, `Subcategory` IS a `domain-subcategory` value (hyphen-separated).** This function currently splits on `/` to extract the bare subcategory. Since the new Subcategory type includes the domain prefix, this function should now return the FULL CategoryPath (minus "local") as the Subcategory.

**CHANGE NEEDED:** This function can be simplified to just return the full path as Subcategory:

```typescript
function extractSubcategoryFromPath(categoryPath: CategoryPath): Subcategory | undefined {
  if (categoryPath === "local") return undefined;
  return categoryPath as Subcategory;
}
```

**OR the function can be REMOVED entirely** since CategoryPath and Subcategory now overlap significantly. Review all callers (line 99 in same file).

### 4C: Hardcoded subcategory string constants

| File                                                  | Line | Constant                                 | Change Needed               |
| ----------------------------------------------------- | ---- | ---------------------------------------- | --------------------------- |
| `src/cli/lib/wizard/build-step-logic.ts`              | 15   | `FRAMEWORK_SUBCATEGORY_ID = "framework"` | Change to `"web-framework"` |
| `src/cli/components/hooks/use-category-grid-input.ts` | 7    | `FRAMEWORK_CATEGORY_ID = "framework"`    | Change to `"web-framework"` |

### 4D: Files with `Subcategory` in function signatures (no code change, type auto-updates)

| File                                                  | Usage                                                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/cli/stores/wizard-store.ts`                      | `toggleTechnology(domain, subcategory: Subcategory, ...)`, `populateFromStack(...)`, various typed entries |
| `src/cli/lib/wizard/build-step-logic.ts`              | `SubcategorySelections` in function params                                                                 |
| `src/cli/lib/stacks/stacks-loader.ts`                 | `typedEntries<Subcategory, SkillAssignment[]>(...)`                                                        |
| `src/cli/lib/resolver.ts`                             | `typedKeys<Subcategory>(...)`, import                                                                      |
| `src/cli/lib/matrix/matrix-resolver.ts`               | `categoryId as Subcategory` cast                                                                           |
| `src/cli/lib/matrix/matrix-health-check.ts`           | `typedEntries<Subcategory, ...>`, `skill.category as Subcategory`                                          |
| `src/cli/components/wizard/category-grid.tsx`         | `id: Subcategory` in CategoryRow, `onToggle(categoryId: Subcategory, ...)`                                 |
| `src/cli/components/wizard/step-build.tsx`            | `SubcategorySelections`, `onToggle(subcategoryId: Subcategory, ...)`                                       |
| `src/cli/components/hooks/use-category-grid-input.ts` | `isSectionLocked(categoryId: Subcategory, ...)`, `findNextUnlockedIndex(...)`                              |
| `src/cli/components/hooks/use-framework-filtering.ts` | `SubcategorySelections` in type                                                                            |
| `src/cli/lib/configuration/config-generator.ts`       | `extractSubcategoryFromPath` return type                                                                   |

All of these auto-update when the `Subcategory` union type changes. **No code changes needed** in these files beyond what's already listed.

---

## Phase 5: External Repos

### `/Users/vincentbollaert/dev/personal/claude-subagents`

**Total metadata.yaml files:** 87

**Current category values found (with counts):**

| Current Value        | Count | New Value                |
| -------------------- | ----- | ------------------------ | --------------------------------------------- |
| `testing`            | 6     | `web-testing`            |
| `methodology`        | 6     | `shared-methodology`     |
| `client-state`       | 6     | `web-client-state`       |
| `server-state`       | 5     | `web-server-state`       |
| ~~`meta-framework`~~ | ~~4~~ | ~~`web-meta-framework`~~ | **D-35: merged into `framework` before D-31** |
| `framework`          | 4     | `web-framework`          |
| `ui-components`      | 3     | `web-ui-components`      |
| `tooling`            | 3     | `shared-tooling`         |
| `styling`            | 3     | `web-styling`            |
| `realtime`           | 3     | `web-realtime`           |
| `i18n`               | 3     | `web-i18n`               |
| `forms`              | 3     | `web-forms`              |
| `api`                | 3     | `api-api`                |
| `animation`          | 3     | `web-animation`          |
| `analytics`          | 3     | `api-analytics`          |
| `utilities`          | 2     | `web-utilities`          |
| `reviewing`          | 2     | `shared-reviewing`       |
| `pwa`                | 2     | `web-pwa`                |
| `observability`      | 2     | `api-observability`      |
| `mobile-framework`   | 2     | `mobile-framework`       |
| `error-handling`     | 2     | `web-error-handling`     |
| `email`              | 2     | `api-email`              |
| `database`           | 2     | `api-database`           |
| `cli-framework`      | 2     | `cli-framework`          |
| `web-performance`    | 1     | `web-performance`        |
| `security`           | 1     | `shared-security`        |
| `research`           | 1     | `shared-research`        |
| `performance`        | 1     | `api-performance`        |
| `monorepo`           | 1     | `shared-monorepo`        |
| `mocking`            | 1     | `web-mocking`            |
| `files`              | 1     | `web-files`              |
| `file-upload`        | 1     | `web-file-upload`        |
| `ci-cd`              | 1     | `shared-ci-cd`           |
| `auth`               | 1     | `api-auth`               |
| `accessibility`      | 1     | `web-accessibility`      |

**Total files to change:** 87 metadata.yaml files

### `/Users/vincentbollaert/dev/claude/skills`

**Total metadata.yaml files:** 42

**No anomalies — all category values are now valid subcategories.** The 8 anomalies that existed (`frontend` x5, `shared` x1, `setup` x1, wrong `methodology` x1) were fixed earlier this session. The table below reflects the current, corrected state.

**Current category values found (with counts):**

| Current Value     | Count | New Value            |
| ----------------- | ----- | -------------------- |
| `methodology`     | 6     | `shared-methodology` |
| `testing`         | 3     | `web-testing`        |
| `animation`       | 3     | `web-animation`      |
| `reviewing`       | 2     | `shared-reviewing`   |
| `tooling`         | 3     | `shared-tooling`     |
| `utilities`       | 2     | `web-utilities`      |
| `styling`         | 2     | `web-styling`        |
| `i18n`            | 2     | `web-i18n`           |
| `forms`           | 2     | `web-forms`          |
| `error-handling`  | 2     | `web-error-handling` |
| `client-state`    | 2     | `web-client-state`   |
| `api`             | 2     | `api-api`            |
| `web-performance` | 1     | `web-performance`    |
| `accessibility`   | 1     | `web-accessibility`  |
| `ui-components`   | 1     | `web-ui-components`  |
| `server-state`    | 1     | `web-server-state`   |
| `security`        | 1     | `shared-security`    |
| `research`        | 1     | `shared-research`    |
| `monorepo`        | 1     | `shared-monorepo`    |
| `framework`       | 1     | `web-framework`      |
| `files`           | 1     | `web-files`          |
| `file-upload`     | 1     | `web-file-upload`    |
| `database`        | 1     | `api-database`       |

**Total files to change:** 42 metadata.yaml files (all purely mechanical renames)

---

## Phase 6: Test Updates

### Test files with mock subcategory data

| File                                                                           | Type of Change                                                                                                                                              |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/lib/__tests__/helpers.ts`                                             | `createMockCategory("framework" as Subcategory, ...)` -> `createMockCategory("web-framework" as Subcategory, ...)` -- 6+ locations (lines 605-632, 723-737) |
| `src/cli/lib/__tests__/commands/edit.test.ts`                                  | `categories` objects with bare keys like `{ framework: ..., "client-state": ... }` -> domain-prefixed keys (lines 120-125, 284-290)                         |
| `src/cli/stores/wizard-store.test.ts`                                          | `createMockCategory("error-handling" as Subcategory, ...)`, `createMockCategory("framework" as Subcategory, ...)` (lines 553-566)                           |
| `src/cli/lib/matrix/skill-resolution.integration.test.ts`                      | 11 `createMockCategory("..." as Subcategory, ...)` calls (lines 189-213) + `Object.keys(matrix.categories) as Subcategory[]` (line 369)                     |
| `src/cli/lib/matrix/matrix-health-check.test.ts`                               | `createCategory` and `createSkill` with bare subcategory values (lines 18, 35, 345)                                                                         |
| `src/cli/lib/matrix/matrix-resolver.test.ts`                                   | ~15 inline `Record<Subcategory, CategoryDefinition>` objects with bare keys like `framework`, `"client-state"` (lines 37, 343, 423, 821, 1440, 1463, etc.)  |
| `src/cli/components/wizard/step-build.test.tsx`                                | `Record<Subcategory, CategoryDefinition>` cast (line 32), `SubcategorySelections` objects with bare keys (lines 591, 610, 634, 657)                         |
| `src/cli/components/wizard/category-grid.test.tsx`                             | `createCategory("cat-${i}" as Subcategory, ...)` -- synthetic test IDs (lines 1164, 1187). These can stay as-is since they use arbitrary test values.       |
| `src/cli/lib/__tests__/fixtures/create-test-source.ts`                         | Uses `rawSubcategory` extraction logic (lines 452-457) -- may need update                                                                                   |
| `src/cli/lib/loading/source-loader.test.ts`                                    | Comments reference "Subcategory" -- minimal changes (lines 188, 215)                                                                                        |
| `src/cli/lib/stacks/stack-plugin-compiler.test.ts`                             | Uses Subcategory type -- verify test data                                                                                                                   |
| `src/cli/lib/__tests__/test-fixtures.ts`                                       | Verify test skill fixtures use correct category values                                                                                                      |
| `src/cli/lib/__tests__/integration/consumer-stacks-matrix.integration.test.ts` | Uses Subcategory -- verify test data                                                                                                                        |
| `src/cli/lib/__tests__/integration/source-switching.integration.test.ts`       | Uses Subcategory -- verify test data                                                                                                                        |
| `src/cli/lib/__tests__/integration/wizard-init-compile-pipeline.test.ts`       | Uses Subcategory -- verify test data                                                                                                                        |
| `src/cli/lib/__tests__/user-journeys/edit-recompile.test.ts`                   | Uses Subcategory -- verify test data                                                                                                                        |
| `src/cli/lib/__tests__/commands/eject.test.ts`                                 | Uses Subcategory -- verify test data                                                                                                                        |
| `src/cli/lib/__tests__/commands/list.test.ts`                                  | Uses Subcategory -- verify test data                                                                                                                        |
| `src/cli/lib/__tests__/commands/uninstall.test.ts`                             | Uses Subcategory -- verify test data                                                                                                                        |
| `src/cli/lib/skills/skill-copier.test.ts`                                      | Uses Subcategory -- verify test data                                                                                                                        |
| `src/cli/lib/skills/skill-plugin-compiler.test.ts`                             | Uses Subcategory -- verify test data                                                                                                                        |
| `src/cli/lib/versioning.test.ts`                                               | Uses Subcategory -- verify test data                                                                                                                        |
| `src/cli/lib/wizard/build-step-logic.test.ts`                                  | Uses SubcategorySelections with bare keys -- need to prefix                                                                                                 |

**Estimated test changes: ~20+ test files with subcategory value updates.**

---

## Execution Order

### Prerequisite: D-35 (Merge meta-framework into framework)

Must be completed before D-31 begins. This removes `meta-framework` from the type system, reducing the Subcategory union from 39 to 38 values, and SUBCATEGORY_VALUES from 37 to 36.

### Step 1: CLI Type System

1. Update `src/cli/types/matrix.ts` -- change all 38 `Subcategory` union values (39 minus meta-framework)
2. Run `npx tsc --noEmit` -- expect MANY errors from mismatched string literals in YAML-loaded data and test files. This tells us everywhere that needs updating.

### Step 2: Schema Layer

3. Update `src/cli/lib/schemas.ts`:
   - `SUBCATEGORY_VALUES` array (37 values)
   - `stackSubcategorySchema` extended keys (2 values)
   - `categoryPathSchema` regex (add `shared`)

### Step 3: JSON Schemas

4. Update `src/schemas/skills-matrix.schema.json` (3 enum arrays = 111 values)
5. Update `src/schemas/stacks.schema.json` (1 enum array = 39 values)
6. Update `src/schemas/project-config.schema.json` (1 enum array = 39 values)

### Step 4: YAML Configs

7. Update `config/skills-matrix.yaml` (37 keys + 37 id fields = 74 changes)
8. Update `config/stacks.yaml` (~686 key renames)
9. Update `src/cli/defaults/agent-mappings.yaml`:
   - `skillToAgents` patterns may need updating if they reference bare subcategory names
   - (`preloadedSkills` and `subcategoryAliases` already removed — dead code)

### Step 5: Source Code

10. Update `src/cli/lib/wizard/build-step-logic.ts` -- `FRAMEWORK_SUBCATEGORY_ID`
11. Update `src/cli/components/hooks/use-category-grid-input.ts` -- `FRAMEWORK_CATEGORY_ID`
12. Update `src/cli/lib/configuration/config-generator.ts` -- simplify `extractSubcategoryFromPath`

### Step 6: Run `npx tsc --noEmit`

13. Fix any remaining type errors (should be minimal after Steps 1-5)

### Step 7: Tests

14. Update all test files with bare subcategory values (see Phase 6 list)
15. Run `npm test` -- fix failures
16. Iterate until all 2309+ tests pass

### Step 8: External Repos

17. Update `/Users/vincentbollaert/dev/personal/claude-subagents/src/skills/*/metadata.yaml` (87 files — all mechanical renames)
18. Update `/Users/vincentbollaert/dev/claude/skills/src/skills/*/metadata.yaml` (42 files — all mechanical renames, anomalies already fixed)

### Step 9: Integration Verification

20. Run full CLI build (`npm run build`)
21. Run full test suite (`npm test`)
22. Manually test wizard flow to verify categories render correctly
23. Manually test compile to verify stacks resolve correctly

---

## Risk Assessment

### Breaking Changes for Consumers

- **Consumer `config.yaml` files** that have `stack:` sections with bare subcategory keys will BREAK. Any project that has already run the wizard and saved a config.yaml will have bare keys like `framework:`, `testing:`, etc.
- **No backward compatibility.** Bare keys will not be supported. Consumers must re-run the wizard or manually update their config.yaml files. This is acceptable since the CLI is pre-1.0.

### Cross-Repo Coordination

- All 3 repos (CLI, claude-subagents, claude/skills) must be updated together. The CLI must be updated first since it defines the valid Subcategory values.
- The external repos' metadata.yaml files must match the new Subcategory values, otherwise the matrix merge will fail to find categories for skills.

### Rollback Strategy

- Since this is a type + data rename, rollback is a full revert of all changes.
- No database migrations or irreversible state changes are involved.
- Git history provides full rollback capability.

### Scope Concerns

- This is a LARGE change touching 30+ source files, 87+ external metadata files, and ~2300 test assertions.
- Consider splitting into sub-PRs:
  1. PR 1: D-35 — merge meta-framework into framework
  2. PR 2: D-31 — update all CLI types, schemas, configs, source code
  3. PR 3: D-31 — update external repos (metadata.yaml files)

### ~~`preloadedSkills` in agent-mappings.yaml~~ RESOLVED

Removed — dead code. Never consumed by TypeScript. Preloading comes from `stacks.yaml`.

### ~~`subcategoryAliases` Removal~~ RESOLVED

Removed — dead code. Never consumed by TypeScript.

---

## Open Questions

1. ~~**web-extras domain in Subcategory:**~~ **RESOLVED** -- web-extras is not a real domain, just a UI grouping. All web-extras subcategories now use the `web-` prefix (e.g. `web-animation`, `web-accessibility`). They match `${SkillIdPrefix}-${string}` with SkillIdPrefix=`web`.

2. **`shared` domain in Subcategory:** Same issue -- `shared` is NOT in `SkillIdPrefix`. Values like `shared-methodology` don't match `${SkillIdPrefix}-${string}`.

3. ~~**Consumer config backward compatibility:**~~ **RESOLVED** — No backward compatibility. Bare keys will not be supported. Consumers re-run the wizard.

4. ~~**`preloadedSkills` resolution:**~~ **RESOLVED** — Dead code, removed from agent-mappings.yaml.

5. **`base-framework` and `platform`:** These stacks-only keys don't have categories in skills-matrix.yaml. What domain should they get? Proposed: `web-base-framework` and `mobile-platform` respectively.

---

## Appendix A: Per-Skill Lookup Tables

**These tables are the definitive "from → to" mapping for every skill in every repo.** The executing agent must use ONLY these tables — no interpretation, no inference. Find the skill, read "Current" column, replace with "Target" column value.

### Repo 1: `/Users/vincentbollaert/dev/personal/claude-subagents` (87 skills)

**No anomalies — all current values are valid subcategories. Purely mechanical rename.**

| #   | Skill Directory                               | Current            | Target               |
| --- | --------------------------------------------- | ------------------ | -------------------- | ----------------------------------------------------- |
| 1   | `api-analytics-posthog-analytics`             | `analytics`        | `api-analytics`      |
| 2   | `api-analytics-setup-posthog`                 | `analytics`        | `api-analytics`      |
| 3   | `api-auth-better-auth-drizzle-hono`           | `auth`             | `api-auth`           |
| 4   | `api-ci-cd-github-actions`                    | `ci-cd`            | `shared-ci-cd`       |
| 5   | `api-database-drizzle`                        | `database`         | `api-database`       |
| 6   | `api-database-prisma`                         | `database`         | `api-database`       |
| 7   | `api-email-resend-react-email`                | `email`            | `api-email`          |
| 8   | `api-email-setup-resend`                      | `email`            | `api-email`          |
| 9   | `api-flags-posthog-flags`                     | `analytics`        | `api-analytics`      |
| 10  | `api-framework-express`                       | `api`              | `api-api`            |
| 11  | `api-framework-fastify`                       | `api`              | `api-api`            |
| 12  | `api-framework-hono`                          | `api`              | `api-api`            |
| 13  | `api-observability-axiom-pino-sentry`         | `observability`    | `api-observability`  |
| 14  | `api-observability-setup-axiom-pino-sentry`   | `observability`    | `api-observability`  |
| 15  | `api-performance-api-performance`             | `performance`      | `api-performance`    |
| 16  | `api-testing-api-testing`                     | `testing`          | `web-testing`        |
| 17  | `cli-framework-cli-commander`                 | `cli-framework`    | `cli-framework`      |
| 18  | `cli-framework-oclif-ink`                     | `cli-framework`    | `cli-framework`      |
| 19  | `infra-env-setup-env`                         | `tooling`          | `shared-tooling`     |
| 20  | `infra-monorepo-turborepo`                    | `monorepo`         | `shared-monorepo`    |
| 21  | `infra-tooling-setup-tooling`                 | `tooling`          | `shared-tooling`     |
| 22  | `meta-methodology-anti-over-engineering`      | `methodology`      | `shared-methodology` |
| 23  | `meta-methodology-context-management`         | `methodology`      | `shared-methodology` |
| 24  | `meta-methodology-improvement-protocol`       | `methodology`      | `shared-methodology` |
| 25  | `meta-methodology-investigation-requirements` | `methodology`      | `shared-methodology` |
| 26  | `meta-methodology-success-criteria`           | `methodology`      | `shared-methodology` |
| 27  | `meta-methodology-write-verification`         | `methodology`      | `shared-methodology` |
| 28  | `meta-research-research-methodology`          | `research`         | `shared-research`    |
| 29  | `meta-reviewing-cli-reviewing`                | `reviewing`        | `shared-reviewing`   |
| 30  | `meta-reviewing-reviewing`                    | `reviewing`        | `shared-reviewing`   |
| 31  | `mobile-framework-expo`                       | `mobile-framework` | `mobile-framework`   |
| 32  | `mobile-framework-react-native`               | `mobile-framework` | `mobile-framework`   |
| 33  | `security-auth-security`                      | `security`         | `shared-security`    |
| 34  | `web-accessibility-web-accessibility`         | `accessibility`    | `web-accessibility`  |
| 35  | `web-animation-css-animations`                | `animation`        | `web-animation`      |
| 36  | `web-animation-framer-motion`                 | `animation`        | `web-animation`      |
| 37  | `web-animation-view-transitions`              | `animation`        | `web-animation`      |
| 38  | `web-data-fetching-graphql-apollo`            | `server-state`     | `web-server-state`   |
| 39  | `web-data-fetching-graphql-urql`              | `server-state`     | `web-server-state`   |
| 40  | `web-data-fetching-swr`                       | `server-state`     | `web-server-state`   |
| 41  | `web-data-fetching-trpc`                      | `server-state`     | `web-server-state`   |
| 42  | `web-error-handling-error-boundaries`         | `error-handling`   | `web-error-handling` |
| 43  | `web-error-handling-result-types`             | `error-handling`   | `web-error-handling` |
| 44  | `web-files-file-upload-patterns`              | `file-upload`      | `web-file-upload`    |
| 45  | `web-files-image-handling`                    | `files`            | `web-files`          |
| 46  | `web-forms-react-hook-form`                   | `forms`            | `web-forms`          |
| 47  | `web-forms-vee-validate`                      | `forms`            | `web-forms`          |
| 48  | `web-forms-zod-validation`                    | `forms`            | `web-forms`          |
| 49  | `web-framework-angular-standalone`            | `framework`        | `web-framework`      |
| 50  | `web-framework-nextjs-app-router`             | `meta-framework`   | `web-framework`      | D-35 changes to `framework` first, then D-31 prefixes |
| 51  | `web-framework-nextjs-server-actions`         | `meta-framework`   | `web-framework`      | D-35 changes to `framework` first, then D-31 prefixes |
| 52  | `web-framework-nuxt`                          | `meta-framework`   | `web-framework`      | D-35 changes to `framework` first, then D-31 prefixes |
| 53  | `web-framework-react`                         | `framework`        | `web-framework`      |
| 54  | `web-framework-remix`                         | `meta-framework`   | `web-framework`      | D-35 changes to `framework` first, then D-31 prefixes |
| 55  | `web-framework-solidjs`                       | `framework`        | `web-framework`      |
| 56  | `web-framework-vue-composition-api`           | `framework`        | `web-framework`      |
| 57  | `web-i18n-next-intl`                          | `i18n`             | `web-i18n`           |
| 58  | `web-i18n-react-intl`                         | `i18n`             | `web-i18n`           |
| 59  | `web-i18n-vue-i18n`                           | `i18n`             | `web-i18n`           |
| 60  | `web-mocks-msw`                               | `mocking`          | `web-mocking`        |
| 61  | `web-performance-web-performance`             | `web-performance`  | `web-performance`    |
| 62  | `web-pwa-offline-first`                       | `pwa`              | `web-pwa`            |
| 63  | `web-pwa-service-workers`                     | `pwa`              | `web-pwa`            |
| 64  | `web-realtime-socket-io`                      | `realtime`         | `web-realtime`       |
| 65  | `web-realtime-sse`                            | `realtime`         | `web-realtime`       |
| 66  | `web-realtime-websockets`                     | `realtime`         | `web-realtime`       |
| 67  | `web-server-state-react-query`                | `server-state`     | `web-server-state`   |
| 68  | `web-state-jotai`                             | `client-state`     | `web-client-state`   |
| 69  | `web-state-mobx`                              | `client-state`     | `web-client-state`   |
| 70  | `web-state-ngrx-signalstore`                  | `client-state`     | `web-client-state`   |
| 71  | `web-state-pinia`                             | `client-state`     | `web-client-state`   |
| 72  | `web-state-redux-toolkit`                     | `client-state`     | `web-client-state`   |
| 73  | `web-state-zustand`                           | `client-state`     | `web-client-state`   |
| 74  | `web-styling-cva`                             | `styling`          | `web-styling`        |
| 75  | `web-styling-scss-modules`                    | `styling`          | `web-styling`        |
| 76  | `web-styling-tailwind`                        | `styling`          | `web-styling`        |
| 77  | `web-testing-cypress-e2e`                     | `testing`          | `web-testing`        |
| 78  | `web-testing-playwright-e2e`                  | `testing`          | `web-testing`        |
| 79  | `web-testing-react-testing-library`           | `testing`          | `web-testing`        |
| 80  | `web-testing-vitest`                          | `testing`          | `web-testing`        |
| 81  | `web-testing-vue-test-utils`                  | `testing`          | `web-testing`        |
| 82  | `web-tooling-storybook`                       | `tooling`          | `shared-tooling`     |
| 83  | `web-ui-radix-ui`                             | `ui-components`    | `web-ui-components`  |
| 84  | `web-ui-shadcn-ui`                            | `ui-components`    | `web-ui-components`  |
| 85  | `web-ui-tanstack-table`                       | `ui-components`    | `web-ui-components`  |
| 86  | `web-utilities-date-fns`                      | `utilities`        | `web-utilities`      |
| 87  | `web-utilities-native-js`                     | `utilities`        | `web-utilities`      |

**Note:** `api-testing-api-testing` (#16) has `testing` which maps to `web-testing` per skills-matrix.yaml. This is correct per the current matrix — there is no separate `api-testing` subcategory.

---

### Repo 2: `/Users/vincentbollaert/dev/claude/skills` (42 skills)

**No anomalies — all 8 former anomalies were fixed earlier this session.** All current values are valid subcategories. Purely mechanical rename.

| #   | Skill Directory                               | Current           | Target               |
| --- | --------------------------------------------- | ----------------- | -------------------- |
| 1   | `api-database-drizzle`                        | `database`        | `api-database`       |
| 2   | `api-framework-express`                       | `api`             | `api-api`            |
| 3   | `api-framework-hono`                          | `api`             | `api-api`            |
| 4   | `infra-env-setup-env`                         | `tooling`         | `shared-tooling`     |
| 5   | `infra-monorepo-turborepo`                    | `monorepo`        | `shared-monorepo`    |
| 6   | `infra-tooling-setup-tooling`                 | `tooling`         | `shared-tooling`     |
| 7   | `meta-methodology-anti-over-engineering`      | `methodology`     | `shared-methodology` |
| 8   | `meta-methodology-context-management`         | `methodology`     | `shared-methodology` |
| 9   | `meta-methodology-improvement-protocol`       | `methodology`     | `shared-methodology` |
| 10  | `meta-methodology-investigation-requirements` | `methodology`     | `shared-methodology` |
| 11  | `meta-methodology-success-criteria`           | `methodology`     | `shared-methodology` |
| 12  | `meta-methodology-write-verification`         | `methodology`     | `shared-methodology` |
| 13  | `meta-research-research-methodology`          | `research`        | `shared-research`    |
| 14  | `meta-reviewing-cli-reviewing`                | `reviewing`       | `shared-reviewing`   |
| 15  | `meta-reviewing-reviewing`                    | `reviewing`       | `shared-reviewing`   |
| 16  | `security-auth-security`                      | `security`        | `shared-security`    |
| 17  | `web-accessibility-web-accessibility`         | `accessibility`   | `web-accessibility`  |
| 18  | `web-animation-css-animations`                | `animation`       | `web-animation`      |
| 19  | `web-animation-framer-motion`                 | `animation`       | `web-animation`      |
| 20  | `web-animation-view-transitions`              | `animation`       | `web-animation`      |
| 21  | `web-error-handling-error-boundaries`         | `error-handling`  | `web-error-handling` |
| 22  | `web-error-handling-result-types`             | `error-handling`  | `web-error-handling` |
| 23  | `web-files-file-upload-patterns`              | `file-upload`     | `web-file-upload`    |
| 24  | `web-files-image-handling`                    | `files`           | `web-files`          |
| 25  | `web-forms-react-hook-form`                   | `forms`           | `web-forms`          |
| 26  | `web-forms-zod-validation`                    | `forms`           | `web-forms`          |
| 27  | `web-framework-react`                         | `framework`       | `web-framework`      |
| 28  | `web-i18n-i18next`                            | `i18n`            | `web-i18n`           |
| 29  | `web-i18n-react-intl`                         | `i18n`            | `web-i18n`           |
| 30  | `web-performance-web-performance`             | `web-performance` | `web-performance`    |
| 31  | `web-server-state-react-query`                | `server-state`    | `web-server-state`   |
| 32  | `web-state-mobx`                              | `client-state`    | `web-client-state`   |
| 33  | `web-state-zustand`                           | `client-state`    | `web-client-state`   |
| 34  | `web-styling-cva`                             | `styling`         | `web-styling`        |
| 35  | `web-styling-tailwind-v3`                     | `styling`         | `web-styling`        |
| 36  | `web-testing-playwright-e2e`                  | `testing`         | `web-testing`        |
| 37  | `web-testing-react-testing-library`           | `testing`         | `web-testing`        |
| 38  | `web-testing-vitest`                          | `testing`         | `web-testing`        |
| 39  | `web-tooling-storybook`                       | `tooling`         | `shared-tooling`     |
| 40  | `web-ui-radix-ui`                             | `ui-components`   | `web-ui-components`  |
| 41  | `web-utilities-date-fns`                      | `utilities`       | `web-utilities`      |
| 42  | `web-utilities-native-js`                     | `utilities`       | `web-utilities`      |

---

### CLI Repo: `/Users/vincentbollaert/dev/personal/cli` (no per-skill metadata)

The CLI repo does not have per-skill metadata.yaml files. Its changes are covered by Phases 1-7 of this plan (types, schemas, YAML configs, source code, tests). The subcategory values are defined in:

- `src/cli/types/matrix.ts` — `Subcategory` union type (38 values after D-35: 36 categories + 2 stacks-only)
- `src/cli/lib/schemas.ts` — `SUBCATEGORY_VALUES` array (36 values after D-35)
- `config/skills-matrix.yaml` — category keys + id fields
- `src/schemas/*.schema.json` — JSON schema enums
- Test files — mock category values (~20 files)

Use the **Current → Target Mapping** table at the top of this document for all CLI repo changes.

---

## Appendix B: Quick-Reference Rename Map

**Prerequisite: D-35 must have already run before using this map.** D-35 merges `meta-framework` into `framework`, so the 4 skills in claude-subagents that currently have `category: meta-framework` will already be `category: framework` by the time D-31 executes. This map therefore does not include `meta-framework`.

**For the executing agent: this is the complete list of unique `category:` values found across all external repos and what each must become.** Apply this map to every `metadata.yaml` file in both repos. All values can be bulk-renamed — no per-skill exceptions remain (anomalies were fixed).

| From (current `category:` value) | To (new `category:` value) | Repos affected   |
| -------------------------------- | -------------------------- | ---------------- |
| `accessibility`                  | `web-accessibility`        | both             |
| `analytics`                      | `api-analytics`            | claude-subagents |
| `animation`                      | `web-animation`            | both             |
| `api`                            | `api-api`                  | both             |
| `auth`                           | `api-auth`                 | claude-subagents |
| `ci-cd`                          | `shared-ci-cd`             | claude-subagents |
| `cli-framework`                  | `cli-framework`            | claude-subagents |
| `client-state`                   | `web-client-state`         | both             |
| `database`                       | `api-database`             | both             |
| `email`                          | `api-email`                | claude-subagents |
| `error-handling`                 | `web-error-handling`       | both             |
| `file-upload`                    | `web-file-upload`          | both             |
| `files`                          | `web-files`                | both             |
| `forms`                          | `web-forms`                | both             |
| `framework`                      | `web-framework`            | both             |
| `i18n`                           | `web-i18n`                 | both             |
| `methodology`                    | `shared-methodology`       | both             |
| `mobile-framework`               | `mobile-framework`         | claude-subagents |
| `mocking`                        | `web-mocking`              | claude-subagents |
| `monorepo`                       | `shared-monorepo`          | both             |
| `observability`                  | `api-observability`        | claude-subagents |
| `performance`                    | `api-performance`          | claude-subagents |
| `pwa`                            | `web-pwa`                  | claude-subagents |
| `realtime`                       | `web-realtime`             | claude-subagents |
| `research`                       | `shared-research`          | both             |
| `reviewing`                      | `shared-reviewing`         | both             |
| `security`                       | `shared-security`          | both             |
| `server-state`                   | `web-server-state`         | both             |
| `styling`                        | `web-styling`              | both             |
| `testing`                        | `web-testing`              | both             |
| `tooling`                        | `shared-tooling`           | both             |
| `ui-components`                  | `web-ui-components`        | both             |
| `utilities`                      | `web-utilities`            | both             |
| `web-performance`                | `web-performance`          | both             |

**No-change values** (already prefixed): `cli-framework`, `mobile-framework`, `web-performance`.
