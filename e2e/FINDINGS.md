# E2E Testing Findings

## Edit Wizard (edit-wizard.e2e.test.ts)

### Finding 1: Ink overwrites pre-wizard log output in xterm buffer

- **What happened:** The edit command logs status messages ("Edit Local Skills", "Loading marketplace source...", "Current plugin has N skills") before launching the Ink wizard. However, once Ink renders its full-screen UI, the xterm headless buffer no longer contains these pre-render messages in `getFullOutput()`. Tests that waited for these messages (`waitForText("skills")`) timed out because the word was only present in Ink's UI context (e.g., "Framework \* (1 of 1)") not as the pre-wizard log text.
- **Why:** Ink uses alternate screen buffer and full-screen rendering. When it takes over, previous stdout output is pushed out of the terminal buffer. The `getFullOutput()` method reads from the active xterm buffer, which only contains what Ink is currently rendering.
- **Workaround/Pattern:** Wait for wizard-specific UI text like `"Customize your Web stack"` instead of generic log messages like `"skills"`. The very first log lines ("Edit Local Skills", "Loading marketplace source...") can sometimes be caught if `waitForText` polls fast enough before Ink takes over, but this is timing-sensitive.
- **Should this become a standard?** YES. For interactive wizard tests, always wait for wizard-rendered UI text, never pre-wizard log output. Document in test helpers.

### Finding 2: Minimal file structure for edit command

- **What happened:** The edit command requires `detectInstallation()` to succeed, which checks for `.claude-src/config.yaml` (or `.claude/config.yaml`). For local install mode, `discoverAllPluginSkills()` returns empty (no settings.json with plugin paths), so the command falls back to `projectConfig.config.skills` from the YAML config.
- **Why:** The edit command has two skill discovery paths: (1) discover installed plugin skills from filesystem, and (2) fall back to the `skills` array in config.yaml. For E2E testing, we only need the config.yaml path since we test in local mode without actual Claude plugin infrastructure.
- **Workaround/Pattern:** Create a minimal project with just `.claude-src/config.yaml` containing `name`, `installMode`, `skills`, `agents`, and `domains` fields. Optionally create `.claude/skills/<id>/SKILL.md` and `metadata.yaml` files for completeness. The `createEditableProject()` helper encapsulates this.
- **Should this become a standard?** YES. The helper should be extracted to `test-utils.ts` if other tests need editable projects.

### Finding 3: Pre-selection verification via category count display

- **What happened:** When the edit wizard opens with `installedSkillIds` containing `web-framework-react`, the build step shows `Framework * (1 of 1)` in the category header. This provides a reliable assertion for verifying skill pre-selection.
- **Why:** The `useWizardInitialization` hook calls `populateFromSkillIds()` which maps skill IDs to domain/subcategory selections. The Framework category then renders with the selection count, e.g., "(1 of 1)" meaning 1 selected out of 1 exclusive slot.
- **Workaround/Pattern:** Assert `screen.toMatch(/Framework.*\(1 of 1\)/)` to verify pre-selection. This is more robust than looking for specific skill tag borders which depend on terminal width.
- **Should this become a standard?** YES. Category count patterns are the most reliable way to verify skill selection state in the wizard UI.

### Finding 4: ESC from edit build step goes to stack step

- **What happened:** Pressing ESC on the build step in edit mode navigates back to the "stack" step. This is because the wizard history is empty when starting at the build step (edit sets `initialStep="build"` directly, without pushing to history).
- **Why:** `useWizardInitialization` calls `setState({ step: initialStep, approach: "scratch" })` which sets the step directly without using `setStep()` (which would push to history). So `goBack()` falls back to the default "stack" step since history is empty.
- **Workaround/Pattern:** The test verifies the screen is still non-empty (wizard didn't crash) rather than asserting specific stack step content, since the user is unlikely to press ESC on the first edit step in practice.
- **Should this become a standard?** This is an edge case worth noting. The edit UX might benefit from either: (a) pushing "build" onto history so ESC stays on build, or (b) making ESC cancel the edit wizard entirely.

### Finding 5: Ctrl+C reliably terminates the PTY process

- **What happened:** Sending `session.ctrlC()` (which writes `\x03`) during an active Ink wizard session reliably kills the process. The exit code is non-zero (process killed by signal).
- **Why:** The PTY correctly delivers SIGINT to the process group. Ink's `useApp().exit()` and Node's default SIGINT handling both work correctly through the PTY.
- **Workaround/Pattern:** No workaround needed. `session.ctrlC()` followed by `session.waitForExit()` is reliable. Config files remain unchanged after cancellation since the edit command only writes files after the wizard completes successfully.
- **Should this become a standard?** YES. Ctrl+C cancellation + file system integrity check is a good pattern for all interactive wizard tests.

### Finding 6: Fast test execution with PTY-based tests

- **What happened:** Each edit wizard test completes in approximately 1-1.5 seconds. The full suite of 13 tests runs in under 15 seconds. This is much faster than expected for PTY-based E2E tests.
- **Why:** The default marketplace source resolves locally (from the built CLI's bundled skills matrix), so there is no network I/O. The headless xterm terminal is efficient at processing Ink's ANSI output.
- **Workaround/Pattern:** No workaround needed. The 10-20 second timeouts in `waitForText()` provide generous margins.
- **Should this become a standard?** YES. Local source resolution makes these tests fast and deterministic. Tests should avoid requiring network access.

---

## Init Wizard (init-wizard.e2e.test.ts)

### Finding 7: Permission Checker Renders a Blocking Ink Component

- **What happened:** After the init wizard completes installation (writing skills, config, agents), the `checkPermissions()` function renders an Ink component showing a "Permission Notice" box. This Ink component has no `useInput` handler and no `exit()` call, so `waitUntilExit()` never resolves. The process hangs indefinitely, and `tree-kill` SIGKILL reports exit code 13.
- **Why:** The permission checker in `src/cli/lib/permission-checker.tsx` renders a static `<Box>` with `<Text>` children. When `render()` is called on this element and `waitUntilExit()` is awaited, Ink keeps the process alive waiting for the app to call `exit()`. Since there is no input handler, the user cannot dismiss it.
- **Workaround/Pattern:** Pre-create `.claude/settings.json` with a `permissions.allow` array in the project directory before running init. This causes `checkPermissions()` to return `null` instead of rendering. Example: `{ "permissions": { "allow": ["Read(*)"] } }`
- **Should this become a standard?** YES. Any E2E test that runs the full init or edit flow to completion must create this settings.json to avoid hanging.

### Finding 8: Source Fixture Needs Matching Skills for Full Flow

- **What happened:** Using the CLI's built-in stacks.yaml (which references 30+ skills) with a test source that only has 4 skills caused the install to fail with exit code 13. The `installLocal` function tries to copy skills from the source, and missing skills cause errors.
- **Why:** The stacks defined in the CLI's `config/stacks.yaml` reference specific skill IDs that must exist in the source's `src/skills/` directory. If they don't exist, the copy fails.
- **Workaround/Pattern:** The `createE2ESource()` helper creates both skills AND a matching `config/stacks.yaml` with a single "E2E Test Stack" that references only the 10 skills present in the source (4 domain skills + 6 methodology skills).
- **Should this become a standard?** YES. E2E source fixtures for full init flows must ensure stack definitions only reference skills that exist in the source.

### Finding 9: Viewport Clipping Hides Content Below the Fold

- **What happened:** `getScreen()` only returns the visible viewport (40 rows by default). With 6+ SelectionCard components (each ~5 rows tall) plus the ASCII logo, marketplace label, tabs, and footer, the "Start from scratch" option was below the visible area.
- **Why:** `getScreen()` reads only `viewportY + rows` lines from the xterm buffer. Content that scrolls below the viewport is in the scrollback buffer but not on screen.
- **Workaround/Pattern:** Use `getFullOutput()` for assertions about "text exists anywhere in the output." Use `getScreen()` only for "text is currently visible to the user."
- **Should this become a standard?** YES. Default to `getFullOutput()` for existence checks. Reserve `getScreen()` for viewport-specific assertions.

### Finding 10: ASCII Logo Does Not Contain Plain Text

- **What happened:** Asserting `toContain("AGENTS")` on the output fails because the ASCII art logo uses Unicode box-drawing characters, not letters.
- **Why:** The logo constant `ASCII_LOGO` in `consts.ts` uses block characters to draw the letters visually.
- **Workaround/Pattern:** Do not assert on ASCII art content. Check surrounding text like "Marketplace:" instead.
- **Should this become a standard?** YES. Never assert on ASCII art with plain text matching.

### Finding 11: waitForText is the Primary Synchronization Mechanism

- **What happened:** The most reliable way to synchronize test steps is `session.waitForText("Step Title")` followed by a small delay, rather than fixed-length sleeps.
- **Why:** Fixed delays can be too short (flaky) or too long (slow). `waitForText` polls every 50ms which is both faster and more reliable.
- **Workaround/Pattern:** Pattern: `session.enter()` -> `await session.waitForText("Next Step", TIMEOUT)` -> `await delay(TRANSITION_DELAY)` -> next input. Use `STEP_TRANSITION_DELAY_MS = 500` after step changes and `KEYSTROKE_DELAY_MS = 150` after navigation keys.
- **Should this become a standard?** YES. This pattern should be the default for all interactive wizard tests.

### Finding 12: Custom Stack in Source Overrides CLI Stacks

- **What happened:** When the E2E source includes `config/stacks.yaml`, it completely replaces the CLI's built-in stacks (Next.js, Angular, etc.). The wizard shows only the source's stacks.
- **Why:** In `source-loader.ts`, `loadStacks()` is called on the source first. If the source has stacks, those are used; otherwise the CLI's stacks are used. This is an either/or, not a merge.
- **Workaround/Pattern:** The E2E source deliberately provides its own stacks.yaml with a single "E2E Test Stack" to control the wizard content. This makes tests faster (1 stack to navigate instead of 6) and deterministic (no dependency on CLI's stacks content).
- **Should this become a standard?** YES. E2E test sources should control their own stacks for test isolation.

---

## Uninstall Command (uninstall.e2e.test.ts, uninstall interactive)

### Finding 13: Uninstall requires `forkedFrom` metadata to identify CLI-managed skills

- **What happened:** The `uninstall` command only removes skills that have `forkedFrom` metadata in their `metadata.yaml`. Skills without this field are treated as user-created and are skipped during uninstall, with a "Skipping" message logged.
- **Why:** The uninstall logic uses `forkedFrom` as the signal that a skill was installed by the CLI (copied from a source) rather than hand-created by the user. This prevents the uninstall command from deleting custom user content.
- **Workaround/Pattern:** E2E tests that verify uninstall behavior must write `forkedFrom` metadata into test skills. The `createEditableProject()` helper does NOT add this field by default, so tests must add it manually via `writeFile()`. A dedicated `createUninstallableProject()` local helper was created in the interactive uninstall test.
- **Should this become a standard?** YES. Any test that exercises the uninstall code path must ensure `forkedFrom` metadata is present for skills that should be removed.

---

## New Agent Command (new-agent.e2e.test.ts)

### Finding 14: `new agent` requires compiled `agent-summoner` meta-agent

- **What happened:** The `new agent` command logs the agent name and purpose but then fails during source resolution because it needs the compiled `agent-summoner` meta-agent to generate the new agent's content via the Claude API.
- **Why:** The command is designed to use a meta-agent (itself a compiled agent) to generate a new agent's instructions. Without a compiled meta-agent and a configured Claude CLI, the command cannot complete. This makes full E2E testing in isolation impossible.
- **Workaround/Pattern:** Tests verify help text, argument validation, and the initial logging phase (agent name + purpose). The actual agent generation cannot be tested without a real Claude installation and API access.
- **Should this become a standard?** YES. Commands that delegate to external AI tools (Claude CLI) can only be partially tested in E2E. Test the setup/validation phase, document the limitation.

---

## Search Command (search.e2e.test.ts)

### Finding 15: Search interactive mode ignores `--source` flag; use `CC_SOURCE` env var

- **What happened:** The `search` command's interactive path does not pass the `--source` flag through to the skill loader. The `CC_SOURCE` environment variable must be used instead to override the marketplace source for interactive search.
- **Why:** The interactive search component loads skills from "all sources" using an internal source resolution mechanism that reads `CC_SOURCE` from the environment, not the command's `--source` flag.
- **Workaround/Pattern:** Pass `{ env: { CC_SOURCE: sourceDir } }` in the `TerminalSession` options instead of using `--source` as a CLI flag for interactive search tests.
- **Should this become a standard?** YES. Interactive commands that load sources internally should be tested with env vars, not flags. Check the command's source resolution path before assuming `--source` works.

---

## Real Marketplace Tests (real-marketplace.e2e.test.ts)

### Finding 16: `describe.skipIf()` for optional environment dependencies

- **What happened:** Real marketplace tests use `describe.skipIf(!hasSkillsSource)` to gracefully skip when the skills repository is not present on the machine. The `SKILLS_SOURCE` env var provides a worktree-safe override for the skills repo path.
- **Why:** The skills repo is a sibling directory (`/home/vince/dev/skills`) that exists on the developer's machine but not on CI or other environments. Tests must degrade gracefully to avoid false failures.
- **Workaround/Pattern:** Check for the source directory at module level using a top-level `await`, then use `describe.skipIf()`. Provide `SKILLS_SOURCE` env var as an override so the tests work from git worktrees or alternative directory layouts.
- **Should this become a standard?** YES. Any test that depends on an optional external resource should use `describe.skipIf()` with an env var override.

---

## Build Commands (build.e2e.test.ts)

### Finding 17: Build commands report "0 plugins" rather than erroring when no source is present

- **What happened:** The `build plugins` and `build marketplace` commands complete successfully (exit code 0) even when run in an empty directory with no source structure. They report "Compiled 0 skill plugins" and "Found 0 plugins" respectively.
- **Why:** The build commands operate on whatever source is present in the current directory. An empty directory simply means there's nothing to build, which is a valid (if unusual) state. This graceful degradation is intentional.
- **Workaround/Pattern:** Tests can run build commands in empty temp directories to verify the zero-state output. No special setup required.
- **Should this become a standard?** YES. Commands that operate on directory contents should be tested in empty directories to verify graceful zero-state handling.

---

## New Marketplace Command (new-marketplace.e2e.test.ts)

### Finding 18: `new marketplace` automatically runs `build marketplace` during scaffold

- **What happened:** After creating the directory structure (skills, stacks.yaml, README), the `new marketplace` command automatically runs `build plugins` followed by `build marketplace`, producing a `marketplace.json` file in the `.claude-plugin/` output directory.
- **Why:** The scaffold is designed to be immediately usable. By building on creation, the marketplace is ready to be used as a `--source` without requiring a separate build step.
- **Workaround/Pattern:** Tests can verify both the scaffold output (stacks.yaml, skills, README) and the build output (marketplace.json in `PLUGIN_MANIFEST_DIR`) from a single `new marketplace` invocation.
- **Should this become a standard?** YES. Scaffold commands that include automatic build steps should be tested for both the created structure and the build artifacts.

### Finding 19: `new marketplace` supports `--output` to specify the parent directory

- **What happened:** The `--output` flag changes where the marketplace directory is created. Instead of `<cwd>/<name>`, it creates `<output>/<name>`. The output directory is created automatically if it doesn't exist.
- **Why:** This allows creating marketplaces outside the current working directory, which is useful for CI/CD pipelines and scripted setups.
- **Workaround/Pattern:** Test with `--output` pointed to a subdirectory of the temp dir to verify the flag works and the parent directory is auto-created.
- **Should this become a standard?** Not critical. Standard `--output` flag behavior.

---

## Update Command (update.e2e.test.ts)

### Finding 20: Update command requires local skills to exist before checking for updates

- **What happened:** Running `update --yes` in an empty directory (no `.claude/skills/`) prints "No local skills found" and exits gracefully rather than crashing.
- **Why:** The update command first checks `LOCAL_SKILLS_PATH` for installed skills. If none exist, there's nothing to update, and it warns the user without proceeding to source resolution.
- **Workaround/Pattern:** Test the zero-state (no skills) separately from the update-with-skills path. The zero-state is a clean exit; the with-skills path depends on source availability.
- **Should this become a standard?** YES. Commands with prerequisite state should always be tested in the zero-state first.

---

## Info Command (info.e2e.test.ts)

### Finding 21: Info command requires `displayName` in metadata for local skill discovery

- **What happened:** When testing whether `info` shows "Local Status: Installed", the test initially failed because `createEditableProject()` writes minimal metadata (just `author` and `contentHash`). The `discoverLocalSkills()` function requires `displayName` in the metadata to match skills.
- **Why:** The local skill discovery logic (`discoverLocalSkills`) reads `metadata.yaml` and needs `displayName` to build the skill's display name and match it against the source skill. Without it, the skill is not recognized as locally installed.
- **Workaround/Pattern:** Overwrite the skill's `metadata.yaml` with complete metadata including `displayName` after calling `createEditableProject()`.
- **Should this become a standard?** YES. Tests verifying local skill detection must include `displayName` in metadata.

---

## Code Review Findings (Phase 5)

### Finding 22: Shared timing constants prevent magic number duplication

- **What happened:** Five interactive test files (`build-stack`, `edit-wizard`, `search`, `uninstall`, `update`) each independently declared `const EXIT_TIMEOUT_MS = 10_000`. This was a magic number replicated across files.
- **Why:** The constant was introduced in each file when it was written, before a pattern for shared timing constants was established.
- **Fix applied:** `EXIT_TIMEOUT_MS` was extracted to `test-utils.ts` alongside the other shared timing constants (`WIZARD_LOAD_TIMEOUT_MS`, `INSTALL_TIMEOUT_MS`, `STEP_TRANSITION_DELAY_MS`, `KEYSTROKE_DELAY_MS`). All five files now import from the shared location.
- **Should this become a standard?** YES. All timing constants used by 2+ test files should live in `test-utils.ts`.

### Finding 23: Consistent `tempDir = undefined!` cleanup pattern

- **What happened:** Some test files used `tempDir = undefined!` in afterEach while others used `tempDir = undefined as unknown as string`. Both achieve the same result but the inconsistency makes the codebase harder to read.
- **Why:** Files were written at different times by different sessions, each choosing their own way to reset the typed variable.
- **Fix applied:** Standardized all 5 inconsistent files (`import-skill`, `new-agent`, `new-marketplace`, `new-skill`, `uninstall` commands) to use `tempDir = undefined!`, matching the majority pattern.
- **Should this become a standard?** YES. Use `tempDir = undefined!` (non-null assertion on undefined) as the cleanup pattern, not `undefined as unknown as string`.

### Finding 24: Avoid redundant assertions after `waitForText()`

- **What happened:** Three test files had `expect(output).toContain("text")` immediately after `session.waitForText("text")`. The `waitForText` call already guarantees the text is present (it throws if not found), making the assertion redundant.
- **Why:** The redundant assertions were likely added for documentation/clarity, but they add no testing value and increase noise.
- **Fix applied:** Removed 3 redundant assertions from `search.e2e.test.ts`, `build-stack.e2e.test.ts`, and `update.e2e.test.ts`.
- **Should this become a standard?** YES. Never follow `waitForText("X")` with `toContain("X")` for the same text. The wait is the assertion. Additional assertions should verify _different_ text or _different_ properties of the output.

---

## Interactive Wizard Depth (Phase 7)

### Finding 25: Required categories block wizard advancement

- **What happened:** The Web domain's Framework category and API domain's API Framework category are `required: true`. Pressing Enter to advance from a domain's build step triggers validation -- if no required skill is selected, advancement is blocked. Tests must use `session.space()` to select a required skill before `session.enter()` to advance.
- **Why:** The wizard validates that all required categories have at least one selection before allowing the user to proceed. This prevents users from advancing without making essential choices (e.g., picking a web framework).
- **Workaround/Pattern:** Before pressing Enter to advance past a build step domain, always select at least one skill in each required category using `session.space()`. For the Web domain, this means selecting a Framework skill. For the API domain, this means selecting an API Framework skill.
- **Should this become a standard?** YES. All wizard E2E tests that navigate through build steps must satisfy required category validation before advancing.

### Finding 26: Multi-domain scratch flow includes Mobile by default

- **What happened:** The scratch flow pre-selects Web, API, and Mobile domains via `DEFAULT_SCRATCH_DOMAINS`. Tests navigating scratch flow must advance through all three domains (Web -> API -> Mobile) in the build step before reaching sources.
- **Why:** The wizard's scratch approach initializes with three domains enabled by default. Each domain's build step must be completed (or at least advanced through) before the wizard moves to the sources step.
- **Workaround/Pattern:** Tests that need to reach the sources or confirm step must navigate through all three domain build tabs. Use `session.enter()` after satisfying required categories for each domain. The domain tabs are visible at the top of the build step.
- **Should this become a standard?** YES. Any E2E test that exercises the full scratch flow must account for all default domains, not just Web.

### Finding 27: Edit wizard has Sources and Agents steps between Build and Confirm

- **What happened:** The edit flow is: Build -> Sources -> Agents -> Confirm. Tests that need to navigate to confirm must advance through all intermediate steps. Text anchors: "technologies" for Sources, "Select agents" for Agents, "Ready to install" for Confirm.
- **Why:** The edit wizard follows the same step sequence as the init wizard after the build step. Sources allows configuring skill sources, and Agents allows selecting which agents to compile.
- **Workaround/Pattern:** After completing the build step, press Enter and wait for "technologies" (Sources step), then Enter and wait for "Select agents" (Agents step), then Enter and wait for "Ready to install" (Confirm step). Each step transition requires `waitForText` synchronization.
- **Should this become a standard?** YES. Document the full step sequence for edit wizard navigation in tests. Do not assume Build goes directly to Confirm.

### Finding 29: Multi-outcome assertions are weak — split into separate tests

- **What happened:** The update test "should report all skills up to date when no outdated skills exist" used `expect(output).toMatch(/up to date|Update failed|Failed to resolve/i)`, accepting three completely different outcomes as "passing." This is equivalent to no assertion — it cannot fail regardless of what the command does.
- **Why:** The test was written to accommodate uncertainty about whether a source would be available, so it accepted both success and failure messages. This defeats the purpose of the test.
- **Fix applied:** Split into separate tests, each asserting one specific outcome. If a test's assertion doesn't match the CLI's actual behavior, the test should fail — that's a signal the CLI has a bug or the test setup is wrong.
- **Should this become a standard?** YES. **CRITICAL PRINCIPLE: Never write assertions that accept multiple different outcomes. Each test should assert exactly one expected behavior. If the CLI has bugs, tests should fail — they should NOT be weakened to pass. Use `it.fails()` for known bugs, but never broaden assertions to accommodate unknown failures.** The goal of this E2E suite is to surface bugs, not to have a green dashboard.

### Finding 28: Styling skill required for edit wizard advancement

- **What happened:** The build step validates that the Styling category has at least one selection when it's marked as required. Edit wizard tests that need to navigate past the build step must include a styling skill (e.g., `web-styling-tailwind`) in the project setup.
- **Why:** The Styling category in the Web domain is `required: true`. When the edit wizard loads with pre-selected skills, if no styling skill is among them, the build step validation will block advancement. The validation fires on Enter press.
- **Workaround/Pattern:** Include `web-styling-tailwind` (or another styling skill) in the `skills` array of the project's `config.yaml` when creating the editable project via `createEditableProject()`. This ensures the Styling category has a pre-selection and validation passes.
- **Should this become a standard?** YES. Edit wizard E2E tests must ensure all required categories have pre-selected skills if the test needs to advance past the build step.

---

## Shared Infrastructure Audit (Phase 10)

### Finding 30: Duplicated utilities between E2E and unit test helpers

- **File(s):** `e2e/helpers/test-utils.ts`, `src/cli/lib/__tests__/helpers.ts`
- **Issue:** Five utilities are duplicated with nearly identical implementations across the E2E and unit test helpers:
  1. `createTempDir()` — identical logic (`mkdtemp` with prefix), only default prefix differs (`"cc-e2e-"` vs `"cc-test-"`)
  2. `cleanupTempDir()` — identical logic (retry loop with `ENOTEMPTY` check, same constants: `CLEANUP_MAX_RETRIES = 3`, `CLEANUP_RETRY_DELAY_MS = 100`)
  3. `fileExists()` — identical (`stat().isFile()` with catch-false)
  4. `directoryExists()` — identical (`stat().isDirectory()` with catch-false)
  5. `delay()` — E2E-only, but the pattern (`new Promise(resolve => setTimeout(resolve, ms))`) is common enough to share
- **Recommendation:** Extract a shared `test-helpers/fs-utils.ts` module (or similar) that both E2E and unit test helpers import from. The prefix for `createTempDir` can be a parameter (already is in the unit helpers). This eliminates ~80 lines of duplicated code and ensures bug fixes (e.g., to retry logic) propagate to both test suites.
- **Should this become a standard?** YES. Any utility used identically by both E2E and unit tests should live in a shared module rather than being duplicated.

### Finding 31: `stripAnsi()` wraps Node.js built-in `stripVTControlCharacters` — no third-party needed

- **File(s):** `e2e/helpers/test-utils.ts` (line 132-134), `e2e/helpers/terminal-session.ts` (line 1, 98)
- **Issue:** The `stripAnsi()` function in `test-utils.ts` is a one-line wrapper around `node:util`'s `stripVTControlCharacters()`. The `strip-ansi` npm package is NOT a dependency and is NOT needed — the Node.js built-in (available since Node 20.12.0) handles the same task. `terminal-session.ts` calls `stripVTControlCharacters` directly in `getRawOutput()`.
- **Recommendation:** Keep the current approach. The `stripAnsi()` wrapper provides a more readable name at call sites. No third-party package is needed. This is already the correct solution.
- **Should this become a standard?** YES. Use `stripVTControlCharacters` from `node:util` for ANSI stripping. Do not add the `strip-ansi` npm package.

### Finding 32: `tree-kill` for process cleanup — still the best option

- **File(s):** `e2e/helpers/terminal-session.ts` (line 4, 180)
- **Issue:** `tree-kill@1.2.2` is used to kill the entire process tree spawned by PTY. Alternatives considered:
  - `process.kill(-pid)` — only works with process groups, does not handle all spawned children reliably
  - `fkill` — over-engineered for this use case, adds unnecessary complexity
  - `execa`'s built-in `kill()` — only works with execa-spawned processes, not PTY processes
  - Manual recursive PID walking — fragile, platform-dependent
- **Recommendation:** Keep `tree-kill`. It is the standard solution for killing process trees in Node.js, has zero dependencies, is stable (last update needed: none — the API is complete), and works cross-platform. No action needed.
- **Should this become a standard?** YES. Use `tree-kill` for any E2E test that needs to clean up spawned process trees.

### Finding 33: PTY + xterm headless approach — no established alternative exists

- **File(s):** `e2e/helpers/terminal-session.ts`
- **Issue:** The `TerminalSession` class combines `@lydell/node-pty` (to spawn a real PTY) with `@xterm/headless` (to process ANSI escape sequences into a clean screen buffer). Alternatives considered:
  - **`expect` (TCL)** / **pexpect (Python)** — different languages, not usable from Node.js/vitest
  - **`node-pty` alone** — raw PTY output includes ANSI codes, making assertions brittle. The xterm headless layer is what makes `getScreen()` return clean text
  - **`ink-testing-library`** — only works for Ink component unit tests, not for spawning the actual CLI binary as a subprocess
  - **Playwright terminal testing** — does not exist; Playwright is for browsers
  - **`nixt`** — abandoned, does not support Ink's full-screen rendering
  - **`cli-testing-library`** — concept-stage, not mature enough for production use
- **Recommendation:** Keep the current PTY + xterm headless approach. It is the most reliable way to test interactive CLI applications that use Ink for full-screen rendering. The `TerminalSession` wrapper provides a clean API (`getScreen()`, `getFullOutput()`, `getRawOutput()`, `waitForText()`, named key methods) that is well-tested and fast (~1s per test). No viable alternative exists in the Node.js ecosystem for this specific use case.
- **Should this become a standard?** YES. The PTY + xterm headless pattern should be the standard for E2E testing of interactive Ink-based CLI tools.

### Finding 34: `waitForText()` polling approach — adequate, but could use EventEmitter optimization

- **File(s):** `e2e/helpers/terminal-session.ts` (lines 105-118)
- **Issue:** `waitForText()` polls `getFullOutput()` every 50ms until the text appears or timeout. This works well in practice (tests complete in ~1s each) but has theoretical inefficiency: each poll call reads the entire xterm buffer, and if many tests run in parallel the polling threads compete.
  - **Alternative 1: EventEmitter-based** — the xterm `onData` callback could check a set of pending `waitForText` predicates on each data chunk, resolving promises immediately when text appears. This eliminates polling entirely.
  - **Alternative 2: MutationObserver-style** — maintain a "dirty flag" on each data write, only re-scan when buffer has new data.
  - **Alternative 3: `vitest/utils` `waitFor`** — vitest's built-in `waitFor` does the same polling pattern but with configurable intervals. Not meaningfully better.
- **Recommendation:** The polling approach is fine for now. Tests are fast (1-1.5s each) and reliable. If the test suite grows to 100+ interactive tests and polling becomes a bottleneck, consider the EventEmitter optimization. This is a low-priority improvement.
- **Should this become a standard?** The current polling approach is acceptable. Document the EventEmitter alternative for future optimization if needed.

### Finding 35: `delay()` utility cannot use fake timers

- **File(s):** `e2e/helpers/test-utils.ts` (line 46-47)
- **Issue:** The `delay()` function uses `setTimeout` for real-time waiting. `vi.advanceTimersByTime()` or `vi.useFakeTimers()` cannot be used because E2E tests spawn real subprocesses via PTY — the timers in the test process are independent from the timers in the CLI subprocess. Fake timers would only advance the test's own event loop, not the CLI's rendering timers.
- **Recommendation:** Keep `delay()` as-is. Real `setTimeout` is the only correct approach for E2E tests that interact with real subprocesses. Fake timers are appropriate for unit tests with mocked dependencies, not for E2E tests with real processes.
- **Should this become a standard?** YES. Never use fake timers in E2E tests that spawn subprocesses. Real delays are required for synchronization with external processes.

### Finding 36: `cleanupTempDir` retry logic — no standard library needed

- **File(s):** `e2e/helpers/test-utils.ts` (lines 53-69), `src/cli/lib/__tests__/helpers.ts` (lines 254-271)
- **Issue:** Both E2E and unit test helpers implement the same retry loop for `rm` that catches `ENOTEMPTY` errors (a transient macOS issue where the kernel hasn't released directory entries). Alternatives considered:
  - **`rimraf`** — production-grade `rm -rf` but does NOT retry on `ENOTEMPTY` by default. Would need the same retry wrapper.
  - **`del`** — similar to rimraf, no built-in retry.
  - **`p-retry`** — generic retry utility. Would clean up the loop slightly but adds a dependency for 15 lines of code.
  - **Node.js `fs.rm` with `{ recursive: true, force: true, maxRetries: 3 }`** — the `maxRetries` option was added in Node 12.10 for `EBUSY`, `EMFILE`, `ENFILE`, `ENOTEMPTY`, and `EPERM`. This is the built-in solution.
- **Recommendation:** Replace the custom retry loop with Node.js built-in `fs.rm` options: `await rm(dirPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })`. This eliminates the manual retry loop entirely (both in E2E and unit helpers) and uses the platform's built-in retry mechanism. The `maxRetries` and `retryDelay` options handle the exact same `ENOTEMPTY` case.
- **Should this become a standard?** YES. Use Node.js built-in `maxRetries` and `retryDelay` options on `fs.rm` instead of manual retry loops. This simplifies both `cleanupTempDir` implementations to a single `rm()` call.

### Finding 37: `createE2ESource` partially duplicates `createTestSource` patterns

- **File(s):** `e2e/helpers/create-e2e-source.ts`, `src/cli/lib/__tests__/fixtures/create-test-source.ts`
- **Issue:** `createE2ESource()` creates a full source directory with skills, stacks, and agents for E2E testing. The unit test fixture `createTestSource()` does similar work but with different data and structure. Key differences:
  - `createE2ESource` writes real SKILL.md files, metadata.yaml, stacks.yaml, metadata.yaml (agents), and liquid templates — it builds a genuine source directory that the CLI can consume end-to-end.
  - `createTestSource` creates mock source structures optimized for unit/integration tests with in-process CLI calls.
  - `createE2ESource` imports `createMockSkillAssignment` from the unit helpers, showing that cross-referencing already exists.
- **Recommendation:** Do NOT merge these two. They serve different purposes: `createE2ESource` builds a real filesystem source for subprocess-based tests; `createTestSource` builds lightweight mock structures for in-process tests. The cross-import of `createMockSkillAssignment` is fine and shows appropriate reuse. However, the duplicated `createTempDir`/`cleanupTempDir`/`fileExists`/`directoryExists` utilities (Finding 30) should be shared.
- **Should this become a standard?** Keep separate source creators for E2E vs unit tests. Share only the low-level filesystem utilities.

### Finding 38: `execa` usage pattern could benefit from a thin wrapper

- **File(s):** All 17 command E2E test files
- **Issue:** Every non-interactive command test follows the same pattern:
  ```typescript
  const result = await execa("node", [BIN_RUN, "command", ...args], {
    cwd: tempDir,
    reject: false,
  });
  const stdout = stripAnsi(result.stdout);
  const combined = stripAnsi(result.stdout + result.stderr);
  ```
  This 3-4 line pattern is repeated 100+ times across all command test files. The `reject: false` and `stripAnsi` calls are always present.
- **Recommendation:** Consider adding a thin helper to `test-utils.ts`:
  ```typescript
  export async function runCLI(args: string[], cwd: string) {
    const result = await execa("node", [BIN_RUN, ...args], { cwd, reject: false });
    return {
      exitCode: result.exitCode,
      stdout: stripAnsi(result.stdout),
      stderr: stripAnsi(result.stderr),
      combined: stripAnsi(result.stdout + result.stderr),
    };
  }
  ```
  This would reduce boilerplate across all 17 command test files and ensure consistent handling. The unit test helpers already have `runCliCommand()` which does something similar (in-process).
- **Should this become a standard?** YES, but as a low-priority improvement. The current pattern works fine and is readable. A wrapper would reduce ~200 lines of boilerplate but introduces indirection. Consider implementing when the next batch of command tests is written.

### Finding 39: Missing `disableConsoleIntercept` in E2E vitest config — not needed

- **File(s):** `e2e/vitest.config.ts`
- **Issue:** The E2E vitest config does not include `disableConsoleIntercept: true`, which is required for unit tests that capture stdout/stderr. However, E2E tests spawn subprocesses via `execa` or PTY — they never intercept the test process's console. The CLI runs in a separate process, so `disableConsoleIntercept` is irrelevant.
- **Recommendation:** No change needed. `disableConsoleIntercept` is a unit-test concern. E2E tests capture output from subprocesses, not from the test process itself.
- **Should this become a standard?** Document this distinction: `disableConsoleIntercept` is required in unit test vitest configs but not in E2E vitest configs.
