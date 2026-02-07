# CLI UX - Task Tracking

> Dedicated tracking for CLI UX/UI improvements.
> For the full redesign spec, see [docs/wizard-ux-redesign.md](./docs/wizard-ux-redesign.md).
> For concerns and decisions, see [docs/wizard-ux-redesign-concerns.md](./docs/wizard-ux-redesign-concerns.md).
> For research findings, see [docs/CLI-IMPROVEMENTS-RESEARCH.md](./docs/CLI-IMPROVEMENTS-RESEARCH.md).

---

## Active Tasks

| ID     | Task                                             | Status      | Notes                                                                         |
| ------ | ------------------------------------------------ | ----------- | ----------------------------------------------------------------------------- |
| UX-01  | Style the home screen                            | IN PROGRESS | Initial layout, branding, and navigation styling for the CLI home screen      |
| UX-10  | Refactor command files - extract logic to lib/   | IN PROGRESS | See [docs/init-refactor-plan.md](./docs/init-refactor-plan.md). Phases below. |
| UX-10a | Phase 1: Extract `lib/skill-metadata.ts`         | IN PROGRESS | -254 lines duplication from update.tsx, outdated.ts, diff.ts                  |
| UX-10b | Phase 2: Extract `lib/config-saver.ts`           | PENDING     | -36 lines duplication from init.tsx, eject.ts                                 |
| UX-10c | Phase 3: Extract `lib/config-merger.ts`          | PENDING     | -100 lines from init.tsx, add tests for merge rules                           |
| UX-10d | Phase 4: Extract `lib/local-installer.ts`        | PENDING     | -335 lines from init.tsx (627 -> ~150 lines)                                  |
| UX-10e | Phase 5: Extract `lib/plugin-manifest-finder.ts` | PENDING     | -72 lines from 4 version/\* files                                             |
| UX-10f | Phase 6: Consolidate `getCurrentDate()`          | PENDING     | -9 lines, import from existing lib/versioning.ts                              |

---

## Completed Tasks

| ID  | Task                                    | Status | Notes                                                       |
| --- | --------------------------------------- | ------ | ----------------------------------------------------------- |
| U1  | Progress navigation bar - tab styling   | DONE   | Green bg active, white bg completed, no circles             |
| U2  | Header - add version display            | DONE   | Pass `this.config.version` from Init command                |
| U3  | Footer - split layout with WizardFooter | DONE   | Left: nav controls, right: action hints                     |
| U6  | Extract WizardLayout component          | DONE   | WizardTabs + children + WizardFooter, centralized shortcuts |
| U7  | Simplify WizardTabs styling             | DONE   | Text-only, border lines, "Approach" -> "Intro", version bar |
| U8  | Fix version prop flow                   | DONE   | Prop-drill from oclif this.config.version (was broken)      |
| U9  | ASCII art banner for init               | DONE   | "AGENTS INC" banner on init command                         |
| U4  | Build step - framework-first flow       | DONE   | Hide categories until framework selected, background colors |
| U5  | Import third-party skills command       | DONE   | `cc import skill github:owner/repo`                         |

---

## Backlog

| ID    | Task                                                           | Priority | Notes                                                                                                                                                                     |
| ----- | -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-02 | Align skills-matrix categories with domains                    | Medium   | Rename `frontend`/`backend` to `web`/`api`                                                                                                                                |
| UX-03 | Build step UX improvements (column alignment, show all toggle) | Medium   | See TODO-deferred.md D-10                                                                                                                                                 |
| UX-04 | Interactive skill search polish                                | Medium   | Manual testing + tests for interactive component                                                                                                                          |
| UX-05 | Refine step - skills.sh integration                            | Low      | Community skill alternatives in Refine step                                                                                                                               |
| UX-06 | Search with color highlighting                                 | Low      | Deferred - needs more UX thought                                                                                                                                          |
| UX-07 | Incompatibility tooltips                                       | Low      | Show reason when hovering disabled options                                                                                                                                |
| UX-08 | Keyboard shortcuts help overlay                                | Low      | In-wizard help for keybindings                                                                                                                                            |
| UX-09 | Animations/transitions                                         | Low      | Polish pass for step transitions                                                                                                                                          |
| UX-11 | Build step: always cycle through all domains                   | Medium   | After stack selection, step through all domains (web, api, cli, mobile) even if stack only covers one. Currently skips domains not in the stack.                          |
| UX-12 | Build step: missing subcategories after stack selection        | High     | BUG: When selecting a stack (e.g. Next.js) with local skills, many subcategories (client state, server state, etc.) are not shown in the build view. Needs investigation. |

---

## Investigation Notes

### UX-11: Build step domain cycling

**Root cause:** When a stack is selected, `populateFromStack()` in the wizard store sets `selectedDomains` to ONLY the domains that the stack's skills actually cover. The build step then uses `store.selectedDomains` as `effectiveDomains` (wizard.tsx line 204), and `nextDomain()`/`prevDomain()` in the store cycle only through `selectedDomains` (wizard-store.ts lines 247-271). So if a stack only has "web" and "api" skills, the user never sees "cli", "mobile", or "shared" domains.

**Relevant code:**

1. **`src/cli/components/wizard/step-stack.tsx` lines 80-95** -- When user selects a stack, `StackSelection` iterates `resolvedStack.allSkillIds`, looks up each skill's category, then gets the category's `domain`. It builds `stackAgents` keyed by domain and calls `populateFromStack({ agents: stackAgents }, matrix.categories)`.

2. **`src/cli/stores/wizard-store.ts` lines 149-193** -- `populateFromStack()` collects domains from the stack's agent configs into a `Set<string>` and sets `selectedDomains: Array.from(domains)`. This means only domains with at least one skill in the stack are included.

3. **`src/cli/components/wizard/wizard.tsx` line 204** -- `effectiveDomains` is directly set to `store.selectedDomains`, so the build step only iterates the stack-covered domains.

4. **`src/cli/stores/wizard-store.ts` lines 247-258** -- `nextDomain()` checks `currentDomainIndex < selectedDomains.length - 1`. When the user reaches the last domain, it returns `false` and the wizard moves to the refine step (wizard.tsx line 227-229).

**The chain:** Stack selected -> `populateFromStack` sets `selectedDomains` to stack's domains only -> build step iterates only those -> user skips uncovered domains.

**Proposed fix:** After `populateFromStack` is called (or inside it), ensure `selectedDomains` always contains ALL five domains: `["web", "api", "cli", "mobile", "shared"]`. The stack's pre-selections still get populated into `domainSelections` for the relevant domains, but the wizard will cycle through all domains so users can add technologies in domains the stack doesn't cover.

There are two possible implementation approaches:

**Option A (Minimal -- recommended):** In `step-stack.tsx` StackSelection component (lines 73-98), after calling `populateFromStack()`, explicitly set `selectedDomains` to the full domain list. This could be done by adding a store action like `setSelectedDomains()` or by modifying `populateFromStack` to accept an "allDomains" parameter.

**Option B (Store-level):** Modify `populateFromStack()` in wizard-store.ts to always include all five domains, regardless of which domains have skills. The domains with no pre-populated skills would simply show empty `domainSelections` for those domains, and the build step would display all available subcategories for each.

Note: The `AVAILABLE_DOMAINS` constant in `step-stack.tsx` (line 33) only lists `["web", "api", "cli", "mobile"]` -- it is missing `"shared"`. The `getDomainDisplayName()` functions in both `wizard.tsx` (line 84) and `step-build.tsx` (line 277) DO include "shared". The fix should use all five domains including "shared".

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
