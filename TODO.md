# Claude Collective CLI - Implementation Plan

---

## Executive Summary

**Current State:** Phase 7B Complete. Ready for user testing.

**Recent (Phase 7B):**

- New wizard flow: approach → stack → [stack-options] → build → refine → confirm
- New components: CategoryGrid, WizardTabs, SectionProgress, StepBuild, StepRefine
- Domain-based filtering (web, api, cli, mobile, shared)
- 2D grid navigation with vim keys support
- Fixed: Skill resolution for both stack and scratch paths
- Fixed: Build step now shows clean technology names (not "React (@vince)")
- 1000 tests passing

**Next Steps:**

1. User testing to verify wizard flows work correctly
2. Create meta-stack for meta agents (D-10)
3. Address deferred tasks as needed

For completed tasks, see [TODO-completed.md](./TODO-completed.md).

---

## Blockers

_None currently. Add serious blockers here immediately when discovered._

_If a blocker is added, note whether tests should be deferred until it's resolved._

---

## Recently Fixed

### [FIXED] BUG-01: Stack defaults path only includes methodology skills

**Fixed in:** `wizard.tsx:handleComplete()` and `step-build.tsx`

**Changes:**
1. `wizard.tsx:handleComplete()` now properly resolves skills:
   - Stack + defaults path: uses `stack.allSkillIds` directly
   - Scratch / Customize path: resolves `domainSelections` via `matrix.aliases`
   - Always includes methodology skills from `getSelectedSkills()`

2. `step-build.tsx:getDisplayLabel()` now shows clean technology names:
   - Uses alias if available (capitalized)
   - Strips author suffix like " (@vince)" from display

---

## Ongoing Reminders

### R1: Read Docs Before Starting

**CRITICAL:** Before starting any Phase 7 task, read these documents:

- [TODO.md](./TODO.md) - This file, task list and status
- [docs/wizard-ux-redesign.md](./docs/wizard-ux-redesign.md) - UX specification with mockups
- [docs/wizard-ux-redesign-concerns.md](./docs/wizard-ux-redesign-concerns.md) - Architectural decisions
- [docs/phase-7-implementation-plan.md](./docs/phase-7-implementation-plan.md) - Detailed subtasks and dependencies

### R2: Use Specialized Agents

- **CLI Developer** (`cli-developer`) - All feature implementation work
- **CLI Tester** (`web-tester`) - All test writing
- **API Researcher** (`api-researcher`) - Backend/resolver research
- **Web Researcher** (`web-researcher`) - Frontend/component research

Do NOT implement features or write tests directly. Always delegate to the appropriate agent.

### R3: Handle Uncertainties

When encountering unknowns or uncertainties:

1. Spawn research subagents to investigate
2. Use CLI Developer to prototype if needed
3. **Create TODO tasks in this file** with findings
4. Document decisions in `docs/wizard-ux-redesign-concerns.md`

### R4: Blockers Go to Top

If a serious blocker is discovered, add it to the **Blockers** section at the top of this file immediately. Do not continue work that depends on the blocked item.

### R5: Do NOT Commit

**Keep all changes uncommitted.** The user will handle committing when ready.

### R6: No Backwards Compatibility

Once Phase 7 is complete, the wizard should use **only v2 store and components**. No legacy code paths, no v1 fallbacks. Delete old code, don't deprecate it.

### R7: Move Completed Tasks to Archive

Once a task is done, move it to [TODO-completed.md](./TODO-completed.md).

### R8: Update Task Status

When starting a task: `[IN PROGRESS]`. When completing: `[DONE]`.

**IMPORTANT:** Sub-agents MUST update this TODO.md file when starting and completing subtasks. This is not optional - it ensures proper progress tracking across sessions.

### R9: Compact at 70% Context

When context usage reaches 70%, run `/compact`.

### R10: Cross-Repository Changes Allowed

You should feel free to make changes in the claude-subagents directory (`/home/vince/dev/claude-subagents`) as well, if needed. This is the source marketplace for skills and agents.

---

## Phase 7 Documents

- [docs/wizard-ux-redesign.md](./docs/wizard-ux-redesign.md) - UX specification with mockups
- [docs/wizard-ux-redesign-concerns.md](./docs/wizard-ux-redesign-concerns.md) - Architectural decisions
- [docs/phase-7-implementation-plan.md](./docs/phase-7-implementation-plan.md) - Detailed subtasks, dependencies, file inventory
- [docs/phase-7a-pre-test-plan.md](./docs/phase-7a-pre-test-plan.md) - Test plan for Phase 7A checkpoint

## Key Files

**Configuration:**

- `config/stacks.yaml` - Stack definitions (agents per stack)
- `config/skills-matrix.yaml` - Skills, categories, relationships, aliases

**Wizard (to be migrated to v2):**

- `src/cli-v2/stores/wizard-store.ts` - Current wizard state (becomes v2)
- `src/cli-v2/components/wizard/` - Wizard step components
- `src/cli-v2/components/wizard/wizard.tsx` - Main wizard orchestrator

**Resolution:**

- `src/cli-v2/lib/stacks-loader.ts` - Load stacks from config
- `src/cli-v2/lib/resolver.ts` - Resolve agent skills
- `src/cli-v2/lib/matrix-resolver.ts` - Skill relationships (recommends, conflicts)

**Types:**

- `src/cli-v2/types-stacks.ts` - Stack types
- `src/cli-v2/types-matrix.ts` - Matrix types
- `src/types.ts` - Core types (AgentDefinition, ProjectConfig)

---

## Phase 5: oclif + Ink Migration (COMPLETE)

**Status:** Migration complete. CLI runs 100% on oclif + Ink.

All Phase 5 tasks completed. See [TODO-completed.md](./TODO-completed.md) for full details.

**Summary:**

- Migrated from Commander.js + @clack/prompts to oclif + Ink
- 398 tests passing across 24 test files
- All commands migrated including interactive wizard
- Old dependencies removed (commander, @clack/prompts, picocolors)

---

## Phase 6: Agent-Centric Configuration

**Status:** COMPLETE. Skills are now defined in agent YAMLs, stacks are in config/stacks.yaml. See [docs/solution-a-migration-tasks.md](./docs/solution-a-migration-tasks.md) for full details.

**Goal:** Move skill mappings INTO agent YAMLs. Stacks become simple agent groupings. Eliminates stack config files.

**Key Changes:**

- Agents define their own skills (with inline `preloaded` flag)
- New `config/stacks.yaml` lists stacks with agent groupings
- Delete `skill-agent-mappings.ts` entirely
- Delete all `src/stacks/*/config.yaml` files (in claude-subagents)

**Estimated Effort:** 5-7 days

### Phase 6.1: Types and Schema

**[DONE] S | A1-1 | Add `skills` field to AgentYamlConfig type**
File: `src/types.ts`. Added `skills?: Record<string, AgentSkillEntry>` and `AgentSkillEntry` interface.

**[DONE] S | A1-2 | Add `skills` field to AgentDefinition type**
File: `src/types.ts`. Same field on resolved agent type.

**[DONE] S | A1-3 | Update agent.schema.json**
File: `src/schemas/agent.schema.json`. Added skills property schema with AgentSkillEntry definition.

**[DONE] S | A1-4 | Create Stack type**
New file: `src/cli-v2/types-stacks.ts`. Defined `Stack` and `StacksConfig` interfaces.

**[DONE] S | A1-5 | Create stacks.schema.json**
New file: `src/schemas/stacks.schema.json`. Schema for stacks.yaml validation.

### Phase 6.2: Loaders

**[DONE] M | A2-1 | Update loadAllAgents to extract skills**
File: `src/cli-v2/lib/loader.ts`. Pass through `skills` field from agent YAML.

**[DONE] M | A2-2 | Create stacks loader**
New file: `src/cli-v2/lib/stacks-loader.ts`. Load stacks from `config/stacks.yaml`.

### Phase 6.3: Resolution Logic

**[DONE] M | A3-1 | Create resolveAgentSkills function**
File: `src/cli-v2/lib/resolver.ts`. Resolve skills from agent's skills field.

**[DONE] M | A3-2 | Update getAgentSkills to use agent's skills**
File: `src/cli-v2/lib/resolver.ts`. Added optional `agentDef` parameter, priority order: compile config > agent skills > stack-based (legacy).

**[DONE] S | A3-3 | Deprecate skill-agent-mappings.ts**
File: `src/cli-v2/lib/skill-agent-mappings.ts`. Added @deprecated JSDoc comment. Kept for backwards compatibility with config-generator.ts (wizard flow).

### Phase 6.4: Command Updates

**[DONE] M | A4-1 | Update init command for new flow**
File: `src/cli-v2/commands/init.tsx`. Load agents from stack, get skills from agent YAMLs.
Updated to use `loadStackById()` from stacks-loader for new stack format, with fallback to legacy `loadStack()`.

**[DONE] M | A4-2 | Update compile command**
File: `src/cli-v2/commands/compile.ts`. Resolve skills from agent definitions.
Already working - resolver.ts's `getAgentSkills()` checks agent's skills field at Priority 2.

**[DONE] S | A4-3 | Remove build:stack command**
File: `src/cli-v2/commands/build/stack.tsx`. Added deprecation warning and early return.

**[DONE] S | A4-4 | Update wizard store for agent-based stacks**
File: `src/cli-v2/stores/wizard-store.ts`. Added clarifying comment. Wizard uses ResolvedStack from skills-matrix (for skill selection), separate from new Stack type (for agent groupings).

### Phase 6.5: Agent YAML Updates

**[DONE] L | A5-1 | Add skills to web-developer agent**
File: `src/agents/developer/web-developer/agent.yaml`. Added skills field with methodology, framework, styling, and all nextjs-fullstack skills.

**[DONE] M | A5-2 | Add skills to api-developer agent**
File: `src/agents/developer/api-developer/agent.yaml`. Added skills field with methodology, api, database, and backend skills.

**[DONE] M | A5-3 | Add skills to remaining developer agents** (cli-developer, web-architecture)
Files: `src/agents/developer/cli-developer/agent.yaml`, `src/agents/developer/web-architecture/agent.yaml`. Added skills with appropriate preloading.

**[DONE] M | A5-4 | Add skills to reviewer agents** (web-reviewer, api-reviewer, cli-reviewer)
Files: `src/agents/reviewer/*/agent.yaml`. Added skills with reviewing skills preloaded.

**[DONE] M | A5-5 | Add skills to researcher agents** (web-researcher, api-researcher)
Files: `src/agents/researcher/*/agent.yaml`. Added skills with research methodology preloaded.

**[DONE] M | A5-6 | Add skills to tester and planning agents** (web-tester, web-pm)
Files: `src/agents/tester/web-tester/agent.yaml`, `src/agents/planning/web-pm/agent.yaml`. Added skills with testing/research preloaded.

**[DONE] S | A5-7 | Add skills to pattern and meta agents** (pattern-scout, web-pattern-critique, skill-summoner, agent-summoner, documentor)
Files: `src/agents/pattern/*/agent.yaml`, `src/agents/meta/*/agent.yaml`. Added comprehensive skills for meta agents.

### Phase 6.6: Cleanup

**[DONE] M | A6-1 | Create stacks.yaml with all stacks**
New file: `config/stacks.yaml`. Defined all 7 stacks (nextjs-fullstack, angular-stack, nuxt-stack, remix-stack, vue-stack, solidjs-stack, react-native-stack) with agent lists and philosophy.

**[DONE] M | A6-2 | Delete all stack config files** (claude-subagents repo)
Deleted: `src/stacks/*/config.yaml` (7 files) from /home/vince/dev/claude-subagents. Skills are now defined in CLI repo agent YAMLs. The build:stack command now uses config/stacks.yaml and extracts skills from agents.

**[DONE] S | A6-3 | Deprecate stack loading code**
File: `src/cli-v2/lib/loader.ts`. Added @deprecated JSDoc to `loadStack()`. Kept for backwards compatibility with legacy stack configs.

**[DONE] S | A6-4 | Remove suggested_stacks from skills-matrix.yaml**
File: `config/skills-matrix.yaml`. Deleted `suggested_stacks` section (now in config/stacks.yaml).

**[DONE] S | A6-5 | Deprecate StackConfig type**
File: `src/types.ts`. Added @deprecated JSDoc to `StackConfig` interface. Kept for backwards compatibility.

### Phase 6 Future Work (Deferred)

- `cc edit:stack` - CLI command to create/modify stack compositions
- `cc build:stack` - Build stack plugins from matrix + agents
- TypeScript agent definitions - Replace YAML with TS for type-safe configs

**M | D-08 | Support user-defined stacks in consumer projects**
Allow consumers to define custom stacks in their own `config/stacks.yaml` file. The stack loader should merge user stacks with CLI built-in stacks, with user stacks taking precedence (following the pattern used for agent loading in `stack-plugin-compiler.ts:301-308`). Currently only CLI built-in stacks from `/home/vince/dev/cli/config/stacks.yaml` are supported.

**M | D-09 | Fix agent-recompiler tests for Phase 6**
7 tests in `src/cli-v2/lib/agent-recompiler.test.ts` are skipped because agents now have skills in their YAMLs (Phase 6). Tests need to either provide the skills that agents reference, use test agents without skills, or bypass skill resolution.
**Note:** Phase 7 will remove skills from agent YAMLs entirely (P7-0-1). This task may become obsolete.

---

## Phase 7: Wizard UX Redesign

**Status:** Phase 7A COMPLETE. Phase 7B (UX components) not started.

**Goal:** Redesign the wizard flow to be more intuitive with domain-based navigation, grid-based skill selection, and optional skill source refinement.

**Estimated Effort:** 19-27 days (Phase 7A: 4-5 days, Checkpoint: 1-2 days, Phase 7B: 14-20 days)

**Key Documents:**

- [docs/phase-7-implementation-plan.md](./docs/phase-7-implementation-plan.md) - **Detailed implementation plan with subtasks, dependencies, and file inventory**
- [docs/wizard-ux-redesign.md](./docs/wizard-ux-redesign.md) - Full UX specification with mockups
- [docs/wizard-ux-redesign-concerns.md](./docs/wizard-ux-redesign-concerns.md) - Concerns and architectural decisions
- [docs/phase-7a-pre-test-plan.md](./docs/phase-7a-pre-test-plan.md) - Test plan for Phase 7A checkpoint

**v0.5.1 Foundation:** `installMode` and `detectInstallation()` already implemented - reuse in wizard.

---

### Phase 7A: Architecture Fix (COMPLETE)

**Status:** COMPLETE. All tasks done, 1000 tests passing.

Fixes the critical bug where stacks get wrong skills (e.g., `angular-stack` gets React skills).

**[DONE] XL | P7-0-1 | Move skills from agents to stacks**
Stacks should define technologies by subcategory per agent, not agents defining their own skills.

Changes completed:

1. Updated `config/stacks.yaml` schema - agents become objects with subcategory→technology mappings
2. Removed `skills` field from all agent YAMLs (18 files)
3. Updated `stackToResolvedStack()` to read skills from stacks, not agents
4. Updated `resolveAgentSkills()` signature to accept stack parameter

<details>
<summary>All subtasks completed (click to expand)</summary>

- **P7-0-1a**: Added `StackAgentConfig` interface to `src/cli-v2/types-stacks.ts`
- **P7-0-1b**: Updated `src/schemas/stacks.schema.json` with new agents object format
- **P7-0-1c**: Transformed all 7 stacks in `config/stacks.yaml` to new format
- **P7-0-1d**: Added `resolveStackSkillsFromAliases()` and `resolveAgentConfigToSkills()` to stacks-loader.ts
- **P7-0-1e**: Updated `loadStackById()` to work with new stack format
- **P7-0-1f**: Removed `skills` field from all 18 agent YAMLs
- **P7-0-1g**: Added `resolveAgentSkillsFromStack()` to resolver.ts
- **P7-0-1h**: Updated init.tsx to use new stack format
- **P7-0-1i**: Removed `skills` field from `AgentDefinition` type
- **P7-0-1j**: Removed `skills` property from agent.schema.json
- **P7-0-1k**: Updated source-loader.ts, stack-plugin-compiler.ts, and tests for new format
- **P7-0-1l**: Fixed skill extraction in stack-plugin-compiler.ts to use matrix aliases
- **P7-0-1m**: Updated `resolveAgents()` in resolver.ts to accept and pass `stack` and `skillAliases` to `getAgentSkills()` for Phase 7 skill resolution

</details>

**[DONE] S | P7-0-2 | Add `stack` property to consumer config.yaml**
When a stack is selected, store resolved agent→skill mappings in `.claude/config.yaml`.
Note: `installMode` property already exists (added in v0.5.1) - no changes needed for it.

Changes completed:

1. Added `stack?: Record<string, Record<string, string>>` to `ProjectConfig` in `src/types.ts`
2. Created `buildStackProperty()` function in `src/cli-v2/lib/config-generator.ts`
3. Updated `installLocalMode()` in `src/cli-v2/commands/init.tsx` to include `stack` property when a stack is selected
4. Added 4 tests for `buildStackProperty()` in `src/cli-v2/lib/config-generator.test.ts`

---

### Phase 7B: UX Redesign (COMPLETE)

All Phase 7B tasks completed. See [TODO-completed.md](./TODO-completed.md) for details.

**Summary:**

- 14 tasks completed
- New components: CategoryGrid, WizardTabs, SectionProgress, StepBuild, StepRefine, StepStackOptions
- Full V2 store migration with history-based back navigation
- Domain-based filtering (web, api, cli, mobile, shared)
- 1000 tests passing

---

## New Tasks

**S | D-11 | Fix uninstall command not clearing input**
After running `cc uninstall`, the terminal input is not cleared properly. The command completes but leaves residual input state.

**L | D-12 | Normalize skill IDs and output folder names**
Change how skills are identified and stored. See **[docs/skill-id-normalization-plan.md](./docs/skill-id-normalization-plan.md)** for full implementation plan.

**Format change:**
- Current: `web/framework/react (@vince)` → New: `web-framework-react`
- Author becomes metadata only, not part of the ID

**Critical files to change:**
1. `src/cli-v2/lib/matrix-loader.ts` - Add normalization to `extractAllSkills()`
2. `src/cli-v2/lib/local-skill-loader.ts` - Add normalization to `extractLocalSkill()`
3. `config/skills-matrix.yaml` - Update ~150 `skill_aliases` entries
4. `src/cli-v2/consts.ts` - Update `DEFAULT_PRESELECTED_SKILLS`
5. `src/cli-v2/lib/skill-copier.ts` - Simplify folder path logic

**New file needed:** `src/cli-v2/lib/skill-id-normalizer.ts` - Normalization utility

**Scope:** ~20 source files, 50+ test file references, directory renames in marketplace.

**M | D-10 | Create meta-stack for meta agents**
Create a new stack in `config/stacks.yaml` that includes the meta agents (skill-summoner, agent-summoner, documentor, pattern-scout, web-pattern-critique) and their related skills.

Steps:
1. Research which skills are preloaded vs dynamically loaded in each meta agent
2. Identify shared skills across meta agents (likely: research-methodology, improvement-protocol, context-management)
3. Create `meta-stack` definition in `config/stacks.yaml` with appropriate agent→technology mappings
4. Add corresponding `skill_aliases` entries if missing

Meta agents to include:
- `src/agents/meta/skill-summoner/agent.yaml`
- `src/agents/meta/agent-summoner/agent.yaml`
- `src/agents/meta/documentor/agent.yaml`
- `src/agents/pattern/pattern-scout/agent.yaml`
- `src/agents/pattern/web-pattern-critique/agent.yaml`

---

## Deferred Tasks

**L | P3-14 | Individual skill plugin installation**
Plugin mode only supports stacks. Would need to support installing individual skills as plugins.

**M | D-01 | Update skill documentation conventions**
Replace `examples-*.md` files with folder structure. Split examples vs patterns. Namespace files (e.g., `examples/core.md`, `patterns/testing.md`). Update `docs/skill-extraction-criteria.md` accordingly.

**M | D-02 | Fix skill ID mismatch between local and marketplace**
Local skills use short IDs (e.g., `cli-commander (@vince)`) while marketplace skills use full paths (e.g., `cli/framework/cli-commander (@vince)`). This causes `preloaded_skills` in agent.yaml to fail resolution during compile. Either normalize IDs during installation or support both formats in the resolver.

**S | P4-16 | Test: All tests use shared fixtures**
Depends on P4-15. Consolidate test fixtures for consistency.

**M | P4-17 | Feature: `cc new skill/agent` supports multiple items**
Deferred until after migration. Allow creating multiple skills/agents in one command.

**S | P4-18 | Test: Multiple skill/agent creation works**
Depends on P4-17. Test coverage for multi-item creation.

**M | P5-6-4 | Cross-platform terminal testing** DEFERRED (depends: P5-4-12)
Test on macOS, Linux, Windows terminals, and CI environments

**S | P5-6-5 | Performance validation (<300ms startup)** DEFERRED (depends: P5-5-6)
Measure and validate startup time is within acceptable range

**M | D-04 | Create missing skills referenced in stack configs**
The following skills are referenced in stack configs but don't exist in the marketplace:

- `web/styling/tailwind (@vince)` - referenced by: nuxt-stack, remix-stack, solidjs-stack, vue-stack

These stacks will fail to build until the missing skills are created.

**S | D-05 | Improve `cc init` behavior when already initialized**
Currently, running `cc init` a second time just warns "already initialized" and suggests `cc edit`. This is not discoverable.

**Suggested approach:** When `cc init` detects an existing installation, show a "home screen" menu instead of just warning. Options could include:

- Reconfigure installation (change mode, stack, skills)
- Add/remove skills
- View current configuration
- Recompile agents
- Uninstall

This follows the pattern of CLIs like `npm init` (asks about overwriting) and provides better discoverability of available actions. The current behavior requires users to know about `cc edit`, `cc compile`, etc.

**S | D-06 | Fix require() syntax in matrix-resolver.test.ts**
4 tests in `src/cli-v2/lib/matrix-resolver.test.ts` use CommonJS `require('./matrix-resolver')` which fails with ESM modules. Convert to proper ESM imports or use dynamic `import()`.

**M | D-07 | Use full skill path as folder name when compiling**
When skills are copied locally, use the full path as the folder name instead of the short name. For example, `react (@vince)` should become `web/framework/react (@vince)`. This provides better organization and avoids potential naming conflicts between skills with the same short name in different categories.

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
- cli-migrator agent: `/home/vince/dev/claude-subagents/src/agents/migration/cli-migrator/`
