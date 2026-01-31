# Claude Collective CLI - Implementation Plan

## Executive Summary

This document provides a comprehensive implementation plan for the Claude Collective CLI. The plan is organized into three phases:

1. **Phase 1: Test Coverage** - Add comprehensive tests for all existing behaviors before refactoring
2. **Phase 2: Move Away from Stacks** - Transition to individual plugins/agents/skills model
3. **Phase 3: Extensibility** - Custom agents, configurable mappings

**Current State:** 1080 tests passing (as of 2026-01-31). Phase 1 Complete. Phase 2 Complete. Phase 3 Complete (P3-14 deferred). Phase 4 in progress.

---

## High Priority Research

### R0: oclif + Ink Framework Evaluation (COMPLETE)

**Question:** Should we migrate from @clack/prompts to oclif + Ink for better scalability?

**Context:** The CLI is growing more complex. Need to evaluate if a more robust framework is warranted.

**Output:** [docs/oclif-ink-research.md](./docs/oclif-ink-research.md)

**Recommendation:** Stay with current stack (Commander.js + clack) for now. Consider Ink selectively for complex UI features. Re-evaluate oclif if reaching 50+ commands.

**Status:** Complete

---

## Open Questions / Blockers

### Q1: Hardcoded Skill IDs in Tests - RESOLVED

**Problem:** Skill IDs like `"react (@vince)"` were hardcoded throughout test files.

**Solution:** Created `/home/vince/dev/cli/src/cli/lib/__tests__/test-fixtures.ts` with shared constants.

**Status:** DONE (P4-15 complete). Remaining test files can be updated incrementally (P4-16).

---

## Ongoing Reminders

### R1: Commit After Each Task

**ALWAYS** commit changes after completing any task. This will automatically run tests via pre-commit hooks.
Test count should remain at 1080+ and all should pass.

### R2: Write Tests for New Features

After completing a task, ask yourself: "Can tests be written for this new functionality?"
If yes, write tests before committing. Test-driven development is preferred when feasible.

### R3: Move Completed Tasks to Archive

Once your task is done, move it to [TODO-completed.md](./TODO-completed.md). Keep TODO.md lean by archiving all completed tasks immediately.

## Agent Progress Log

| Timestamp        | Agent         | Task                                                | Status                                                                             |
| ---------------- | ------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 2026-01-31 00:15 | orchestrator  | Assessed Phase 4 state                              | P4-01 exists (25/26 tests pass), P4-02-P4-14 pending                               |
| 2026-01-31 01:00 | cli-developer | Implemented P4-01 search command                    | Done - 34 tests pass, 945 total tests pass                                         |
| 2026-01-31 02:30 | pm            | Created detailed spec for P4-02 `cc info` command   | Done - spec added to Detailed Task Specifications                                  |
| 2026-01-31 03:00 | pm            | Created detailed specs for P4-05 and P4-06          | Done - `cc outdated` and `cc update` specs added                                   |
| 2026-01-31 04:00 | pm            | Created detailed specs for P4-11 and P4-12          | Done - `cc new skill` and `cc diff` specs added                                    |
| 2026-01-31 05:30 | cli-developer | Implemented P4-11/P4-13 `cc new skill` command      | Done - 22 tests pass, 1058 total tests pass                                        |
| 2026-01-31 05:00 | pm            | Created detailed spec for P4-09 `cc doctor` command | Done - comprehensive diagnostic spec with 5 checks                                 |
| 2026-01-31 05:30 | Explore       | Researched hardcoded skill IDs in tests             | Found 17 files, 209+ react references, spec for P4-15 added                        |
| 2026-01-31 06:00 | cli-developer | Implemented P4-15 test fixtures                     | Done - test-fixtures.ts created, search.test.ts updated, 945 tests pass            |
| 2026-01-31 07:00 | cli-developer | Implemented P4-02 and P4-04 `cc info` command       | Done - info.ts (230 lines), info.test.ts (56 tests), 1001 total tests pass         |
| 2026-01-31 07:30 | Explore       | Researched web UI for private marketplace           | Done - docs/web-ui-research.md created, recommends local HTML export               |
| 2026-01-31 08:00 | cli-developer | Implemented P4-05 and P4-07 `cc outdated` command   | Done - outdated.ts (396 lines), outdated.test.ts (35 tests), 1058 total tests pass |
| 2026-01-31 09:00 | cli-developer | Implemented P4-09 and P4-10 `cc doctor` command     | Done - doctor.ts (380 lines), doctor.test.ts (22 tests), 1080 total tests pass     |
| 2026-01-31 10:00 | cli-developer | Implemented P4-12 and P4-14 `cc diff` command       | Done - diff.ts (325 lines), diff.test.ts (37 tests), 1117 total tests pass         |
| 2026-01-31 11:00 | cli-developer | Implemented P4-06 and P4-08 `cc update` command     | Done - update.ts (430 lines), update.test.ts (43 tests), 1160 total tests pass     |

---

## Design Decisions (Resolved)

### D1: Local Skill Prefix Filter

**Decision:** Remove the `test-` prefix filter entirely.

- All local skills in `.claude/skills/` will be discovered
- File to modify: `local-skill-loader.ts` (lines 42-47)

### D2: Stack Concept

**Decision:** Keep "stacks" as visual hierarchy in CLI, not a special type.

- Stacks remain for grouping/organization in the wizard
- But underlying architecture treats everything as individual skills + agents
- No special stack-specific code paths

### D3: Default Mode

**Decision:** Default to LOCAL mode, plugin is opt-in.

- Rationale: Stacks as plugins make sense (pre-wired), but individual skills as plugins require manual config editing in the marketplace
- Local-first gives users ownership and easier customization
- Plugin mode is available for enterprise/advanced users who want it

### D4: Test Philosophy

**Decision:** Tests should be meaningful, not for coverage metrics.

- Test all commands, user journeys, and flows
- Tests WILL fail initially - that's expected
- Tests should catch regressions when refactoring
- Focus on behavior verification, not implementation details

---

## Phase 1: Comprehensive Test Coverage

**Goal:** Achieve comprehensive test coverage of all existing behaviors before any refactoring.

### Phase 1.0: Prerequisites

| Task ID | Task                                                         | Complexity | Dependencies | Status |
| ------- | ------------------------------------------------------------ | ---------- | ------------ | ------ |
| P1-00   | Fix: Remove `test-` prefix filter from local-skill-loader.ts | S          | None         | Done   |

### Phase 1.1: Command-Level Tests

| Task ID | Task                                                | Complexity | Dependencies | Status |
| ------- | --------------------------------------------------- | ---------- | ------------ | ------ |
| P1-01   | Test: `cc init` with stack in Plugin Mode           | M          | P1-00        | Done   |
| P1-02   | Test: `cc init` with stack in Local Mode            | M          | None         | Done   |
| P1-03   | Test: `cc init` already initialized detection       | S          | None         | Done   |
| P1-04   | Test: `cc init` marketplace registration            | M          | None         | Done   |
| P1-05   | Test: `cc compile` in Plugin Mode                   | M          | None         | Done   |
| P1-06   | Test: `cc compile` with custom output               | M          | None         | Done   |
| P1-07   | Test: `cc compile` skill discovery (plugin + local) | M          | None         | Done   |
| P1-08   | Test: `cc eject templates`                          | S          | None         | Done   |
| P1-09   | Test: `cc eject config`                             | S          | None         | Done   |
| P1-10   | Test: `cc edit` skill modification                  | M          | None         | Done   |

### Phase 1.2: Wizard Flow Tests

| Task ID | Task                                                  | Complexity | Dependencies | Status |
| ------- | ----------------------------------------------------- | ---------- | ------------ | ------ |
| P1-11   | Test: Wizard approach selection (stack vs scratch)    | M          | None         | Done   |
| P1-12   | Test: Wizard install mode toggle (plugin/local)       | S          | None         | Done   |
| P1-13   | Test: Wizard expert mode toggle                       | S          | None         | Done   |
| P1-14   | Test: Wizard stack selection and skill pre-population | M          | None         | Done   |
| P1-15   | Test: Wizard back navigation                          | M          | None         | Done   |

### Phase 1.3: Skill/Agent Resolution Tests

| Task ID | Task                                                     | Complexity | Dependencies | Status |
| ------- | -------------------------------------------------------- | ---------- | ------------ | ------ |
| P1-16   | Test: Preloaded skills appear in agent frontmatter       | S          | None         | Done   |
| P1-17   | Test: Dynamic skills referenced in agent body            | S          | None         | Done   |
| P1-18   | Test: Agent-skill mapping from `skill-agent-mappings.ts` | M          | None         | Done   |
| P1-19   | Test: Local skill takes precedence over plugin skill     | S          | None         | Done   |
| P1-20   | Test: Skill copier flattens directory structure          | S          | None         | Done   |

### Phase 1.4: Edge Case Tests

| Task ID | Task                                          | Complexity | Dependencies | Status |
| ------- | --------------------------------------------- | ---------- | ------------ | ------ |
| P1-21   | Test: Empty skill selection                   | S          | None         | Done   |
| P1-22   | Test: Conflicting skills with expert mode off | M          | None         | Done   |
| P1-23   | Test: Conflicting skills with expert mode on  | S          | P1-22        | Done   |
| P1-24   | Test: Missing skill dependencies              | M          | None         | Done   |
| P1-25   | Test: Custom template after eject             | M          | P1-08        | Done   |

---

## Phase 2: Unified Architecture

**Goal:** Transition to unified collection model where stacks are visual hierarchy, not special types. Default to local mode.

### Phase 2.1: Unified Config Architecture

| Task ID | Task                                                | Complexity | Dependencies | Status |
| ------- | --------------------------------------------------- | ---------- | ------------ | ------ |
| P2-01   | Design: Finalize unified `config.yaml` schema       | M          | Phase 1      | Done   |
| P2-02   | Implement: Parse unified config in loader           | M          | P2-01        | Done   |
| P2-03   | Implement: Generate unified config from selections  | M          | P2-02        | Done   |
| P2-04   | Test: Unified config round-trip (generate -> parse) | S          | P2-03        | Done   |

### Phase 2.2: Agent-Skill Mappings to Config

| Task ID | Task                                               | Complexity | Dependencies | Status |
| ------- | -------------------------------------------------- | ---------- | ------------ | ------ |
| P2-05   | Implement: Move SKILL_TO_AGENTS to YAML config     | L          | P2-01        | Done   |
| P2-06   | Implement: Move PRELOADED_SKILLS to YAML config    | M          | P2-05        | Done   |
| P2-07   | Implement: Config-based agent-skill resolution     | L          | P2-06        | Done   |
| P2-08   | Test: Custom agent_skills in config.yaml           | M          | P2-07        | Done   |
| P2-09   | Test: Override default mappings via project config | M          | P2-07        | Done   |

### Phase 2.3: Eject Skills and Agents

| Task ID | Task                                           | Complexity | Dependencies | Status |
| ------- | ---------------------------------------------- | ---------- | ------------ | ------ |
| P2-10   | Implement: `cc eject skills`                   | M          | None         | Done   |
| P2-11   | Implement: `cc eject agents` (partials)        | M          | None         | Done   |
| P2-12   | Implement: `cc eject all` (complete ejection)  | M          | P2-10, P2-11 | Done   |
| P2-13   | Test: Compile uses ejected skills              | M          | P2-10        | Done   |
| P2-14   | Test: Compile uses ejected agent partials      | M          | P2-11        | Done   |
| P2-15   | Test: Full eject produces self-contained setup | L          | P2-12        | Done   |

### Phase 2.4: Simplify Stack Handling

| Task ID | Task                                                           | Complexity | Dependencies | Status |
| ------- | -------------------------------------------------------------- | ---------- | ------------ | ------ |
| P2-16   | Design: Stacks as visual hierarchy (pre-selection groups)      | S          | P2-01        | Done   |
| P2-17   | Implement: Default to Local Mode in wizard                     | M          | P2-16        | Done   |
| P2-18   | Implement: Remove stack-specific code paths (unified handling) | L          | P2-17        | Done   |
| P2-19   | Update: Wizard flow for local-first model                      | L          | P2-17        | Done   |
| P2-20   | Test: Stack selection pre-populates but skills are editable    | M          | P2-19        | Done   |

---

## Phase 3: Extensibility

**Goal:** Enable custom agents and full configuration flexibility.

### Phase 3.1: Custom Agents

| Task ID | Task                                       | Complexity | Dependencies | Status |
| ------- | ------------------------------------------ | ---------- | ------------ | ------ |
| P3-01   | Design: Custom agent schema in config.yaml | M          | Phase 2      | Done   |
| P3-02   | Implement: Parse custom_agents from config | M          | P3-01        | Done   |
| P3-03   | Implement: Compile custom agents           | L          | P3-02        | Done   |
| P3-04   | Test: Custom agent with skills from config | M          | P3-03        | Done   |
| P3-05   | Test: Custom agent overrides builtin agent | M          | P3-03        | Done   |

### Phase 3.2: Uninstall Command

| Task ID | Task                                              | Complexity | Dependencies | Status |
| ------- | ------------------------------------------------- | ---------- | ------------ | ------ |
| P3-06   | Implement: `cc uninstall` for Plugin Mode         | M          | None         | Done   |
| P3-07   | Implement: `cc uninstall` for Local Mode          | M          | None         | Done   |
| P3-08   | Implement: `cc uninstall --keep-config`           | S          | P3-07        | Done   |
| P3-09   | Test: Uninstall removes plugin from settings.json | S          | P3-06        | Done   |
| P3-10   | Test: Uninstall removes .claude/ contents         | S          | P3-07        | Done   |

### Phase 3.3: Additional Features

| Task ID | Task                                                                          | Complexity | Dependencies | Status   |
| ------- | ----------------------------------------------------------------------------- | ---------- | ------------ | -------- |
| P3-11   | Implement: Custom marketplace URL support                                     | M          | None         | Done     |
| P3-12   | Implement: Remote agent definitions URL                                       | M          | None         | Done     |
| P3-13   | Implement: `cc new agent` command (see docs/cli-agent-invocation-research.md) | L          | P3-03        | Done     |
| P3-14   | Deferred: Individual skill plugin installation                                | L          | P2-18        | Deferred |

---

## Phase 4: Essential CLI Features

**Goal:** Add essential features for discoverability, maintenance, and ecosystem growth.

**Scope:** Tier 1 (Critical for Ongoing Usage) and Tier 2 (Ecosystem Growth) only.

### Phase 4.1: Skill Discovery (Tier 1)

| Task ID | Task                                          | Complexity | Dependencies | Status |
| ------- | --------------------------------------------- | ---------- | ------------ | ------ |
| P4-01   | Implement: `cc search <query>` command        | M          | None         | Done   |
| P4-02   | Implement: `cc info <skill>` command          | S          | None         | Done   |
| P4-03   | Test: Search finds skills by name/description | S          | P4-01        | Done   |
| P4-04   | Test: Info shows skill metadata and deps      | S          | P4-02        | Done   |

### Phase 4.2: Update Management (Tier 1)

| Task ID | Task                                       | Complexity | Dependencies | Status |
| ------- | ------------------------------------------ | ---------- | ------------ | ------ |
| P4-05   | Implement: `cc outdated` command           | M          | None         | Done   |
| P4-06   | Implement: `cc update [skill]` command     | M          | P4-05        | Done   |
| P4-07   | Test: Outdated detects version differences | S          | P4-05        | Done   |
| P4-08   | Test: Update pulls latest from source      | M          | P4-06        | Done   |

### Phase 4.3: Diagnostics (Tier 1)

| Task ID | Task                               | Complexity | Dependencies | Status |
| ------- | ---------------------------------- | ---------- | ------------ | ------ |
| P4-09   | Implement: `cc doctor` command     | M          | None         | Done   |
| P4-10   | Test: Doctor detects common issues | S          | P4-09        | Done   |

### Phase 4.4: Skill Authoring (Tier 2)

| Task ID | Task                                     | Complexity | Dependencies | Status |
| ------- | ---------------------------------------- | ---------- | ------------ | ------ |
| P4-11   | Implement: `cc new skill <name>` command | M          | None         | Done   |
| P4-12   | Implement: `cc diff` command             | M          | None         | Done   |
| P4-13   | Test: New skill creates proper structure | S          | P4-11        | Done   |
| P4-14   | Test: Diff shows changes from source     | S          | P4-12        | Done   |

### Phase 4.5: Technical Debt (CRITICAL)

| Task ID | Task                                          | Complexity | Dependencies | Status  |
| ------- | --------------------------------------------- | ---------- | ------------ | ------- |
| P4-15   | Fix: Consolidate hardcoded skill IDs in tests | M          | None         | Done    |
| P4-16   | Test: All tests use shared fixtures           | S          | P4-15        | Pending |

### Phase 4.6: UX Improvements

| Task ID | Task                                                  | Complexity | Dependencies | Status  |
| ------- | ----------------------------------------------------- | ---------- | ------------ | ------- |
| P4-17   | Feature: `cc new skill/agent` supports multiple items | M          | P4-11        | Pending |
| P4-18   | Test: Multiple skill/agent creation works             | S          | P4-17        | Pending |

### Phase 4.7: Research Tasks

| Task ID | Task                                                   | Complexity | Dependencies | Status |
| ------- | ------------------------------------------------------ | ---------- | ------------ | ------ |
| P4-19   | Research: Web UI for private marketplace visualization | M          | None         | Done   |

---

## Detailed Task Specifications

Each task below is self-contained with acceptance criteria, files to modify, and testing requirements.

---

### P1-00: Remove `test-` Prefix Filter from Local Skill Loader

**Context:**
The local skill loader currently only discovers skills with a `test-` prefix. This was a temporary development filter that blocks real local skill discovery.

**Files to Reference:**

- `/home/vince/dev/cli/src/cli/lib/local-skill-loader.ts` (lines 42-47)

**Current Code (to remove):**

```typescript
if (!skillDirName.startsWith(TEST_SKILL_PREFIX)) {
  verbose(
    `Skipping local skill '${skillDirName}': Does not have test- prefix (temporary filter)`,
  );
  continue;
}
```

**Acceptance Criteria:**

1. All local skills in `.claude/skills/` are discovered regardless of name
2. `TEST_SKILL_PREFIX` constant and related code removed
3. Existing tests pass (update if needed)
4. New test: local skill without `test-` prefix is discovered

**Files to Modify:**

- `/home/vince/dev/cli/src/cli/lib/local-skill-loader.ts`
- `/home/vince/dev/cli/src/cli/lib/local-skill-loader.test.ts` (if exists)

**Complexity:** S (simple removal)

---

### P1-01: Test `cc init` with Stack in Plugin Mode

**Context:**
The `cc init` command can install a pre-built stack as a native Claude plugin. This test verifies the full flow works correctly.

**Files to Reference:**

- `/home/vince/dev/cli/src/cli/commands/init.ts` (lines 195-271)
- `/home/vince/dev/cli/src/cli/lib/stack-installer.ts` (lines 52-104)
- `/home/vince/dev/cli/src/cli/commands/init.test.ts` (existing patterns)

**Acceptance Criteria:**

1. Running `cc init` with Plugin Mode and stack selection:
   - Registers marketplace if not exists
   - Installs stack via `claude plugin install`
   - Plugin appears in `.claude/settings.json`
2. Installation result includes:
   - `pluginName` matches stack ID
   - `agents` array is non-empty
   - `skills` array is non-empty
3. Command exits with code 0 on success

**Test Approach:**

- Mock `claudePluginInstall` to avoid actual CLI calls
- Mock `claudePluginMarketplaceExists` and `claudePluginMarketplaceAdd`
- Use temp directory for project
- Verify mock calls received correct arguments

**Files to Modify:**

- Create: `/home/vince/dev/cli/src/cli/commands/init.integration.test.ts`

**Complexity:** M (requires mocking external CLI)

---

### P1-02: Test `cc init` with Stack in Local Mode

**Context:**
When Local Mode is selected, skills are copied to `.claude/skills/` and agents compiled to `.claude/agents/`.

**Files to Reference:**

- `/home/vince/dev/cli/src/cli/commands/init.ts` (lines 291-440)
- `/home/vince/dev/cli/src/cli/lib/skill-copier.ts`
- `/home/vince/dev/cli/src/cli/lib/config-generator.ts`

**Acceptance Criteria:**

1. Running `cc init` with Local Mode and stack selection:
   - Creates `.claude/skills/` directory with skill subdirectories
   - Creates `.claude/agents/` directory with compiled agent `.md` files
   - Creates `.claude/config.yaml` with stack configuration
2. Each copied skill has:
   - Valid `SKILL.md` with frontmatter
   - Correct directory name
3. Each compiled agent:
   - Has skills in frontmatter (preloaded)
   - Has skill references in body (dynamic)
4. Config.yaml contains:
   - `skills` array with all stack skills
   - `agents` array with agent IDs
   - `agent_skills` mapping

**Test Approach:**

- Use real file operations in temp directory
- Mock wizard to return specific selections
- Verify file contents, not just existence

**Files to Modify:**

- Add to: `/home/vince/dev/cli/src/cli/commands/init.integration.test.ts`

**Complexity:** M (file I/O verification)

---

### P1-16: Test Preloaded Skills Appear in Agent Frontmatter

**Context:**
Skills marked as `preloaded: true` in config should appear in the agent's frontmatter `skills:` array.

**Files to Reference:**

- `/home/vince/dev/cli/src/cli/lib/skill-agent-mappings.ts` (lines 115-132, `PRELOADED_SKILLS`)
- `/home/vince/dev/cli/src/cli/lib/resolver.ts`
- `/home/vince/dev/cli/src/agents/_templates/agent.liquid`

**Acceptance Criteria:**

1. Agent compiled with preloaded skill has:
   - `skills:` field in YAML frontmatter
   - Skill ID listed in the skills array
2. Preloaded skills are NOT in the agent body's dynamic skill section
3. Multiple preloaded skills all appear in frontmatter

**Test Approach:**

- Compile a test agent with known preloaded skills
- Parse output frontmatter
- Verify skill IDs present

**Files to Modify:**

- Add to: `/home/vince/dev/cli/src/cli/lib/resolver.test.ts`

**Complexity:** S (unit test with known inputs)

---

### P1-17: Test Dynamic Skills Referenced in Agent Body

**Context:**
Skills NOT marked as preloaded should be referenced in the agent body via the Skill tool invocation pattern.

**Files to Reference:**

- `/home/vince/dev/cli/src/cli/lib/skill-agent-mappings.ts` (lines 147-176)
- `/home/vince/dev/cli/src/agents/_templates/agent.liquid`

**Acceptance Criteria:**

1. Agent compiled with dynamic skill has:
   - Skill reference in body using `skill: "skill-name (@author)"` format
   - `Invoke:` instruction in the Available Skills section
2. Dynamic skills are NOT in frontmatter `skills:` array
3. `Use when:` guidance appears for each dynamic skill

**Test Approach:**

- Compile a test agent with known dynamic skills
- Parse output body
- Verify skill invocation pattern present

**Files to Modify:**

- Add to: `/home/vince/dev/cli/src/cli/lib/resolver.test.ts`

**Complexity:** S (unit test with known inputs)

---

### P2-05: Move SKILL_TO_AGENTS to YAML Config

**Context:**
Currently, agent-skill mappings are hardcoded in TypeScript. Moving them to YAML enables user customization.

**Files to Reference:**

- `/home/vince/dev/cli/src/cli/lib/skill-agent-mappings.ts` (lines 1-113)
- `/home/vince/dev/claude-subagents/config/skills-matrix.yaml`

**Acceptance Criteria:**

1. New YAML section `agent_mappings.skill_to_agents` in skills-matrix.yaml
2. Structure matches current `SKILL_TO_AGENTS` object
3. `getAgentsForSkill()` reads from loaded matrix, not hardcoded
4. Fallback to hardcoded values if YAML section missing (backward compatibility)
5. All existing tests continue to pass

**Implementation Notes:**

```yaml
# In skills-matrix.yaml
agent_mappings:
  skill_to_agents:
    "frontend/*":
      - web-developer
      - web-reviewer
      - web-researcher
    "backend/*":
      - api-developer
      - api-reviewer
```

**Files to Modify:**

- `/home/vince/dev/cli/src/cli/lib/skill-agent-mappings.ts`
- `/home/vince/dev/cli/src/cli/lib/matrix-loader.ts`
- `/home/vince/dev/cli/src/cli/types-matrix.ts`

**Complexity:** L (cross-cutting change)

---

### P2-10: Implement `cc eject skills`

**Context:**
Users need ability to eject skills from installed plugin to local directory for customization.

**Files to Reference:**

- `/home/vince/dev/cli/src/cli/commands/eject.ts` (existing eject patterns)
- `/home/vince/dev/cli/src/cli/lib/plugin-finder.ts` (find plugin directory)

**Acceptance Criteria:**

1. `cc eject skills` copies all skills from plugin to `.claude/skills/`
2. Each skill maintains structure:
   - `{skillId}/SKILL.md`
   - `{skillId}/metadata.yaml` (if exists)
3. `--force` flag overwrites existing
4. Warning if `.claude/skills/` already exists without `--force`
5. After eject, `cc compile` uses ejected skills

**Implementation Notes:**

```bash
# Expected usage
cc eject skills              # Ejects to .claude/skills/
cc eject skills -o ./custom  # Custom output
cc eject skills -f           # Force overwrite
```

**Files to Modify:**

- `/home/vince/dev/cli/src/cli/commands/eject.ts`

**Complexity:** M (new eject type)

---

### P2-11: Implement `cc eject agents`

**Context:**
Users need ability to eject agent partials (intro.md, workflow.md, etc.) for customization.

**Files to Reference:**

- `/home/vince/dev/cli/src/cli/commands/eject.ts`
- `/home/vince/dev/cli/src/agents/` (agent partial structure)

**Acceptance Criteria:**

1. `cc eject agents` copies agent partials to `.claude/agents/_partials/`
2. Structure:
   ```
   .claude/agents/_partials/
   ├── web-developer/
   │   ├── intro.md
   │   ├── workflow.md
   │   ├── examples.md
   │   └── critical-requirements.md
   └── api-developer/
       └── ...
   ```
3. `--force` flag overwrites existing
4. After eject, `cc compile` uses ejected partials

**Files to Modify:**

- `/home/vince/dev/cli/src/cli/commands/eject.ts`
- `/home/vince/dev/cli/src/cli/lib/agent-recompiler.ts` (check for local partials)

**Complexity:** M (new eject type + compile integration)

---

### P3-06: Implement `cc uninstall` for Plugin Mode

**Context:**
Users need to remove installed plugins cleanly.

**Files to Reference:**

- `/home/vince/dev/cli/src/cli/lib/plugin-finder.ts`
- `/home/vince/dev/cli/src/cli/utils/exec.ts`

**Acceptance Criteria:**

1. `cc uninstall` calls `claude plugin uninstall claude-collective`
2. Plugin removed from `.claude/settings.json` enabledPlugins
3. Warning before uninstall, require confirmation
4. `--yes` flag skips confirmation
5. Exit code 0 on success

**Implementation Notes:**

```bash
# Expected usage
cc uninstall           # Prompts for confirmation
cc uninstall --yes     # No confirmation
cc uninstall --all     # Removes all cc-managed plugins
```

**Files to Modify:**

- Create: `/home/vince/dev/cli/src/cli/commands/uninstall.ts`
- `/home/vince/dev/cli/src/cli/index.ts` (register command)

**Complexity:** M (new command)

---

### P4-01: Implement `cc search <query>` Command

**Context:**
Users need to discover available skills from the source repository.

**Acceptance Criteria:**

1. `cc search <query>` searches skills by name, description, category
2. Results displayed in table format: ID | Category | Description
3. `--source` flag overrides default source
4. Fuzzy matching on skill names

**Expected Usage:**

```bash
cc search react
cc search --category framework
cc search auth --source github:org/repo
```

**Files to Modify:**

- Create: `/home/vince/dev/cli/src/cli/commands/search.ts`
- `/home/vince/dev/cli/src/cli/index.ts` (register command)

**Complexity:** M

---

### P4-02: Implement `cc info <skill>` Command

**Context:**
Users need detailed information about a specific skill before installing or using it. The `search` command shows a brief list; `info` shows the full picture for a single skill.

**Files to Reference (Read Before Implementing):**

| Priority | File                                                  | Lines   | Pattern Demonstrated                                    |
| -------- | ----------------------------------------------------- | ------- | ------------------------------------------------------- |
| 1        | `/home/vince/dev/cli/src/cli/commands/search.ts`      | 1-161   | Source loading, skill lookup, spinner pattern           |
| 2        | `/home/vince/dev/cli/src/cli/lib/source-loader.ts`    | 37-75   | `loadSkillsMatrixFromSource()` with local skills merged |
| 3        | `/home/vince/dev/cli/src/cli/types-matrix.ts`         | 322-395 | `ResolvedSkill` interface - all displayable fields      |
| 4        | `/home/vince/dev/cli/src/cli/lib/plugin-info.ts`      | 60-65   | `formatPluginDisplay()` - multi-line info formatting    |
| 5        | `/home/vince/dev/cli/src/cli/commands/search.test.ts` | 1-80    | Test patterns and mock skill creation                   |

**Acceptance Criteria:**

1. `cc info <skill-id>` shows full metadata for a skill
2. Supports both full ID (`"react (@vince)"`) and alias (`react`)
3. Displays all metadata fields:
   - Name, Author, Category, Description
   - Tags (comma-separated)
   - Dependencies (`requires`)
   - Conflicts (`conflictsWith`)
   - Recommended companions (`recommends`)
   - Usage guidance (`usageGuidance`)
4. Shows local installation status:
   - "Installed locally" if skill exists in `.claude/skills/`
   - "Not installed locally" otherwise
5. Shows skill content preview (first 10 lines of SKILL.md body, after frontmatter)
6. `--source` flag to specify skill source (same as `search` command)
7. `--no-preview` flag to skip content preview (for scripting)
8. Exit code 0 on success, 1 if skill not found

**Expected CLI Usage:**

```bash
# By full ID (requires quotes due to parentheses)
cc info "react (@vince)"

# By alias (preferred for convenience)
cc info react

# With custom source
cc info zustand --source /path/to/skills

# Without preview (for scripting)
cc info react --no-preview
```

**Expected Output Format:**

```
Skill: react (@vince)
Alias: react
Author: @vince
Category: frontend/framework

Description:
  React framework for building user interfaces

Tags: react, frontend, ui, component

Requires: (none)
Conflicts with: vue (@vince), svelte (@vince)
Recommends: zustand (@vince), react-query (@vince)

Usage Guidance:
  Use when building component-based UIs with React

Local Status: Not installed

--- Content Preview (first 10 lines) ---
# React

This skill provides React component patterns and best practices...
[...]
```

**Implementation Requirements:**

1. **Skill Resolution Logic:**
   - First, try exact match on `matrix.skills[skillId]`
   - Then, try alias lookup via `matrix.aliases[skillId]`
   - If no match, show error with suggestions (skills containing the query)

2. **Local Installation Check:**
   - Check if skill exists in `.claude/skills/{skillId}/` OR `.claude/skills/{alias}/`
   - Use `discoverLocalSkills()` from `local-skill-loader.ts` for consistency
   - A skill is "installed" if its ID appears in the local skills result

3. **Content Preview:**
   - Load SKILL.md from source path (`skill.path`)
   - Strip frontmatter (everything between `---` markers)
   - Take first 10 non-empty lines of body
   - Truncate lines longer than 80 characters

4. **Formatting Functions:**
   - `formatRelations(relations: SkillRelation[])`: Format array of relations with reasons
   - `formatRequirements(reqs: SkillRequirement[])`: Format dependency requirements
   - `formatTags(tags: string[])`: Join with ", " or show "(none)"
   - Reuse `pc` (picocolors) for styling: `pc.cyan()` for IDs, `pc.dim()` for labels

**Files to Create/Modify:**

| Action | File                                                | Changes                                                            |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------ |
| Create | `/home/vince/dev/cli/src/cli/commands/info.ts`      | New command (~120 lines)                                           |
| Modify | `/home/vince/dev/cli/src/cli/index.ts`              | Add `import { infoCommand }` and `program.addCommand(infoCommand)` |
| Create | `/home/vince/dev/cli/src/cli/commands/info.test.ts` | Unit tests (~200 lines)                                            |

**Test Requirements (P4-04):**

Tests should cover:

1. Command structure (name, description, arguments, options)
2. Skill lookup by full ID
3. Skill lookup by alias
4. Skill not found error message
5. Local installation detection (installed vs not installed)
6. Content preview extraction (strips frontmatter)
7. `--no-preview` flag hides preview
8. All metadata fields display correctly
9. Relations formatting (requires, conflicts, recommends)
10. Empty relations show "(none)"

**Error Handling:**

```
# Skill not found
$ cc info nonexistent
Error: Skill "nonexistent" not found.

Did you mean one of these?
  - react (@vince)
  - react-query (@vince)

Use 'cc search <query>' to find available skills.
```

**Constraints:**

- Do NOT modify any files outside `commands/` and `index.ts`
- Do NOT add new dependencies
- Follow existing command patterns exactly (spinner, error handling, colors)
- Use existing utilities from `lib/source-loader.ts` and `lib/local-skill-loader.ts`

**Complexity:** S (single-purpose command following established patterns)

---

### P4-05: Implement `cc outdated` Command

**Context:**
Users need to know when their local skills in `.claude/skills/` are out of date compared to the source repository. This enables users to see which skills have upstream changes available.

**Why This Matters:**

- Users fork/copy skills locally for customization
- Source skills get updated with improvements
- Users need visibility into available updates without losing local changes
- Foundation for the `cc update` command (P4-06)

**Version Detection Strategy:**

Since skills may not have explicit versions, use content hash comparison. When skills are copied locally, the `skill-copier.ts` already injects `forked_from` metadata into `metadata.yaml`:

```yaml
forked_from:
  skill_id: "react (@vince)"
  content_hash: "a1b2c3d" # SHA256 hash (7 chars) of SKILL.md at copy time
  date: "2026-01-31"
```

Compare this stored `content_hash` against the current source hash to detect changes.

**Files to Reference (must read before implementation):**

| Priority | File                                                    | Lines       | Pattern                                                      |
| -------- | ------------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| 1        | `/home/vince/dev/cli/src/cli/lib/versioning.ts`         | 1-71        | `hashFile()`, `hashSkillFolder()`, hash generation           |
| 2        | `/home/vince/dev/cli/src/cli/lib/skill-copier.ts`       | 8-18, 51-76 | `ForkedFromMetadata` interface, `injectForkedFromMetadata()` |
| 3        | `/home/vince/dev/cli/src/cli/lib/local-skill-loader.ts` | 27-53       | `discoverLocalSkills()` - how to find local skills           |
| 4        | `/home/vince/dev/cli/src/cli/lib/source-loader.ts`      | 37-75       | `loadSkillsMatrixFromSource()` - loading source skills       |
| 5        | `/home/vince/dev/cli/src/cli/commands/search.ts`        | 63-98       | Table formatting pattern with `formatResultsTable()`         |
| 6        | `/home/vince/dev/cli/src/cli/commands/uninstall.ts`     | 57-67       | Command structure with options pattern                       |

**Acceptance Criteria:**

1. **Core Functionality:**
   - Reads local skills from `.claude/skills/` directory
   - Reads each skill's `metadata.yaml` for `forked_from.content_hash` and `forked_from.skill_id`
   - Loads source matrix using `loadSkillsMatrixFromSource()`
   - Computes current source hash using `hashFile()` from `versioning.ts`
   - Compares local hash vs source hash

2. **Output Table Format:**

   ```
   Skill                    Local Hash   Source Hash  Status
   ─────────────────────────────────────────────────────────────
   react (@vince)           a1b2c3d      a1b2c3d      current
   zustand (@vince)         d4e5f6g      x7y8z9a      outdated
   my-custom-skill          (local)      -            local-only
   drizzle (@vince)         -            b2c3d4e      source-only
   ```

3. **Status Values:**
   - `current` - local hash matches source hash
   - `outdated` - local hash differs from source hash
   - `local-only` - skill exists locally but has no `forked_from` (user-created)
   - `source-only` - skill in source but not installed locally (informational, dimmed)

4. **Exit Codes:**
   - Exit code `0` if all installed skills are `current` or `local-only`
   - Exit code `1` if any skill is `outdated`
   - Use `EXIT_CODES` from `/home/vince/dev/cli/src/cli/lib/exit-codes.ts`

5. **Flags:**
   - `--source <path|url>` - Override default source (follow `search.ts` pattern)
   - `--json` - Output as JSON for scripting

**CLI Usage Examples:**

```bash
# Check all local skills against default source
cc outdated

# Check against specific source
cc outdated --source /home/vince/dev/claude-subagents
cc outdated --source github:my-org/my-skills

# JSON output for scripting
cc outdated --json
```

**Output Mockups:**

Standard output:

```
  Loading skills...
  Loaded from local: /home/vince/dev/claude-subagents

  Skill                    Local Hash   Source Hash  Status
  ─────────────────────────────────────────────────────────────
  react (@vince)           a1b2c3d      a1b2c3d      current
  zustand (@vince)         d4e5f6g      x7y8z9a      outdated
  my-patterns              (local)      -            local-only

  Summary: 1 outdated, 1 current, 1 local-only
```

JSON output (`--json`):

```json
{
  "skills": [
    {
      "id": "react (@vince)",
      "localHash": "a1b2c3d",
      "sourceHash": "a1b2c3d",
      "status": "current"
    },
    {
      "id": "zustand (@vince)",
      "localHash": "d4e5f6g",
      "sourceHash": "x7y8z9a",
      "status": "outdated"
    },
    {
      "id": "my-patterns",
      "localHash": null,
      "sourceHash": null,
      "status": "local-only"
    }
  ],
  "summary": { "outdated": 1, "current": 1, "localOnly": 1 }
}
```

**Files to Create:**

- `/home/vince/dev/cli/src/cli/commands/outdated.ts` - Main command implementation
- `/home/vince/dev/cli/src/cli/commands/outdated.test.ts` - Unit tests

**Files to Modify:**

- `/home/vince/dev/cli/src/cli/index.ts` - Register `outdatedCommand` (follow `searchCommand` pattern at line 50)

**Implementation Approach:**

1. Create new command following `search.ts` structure (Commander, @clack/prompts, picocolors)
2. Create helper function `getLocalSkillHashes()` that:
   - Uses `discoverLocalSkills()` to find all local skills
   - Reads `metadata.yaml` for each skill
   - Extracts `forked_from.content_hash` and `forked_from.skill_id`
   - Returns map of skill ID to local hash info
3. Create helper function `getSourceSkillHashes()` that:
   - Uses `loadSkillsMatrixFromSource()` to get source skills
   - For each source skill, computes hash using `hashFile()` on SKILL.md
   - Returns map of skill ID to source hash
4. Compare maps and determine status for each skill
5. Format output table using pattern from `search.ts`
6. Set appropriate exit code

**Error Handling:**

- If `.claude/skills/` doesn't exist: "No local skills found. Run `cc init` or `cc edit` first."
- If source unreachable: "Failed to load source: {error}. Check --source flag or network connection."
- If `metadata.yaml` missing for a skill: Treat as `local-only` (no forked_from info)

**Testing Requirements (P4-07):**

1. Test: Skills with matching hashes show `current` status
2. Test: Skills with different hashes show `outdated` status
3. Test: Skills without `forked_from` show `local-only` status
4. Test: Exit code 0 when all current
5. Test: Exit code 1 when any outdated
6. Test: `--json` flag produces valid JSON
7. Test: `--source` flag overrides default source

**Complexity:** M

**Dependencies:** None (can start immediately)

---

### P4-06: Implement `cc update [skill]` Command

**Context:**
Users need to update their local skills from the source repository when upstream changes are available. This command builds on `cc outdated` (P4-05) to perform the actual update.

**Why This Matters:**

- Users want to get improvements from upstream without losing their local setup
- After update, agents need to be recompiled to use new skill content
- Users should see what will change before committing to an update

**Files to Reference (must read before implementation):**

| Priority | File                                                  | Lines          | Pattern                                                           |
| -------- | ----------------------------------------------------- | -------------- | ----------------------------------------------------------------- |
| 1        | `/home/vince/dev/cli/src/cli/commands/outdated.ts`    | all            | Prerequisite - reuse hash comparison logic                        |
| 2        | `/home/vince/dev/cli/src/cli/lib/skill-copier.ts`     | 78-99, 180-201 | `copySkill()`, `copySkillToLocalFlattened()` - how to copy skills |
| 3        | `/home/vince/dev/cli/src/cli/lib/agent-recompiler.ts` | 119-290        | `recompileAgents()` - post-update recompilation                   |
| 4        | `/home/vince/dev/cli/src/cli/commands/uninstall.ts`   | 142-158        | Confirmation prompt pattern                                       |
| 5        | `/home/vince/dev/cli/src/cli/lib/source-loader.ts`    | 37-75          | Source loading for skill content                                  |
| 6        | `/home/vince/dev/cli/src/cli/lib/versioning.ts`       | 35-44          | Hash functions for verification                                   |

**Acceptance Criteria:**

1. **Update All Outdated Skills:**
   - `cc update` (no arguments) updates all skills with `outdated` status
   - Skips `current` and `local-only` skills
   - Shows summary of what will be updated

2. **Update Specific Skill:**
   - `cc update <skill-name>` updates only the specified skill
   - Supports partial matching (e.g., `cc update react` matches `react (@vince)`)
   - Error if skill not found or not outdated

3. **Preview Changes:**
   - Before updating, show what will change (unless `--yes`)
   - Show: skill name, old hash, new hash
   - Prompt for confirmation

4. **Update Process:**
   - Use `copySkillToLocalFlattened()` pattern from `skill-copier.ts`
   - Preserve local directory name
   - Update `metadata.yaml` with new `forked_from` info (hash + date)
   - Overwrite `SKILL.md` and other skill files

5. **Post-Update Recompilation:**
   - After successful update, trigger agent recompilation
   - Use `recompileAgents()` from `agent-recompiler.ts`
   - Show which agents were recompiled

6. **Flags:**
   - `--yes` or `-y` - Skip confirmation prompt
   - `--source <path|url>` - Override default source
   - `--no-recompile` - Skip agent recompilation after update

**CLI Usage Examples:**

```bash
# Update all outdated skills (with confirmation)
cc update

# Update specific skill
cc update react
cc update "react (@vince)"

# Skip confirmation
cc update --yes
cc update -y

# Update from specific source
cc update --source /home/vince/dev/claude-subagents

# Update without recompiling agents
cc update --no-recompile
```

**Output Mockups:**

Update all (with confirmation):

```
  Loading skills...
  Loaded from local: /home/vince/dev/claude-subagents

  The following skills will be updated:

  Skill                    Local Hash   Source Hash
  ───────────────────────────────────────────────────
  zustand (@vince)         d4e5f6g  ->  x7y8z9a
  drizzle (@vince)         e5f6g7h  ->  y8z9a0b

  2 skill(s) will be updated.

? Proceed with update? (y/N) > y

  Updating zustand (@vince)... done
  Updating drizzle (@vince)... done

  Recompiling agents...
    Recompiled: frontend-developer
    Recompiled: backend-developer

  Update complete! 2 skills updated, 2 agents recompiled.
```

Update specific skill:

```
  Loading skills...

  Updating zustand (@vince)...
    Local hash:  d4e5f6g
    Source hash: x7y8z9a

? Update this skill? (y/N) > y

  Updating... done

  Recompiling agents...
    Recompiled: frontend-developer

  Update complete!
```

Error - skill not found:

```
  Error: Skill "foobar" not found.

  Did you mean one of these?
    - zustand (@vince)

  Run `cc search foobar` to search available skills.
```

Error - skill not outdated:

```
  Skill "react (@vince)" is already up to date.

  Local hash:  a1b2c3d
  Source hash: a1b2c3d
```

**Files to Create:**

- `/home/vince/dev/cli/src/cli/commands/update.ts` - Main command implementation
- `/home/vince/dev/cli/src/cli/commands/update.test.ts` - Unit tests

**Files to Modify:**

- `/home/vince/dev/cli/src/cli/index.ts` - Register `updateCommand`

**Implementation Approach:**

1. Create command following existing patterns (Commander, @clack/prompts, picocolors)
2. Reuse outdated detection logic from P4-05 (`cc outdated`)
   - Consider extracting shared logic to `/home/vince/dev/cli/src/cli/lib/skill-comparator.ts`
3. For skill update:
   - Get source skill path from `loadSkillsMatrixFromSource()` result
   - Use `copy()` from `utils/fs.ts` to overwrite local skill directory
   - Call `injectForkedFromMetadata()` pattern to update `metadata.yaml`
4. For agent recompilation:
   - Detect which agents use the updated skills (via `config.yaml` or `agent_skills` mapping)
   - Call `recompileAgents()` with appropriate options
5. Handle partial skill name matching with fuzzy search

**Error Handling:**

- If no outdated skills: "All skills are up to date." (exit 0)
- If skill name not found: Suggest similar skills, point to `cc search`
- If source unreachable: "Failed to load source. Check network or --source flag."
- If recompilation fails: Show warning but don't fail the update
- If update fails mid-way: Show which skills were updated, which failed

**Edge Cases:**

1. User has modified local skill (not forked_from source) - skip with warning
2. Source skill was deleted - show warning, cannot update
3. Network error during update - graceful failure, show partial results
4. Agent recompilation fails - warn but don't fail update command

**Testing Requirements (P4-08):**

1. Test: `cc update` updates all outdated skills
2. Test: `cc update <skill>` updates specific skill
3. Test: Skill not found shows helpful error
4. Test: Already current skill shows message (no update)
5. Test: `--yes` skips confirmation
6. Test: `--no-recompile` skips agent recompilation
7. Test: `forked_from` metadata updated after update
8. Test: Agent recompilation triggered after update

**Shared Logic Extraction (Optional Enhancement):**

Consider creating `/home/vince/dev/cli/src/cli/lib/skill-comparator.ts` with:

```typescript
export interface SkillComparisonResult {
  id: string;
  localHash: string | null;
  sourceHash: string | null;
  status: "current" | "outdated" | "local-only" | "source-only";
  localPath?: string;
  sourcePath?: string;
}

export async function compareLocalAndSourceSkills(
  projectDir: string,
  sourceResult: SourceLoadResult,
): Promise<SkillComparisonResult[]>;
```

This would be shared between `outdated.ts` and `update.ts`.

**Complexity:** M

**Dependencies:** P4-05 (uses outdated detection logic)

---

### P4-09: Implement `cc doctor` Command

**Context:**
Users need to diagnose common configuration issues. The `cc doctor` command provides a comprehensive health check of the Claude Collective setup, identifying misconfigurations, missing files, orphaned resources, and source accessibility issues.

**Files to Reference (Pattern Sources):**

| Priority | File                                                    | Lines   | Pattern Demonstrated                                   |
| -------- | ------------------------------------------------------- | ------- | ------------------------------------------------------ |
| 1        | `/home/vince/dev/cli/src/cli/commands/validate.ts`      | 1-145   | Command structure, spinner, error handling, exit codes |
| 2        | `/home/vince/dev/cli/src/cli/lib/project-config.ts`     | 155-266 | Config validation pattern (`validateProjectConfig`)    |
| 3        | `/home/vince/dev/cli/src/cli/lib/source-loader.ts`      | 37-75   | Source loading and accessibility pattern               |
| 4        | `/home/vince/dev/cli/src/cli/lib/local-skill-loader.ts` | 27-53   | Local skill discovery pattern                          |
| 5        | `/home/vince/dev/cli/src/cli/commands/search.ts`        | 100-161 | Command with `--source` flag pattern                   |

**Acceptance Criteria:**

1. **Config Valid Check:**
   - Parse `.claude/config.yaml` without errors
   - Use `validateProjectConfig()` from `project-config.ts`
   - Report validation errors and warnings
   - Display: `[PASS]` or `[FAIL]` with specific error messages

2. **Skills Resolved Check:**
   - For each skill in `config.skills[]`, verify it exists:
     - In source skills matrix (via `loadSkillsMatrixFromSource`)
     - OR locally in `.claude/skills/`
   - Report unresolved skill IDs
   - Display: `[PASS]` if all resolve, `[FAIL]` with list of missing skills

3. **Agents Compiled Check:**
   - For each agent in `config.agents[]`, verify:
     - `.claude/agents/{agent}.md` file exists
   - Report agents that need recompilation
   - Display: `[PASS]` if all exist, `[WARN]` with list of missing (not fatal)

4. **No Orphans Check:**
   - Scan `.claude/agents/*.md` files
   - Compare against `config.agents[]`
   - Report files not referenced in config
   - Display: `[PASS]` if no orphans, `[WARN]` with list of orphaned files

5. **Source Reachable Check:**
   - Attempt to load from configured source using `loadSkillsMatrixFromSource`
   - If local source: verify directory exists
   - If remote source: verify can fetch (or report if using cache)
   - Display: `[PASS]`, `[WARN]` (using cache), or `[FAIL]` (unreachable)

6. **Output Format:**
   - Use colored output via `picocolors`:
     - `pc.green("✓")` for pass
     - `pc.red("✗")` for fail
     - `pc.yellow("!")` for warning
   - Summary at end: `X checks passed, Y warnings, Z errors`

7. **Exit Codes:**
   - Exit 0 if all checks pass (warnings OK)
   - Exit 1 if any check fails

**CLI Usage:**

```bash
# Basic usage - run all checks
cc doctor

# With custom source
cc doctor --source /path/to/skills

# Verbose output (show all details)
cc doctor -v
```

**Output Format Mockup:**

```
Claude Collective Doctor

  Checking configuration health...

  Config Valid        ✓  .claude/config.yaml is valid
  Skills Resolved     ✓  12/12 skills found
  Agents Compiled     !  3 agents need recompilation
                         - web-developer (missing)
                         - api-developer (missing)
                         - tester (missing)
  No Orphans          ✓  No orphaned agent files
  Source Reachable    ✓  Connected to /home/user/skills

  Summary: 4 passed, 1 warning, 0 errors

  Tip: Run 'cc compile' to generate missing agent files
```

**Error Output Mockup:**

```
Claude Collective Doctor

  Checking configuration health...

  Config Valid        ✗  .claude/config.yaml has errors
                         - agents is required and must be an array
                         - skills must be an array
  Skills Resolved     -  Skipped (config invalid)
  Agents Compiled     -  Skipped (config invalid)
  No Orphans          -  Skipped (config invalid)
  Source Reachable    ✓  Connected to /home/user/skills

  Summary: 1 passed, 0 warnings, 1 error

  Run 'cc doctor -v' for more details
```

**Files to Create:**

- `/home/vince/dev/cli/src/cli/commands/doctor.ts` - Main command implementation
- `/home/vince/dev/cli/src/cli/commands/doctor.test.ts` - Test file

**Files to Modify:**

- `/home/vince/dev/cli/src/cli/index.ts` - Register `doctorCommand`

**Implementation Notes:**

1. **Command Structure** (follow `validate.ts` pattern):

   ```
   - Import Command from commander
   - Import spinner from @clack/prompts
   - Import EXIT_CODES from lib/exit-codes
   - Define doctorCommand with options
   - Run checks sequentially
   - Display results with colored output
   ```

2. **Check Functions** (create modular check functions):

   ```
   - checkConfigValid(projectDir) -> CheckResult
   - checkSkillsResolved(config, matrix) -> CheckResult
   - checkAgentsCompiled(config, projectDir) -> CheckResult
   - checkNoOrphans(config, projectDir) -> CheckResult
   - checkSourceReachable(sourceFlag, projectDir) -> CheckResult
   ```

3. **CheckResult Type:**

   ```typescript
   interface CheckResult {
     status: "pass" | "fail" | "warn" | "skip";
     message: string;
     details?: string[];
   }
   ```

4. **Use Existing Utilities:**
   - `loadProjectConfig()` from `lib/project-config.ts`
   - `validateProjectConfig()` from `lib/project-config.ts`
   - `loadSkillsMatrixFromSource()` from `lib/source-loader.ts`
   - `discoverLocalSkills()` from `lib/local-skill-loader.ts`
   - `fileExists()`, `glob()` from `utils/fs.ts`
   - `EXIT_CODES` from `lib/exit-codes.ts`

**Constraints:**

- **DO NOT** implement auto-fix (that's future scope)
- **DO NOT** add new dependencies
- **DO NOT** modify any files outside of:
  - `/home/vince/dev/cli/src/cli/commands/doctor.ts` (create)
  - `/home/vince/dev/cli/src/cli/commands/doctor.test.ts` (create)
  - `/home/vince/dev/cli/src/cli/index.ts` (modify to register)

**Success Criteria:**

| Criterion                                    | How to Verify                                        |
| -------------------------------------------- | ---------------------------------------------------- |
| Command runs without error when config valid | `cc doctor` in a valid project returns exit 0        |
| Command detects invalid config               | Create malformed config.yaml, verify `[FAIL]` status |
| Command detects missing skills               | Add non-existent skill ID to config, verify reported |
| Command detects missing agent files          | Remove an agent .md file, verify `[WARN]` status     |
| Command detects orphaned files               | Create extra .md file in agents/, verify `[WARN]`    |
| Command checks source accessibility          | Run with valid/invalid source paths                  |
| Exit code 0 when all pass                    | Run on valid setup, check `$?` is 0                  |
| Exit code 1 when any fail                    | Run on invalid setup, check `$?` is 1                |
| All existing tests pass                      | `bun test` shows 945+ tests passing                  |
| New tests cover all checks                   | `bun test doctor` shows all check scenarios covered  |

**Test Scenarios (for doctor.test.ts):**

1. **Happy Path:**
   - Valid config, all skills exist, all agents compiled
   - Expected: All checks pass, exit 0

2. **No Config:**
   - Project without `.claude/config.yaml`
   - Expected: Config check fails, other checks skipped, exit 1

3. **Invalid Config:**
   - Config with missing `agents` field
   - Expected: Config check fails with error message, exit 1

4. **Missing Skills:**
   - Config references skill ID not in source or local
   - Expected: Skills check fails, lists missing skill IDs

5. **Missing Agent Files:**
   - Config lists agent not compiled to `.claude/agents/`
   - Expected: Agents check warns, lists missing agents

6. **Orphaned Agent Files:**
   - Extra `.md` file in `.claude/agents/` not in config
   - Expected: Orphans check warns, lists orphaned files

7. **Source Unreachable:**
   - Non-existent source path
   - Expected: Source check fails or warns

**Complexity:** M (medium - uses existing utilities, 5 discrete checks)

**Estimated Effort:** 2-3 hours implementation, 1-2 hours testing

---

### P4-11: Implement `cc new skill <name>` Command

**Context:**
Users need to scaffold new skills with proper structure. This command creates the minimal files needed to define a custom local skill that will be discovered by the CLI.

**Files to Reference (Pattern Sources):**

| Priority | File                                                                                     | Lines           | Pattern Demonstrated                                                  |
| -------- | ---------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------- |
| 1        | `/home/vince/dev/cli/src/cli/commands/new-agent.ts`                                      | 1-238           | Command structure, Commander.js patterns, newCommand with subcommands |
| 2        | `/home/vince/dev/cli/src/cli/lib/local-skill-loader.ts`                                  | 55-118          | Required skill file structure (SKILL.md, metadata.yaml)               |
| 3        | `/home/vince/dev/cli/src/cli/lib/config.ts`                                              | 80-101, 128-134 | loadGlobalConfig, saveGlobalConfig for author default                 |
| 4        | `/home/vince/dev/claude-subagents/src/skills/web/framework/react (@vince)/SKILL.md`      | 1-10            | SKILL.md frontmatter format                                           |
| 5        | `/home/vince/dev/claude-subagents/src/skills/web/framework/react (@vince)/metadata.yaml` | 1-22            | metadata.yaml required fields                                         |

**Skill Structure to Generate:**

```
.claude/skills/<name>/
├── SKILL.md          # Main content with frontmatter
└── metadata.yaml     # CLI metadata
```

**SKILL.md Template:**

```markdown
---
name: <name> (<author>)
description: <Brief description of this skill>
---

# <Name>

> **Quick Guide:** Add a brief summary of what this skill teaches.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

**(Add critical requirements here)**

</critical_requirements>

---

**When to use:**

- Add use cases here

**Key patterns covered:**

- Add patterns here

---

<patterns>

## Core Patterns

### Pattern 1: Example Pattern

Add your patterns here.

</patterns>

---

<critical_reminders>

## CRITICAL REMINDERS

**(Repeat critical requirements here)**

</critical_reminders>
```

**metadata.yaml Template:**

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/claude-collective/skills/main/schemas/metadata.schema.json
category: local
category_exclusive: false
author: "<author>"
version: 1
cli_name: <Name>
cli_description: <Brief description>
usage_guidance: Use when <guidance>.
tags:
  - local
  - custom
```

**Acceptance Criteria:**

1. `cc new skill <name>` creates `.claude/skills/<name>/` directory
2. Creates `SKILL.md` with proper frontmatter including skill name and author
3. Creates `metadata.yaml` with all required fields (category, author, version, cli_name, cli_description)
4. `--author` flag overrides default author (if not provided, uses `author` from global config `~/.claude-collective/config.yaml`)
5. `--category` flag sets category (default: `local`)
6. Validates skill name (kebab-case, no spaces)
7. Fails gracefully if directory already exists (unless `--force`)
8. Uses @clack/prompts for user feedback (matching existing CLI patterns)

**Expected Usage:**

```bash
# Create skill with defaults
cc new skill my-patterns

# Create with custom author
cc new skill my-patterns --author "@myhandle"

# Create with custom category
cc new skill auth-helpers --category security

# Force overwrite existing
cc new skill my-patterns --force
```

**Technical Constraints:**

- Must use existing `ensureDir`, `writeFile` from `/home/vince/dev/cli/src/cli/utils/fs.ts`
- Must use `loadGlobalConfig` from `/home/vince/dev/cli/src/cli/lib/config.ts` for author default
- Must use `LOCAL_SKILLS_PATH` constant from `/home/vince/dev/cli/src/cli/consts.ts`
- No new dependencies

**Files to Modify:**

- Create: `/home/vince/dev/cli/src/cli/commands/new-skill.ts`
- Modify: `/home/vince/dev/cli/src/cli/commands/new-agent.ts` - Add `skill` subcommand to existing `newCommand`
- No changes needed to `/home/vince/dev/cli/src/cli/index.ts` (newCommand already registered)

**Success Criteria:**

| Criterion                                                | How to Verify                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Creates skill directory in `.claude/skills/<name>/`      | Check directory exists after running command                                   |
| SKILL.md has valid frontmatter with name and description | Parse frontmatter, verify name matches `<name> (<author>)`                     |
| metadata.yaml has all required fields                    | Parse YAML, check category, author, version, cli_name, cli_description exist   |
| Author defaults from global config                       | Set author in `~/.claude-collective/config.yaml`, run without --author, verify |
| --author flag overrides default                          | Run with --author, verify metadata.yaml has flag value                         |
| Skill is discoverable by CLI                             | After creation, run `cc compile` and verify skill appears                      |
| Tests pass                                               | `bun test new-skill` passes all tests                                          |
| No TypeScript errors                                     | `bun tsc --noEmit` passes                                                      |

**Implementation Notes:**

- Add as a subcommand to existing `newCommand` in `new-agent.ts` (similar to how `agent` is a subcommand)
- Use kebab-case validation: `/^[a-z][a-z0-9-]*$/`
- The skill name in SKILL.md frontmatter should be `<name> (<author>)` to match existing skill ID format
- Default author format should be `@local` if not configured

**Complexity:** M

---

### P4-12: Implement `cc diff` Command

**Context:**
Users who have forked/ejected skills need to see what changed between their local version and the source version. This helps identify customizations and determine if updates are safe to merge.

**Files to Reference (Pattern Sources):**

| Priority | File                                                    | Lines       | Pattern Demonstrated                                    |
| -------- | ------------------------------------------------------- | ----------- | ------------------------------------------------------- |
| 1        | `/home/vince/dev/cli/src/cli/commands/search.ts`        | 1-161       | Command structure, source loading, spinner patterns     |
| 2        | `/home/vince/dev/cli/src/cli/lib/source-loader.ts`      | All         | `loadSkillsMatrixFromSource` for fetching source skills |
| 3        | `/home/vince/dev/cli/src/cli/lib/local-skill-loader.ts` | 27-53       | `discoverLocalSkills` for finding local skills          |
| 4        | `/home/vince/dev/cli/src/cli/lib/skill-copier.ts`       | 8-18, 51-76 | `forked_from` metadata for tracking source origin       |
| 5        | `/home/vince/dev/cli/src/cli/lib/versioning.ts`         | 41-44       | `hashFile` for content comparison                       |

**Diff Output Format:**

Uses standard unified diff format (like `git diff`):

```diff
--- source/skills/react (@vince)/SKILL.md
+++ local/.claude/skills/react/SKILL.md
@@ -1,5 +1,5 @@
 ---
-name: react (@vince)
+name: react (@local)
 description: React component patterns
 ---
```

**Acceptance Criteria:**

1. `cc diff` shows diff between ALL local skills that have `forked_from` metadata and their source versions
2. `--skill <name>` shows diff for a specific skill only
3. Uses unified diff format (standard `--- a/file` and `+++ b/file` headers)
4. Exit code 0 if no differences, exit code 1 if differences exist
5. `--source` flag overrides default source location
6. Only compares skills that have `forked_from.skill_id` in their metadata.yaml (tracks origin)
7. For skills without `forked_from`, shows warning that they cannot be compared
8. `--quiet` flag suppresses diff output, only returns exit code

**Expected Usage:**

```bash
# Show diff for all forked skills
cc diff

# Show diff for specific skill
cc diff --skill react

# Use custom source
cc diff --source /path/to/source

# Just check if differences exist (for CI)
cc diff --quiet
```

**Diff Detection Flow:**

1. Discover local skills in `.claude/skills/`
2. For each local skill with `forked_from` in metadata.yaml:
   a. Extract `forked_from.skill_id` (e.g., `react (@vince)`)
   b. Locate corresponding skill in source repository
   c. Compare `SKILL.md` content between local and source
   d. Generate unified diff if different
3. Display diffs with colored output (additions green, deletions red)
4. Return appropriate exit code

**Technical Constraints:**

- Must use `diff` package from npm for unified diff generation (standard for this purpose)
- Must use existing `loadSkillsMatrixFromSource` for source loading
- Must use existing `discoverLocalSkills` for local skill discovery
- Must handle case where source skill no longer exists (skill was removed from source)

**Files to Modify:**

| Action | File                                                | Changes                                                            |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------ |
| Create | `/home/vince/dev/cli/src/cli/commands/diff.ts`      | New command (~150 lines)                                           |
| Modify | `/home/vince/dev/cli/src/cli/index.ts`              | Add `import { diffCommand }` and `program.addCommand(diffCommand)` |
| Create | `/home/vince/dev/cli/src/cli/commands/diff.test.ts` | Unit tests (~200 lines)                                            |

**Success Criteria:**

| Criterion                            | How to Verify                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| Shows unified diff for forked skills | Create local skill with `forked_from`, modify it, run `cc diff`, verify diff output |
| --skill flag filters to single skill | Run with `--skill react`, verify only react skill is compared                       |
| Exit code 0 when no differences      | Create identical local skill, run `cc diff`, check `$?` is 0                        |
| Exit code 1 when differences exist   | Modify local skill, run `cc diff`, check `$?` is 1                                  |
| --source flag works                  | Run with `--source /custom/path`, verify it uses that path                          |
| Warns for skills without forked_from | Create skill without forked_from, run `cc diff`, verify warning shown               |
| Tests pass                           | `bun test diff` passes all tests                                                    |

**Implementation Notes:**

- Use `diff` npm package: `import { createTwoFilesPatch } from 'diff'`
- Color diff output using `picocolors`: green for additions (`+`), red for deletions (`-`)
- The `forked_from` metadata structure (from skill-copier.ts):
  ```yaml
  forked_from:
    skill_id: "react (@vince)"
    content_hash: "abc1234"
    date: "2026-01-31"
  ```
- Match skills by `forked_from.skill_id` to source skill ID
- Handle edge cases:
  - Source skill deleted: Show warning "Source skill 'X' no longer exists"
  - No local skills with forked_from: Show info "No forked skills to compare"
  - Source unreachable: Show error with clear message

**New Dependency:**

- Add `diff` package: `bun add diff` and `bun add -d @types/diff`

**Complexity:** M

---

### P4-15: Consolidate Hardcoded Skill IDs in Tests

**Context:**
Test files contain 209+ hardcoded references to `"react (@vince)"` and 100+ references to other skill IDs. This creates a large surface area for changes and fragile tests.

**Research Findings:**

- 17 test files affected
- Top skills: `react (@vince)` (209x), `zustand (@vince)` (66x), `hono (@vince)` (31x), `vitest (@vince)` (21x)
- Existing: `/home/vince/dev/cli/src/cli/lib/__tests__/helpers.ts` (factory functions only)

**Solution:**

Create `/home/vince/dev/cli/src/cli/lib/__tests__/test-fixtures.ts`:

```typescript
// test-fixtures.ts - Shared test skill constants

// Primary test skills (use these across all tests)
export const TEST_SKILLS = {
  REACT: "react (@vince)",
  ZUSTAND: "zustand (@vince)",
  HONO: "hono (@vince)",
  VITEST: "vitest (@vince)",
  VUE: "vue (@vince)",
  DRIZZLE: "drizzle (@vince)",
} as const;

// Test author
export const TEST_AUTHOR = "@vince";

// Generic placeholder skills for tests that need arbitrary IDs
export const PLACEHOLDER_SKILLS = {
  SKILL_A: "skill-a (@vince)",
  SKILL_B: "skill-b (@vince)",
} as const;

// Pre-built mock skill objects (using helpers.ts)
export function getTestReactSkill(): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.REACT, "frontend/framework");
}
// etc.
```

**Acceptance Criteria:**

1. Create `test-fixtures.ts` with shared constants
2. Update top 5 most-affected test files to use constants
3. All 945+ tests still pass
4. No new hardcoded skill IDs introduced

**Files to Modify:**

| Priority | File                                                           | Hardcoded Count |
| -------- | -------------------------------------------------------------- | --------------- |
| 1        | `/home/vince/dev/cli/src/cli/commands/search.test.ts`          | ~50             |
| 2        | `/home/vince/dev/cli/src/cli/lib/resolver.test.ts`             | ~40             |
| 3        | `/home/vince/dev/cli/src/cli/lib/skill-agent-mappings.test.ts` | ~30             |
| 4        | `/home/vince/dev/cli/src/cli/lib/config-generator.test.ts`     | ~25             |
| 5        | `/home/vince/dev/cli/src/cli/lib/skill-copier.test.ts`         | ~20             |

**Complexity:** M (straightforward find-replace, but many files)

---

## Test Matrix Reference

The following test scenarios must all pass before Phase 2 begins:

### Installation Tests

| ID    | Scenario               | Mode   | Expected                  | Status  |
| ----- | ---------------------- | ------ | ------------------------- | ------- |
| T-I01 | Install single stack   | Plugin | settings.json updated     | Phase 1 |
| T-I02 | Install single stack   | Local  | .claude/skills/ created   | Phase 1 |
| T-I03 | Re-run init            | Both   | Warning, suggests cc edit | Phase 1 |
| T-I04 | First-time marketplace | Plugin | Auto-registered           | Phase 1 |

### Compilation Tests

| ID    | Scenario                 | Pre-condition           | Expected        | Status  |
| ----- | ------------------------ | ----------------------- | --------------- | ------- |
| T-C01 | Custom template          | Ejected template        | Uses custom     | Phase 1 |
| T-C02 | Local skill override     | Same ID local + plugin  | Local wins      | Phase 1 |
| T-C03 | Preloaded in frontmatter | Config preloaded: true  | In skills array | Phase 1 |
| T-C04 | Dynamic in body          | Config preloaded: false | In agent body   | Phase 1 |

### Ejection Tests

| ID    | Scenario        | Type      | Expected                    | Status  |
| ----- | --------------- | --------- | --------------------------- | ------- |
| T-E01 | Eject templates | templates | .claude/templates/ created  | Exists  |
| T-E02 | Eject config    | config    | .claude/config.yaml created | Exists  |
| T-E03 | Eject skills    | skills    | .claude/skills/ populated   | Phase 2 |
| T-E04 | Eject agents    | agents    | .claude/agents/\_partials/  | Phase 2 |

---

## Risk Assessment

### High Risk

1. **Breaking existing installations** - Migration path needed for users with current setups
   - Mitigation: Version check in CLI, migration command if needed

2. **Test coverage gaps** - Refactoring without full test coverage risks regressions
   - Mitigation: Complete Phase 1 before Phase 2

### Medium Risk

1. **Claude CLI dependency** - Plugin install/uninstall depends on `claude` CLI behavior
   - Mitigation: Comprehensive mocking in tests, version pinning

2. **Config schema changes** - Unified config may break existing config.yaml files
   - Mitigation: Schema versioning, backward compatibility layer

### Low Risk

1. **Performance** - Loading YAML config vs. hardcoded values
   - Mitigation: Cache loaded config, lazy loading

---

## File Reference

### Key Source Files

| File                          | Purpose             | Lines |
| ----------------------------- | ------------------- | ----- |
| `commands/init.ts`            | Main init flow      | 449   |
| `commands/compile.ts`         | Compilation command | 494   |
| `commands/eject.ts`           | Eject command       | 169   |
| `lib/skill-agent-mappings.ts` | Hardcoded mappings  | 218   |
| `lib/wizard.ts`               | Interactive wizard  | 803   |
| `lib/stack-installer.ts`      | Plugin installation | 105   |
| `lib/config-generator.ts`     | Config generation   | 185   |

### Test Files

| File                                | Coverage                            |
| ----------------------------------- | ----------------------------------- |
| `commands/init.test.ts`             | Simulated init, directory structure |
| `commands/eject.test.ts`            | Template/config ejection            |
| `lib/__tests__/integration.test.ts` | Full pipeline tests                 |
| `lib/resolver.test.ts`              | Agent resolution                    |
| `lib/matrix-resolver.test.ts`       | Skill validation                    |

---

## Success Metrics

### Phase 1 Complete When:

- [x] 100% of Phase 1 tasks marked "Done"
- [x] All 20+ new tests pass (284 new tests added, 668 total)
- [x] Existing 384 tests still pass
- [x] Meaningful test coverage for all commands and flows (911 tests total)

### Phase 2 Complete When:

- [x] Unified config.yaml replaces stack configs
- [x] Agent-skill mappings in YAML, not TypeScript
- [x] `cc eject skills` and `cc eject agents` work
- [x] Stacks are visual hierarchy, skills/agents are unified (P2-18/P2-19)
- [x] All Phase 2 tests pass

### Phase 3 Complete When:

- [x] Custom agents definable in config.yaml
- [x] `cc uninstall` command works
- [x] Custom marketplace URLs supported
- [x] All Phase 3 tests pass

### Phase 4 Complete When:

- [x] `cc search` finds skills by name/category/description
- [x] `cc info` shows skill details
- [x] `cc outdated` detects version differences
- [x] `cc update` pulls latest from source
- [x] `cc doctor` diagnoses common issues
- [x] `cc new skill` scaffolds skill structure
- [x] `cc diff` shows changes from source
- [ ] All Phase 4 tests pass (1160 tests passing)

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
- Always run tests with `bun test` before marking tasks complete
- Document any unexpected behavior in this file
