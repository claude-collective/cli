# Agents Inc. CLI - Task Tracking

| ID   | Task                                                                                   | Status       |
| ---- | -------------------------------------------------------------------------------------- | ------------ |
| B-06 | --refresh leaves orphan skills from stale cache                                        | Done         |
| B-05 | Edit mode does not restore sub-agent selection                                         | Bug          |
| B-04 | Disabled-selected skills need distinct visual state                                    | Done         |
| B-03 | Init allows incompatible skills that edit correctly filters                            | Bug          |
| B-02 | Validate compatibleWith/conflictsWith refs in metadata                                 | Done         |
| U13  | Run Documentor Agent on CLI Codebase                                                   | Pending      |
| H18  | Tailor documentation-bible to CLI repo                                                 | Phase 3 only |
| D-43 | Remove `getAgentsForSkill` / `skillToAgents` / `agentSkillPrefixes` (prerequisite for D-37, custom extensibility) | Pending      |
| D-37 | Install mode UX redesign (see [design doc](../docs/features/proposed/install-mode-redesign.md)) | Pending      |
| D-36 | Eject: check specific agent dirs, not just agents/                                     | Done         |
| D-35 | Config: `templates` path property as eject alternative                                 | Deferred      |
| D-33 | README: frame Agents Inc. as an AI coding framework                                    | Pending      |
| D-42 | `agentsinc validate` command for skills repos                                          | Pending      |
| T-07 | Replace real skills repo in source-loader.test.ts with fixtures                        | Pending      |
| T-08 | Audit all test files: extract fixtures, use real IDs                                   | Pending      |
| T-09 | Extract shared base skill/category/matrix fixtures to eliminate cross-file duplication | Pending      |

---

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).
For final release tasks, see [TODO-final.md](./TODO-final.md).

---

## Reminders for Agents

See [docs/guides/agent-reminders.md](../docs/guides/agent-reminders.md) for the full list of rules (use specialized agents, handle uncertainties, blockers, commit policy, archiving, status updates, context compaction, cross-repo changes).

---

## Active Tasks

### Bugs

#### B-06: --refresh leaves orphan skills from stale cache

When `--refresh` fetches a source, giget extracts the new tarball on top of the existing cache directory. Skills that were deleted or renamed in the source survive as orphans because the old directory is never cleaned. This causes validation warnings for skills that no longer exist (e.g., `api-testing-api-testing` with an old `category: testing` value).

**Fix:** Delete the source's cache directory before fetching when `--refresh` is used. In `fetchFromRemoteSource()`, when `forceRefresh` is true, remove the entire `cacheDir` (not just the giget tarball cache) before calling `downloadTemplate()`.

**Location:** `src/cli/lib/loading/source-fetcher.ts` — `fetchFromRemoteSource()`, around line 168.

---

#### B-05: Edit mode does not restore sub-agent selection

When running `agentsinc init`, the user can select a subset of available sub-agents on the agents step. However, when running `agentsinc edit`, the agents step pre-selects all available sub-agents instead of restoring the subset the user originally chose. The user's agent selection is not persisted to (or restored from) the project config.

**Fix:** Persist the selected agent names to config during init/compile (similar to how `domains` and `skills` are saved), and restore them in `edit` mode so the agents step shows the original selection.

**Location:** `src/cli/commands/edit.tsx`, `src/cli/components/wizard/step-agents.tsx`, `src/cli/lib/installation/local-installer.ts` (config persistence).

---

#### B-04: Disabled-selected skills need distinct visual state

When a framework skill (e.g., React) is deselected, all dependent skills become disabled. Currently these disabled skills all look the same regardless of whether they were previously selected. Skills that are both disabled AND selected should have a distinct visual state — a transparent/dimmed teal color, similar to the existing "discouraged" style — so the user can still see what was selected before the framework was toggled off.

**Location:** `src/cli/components/wizard/` — the checkbox/skill rendering logic that determines colors based on skill state (selected, disabled, discouraged).

---

#### B-03: Init allows incompatible skills that edit correctly filters

When running `agentsinc init`, the wizard allows selecting skills that have `compatibleWith` constraints even when the selected framework doesn't match. The `edit` command runs stricter validation (framework compatibility filtering via `isCompatibleWithSelectedFrameworks` in `build-step-logic.ts`) that correctly prevents this.

The `init` flow needs to run the same level of validation that `edit` already applies. Currently `init` is too loose — it lets incompatible skills through that `edit` would correctly filter out.

**Fix:** Apply the same compatibility validation from `edit`'s path to the `init` build step.

**Location:** `src/cli/commands/init.tsx`, `src/cli/lib/wizard/build-step-logic.ts` filtering logic — compare with `src/cli/commands/edit.tsx` to see what validation edit applies that init does not.

---

#### B-02: Validate compatibleWith/conflictsWith refs in metadata

During matrix merge, `compatibleWith` and `conflictsWith` arrays in skill `metadata.yaml` can contain unresolvable references (e.g. display names with `(@author)` suffixes like `"react (@vince)"` or non-canonical IDs like `"setup-tooling"`). When `resolveToCanonicalId` can't resolve these, they pass through as-is and silently break framework compatibility filtering — skills disappear from the build step without any warning.

**Fix:** Add a post-merge validation pass that checks every `compatibleWith` and `conflictsWith` entry on each resolved skill. If a reference doesn't match any known skill ID in `matrix.skills`, emit a `warn()` with the skill ID, the field name, and the unresolved reference. This catches the problem at load time instead of silently filtering skills out.

**Location:** `src/cli/lib/matrix/matrix-loader.ts` — after `mergeMatrixWithSkills()` builds `resolvedSkills`, or in `checkMatrixHealth()` in `matrix-health-check.ts`.

---

### Documentation & Tooling

#### U13: Run Documentor Agent on CLI Codebase

Use the `documentor` sub-agent to create AI-focused documentation that helps other agents understand where and how to implement features. The documentor should work incrementally and track progress over time.

**What to document:**

- Component structure and patterns
- State management patterns (Zustand)
- Testing patterns and conventions
- CLI command structure
- Wizard flow and navigation
- Key utilities and helpers

**Output:** Documentation in `docs/` directory

---

#### H18: Generate CLI Documentation via Documentor Agent

Phases 1 (documentation-bible.md) and 2 (documentor workflow.md) are complete. Only Phase 3 remains.

##### Phase 3: Run documentor agent to generate docs

Create `.claude/docs/` directory with:

- `DOCUMENTATION_MAP.md` — master index tracking coverage
- `command-patterns.md` — oclif command conventions
- `wizard-architecture.md` — wizard flow, state management
- `compilation-system.md` — agent/skill compilation pipeline
- `test-patterns.md` — test infrastructure and fixtures
- `type-system.md` — type conventions and branded types

**Success criteria:** `.claude/docs/` exists with 5+ files that help agents answer "where is X?" and "how does Y work?"

---

### CLI Improvements

#### D-43: Remove `getAgentsForSkill` / `skillToAgents` / `agentSkillPrefixes`

Remove the legacy pattern-matching agent routing system. When no stack is selected, all selected skills should be assigned to all selected agents. Stacks remain the mechanism for fine-grained skill-to-agent mapping.

**What to remove:**

- `getAgentsForSkill()` in `config-generator.ts:28-53`
- `getEffectiveSkillToAgents()` in `config-generator.ts:19-26`
- `DEFAULT_AGENTS` constant in `config-generator.ts:17`
- `skillToAgents` section in `defaults/agent-mappings.yaml:8-129`
- `agentSkillPrefixes` section in `defaults/agent-mappings.yaml:130-216` (already unused)
- Related Zod schema fields in `defaultMappingsSchema` (`schemas.ts`)
- `DefaultMappings` type if it becomes empty

**Replacement behavior:** In `generateProjectConfigFromSkills()`, when building the `stack` property, assign every selected skill to every selected agent. If no agents are selected, there is no stack — just the skills list. Skills are still accessible to any agent at runtime; the stack is a preloading convenience, not a gate. No pattern matching, no fallback. If the user wants fine-grained control, they use a stack.

**Why:** The current `skillToAgents` wildcard matching is legacy code that will only get more complex with custom skills/domains. Stacks already provide explicit agent→skill mappings. The wizard's agent preselection already uses `DOMAIN_AGENTS` (hardcoded), not `skillToAgents`. Removing this simplifies config generation and eliminates a blocker for custom extensibility.

**Prerequisite for:** D-37 (install mode redesign), custom extensibility design.

**Location:** `src/cli/lib/configuration/config-generator.ts`, `src/cli/defaults/agent-mappings.yaml`, `src/cli/lib/schemas.ts`, `src/cli/lib/loading/defaults-loader.ts`

---

#### D-37: Install mode UX redesign

Replace the hidden `P` hotkey toggle with an explicit install mode choice on the confirm step. Implement mode migration during edit (local to plugin, plugin to local, per-skill customize). The current `P` toggle during edit is completely broken -- config is never updated, artifacts are never migrated.

**Design doc:** [`docs/features/proposed/install-mode-redesign.md`](../docs/features/proposed/install-mode-redesign.md)

**Location:** `step-confirm.tsx`, `wizard.tsx`, `wizard-layout.tsx`, `help-modal.tsx`, `wizard-store.ts`, `edit.tsx`, `local-installer.ts`, `agent-recompiler.ts`, `types/config.ts`.

---

#### D-36: Eject: check specific agent dirs, not just agents/

The `eject agent-partials` command currently checks if an `agents/` folder exists to determine if partials have already been ejected. This is too broad — an `agents/` folder could exist because the user ejected templates only (`_templates/`). The check should look for the specific agent partial directories (e.g., `developer/`, `reviewer/`, `tester/`) rather than just the parent `agents/` folder.

**Location:** `src/cli/commands/eject.ts` — the existence check in `ejectAgentPartials`.

---

#### D-35: Config: `templates` path property as eject alternative [DEFERRED]

Instead of requiring `eject templates` to customize agent templates, allow users to define a `templates` path in their config YAML. The compilation pipeline would check for this path first and use those templates instead of the built-in defaults — no eject step needed.

**Example config.yaml:**

```yaml
name: my-project
templates: ./my-templates
skills:
  - web-framework-react
```

**Changes needed:**

- Add optional `templates` property to the config schema (Zod)
- Update the compilation pipeline to resolve templates from the config path before falling back to built-in/ejected templates
- Update `src/cli/types/` with the new config field
- Add tests for custom template resolution

---

### Positioning & README

#### D-33: README: frame Agents Inc. as an AI coding framework

Rewrite the README to position Agents Inc. as an AI coding framework, not just a CLI tool. The key differentiator is the composability model and the level of extensibility — this needs to be worded carefully to be credible, not buzzwordy.

**What makes it genuinely a framework:**

- **Composable knowledge primitives** — skills are atomic, typed, categorized knowledge modules with a defined schema (markdown + YAML metadata + categories + tags + conflict rules)
- **Agent compilation pipeline** — skills are compiled into role-based agents via Liquid templates, YAML definitions, and markdown partials. This is a real build step, not just config
- **Ejectable internals** — users can eject agent templates, the skills matrix, and compilation artifacts to fully customize the pipeline. This is framework-level extensibility
- **Interactive agent composition** — the wizard lets you interactively build specialized sub-agents from modular skills, which is genuinely unique
- **Marketplace/plugin architecture** — custom skill sources, multi-source resolution, publishable stack plugins
- **Stack architecture** — pre-configured agent bundles with philosophy, agent roles, and skill assignments

**Wording constraints:**

- Must feel honest and specific, not like marketing fluff
- Lead with what it does concretely, then explain the framework aspect
- Avoid "revolutionary" / "powerful" / "game-changing" language
- The framework angle should emerge naturally from describing the features
- Don't overstate — it's a framework for composing Claude Code agents, not a general AI framework

**Possible framing angles to explore:**

- "A build system for AI coding agents" (emphasizes the compilation pipeline)
- "Composable skills for Claude Code" (emphasizes the modularity)
- "An agent composition framework" (emphasizes what makes it unique)
- The eject model mirrors how frameworks like Next.js/CRA work — sane defaults but full escape hatches

**Key sections to rework:**

- Opening paragraph — currently "the CLI for working with Agents Inc. skills" is underselling it
- "what this does" — should explain the framework concept
- "how skills work" — could emphasize the schema/type system aspect
- "architecture" — already describes framework internals, could be elevated

---

#### D-42: `agentsinc validate` command for skills repos

A standalone validation command that marketplace authors can run from within their skills repo to check all metadata for correctness. Currently `checkMatrixHealth` runs automatically during `loadSkillsMatrixFromSource`, but there's no user-facing command for it.

**Usage:**

```bash
# Run from within a skills repo
agentsinc validate --source .

# Or point at a remote source
agentsinc validate --source github:acme-corp/skills
```

**What it validates:**

- Every `metadata.yaml` against the schema (required fields, field types)
- `cliName` format and directory name consistency
- `category` values against known domain-prefixed patterns
- All cross-references (`compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor`) resolve to existing skill IDs
- `categoryExclusive` is present when required
- camelCase key convention (no snake_case)
- Every skill directory has both `SKILL.md` and `metadata.yaml`

**Implementation:**

- New command: `src/cli/commands/validate.ts`
- Reuse `loadSkillsMatrixFromSource` + `checkMatrixHealth` for cross-reference validation
- Add per-skill schema validation using `skillMetadataLoaderSchema`
- Report all issues with file paths and specific values
- Exit with non-zero code if any errors found (warnings are OK)

**Location:** `src/cli/commands/validate.ts`, leveraging existing `matrix-health-check.ts` and `schemas.ts`.

---

#### T-07: Replace real skills repo in source-loader.test.ts with fixtures

`source-loader.test.ts` loads the real `/home/vince/dev/skills` sibling repo for 13 of its 24 tests. This is fragile, non-portable, and violates the project convention of using `createTestSource()`.

**Key findings from investigation:**

- 13 tests use `SKILLS_SOURCE` (the real repo); the other 11 are already self-contained
- `createTestSource()` already supports everything needed — no infrastructure changes required
- 3 tests hardcode count thresholds (`> 50` skills, `> 10` categories) that need adjusting
- Test 11 (line 207) needs a skill with a domain-mapped category — already supported by `createTestSource()`'s `generateMatrix()` which sets `domain` from category prefix

**Plan:**

1. Create a single shared fixture via `createTestSource()` in a module-level `beforeAll`/`afterAll` with ~8 skills from `DEFAULT_TEST_SKILLS` + `EXTRA_DOMAIN_TEST_SKILLS`, plus 1 test stack
2. Remove `SKILLS_REPO_ROOT` / `SKILLS_SOURCE` constants (lines 8-12)
3. Replace all `SKILLS_SOURCE` references with `fixtureSource.sourceDir`
4. Update 3 hardcoded count assertions (lines 272, 507-508, 588-589) to match fixture data
5. Leave the 11 already self-contained tests untouched

**Scope:** ~30-40 lines changed in `source-loader.test.ts`, 0 new files, 0 new helpers.

**Location:** `src/cli/lib/loading/source-loader.test.ts`

---

#### T-08: Audit all test files: extract fixtures, use real IDs

All test files should follow the conventions enforced in `matrix-health-check.test.ts` and `category-grid.test.tsx` during this session:

1. **No fake skill IDs** — use real IDs from the skills repo (e.g., `web-framework-react`, not `web-test-react`). Only use fake IDs when explicitly testing error paths for invalid data.
2. **No fake categories** — use valid `Subcategory` union members (e.g., `"web-framework"`, not `"test-category"`).
3. **No inline test data construction** — never construct `SkillsMatrixConfig`, `MergedSkillsMatrix`, `ResolvedSkill`, configs, or stacks inline in test bodies. Use factories from `__tests__/helpers.ts` (`createMockSkill`, `createMockMatrix`, `createMockCategory`, etc.) or fixtures from `create-test-source.ts`.
4. **Extract all test data to top-level named constants** — don't call factory functions inside `it()` blocks. Define every skill, category, and matrix variant as a named constant at the top of the file. Test bodies should only call the function under test + assertions.

**Specific callout:** `category-grid.test.tsx` lines 1190-1226 manually re-lists `Subcategory` and `SkillId` values in hand-picked pools to generate dynamic test data. This duplicates data that already exists in types and fixtures. Use `createComprehensiveMatrix` or real fixture data instead of hand-building pools.

**Files already done (skip these):**

- `src/cli/lib/matrix/matrix-health-check.test.ts`
- `src/cli/components/wizard/category-grid.test.tsx` (IDs fixed, but pools still need replacing per callout above)

**Files to audit:** All other `*.test.ts` and `*.test.tsx` files under `src/cli/`. Prioritize files that construct matrices, skills, categories, or configs inline.

**Location:** All test files under `src/cli/`

---

#### T-09: Extract shared base skill/category/matrix fixtures to eliminate cross-file duplication

The same `createMockSkill("web-framework-react", "web-framework")` call is repeated across 10+ test files. The base skill is identical — only per-file overrides differ (`categoryExclusive`, `displayName`, `tags`, etc.). Same for common categories and simple matrices.

**Approach:** Add shared base constants to `__tests__/helpers.ts` or `__tests__/test-fixtures.ts`:

```typescript
// Base fixtures — no overrides, just the canonical defaults
export const REACT_SKILL = createMockSkill("web-framework-react", "web-framework");
export const ZUSTAND_SKILL = createMockSkill("web-state-zustand", "web-client-state");
export const HONO_SKILL = createMockSkill("api-framework-hono", "api-api");
export const VITEST_SKILL = createMockSkill("web-testing-vitest", "web-testing");

export const FRAMEWORK_CATEGORY = createMockCategory("web-framework", "Framework");
export const CLIENT_STATE_CATEGORY = createMockCategory("web-client-state", "Client State");
export const TESTING_CATEGORY = createMockCategory("web-testing", "Testing");
```

Per-file customization via spread:

```typescript
// Test that needs displayName
const skill = { ...REACT_SKILL, displayName: "React", categoryExclusive: true };

// Test that uses the base as-is
const matrix = createMockMatrix({ "web-framework-react": REACT_SKILL });
```

**Files with highest duplication:**

- `config-generator.test.ts` — 18 occurrences of bare react skill
- `step-build.test.tsx` — react, vue, zustand, pinia skills
- `build-step-logic.test.ts` — react, vue, zustand with displayName
- `matrix-health-check.test.ts` — react, zustand, categories
- `plugin-finder.test.ts`, `wizard-store.test.ts`, `init-flow.integration.test.ts`

**Do NOT extract:** Pathological/error-case fixtures (orphan skills, unresolved refs, missing domains). These are single-consumer and belong in the test file that uses them.

**Location:** `src/cli/lib/__tests__/helpers.ts` or `src/cli/lib/__tests__/test-fixtures.ts`

---

## Testing Tasks

See [TODO-testing.md](./TODO-testing.md) for the full testing guide: coverage table (what is and isn't tested), automated test tasks T1-T6, step-by-step manual procedures for every command, and the 28-point quick-pass checklist.

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/skills`
- CLI under test: `/home/vince/dev/cli`
