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
  - new marketplace creates directory structure (stacks.yaml, skills, README)
  - new marketplace stacks.yaml content verification
  - new marketplace README content verification
  - new marketplace builds marketplace.json during scaffold
  - new marketplace duplicate error without --force
  - new marketplace --force overwrite
  - new marketplace --output flag

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
- [ ] Add: `--skills-dir` flag → accepted (deferred — needs installed project fixture)

### `build marketplace` command (now 4 tests)

- [x] Add: `--output` flag → custom output path
- [x] Add: `--name` flag → custom name in output
- [ ] Add: `--verbose` flag → accepted (exit 0) (deferred — duplicate of plugins --verbose)

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

- [ ] `config set-project` with `author` key → verify author is persisted
- [ ] `config set-project` with `marketplace` key → verify marketplace is persisted
- [ ] `config set-project` with `agentsSource` key → verify agentsSource is persisted
- [ ] `config get` after `set-project` → verify round-trip consistency
- [ ] `config show` after `set-project` → verify set values appear in effective config display
- [ ] `config show --json` → verify JSON output format (if flag exists)

### `compile` command gaps (currently 12 tests)

- [ ] `--help` flag → verify help output (basic coverage missing)
- [ ] `--agents` flag → compile only specific agents
- [ ] Multiple agents compiled → verify each agent file has distinct content
- [ ] Compile with `--source` flag → verify source override works
- [ ] Compile with missing `.claude/skills/` directory → verify graceful error
- [ ] Compile output to existing directory with files → verify overwrite behavior

### `diff` command gaps (currently 9 tests, 3 `it.fails()`)

- [ ] `diff --help` → verify help output
- [ ] `diff` with multiple forked skills → verify all are compared
- [ ] `diff` with `--source` flag → verify source override
- [ ] `diff` with skill that was deleted from source → verify error/warning

### `doctor` command gaps (currently 11 tests)

- [ ] `doctor --help` → verify help output
- [ ] `doctor` with missing skills directory but valid config → verify warning
- [ ] `doctor` with remote/GitHub source → verify source reachability check
- [ ] `doctor` with corrupt config.yaml → verify error handling

### `eject` command gaps (currently 11 tests)

- [ ] `eject --help` → verify help output
- [ ] `eject skills --filter` → verify filtered ejection (if flag exists)
- [ ] `eject` with corrupt source → verify error handling
- [ ] `eject` to read-only directory → verify permission error

### `import skill` command gaps (currently 10 tests, 5 `it.fails()`)

- [ ] `import skill --help` → verify `--subdir` and `--force` flags documented
- [ ] `import skill` with `--all` flag from GitHub source → verify all skills imported (requires network, use `describe.skipIf`)
- [ ] `import skill` with `--list --subdir` → verify subdirectory listing

### `info` command gaps (currently 16 tests)

- [ ] `info` with `--json` flag → verify JSON output format (if flag exists)
- [ ] `info` with `--source` flag pointing to invalid path → verify error message
- [ ] `info` for a skill with long description → verify truncation/wrapping

### `list` command gaps (currently 10 tests)

- [ ] `list` with `--json` flag → verify JSON output (if flag exists)
- [ ] `list` with multiple skills installed → verify all listed
- [ ] `list` with both CLI-managed and user-created skills → verify distinction in output

### `new agent` command gaps (currently 5 tests)

- [ ] `new agent` with `--refresh` flag → verify refresh behavior (if testable without Claude API)
- [ ] `new agent` with invalid name (spaces, special chars) → verify validation error
- [ ] `new agent` when agent already exists → verify error or overwrite behavior

### `new marketplace` command gaps (currently 10 tests)

- [ ] `new marketplace` with `--verbose` flag → verify additional output
- [ ] `new marketplace` name validation edge cases (numbers only, single char, very long name)

### `new skill` command gaps (currently 8 tests)

- [ ] `new skill` with `--description` flag → verify description in generated files
- [ ] `new skill` with `--category` flag → verify category in metadata
- [ ] `new skill` name edge cases (very long name, name with numbers)

### `outdated` command gaps (currently 8 tests)

- [ ] `outdated --help` → verify help output
- [ ] `outdated` with `--source` flag → verify source override
- [ ] `outdated` with multiple skills at different states → verify mixed output (current + outdated + local-only)
- [ ] `outdated --json` with current skills → verify JSON structure

### `uninstall` command gaps (currently 8 non-interactive tests)

- [ ] `uninstall --help` output includes `--dry-run` flag documentation
- [ ] `uninstall --dry-run --all` → verify dry-run with --all flag
- [ ] `uninstall` in directory with only user-created skills (no CLI-managed) → verify "nothing to uninstall" message

### `update` command gaps (currently 9 tests)

- [ ] `update --help` output includes `--no-recompile` flag documentation
- [ ] `update` with `--source` flag → verify source override
- [ ] `update` with multiple outdated skills → verify all updated
- [ ] `update SKILLNAME` with exact match → verify single skill update

### `validate` command gaps (currently 11 tests)

- [ ] `validate` with `--source` flag → verify source override
- [ ] `validate` with skills that have relationship metadata → verify relationship validation
- [ ] `validate` with duplicate skill IDs across categories → verify warning/error

### `search` interactive gaps (currently 14 tests, 1 `it.fails()`)

- [ ] Search with arrow key navigation → verify selected result highlighting
- [ ] Search with Enter on a result → verify info display or action
- [ ] Search with multiple pages of results → verify scrolling behavior
- [ ] Search with `--source` flag in non-interactive mode → verify source override works (unlike interactive mode, see Finding 15)

### `build stack` interactive gaps (currently 9 tests)

- [ ] Stack selection with arrow keys → verify navigation between stacks
- [ ] Stack with `--source` flag → verify source override
- [ ] Stack compilation with verbose output → verify skill loading details

### `init wizard` interactive gaps (currently 21 tests)

- [ ] Init with `--source` flag → verify custom source is loaded
- [ ] Init from "Start from scratch" with only one domain selected → verify single-domain flow
- [ ] Init with all domains deselected → verify validation error or empty install behavior
- [ ] Init with stack selection → customize instead of defaults → verify build step loads stack skills
- [ ] Init in a directory with existing `.claude/` but no config → verify behavior (not "already initialized" if no config.yaml)

### `edit wizard` interactive gaps (currently 17 tests)

- [ ] Edit with `--source` flag → verify custom source for editing
- [ ] Edit with newly added skill (not in original install) → verify new skill appears in build step
- [ ] Edit with all skills deselected → verify validation prevents empty install
- [ ] Edit confirm step → press ESC → verify return to agents step
- [ ] Edit with `--no-recompile` flag → verify agents are not recompiled after edit

### `uninstall` interactive gaps (currently 10 tests)

- [ ] Interactive uninstall with `--all` flag → verify confirmation includes config removal warning
- [ ] Interactive uninstall with `--dry-run` → verify dry-run output with confirmation prompt

### `update` interactive gaps (currently no dedicated interactive tests beyond launch)

- [ ] Interactive update with outdated skills → verify selection UI appears
- [ ] Interactive update selection → select specific skills → verify only selected are updated
- [ ] Interactive update with `--source` flag → verify source override in interactive mode

### Missing command-level tests (commands with zero or only --help tests)

All commands have at least basic coverage. The following have the thinnest coverage relative to their complexity:

- [ ] `import skill` — 5 of 10 tests are `it.fails()` due to local source bug. Once BUG is fixed, convert to passing tests.
- [ ] `build stack` interactive — no test verifies the actual compiled output content (only verifies compilation started/completed)

---

## Phase 11: Integration Test Cleanup

Now that E2E tests cover real CLI flows end-to-end, several integration tests that call internal functions directly are redundant. These should be reviewed and deleted once E2E tests have proven stable over multiple CI runs.

### High redundancy — candidates for deletion

These test the same flows that E2E tests now cover more thoroughly through the real CLI binary:

- [ ] `src/cli/lib/__tests__/integration/init-end-to-end.integration.test.ts` — wizard store → installLocal() pipeline. Fully covered by `e2e/interactive/init-wizard.e2e.test.ts`.
- [ ] `src/cli/lib/__tests__/integration/init-flow.integration.test.ts` — init flow with skills copying, agent compilation, config generation. Fully covered by `e2e/interactive/init-wizard.e2e.test.ts`.
- [ ] `src/cli/lib/__tests__/integration/wizard-init-compile-pipeline.test.ts` — wizard → init → compile pipeline. Covered by E2E init-wizard + compile tests.
- [ ] `src/cli/lib/__tests__/user-journeys/compile-flow.test.ts` — compile command with skill discovery, frontmatter, dry-run. Covered by `e2e/commands/compile.e2e.test.ts`.
- [ ] `src/cli/lib/__tests__/user-journeys/user-journeys.integration.test.ts` — multi-journey scenarios (init → edit → recompile). Covered by E2E init-wizard + edit-wizard tests.

### Moderate redundancy — reduce after E2E coverage strengthened

These overlap with E2E on the happy path but test internal logic (recompilation mechanics, stack compilation details) that E2E doesn't deeply validate:

- [ ] `src/cli/lib/__tests__/integration/compilation-pipeline.test.ts` — skill/stack/marketplace compilation logic. E2E covers happy path only.
- [ ] `src/cli/lib/__tests__/user-journeys/edit-recompile.test.ts` — recompilation mechanics (skill change detection, determinism). E2E covers UI flow, not recompile details.
- [ ] `src/cli/lib/__tests__/user-journeys/install-compile.test.ts` — stack plugin compilation (manifest, versioning, README). E2E covers interactive flow, not output details.

### Keep — no E2E equivalent exists

These test foundational logic that E2E tests assume works but never directly validate:

- `src/cli/lib/__tests__/integration/consumer-stacks-matrix.integration.test.ts` — stack loading, precedence, matrix merging, skill relationships
- `src/cli/lib/__tests__/integration/import-skill.integration.test.ts` — only comprehensive test of import workflow (E2E import tests are blocked by local source bug)
- `src/cli/lib/__tests__/integration/installation.test.ts` — installation detection logic (local/plugin mode, legacy fallback, precedence)
- `src/cli/lib/__tests__/integration/source-switching.integration.test.ts` — archive/restore mechanics for source switching
- `src/cli/lib/__tests__/user-journeys/config-precedence.test.ts` — config resolution precedence (flag → env → project → default)
