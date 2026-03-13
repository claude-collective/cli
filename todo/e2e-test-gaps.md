# E2E Test Gaps Analysis

**Date:** 2026-03-13
**Status:** Analysis complete. No implementation plans or code.

---

## Overview

This document identifies 10 E2E testing gaps, analyzed against existing coverage in `e2e/`. For each gap: what to test, why it matters, the approach, key assertions, edge cases, open questions, and whether it needs `TerminalSession` (interactive) or `runCLI` (non-interactive).

### Existing Coverage Summary

| Area | Existing Tests | Files |
|------|---------------|-------|
| Eject command | 12 tests (basic flags, output dirs, --force, skills, all) | `commands/eject.e2e.test.ts` |
| Compile command | 16 tests (basic, verbose, multiple skills, custom skills, flags, errors) | `commands/compile.e2e.test.ts` |
| Uninstall command | 8 tests (help, nothing found, --yes, --all, preserve user content) | `commands/uninstall.e2e.test.ts` |
| Edit wizard (local) | ~15 tests (no installation, basic flow, navigation, cancellation) | `interactive/edit-wizard.e2e.test.ts` |
| Edit wizard (plugin) | 8 tests (remove, add, mode migration, cancellation) | `interactive/edit-wizard-plugin.e2e.test.ts` |
| Init wizard (plugin) | ~5 tests (plugin mode init with marketplace) | `interactive/init-wizard-plugin.e2e.test.ts` |
| Init wizard (local) | ~20+ tests across navigation, stack, scratch, sources, UI, flags, existing | `interactive/init-wizard-*.e2e.test.ts` |
| Local lifecycle | 1 test (init -> compile -> uninstall) | `lifecycle/local-lifecycle.e2e.test.ts` |
| Plugin lifecycle | 1 test (init -> uninstall) | `lifecycle/plugin-lifecycle.e2e.test.ts` |
| Dual-scope edit | 9 tests (7 `it.fails`) | `lifecycle/dual-scope-edit.e2e.test.ts` |
| Build pipeline | 5 tests (build plugins, build marketplace) | `commands/plugin-build.e2e.test.ts` |

---

## Gap 1: Template Ejection + Custom Compilation

### What's Being Tested

The progressive customization flow where a user ejects Liquid templates or agent partials, customizes them, then compiles agents that use the customized content. The Liquid template resolution chain in `compiler.ts:410-435` has two layers:

1. Project-local: `<projectDir>/.claude-src/agents/_templates/`
2. Built-in: `<PROJECT_ROOT>/templates/`

**Note:** There is also a legacy `.claude/templates/` path in `compiler.ts:420-424` that should be removed (pre-1.0, no backward-compat shims per CLAUDE.md). E2E tests should NOT test against the legacy path — only the two supported layers above.

**Why it matters:** This is a core customization workflow. If the Liquid engine doesn't correctly resolve project-local templates over built-in ones, users who customize their templates will get silent fallback to built-in templates.

### What Already Exists

- `commands/eject.e2e.test.ts`: Tests that `eject templates` and `eject agent-partials` produce files, --force works, --output works, skills from source work. But never follows up with `compile` to verify the ejected content is used.
- `commands/compile.e2e.test.ts`: Tests compile with local skills, custom skills, multiple skills, --verbose, errors. But never uses ejected/customized templates.

### Test Approach

**Test 1a: Eject templates, modify, compile — verify custom template used**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create a minimal project with `createMinimalProject()`
2. `runCLI(["eject", "templates"], projectDir)` -- ejects `agent.liquid` to `.claude-src/agents/_templates/`
3. Read the ejected `agent.liquid`, append a unique marker string (e.g., `<!-- E2E-CUSTOM-TEMPLATE-MARKER -->`)
4. Write the modified template back
5. `runCLI(["compile"], projectDir)` -- should use the custom template
6. Read compiled agent `.md` files -- verify the marker string appears in each

**Test 1b: Eject agent-partials, modify intro.md, compile — verify custom intro**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create a minimal project
2. `runCLI(["eject", "agent-partials"], projectDir)` -- ejects intro.md, workflow.md, etc. per agent
3. Modify `.claude-src/agents/web-developer/intro.md` to contain `"E2E-CUSTOM-INTRO-CONTENT"`
4. `runCLI(["compile"], projectDir)` -- should pick up the custom intro
5. Read `web-developer.md` -- verify it contains `"E2E-CUSTOM-INTRO-CONTENT"`

**Test 1c: Eject templates + have mixed local skills, compile — Liquid resolves correctly**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create a project with 2+ local skills
2. Eject templates
3. Modify the template to add a custom section
4. Compile
5. Verify all compiled agents contain the custom section AND include the correct skill references

### Key Assertions

- Ejected template file exists at `.claude-src/agents/_templates/agent.liquid`
- Compiled agent output contains the custom marker/content
- Compiled agent output still has valid YAML frontmatter (template modification didn't break structure)
- Other agents in the same compile also get the custom template (it's global, not per-agent)

### Edge Cases

- What if the user modifies the template to remove required Liquid variables (e.g., `{{ agent.name }}`)? Does compile fail gracefully or produce a broken agent?
- What if both `.claude-src/agents/_templates/` AND `.claude/templates/` exist? The resolution order says `.claude-src/` wins -- worth verifying.
- Template with syntax errors (malformed Liquid) -- does the error message point to the custom template, not the built-in one?
- Eject templates twice without --force: warns and skips (already tested in eject.e2e.test.ts)

### Open Questions

- Does `eject templates` copy `agent.liquid` to `.claude-src/agents/_templates/agent.liquid`? Or a different path? The `ejectAgentPartials` method in `eject.ts:241-305` computes `destDir` based on whether `templatesFlag` is true. Need to verify the exact output path.
- After ejecting agent-partials, do the agent subdirectories (e.g., `web-developer/intro.md`) get placed at a path that `readAgentFiles()` in `compiler.ts:124-165` can find? The `agentBaseDir` property on `AgentConfig` controls this.

---

## Gap 2: Custom Sub-Agents

### What's Being Tested

User-created agents placed in `.claude-src/agents/` with `metadata.yaml` + `intro.md` + `workflow.md`. The `loadProjectAgents()` function in `loader.ts:74-112` discovers these and merges them with built-in agents during compilation.

**Why it matters:** Custom agents are a power-user feature that lets users define their own agent personas with specific skill assignments. If the compile command doesn't discover and compile them, users lose their custom agent definitions.

### What Already Exists

- `commands/compile.e2e.test.ts` has a `createProjectWithCustomSkill()` test that exercises custom *skills* in the stack config, but no custom *agent* creation.
- `loader.test.ts` has unit tests for `loadProjectAgents()` but no E2E integration.

### Test Approach

**Test 2a: Create custom agent, compile, verify it appears in output**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create a minimal project
2. Manually create `.claude-src/agents/my-custom-agent/metadata.yaml` with `id: my-custom-agent`, `title`, `description`, `tools`, `domain`
3. Create `.claude-src/agents/my-custom-agent/intro.md` with custom content
4. Create `.claude-src/agents/my-custom-agent/workflow.md` with custom content
5. Update `config.ts` to include `agents: [{ name: "my-custom-agent", scope: "project" }]` and assign at least one skill to the custom agent in the stack
6. `runCLI(["compile"], projectDir)`
7. Verify `.claude/agents/my-custom-agent.md` exists with valid frontmatter and custom content

**Test 2b: Custom agent referencing both global and project-scoped skills**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create a dual-scope project with `createDualScopeProject()`
2. Add a custom agent in the project that references both the global skill and the project skill
3. Update config with the custom agent and its stack assignments
4. `runCLI(["compile"], projectDir, { env: { HOME: globalHome } })`
5. Verify the compiled custom agent references both skills

**Test 2c: Custom agent with same name as built-in agent — override behavior**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create a minimal project
2. Create `.claude-src/agents/web-developer/metadata.yaml` (overriding the built-in web-developer)
3. Create custom intro.md and workflow.md with distinctive content
4. Compile
5. Verify `web-developer.md` uses the custom content, not the built-in content

### Key Assertions

- Custom agent `.md` file appears in the agents output directory
- Custom agent has valid YAML frontmatter with `name: my-custom-agent`
- Custom agent body contains content from the custom `intro.md` and `workflow.md`
- Custom agent's skill references match the stack config assignments
- When overriding a built-in agent, the custom version takes precedence

### Edge Cases

- Custom agent with missing `workflow.md` (required file) -- does compile fail with a useful error?
- Custom agent with `metadata.yaml` that has an invalid `id` field -- does Zod schema reject it?
- Custom agent in `.claude-src/agents/` alongside ejected agent-partials in the same directory -- do they collide?
- Two custom agents referencing the same skill -- skill appears in both compiled outputs correctly?

### Open Questions

- Does `getAgentDefinitions()` merge project agents from `loadProjectAgents()` with built-in agents from `loadAllAgents()`? Which takes precedence on name collision? Looking at `agent-recompiler.ts:172`, `loadProjectAgents(projectDir)` is called separately. Need to trace the merge logic to confirm override behavior.
- What format does `metadata.yaml` need for custom agents? The `agentYamlConfigSchema` in `schemas.ts` validates the structure -- need to verify the minimum viable fields.
- Does the config need a stack entry for the custom agent, or does the compile command discover it automatically from the `.claude-src/agents/` directory?

---

## Gap 3: Edit Wizard in Local Mode

### What's Being Tested

The edit wizard flow for local-mode installations: adding a new skill during edit (does a local copy happen?), removing a skill during edit (are local files removed?).

**Why it matters:** The edit-wizard-plugin.e2e.test.ts exercises add/remove/mode-migration for plugin mode, but there's no equivalent for local mode. Local mode is the default and most common path.

### What Already Exists

- `interactive/edit-wizard.e2e.test.ts`: Tests for the edit wizard exist but focus on basic rendering (no installation error, navigation, build step display, cancellation). They don't test adding or removing a skill during edit.
- `interactive/edit-wizard-plugin.e2e.test.ts`: Covers add skill -> plugin install, remove skill -> plugin uninstall, mode migration. All in plugin mode.

### Test Approach

**Test 3a: Add a skill during local edit**
- `TerminalSession` (interactive)
- Does NOT need Claude CLI

Steps:
1. Create an editable project with 1 skill (`web-framework-react`) using `createEditableProject()`
2. Start edit wizard with `--source` pointing to E2E source (which has more skills)
3. Navigate to the build step, arrow down to an unselected category/skill, press Space to select it
4. Navigate through Sources -> Agents -> Confirm
5. Verify: new skill directory appears in `.claude/skills/` (local copy)
6. Verify: config.ts updated with the new skill
7. Verify: compiled agents updated (if the new skill is assigned to an agent)

**Test 3b: Remove a skill during local edit**
- `TerminalSession` (interactive)
- Does NOT need Claude CLI

Steps:
1. Create an editable project with 2+ skills (e.g., `web-framework-react` + `web-testing-vitest`)
2. Use the "unresolvable skill" trick: include a skill in config that doesn't exist in the E2E source
3. The wizard drops the unresolvable skill automatically, creating a "removed" change
4. Navigate through the wizard
5. Verify: the removed skill's directory is gone from `.claude/skills/`
6. Verify: config.ts no longer references the removed skill

### Key Assertions

- New skill files copied to `.claude/skills/<skillId>/SKILL.md`
- New skill appears in config.ts skills array
- Removed skill files deleted from `.claude/skills/<skillId>/`
- Removed skill gone from config.ts
- Agents recompiled after edit (frontmatter updated)
- Exit code 0

### Edge Cases

- Adding a skill that is in a different domain than the existing installation -- does the domain get added to the config?
- Removing the last skill in a domain -- does the domain get removed from config?
- Edit without making changes in local mode -- does it early-exit or recompile? (`edit.tsx:242-246` checks for changes)
- What happens to the `metadata.yaml` of removed skills? Is `forkedFrom` metadata preserved or cleaned up?

### Open Questions

- In local mode, does the edit command copy new skill files from the `--source` directory to `.claude/skills/`? Or does it assume they're already there? Need to trace the edit flow: `edit.tsx` -> `installLocal()` or `skill-copier.ts`.
- Does removing a skill in the wizard delete the local files, or only update the config? The uninstall logic uses `forkedFrom` metadata matching, but the edit flow may have a different removal mechanism.

---

## Gap 4: Init Wizard in Local Mode

### What's Being Tested

Interactive wizard behaviors during `cc init` in local mode that aren't covered by existing init tests: domain deselection, individual skill deselection, agent deselection, and scope toggling via the S hotkey.

**Why it matters:** The init wizard tests cover stack selection, scratch mode, navigation, source selection, plugin mode, and existing installation prompts. But several specific user interactions have no coverage.

### What Already Exists

- `interactive/init-wizard-stack.e2e.test.ts`: Stack selection, domain selection (accepting defaults)
- `interactive/init-wizard-scratch.e2e.test.ts`: From-scratch wizard flow
- `interactive/init-wizard-navigation.e2e.test.ts`: Step navigation, back button
- `interactive/init-wizard-sources.e2e.test.ts`: Source selection step
- `interactive/init-wizard-ui.e2e.test.ts`: UI rendering, help overlay
- `interactive/init-wizard-flags.e2e.test.ts`: --source, --yes flags
- `interactive/init-wizard-existing.e2e.test.ts`: Existing installation prompts
- `interactive/init-wizard-plugin.e2e.test.ts`: Plugin mode init

None of these test deselecting a domain, deselecting an individual skill, deselecting an agent, or using the S hotkey for scope toggling.

### Test Approach

**Test 4a: Domain deselection**
- `TerminalSession` (interactive)
- Does NOT need Claude CLI

Steps:
1. Start init wizard with `--source` to E2E source
2. Select stack
3. On "Select domains to configure" step, all domains are pre-selected by the stack
4. Arrow down to a domain (e.g., API), press Space to deselect
5. Continue through wizard
6. Verify: config.ts does NOT include skills from the deselected domain
7. Verify: agents associated only with the deselected domain are not compiled

**Test 4b: Skill deselection within a domain**
- `TerminalSession` (interactive)
- Does NOT need Claude CLI

Steps:
1. Start init wizard, select stack, accept domains
2. On build step for a domain, press Space on a pre-selected skill to deselect it
3. Continue through wizard
4. Verify: deselected skill not in config, not copied to `.claude/skills/`

**Test 4c: Agent deselection**
- `TerminalSession` (interactive)
- Does NOT need Claude CLI

Steps:
1. Start init wizard, select stack, accept domains, accept skills
2. On agents step, press Space on a pre-selected agent to deselect it
3. Continue to confirm and install
4. Verify: deselected agent not compiled to `.claude/agents/`
5. Verify: deselected agent not in config.ts

**Test 4d: Scope toggling via S hotkey during init**
- `TerminalSession` (interactive)
- Does NOT need Claude CLI

Steps:
1. Start init wizard, select stack, accept domains
2. On build step, focus on a skill, press `s` to toggle scope
3. Verify: the toggled skill appears with different scope indicator
4. Continue through wizard
5. Verify: config.ts has the skill with the toggled scope

### Key Assertions

- Domain deselection: config.domains excludes deselected domain, no skills from that domain
- Skill deselection: specific skill absent from config and filesystem
- Agent deselection: specific agent `.md` file absent from agents directory
- Scope toggle: skill in config has `scope: "global"` or `scope: "project"` as toggled

### Edge Cases

- Deselecting ALL domains -- does the wizard prevent this (nothing to install)?
- Deselecting all skills within a domain but keeping the domain -- empty domain in config?
- Deselecting all agents -- does the wizard prevent this?
- S hotkey on a skill that's the only skill for an agent -- scope change affects agent routing

### Open Questions

- What is the exact keystroke sequence for domain deselection? Are domains checkboxes (Space toggles)?
- On the build step, how many arrow-down presses reach a specific skill? The build step shows categories vertically with skill tags horizontally.
- Does the S hotkey work on the build step during init, or only during edit? Need to check wizard components.

---

## Gap 5: Re-Edit / Multiple Edit Cycles

### What's Being Tested

Running `cc edit` multiple times on the same installation to verify config stability and idempotency. `mergeWithExistingConfig()` is called each time, and accumulated state could corrupt the config.

**Why it matters:** Real users run edit multiple times. If metadata accumulates, duplicates, or gets lost across edits, the installation degrades silently.

### What Already Exists

- No existing test runs edit more than once.
- `bugs/edit-skill-accumulation.e2e.test.ts` tests that project config doesn't accumulate global skills, but this is a single-edit test with manual setup, not a multi-edit lifecycle.

### Test Approach

**Test 5a: Init -> Edit -> Edit -> verify no config corruption**
- `TerminalSession` (interactive)
- Does NOT need Claude CLI

Steps:
1. Init with E2E source: `TerminalSession(["init", "--source", sourceDir], projectDir)`
2. Navigate wizard, complete installation
3. Read config.ts, note skill count and content
4. First edit: `TerminalSession(["edit", "--source", sourceDir], projectDir)`
5. Navigate through without changes, complete
6. Read config.ts again -- verify identical to post-init state
7. Second edit: `TerminalSession(["edit", "--source", sourceDir], projectDir)`
8. Navigate through without changes, complete
9. Read config.ts again -- verify identical to post-init state (no accumulation)
10. Verify: no duplicate entries in skills array, agents array, domains array

**Test 5b: Init -> Edit (add skill) -> Edit (remove that skill) -> verify clean state**
- `TerminalSession` (interactive)
- Does NOT need Claude CLI

Steps:
1. Init with limited skills
2. First edit: add a skill
3. Verify skill present in config and filesystem
4. Second edit: remove that skill (use unresolvable trick)
5. Verify skill gone from config and filesystem
6. Verify original state is restored (no residual metadata)

### Key Assertions

- Config.ts content is identical after no-change edits (byte-level comparison or structural comparison)
- No duplicate entries in skills, agents, or domains arrays
- Skill count doesn't grow after no-change edits
- Agent files don't accumulate (same set of agents after each edit)

### Edge Cases

- Does the config format change between edits? (e.g., JSON formatting, key ordering). If so, byte-level comparison fails but structural comparison should pass.
- Domain array -- per Bug C in `e2e-full-lifecycle-test-design.md`, domains may accumulate across edits via `splitConfigByScope()`. This is a known issue (deferred). Document as `.todo` or skip.
- Agent content after re-edit -- does recompilation produce identical output, or do timestamps/hashes change?
- What if the E2E source changes between edits? (Not relevant for E2E tests since source is fixed, but worth noting.)

### Open Questions

- Does the edit command always rewrite config.ts even if nothing changed? Or does it skip the write? If it always rewrites, the format might differ (different serialization), which would make byte-level comparison unreliable.
- `mergeWithExistingConfig()` in `config-merger.ts` -- does it deduplicate skills and agents? Or does it union-merge, producing duplicates if the same skill appears in both the existing config and the wizard result?

---

## Gap 6: Compile Command (standalone)

### What's Being Tested

The `cc compile` command in scenarios not already covered by the 16 tests in `compile.e2e.test.ts`: compile with manually-edited config, compile after adding custom agents, compile with ejected templates, and compile error handling for edge cases.

**Why it matters:** The existing compile tests use helper-generated configs. Real users may manually edit `config.ts` (adding custom categories, changing stack assignments). The compile command must handle these gracefully.

### What Already Exists

- `commands/compile.e2e.test.ts`: Basic compile, multiple skills, custom skills, verbose, --source, --agent-source, global fallback, error handling (no skills, missing dir)
- `lifecycle/local-lifecycle.e2e.test.ts` Phase 2: Compile after init

### Test Approach

**Test 6a: Compile with manually-edited config (custom stack assignments)**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create a project with a valid config
2. Manually edit config.ts to add a custom category in the stack mapping
3. Create a local skill matching that custom category
4. Compile
5. Verify the custom skill appears in the correct agent's compiled output

**Test 6b: Compile after adding custom agent to .claude-src/agents/**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

(Same as Gap 2, Test 2a -- these overlap. This gap just notes the compile-specific angle.)

**Test 6c: Compile with ejected templates**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

(Same as Gap 1, Test 1a -- overlap.)

**Test 6d: Compile with broken YAML in metadata**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create a minimal project
2. Replace a skill's `metadata.yaml` with invalid YAML (e.g., unbalanced quotes)
3. Compile
4. Verify: compile either skips the broken skill with a warning or fails with a useful error message
5. Verify: other valid skills still compile correctly (graceful degradation)

**Test 6e: Compile with missing skill directory referenced in config**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create a config that references a skill ID
2. Do NOT create the corresponding skill directory
3. Compile
4. Verify: useful error or warning about missing skill

### Key Assertions

- Custom stack assignments route skills to the correct agents
- Broken metadata produces warnings, not crashes
- Missing skill directories produce actionable error messages
- Compile is resilient to partial failures (compiles what it can)

### Edge Cases

- Config with `stack: {}` (empty stack) -- compile should handle gracefully
- Config with agents referencing skills that don't exist on disk
- Config with duplicate skill entries
- Very large number of skills (performance concern, probably not worth E2E testing)

### Open Questions

- When the compile command encounters a skill referenced in the config but missing on disk, does it fail the entire compile or just skip that skill? The current code in `compile.ts` calls `discoverAllSkills()` which scans the filesystem, not the config. So missing-on-disk skills are simply not discovered. The question is whether the agent resolver warns about unresolved skill references in the stack.

---

## Gap 7: Eject Command (Integration)

### What's Being Tested

The eject command's integration with the compile pipeline. The existing eject tests verify that files are created, but not that the ejected content is usable by compile.

**Why it matters:** Ejecting is only useful if the ejected content integrates with the compilation pipeline. Without this integration test, a regression in the template resolution path would go undetected.

### What Already Exists

- `commands/eject.e2e.test.ts`: 12 tests covering flags, output, --force, skills, all, help, errors
- These tests verify FILES exist but never verify CONTENT is used

### Test Approach

**Test 7a: Eject templates -> verify file locations match Liquid engine expectations**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create a temp directory
2. `runCLI(["eject", "templates"], tempDir)`
3. Verify: `agent.liquid` exists at the path that `createLiquidEngine()` checks:
   - `.claude-src/agents/_templates/agent.liquid`
4. This is a structural assertion, not a content assertion -- it verifies the eject output path aligns with the Liquid engine's template root.

**Test 7b: Eject agent-partials -> verify file structure matches agent compilation expectations**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. `runCLI(["eject", "agent-partials"], tempDir)`
2. Verify directory structure contains agent subdirectories (e.g., `web-developer/intro.md`, `web-developer/workflow.md`)
3. Verify the structure matches what `readAgentFiles()` in `compiler.ts:124-165` expects

**Test 7c: Eject -> compile -> verify ejected content appears in output**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

(This is essentially Gap 1's tests. Grouping them here for completeness.)

**Test 7d: No clobbering of existing customizations**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Eject templates to `.claude-src/agents/_templates/`
2. Modify `agent.liquid` with custom content
3. Eject templates again WITHOUT --force
4. Verify: warning about existing templates
5. Read `agent.liquid` -- verify custom content preserved (not overwritten)
6. Eject templates again WITH --force
7. Read `agent.liquid` -- verify content is now the built-in version (overwritten)

### Key Assertions

- Ejected template path matches `createLiquidEngine()` resolution path
- Ejected agent-partials structure matches `readAgentFiles()` expectations
- Without --force, existing customizations are preserved
- With --force, customizations are overwritten with fresh built-in content

### Edge Cases

- Eject to a custom `--output` directory, then compile -- does compile find the ejected content? Answer: No, compile only looks at `.claude-src/agents/_templates/`. Custom output is for user inspection, not compilation.
- Eject `agent-partials` when templates already exist in the directory -- current code has special handling for this (`skipTemplates` logic in `eject.ts:281-295`)
- Eject `all` -- does it correctly eject partials, templates, AND skills without conflicts?

### Open Questions

- The eject command copies from `PROJECT_ROOT/agents/` (for partials) and `PROJECT_ROOT/templates/` (for templates). Are these paths stable, or do they change based on the source flag? Looking at `eject.ts:247-249`, partials always come from the CLI's own `DIRS.agents` and `DIRS.templates`, not from the --source. This is correct behavior -- agent definitions are CLI-bundled, not source-dependent. But skills are source-dependent. Document this distinction.

---

## Gap 8: Build Custom Agent Plugins

### What's Being Tested

Building custom agents into plugin packages via `compileAgentPlugin()`. The E2E source includes agent definitions that get compiled into plugins during `build plugins`, but there's no test for user-defined custom agents being built into plugins.

**Why it matters:** Users who create custom agents may want to distribute them as plugins. If the plugin build pipeline doesn't handle custom agent structures, distribution fails.

### What Already Exists

- `commands/plugin-build.e2e.test.ts`: Tests `build plugins` and `build marketplace` with the standard E2E source agents.
- No test uses a custom agent (one defined in `.claude-src/agents/` by the user).

### Test Approach

**Test 8a: Build plugins with a custom agent in the source**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create an E2E source with `createE2ESource()`
2. Add a custom agent directory to the source: `<sourceDir>/src/agents/my-custom-agent/metadata.yaml` + `intro.md` + `workflow.md`
3. `runCLI(["build", "plugins"], sourceDir)`
4. Verify: a plugin directory is produced that includes the custom agent
5. `runCLI(["build", "marketplace", "--name", "test-mp"], sourceDir)`
6. Verify: marketplace.json references the custom agent

### Key Assertions

- Plugin directory contains the custom agent's compiled output
- Marketplace includes the custom agent
- Build succeeds (exit code 0)

### Edge Cases

- Custom agent with no skills assigned -- does the plugin build include an empty agent?
- Custom agent that references skills not in the source -- build should warn or fail
- Custom agent with the same name as a built-in agent -- which one gets built?

### Open Questions

- Does `build plugins` compile individual skill plugins (one per skill), or does it also build agent plugins? Looking at `createE2EPluginSource()`, it calls `build plugins` which produces `dist/plugins/`. But agents are compiled separately via `compileAllAgents()`. Need to check whether the `build` command has a separate `build agents` subcommand, or if agent compilation is part of the init/compile flow only.
- If `build plugins` only builds skill plugins (not agent plugins), then this gap may not apply -- custom agents would be compiled at init/compile time, not at build time. Need to verify.

---

## Gap 9: Full Lifecycle with Source Switching Mid-Stream

### What's Being Tested

The complete flow: init with local mode -> edit to switch some skills to plugin mode -> compile -> verify agents reference both source types correctly. This tests the mixed-source coexistence that `dual-scope-edit.e2e.test.ts` Test 8 partially covers, but in a full lifecycle rather than a pre-configured setup.

**Why it matters:** Users may start with local skills and gradually migrate to plugins, or vice versa. The system must handle a mix of source types within a single installation.

### What Already Exists

- `lifecycle/dual-scope-edit.e2e.test.ts` Test 8 (mixed coexistence) and Test 9 (mixed agent compile): These set up a dual-scope scenario and test mixed sources, but both are `it.fails`.
- `interactive/edit-wizard-plugin.e2e.test.ts` P-EDIT-3/4: Tests mode migration (all local -> all plugin, all plugin -> all local) but not partial migration.

### Test Approach

**Test 9a: Init local -> edit to switch ONE skill to plugin -> compile -> verify**
- `TerminalSession` (interactive)
- Needs Claude CLI (`skipIf(!claudeAvailable)`)

Steps:
1. Init in local mode with E2E source (all skills local)
2. Edit: navigate to Sources step, enter customize view, select ONE specific skill, switch it to plugin mode, leave others as local
3. Complete the edit
4. Verify: the switched skill is now plugin-sourced in config, local files removed
5. Verify: other skills remain local with files on disk
6. `runCLI(["compile"], projectDir)` -- standalone compile
7. Verify: compiled agents include both local and plugin skills correctly

**Test 9b: Init plugin -> edit to switch ONE skill to local -> compile -> verify**
- `TerminalSession` (interactive)
- Needs Claude CLI (`skipIf(!claudeAvailable)`)

Steps:
1. Init in plugin mode with E2E plugin source
2. Edit: navigate to Sources, customize, switch ONE skill to local
3. Complete
4. Verify: mixed state in config (some local, some plugin)
5. Compile
6. Verify: agents include all skills regardless of source type

### Key Assertions

- Config has mixed `source` values: some skills "local", others the marketplace name
- Local skills have files on disk, plugin skills do not (or have different file structure)
- Compile succeeds with mixed sources
- Compiled agents reference all assigned skills regardless of source mode

### Edge Cases

- What if the plugin install fails for the switched skill during edit? Does the edit roll back, or leave a half-migrated state?
- What if the local skill files are corrupted after partial migration?
- Compile after a failed partial migration -- does it handle missing skills gracefully?

### Open Questions

- During the Sources customize view in edit, can we switch individual skills, or only all-at-once with `l`/`p` hotkeys? Looking at `edit-wizard-plugin.e2e.test.ts`, the tests use `l` and `p` for bulk switching. But the customize view (step-sources.tsx) should support per-skill selection via arrow keys + Space.
- Does per-skill source switching actually trigger individual `claude plugin install` / `claude plugin uninstall` commands? Or does it batch them? This affects timing and error handling in E2E tests.

---

## Gap 10: Uninstall with Custom Agents / Ejected Templates

### What's Being Tested

What happens to user-authored files (custom agents, ejected templates) when `cc uninstall` is run. Should user content be preserved or removed?

**Why it matters:** Users invest time in customizing agents and templates. An uninstall that deletes their custom work would be destructive and unrecoverable.

### What Already Exists

- `commands/uninstall.e2e.test.ts`: Tests "preserve agents not listed in config" -- a custom agent file `my-custom-agent.md` in the agents directory is preserved because it's not in `config.agents`. Also tests "skip user-created skills without forkedFrom metadata".
- `interactive/uninstall.e2e.test.ts`: Interactive uninstall confirmation flow tests.

### Test Approach

**Test 10a: Uninstall preserves ejected templates**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create an editable project
2. Run `eject templates` to create `.claude-src/agents/_templates/`
3. Run `uninstall --yes`
4. Verify: `.claude-src/agents/_templates/` still exists (templates are in `.claude-src/`, which is preserved without `--all`)
5. Run `uninstall --all --yes`
6. Verify: `.claude-src/` is removed entirely (including templates)

**Test 10b: Uninstall preserves custom agents in .claude-src/agents/**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create an editable project
2. Create a custom agent at `.claude-src/agents/my-custom-agent/metadata.yaml` + partials
3. Run `uninstall --yes`
4. Verify: `.claude-src/agents/my-custom-agent/` still exists (it's in `.claude-src/`, preserved without `--all`)
5. Verify: compiled agent at `.claude/agents/my-custom-agent.md` is NOT preserved (it's a compiled artifact)

Wait -- looking at the uninstall code more carefully:

The `removeMatchingAgents()` method at `uninstall.tsx:394-420` only removes agents whose names appear in `target.configuredAgents` (derived from `config.agents`). If the custom agent IS in the config, its compiled `.md` gets removed. If it's NOT in the config (user just created files in `.claude-src/agents/` but didn't add to config), its compiled `.md` is preserved.

**Test 10c: Uninstall with custom agent in config vs not in config**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create a project with config that has `agents: [{ name: "web-developer" }, { name: "my-custom-agent" }]`
2. Create compiled agent files for both in `.claude/agents/`
3. Also create an agent file NOT in config: `extra-agent.md`
4. Run `uninstall --yes`
5. Verify: `web-developer.md` removed (in config)
6. Verify: `my-custom-agent.md` removed (in config)
7. Verify: `extra-agent.md` preserved (not in config)

**Test 10d: Uninstall preserves .claude/ directory when non-CLI content exists**
- `runCLI` (non-interactive)
- Does NOT need Claude CLI

Steps:
1. Create an editable project
2. Add a file to `.claude/` that's not managed by the CLI (e.g., `settings.json`, a custom directory)
3. Run `uninstall --yes`
4. Verify: `.claude/` directory still exists (contains user content)
5. Verify: `.claude/skills/` removed, `.claude/agents/` removed
6. But `.claude/` itself preserved because it's not empty (has settings.json)

### Key Assertions

- Ejected templates in `.claude-src/` preserved by `uninstall --yes`, removed by `uninstall --all --yes`
- Custom agents in `.claude-src/` preserved by `uninstall --yes`, removed by `uninstall --all --yes`
- Compiled agents in `.claude/agents/` removed if in config, preserved if not in config
- `.claude/` directory preserved if it contains non-CLI content
- Skills without `forkedFrom` metadata are skipped (already tested)

### Edge Cases

- Uninstall after eject + compile: the `.claude-src/agents/_templates/` directory exists alongside compiled agents. The uninstall removes compiled agents but should NOT touch the template directory (it's in `.claude-src/`, not `.claude/`).
- Uninstall with ejected agent-partials that were then modified: `.claude-src/agents/web-developer/intro.md` (ejected + customized). If `uninstall --all` is used, the entire `.claude-src/` is removed. The user loses their customizations. Is this the intended behavior? Should there be a warning?
- Uninstall after partial source migration (some local, some plugin): does it clean up both plugin registrations AND local files?

### Open Questions

- The `removeMatchingSkills()` logic uses `forkedFrom` metadata to determine if a skill was CLI-installed. If a user manually creates a skill AND gives it `forkedFrom` metadata (unlikely but possible), it would be treated as CLI-managed and removed. Is this acceptable?
- The uninstall command uses `configuredSources` to match skills. If the config's `source` field was changed by the user between install and uninstall, would some skills be "orphaned" (not matching any configured source, so not removed)?
- Does `uninstall --all` warn about losing ejected templates and custom agents in `.claude-src/`? Looking at the code, it lists what will be removed but doesn't distinguish between CLI-generated config and user-authored content in `.claude-src/`.

---

## Priority Assessment

| Gap | Impact | Complexity | Existing Coverage | Priority |
|-----|--------|------------|-------------------|----------|
| 1: Template Ejection + Compile | High (core customization) | Medium (runCLI) | Low (eject tested, not integration) | **High** |
| 2: Custom Sub-Agents | High (power-user feature) | Medium (runCLI) | None | **High** |
| 3: Edit Wizard Local | High (default mode) | High (TerminalSession) | Partial (basic flow only) | **High** |
| 4: Init Wizard Local | Medium (specific interactions) | High (TerminalSession) | Partial (happy paths only) | **Medium** |
| 5: Re-Edit / Multi-Cycle | High (config corruption risk) | High (TerminalSession x3) | None | **High** |
| 6: Compile Standalone | Medium (edge cases) | Low (runCLI) | Good (16 tests) | **Low** |
| 7: Eject Integration | Medium (structural) | Low (runCLI) | Good (12 tests) | **Medium** |
| 8: Build Custom Agent Plugins | Low (may not apply) | Medium | Partial (standard agents) | **Low** |
| 9: Source Switching Lifecycle | High (mixed mode) | High (TerminalSession + Claude CLI) | Partial (dual-scope has it.fails) | **Medium** |
| 10: Uninstall Preservation | Medium (user trust) | Low (runCLI) | Good (preservation tested) | **Medium** |

### Recommended Implementation Order

1. **Gap 1** (Template Ejection + Compile) -- runCLI-only, high value, fills the biggest functional gap
2. **Gap 2** (Custom Sub-Agents) -- runCLI-only, high value, new feature area with zero coverage
3. **Gap 5** (Re-Edit Multi-Cycle) -- critical for config stability, catches accumulation bugs
4. **Gap 3** (Edit Wizard Local) -- fills the parity gap between local and plugin edit testing
5. **Gap 10** (Uninstall Preservation) -- quick wins, mostly runCLI
6. **Gap 7** (Eject Integration) -- structural validation, runCLI
7. **Gap 4** (Init Wizard Local) -- specific interactions, good to have
8. **Gap 9** (Source Switching) -- depends on Claude CLI, dual-scope-edit already has framework
9. **Gap 6** (Compile Standalone) -- incremental over existing coverage
10. **Gap 8** (Build Custom Agent Plugins) -- may not apply, needs investigation
