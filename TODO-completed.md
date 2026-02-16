# Agents Inc. CLI - Completed Tasks

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

All Phase 3 tasks completed (P3-14 completed 2026-02-16).

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

**D-14 Details:** Eliminated global config at `~/.agents-inc/config.yaml`. All config now visible in project's `.claude-src/config.yaml`.

**Properties moved:**

- `source` - Skills source path/URL
- `author` - Default author for new skills/agents
- `marketplace` - Marketplace identifier
- `agents_source` - Separate source for agents

**Resolution priority:**

1. `--source` flag (ephemeral, highest priority)
2. `CC_SOURCE` env var
3. `.claude-src/config.yaml` in project
4. Default (`github:agents-inc/skills`)

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
- Created agent-compliance-bible.md with 30 runnable tests
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

### T7: skill-atomicity-bible Updates [DONE]

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

## Deferred TODOs Resolved (2026-02-11)

| Task ID | Task                           | Resolution                                                                                                                                                                                    |
| ------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P4-16   | Shared test fixtures           | **DONE** — T32 Part G consolidated fixtures into `helpers.ts` (~1120 lines), `test-fixtures.ts`, `test-constants.ts`, `create-test-source.ts`                                                 |
| D-04    | Missing tailwind skill         | **DONE** — `web-styling-tailwind` exists in marketplace. Stacks no longer reference it in agent mappings (only in description text).                                                          |
| D-07    | Full skill path as folder name | **OBSOLETE** — D-12 normalized skill IDs to kebab-case (`web-framework-react`). Full category path is encoded in the ID itself.                                                               |
| D-15    | TypeScript for config files    | **OBSOLETE** — Zod schemas + union types + generated JSON schemas achieve the original goals (type safety, IDE support, validation). YAML remains for marketplace distribution compatibility. |
| D-17    | Config YAML merging strategy   | **DONE** — `config-merger.ts` implements deep merge with identity field precedence, skill/agent array union, and stack deep-merge. 15 tests.                                                  |

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

---

## Phase 8: CLI UX Improvements (COMPLETE)

#### U1: Progress Navigation Bar - Tab Styling [DONE]

- [x] Replace circle indicators with tab-style navigation in `wizard-tabs.tsx`
- [x] Active step: green background with 1-char padding (`{" "}[N] Label{" "}`)
- [x] Completed steps: white background, dark text
- [x] Pending steps: default text, no background
- [x] Add horizontal divider lines above and below tabs
- [x] Remove symbol row entirely (no more checkmark/dot/circle)

**Files:** `src/cli/components/wizard/wizard-tabs.tsx`, tests

#### U2: Header - Add Version Display [DONE]

- [x] Add `version` prop to Wizard component
- [x] Pass `this.config.version` from Init command to Wizard
- [x] Display version in header area (near WizardTabs or in new header component)

**Files:** `src/cli/commands/init.tsx`, `src/cli/components/wizard/wizard.tsx`

#### U3: Footer - Split Layout with WizardFooter Component [DONE]

- [x] Create new `wizard-footer.tsx` component with left/right props
- [x] Use `justifyContent="space-between"` pattern
- [x] Left side: navigation controls (up/down, left/right, SPACE, etc.)
- [x] Right side: action hints (ESC back, ENTER continue)
- [x] Update all step components to use WizardFooter
- [x] Remove global footer from wizard.tsx

**Files:** `src/cli/components/wizard/wizard-footer.tsx` (NEW), `wizard.tsx`, `step-approach.tsx`, `step-build.tsx`, `step-refine.tsx`, `step-confirm.tsx`

#### U4: Build Step - Framework-First Flow [DONE]

- [x] Update `step-build.tsx` to implement framework-first filtering logic
- [x] Update `category-grid.tsx` to remove circles/strikethrough, add background colors
- [x] Add `compatibleWith` field to `ResolvedSkill` type in `types-matrix.ts`
- [x] Update `matrix-loader.ts` to preserve `compatibleWith` during skill resolution
- [x] Update tests in `category-grid.test.tsx` and `step-build.test.tsx`

**Implementation notes:**

- Web domain only: Framework-first flow hides other categories until framework selected
- Skills with empty `compatibleWith` array are shown (backwards compatible)
- Visual styling: selected = cyan background (black text), focused = gray background (white text), disabled = dimmed text
- Table layout with fixed column widths (16 chars) for vertical alignment

#### U5: Import Third-Party Skills Command [DONE]

- [x] Create `cc import skill` command
- [x] Support GitHub repo sources: `cc import skill github:owner/repo --skill skill-name`
- [x] Download skill to `.claude/skills/` directory
- [x] Add validation for SKILL.md and metadata.yaml
- [x] Track origin with `forked_from` metadata

**Files:** `src/cli/commands/import/skill.ts` (NEW)

#### U7: Align Skills Matrix Categories with Domains [DONE]

- [x] Rename top-level categories in `config/skills-matrix.yaml` to match domain names
- [x] Update `src/schemas/skills-matrix.schema.json` if category names are validated
- [x] Update any code that references the old category names
- [x] Update docs to reflect the change

#### U8: Consumer config.yaml stack field supports array/object skill assignments [DONE]

`stacks.yaml` and its loader already support all three YAML formats (bare string, object with `preloaded`, array of objects) and normalize to `SkillAssignment[]`. Extended the consumer project's `.claude-src/config.yaml` `stack` field schema to accept the same formats. Extracted `normalizeAgentConfig()`/`normalizeStackRecord()` shared helpers and `getStackSkillIds()` utility. Fixed bug in `hashStackConfig` where `Object.values()` on `SkillAssignment[]` produced objects instead of IDs.

**Files:** `schemas.ts`, `stacks-loader.ts`, `project-config.ts`, `config-generator.ts`, `resolver.ts`, `compile.ts`, `doctor.ts`, `stack-plugin-compiler.ts`, `local-installer.ts`

---

## Moved from TODO.md (2026-02-16)

#### U6: Interactive Skill Search Command [DONE]

- [x] Add `SourceEntry` interface to config types
- [x] Add `sources` array to GlobalConfig and ProjectConfig
- [x] Add validation for sources array in config loading
- [x] Create `resolveAllSources()` function
- [x] Create interactive search component (`src/cli/components/skill-search/`)
- [x] Update search command to support dual-mode (static/interactive)
- [x] Support `--interactive` / `-i` flag
- [x] Support `--refresh` flag for cache refresh
- [x] Live filtering as user types
- [x] Multi-select with checkboxes
- [x] Keyboard navigation (j/k, space, enter, esc)
- [x] Import selected skills to `.claude/skills/`

**Files modified:**

- `src/cli/lib/config.ts` - Added SourceEntry interface, sources array, resolveAllSources()
- `src/cli/commands/search.tsx` - Dual-mode search (static + interactive)
- `src/cli/components/skill-search/skill-search.tsx` - Interactive UI component
- `src/cli/components/skill-search/index.ts` - Exports

---

#### U12: Create CLAUDE.md with Documentation References [DONE]

- [x] Create root-level `CLAUDE.md` file
- [x] Add decision trees (test helpers, type narrowing, error handling)
- [x] Add code conventions (file naming, imports, constants)
- [x] Add TypeScript enforcement rules
- [x] Add architecture quick reference
- [x] Add common patterns and checklists
- [x] Link to detailed documentation

This file now serves as the entry point for AI agents to understand the codebase conventions.

**Files:** `CLAUDE.md` (created in v0.31.0)

---

## Moved from todo-loop.md (2026-02-16)

### CLI UX

#### U9: Fixed Height for Main CLI Content [DONE]

The main content area of the CLI application needs a fixed height so it doesn't cause the terminal to jump/reflow as content changes (e.g., when navigating wizard steps or toggling skills). Implement virtual windowing with dynamic terminal resize handling to constrain the visible content area.

**Research completed:** ✅

- Ink automatically handles terminal resize via `stdout.on('resize')` events
- Virtual windowing at data layer required (no native scroll in Ink)
- Custom `useTerminalDimensions()` hook pattern for reactive dimension tracking
- Existing pattern in `skill-search.tsx` provides reference implementation

**Implementation plan:** See [docs/features/active/scroll-viewport/implementation.md](./docs/features/active/scroll-viewport/implementation.md)

**Key components:**

- New hook: `use-terminal-dimensions.ts` for reactive resize handling
- New hook: `use-virtual-scroll.ts` for category-level windowing
- Modified: `category-grid.tsx` with scroll indicators
- Modified: `step-build.tsx` to calculate and pass available height

---

#### U10: Proper Effects for Active Skills [DONE]

Currently active/selected skills may not have proper visual effects or feedback. Need to implement clear visual indicators for skills that are actively selected/enabled, such as:

- Highlight or background color for active skill entries
- Transition or animation when toggling skill state
- Clear differentiation between active, inactive, and disabled states

**Research needed:**

- Current skill rendering in `category-grid.tsx` and `step-build.tsx`
- What visual feedback patterns work in terminal UIs (Ink limitations)
- Consistent styling with existing theme (cyan/green/dim conventions)

---

#### U14: Simplify Wizard Intro - Allow Direct Stack Selection [DONE]

**Spec:** See [docs/features/active/stack-domain-filtering/spec.md](./docs/features/active/stack-domain-filtering/spec.md)

Merge the "approach" step and "stack" step into a single unified first step. Currently users must:

1. Choose "Use a template" or "Start from scratch"
2. Then see stacks OR domain selection

**New flow:**

1. Single step showing all stacks + "Start from scratch" as the last option
2. Domain selection follows (same for both paths)

**Benefits:**

- One fewer step in wizard
- More direct - users see stacks immediately
- Both paths converge on domain selection

**Implementation:**

- Delete `step-approach.tsx`
- Merge approach selection into `step-stack.tsx`
- Update `wizard.tsx` to remove "approach" step
- Add `getDomainsFromStack()` utility
- Reuse existing `<DomainSelection>` component

**Files:**

- `src/cli/components/wizard/step-stack.tsx` (merge approach into stack)
- `src/cli/components/wizard/step-approach.tsx` (delete)
- `src/cli/components/wizard/wizard.tsx` (remove approach step)
- `src/cli/stores/wizard-store.ts` (remove approach state)
- `src/cli/components/wizard/utils.ts` (add getDomainsFromStack)

---

#### U16: Fix Overlay Dismissal - Allow Hiding After Showing [DONE]

**Issue:** The existing overlays (help modal, settings) can be shown with a hotkey but the user experience for hiding them needs improvement.

**Current behavior to verify:**

- Help modal: `?` key shows, but how to hide?
- Settings overlay: `G` key shows, but how to hide?

**Expected behavior:**

- Same key should toggle (show/hide)
- ESC should always dismiss
- Clear visual feedback about dismissal options

**Research needed:**

- Test current overlay dismissal in `help-modal.tsx` and `step-settings.tsx`
- Check if `showHelp` and `showSettings` state properly toggles
- Verify ESC key handling in overlays

**Files:**

- `src/cli/components/wizard/help-modal.tsx`
- `src/cli/components/wizard/step-settings.tsx`
- `src/cli/stores/wizard-store.ts` (toggle actions)
- `src/cli/components/wizard/wizard.tsx` (hotkey handling)

---

### Configuration & Data

#### U11: Update stacks.yaml agent configs with full skill distributions [DONE]

The `config/stacks.yaml` stack definitions have many agents with empty configs (`web-pm: {}`, `agent-summoner: {}`, `cli-tester: {}`, etc.). While `generateProjectConfigFromSkills` + `getAgentsForSkill` now distributes skills broadly at init time, the stacks.yaml itself should reflect the intended skill assignments so it serves as readable documentation of what each stack provides.

For example, the `nextjs-fullstack` stack's `cli-developer` should know about React, Hono, etc. — not just `cli-framework`. Similarly, `web-pm` should have the full set of web + api skills since it needs context about the entire stack to write specs.

**What to do:**

- Review `SKILL_TO_AGENTS` mappings in `skill-agent-mappings.ts` for each domain
- Populate empty agent configs in all stacks with the skills they should know about
- Ensure consistency between stacks.yaml and the runtime `getAgentsForSkill` mappings

**Files:** `config/stacks.yaml`

---

#### H6: Implement intelligent default skill assignment for agents [DONE]

Make skill assignment to agents more intelligent by setting sensible defaults based on agent type. For example: web agents should automatically get all web-related skills assigned, with the framework skills preloaded; API agents should get API-related skills; CLI agents should get CLI-related skills. This improves the out-of-box experience and ensures agents have the right tools for their domain.

---

#### H12/H14: Implement agents_dir consumption (Phases 1-2) [DONE]

**Phase 1 - Implement agents_dir:**
Currently, `agents_dir` is defined in types/schema but NOT consumed in runtime code. Before deciding whether to keep or remove it, complete the implementation:

- Wire `agents_dir` from config through to `agent-fetcher.ts` (similar to how `skills_dir` is handled in `source-loader.ts`)
- Ensure `getAgentDefinitions()` reads and uses the config value
- Add integration tests to verify it works

**Investigation findings (Task #12):**

- ✅ `skills_dir`, `matrix_file`, `stacks_file` are implemented and being read from config YAML in `source-loader.ts`
- ❌ `agents_dir` is defined in types/schema/tests but NOT actually used in runtime code
- These fields are designed for **marketplace repositories** with non-standard layouts (e.g., `lib/skills` instead of `src/skills`)
- For user projects, skills/agents always come from `.claude/` dir, so these configs may not be needed

**Phase 2 - Test eject scenarios with plugins:**
Test various levels of eject functionality when using plugins:

- Can you eject only templates and use them with plugins?
- Can you eject skills individually while keeping others as plugins?
- Can you mix ejected content with plugin content?
- Document supported eject workflows and add tests to prevent regressions

**Note:** Phase 3 (evaluate path override strategy) requires human decision — not included here.

---

#### H13: Auto-generate commented path overrides in config.yaml on init [DONE]

During `cc init`, automatically add the custom path configuration fields (`skills_dir`, `agents_dir`, `stacks_file`, `matrix_file`) to the generated `.claude-src/config.yaml` file, but have them commented out by default with helpful comments explaining they're for marketplace repos with non-standard layouts. This provides discoverability without cluttering the config for typical users.

Example:

```yaml
name: my-project
# Custom paths (for marketplace repos with non-standard layouts):
# skills_dir: src/skills
# agents_dir: src/agents
# stacks_file: config/stacks.yaml
# matrix_file: config/skills-matrix.yaml
```

---

### Changelog & Versioning

#### U16: Migrate to Split-File Changelog Architecture [DONE]

Migrate from the single large `CHANGELOG.md` file (966+ lines) to a split-file architecture that's safer for AI agents to manage.

**Current problem:**

- Single 966+ line file prone to accidental truncation when AI agents edit it
- No protection against overwriting history

**New architecture:**

- `CHANGELOG.md` - Summary index (append-only, brief entries with links)
- `changelogs/{version}.md` - Detailed release notes per version (create new file each release)

**Protocol:** See [docs/guides/commit-protocol.md](./docs/guides/commit-protocol.md) for AI commit and changelog conventions.

**Migration steps:**

1. Create `changelogs/` directory
2. Split current CHANGELOG.md into individual version files (0.30.0.md, 0.29.5.md, etc.)
3. Rewrite CHANGELOG.md as a summary index with links
4. Update commit-protocol.md if needed
5. Future releases follow protocol: create new file + prepend to index

**Format for version files:**

- Use Keep a Changelog sections where applicable: Added, Changed, Fixed, Removed
- Include version number and release date
- Reverse chronological order in the index (newest first)

**Benefits:**

- AI agents create files instead of editing (safer)
- Can't accidentally delete history (old files immutable)
- Each release is atomic (one new file)
- Summary index stays small and scannable
- No complex tooling needed — just follow `docs/guides/commit-protocol.md`

**Files:**

- `CHANGELOG.md` (rewrite as index)
- `changelogs/*.md` (new directory with version files)
- `docs/guides/commit-protocol.md` (already created)

---

### Documentation

#### H20: Reorganize documentation folder to Option 4 (Hybrid structure) [DONE]

Reorganize the `docs/` folder using the Option 4 (Hybrid) categorization scheme to improve discoverability and separate concerns by type and status.

**New structure:**

```
docs/
├── index.md                           # Update with new structure
│
├── standards/                         # Enforceable rules
│   ├── code/                          # For CLI developers
│   │   ├── clean-code-standards.md
│   │   └── type-conventions.md
│   └── content/                       # For agent/skill authors (Bibles)
│       ├── claude-architecture-bible.md
│       ├── prompt-bible.md
│       ├── skill-atomicity-bible.md
│       ├── agent-compliance-bible.md
│       ├── documentation-bible.md
│       ├── frontend-bible.md
│       └── loop-prompts-bible.md      # New - from H21
│
├── reference/                         # System documentation
│   ├── architecture.md
│   ├── data-models.md
│   └── commands.md
│
├── guides/                            # How-to docs
│   ├── creating-a-marketplace.md
│   └── migrate-to-marketplace.md
│
├── features/                          # Feature development
│   ├── active/                        # In development
│   │   ├── scroll-viewport/
│   │   │   ├── research.md
│   │   │   └── implementation.md
│   │   ├── multi-source/
│   │   │   ├── research.md
│   │   │   └── implementation.md
│   │   └── stack-domain-filtering/
│   │       └── spec.md
│   ├── proposed/                      # Research only
│   │   ├── skill-consume.md
│   │   ├── skill-search.md
│   │   └── cli-agent-invocation.md
│   └── completed/                     # Shipped features
│       └── multi-skill-categories-findings.md
│
└── archive/                           # Deprecated/historical
    └── recent-claude-code-updates.md
```

**Benefits:**

- **Standards split clearly:** Code standards (CLI devs) vs Content standards (agent/skill authors)
- **Feature lifecycle visible:** Proposed → Active → Completed status tracking
- **Related docs grouped:** Research + implementation for same feature live together
- **Easy to maintain:** Move completed features to archive/ when done

**Action items:**

1. Create new directory structure
2. Move files to appropriate locations (use `git mv` to preserve history)
3. Update all internal links in documentation
4. Update `docs/index.md` with new structure and navigation
5. Update `claude.md` to reference new paths
6. Update any agent/skill references to Bible paths
7. Test that all links resolve correctly

---

#### H21: Create Loop Prompts Bible from "Reminders for Agents" [DONE]

Extract the "Reminders for Agents" section from `TODO.md` and transform it into a comprehensive Bible for loop/orchestrator agents (the main agent that coordinates sub-agents).

**Current content in TODO.md:**

- R1: Use Specialized Agents - Delegation patterns
- R2: Handle Uncertainties - Research and investigation workflows
- R3: Blockers Go to Top - Priority management
- R4: Do NOT Commit - Version control boundaries
- R5: Move Completed Tasks to Archive - Task lifecycle management

**Expanded Bible should include:**

**1. Agent Delegation Patterns**

- When to use CLI Developer vs CLI Tester vs Web Developer
- How to parallelize agent work (multiple agents in single message)
- Agent hand-off protocols and context passing
- Sub-agent selection decision tree

**2. Uncertainty Management**

- Research workflow (spawn explore agents, gather findings)
- Prototyping and validation approaches
- Documentation of decisions and rationale
- Handling ambiguous requirements (AskUserQuestion vs research)

**3. Task Management**

- Creating well-scoped tasks for sub-agents
- Blocker identification and escalation
- Task lifecycle (TODO → In Progress → Completed → Archived)
- Progress tracking and reporting

**4. Context Management**

- What context to pass to sub-agents
- How to summarize sub-agent results
- Managing conversation length and context windows
- When to use memory files vs inline context

**5. Quality Control**

- Verification patterns before reporting completion
- Test validation workflows
- Code review patterns (when to spawn reviewers)
- Compliance checking (standards, types, tests)

**6. Boundaries and Constraints**

- What loop agents should NOT do (direct implementation, commits)
- Tool usage patterns (Task vs direct implementation)
- Permission management and user approval flows
- When to defer to user judgment

**7. Communication Patterns**

- Reporting progress to users (concise summaries)
- Asking clarifying questions effectively
- Presenting options and recommendations
- Documenting decisions for future reference

**Output location:** `docs/standards/content/loop-prompts-bible.md`

---

### Branding

#### H7: Change the name to Agents Inc. [DONE]

Rebrand the project from its current name to "Agents Inc." This includes updating project names, documentation, configuration files, package.json, and any other references throughout the codebase.

---

#### H11: Investigate branding customization options [DONE]

Research and implement branding capabilities for the CLI. Explore options to add a work/company logo to the CLI interface, or at minimum, add customizable text to indicate the CLI is for a specific company. This should allow organizations to white-label or brand the CLI for their internal use.

---

## Moved from TODO-deferred.md (2026-02-16)

### From TODO-deferred.md (2026-02-16)

#### P3-14: Individual Skill Plugin Installation [DONE]

Individual skills can now be installed as plugins without requiring a full stack. Implemented in `init.tsx`, `installation.ts`, `compile.ts`, and `plugin-discovery.ts`. Plugin mode installs each skill separately via `claude plugin install {skillId}@{marketplace}`.

#### D-09: Fix Agent-Recompiler Tests [DONE]

All 9 tests in `src/cli/lib/agents/agent-recompiler.test.ts` now pass. Fixed in commit `3834740` (Feb 15) which removed all `.skip()` markers and updated tests for Phase 6 agent-centric configuration.

#### D-21: Agent Naming Prefix Alignment [DONE]

All agent references now use domain-prefixed names (web-tester, cli-tester, web-pm, web-architecture, web-pattern-critique). Agent mappings were already correct; documentation and agent workflow files updated to match.

---

## Moved from TODO-night.md (2026-02-16)

### UX & Accessibility (Research: a800b70)

#### Add text labels for color-coded states [DONE]

**Files:** category-grid.tsx, step-build.tsx, step-refine.tsx, source-grid.tsx

- Added "(disabled)" suffix to gray items, "(recommended)" to white items, "(discouraged)" to yellow items
- Added semantic text instead of color-only borders

#### Add semantic labels for validation messages [DONE]

**Files:** step-build.tsx:41-45

- Validation error now says WHICH category failed
- StepRefine border color has accompanying text announcement

#### Add modal help overlay with hotkey reference [DONE]

**Files:** wizard-layout.tsx

- Added "press ? for help" overlay showing all keyboard shortcuts
- Includes in-context hints for hotkeys on each step

#### Add progress indication to long operations [DONE]

**Files:** edit.tsx:74-95, 222-235; init.tsx

- Source loading: "Loading marketplace source..." with completion message
- Skill copying: per-skill progress via onProgress callback
- Added CopyProgressCallback type

#### Add inline navigation hints on first-time steps [DONE]

**Files:** step-approach.tsx, step-refine.tsx, step-stack.tsx

- Added hints in main content area, not just footer
- Made navigation discoverable without reading footer

#### Improve validation error messages with remediation [DONE]

**Files:** step-build.tsx:88-100, build-step-logic.ts:31-34

- Added remediation guidance: "Use arrow keys to navigate, then SPACE to select."
- Added dimmed escape path hint: "Press ESC to go back, or select a skill and press ENTER to continue."

#### Add examples to all command help text [DONE]

**Files:** edit.tsx, init.tsx, list.ts, outdated.ts, validate.ts, eject.ts, diff.ts, info.ts

- Added usage examples to 8 commands using object format `{ description, command }`

#### Add consistent symbols alongside colors [DONE]

- Added checkmark/circle/dash symbols alongside colors in category-grid, source-grid, wizard-tabs, step-build
- Legend row shows symbols matching the grid indicators
- Domain tabs show filled/open circles; wizard step tabs show checkmark/filled/open/dash

#### Improve terminology consistency [DONE]

- Standardized "Pre-built template" to "Stack" across all wizard steps
- Fixed British "Customise" to American "Customize" in step-build.tsx

#### Make confirmation step reachable with preview [DONE]

**Files:** step-confirm.tsx, wizard.tsx

- Sources step navigates to confirm step instead of calling handleComplete directly
- Confirm step shows stack name, selected domains, technology/skill counts, and install mode

### Validation & Data Integrity (Research: a270ca3)

#### Fix unsafe array access in plugin-finder [DONE]

**Files:** plugin-finder.ts:95-97, 85

- Used `last()` and `zip()` from remeda for safe element access
- Eliminated index-based access entirely

#### Add input validation for --source flag [DONE]

**Files:** config.ts:100-103

- Added regex validation for URL formats (http://, https://, github:, gh:)
- Added basic path existence checking for local sources

#### Validate parsed skill names are non-empty [DONE]

**Files:** plugin-finder.ts:99-107

- Validate `nameMatch[1].trim().length > 0` before using
- Added max length validation (<= 100 chars)

#### Add bounds check for split() results in compiler [DONE]

**Files:** compiler.ts:52

- Split result into named `parts` variable with `|| name` fallback

#### Validate sanitized cache dir in source-fetcher [DONE]

**Files:** source-fetcher.ts:23-29

- Added fallback: `const sanitized = sanitizeSourceForCache(source) || "unknown"`

#### Validate environment variables [DONE]

**Files:** config.ts:109

- Wrapped env var validation in try/catch with `warn()` + graceful fallback
- Added whitespace-only handling. 7 new tests, 108 total config tests passing

### DRY Opportunities (Research: a8e974d)

#### Extract Zod error formatting utility [DONE]

- Created `formatZodErrors(issues)` in schemas.ts
- Replaced 9 duplicate inline implementations across 8 files

#### Extract YAML load+validate helper [DONE]

- Created `safeLoadYamlFile<T>()` in `src/cli/utils/yaml.ts`
- 29 LOC reduction (43 lines removed, 14-line helper added)

#### Extract YAML file roundtrip helper [DONE]

- `saveSourceToProjectConfig` now composes existing `loadProjectSourceConfig` + `saveProjectConfig`
- Eliminated 6 redundant imports, no new helper needed

#### Extract SkillReference builder helper [DONE]

- Reused existing `resolveAgentConfigToSkills` from stacks-loader.ts in resolver.ts
- 12 LOC reduction

#### Extract test fixture factory pattern [DONE]

- Created `SKILL_FIXTURES` config map with `getTestSkill(name, overrides?)` accessor
- Eliminated 9 wrapper functions, 18 LOC reduction

#### Extract selection context initialization [DONE]

- Created `initializeSelectionContext(currentSelections, matrix)` in matrix-resolver.ts
- 9 LOC reduction (9 duplicated 2-line patterns replaced)

### Security (Research: a7d237b)

#### Fix path traversal in source-switcher.ts [DONE]

- Added `validateSkillId()` and `validatePathBoundary()` with containment checks
- All 3 functions validate before any fs ops. 17 tests passing (10 new)

#### Fix path traversal in skill-copier.ts [DONE]

- Added `validateSkillPath()` with boundary check + null byte detection
- Applied to all 4 path construction functions. 8 new tests

#### Add strict validation at YAML/JSON parsing boundaries [DONE]

- Added file size limits (10MB marketplace, 1MB plugin/config), JSON nesting depth validation
- Plugin count limits, plugin name character validation, unknown field warnings

#### Strengthen cache path sanitization [DONE]

- Replaced regex-only sanitization with SHA-256 hash (16 hex chars) + readable prefix (max 32 chars)
- Added constants to consts.ts. 10 unit tests

#### Add source URL validation before giget [DONE]

- Added null byte check, UNC path blocking, path traversal blocking, private/reserved IP blocking (SSRF)
- 16 new tests, 102 total

#### Add path boundary validation to import skill command [DONE]

- 3-layer validation: null byte check, absolute path rejection, boundary check
- 5 new tests. 2042 tests passing

#### Add validation to CLI argument construction [DONE]

- Length limits, format validation, control character rejection for all exec functions
- 38 tests added. 2081 tests passing

#### Add content escaping for Liquidjs template rendering [DONE]

- Added `sanitizeLiquidSyntax()` and `sanitizeCompiledAgentData()` in compiler.ts
- All user-controlled fields stripped of Liquid delimiters before rendering. 18 new tests

#### Fix race condition in archive/restore operations [DONE]

- Replaced check-then-use pattern with try-catch around copy/remove
- Eliminates TOCTOU window. 17 tests passing

### Documentation (Research: ac66e12)

#### Add JSDoc to complex exported functions [DONE]

- Added comprehensive JSDoc to 25+ exported functions across 6 files (compiler.ts, matrix-resolver.ts, resolver.ts, plugin-validator.ts, matrix-loader.ts, config-generator.ts)

#### Document public APIs in skill-metadata.ts and multi-source-loader.ts [DONE]

- JSDoc on 3 types + 5 functions in skill-metadata.ts
- Enhanced JSDoc on 2 functions in multi-source-loader.ts
- JSDoc on 2 types + 1 function in local-installer.ts

#### Add field documentation to complex types and schemas [DONE]

- Field-level JSDoc across types/matrix.ts, types/skills.ts, lib/schemas.ts
- 50+ field-level comments across 12+ schemas

#### Create docs/type-conventions.md [DONE]

- SkillId format, CategoryPath format, resolveAlias usage, boundary cast patterns, typedEntries rules

#### Update architecture.md for multi-source UX Phase 6 [DONE]

- Multi-Source Annotation step, 5-phase loading pipeline, BoundSkill types, SearchModal component

#### Update commands.md for current init behavior [DONE]

- Fixed individual skill plugin documentation, --source flag formats, --refresh flag, wizard step flow

#### Update README.md installation modes and features [DONE]

- Updated defaults, multi-source setup, cc search interactive mode, skill import feature

#### Add @param/@returns to wizard store actions [DONE]

- JSDoc on all 25 action and getter methods in WizardState

#### Convert excessive comments to JSDoc or improve function names [DONE]

- Removed obvious inline comments in compiler.ts, local-installer.ts, config-generator.ts

#### Move buried TODO from test file to TODO-night.md [DONE]

- Resolved directly: agent-recompiler.test.ts TODO removed along with fixing all 7 skipped tests

#### Document boundary cast pattern centrally [DONE]

- Expanded boundary cast section in type-conventions.md with 7 categories and real file references

### Testing (Research: ab369bc, a8a233b, aa18e4c)

#### Fix 13+ skipped tests in agent-recompiler and stack-plugin-compiler [DONE]

- agent-recompiler.test.ts: Fixed CLI_REPO_PATH. All 7 skipped tests now passing (9 total)
- stack-plugin-compiler.test.ts: Deleted 9 tests for removed features. All 30 tests passing, 0 skipped

#### Add unit tests for errors.ts [DONE]

- Expanded from 7 to 12 tests covering empty messages, booleans, objects, arrays, symbols

#### Add unit tests for yaml.ts [DONE]

- Created yaml.test.ts with 20 tests across 6 categories

#### Add unit tests for config-generator.ts [DONE]

- Created config-generator.test.ts with 30 tests

#### Add unit tests for plugin-manifest.ts [DONE]

- Created plugin-manifest.test.ts with 55 tests covering all 6 exported functions

#### Add unit tests for plugin-version.ts [DONE]

- Created plugin-version.test.ts with 40 tests

#### Add unit tests for frontmatter.ts [DONE]

- Created frontmatter.test.ts with 21 tests across 6 categories

#### Add unit tests for source-manager.ts [DONE]

- Added 12 new tests (22 total) covering edge cases

#### Add unit tests for typed-object.ts [DONE]

- Created typed-object.test.ts with 11 tests

#### Add unit tests for logger.ts [DONE]

- Created logger.test.ts with 13 tests

#### Add unit tests for messages.ts [DONE]

- Created messages.test.ts with 13 tests

### Dead Code Elimination (Research: ab369bc)

#### Consolidate duplicate test utility functions [DONE]

- Removed all 7 local `fileExists`/`directoryExists` duplicates across 5 integration test files
- Added `parseTestFrontmatter` to helpers.ts. 2012 tests passing

#### Consolidate duplicate integration test helpers [DONE]

- Extracted `readTestYaml`, `buildWizardResult`, `buildSourceResult` to shared helpers.ts
- Updated 3 integration test files. 119 integration tests passing

#### Remove or repurpose unused test helpers [DONE]

- Removed `createMockMatrixWithMethodology()`, `createMockProjectConfig()`
- Un-exported internal-only helpers. 2012 tests passing

#### Replace console.log with logger in production files [DONE]

- Added `log()` to logger.ts. Replaced console.log/warn/error across 7 production files

### DRY & Constants (Research: a56412b)

#### Use CLI_COLORS constants in all component files [DONE]

- Replaced all hardcoded color strings across 14 files with CLI_COLORS constants

#### Use STANDARD_FILES/DIRS constants in test files [DONE]

- Replaced 160+ hardcoded strings across 5 test files

#### Replace inline getErrorMessage pattern with utility import [DONE]

- Import `getErrorMessage` from utils/errors instead of inline patterns

#### Decompose validateSelection in matrix-resolver.ts [DONE]

- Already decomposed into 5 pure helpers + mergeValidationResults. Main function ~20 lines

#### Extract resolveSkillPath helper in skill-copier.ts [DONE]

- Extracted `resolveSkillPath(basePath, skillPath)` combining path.join + validateSkillPath

### View Logic Extraction (Research: acf47f6, aa18e4c)

#### Extract useWizardInitialization hook from wizard.tsx [DONE]

- Extracted to use-wizard-initialization.ts using useRef-based guard. 100 tests passing

#### Move step progress logic from wizard-layout.tsx to store [DONE]

- Moved completedSteps/skippedSteps to wizard-store.ts as `getStepProgress()` getter

#### Extract useSourceGridSearchModal hook from source-grid.tsx [DONE]

- Extracted to use-source-grid-search-modal.ts. Consolidated duplicated cleanup. 28 tests passing

#### Extract useBuildStepProps hook from wizard.tsx [DONE]

- Extracted to use-build-step-props.ts. Build case is now `<StepBuild {...buildStepProps} />`. 279 tests passing

#### Extract useSourceOperations hook from step-settings.tsx [DONE]

- Extracted to use-source-operations.ts. step-settings.tsx reduced by 27 lines. 18 tests passing

#### Extract useCategoryGridInput hook from category-grid.tsx [DONE]

- Extracted to use-category-grid-input.ts (186 lines). category-grid.tsx reduced from 476 to 336 LOC. 291 tests passing

### Type Improvements (Research: ab98ab7)

#### Simplify typedEntries cast in multi-source-loader.ts [DONE]

- Replaced complex double-cast with simple `typedEntries(matrix.skills)` + `if (!skill) continue` guard

### Error Handling (Research: aa18e4c)

#### Add verbose logging to silent catch blocks [DONE]

- Added verbose() with getErrorMessage() to marketplace-generator.ts and versioning.ts. 39 tests passing

### Store Decomposition (Research: ac0c15a)

#### Decompose populateFromSkillIds in wizard-store.ts [DONE]

- Extracted `resolveSkillForPopulation()` helper. Main method reduced from 42 to 27 lines. 67 tests passing

#### Extract bound skill merging from buildSourceRows [DONE]

- Extracted `buildBoundSkillOptions()` helper. Uses filter+map instead of filter+for...push. 67 tests passing

### Command Patterns (Research: ac0c15a)

#### Investigate detectInstallation in uninstall.tsx [DONE]

- NOT a duplicate: uninstall version returns `UninstallTarget` (6 booleans + 6 paths), shared version returns `Installation | null`

#### Standardize error handling across commands [DONE]

- Replaced 11 instances of manual error handling with `this.handleError(error)` across 7 files. 2259 tests passing

### Test Quality (Research: ac0c15a)

#### Extract flag acceptance test helper in new/agent.test.ts [DONE]

- Extracted local `expectFlagAccepted()` helper replacing 8 identical test bodies

### Code Organization (Research: acf47f6, a56412b)

#### Split step-stack.tsx subcomponents into separate files [DONE]

- Extracted StackSelection to stack-selection.tsx, DomainSelection to domain-selection.tsx. step-stack.tsx reduced from 176 to 20 lines

#### Extract recompileAgents helper functions from agent-recompiler.ts [DONE]

- Extracted 3 private helpers. Main function reduced from ~62 to ~35 lines. 9 tests passing

#### Extract compileAgent template helpers from compiler.ts [DONE]

- Extracted `readAgentFiles()` and `buildAgentTemplateContext()`. `compileAgent` is now ~12 lines. 67 tests passing

### Dead Code (Research: a129a25)

#### Remove unused resolveTemplate from resolver.ts [DONE]

- Confirmed zero production imports. Removed function and its 3 tests

#### Boundary cast comments on SkillDisplayName lookups [DONE]

- Both files already have explanatory comments from prior type-narrowing work. No changes needed

### Night Session Summary

**Iterations covered:** 4-9 (research agents: a800b70, a270ca3, a8e974d, a7d237b, ac66e12, ab369bc, acf47f6, ab98ab7, a8a233b, a56412b, aa18e4c, ac0c15a, a129a25)
**Total tasks completed:** 80+
**Tests added:** 233+
**Zero regressions, zero type errors**
