# Agents Inc. CLI - Final TODO

These are the remaining tasks to complete for the CLI.

| ID             | Task                                           | Status  |
| -------------- | ---------------------------------------------- | ------- |
| WUX-3          | Visually verify wizard UX changes              | Pending |
| U-UI-ITERATION | Wizard UI polish pass                          | Pending |
| #2             | Add proper documentation                       | Pending |
| #1             | Create proper Work web stack                   | Pending |
| U15            | Add comprehensive help overlay                 | Pending |
| D-65           | Task confidence scoring for agent invocations  | Pending |
| T-10           | Rewrite command tests to use real CLI pipeline | Pending |
| B-08           | Scale back discouraged skill logic             | Pending |
| B-09           | Validate --source flag in init command         | Pending |

---

## WUX-3: Visually Verify Wizard UX Changes

The agents reported success on wizard UX changes but visual verification is needed. Manually verify:

- No icons in skill tags
- No colored borders on unfocused tags
- Stable skill order
- Proper tag wrapping on narrow terminals

**Action:** Manual testing with `agentsinc init` or `agentsinc edit` in an 80-column terminal.

---

## U-UI-ITERATION: Wizard UI Polish Pass

Iterate over the full wizard UI to improve visual consistency, spacing, and clarity across all steps (Stack, Build, Sources, Confirm). Review column widths, alignment, color usage, empty states, and overall visual hierarchy.

**Files:** `src/cli/components/wizard/`

---

## #2: Add Proper Documentation

Create comprehensive documentation covering the project structure, usage patterns, configuration options, and development guidelines. This should help developers understand and contribute to the project effectively.

---

## #1: Create Proper Work Web Stack

Build a comprehensive web stack configuration for work-related projects. This should include all necessary tooling, frameworks, and configurations needed for professional web development.

---

## U15: Add Comprehensive Help Overlay (also UX-08)

Add a comprehensive help section/overlay accessible via `?` key to show users how to get the most out of the CLI. This consolidates the deferred UX-08 (keyboard shortcuts help overlay) task.

- Keyboard shortcuts (expand on existing help modal)
- Navigation patterns
- Tips for wizard flow
- Common workflows (init, edit, compile, update)
- Source management tips
- Context-sensitive help (different content per step)
- In-wizard help for keybindings (from UX-08)

**Files:** `src/cli/components/wizard/help-modal.tsx`

---

## D-65: Task Confidence Scoring for Agent Invocations

Each task delegated to a subagent should report a confidence value indicating whether it had enough context and clarity to complete the work properly. This catches under-specified tasks early rather than discovering incomplete work after the fact.

**What this means:**

- When a subagent finishes a task, it reports a confidence level (e.g., high/medium/low or a numeric score)
- Low confidence = the task description was ambiguous, key files were missing, the implementation plan was incomplete, or assumptions had to be made
- High confidence = clear spec, all files identified, straightforward execution

**Possible implementations:**

- Structured output from subagents: require a `confidence` field in the result
- Pre-commit hook that checks whether all tasks in the PR tracking file have confidence annotations
- A validation step in the PR workflow that flags tasks without confidence scores
- Could be enforced via CLAUDE.md rules for subagent delegation patterns

**Open questions:**

- Should this be a property of the subagent prompt template (baked into how agents report results)?
- Or a separate validation pass (like a pre-commit hook that parses PR tracking files)?
- What's the right granularity: per-task, per-commit, or per-PR?

---

## T-10: Rewrite Command Tests to Use Real CLI Pipeline

Multiple command tests manually construct filesystem state (config.yaml, agent .md files, skill directories) and then either call internal functions directly or run commands that just read back what was written. These tests verify nothing — they're round-tripping through writeFile → readFile. Integration tests should call the actual CLI commands and let the real pipeline produce the state.

**Offending files:**

| File                   | Tests                                                         | Issue                                                                                                                        |
| ---------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `init.test.ts`         | "already initialized — dashboard" (6 tests)                   | Manually writes config.yaml + agent files, then calls `getDashboardData()` directly instead of running init to produce state |
| `eject.test.ts`        | "eject skills" + "eject in plugin mode" (11 tests)            | Calls `copySkillsToLocalFlattened()` directly instead of `runCliCommand(["eject", "skills"])`                                |
| `list.test.ts`         | "should show installation info"                               | Manually creates config + agents + skills, then runs list command to read them back                                          |
| `doctor.test.ts`       | "agents check" (3 tests)                                      | Manually writes compiled agent files, then runs doctor to detect them                                                        |
| `config/index.test.ts` | "config:show" + "config:set-project" + "config:unset-project" | Manually writes config, reads back with `readFile()`+`parseYaml()` instead of using command output                           |

**Not offending (leave alone):**

- `formatDashboardText` tests — pure function unit tests, inline data is fine
- Flag validation tests — correctly use `runCliCommand` for CLI behavior
- `uninstall.test.ts` — manual setup is justified (needs pre-existing installation state for edge cases)
- `validate.test.ts` — manual plugin.json creation is justified (needs invalid/valid structure variants)
- `doctor.test.ts` "config validation" — testing invalid YAML variants requires manual construction

**Approach:** For each offending test, replace manual filesystem setup with a real CLI flow:

1. Run `agentsinc init` (with a test source) to produce real config + agents
2. Then run the command being tested against that real state
3. Assert on command output/exit codes, not raw filesystem reads

---

## B-08: Scale Back Discouraged Skill Logic

Currently, in exclusive categories (where only one skill should be selected), selecting any skill marks all other skills in the category as "discouraged". This is not meaningful — it just means "you already picked one", which the exclusive flag already communicates. The discouraged state should be reserved for genuinely discouraged combinations:

- The skill doesn't work well with the currently selected skill (explicit `discourages` relationship in the matrix)
- The skill would replace the selected skill but there are compatibility concerns

**Current behavior:** In an exclusive category with 5 framework options, selecting React marks Vue, Angular, Svelte, and Solid as "discouraged" — which is misleading. They're not discouraged, they're just alternatives.

**Desired behavior:** Only mark skills as discouraged when the matrix `relationships.discourages` explicitly says so. Exclusive category mutual exclusion should be handled by the exclusive flag UI (e.g., radio-button behavior or a simple "1 of N" indicator), not by the discouraged visual treatment.

**Files:** `src/cli/components/wizard/category-grid.tsx`, `src/cli/lib/wizard/build-step-logic.ts`, matrix relationship resolution logic

---

## B-09: Validate --source Flag in Init Command

Currently `agentsinc init --source <value>` silently accepts any string, even if it's not a valid repository. If the source doesn't exist or can't be resolved, the wizard just ignores it and proceeds with default sources. It should validate the source early and fail with a clear error message before entering the wizard.

**Expected behavior:**

- Validate that the `--source` value resolves to an accessible repository (local path exists, or `github:org/repo` can be fetched)
- If invalid, exit with a clear error message (e.g., "Source 'xyz' is not a valid repository path or GitHub reference")
- Validation should happen before the wizard renders, not silently swallowed during skill loading

**Files:** `src/cli/commands/init.tsx`, source resolution/fetching logic
