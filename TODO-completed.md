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
| P5-7-6  | Move lib/ and utils/ to cli-v2       | 2026-01-31 |
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
| [oclif-ink-research.md](./docs/oclif-ink-research.md)                       | oclif + Ink framework evaluation  | 2026-01-31 |
| [web-ui-research.md](./docs/web-ui-research.md)                             | Web UI for private marketplace    | 2026-01-31 |
| [cli-agent-invocation-research.md](./docs/cli-agent-invocation-research.md) | Meta-agent invocation via CLI     | 2026-01-22 |
| [cli-testing-research.md](./docs/cli-testing-research.md)                   | CLI integration test strategy     | 2026-01-31 |
| [stack-simplification-research.md](./docs/stack-simplification-research.md) | Stack architecture simplification | 2026-01-31 |

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

**D-11 Details:** Added `useApp()` hook and `exit()` calls to `UninstallConfirm` component in `src/cli-v2/commands/uninstall.tsx` to properly restore terminal state after command completion.

**D-10 Details:** Added `meta-stack` to `config/stacks.yaml` with 5 agents (skill-summoner, agent-summoner, documentor, pattern-scout, web-pattern-critique) mapped to methodology and research skills (improvement-protocol, research-methodology, context-management, investigation-requirements, anti-over-engineering, reviewing).

| D-12 | Normalize skill IDs and output folder names | 2026-02-02 |

**D-12 Details:** Large refactoring to normalize skill IDs from path-based format with author (e.g., `web/framework/react (@vince)`) to kebab-case format (e.g., `web-framework-react`). Changes:

- Updated ~150 `skill_aliases` entries in `config/skills-matrix.yaml`
- Updated `DEFAULT_PRESELECTED_SKILLS` in `src/cli-v2/consts.ts`
- Simplified `skill-copier.ts` and `skill-plugin-compiler.ts`
- Updated `marketplace-generator.ts` category patterns for new format
- Updated ~10 test files with new skill ID format
- Renamed 85 skill directories in `claude-subagents/src/skills/` from nested format to flat kebab-case
- Updated SKILL.md frontmatter `name` fields to normalized format (no author suffix, no slashes)
- Replaced `+` with `-` in multi-tool skill names (e.g., `better-auth+drizzle+hono` → `better-auth-drizzle-hono`)
- Removed `normalizeSkillId()` function since frontmatter now contains canonical IDs
- All 1182 tests pass

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

- `src/cli-v2/consts.ts`: Added `CLAUDE_SRC_DIR = ".claude-src"` constant
- `src/cli-v2/lib/config.ts`: Updated to read from `.claude-src/config.yaml` first, falls back to `.claude/config.yaml`
- `src/cli-v2/commands/eject.ts`: Agent-partials eject to `.claude-src/agents/`, config saves to `.claude-src/config.yaml`
- `src/cli-v2/commands/init.tsx`: Config writes to `.claude-src/config.yaml`, agents output to `.claude/agents/`
- `src/cli-v2/lib/compiler.ts`: `createLiquidEngine()` checks `.claude-src/agents/_templates/` first
- `src/cli-v2/lib/loader.ts`: Added `loadProjectAgents()` to load from `.claude-src/agents/`
- `src/cli-v2/lib/project-config.ts`: Updated to use constants, checks `.claude-src/` first with `.claude/` fallback
- `src/cli-v2/lib/installation.ts`: `detectInstallation()` checks `.claude-src/config.yaml` first
- `src/cli-v2/lib/agent-recompiler.ts`: Merges project agents with built-in agents

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

- `src/cli-v2/commands/init.tsx`: Changed to `WizardResultV2`, passes `loadedStack` and `skillAliases` to `resolveAgents()`
- `src/cli-v2/stores/wizard-store.ts`: Added `populateFromStack()` action
- `src/cli-v2/components/wizard/step-stack-options.tsx`: Calls `populateFromStack()` when "customize" selected

**Tests added:** Unit tests for `resolveAgentSkillsFromStack`, `getAgentSkills`, and `resolveAgents` in `resolver.test.ts`

**All 1186 tests pass.**
