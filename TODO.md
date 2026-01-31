# Claude Collective CLI - Implementation Plan

## Executive Summary

**Current State:** 1160 tests passing. Phase 1-4 Complete. Phase 5 (oclif + Ink Migration) Ready.

**Next Steps:**

1. Begin Phase 5 migration with cli-migrator subagent
2. Start with Phase 0 (Preparation) and Phase 1 (Core Infrastructure)
3. Migrate simple commands first to establish patterns

For completed tasks, see [TODO-completed.md](./TODO-completed.md).

---

## Ongoing Reminders

### R1: Use cli-migrator Subagent for Migration

**ALL migration work MUST be done using the cli-migrator subagent.** This agent has the oclif + Ink and Commander.js + @clack/prompts skills preloaded and understands the conversion patterns.

Invoke via: `Task tool with subagent_type="general-purpose"` and prompt it to act as the CLI Migration Specialist.

### R2: Do NOT Commit Until Migration Complete

**Keep all changes uncommitted** until the entire migration is complete and @clack/prompts has been uninstalled. This is a full migration - we will commit everything at the end.

### R3: No Backwards Compatibility

**This is a FULL migration.** We are NOT maintaining backwards compatibility with the old Commander.js + @clack/prompts implementation. The acceptance criteria for "done" is that the CLI **100% uses oclif + Ink** with zero remnants of the old ecosystem.

### R4: Test Management During Migration

Try to keep tests passing throughout migration. Refactor and update tests as commands are migrated. If tests MUST be temporarily disabled to make progress, that is acceptable, but prefer updating tests to match new patterns.

### R5: Write Tests for New Features

After completing a task, ask yourself: "Can tests be written for this new functionality?"
If yes, write tests. Test-driven development is preferred when feasible.

### R6: Move Completed Tasks to Archive

Once your task is done, move it to [TODO-completed.md](./TODO-completed.md). Keep TODO.md lean by archiving all completed tasks immediately.

---

## Planning Documents

- [docs/migration-research.md](./docs/migration-research.md) - Current architecture analysis
- [docs/oclif-ink-ecosystem.md](./docs/oclif-ink-ecosystem.md) - Ecosystem libraries research
- [docs/migration-plan.md](./docs/migration-plan.md) - Detailed migration plan with phases

---

## Phase 5: oclif + Ink Migration

**Goal:** Migrate from Commander.js + @clack/prompts to oclif + Ink for better scalability and maintainability.

**Estimated Duration:** 4-5 weeks

**Acceptance Criteria:** CLI runs 100% on oclif + Ink. No Commander.js, @clack/prompts, or picocolors dependencies remain.

### Phase 5.0: Preparation (1-2 days)

**S | P5-0-1 | Add new dependencies (oclif, ink, zustand, etc.)**
Add @oclif/core, @oclif/plugin-\*, ink, react, @inkjs/ui, zustand, conf, execa to package.json

**S | P5-0-2 | Update TypeScript config for JSX** (depends: P5-0-1)
Add jsx: "react-jsx" and jsxImportSource: "react" to tsconfig.json

**S | P5-0-3 | Update tsup build config for cli-v2 entry** (depends: P5-0-1)
Add src/cli-v2/index.ts and commands/\*_/_.ts to entry points

**S | P5-0-4 | Add oclif configuration to package.json** (depends: P5-0-1)
Add oclif section with bin, dirname, commands strategy, plugins, hooks

**S | P5-0-5 | Create cli-v2 directory structure** (depends: P5-0-4)
Create src/cli-v2/ with commands/, components/, stores/, hooks/ directories

### Phase 5.1: Core Infrastructure (2-3 days)

**M | P5-1-1 | Create BaseCommand class with shared flags** (depends: P5-0-5)
Extend @oclif/core Command with --dry-run flag and shared error handling using EXIT_CODES

**M | P5-1-2 | Create oclif entry point (index.ts, bin files)** (depends: P5-1-1)
Create src/cli-v2/index.ts, bin/run.js, bin/dev.js with proper oclif bootstrap

**S | P5-1-3 | Create init hook for config loading** (depends: P5-1-2)
Create src/cli-v2/hooks/init.ts to load global/project config before command execution

**M | P5-1-4 | Verify lib/ utilities work with oclif imports** (depends: P5-1-2)
Test that all src/cli/lib/ modules are importable from cli-v2 commands without path issues

### Phase 5.2: Simple Commands (3-4 days)

**S | P5-2-1 | Migrate `list` command** (depends: P5-1-4)
Simplest command (26 lines). Establishes the pattern for non-interactive commands using this.log()

**S | P5-2-2 | Migrate `version` command** (depends: P5-2-1)
Simple version display

**S | P5-2-3 | Migrate `validate` command** (depends: P5-2-1)
Validation output

**M | P5-2-4 | Migrate `search` command** (depends: P5-2-1)
Test @oclif/table for table output

**S | P5-2-5 | Migrate `info` command** (depends: P5-2-1)
Detailed skill/agent information display

**S | P5-2-6 | Migrate `diff` command** (depends: P5-2-1)
Colored diff output

**S | P5-2-7 | Migrate `outdated` command** (depends: P5-2-1)
Table output for outdated skills

**M | P5-2-8 | Migrate `doctor` command** (depends: P5-2-1)
Multiple diagnostic checks with status output

**M | P5-2-9 | Migrate `config` topic (7 subcommands)** (depends: P5-2-1)
Create cli-v2/commands/config/ directory with show.ts, get.ts, set.ts, unset.ts, set-project.ts, unset-project.ts, path.ts

**M | P5-2-10 | Migrate `compile` command** (depends: P5-2-1)
No interactive prompts, spinner output only

**S | P5-2-11 | Migrate `eject` command** (depends: P5-2-1)
Simple file operations

**S | P5-2-12 | Migrate `new skill` command** (depends: P5-2-1)
Scaffold creation only

### Phase 5.3: Interactive Components (3-4 days)

**M | P5-3-1 | Create Zustand wizard store** (depends: P5-2-1)
Migrate WizardState from wizard.ts to Zustand store with step, selectedSkills, history, actions

**M | P5-3-2 | Create common Ink components (Spinner, Alert, Confirm)** (depends: P5-3-1)
Create src/cli-v2/components/common/ with wrapper components using @inkjs/ui

**M | P5-3-3 | Create SelectionHeader component** (depends: P5-3-2)
Migrate renderSelectionsHeader() to Ink component showing selected skills grouped by category

**S | P5-3-4 | Set up @inkjs/ui theme** (depends: P5-3-2)
Create theme matching existing picocolors styling (cyan focus, green success, etc.)

### Phase 5.4: Wizard Migration (5-7 days)

**L | P5-4-1 | Create wizard container component** (depends: P5-3-4)
Main Wizard component with step switching, ESC handling, ThemeProvider wrapper

**M | P5-4-2 | Migrate step-approach component** (depends: P5-4-1)
Approach selection with Expert Mode and Install Mode toggles

**M | P5-4-3 | Migrate step-stack component** (depends: P5-4-1)
Pre-built stack selection with descriptions

**M | P5-4-4 | Migrate step-category component** (depends: P5-4-1)
Top-level category browser with unvisited count

**L | P5-4-5 | Migrate step-subcategory component (includes skill selection)** (depends: P5-4-1)
Subcategory browser with inline skill selection (matching current nested loop pattern)

**M | P5-4-6 | Migrate step-confirm component** (depends: P5-4-1)
Final confirmation with validation errors/warnings display

**M | P5-4-7 | Create multi-column skill layout** (depends: P5-4-5)
Use Ink Flexbox for responsive multi-column skill display (1/2/3 columns based on terminal width)

**M | P5-4-8 | Create horizontal tab navigation** (depends: P5-4-1)
Display wizard steps as horizontal tabs showing progress

**M | P5-4-9 | Create persistent search field** (depends: P5-4-5)
Always-visible search input for filtering skills. Note: may need ink-text-input for real-time filtering

**M | P5-4-10 | Create category skills table** (depends: P5-4-5)
Multi-column table view with web/api/cli categories as columns, skills as rows

**L | P5-4-11 | Migrate `init` command to use Ink wizard** (depends: P5-4-6)
Full init flow: source loading, wizard render with waitUntilExit(), installation logic

**L | P5-4-12 | Migrate `edit` command to use Ink wizard** (depends: P5-4-11)
Edit flow with initialSkills passed to wizard

### Phase 5.5: Remaining Interactive Commands (2-3 days)

**M | P5-5-1 | Migrate `update` command (has confirm)** (depends: P5-3-2)
Update with confirmation dialog

**M | P5-5-2 | Migrate `uninstall` command (has confirm)** (depends: P5-3-2)
Uninstall with confirmation dialog

**M | P5-5-3 | Migrate `new agent` command (has text input)** (depends: P5-3-2)
Agent creation with text input for purpose field

**M | P5-5-4 | Migrate `build:stack` command (has select)** (depends: P5-3-2)
Stack selection with @inkjs/ui Select

**S | P5-5-5 | Migrate `build:plugins` command** (depends: P5-2-1)
Non-interactive build

**S | P5-5-6 | Migrate `build:marketplace` command** (depends: P5-2-1)
Non-interactive marketplace generation

### Phase 5.6: Polish and Testing (3-4 days)

**M | P5-6-1 | Add @oclif/test command tests** (depends: P5-5-6)
Add runCommand() tests for migrated commands

**M | P5-6-2 | Add ink-testing-library component tests** (depends: P5-4-12)
Add render() tests for wizard components with keyboard simulation

**S | P5-6-3 | Update vitest config for new test patterns** (depends: P5-6-1)
Configure vitest for tsx files and @oclif/test compatibility

**M | P5-6-4 | Cross-platform terminal testing** (depends: P5-4-12)
Test on macOS, Linux, Windows terminals, and CI environments

**S | P5-6-5 | Performance validation (<300ms startup)** (depends: P5-5-6)
Measure and validate startup time is within acceptable range

### Phase 5.7: Cleanup (1-2 days)

**S | P5-7-1 | Remove @clack/prompts dependency** (depends: P5-6-5)
Remove from package.json and verify no imports remain

**S | P5-7-2 | Remove commander dependency** (depends: P5-6-5)
Remove from package.json and verify no imports remain

**S | P5-7-3 | Remove picocolors dependency** (depends: P5-6-5)
Remove from package.json (replaced by Ink Text props)

**S | P5-7-4 | Delete old src/cli/commands/ files** (depends: P5-7-1)
Remove all migrated command files from old location

**S | P5-7-5 | Delete src/cli/lib/wizard.ts** (depends: P5-7-1)
Remove old wizard (replaced by Ink components and Zustand store)

**M | P5-7-6 | Move lib/ and utils/ to cli-v2** (depends: P5-7-4)
Relocate shared utilities and update import paths

**S | P5-7-7 | Update package.json entry points** (depends: P5-7-6)
Change main and bin to point to cli-v2

**M | P5-7-8 | Final validation (all commands work)** (depends: P5-7-7)
Run full test suite and manual validation of all commands

**S | P5-7-9 | Update documentation** (depends: P5-7-8)
Update README, docs/commands.md, CHANGELOG

**S | P5-7-10 | Commit all changes** (depends: P5-7-9)
Single commit for entire migration

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

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
- cli-migrator agent: `/home/vince/dev/claude-subagents/src/agents/migration/cli-migrator/`
