# Claude Collective CLI - Completed Tasks

> This file contains completed tasks moved from [TODO.md](./TODO.md) to keep the main file lean.
> Tasks are moved here when there are more than 10 completed tasks in TODO.md.

---

## Phase 1: Test Coverage (COMPLETE)

All Phase 1 tasks completed. See TODO.md for original task list.

**Summary:**

- 25 tasks completed
- Added 284 new tests
- Total tests grew from 384 to 668

---

## Phase 2: Unified Architecture (COMPLETE)

All Phase 2 tasks completed. See TODO.md for original task list.

**Summary:**

- 20 tasks completed
- Unified config.yaml schema
- Agent-skill mappings moved to YAML
- Eject skills/agents commands added

---

## Phase 3: Extensibility (COMPLETE)

All Phase 3 tasks completed except P3-14 (deferred).

**Summary:**

- 13 tasks completed
- Custom agents with `extends` support
- Uninstall command
- Custom marketplace URLs
- `cc new agent` command

---

## Phase 4: Essential CLI Features (COMPLETE - Tier 1 & 2)

### Completed Tasks

| Task ID | Task                           | Completed  | Tests Added         |
| ------- | ------------------------------ | ---------- | ------------------- |
| P4-01   | `cc search <query>` command    | 2026-01-31 | 34                  |
| P4-02   | `cc info <skill>` command      | 2026-01-31 | 56                  |
| P4-03   | Search tests                   | 2026-01-31 | (included in P4-01) |
| P4-04   | Info tests                     | 2026-01-31 | (included in P4-02) |
| P4-05   | `cc outdated` command          | 2026-01-31 | 35                  |
| P4-06   | `cc update [skill]` command    | 2026-01-31 | 43                  |
| P4-07   | Outdated tests                 | 2026-01-31 | (included in P4-05) |
| P4-08   | Update tests                   | 2026-01-31 | (included in P4-06) |
| P4-09   | `cc doctor` command            | 2026-01-31 | 22                  |
| P4-10   | Doctor tests                   | 2026-01-31 | (included in P4-09) |
| P4-11   | `cc new skill` command         | 2026-01-31 | 22                  |
| P4-12   | `cc diff` command              | 2026-01-31 | 37                  |
| P4-13   | New skill tests                | 2026-01-31 | (included in P4-11) |
| P4-14   | Diff tests                     | 2026-01-31 | (included in P4-12) |
| P4-15   | Test fixtures consolidation    | 2026-01-31 | -                   |
| P4-19   | Web UI research                | 2026-01-31 | -                   |
| R0      | oclif + Ink framework research | 2026-01-31 | -                   |

**Summary:**

- All Tier 1 and Tier 2 tasks completed
- 1160 tests passing
- New commands: search, info, outdated, update, doctor, diff, new skill

---

## Detailed Specifications (Archived)

Detailed specifications for completed tasks are preserved in TODO.md under "Detailed Task Specifications" section for reference.

---

## Phase 5: oclif + Ink Migration (COMPLETE)

### Phase 5.6: Polish and Testing

| Task ID | Task                                     | Completed  | Tests Added |
| ------- | ---------------------------------------- | ---------- | ----------- |
| P5-6-0  | CLI Integration Test Strategy (research) | 2026-01-31 | -           |
| P5-6-1  | Add @oclif/test command tests            | 2026-01-31 | 210         |
| P5-6-1a | Research test code sharing patterns      | 2026-01-31 | -           |
| P5-6-1b | Extract shared CLI_ROOT constant         | 2026-01-31 | -           |
| P5-6-1c | Create shared runCliCommand helper       | 2026-01-31 | -           |
| P5-6-1d | Add output string constants              | 2026-01-31 | -           |
| P5-6-1e | Document test helper usage (JSDoc)       | 2026-01-31 | -           |
| P5-6-2  | Add ink-testing-library component tests  | 2026-01-31 | 114         |
| P5-6-3  | Update vitest config for test patterns   | 2026-01-31 | -           |

### Phase 5.7: Cleanup

| Task ID | Task                                 | Completed  |
| ------- | ------------------------------------ | ---------- |
| P5-7-1  | Remove @clack/prompts dependency     | 2026-01-31 |
| P5-7-2  | Remove commander dependency          | 2026-01-31 |
| P5-7-3  | Remove picocolors dependency         | 2026-01-31 |
| P5-7-4  | Delete old src/cli/commands/ files   | 2026-01-31 |
| P5-7-5  | Delete src/cli/lib/wizard.ts         | 2026-01-31 |
| P5-7-6  | Move lib/ and utils/ to cli          | 2026-01-31 |
| P5-7-7  | Update package.json entry points     | 2026-01-31 |
| P5-7-8  | Final validation (all commands work) | 2026-01-31 |
| P5-7-9  | Update documentation                 | 2026-01-31 |
| P5-7-10 | Stash all changes                    | 2026-01-31 |

**Summary:**

- 398 tests passing across 24 test files
- Full CLI migration from Commander.js + @clack/prompts to oclif + Ink
- All commands tested including interactive wizard components
- Test infrastructure: helpers.ts with CLI_ROOT, runCliCommand, OUTPUT_STRINGS, factory functions

---

## Research Documents

| Document                                                                    | Topic                             | Date       |
| --------------------------------------------------------------------------- | --------------------------------- | ---------- |
| oclif-ink-research.md (archived)                                            | oclif + Ink framework evaluation  | 2026-01-31 |
| web-ui-research.md (archived)                                               | Web UI for private marketplace    | 2026-01-31 |
| [cli-agent-invocation-research.md](./docs/cli-agent-invocation-research.md) | Meta-agent invocation via CLI     | 2026-01-22 |
| cli-testing-research.md (archived)                                          | CLI integration test strategy     | 2026-01-31 |
| stack-simplification-research.md (archived)                                 | Stack architecture simplification | 2026-01-31 |

---

## Phase 6: Agent-Centric Configuration (COMPLETE)

### Phase 6.1: Types and Schema

| Task ID | Task                                       | Completed  |
| ------- | ------------------------------------------ | ---------- |
| A1-1    | Add `skills` field to AgentYamlConfig type | 2026-02-01 |
| A1-2    | Add `skills` field to AgentDefinition type | 2026-02-01 |
| A1-3    | Update agent.schema.json                   | 2026-02-01 |
| A1-4    | Create Stack type                          | 2026-02-01 |
| A1-5    | Create stacks.schema.json                  | 2026-02-01 |

### Phase 6.2: Loaders

| Task ID | Task                                   | Completed  |
| ------- | -------------------------------------- | ---------- |
| A2-1    | Update loadAllAgents to extract skills | 2026-02-01 |
| A2-2    | Create stacks loader                   | 2026-02-01 |

### Phase 6.3: Resolution Logic

| Task ID | Task                                        | Completed  |
| ------- | ------------------------------------------- | ---------- |
| A3-1    | Create resolveAgentSkills function          | 2026-02-01 |
| A3-2    | Update getAgentSkills to use agent's skills | 2026-02-01 |
| A3-3    | Deprecate skill-agent-mappings.ts           | 2026-02-01 |

### Phase 6.4: Command Updates

| Task ID | Task                                       | Completed  |
| ------- | ------------------------------------------ | ---------- |
| A4-1    | Update init command for new flow           | 2026-02-01 |
| A4-2    | Update compile command                     | 2026-02-01 |
| A4-3    | Remove build:stack command                 | 2026-02-01 |
| A4-4    | Update wizard store for agent-based stacks | 2026-02-01 |

### Phase 6.5: Agent YAML Updates

| Task ID | Task                                     | Completed  |
| ------- | ---------------------------------------- | ---------- |
| A5-1    | Add skills to web-developer agent        | 2026-02-01 |
| A5-2    | Add skills to api-developer agent        | 2026-02-01 |
| A5-3    | Add skills to remaining developer agents | 2026-02-01 |
| A5-4    | Add skills to reviewer agents            | 2026-02-01 |
| A5-5    | Add skills to researcher agents          | 2026-02-01 |
| A5-6    | Add skills to tester and planning agents | 2026-02-01 |
| A5-7    | Add skills to pattern and meta agents    | 2026-02-01 |

### Phase 6.6: Cleanup

| Task ID | Task                                            | Completed  |
| ------- | ----------------------------------------------- | ---------- |
| A6-1    | Create stacks.yaml with all stacks              | 2026-02-01 |
| A6-2    | Delete all stack config files                   | 2026-02-01 |
| A6-3    | Deprecate stack loading code                    | 2026-02-01 |
| A6-4    | Remove suggested_stacks from skills-matrix.yaml | 2026-02-01 |
| A6-5    | Deprecate StackConfig type                      | 2026-02-01 |

**Summary:**

- 25 tasks completed
- Skills are now defined in agent YAMLs, stacks are in config/stacks.yaml
- New `config/stacks.yaml` lists stacks with agent groupings
- Deleted all `src/stacks/*/config.yaml` files from claude-subagents

---

## Phase 7A: Architecture Fix (COMPLETE)

| Task ID | Task                                          | Completed  |
| ------- | --------------------------------------------- | ---------- |
| P7-0-1  | Move skills from agents to stacks             | 2026-02-02 |
| P7-0-1a | Add StackAgentConfig interface                | 2026-02-02 |
| P7-0-1b | Update stacks.schema.json                     | 2026-02-02 |
| P7-0-1c | Transform stacks in config/stacks.yaml        | 2026-02-02 |
| P7-0-1d | Add resolveStackSkillsFromAliases             | 2026-02-02 |
| P7-0-1e | Update loadStackById                          | 2026-02-02 |
| P7-0-1f | Remove skills from agent YAMLs                | 2026-02-02 |
| P7-0-1g | Add resolveAgentSkillsFromStack               | 2026-02-02 |
| P7-0-1h | Update init.tsx                               | 2026-02-02 |
| P7-0-1i | Remove skills from AgentDefinition type       | 2026-02-02 |
| P7-0-1j | Remove skills from agent.schema.json          | 2026-02-02 |
| P7-0-1k | Update source-loader, stack-plugin-compiler   | 2026-02-02 |
| P7-0-1l | Fix skill extraction in stack-plugin-compiler | 2026-02-02 |
| P7-0-1m | Update resolveAgents in resolver.ts           | 2026-02-02 |
| P7-0-2  | Add stack property to consumer config.yaml    | 2026-02-02 |

**Summary:**

- Fixed critical bug where stacks get wrong skills
- Stacks now define technologies by subcategory per agent
- Added `stack` property to consumer config.yaml

---

## Phase 7B: Wizard UX Redesign (COMPLETE)

### Phase 7.1: Data Model Updates

| Task ID | Task                                                      | Completed  |
| ------- | --------------------------------------------------------- | ---------- |
| P7-1-1  | Add `domain` field to subcategories in skills-matrix.yaml | 2026-02-02 |
| P7-1-2  | Add CLI domain to skills-matrix.yaml                      | 2026-02-02 |
| P7-1-3  | Update skills-matrix.schema.json for domain field         | 2026-02-02 |

### Phase 7.2: Wizard Store Migration

| Task ID | Task                                                  | Completed  |
| ------- | ----------------------------------------------------- | ---------- |
| P7-2-1  | Create wizard-store-v2.ts with new WizardStateV2 type | 2026-02-02 |
| P7-2-2  | Migrate wizard components to use v2 store             | 2026-02-02 |
| P7-2-3  | Remove wizard-store.ts (v1) after migration           | 2026-02-02 |

### Phase 7.3: Wizard Components

| Task ID | Task                                       | Tests | Completed  |
| ------- | ------------------------------------------ | ----- | ---------- |
| P7-3-1  | Create CategoryGrid component              | 49    | 2026-02-02 |
| P7-3-2  | Create WizardTabs component                | 23    | 2026-02-02 |
| P7-3-3  | Create SectionProgress component           | 15    | 2026-02-02 |
| P7-3-4  | Create StepBuild component                 | 27    | 2026-02-02 |
| P7-3-5  | Create StepRefine component                | 22    | 2026-02-02 |
| P7-3-6  | Update StepConfirm to match Phase 7 design | 32    | 2026-02-02 |

### Phase 7.4: Integration and Polish

| Task ID | Task                                   | Tests | Completed  |
| ------- | -------------------------------------- | ----- | ---------- |
| P7-4-1  | Integration testing (all wizard flows) | 28    | 2026-02-02 |
| P7-4-2  | Polish and edge cases                  | -     | 2026-02-02 |

**Summary:**

- 14 tasks completed
- New components: CategoryGrid, WizardTabs, SectionProgress, StepBuild, StepRefine, StepStackOptions
- Deleted components: step-category.tsx, step-subcategory.tsx, selection-header.tsx
- Full V2 store migration with history-based back navigation
- Domain-based filtering (web, api, cli, mobile, shared)
- 2D grid navigation with vim keys support
- 1000 tests passing

---

## Bug Fixes

| Task ID | Task                                     | Completed  |
| ------- | ---------------------------------------- | ---------- |
| D-11    | Fix uninstall command not clearing input | 2026-02-02 |
| D-10    | Create meta-stack for meta agents        | 2026-02-02 |

**D-11 Details:** Added `useApp()` hook and `exit()` calls to `UninstallConfirm` component in `src/cli/commands/uninstall.tsx` to properly restore terminal state after command completion.

**D-10 Details:** Added `meta-stack` to `config/stacks.yaml` with 5 agents (skill-summoner, agent-summoner, documentor, pattern-scout, web-pattern-critique) mapped to methodology and research skills (improvement-protocol, research-methodology, context-management, investigation-requirements, anti-over-engineering, reviewing).

| D-12 | Normalize skill IDs and output folder names | 2026-02-02 |
| D-06 | Fix require() syntax in matrix-resolver.test.ts | 2026-02-03 |

**D-12 Details:** Large refactoring to normalize skill IDs from path-based format with author (e.g., `web/framework/react (@vince)`) to kebab-case format (e.g., `web-framework-react`). Changes:

- Updated ~150 `skill_aliases` entries in `config/skills-matrix.yaml`
- Updated `DEFAULT_PRESELECTED_SKILLS` in `src/cli/consts.ts`
- Simplified `skill-copier.ts` and `skill-plugin-compiler.ts`
- Updated `marketplace-generator.ts` category patterns for new format
- Updated ~10 test files with new skill ID format
- Renamed 85 skill directories in `claude-subagents/src/skills/` from nested format to flat kebab-case
- Updated SKILL.md frontmatter `name` fields to normalized format (no author suffix, no slashes)
- Replaced `+` with `-` in multi-tool skill names (e.g., `better-auth+drizzle+hono` → `better-auth-drizzle-hono`)
- Removed `normalizeSkillId()` function since frontmatter now contains canonical IDs
- All 1182 tests pass

**D-06 Details:** Fixed CommonJS `require()` calls in `matrix-resolver.test.ts` by converting to ESM imports.

---

## Post-Phase 7B: Architecture Refinements (COMPLETE)

### Directory Structure Migration

| Task | Description                                                  | Completed  |
| ---- | ------------------------------------------------------------ | ---------- |
| D-13 | Migrate to `.claude-src/` for source files                   | 2026-02-03 |
| D-14 | Move all config to project-level `.claude/config.yaml`       | 2026-02-03 |
| D-15 | Refactor `cc eject` command                                  | 2026-02-03 |
| D-16 | BUG: Compiled agents missing preloaded_skills in frontmatter | 2026-02-03 |

**D-13 Details:** Separated source files from Claude Code's runtime directory.

**New architecture:**

```
project/
├── .claude/                      # Claude Code's directory (runtime/output)
│   ├── agents/                   # Compiled agents (OUTPUT)
│   └── skills/                   # Skills (directly here)
│
├── .claude-src/                  # Source files for customization (INPUT)
│   ├── agents/                   # Agent partials + templates (INPUT)
│   │   ├── _templates/
│   │   └── {agent-name}/
│   └── config.yaml               # THE config file
```

**Files modified:**

- `src/cli/consts.ts`: Added `CLAUDE_SRC_DIR = ".claude-src"` constant
- `src/cli/lib/config.ts`: Updated to read from `.claude-src/config.yaml` first, falls back to `.claude/config.yaml`
- `src/cli/commands/eject.ts`: Agent-partials eject to `.claude-src/agents/`, config saves to `.claude-src/config.yaml`
- `src/cli/commands/init.tsx`: Config writes to `.claude-src/config.yaml`, agents output to `.claude/agents/`
- `src/cli/lib/compiler.ts`: `createLiquidEngine()` checks `.claude-src/agents/_templates/` first
- `src/cli/lib/loader.ts`: Added `loadProjectAgents()` to load from `.claude-src/agents/`
- `src/cli/lib/project-config.ts`: Updated to use constants, checks `.claude-src/` first with `.claude/` fallback
- `src/cli/lib/installation.ts`: `detectInstallation()` checks `.claude-src/config.yaml` first
- `src/cli/lib/agent-recompiler.ts`: Merges project agents with built-in agents

**Key design decisions:**

- Backward compatibility maintained: all readers check `.claude-src/` first, then fall back to `.claude/`
- Skills remain in `.claude/skills/` (runtime files, not source)
- Compiled agents output to `.claude/agents/` (runtime output)
- All path construction uses `CLAUDE_DIR` and `CLAUDE_SRC_DIR` constants from `consts.ts`

**D-14 Details:** Eliminated global config at `~/.claude-collective/config.yaml`. All config now visible in project's `.claude-src/config.yaml`.

**Properties moved:**

- `source` - Skills source path/URL
- `author` - Default author for new skills/agents
- `marketplace` - Marketplace identifier
- `agents_source` - Separate source for agents

**Resolution priority:**

1. `--source` flag (ephemeral, highest priority)
2. `CC_SOURCE` env var
3. `.claude-src/config.yaml` in project
4. Default (`github:claude-collective/skills`)

**D-15 Details:** Fixed `eject skills` to load from source marketplace, consolidated templates+agents into `agent-partials`, removed config eject.

**New eject types:**

- `agent-partials` - CLI's `_templates/*.liquid` + agent partials (always from CLI)
- `skills` - All skills from source (default: public marketplace, or custom via `--source`)
- `all` - Both of the above

**D-16 Details:** Fixed bug where agents compiled by `cc init` did not have `preloaded_skills` in frontmatter.

**Root causes fixed:**

1. Type mismatch: `init.tsx` used deprecated `WizardResult` type instead of `WizardResultV2`
2. Missing parameters: `resolveAgents()` called without `stack` and `skillAliases` parameters
3. "Customize" path not pre-populated: wizard didn't pre-populate `domainSelections` with stack's defaults

**Files fixed:**

- `src/cli/commands/init.tsx`: Changed to `WizardResultV2`, passes `loadedStack` and `skillAliases` to `resolveAgents()`
- `src/cli/stores/wizard-store.ts`: Added `populateFromStack()` action
- `src/cli/components/wizard/step-stack-options.tsx`: Calls `populateFromStack()` when "customize" selected

**Tests added:** Unit tests for `resolveAgentSkillsFromStack`, `getAgentSkills`, and `resolveAgents` in `resolver.test.ts`

**All 1186 tests pass.**

---

## Agent Architecture Alignment & Documentation Updates (COMPLETE)

Completed as part of post-research alignment work.

**Summary:**

- 6 tasks completed (T3, T4, T6, T7, T8, T9)
- Created AGENT-COMPLIANCE-BIBLE.md with 30 runnable tests
- Updated 15+ examples.md files for conciseness
- Recompiled all 18 agents
- Added conciseness standards to agent-summoner

### T3: Align Claude Subagents Documentation [DONE]

- [x] Review `.claude/agents/` compiled bibles
- [x] Bible references are CORRECT (files exist at `docs/bibles/`)
- [x] Update `src/stacks/` references → source files now use `.claude-src/config.yaml`
- [x] Fix skills architecture documentation - source files use `.claude/skills/{domain}-{subcategory}-{technology}/`
- [x] Recompile agents to update `.claude/agents/` with fixed source content (`cc compile --output .claude/agents`)

### T4: Update Agent-Summoner and Skill-Summoner [DONE]

- [x] Fix agent-summoner to reference correct architecture (`src/agents/{category}/{agent-name}/`)
- [x] Remove references to non-existent `src/docs/` files
- [x] Update skill creation workflow for directory-based skills
- [x] Align naming convention documentation with actual `{domain}-{subcategory}-{technology}` pattern
- [x] Add conciseness standards to agent-summoner/workflow.md (60-100 lines, no N/A, no meta-commentary)
- [x] Update examples.md to be concise (341→173 lines)
- [x] Recompiled all 18 agents with `cc compile`

### T6: Bible Path References [DONE]

- [x] Fix INDEX.md bible paths (`src/docs/` → `docs/bibles/`)
- [x] Fix agent names in INDEX.md (frontend→web, backend→api, add cli variants)
- [x] Add migration agent category
- [x] Mark missing plugin docs as TODO

### T7: SKILL-ATOMICITY-BIBLE Updates [DONE]

- [x] Add skill directory structure section
- [x] Document examples/ folder pattern with separate files
- [x] Add TOC guidance for SKILL.md files

### T8: Convert Bibles to Skills [RESEARCH COMPLETE]

Research findings: Converting Bibles to skills is **technically possible but strategically problematic**.

**Recommendation:** Keep Bibles as standalone reference documents. Create complementary **narrow reference skills** for specific use cases instead.

### T9: Update Skill-Summoner Documentation [DONE]

- [x] Fix `src/skills/` → `.claude/skills/` path references
- [x] Document 3-part naming pattern `{domain}-{subcategory}-{technology}`
- [x] Document examples/ folder structure
- [x] Add TOC guidance to skill creation workflow

### T1: Review Agent Definitions for Alignment [DONE]

- [x] Comb through all agent definitions in `src/agents/`
- [x] Verify YAML configs match documented schema
- [x] Fix outdated references (e.g., `tester-agent` → `web-tester/cli-tester`)
  - Fixed `pattern-critique` → `web-pattern-critique` in pattern-scout/workflow.md and web-pattern-critique/workflow.md
  - Fixed `web-pattern-scout` → `pattern-scout` in agent-mappings.yaml and skill-agent-mappings.ts
- [x] Add missing agents to documentation (e.g., `cli-migrator`)
  - cli-migrator already exists in src/agents/migration/cli-migrator/ and stacks.yaml
- [x] Update agent descriptions that reference non-existent agents

### T2: Generalize Agent Specificity [DONE]

- [x] Review agents for over-specific technology references
- [x] Frontend agents should mention "styling" not "CSS/SCSS"
  - Updated web-researcher intro.md and agent.yaml
  - Updated web-reviewer intro.md and agent.yaml
  - Updated web-pattern-critique intro.md and agent.yaml
- [x] Backend agents should mention "database" not specific ORMs
  - Updated api-researcher intro.md (removed Hono, Drizzle, Better Auth, etc.)
  - Updated api-reviewer intro.md
- [x] Ensure agents focus on patterns, not implementations
  - Generalized all agent.yaml descriptions to use generic terms (UI components, styling methodology, database, etc.)
  - Updated intro.md files to use generic language
- [x] Keep technology details in SKILLS, not agent prompts
  - Agent prompts now use generic terms; specific tech is in skills config

---

## Type Narrowing (COMPLETE)

Full audit and narrowing of all `string` types to union types across 37+ files.

**Summary:**

- All sections completed (1–4, plus test files, source types, lib files, commands, components, stores)
- 86 remaining casts — all classified as legitimate boundary casts with comments
- 0 type errors, 1149 tests passing

**Key results:**

- Union types added to `types-matrix.ts`: `SkillId`, `CategoryPath`, `SkillAlias`, `AgentName`, `Domain`, `Subcategory`
- Template literal type: `SkillId = ${SkillIdPrefix}-${string}`
- Named aliases: `SkillRef`, `SubcategorySelections`, `DomainSelections`, `CategoryMap`, `ResolvedSubcategorySkills`
- Typed object utilities: `typedEntries<K,V>()`, `typedKeys<K>()` in `src/cli/utils/typed-object.ts`
- Shared type aliases extracted: `ModelName`, `PermissionMode`
- `Record<UnionType, X>` → `Partial<Record<UnionType, X>>` everywhere runtime is sparse
- Pre-resolution types use `(SkillAlias | SkillId)[]`, post-resolution use `SkillId[]`
- Source types (`RawMetadata`, `LocalRawMetadata`) typed at YAML boundary — downstream casts eliminated
- All function signatures narrowed: matrix-loader, matrix-resolver, resolver, config-generator, skill-copier, source-loader, compiler, stacks-loader, stack-plugin-compiler, agent-recompiler, local-installer, defaults-loader, plugin-finder, skill-fetcher, loader
- Cross-cutting types narrowed: `src/types.ts` (SkillDefinition, CompiledAgentData, CustomAgentConfig, AgentYamlConfig, AgentDefinition, AgentConfig, SkillMetadataConfig, AgentFrontmatter, SkillFrontmatter, ProjectConfig)
- Stack types narrowed: `types-stacks.ts` (StackAgentConfig, Stack)
- Wizard components narrowed: wizard-store, wizard.tsx, step-build.tsx, step-confirm.tsx, step-stack.tsx, category-grid.tsx, utils.ts
- Command files narrowed: edit.tsx, search.tsx, info.ts, new/skill.ts, init.tsx
- Test files: unnecessary casts removed, boundary casts kept with comments
- `DEFAULT_PRESELECTED_SKILLS` typed as `readonly SkillId[]`

**Boundary cast classification (86 total):**

| Category               | Count | Description                                      |
| ---------------------- | ----- | ------------------------------------------------ |
| Object.keys/entries    | ~20   | TS returns `string[]`, cast to union necessary   |
| CLI arg boundary       | ~7    | User input from flags is `string`                |
| Test data construction | ~30   | Mock matrix, intentionally-invalid values        |
| YAML parse boundary    | ~5    | Raw config parsing                               |
| Type narrowing         | ~4    | CategoryPath → Subcategory, SkillAlias lookup    |
| Store initialization   | ~2    | Empty initial state                              |
| Widening for indexing  | ~4    | String indexing on Partial<Record<UnionType, X>> |

**Most common patterns narrowed:**

1. `Record<string, string>` → `Record<SkillAlias, SkillId>` (alias maps, ~15 instances)
2. `string[]` → `SkillId[]` (skill ID arrays, ~12 instances)
3. `string[]` → `AgentName[]` (agent name arrays, ~8 instances)
4. `string` → `AgentName` (single agent name params, ~5 instances)
5. `Set<string>` → `Set<SkillId>` (dedup sets, ~5 instances)

For the full audit with every field decision, see the [TypeScript Types Bible](./typescript-types-bible.md). For the project-specific type system, see the [Architecture document](./docs/architecture.md#type-system).

---

## Phase 7: Type Narrowing (COMPLETE)

39 tasks completed. See [TODO-type-narrowing.md](./TODO-type-narrowing.md) for deferred items and notes.

**Summary:**

- T1-T37 all completed
- 0 type errors, 1344 tests passing (68 test files, 34 skipped)
- All `interface` → `type`, dead fields removed, agent types composed from shared base
- `SkillEntry` union eliminated, `stack` is single source of truth for skill assignment
- `SkillAlias` renamed to `SkillDisplayName`, `SkillRef` removed
- Zod schemas at all parse boundaries
- Remeda utilities across 20+ files
- Types co-located into `src/cli/types/` (6 domain files + barrel index)
- Testing gaps filled: 19 untested lib files covered, user journey tests, error paths, shared fixtures

### Completed Tasks

T1: Replace `interface` with `type` across codebase
T2: Remove `name` field from `SkillDefinition` and `Skill`
T3: Unify `Skill` and `SkillDefinition`
T4: Convert inline `//` comments to JSDoc on type fields
T5: Compose agent types from a shared base
T6: Eliminate `SkillEntry` union — always use `SkillAssignment`
T7: Remove dead `ProjectConfig` fields
T8: Remove dead `custom_agents` infrastructure
T9: Remove `agent_skills` — redundant with `stack`
T10: Remove `preload_patterns` — redundant with `SkillAssignment.preloaded`
T11: Make `stack` the single source of truth for skill assignment
T12: Remove `CompileConfig.claude_md` — always empty string
T13: Remove `CompileMode` type and `getDirs()` function
T14: Remove `LoadedProjectConfig.isLegacy` — always `false`
T15: Remove `ProjectConfig.hooks` — dead field
T16: Remove `ResolvedSkill.recommendedBy` and `requiredBy` — unused inverse fields
T17: Remove dead `SkillFrontmatter` fields — spec fields with no implementation
T18: Remove dead `PluginManifest` metadata fields
T19: Remove `MarketplaceFetchResult.cacheKey` — set but never read
T20: Remove dead `skill-agent-mappings.ts` code
T21: Remove dead `resolver.ts` functions and unused interfaces
T22: Deduplicate `KEY_SUBCATEGORIES` constant
T23: Remove unused `compileAllAgents()` `_config` parameter
T24: Rename/consolidate duplicate `loadProjectConfig` functions
T25: Consolidate duplicate format functions in `config.ts`
T26: Eliminate `SkillRef` and rename `SkillAlias` to display name
T27: Rename `name` → `displayName` across non-skill types
T28: Frontend cleanup — dead props, state, and code
T29: Co-locate type definitions into `src/cli/types/` directory
T30: Fix `string` arrays that should be `SkillId[]` (Remeda type inference)
T31: Remove redundant test code (~2,100+ lines)
T32: Fill testing gaps and reorganize test structure (Parts A-G)
T33: Narrow `ProjectConfig.agents` from `string[]` to `AgentName[]`
T34: Narrow `getAgentsForSkill()` return type to `AgentName[]`
T35: Replace remaining `Object.entries`/`Object.keys` and narrow `Record<string, X>` keys
T36: Harden all parse boundaries — throw or warn on every failure
T37: Fix stack property ignoring user customizations + subcategory key mismatch

### T29: Co-locate type definitions [DONE]

Consolidated 4 scattered type files into `src/cli/types/` with 6 domain files + barrel index:

- `skills.ts` — SkillId, SkillIdPrefix, SkillDisplayName, CategoryPath, SkillDefinition, etc.
- `agents.ts` — AgentName, AgentDefinition, AgentConfig, AgentFrontmatter, etc.
- `config.ts` — ProjectConfig, CompileConfig, CompileContext, ValidationResult
- `matrix.ts` — Domain, Subcategory, CategoryDefinition, MergedSkillsMatrix, etc.
- `stacks.ts` — Stack, StacksConfig, StackAgentConfig
- `plugins.ts` — PluginManifest, Marketplace, MarketplaceFetchResult, etc.
- `index.ts` — barrel re-export (`export type *`)

Old files deleted: `src/types.ts`, `src/cli/types.ts`, `src/cli/types-matrix.ts`, `src/cli/types-stacks.ts`.
60+ import paths updated across entire codebase.

### T32: Fill testing gaps and reorganize test structure [DONE]

**Part A:** Reorganized test file locations — component tests co-located, integration tests in `lib/__tests__/integration/`.

**Part B:** Filled testing gaps — 19 previously untested lib files now have coverage (P1-P3 priority tiers).

**Part C:** Added user journey tests — 71 tests across 4 files (compile-flow, edit-recompile, install-compile, config-precedence).

**Part D:** Error path coverage — 12 error path tests added to `loader.test.ts`.

**Part E:** Command test coverage — deferred (thin wrappers over well-tested lib functions).

**Part F:** Removed external repo dependency from `compilation-pipeline.test.ts` — rewrote 17 tests using `createTestSource()` fixture.

**Part G:** Consolidated hardcoded test fixtures into shared helpers — `createMockCategory`, `createMockResolvedStack`, `createComprehensiveMatrix`, `createBasicMatrix`.

---

## D5: Drop AJV — Use Zod Exclusively (COMPLETE)

Replaced AJV with Zod `.safeParse()` for all runtime validation. Single validation layer: TypeScript types + Zod schemas.

| What                 | Details                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Dependencies removed | `ajv` + `ajv-formats` (23 packages pruned)                                                |
| schemas.ts           | +141 lines — 4 new strict validation schemas                                              |
| schema-validator.ts  | Rewritten — AJV → Zod `.safeParse()`, schema file loading eliminated                      |
| plugin-validator.ts  | Rewritten — AJV + remote schema fetching → Zod `.safeParse()`                             |
| Tests                | Cleaned up — removed JSON schema file creation in temp dirs                               |
| Verification         | `cc validate` passes against CLI repo (18/18 agents) and claude-subagents (174/174 files) |

**New validation schemas added to `schemas.ts`:**

- `agentFrontmatterValidationSchema` — strict, for agent .md frontmatter
- `skillFrontmatterValidationSchema` — strict, for SKILL.md frontmatter
- `metadataValidationSchema` — strict, for marketplace metadata.yaml
- `stackConfigValidationSchema` — strict, for stack config.yaml

**Key design:** Lenient loader schemas (`.passthrough()`) remain for loading; strict validation schemas (`.strict()`) added for `cc validate`. Dual schema pattern ensures loading is forgiving while validation catches errors.

**Stats:** 0 type errors, 1344 tests passing, net -69 lines (249 added, 318 removed).

---

## D6: Generate JSON Schemas from Zod and Wire $schema References (COMPLETE)

Generated 10 JSON Schema files from Zod schemas using `z.toJSONSchema()` (Zod v4 native). Replaced all remote `$schema` URLs with local relative paths for VS Code editor validation.

| What              | Details                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Script created    | `scripts/generate-json-schemas.ts` — generates 10 schema files from Zod                                            |
| npm scripts       | `generate:schemas` (regenerate), `generate:schemas:check` (CI diff check)                                          |
| Schemas generated | 10 files in `src/schemas/` from Zod source of truth                                                                |
| Symlinks removed  | `metadata.schema.json` + `stack.schema.json` (were symlinks to claude-subagents)                                   |
| $schema wiring    | 18 agent.yaml files: `$schema: https://...` → `# yaml-language-server: $schema=../../../schemas/agent.schema.json` |
| New schema refs   | `config/skills-matrix.yaml` — added `# yaml-language-server` comment                                               |
| Existing refs     | `config/stacks.yaml` — already correct, no change needed                                                           |
| New schema added  | `agentYamlGenerationSchema` in schemas.ts — lenient `z.string()` for id (marketplace compatible)                   |
| Dedup             | Inline `agentValidationSchema` in schema-validator.ts replaced with import from schemas.ts                         |
| Verification      | `cc validate` passes: CLI repo (18/18), claude-subagents (174/174)                                                 |

**Schema mapping (10 files):**

| JSON Schema File                | Zod Source                         |
| ------------------------------- | ---------------------------------- |
| `agent.schema.json`             | `agentYamlGenerationSchema`        |
| `agent-frontmatter.schema.json` | `agentFrontmatterValidationSchema` |
| `hooks.schema.json`             | `hooksRecordSchema`                |
| `marketplace.schema.json`       | `marketplaceSchema`                |
| `metadata.schema.json`          | `metadataValidationSchema`         |
| `plugin.schema.json`            | `pluginManifestSchema`             |
| `skill-frontmatter.schema.json` | `skillFrontmatterValidationSchema` |
| `skills-matrix.schema.json`     | `skillsMatrixConfigSchema`         |
| `stacks.schema.json`            | `stacksConfigSchema`               |
| `stack.schema.json`             | `stackConfigValidationSchema`      |

**Known limitation:** `hooks.schema.json` generated from Zod lacks `if/then` conditionals (not expressible in Zod). The generated version provides basic structure validation but not conditional field requirements.

**Stats:** 0 type errors, 1344 tests passing. Files: 4 modified + 1 created + 2 symlinks removed + 10 schema files regenerated + 19 YAML files updated.

---

## Deferred

### D4: Create a tracking-documentation sub-agent [DEFERRED]

**Goal:** Create a specialized sub-agent that generates and maintains project tracking documentation — NOT code-level documentation (JSDoc, READMEs), but operational tracking artifacts.

**Scope:**

- TODO file formatting conventions (how to structure TODO files)
- Task lifecycle documentation (status labels, archival rules, how to move completed tasks)
- Changelog formatting (Keep a Changelog conventions, what goes in each section)
- Version bump decisions (when to use major/minor/patch)
- Progress summaries (how to write phase completion summaries)
- Commit message conventions (conventional commits format)

**Why a dedicated agent:**

- Current agents (cli-developer, web-developer, etc.) focus on code implementation
- Tracking documentation has its own conventions that are easy to get wrong (e.g., forgetting to archive tasks, inconsistent changelog entries, wrong version bump type)
- A dedicated agent could enforce consistency across sessions

**Implementation approach:**

- Create as a skill (not a full agent) since it's advisory, not tool-wielding
- Include templates for each document type
- Reference the project's actual files as canonical examples
