# CLI UX - Task Tracking

> Dedicated tracking for CLI UX/UI improvements.
> For architecture details, see [docs/architecture.md](./docs/architecture.md).

---

## Active Tasks

No active tasks. All UX-10 refactoring phases are complete.

---

## Completed Tasks

| ID     | Task                                            | Status | Notes                                                                 |
| ------ | ----------------------------------------------- | ------ | --------------------------------------------------------------------- |
| U1     | Progress navigation bar - tab styling           | DONE   | Green bg active, white bg completed, no circles                       |
| U2     | Header - add version display                    | DONE   | Pass `this.config.version` from Init command                          |
| U3     | Footer - split layout with WizardFooter         | DONE   | Left: nav controls, right: action hints                               |
| U6     | Extract WizardLayout component                  | DONE   | WizardTabs + children + WizardFooter, centralized shortcuts           |
| U7     | Simplify WizardTabs styling                     | DONE   | Text-only, border lines, "Approach" -> "Intro", version bar           |
| U8     | Fix version prop flow                           | DONE   | Prop-drill from oclif this.config.version (was broken)                |
| U9     | ASCII art banner for init                       | DONE   | "AGENTS INC" banner on init command                                   |
| U4     | Build step - framework-first flow               | DONE   | Hide categories until framework selected, background colors           |
| U5     | Import third-party skills command               | DONE   | `cc import skill github:owner/repo`                                   |
| UX-01  | Style the home screen                           | DONE   | Layout, branding, and navigation styling for the CLI home screen      |
| UX-10a | Extract `lib/skill-metadata.ts`                 | DONE   | -254 lines duplication from update.tsx, outdated.ts, diff.ts (0.14.1) |
| UX-10b | Extract `lib/config-saver.ts`                   | DONE   | -36 lines duplication from init.tsx, eject.ts (0.14.1)                |
| UX-10e | Extract `lib/plugin-manifest-finder.ts`         | DONE   | -72 lines from 4 version/\* files (0.14.1)                            |
| UX-11  | Build step: cycle through all domains           | DONE   | `populateFromStack()` now sets ALL_DOMAINS (0.16.0)                   |
| UX-10  | Refactor command files - extract logic to lib/  | DONE   | All 6 phases complete (0.14.1-0.16.0)                                 |
| UX-10c | Phase 3: Extract `lib/config-merger.ts`         | DONE   | 20 tests, merge rules for identity/skills/agents/stack                |
| UX-10d | Phase 4: Extract `lib/local-installer.ts`       | DONE   | 9 tests, init.tsx reduced from 609 to 348 lines                       |
| UX-10f | Phase 6: Consolidate `getCurrentDate()`         | DONE   | Removed duplicates from 3 files, import from lib/versioning           |
| UX-02  | Align skills-matrix categories with domains     | DONE   | Production code updated; test fixtures cleaned up                     |
| UX-03  | Build step UX improvements                      | DONE   | Framework-first locking flow implemented; expert mode retained        |
| UX-12  | Fix missing subcategories after stack selection | DONE   | Removed synthetic local category; fixed stacks.yaml mismatches        |

---

## Backlog

| ID    | Task                                         | Priority | Notes                                            |
| ----- | -------------------------------------------- | -------- | ------------------------------------------------ |
| UX-04 | Interactive skill search polish              | Medium   | Manual testing + tests for interactive component |
| UX-05 | Refine step - skills.sh integration          | Low      | Community skill alternatives in Refine step      |
| UX-06 | Search with color highlighting               | Low      | Deferred - needs more UX thought                 |
| UX-07 | Incompatibility tooltips                     | Low      | Show reason when hovering disabled options       |
| UX-08 | Keyboard shortcuts help overlay              | Low      | In-wizard help for keybindings                   |
| UX-09 | Animations/transitions                       | Low      | Polish pass for step transitions                 |
| UX-13 | Add readable schemas on subagents and skills | Medium   | -                                                |

---

## Investigation Notes

### UX-11: Build step domain cycling (RESOLVED in 0.16.0)

Fixed via Option B: `populateFromStack()` in `wizard-store.ts` now sets `selectedDomains` to `ALL_DOMAINS` constant (`["web", "api", "cli", "mobile", "shared"]`), regardless of which domains the stack covers.

---

### UX-12: Missing subcategories in build view after stack selection

**Root cause:** This is a multi-part issue caused by skills in the stack not being found in `matrix.skills`, which means their categories never produce options in `buildCategoriesForDomain()`.

**Detailed analysis:**

**Part 1: Skill ID resolution mismatch in `stackToResolvedStack`**

In `src/cli/lib/source-loader.ts` lines 194-231, `stackToResolvedStack()` converts a `Stack` (from `config/stacks.yaml`) to a `ResolvedStack`. It calls `resolveAgentConfigToSkills(agentConfig, skillAliases)` to resolve technology aliases (like "react", "zustand") to full skill IDs (like "web-framework-react"). These resolved IDs go into `allSkillIds`.

Then in `step-stack.tsx` lines 82-93, `StackSelection` iterates `resolvedStack.allSkillIds` and does `matrix.skills[skillId]` to look up each skill. If the skill ID in `allSkillIds` doesn't exactly match a key in `matrix.skills`, the lookup returns `undefined` and that skill is silently skipped. This means its category is never added to `stackAgents`, so its domain/subcategory pair is missing from `domainSelections`.

The `matrix.skills` keys come from `ExtractedSkillMetadata.id` which is the frontmatter `name` field from each skill's `SKILL.md`. The `allSkillIds` come from alias resolution. If there's any mismatch between the resolved alias target and the actual skill ID in the filesystem, the skill won't be found.

**Part 2: Categories without skills produce empty rows (filtered out)**

In `src/cli/components/wizard/step-build.tsx` lines 215-272, `buildCategoriesForDomain()` does two things:

1. Gets subcategories for the domain: `Object.values(matrix.categories).filter(cat => cat.domain === domain && cat.parent)` (line 227-228)
2. For each subcategory, calls `getAvailableSkills(cat.id, ...)` which iterates `matrix.skills` and returns skills matching that category ID (matrix-resolver.ts lines 438-485)
3. At line 271, rows with zero options are filtered out: `categoryRows.filter(row => row.options.length > 0)`

So if a subcategory has no skills in `matrix.skills` with a matching `category` field, it produces an empty row and is filtered out. This is correct behavior -- the subcategory itself exists in `matrix.categories`, but no skills are assigned to it.

**Part 3: Local skills and the "local/custom" category**

In `src/cli/lib/source-loader.ts` lines 252-310, `mergeLocalSkillsIntoMatrix()` assigns local skills to either their original category (if `metadata.category` matches an existing category in the matrix) or to `"local/custom"`. The `"local/custom"` category has `parent: "local"` but NO `domain` field (line 242-250). This means local skills falling into "local/custom" won't appear in ANY domain's build view, because `buildCategoriesForDomain` filters for `cat.domain === domain`.

For local skills that DO preserve their original category (e.g., `category: "framework"` in metadata.yaml), they would correctly appear under the "web" domain since the "framework" category has `domain: "web"`.

**Part 4: Stacks reference subcategory IDs not in skills-matrix.yaml**

Looking at `config/stacks.yaml`, the "nextjs-fullstack" stack references subcategory aliases like:

- `mocks` (should be `mocking` per skills-matrix.yaml)
- `accessibility` (no subcategory defined -- skill exists as `web-accessibility-web-accessibility` but its `category` may not match a defined subcategory)
- `ci-cd` (no subcategory defined in skills-matrix.yaml)
- `e2e` (no subcategory defined)
- `reviewing` (top-level category, not a subcategory with a domain)

These mismatches mean the subcategory keys in the stack's agent config don't match the category IDs in `matrix.categories`, so even if skills exist, they may not map correctly to domains.

**Relevant code:**

- `src/cli/components/wizard/step-build.tsx` lines 215-272 -- `buildCategoriesForDomain()` builds category rows
- `src/cli/components/wizard/step-build.tsx` line 271 -- Filters out empty categories
- `src/cli/lib/matrix-resolver.ts` lines 438-485 -- `getAvailableSkills()` iterates `matrix.skills` by category
- `src/cli/lib/source-loader.ts` lines 252-310 -- `mergeLocalSkillsIntoMatrix()` assigns categories
- `src/cli/lib/source-loader.ts` lines 242-250 -- `LOCAL_CATEGORY_CUSTOM` has no `domain` field
- `src/cli/components/wizard/step-stack.tsx` lines 80-95 -- Stack-to-domain mapping relies on skill lookups
- `config/stacks.yaml` -- Stack agent configs use subcategory keys that may not match matrix category IDs

**Proposed fix:** This issue has multiple contributing factors that should be addressed:

1. **Add `domain` to `LOCAL_CATEGORY_CUSTOM`**: In `source-loader.ts`, the `LOCAL_CATEGORY_CUSTOM` definition (lines 242-250) should either include a domain or local skills should be placed into their correct domain-specific categories more aggressively.

2. **Ensure all subcategory IDs referenced in stacks.yaml exist in skills-matrix.yaml**: Add missing category definitions for `e2e`, `ci-cd`, `accessibility`, etc., or change the stack agent configs to use the correct existing subcategory IDs (e.g., `mocking` instead of `mocks`).

3. **Improve skill ID resolution resilience**: In `step-stack.tsx` lines 82-93, when `matrix.skills[skillId]` returns `undefined`, try resolving via alias lookup (`matrix.aliases`, `matrix.aliasesReverse`) before skipping.

4. **Consider showing empty subcategories**: Instead of filtering out categories with no options (step-build.tsx line 271), show them as empty rows so users can see what subcategories are available and understand the full domain structure. This is a UX decision.

**Note on relationship to UX-11:** These two issues compound each other. Even if UX-11 is fixed to show all domains, UX-12 means some subcategories within those domains may still be missing because the underlying skill-to-category mapping is broken. Both issues should be fixed together.

---

### UX-02: Align skills-matrix categories with domains

**Investigation completed 2026-02-07.**

#### Problem Summary

The `config/skills-matrix.yaml` defines a two-level hierarchy: top-level categories (e.g., `frontend`, `backend`, `setup`) with subcategories underneath. Each subcategory has a `domain:` field (one of `web`, `api`, `cli`, `mobile`, `shared`). The wizard UI operates entirely on **domains**, not on top-level category names. This creates confusion because:

- `frontend` category has subcategories with `domain: web`
- `backend` category has subcategories with `domain: api`
- `setup` category has subcategories with `domain: shared`
- Skill IDs use `web-*`, `api-*`, `infra-*` prefixes (matching domains, not categories)
- The wizard store, step-build component, and all UI code reference `"web"`, `"api"`, etc.
- Zero skills in the skills repo use `frontend-` or `backend-` as a prefix

The top-level category name is only used internally as a `parent:` field on subcategories and in a few code references. Aligning the names eliminates a conceptual layer that adds no value.

#### 1. Exact Renames Needed

| Current Category | New Category | Domain   | Subcategories | Skill ID Prefix | Notes                                                         |
| ---------------- | ------------ | -------- | ------------- | --------------- | ------------------------------------------------------------- |
| `frontend`       | `web`        | `web`    | 15            | `web-*`         | Direct alignment with domain and skill prefix                 |
| `backend`        | `api`        | `api`    | 7             | `api-*`         | Direct alignment with domain and skill prefix                 |
| `setup`          | `infra`      | `shared` | 3             | `infra-*`       | Aligns with skill prefix; subcategories keep `domain: shared` |
| `cli`            | (no change)  | `cli`    | 3             | `cli-*`         | Already aligned                                               |
| `mobile`         | (no change)  | `mobile` | 1             | `mobile-*`      | Already aligned                                               |
| `reviewing`      | (no change)  | (none)   | 0             | `meta-*`        | See section 5 below                                           |
| `methodology`    | (no change)  | (none)   | 0             | `meta-*`        | See section 5 below                                           |
| `research`       | (no change)  | (none)   | 0             | `meta-*`        | See section 5 below                                           |
| `shared`         | (no change)  | (none)   | 0             | -               | Top-level only, no subcategories                              |
| `local`          | (no change)  | (none)   | 0             | -               | Top-level only, no subcategories                              |

**Also rename these skill aliases** in `skills-matrix.yaml` (optional but improves consistency):

| Current Alias          | New Alias         | Notes                               |
| ---------------------- | ----------------- | ----------------------------------- |
| `frontend-performance` | `web-performance` | Alias key only, target ID unchanged |
| `backend-testing`      | `api-testing`     | Alias key only, target ID unchanged |
| `backend-performance`  | `api-performance` | Alias key only, target ID unchanged |

**Subcategory ID renames** (the `frontend/realtime` composite ID):

| Current ID          | New ID         | Notes                                          |
| ------------------- | -------------- | ---------------------------------------------- |
| `frontend/realtime` | `web/realtime` | Composite subcategory ID in skills-matrix.yaml |

#### 2. Every File That Needs Changes

**Config files (change first):**

| File                        | Changes                                                                                                                                                                                                                                                                                                                                           | Line Numbers                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/skills-matrix.yaml` | Rename `frontend:` to `web:`, `backend:` to `api:`, `setup:` to `infra:` top-level keys; update all `parent: frontend` to `parent: web`, `parent: backend` to `parent: api`, `parent: setup` to `parent: infra`; rename `frontend/realtime` to `web/realtime`; rename alias keys `frontend-performance`, `backend-testing`, `backend-performance` | L19-22 (frontend def), L28-31 (backend def), L46-49 (setup def), L112-256 (15x `parent: frontend`), L265-325 (7x `parent: backend`), L351-375 (3x `parent: setup`), L248-249 (frontend/realtime), L928-930 (alias keys) |

**Schema file (no changes needed):**

| File                                    | Changes                                                                                                                                                                                                                                                       | Line Numbers |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `src/schemas/skills-matrix.schema.json` | **None** -- the schema uses `additionalProperties` for categories and does not constrain category name values. The `domain` enum (`["web", "api", "cli", "mobile", "shared"]`) is unchanged. The `id` pattern `^[a-z][a-z0-9-]*$` accepts all proposed names. | -            |

**Type file (comments only):**

| File                      | Changes                                                                                                    | Line Numbers       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------ |
| `src/cli/types-matrix.ts` | Update JSDoc examples: `"frontend"` -> `"web"`, `"backend"` -> `"api"` in comments on lines 8, 45, 52, 232 | L8, L45, L52, L232 |

**Production code files:**

| File                                   | Changes                                                                                                                                                                                                                                                                                                                     | Line Numbers                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `src/cli/lib/skill-agent-mappings.ts`  | Rename `"frontend/*"` to `"web/*"`, `"backend/*"` to `"api/*"`, `"frontend/testing"` to `"web/testing"`, `"backend/testing"` to `"api/testing"`, `"frontend/mocks"` to `"web/mocks"`, `framework: "frontend/framework"` to `framework: "web/framework"`, etc. **Note: this file is deprecated** but still used as fallback. | L24, L36, L131-132, L134, L157-161 |
| `src/cli/lib/marketplace-generator.ts` | Change `category: "frontend"` to `category: "web"`, `category: "backend"` to `category: "api"`, `category: "setup"` to `category: "infra"` in CATEGORY_PATTERNS. Remove the `skill-frontend-` and `skill-backend-` fallback patterns (L38-39) since no skills use those prefixes.                                           | L29-39                             |

**Test files (update fixtures and assertions):**

| File                                                           | Changes                                                                                                                                                                                                                                                                                                                                                                        | Scope                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `src/cli/lib/__tests__/test-fixtures.ts`                       | Update TEST_CATEGORIES: `"frontend/framework"` -> `"web/framework"`, `"frontend/state"` -> `"web/state"`, `"frontend/styling"` -> `"web/styling"`, `"backend/api"` -> `"api/api"`, `"backend/framework"` -> `"api/framework"`, `"backend/database"` -> `"api/database"`, `"backend/security"` -> `"api/security"`. Update tags containing "frontend"/"backend" in mock skills. | L45-54, L67, L91, L115                                                           |
| `src/cli/lib/__tests__/helpers.ts`                             | Update JSDoc examples and `.filter()` patterns                                                                                                                                                                                                                                                                                                                                 | L425-427, L476, L589, L594                                                       |
| `src/cli/lib/__tests__/helpers.test.ts`                        | Update category strings in `createMockSkill` calls                                                                                                                                                                                                                                                                                                                             | L33, L39, L44, L56                                                               |
| `src/cli/lib/__tests__/fixtures/create-test-source.ts`         | Update `category:` fields from `"frontend/framework"` to `"web/framework"`, `"frontend/state"` to `"web/state"`, `"backend/framework"` to `"api/framework"`. Update tags.                                                                                                                                                                                                      | L106-108, L130, L172-174                                                         |
| `src/cli/lib/__tests__/integration.test.ts`                    | Update `expectedCategories` from `["frontend", "backend"]` to `["web", "api"]`                                                                                                                                                                                                                                                                                                 | L526                                                                             |
| `src/cli/lib/__tests__/components/wizard.integration.test.tsx` | Update all category definitions: `id: "frontend"` -> `id: "web"`, `parent: "frontend"` -> `parent: "web"`, `id: "backend"` -> `id: "api"`, `parent: "backend"` -> `parent: "api"`. Update subcategory IDs: `"frontend/framework"` -> `"web/framework"`, etc.                                                                                                                   | L64-66, L72, L80, L92-94, L102, L107, L116, L128-190, L327-367                   |
| `src/cli/lib/__tests__/components/step-stack.test.tsx`         | Update `id: "frontend"` to `id: "web"`, `id: "backend"` to `id: "api"`                                                                                                                                                                                                                                                                                                         | L79, L87                                                                         |
| `src/cli/lib/__tests__/commands/search.test.ts`                | Update `"frontend"` args to `"web"` in CLI command tests                                                                                                                                                                                                                                                                                                                       | L70, L83                                                                         |
| `src/cli/lib/__tests__/user-journeys/compile-flow.test.ts`     | Update `s.category.startsWith("frontend")` to `s.category.startsWith("web")`, `s.category.startsWith("backend")` to `s.category.startsWith("api")`                                                                                                                                                                                                                             | L93, L99                                                                         |
| `src/cli/lib/skill-agent-mappings.test.ts`                     | Update all `"frontend"` category strings to `"web"`, `"backend"` to `"api"`, `"setup"` to `"infra"` in test assertions and mock data                                                                                                                                                                                                                                           | L143, L150, L156, L175, L213, L219, L224, L402-404, L448, L736-1189 (many lines) |
| `src/cli/lib/marketplace-generator.test.ts`                    | Update `category: "frontend"` to `category: "web"`, `category: "backend"` to `category: "api"` in mock data and assertions                                                                                                                                                                                                                                                     | L89, L239, L249, L405-407, L425                                                  |
| `src/cli/lib/config-merger.test.ts`                            | Update tags containing `"frontend"` in mock data                                                                                                                                                                                                                                                                                                                               | L224                                                                             |
| `src/cli/lib/skill-plugin-compiler.test.ts`                    | Update tags containing `"frontend"` in mock data, update path strings with `frontend/`                                                                                                                                                                                                                                                                                         | L37, L42, L68-69, L81, L275                                                      |
| `src/cli/lib/stack-plugin-compiler.test.ts`                    | Update directory path strings from `"frontend/..."` to (these are filesystem paths in old format, may keep as-is or update for consistency), update tags                                                                                                                                                                                                                       | L181-182, L219, L382, L559, L561, L966, L969                                     |
| `src/cli/lib/plugin-manifest.test.ts`                          | Update `"frontend"` in keywords arrays                                                                                                                                                                                                                                                                                                                                         | L78, L81, L231, L234                                                             |
| `src/cli/lib/resolver.test.ts`                                 | Update `path:` fields from `"skills/frontend/..."` to `"skills/web/..."` and `"skills/backend/..."` to `"skills/api/..."`. Also update `id: "frontend-only"` to `id: "web-only"`                                                                                                                                                                                               | L19, L25, L43, L77, L83, L648, L654, L793, L799, L805, L811, L931, L933          |

**Files that do NOT need changes:**

- `src/cli/stores/wizard-store.ts` -- uses domain names (`"web"`, `"api"`), not category names
- `src/cli/stores/wizard-store.test.ts` -- uses domain names
- `src/cli/components/wizard/step-build.tsx` -- uses domain names
- `src/cli/components/wizard/step-build.test.tsx` -- uses domain names (`"web"`, `"api"`)
- `src/cli/components/wizard/wizard.tsx` -- uses domain names
- `src/cli/components/wizard/utils.ts` -- maps domains to display names
- `src/cli/lib/source-loader.ts` -- no category name strings
- `src/cli/lib/matrix-resolver.ts` -- no category name strings
- `src/cli/lib/matrix-loader.ts` -- no category name strings
- `src/cli/lib/stacks-loader.ts` -- no category name strings
- `src/cli/lib/defaults-loader.ts` -- no category name strings
- `src/cli/lib/config-generator.ts` -- no category name strings
- `src/cli/lib/skill-metadata.ts` -- no category name strings
- `src/cli/consts.ts` -- uses skill IDs (`meta-methodology-*`), not category names
- `config/stacks.yaml` -- uses skill aliases (`react`, `hono`), agent IDs (`web-developer`, `api-developer`), and subcategory aliases (`framework`, `api`, `database`). **None of these are top-level category names.** The `backend-testing` alias in stacks.yaml is a skill alias, not a category reference.

#### 3. Order of Operations

1. **Update `config/skills-matrix.yaml`** -- rename top-level categories, update all `parent:` references, rename composite subcategory ID `frontend/realtime` -> `web/realtime`, rename alias keys
2. **Update `src/cli/types-matrix.ts`** -- JSDoc comment updates only (no runtime impact)
3. **Update `src/cli/lib/marketplace-generator.ts`** -- update CATEGORY_PATTERNS
4. **Update `src/cli/lib/skill-agent-mappings.ts`** -- update hardcoded category paths (deprecated file but still used)
5. **Update all test files** -- update fixtures, assertions, mock data (order doesn't matter between test files)
6. **Run full test suite** to verify no regressions

#### 4. Risk Assessment

**Risk: LOW**

- The rename is almost entirely a search-and-replace of string literals
- No runtime type changes required (the `CategoryDefinition` type uses `string` for `id` and `parent`, not a union type)
- No schema changes needed (the JSON schema accepts any `^[a-z][a-z0-9-]*$` string for category IDs)
- The wizard UI code already uses domain names, not category names -- zero changes needed there
- The skills repo uses skill IDs (`web-*`, `api-*`, `infra-*`), not category names -- zero changes needed there
- Skills' `metadata.yaml` files use subcategory names (`framework`, `api`, `monorepo`), not top-level category names -- zero changes needed
- The `skill_aliases` map in skills-matrix.yaml maps to skill IDs, not category names -- only 3 alias keys need renaming
- `config/stacks.yaml` agent configs use subcategory keys and skill aliases, not top-level category names -- zero changes

**Potential risk areas:**

- The deprecated `skill-agent-mappings.ts` uses `"frontend/*"` and `"backend/*"` patterns. If any external code or YAML defaults file references these patterns, those would break. The fallback is hardcoded, so it's safe.
- The `marketplace-generator.ts` CATEGORY_PATTERNS output category names. If any downstream consumer expects `"frontend"` or `"backend"` as marketplace categories, they would need updating. But since this is for plugin.json metadata, the rename is an improvement.
- The `resolver.test.ts` `path:` strings like `"skills/frontend/framework/react/"` reference old filesystem paths. These are test fixtures only and don't correspond to real filesystem paths (skills cache uses `web-framework-react/`).

#### 5. What to Do About `reviewing`, `methodology`, and `research` Categories

These three top-level categories have **no subcategories** and **no domain field**. They do not appear in the wizard's domain-based build step. Their skills use the `meta-*` prefix in skill IDs (e.g., `meta-reviewing-reviewing`, `meta-methodology-anti-over-engineering`, `meta-research-research-methodology`).

**Recommendation: Leave them unchanged for now.**

Reasoning:

- They serve as organizational containers only (no subcategories, no domain mapping)
- They are not shown in the wizard UI
- Renaming them to `meta` would collapse three distinct concepts (reviewing, methodology, research) into one
- If later we want to add them to the wizard, we would need to decide on a domain (possibly a new `"meta"` domain or assign them to `"shared"`)
- The `skill-agent-mappings.ts` references `"reviewing/*"`, `"methodology/*"`, `"research/*"` which would need updating, but since that file is deprecated, it's low priority

**Future consideration:** If we want to eventually show these in the wizard, the cleanest approach would be to:

1. Add a `"meta"` domain to the `ALL_DOMAINS` constant and the schema enum
2. Add subcategories under `reviewing`, `methodology`, `research` with `domain: "meta"`
3. Or collapse them all under a single `meta` top-level category with subcategories

#### 6. Edge Cases and Gotchas

1. **`cli` is both a top-level category AND a domain** -- this is already correct and aligned. No changes needed.

2. **`setup` -> `infra` vs `setup` -> `shared`**: The `setup` category's subcategories have `domain: shared`, but skill IDs use `infra-*` prefix. Renaming to `infra` aligns with skill IDs. The `domain: shared` on subcategories remains unchanged (shared is the correct domain since these tools are cross-cutting). Do NOT rename the domain to `infra` -- that would break the wizard.

3. **`frontend/realtime` composite subcategory ID**: This ID embeds the old category name. Must rename to `web/realtime`. Grep shows no code references to this ID outside of `skills-matrix.yaml`.

4. **Skill alias keys vs category names**: The aliases `backend-testing`, `backend-performance`, `frontend-performance` are short names users type, not category IDs. Renaming them to `api-testing`, `api-performance`, `web-performance` is optional but improves consistency. If any user project configs reference these old alias keys, they would break.

5. **Test fixture `path:` strings**: Many test files have paths like `"skills/frontend/framework/react/"`. These are mock data from the old directory structure. Update them to `"skills/web/framework/react/"` for consistency, but they don't correspond to real filesystem paths.

6. **`SUBCATEGORY_ALIASES` in `skill-agent-mappings.ts`**: Maps like `framework: "frontend/framework"` need updating to `framework: "web/framework"`. This is used by the deprecated `shouldPreloadSkill()` function.

7. **The `"shared"` top-level category has no subcategories**: It exists as a top-level category in skills-matrix.yaml (lines 89-95) but has no children. It should NOT be confused with the `domain: "shared"` field on `setup`/`infra` subcategories. The category and domain are separate concepts. No rename needed for the `shared` category itself.

8. **`marketplace-generator.ts` fallback patterns**: Lines 38-39 have fallback patterns for `skill-setup-`, `skill-backend-`, `skill-frontend-` prefixes. No actual skills use these prefixes, so the fallback patterns should be updated or removed.

9. **Stack aliases like `backend-testing` in `stacks.yaml`**: The value `backend-testing` on line 25 of stacks.yaml is a **skill alias** (maps to `api-testing-api-testing`), not a category. If we rename the alias key in skills-matrix.yaml, we must also update all stacks.yaml references. Currently `backend-testing` appears 7 times in stacks.yaml.

10. **The `"shared"` domain in wizard**: `ALL_DOMAINS` includes `"shared"`. The `setup`/`infra` subcategories have `domain: "shared"`. After renaming `setup` -> `infra`, the "shared" domain in the wizard will still work correctly because it matches on `domain: "shared"`, not on the parent category name.
