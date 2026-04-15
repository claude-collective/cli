# E2E Test Framework - Progress Tracker

## Status Legend

- [ ] Not started
- [~] In progress
- [x] Done

---

## Phase 1: Code Review Fixes (from e2e-code-review-phase2.md)

- [x] F1: Replace hardcoded directory/file names with constants from consts.ts
- [x] F2: Shared timing constants moved to test-utils.ts, edit-wizard uses them
- [x] F3: createPermissionsFile in test-utils.ts, init-wizard uses it
- [x] I1: createEditableProject moved to test-utils.ts, no duplication
- [x] I2: runFullInitFlow extracted as local helper, no duplication
- [x] I3: Removed redundant toContain assertions after waitForText
- [x] I4: Fixed weak exit code assertions (typeof -> not.toBe(0))
- [x] I5: Strengthened ESC back test assertion (regex match)
- [x] I6: Consistent afterEach cleanup (reset tempDir = undefined) across all 21 test files
- [x] I7: Reduced skill creation duplication (createEditableProject uses shared helpers)

---

## Phase 2: Missing Non-Interactive Command Tests

- [x] `uninstall` command (e2e/commands/uninstall.e2e.test.ts)
  - uninstall --yes in unconfigured directory
  - uninstall --all --yes with real installation
  - uninstall --help
  - file cleanup verification
- [x] `info` command (e2e/commands/info.e2e.test.ts)
  - info --help
  - info missing required arg
  - info with valid source (skill details, local status)
  - info with nonexistent skill (error + search suggestion)
  - info relationship display (requires, conflicts, recommends)
- [x] `import skill` command (e2e/commands/import-skill.e2e.test.ts)
  - import with nonexistent source
  - import --help
- [x] `new skill` command (e2e/commands/new-skill.e2e.test.ts)
  - new skill creation in temp dir
  - new skill --help
- [x] `config set-project` / `config unset-project` (extend config.e2e.test.ts)
  - set-project with source path
  - unset-project
  - set-project --help / unset-project --help
- [x] `build plugins` command (e2e/commands/build.e2e.test.ts)
  - build plugins --help
  - build plugins with no installation
- [x] `build marketplace` command (e2e/commands/build.e2e.test.ts)
  - build marketplace --help
  - build marketplace with no plugins
- [x] `new agent` command (e2e/commands/new-agent.e2e.test.ts)
  - new agent --help
  - new agent missing name error
  - new agent --purpose logs details before source resolution
- [x] `new marketplace` command (e2e/commands/new-marketplace.e2e.test.ts)
  - new marketplace --help
  - new marketplace missing name error
  - new marketplace invalid name error (kebab-case)
  - new marketplace creates directory structure (stacks.ts, skills, README)
  - new marketplace stacks.ts content verification
  - new marketplace README content verification
  - new marketplace builds marketplace.json during scaffold
  - new marketplace duplicate error without --force
  - new marketplace --force overwrite

---

## Phase 3: Missing Interactive Command Tests

- [x] `uninstall` interactive (e2e/interactive/uninstall.e2e.test.ts)
  - interactive confirmation prompt (y/n)
  - cancellation with n
  - cancellation with Enter (default)
  - confirm with y + file removal verification
  - Ctrl+C during confirmation + file preservation
- [x] `search` interactive (e2e/interactive/search.e2e.test.ts)
  - search --help (non-interactive, execa)
  - search UI renders with loading message and header
  - search with pre-filled query (-i react)
  - Ctrl+C cancellation
  - ESC cancellation
- [x] `update` interactive (e2e/interactive/update.e2e.test.ts)
  - update --help
  - update --yes with no installation (warn gracefully)
  - interactive update launch with loading status
  - update with no outdated skills
  - Ctrl+C cancellation during source resolution
- [x] `build stack` interactive (e2e/interactive/build-stack.e2e.test.ts)
  - build stack --help
  - build stack launches stack selector with E2E source
  - Ctrl+C cancellation during stack selection

---

## Phase 4: Real Marketplace / Genuine E2E Tests

- [x] Init with real marketplace source (e2e/interactive/real-marketplace.e2e.test.ts)
  - Stack selection from real stacks (Next.js Fullstack verified)
  - Full install with real skills (config.yaml + agents compiled)
  - Marketplace label displayed
  - Completion details shown
  - Agent files have substantial content (>500 chars)
- [x] Edit with real marketplace source
  - Pre-selection from real skills (Framework \* indicator)
  - Build step renders with real categories
- [x] Compile with real installed project
  - Verify real agent markdown content (frontmatter + >1000 chars)
  - Verify compiled agents to custom output directory
- [x] List after real install
  - Shows installation details (not "No installation found")

---

## Phase 5: Final Review and Polish

- [x] Run full E2E suite end-to-end, fix any failures
- [x] Update FINDINGS.md with all new learnings (Findings 13-24 added)
- [x] Final code review pass across all test files
- [x] Fix inconsistent `tempDir = undefined as unknown as string` -> `tempDir = undefined!` (5 files)
- [x] Remove redundant `.toContain()` assertions after `waitForText()` (3 files)
- [x] Extract `EXIT_TIMEOUT_MS` to shared `test-utils.ts` (5 files)
- [x] Verify all tests pass: `npx vitest run --config e2e/vitest.config.ts`

---

## Phase 6: Coverage Expansion (Thin Commands)

- [x] diff: forked skill differences, specific skill by name, --quiet with diffs, up-to-date (4 new)
- [x] outdated: hash match current, hash mismatch outdated, --json, local-only, summary (5 new)
- [x] info: E2E source details, content preview, --no-preview, tags, partial match suggestions (7 new)
- [x] validate: valid source count, error counts, zero errors, invalid YAML, missing fields, plugin validate, --verbose (7 new)
- [x] list: help, local install details, skill count, mode, config path, agent count, edge cases (9 new)
- [x] compile: multiple skills, agent listing, verbose skill names, invalid skill, frontmatter, body content (6 new)
- [x] search interactive: static table, no results, category filter, E2E source, type-to-filter, result count (7 new)
- [x] build stack interactive: stack name visible, Enter triggers compilation, --stack flag, --output-dir, Ctrl+C variants (5 new)

---

## Phase 7: Interactive Wizard Depth

- [x] init wizard: scratch flow with both domains, domain tab navigation, confirm details, full scratch install (4 new)
- [x] edit wizard: confirm step navigation, full recompile flow, selection preservation, multiple skills (4 new)

---

## Phase 8: Audit Fixes + Bug Regression Tests

- [x] BUG-1: diff exits code 1 on success → 2 `it.fails()` tests (diff.e2e.test.ts)
- [x] BUG-2: permission checker hangs → 1 `it.fails()` test (init-wizard.e2e.test.ts)
- [x] BUG-3: ESC in edit goes to wrong step → 1 `it.fails()` test (edit-wizard.e2e.test.ts)
- [x] BUG-4: search --source ignored → 1 `it.fails()` test (search.e2e.test.ts)
- [x] WEAK-1: update output.length → specific message assertion
- [x] WEAK-2: import-skill combined.length → error message content check
- [x] WEAK-3: compile length → frontmatter structure checks
- [x] WEAK-4: init-wizard agent content → frontmatter + name: field check
- [x] REJECT-1: compile exit codes → added expect(result.exitCode).toBe(0)
- [x] getRawOutput() added to TerminalSession for raw PTY data capture
- [x] Smoke test for getRawOutput() + edit wizard raw output assertions

---

## CRITICAL PRINCIPLE — READ BEFORE WRITING ANY TEST

**This codebase contains known bugs. All tests passing is a red flag, not a goal.**

The purpose of E2E tests is to surface bugs, not to produce a green dashboard. Rules:

1. **Write correct assertions.** Assert exactly what the CLI _should_ do, not what it _currently_ does.
2. **If a test fails, that's a FINDING.** Do NOT weaken the assertion to make it pass.
3. **Use `it.fails()` for known bugs.** This documents the expected behavior AND keeps the suite green.
4. **Never accept multiple outcomes.** No `expect(output).toMatch(/success|error|failure/)`. Each test asserts ONE specific outcome.
5. **Never update tests to make them pass.** If the CLI doesn't match the assertion, the CLI has a bug. Document it and use `it.fails()`.

---

## Phase 9: Coverage Expansion + Assertion Audit

Expand thin command tests and audit ALL existing tests for weak/multi-outcome assertions.

### Assertion audit (review all existing tests)

- [x] Scan ALL test files for multi-outcome regex patterns (e.g., `/a|b|c/`)
- [x] Scan ALL test files for `toBeGreaterThan(0)` on output length
- [x] Verify every `execa` call with `reject: false` has an `exitCode` assertion
- [x] Split any multi-outcome tests into separate specific tests

### `update` command (now 9 tests)

- [x] Fix: split "up to date" test into specific assertions per outcome
- [x] Add: `skill` arg not found → "Did you mean" suggestions
- [x] Add: `skill` arg is `local-only` → "Cannot update local-only skills"
- [x] Add: `--no-recompile` flag → verify no "Recompiling agents" in output

### `import skill` command (now 10 tests, 5 `it.fails()` — local source bug)

- [x] Add: `--skill` and `--all` together → mutual exclusion error
- [x] Add: `--subdir` with absolute path → error (`it.fails()`)
- [x] Add: local source with `--list` → verify skill listing format (`it.fails()`)
- [x] Add: local source with `--skill <name>` → verify import output (`it.fails()`)
- [x] Add: import same skill twice without `--force` → verify skip warning (`it.fails()`)
- [x] Add: `--force` with existing skill → verify overwrite succeeds (`it.fails()`)

### `build plugins` command (now 5 tests)

- [x] Add: `--skill` flag with nonexistent path → error
- [x] Add: `--output-dir` flag → custom output path
- [x] Add: `--verbose` flag → accepted (exit 0)
- [x] Add: `--skills-dir` flag → accepted (deferred — needs installed project fixture)

### `build marketplace` command (now 4 tests)

- [x] Add: `--output` flag → custom output path
- [x] Add: `--name` flag → custom name in output
- [x] Add: `--verbose` flag → accepted (exit 0) (deferred — duplicate of plugins --verbose)

### `new agent` command (now 5 tests)

- [x] Add: `--help` verifies `--refresh` flag in output
- [x] Add: `Output:` path line includes `_custom` dir path

### `doctor` command (now 11 tests)

- [x] Add: `--verbose` flag → additional detail in output
- [x] Add: valid config + local source → "Connected to local:" with skill count
- [x] Add: config with agents compiled → "Agents Compiled" pass
- [x] Add: orphaned agent files → "No Orphans" warning

### `eject` command (now 11 tests)

- [x] Add: `eject skills` with local source → "N skills ejected"
- [x] Add: `eject all` → all three phases complete
- [x] Add: `--source` flag → source saved to project config
- [x] Add: minimal config.yaml creation after eject

---

## Phase 10: Test Gaps + Infrastructure Improvements

Identified by cross-referencing CLI commands with existing test coverage and auditing shared infrastructure for DRY opportunities.

### Infrastructure improvements (from shared helper audit)

- [x] Extract shared filesystem utilities (`createTempDir`, `cleanupTempDir`, `fileExists`, `directoryExists`) to a common module importable by both E2E and unit test helpers (Finding 30)
- [x] Simplify `cleanupTempDir` in both E2E and unit helpers — replace manual retry loop with `fs.rm` built-in `maxRetries: 3, retryDelay: 100` options (Finding 36)
- [x] Add `runCLI()` wrapper to `test-utils.ts` to reduce execa + stripAnsi boilerplate across 17 command test files (Finding 38)
- [x] Replace magic exit code integers with `EXIT_CODES.*` constants from `src/cli/lib/exit-codes.ts` across all E2E test files (~150 bare `toBe(0)`, `toBe(1)`, `toBe(2)`, `toBe(3)` assertions). Re-export `EXIT_CODES` from `e2e/helpers/test-utils.ts` and add `OCLIF_EXIT_CODES.UNKNOWN_COMMAND = 127` for the oclif-specific code.

### `config` command gaps (currently 16 tests)

- [x] `config set-project` with `author` key → N/A (command does not exist)
- [x] `config set-project` with `marketplace` key → N/A (command does not exist)
- [x] `config set-project` with `agentsSource` key → N/A (command does not exist)
- [x] `config get` after `set-project` → N/A (command does not exist)
- [x] `config show` after `set-project` → N/A (command does not exist)
- [x] `config show --json` → N/A (flag does not exist)

### `compile` command gaps (currently 14 tests)

- [x] `--help` flag → verify help output (basic coverage missing)
- [x] `--agents` flag → N/A (flag does not exist; compile compiles all agents)
- [x] Multiple agents compiled → verify each agent file has distinct content
- [x] Compile with `--source` flag → verify source override works
- [x] Compile with missing `.claude/skills/` directory → verify graceful error
- [x] Compile output to existing directory with files → verify overwrite behavior

### `diff` command gaps (currently 13 tests, 4 `it.fails()`)

- [x] `diff --help` → verify help output
- [x] `diff` with multiple forked skills → verify all are compared
- [x] `diff` with `--source` flag → verify source override
- [x] `diff` with skill that was deleted from source → verify error/warning (`it.fails()` — diffOutput set but hasDiff=false, message never displayed)

### `doctor` command gaps (currently 11 tests)

- [x] `doctor --help` → verify help output
- [x] `doctor` with missing skills directory but valid config → verify warning
- [x] `doctor` with remote/GitHub source → deferred (requires network; not suitable for offline E2E)
- [x] `doctor` with corrupt config.yaml → verify error handling

### `eject` command gaps (currently 11 tests)

- [x] `eject --help` → verify help output
- [x] `eject skills --filter` → N/A (flag does not exist)
- [x] `eject` with corrupt source → verify error handling (`it.fails()` — CLI falls back to default source instead of erroring)
- [x] `eject` to read-only directory → verify permission error

### `import skill` command gaps (currently 10 tests, 5 `it.fails()`)

- [x] `import skill --help` → verify `--subdir` and `--force` flags documented
- [x] `import skill` with `--all` flag from GitHub source → deferred (requires network; not suitable for offline E2E)
- [x] `import skill` with `--list --subdir` → blocked by same parseGitHubSource local path bug (see existing `it.fails()` tests)

### `info` command gaps (currently 18 tests)

- [x] `info` with `--json` flag → N/A (flag does not exist)
- [x] `info` with `--source` flag pointing to invalid path → verify error message
- [x] `info` for a skill with long description → verify truncation/wrapping

### `list` command gaps (currently 11 tests)

- [x] `list` with `--json` flag → N/A (flag does not exist)
- [x] `list` with multiple skills installed → verify all listed (`it.fails()` — CLI shows counts only, not individual IDs)
- [x] `list` with both CLI-managed and user-created skills → verify distinction in output (`it.fails()` — CLI shows counts only, no type distinction)

### `new agent` command gaps (currently 8 tests, 2 `it.fails()`)

- [x] `new agent` with `--refresh` flag → verify flag accepted (exit ERROR, not INVALID_ARGS)
- [x] `new agent` with invalid name (spaces) → `it.fails()` — no name validation exists (BUG)
- [x] `new agent` when agent already exists → `it.fails()` — no existence check (BUG)

### `new marketplace` command gaps (currently 10 tests)

- [x] `new marketplace` with `--verbose` flag → N/A (flag does not exist)
- [x] `new marketplace` name validation edge cases (numbers only, single char, very long name)

### `new skill` command gaps (currently 9 tests)

- [x] `new skill` with `--description` flag → N/A (flag does not exist)
- [x] `new skill` with `--category` flag → verify category in metadata
- [x] `new skill` name edge cases (very long name, name with numbers)

### `outdated` command gaps (currently 10 tests)

- [x] `outdated --help` → verify help output
- [x] `outdated` with `--source` flag → verify source override
- [x] `outdated` with multiple skills at different states → verify mixed output (current + outdated + local-only)
- [x] `outdated --json` with current skills → verify JSON structure

### `uninstall` command gaps (currently 8 non-interactive tests)

- [x] `uninstall --help` output includes `--dry-run` flag documentation
- [x] `uninstall --dry-run --all` → N/A (--dry-run removed in 0.55.0)
- [x] `uninstall` in directory with only user-created skills (no CLI-managed) → verify skip message

### `update` command gaps (currently 12 tests)

- [x] `update --help` output includes `--no-recompile` flag documentation
- [x] `update` with `--source` flag → verify source override
- [x] `update` with multiple outdated skills → verify all updated
- [x] `update SKILLNAME` with exact match → verify single skill update

### `validate` command gaps (currently 14 tests, 1 `it.fails()`)

- [x] `validate` with `--source` flag → verify source override (exact skill count from createE2ESource)
- [x] `validate` with skills that have relationship metadata → verify relationship validation (unresolved reference detection via matrix health check)
- [x] `validate` with duplicate skill IDs across categories → verify warning/error (`it.fails()` — validator does not detect duplicates)

### `search` interactive gaps (currently 20 tests, 2 `it.fails()`)

- [x] Search with arrow key navigation → verify selected result highlighting
- [x] Search with Enter on a result → verify info display or action (`it.fails()` — relative path bug in import copy)
- [x] Search with multiple pages of results → verify scrolling behavior
- [x] Search with `--source` flag in non-interactive mode → verify source override works (unlike interactive mode, see Finding 15)

### `build stack` interactive gaps (currently 11 tests)

- [x] Stack selection with arrow keys → verify navigation between stacks
- [x] Stack with `--source` flag → verify source override
- [x] Stack compilation with verbose output → verify skill loading details

### `init wizard` interactive gaps (currently 56 tests)

- [x] Init with `--source` flag → verify custom source is loaded
- [x] Init with `--global` flag → verify global install paths (see Phase 12 for full global coverage)
- [x] Init from "Start from scratch" with only one domain selected → verify single-domain flow
- [x] Init with all domains deselected → verify validation error or empty install behavior
- [x] Init with stack selection → customize instead of defaults → verify build step loads stack skills
- [x] Init in a directory with existing `.claude/` but no config → verify behavior (starts fresh wizard)
- [x] Init on existing project → dashboard menu (see Phase 12)

### `edit wizard` interactive gaps (currently 22 tests)

- [x] Edit with `--source` flag → verify custom source for editing
- [x] Edit with newly added skill (not in original install) → verify new skill appears in build step
- [x] Edit with all skills deselected → verify validation prevents empty install
- [x] Edit confirm step → press ESC → verify return to agents step
- [x] Edit with `--no-recompile` flag → N/A (flag does not exist on edit command)

### `uninstall` interactive gaps (currently 10 tests)

- [x] Interactive uninstall with `--all` flag → verify confirmation includes config removal warning
- [x] Interactive uninstall with `--dry-run` → N/A (--dry-run removed in 0.55.0)

### `update` interactive gaps (currently no dedicated interactive tests beyond launch)

- [x] Interactive update with outdated skills → verify selection UI appears
- [x] Interactive update selection → select specific skills → verify only selected are updated (`it.fails()` — BUG: waitUntilExit hangs after confirm)
- [x] Interactive update with `--source` flag → verify source override in interactive mode

### Missing command-level tests (commands with zero or only --help tests)

All commands have at least basic coverage. The following have the thinnest coverage relative to their complexity:

- [x] `import skill` — 5 of 10 tests are `it.fails()` due to local source bug. Tracked; convert to passing once parseGitHubSource is fixed.
- [x] `build stack` interactive — compiled output content verified (frontmatter, skill content, agent metadata)

---

## Phase 12: Missing Journeys — Global Install, Dashboard, Wizard Toggles

Cross-referenced all CLI commands, flags, wizard key handlers, and recent features against existing E2E coverage. These are user journeys that have no E2E test.

### Global install scope (`--global` flag + `G` key toggle)

- [x] `init --global` creates config in `~/.claude-src/config.ts` and skills in `~/.claude/skills/`
- [x] `init --global --dry-run` → N/A (--dry-run removed in 0.55.0)
- [x] `init --global` with existing global config shows dashboard (not re-init)
- [x] `G` key during init wizard toggles scope badge to "Global"
- [x] `edit` falls back to global installation when no project config exists
- [x] `list` shows global installation details when no project config exists
- [x] `doctor` validates global installation when no project config exists
- [x] `compile` uses global installation paths when no project config exists (`it.fails()` — compile calls `discoverAllSkills()` with `process.cwd()` instead of `installation.projectDir`)

### Dashboard view (init on existing project)

- [x] `init` on already-initialized project shows dashboard menu
- [x] Dashboard renders installed skill count, agent names, config path
- [x] Dashboard arrow key navigation between options (Edit, Compile, Doctor, List)
- [x] Dashboard ESC or Ctrl+C exits cleanly

### Wizard toggle badges

- [x] `P` key during init wizard toggles "Plugin mode" badge active/inactive
- [x] `G` key during init wizard toggles "Global" badge active/inactive
- [x] `D` key during build step toggles compatibility labels on skill tags
- [x] `?` key opens help modal, ESC closes it
- [x] `S` key during sources step opens settings overlay

### Stack skill restoration on domain re-toggle

- [x] Stack-based init: deselect a domain, re-select it — skills from stack restore
- [x] Scratch flow: deselect a domain, re-select it — no automatic restoration

### Startup message buffering (D-28)

- [x] `init --global` shows "Installing globally..." message above wizard (not cleared by Ink)
- [x] `edit` with global fallback shows "No project installation found..." message above wizard

### Confirm step detail verification

- [x] Confirm step displays install mode (Plugin/Local)
- [x] Confirm step displays install scope (Global/Project)
- [x] Confirm step displays selected skills grouped by domain
- [x] Confirm step displays selected agents

### Source management in wizard

- [x] `S` key in sources step opens settings overlay with source list
- [x] `A` key in settings shows add source UI
- [x] DEL key in settings does not remove default source (non-default source removal requires adding one first)
- [x] ESC in settings returns to sources step

### Missing flag combinations

- [x] `init --global --source {url}` uses custom source for global install
- [x] `edit --source {url}` loads skills from custom source

---

## Phase 13: Custom Marketplace Lifecycle (T-12 remaining gaps)

T-12 planned 6 scenarios for the custom marketplace workflow. Scenarios 1, 2, 5, and 6 are fully covered by existing E2E tests (`outdated.e2e.test.ts`, `update.e2e.test.ts`, `real-marketplace.e2e.test.ts`). The remaining gaps are the build pipeline's version-bumping and marketplace generation chains.

### `build plugins` version bumping pipeline

- [ ] `build plugins` on E2E source → initial compile produces plugin.json with version `1.0.0`
- [ ] `build plugins` after modifying a skill's SKILL.md → version bumps to `2.0.0` for changed skill only
- [ ] `build plugins` after no-change rebuild → version stays at `2.0.0` (idempotent)
- [ ] `build plugins` with multiple skills → only the modified skill's version increments

### `build marketplace` from compiled plugins

- [ ] `build plugins` then `build marketplace` → marketplace.json contains all compiled skills with correct versions
- [ ] `build marketplace` after version bump → marketplace.json reflects updated version for changed skill
- [ ] `build marketplace` output structure → each plugin entry has `name`, `version`, `source`, `category`

### Full build pipeline chain (single connected test)

- [ ] Create E2E source → `build plugins` → `build marketplace` → install from source → modify skill → `build plugins` → `outdated --json` detects version mismatch → `update --yes` → `outdated --json` shows all current

---

## Phase 11: Integration Test Cleanup

Now that E2E tests cover real CLI flows end-to-end, several integration tests that call internal functions directly are redundant. These should be reviewed and deleted once E2E tests have proven stable over multiple CI runs.

### High redundancy — candidates for deletion

These test the same flows that E2E tests now cover more thoroughly through the real CLI binary:

- [x] `src/cli/lib/__tests__/integration/init-end-to-end.integration.test.ts` — reviewed: E2E coverage exists in init-wizard.e2e.test.ts. Defer deletion until E2E proven stable across CI runs.
- [x] `src/cli/lib/__tests__/integration/init-flow.integration.test.ts` — reviewed: E2E coverage exists in init-wizard.e2e.test.ts. Defer deletion until E2E proven stable.
- [x] `src/cli/lib/__tests__/integration/wizard-init-compile-pipeline.test.ts` — reviewed: covered by E2E init-wizard + compile tests. Defer deletion.
- [x] `src/cli/lib/__tests__/user-journeys/compile-flow.test.ts` — reviewed: covered by e2e/commands/compile.e2e.test.ts. Defer deletion.
- [x] `src/cli/lib/__tests__/user-journeys/user-journeys.integration.test.ts` — reviewed: covered by E2E init-wizard + edit-wizard tests. Defer deletion.

### Moderate redundancy — reduce after E2E coverage strengthened

These overlap with E2E on the happy path but test internal logic (recompilation mechanics, stack compilation details) that E2E doesn't deeply validate:

- [x] `src/cli/lib/__tests__/integration/compilation-pipeline.test.ts` — reviewed: tests internal compilation logic (skill/stack/marketplace). Keep — E2E only covers happy path.
- [x] `src/cli/lib/__tests__/user-journeys/edit-recompile.test.ts` — reviewed: tests recompile mechanics (change detection, determinism). Keep — E2E covers UI flow only.
- [x] `src/cli/lib/__tests__/user-journeys/install-compile.test.ts` — reviewed: tests stack plugin compilation details (manifest, versioning). Keep — no E2E equivalent.

### Keep — no E2E equivalent exists

These test foundational logic that E2E tests assume works but never directly validate:

- `src/cli/lib/__tests__/integration/consumer-stacks-matrix.integration.test.ts` — stack loading, precedence, matrix merging, skill relationships
- `src/cli/lib/__tests__/integration/import-skill.integration.test.ts` — only comprehensive test of import workflow (E2E import tests are blocked by local source bug)
- `src/cli/lib/__tests__/integration/installation.test.ts` — installation detection logic (local/plugin mode, legacy fallback, precedence)
- `src/cli/lib/__tests__/integration/source-switching.integration.test.ts` — archive/restore mechanics for source switching
- `src/cli/lib/__tests__/user-journeys/config-precedence.test.ts` — config resolution precedence (flag → env → project → default)
