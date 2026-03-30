# Agents Inc. CLI - Task Tracking

| ID    | Task                                                                                          | Status        |
| ----- | --------------------------------------------------------------------------------------------- | ------------- |
| D-171 | Style edit command output — green added, red removed, white titles, gray body, proper spacing | Ready for Dev |
| D-170 | Add PostHog anonymous telemetry — skill installs, wizard funnel, command errors, platform     | Investigate   |
| D-169 | Improve `list` command — show all installed skills and agents                                 | Investigate   |
| D-168 | Audit E2E tests — replace manual file construction with CLI commands throughout               | Ready for Dev |
| D-165 | Fix 4 type-system critical issues from D-138 audit (double casts, non-null, invalid casts)    | Ready for Dev |
| D-166 | Fix E2E try/finally blocks in 6 lifecycle/interactive test files                              | Ready for Dev |
| D-167 | Remove task IDs from describe() blocks in init-wizard test files                              | Ready for Dev |
| D-138 | Iterate on sub-agents — review and improve all agent definitions                              | Ready for Dev |
| D-111 | Create a GIF demo for the README                                                              | Ready for Dev |
| D-110 | Fix the logo in the README                                                                    | Ready for Dev |
| D-109 | Fix the screenshots in the README                                                             | Ready for Dev |
| D-62  | Review default stacks: add reviewing/research skills                                          | Ready for Dev |
| D-118 | Investigate renaming "project/global" scope to "project/user"                                 | Investigate   |
| D-150 | Migrate E2E tests from `toggleSkill` to `selectSkill` for correct grid targeting              | Ready for Dev |
| D-131 | Track project installations in global config                                                  | Investigate   |
| D-127 | UX for claiming global skills/agents into project scope                                       | Investigate   |
| D-125 | Fix weak E2E assertions — scope-blind `\|\|` checks and fragile display names                 | Ready for Dev |
| D-122 | Auto-update marketplace before plugin install                                                 | Ready for Dev |
| D-111 | Replace E2E text anchors with stable test identifiers                                         | Investigate   |
| D-90  | Add Sentry tracking for unresolved matrix references                                          | Ready for Dev |
| D-41  | Create `agents-inc` configuration skill. [Plan](./D-41-config-sub-agent.md)                   | Ready for Dev |
| D-52  | Expand `new agent` command. [Plan](./D-52-expand-new-agent.md)                                | Ready for Dev |
| D-64  | Create CLI E2E testing skill + update `cli-framework-oclif-ink`                               | Ready for Dev |
| D-66  | AI-assisted PR review: categorize diffs by type                                               | Investigate   |
| D-69  | Config migration strategy for outdated config shapes                                          | Investigate   |
| D-151 | E2E session-level timeout — configurable `defaultTimeout` in `TerminalSession`                | Ready for Dev |
| D-164 | Improve confirm step UI — structured summary with scope/mode breakdown                        | Investigate   |
| D-162 | Skill Olympics — benchmark and optimize expressive-typescript skill via competitive arena     | Investigate   |

---

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For refactoring tasks, see [TODO-refactor.md](./TODO-refactor.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).
For final release tasks, see [TODO-final.md](./TODO-final.md).

---

## Reminders for Agents

See [docs/guides/agent-reminders.md](../docs/guides/agent-reminders.md) for the full list of rules (use specialized agents, handle uncertainties, blockers, commit policy, archiving, status updates, context compaction, cross-repo changes).

---

## Active Tasks

### Code Quality

#### D-168: Audit E2E tests — replace manual file construction with CLI commands

**Priority:** Medium

E2E tests must only use CLI commands to create state. Manual file system construction (writing config files, skill dirs, agent files directly via `fs`) bypasses the CLI and creates fragile, divergence-prone setups that break silently when the CLI's internal format changes.

**What to look for:**

- `writeProjectConfig()` calls inside `it()` bodies or local helper functions — replace with `cc init` via `InitWizard` or `EditWizard`
- `writeFile()` / `mkdir()` calls constructing `.claude/skills/`, `.claude/agents/`, or config files manually
- Local helper functions like `createDualScopeInstallation()`, `createLocalSkillWithForkedFrom()` that build internal state by hand
- Any test that imports `writeFile`, `mkdir`, `fs-extra` directly and uses them to set up preconditions

**Exceptions (acceptable):**

- `beforeAll` source fixture setup (`createE2ESource`, `createE2EPluginSource`) — these create a skill _source_, not CLI state
- `createPermissionsFile()` — sets up `.claude/settings.json` which has no CLI command equivalent
- `ProjectBuilder` fixture methods — these are acceptable scaffolding for non-wizard lifecycle tests

**Process:** Go file by file through `e2e/lifecycle/`, `e2e/interactive/`, and `e2e/commands/`. For each manual construction found, either replace with wizard-based setup or document why it cannot be replaced and what CLI gap it represents.

---

#### D-165: Fix 4 type-system critical issues from D-138 audit

**Priority:** Medium

Identified during the comprehensive D-138 project audit. All four are straightforward violations of CLAUDE.md rules.

1. **`src/cli/commands/base-command.ts:23` + `src/cli/hooks/init.ts:45`** — `as unknown as ConfigWithSource` double casts. Violates "NEVER use `as unknown as T` double casts — fix the upstream type instead." Create a proper type helper or narrow the type at the oclif boundary.

2. **`src/cli/commands/eject.ts:193,198`** — `sourceResult!` non-null assertions after conditional switch assignment. Restructure the switch so `sourceResult` is always assigned before use, eliminating the need for non-null assertions.

3. **`src/cli/commands/new/marketplace.ts:248,255`** — `skillName as SkillId` and `LOCAL_DEFAULTS.CATEGORY as Category` casts on values that are not in the respective unions (dummy values for generated config). Either change these to use real valid members, or if intentionally invalid, document why at the boundary.

---

### Bugs

#### D-123: Local mode ENOENT on consuming projects

**Priority:** Medium

`source-loader.ts` sets `sourcePath: ""` for `BUILT_IN_MATRIX`, so `skill-copier.ts` builds relative paths that only work inside the marketplace repo. Local mode needs to fetch source first (like pre-`9189b22` `loadFromRemote` did) when default source is used.

---

#### D-122: Auto-update marketplace before plugin install

**Priority:** Medium

Stale Claude CLI marketplace clone causes "not found" errors for renamed/new skills. Add `claudePluginMarketplaceUpdate()` to `exec.ts`, call in `init.tsx` when marketplace already exists (retry-on-failure or always-update).

---

#### D-131: Track project installations in global config

**Priority:** Medium

Add `projects?: string[]` to global config, updated by init/edit/uninstall. Warn on global uninstall if project installations still depend on it. Prevents broken TypeScript imports when global is uninstalled before projects. Stale entries handled by `fileExists` check.

---

### Framework Features

#### D-41: Create `agents-inc` configuration skill

**Priority:** Medium

Create a configuration **skill** (not a sub-agent) that gives Claude deep expertise in the Agents Inc CLI's YAML config system. The skill loads into the main conversation on demand, enabling interactive config work — Claude can ask clarifying questions, propose changes, and iterate with the user.

**Why a skill instead of an agent:** Sub-agents (Task tool) are not interactive — they run autonomously and return a single result. Config tasks frequently need clarification ("Which category?", "Replace or add alongside?"). A skill in the main conversation preserves full interactivity.

**What it teaches Claude:**

- Creates and updates `metadata.yaml` files for skills (with correct domain-prefixed `category` values, author, displayName, etc.)
- Creates and updates `stacks.yaml` entries (agent definitions, skill assignments, preloaded flags)
- Updates `skills-matrix.yaml` (adding/modifying categories, skill entries, dependency rules)
- Updates `.claude-src/config.yaml` mappings (source paths, plugin settings, skill assignments)
- Knows the valid `Category` enum values (38) and enforces them
- Understands skill relationships (`requires`, `compatibleWith`, `conflictsWith`, `requiresSetup`, `providesSetupFor`)
- Validates configs against embedded schema knowledge

**User invocation:** "Use Agents Inc to register my skill" / "Use Agents Inc to add a stack" / "Use Agents Inc to validate my config"

**Implementation:**

- Create `meta-config-agents-inc` skill in the skills repo (SKILL.md + metadata.yaml)
- Category: `shared-tooling`, display name: "Agents Inc"
- SKILL.md embeds the full config knowledge base (~500-600 lines)
- No TypeScript changes required (unlike the agent design which needed schema/type updates)
- Register in `.claude-src/config.yaml` and assign to relevant agents via stacks

**Acceptance criteria:**

- [ ] Can create a valid `metadata.yaml` from a skill name and category
- [ ] Can register an existing skill interactively: read SKILL.md, ask clarifying questions, generate metadata.yaml, wire into config.yaml (replaces D-40)
- [ ] Can add a new stack to `stacks.yaml` with correct agent/category/skill structure
- [ ] Can add a new category to `skills-matrix.yaml` with proper schema
- [ ] Validates all output against schema rules (embedded knowledge)
- [ ] Refuses to use bare category names (enforces domain-prefix)
- [ ] Loads correctly via Skill tool for both users and other agents

---

#### D-138: Iterate on sub-agents — systematic improvement pass

**Priority:** Medium

All agent definitions in `src/agents/` should be reviewed and improved using the agent-summoner's Improve Mode. Each agent was written at a point in time and may not reflect current project conventions, CLAUDE.md rules, or lessons learned from the convention-keeper's findings.

**Scope:**

| Category  | Agents                                                          |
| --------- | --------------------------------------------------------------- |
| Meta      | agent-summoner, skill-summoner, codex-keeper, convention-keeper |
| Reviewer  | cli-reviewer, web-reviewer, api-reviewer                        |
| Developer | cli-developer, web-developer                                    |
| Tester    | cli-tester, web-tester                                          |
| Pattern   | web-pattern-critique, pattern-scout                             |
| Planning  | web-pm                                                          |
| Research  | web-researcher                                                  |

**For each agent:**

1. Read the current source files (`metadata.yaml`, `intro.md`, `workflow.md`, `critical-requirements.md`, `output-format.md`, `critical-reminders.md`, `examples.md`)
2. Cross-reference against CLAUDE.md NEVER/ALWAYS rules — does the agent enforce them?
3. Check `.ai-docs/agent-findings/` for findings where `reporting_agent` matches — does the agent's instructions prevent recurrence?
4. Ensure the agent includes the findings capture instruction (write to `.ai-docs/agent-findings/` when anti-patterns are discovered)
5. Use agent-summoner Improve Mode to propose and apply improvements
6. Recompile and verify

**Key improvements to look for:**

- Missing CLAUDE.md rules (e.g., git safety, type cast restrictions)
- Missing findings capture instruction
- Outdated file paths or function references
- Weak or missing self-correction triggers
- Output format gaps
- Missing domain knowledge that would prevent common mistakes

**Approach:** Do 2-3 agents per session. Start with the most-used agents (cli-developer, cli-tester, cli-reviewer).

---

### Commands

#### D-169: Improve `list` command — show all installed skills and agents

**Priority:** Medium

The current `list` command output is minimal. It should show a complete picture of what's installed — all skills (by scope and install mode) and all compiled agents (by scope).

**Goals:**

- List all installed skills grouped by scope (global / project) with their install mode (plugin / eject)
- List all compiled agents grouped by scope (global / project)
- Match the visual style used in the confirm step (bordered tables, scope-grouped columns)

**Key files:**

- `src/cli/commands/list.ts` — command to redesign
- `src/cli/components/wizard/step-confirm.tsx` — visual reference for the table layout

---

### Wizard UX

#### D-164: Improve confirm step UI

**Priority:** Medium

The current confirm step (`step-confirm.tsx`) shows a flat list of plain text lines (Technologies, Skills, Agents, Install mode, Scope). It doesn't match the visual style of the rest of the wizard and gives no breakdown of what's actually being installed.

**Goals:**

- Show a two-column layout matching the info panel style: Global | Project, broken down by Plugin / Eject
- List skill slugs grouped by domain (not just a count), truncated if too long
- Show agent names grouped by scope
- Surface the install mode per scope — e.g. "3 plugin, 1 eject" rather than the flat `Mixed (1 eject, 3 plugin)` label
- Use `computeStats` from `stats-panel.js` for counts to stay consistent with the info panel

**Key files:**

- `src/cli/components/wizard/step-confirm.tsx` — component to redesign
- `src/cli/components/wizard/stats-panel.js` — `computeStats` to reuse
- `src/cli/components/wizard/info-panel.tsx` — visual reference

---

#### D-127: UX for claiming global skills/agents into project scope

**Priority:** Low

When running `cc edit` from a project dir, allow users to "claim" global skills/agents into the project. Needs design: how to present this, confirmation UX, what happens to the global config entry.

---

#### D-62: Review default stacks: include meta/methodology/reviewing skills

Go through all default stacks and ensure they include the shared meta skills (methodology, reviewing, research, etc.) that should be part of every reasonable setup. Currently stacks only include domain-specific skills and miss the cross-cutting concerns.

**Skills to consider adding to stacks:**

- `meta-methodology-*` — investigation-requirements, anti-over-engineering, success-criteria, write-verification, improvement-protocol, context-management
- `meta-reviewing-*` — reviewing, cli-reviewing
- `meta-research-*` — research-methodology
- `security-auth-security` — where auth skills are selected

**Key files:**

- `stacks.yaml` in the skills repo (`/home/vince/dev/skills`)
- Stack definitions that feed into the wizard's stack selection step

---

#### D-64: Create CLI E2E testing skill + update `cli-framework-oclif-ink` skill

The project's E2E test infrastructure uses several CLI-specific testing libraries that have no corresponding skill. The existing `cli-framework-oclif-ink` skill also needs updating to reflect current patterns.

**New skill: CLI E2E testing with node-pty + xterm**

Consider creating a `cli-testing-node-pty` or `cli-testing-e2e` skill covering:

- **`@lydell/node-pty`** — PTY process spawning for interactive CLI tests. Allocates a pseudo-terminal so the CLI under test behaves exactly as it would in a real terminal (ANSI escape sequences, cursor movement, line editing).
- **`@xterm/headless`** — Headless terminal emulator used as a screen buffer. PTY output is piped into xterm, which processes all ANSI sequences and maintains proper screen state. `getScreen()` returns what the user would see.
- **`tree-kill`** — Kills entire process trees (not just the parent PID). Essential for cleaning up PTY processes that spawn child processes.
- **`TerminalSession` pattern** — The project's wrapper class (`e2e/helpers/terminal-session.ts`) that combines node-pty + xterm into an assertion-friendly API: `waitForText()`, `sendKey()`, `getScreen()`, `sendLine()`.
- **Non-interactive E2E pattern** — Using `execa` with `runCLI()` helper for commands that don't need interactive input. Pattern: spawn process, capture stdout/stderr, strip ANSI, assert on exit code and output.
- **E2E test structure** — `createTempDir()`/`cleanupTempDir()` lifecycle, `ensureBinaryExists()` guard, separate vitest config for E2E (`e2e/vitest.config.ts`).

**Update existing skill: `cli-framework-oclif-ink`**

The current skill covers oclif command structure and Ink component patterns but is missing:

- Testing patterns for oclif commands (unit tests with `@oclif/test`, integration tests with `runCliCommand()`)
- Ink component testing with `ink-testing-library` (render, lastFrame, stdin)
- The project's `BaseCommand` pattern (custom error handling, logging helpers, `handleError()`)
- Current conventions: `displayName` in metadata, `METADATA_KEYS` constants, `EXIT_CODES` usage

**Reference files:**

- `e2e/helpers/terminal-session.ts` — TerminalSession class
- `e2e/helpers/test-utils.ts` — runCLI, createTempDir, etc.
- `e2e/vitest.config.ts` — E2E test runner config
- `src/cli/base-command.ts` — BaseCommand pattern

---

### Testing

#### D-166: Fix E2E try/finally blocks in 6 lifecycle/interactive test files

**Priority:** Medium

Identified during D-138 audit. Violates `test-structure.md`: "Do not use `try/finally` for cleanup in test bodies. `afterEach` runs even when tests throw."

Affected files:

- `e2e/lifecycle/global-scope-lifecycle.e2e.test.ts` — 8 finally blocks
- `e2e/lifecycle/config-scope-integrity.e2e.test.ts` — 3 finally blocks
- `e2e/lifecycle/dual-scope-edit-mixed-sources.e2e.test.ts`
- `e2e/lifecycle/dual-scope-edit-source-changes.e2e.test.ts`
- `e2e/lifecycle/source-switching-per-skill.e2e.test.ts`
- `e2e/interactive/real-marketplace.e2e.test.ts`

Pattern: `cleanupTempDir(tempDir)` in finally blocks inside `it()` bodies. Fix: lift `tempDir` to describe scope, assign in test body, clean in `afterEach`.

---

#### D-167: Remove task IDs from describe() blocks

**Priority:** Low

Violates convention: task IDs belong in file-level JSDoc, not embedded in describe() strings.

- `e2e/interactive/init-wizard-default-source.e2e.test.ts:27` — `"(D-122)"` in describe string
- `e2e/interactive/init-wizard-default-source.e2e.test.ts:104` — `"(D-123)"` in describe string
- `e2e/interactive/init-wizard-sources.e2e.test.ts` — `"(Gap 8)"` in describe string

Move IDs to JSDoc comment above the describe block. Also fix: `e2e/interactive/search-interactive.e2e.test.ts:40` uses `sourceTempDir = undefined` instead of `sourceTempDir = undefined!` per documented reset pattern.

---

#### D-150: Migrate E2E tests from `toggleSkill` to `selectSkill`

**Priority:** Low

`toggleSkill(label)` in `BuildStep` only verifies the label is visible on screen, then presses Space on **whatever is currently focused** — it doesn't navigate to the target. All existing usages work by coincidence because the target skill happens to be at the focused position (col 0 of the focused category). If a future test targets a skill at a different position, `toggleSkill` would silently toggle the wrong item.

**Affected tests (7 call sites across 4 files):**

- `init-wizard-scratch.e2e.test.ts:50` — `toggleSkill("react")` (works: react is at (0,0))
- `init-wizard-stack.e2e.test.ts:166` — `toggleSkill("react")` (works: same reason)
- `edit-wizard-local.e2e.test.ts:73` — `toggleFocusedSkill()` after `navigateDown()` (fine: intentionally position-based)
- `edit-wizard-local.e2e.test.ts:110,144` — `toggleSkill("vitest")` after `navigateDown()` (works: vitest is only item in Testing)

**Action:** Replace `toggleSkill(label)` calls with `selectSkill(label)` which properly navigates to the target's (row, col) position in the grid before pressing Space. Leave `toggleFocusedSkill()` calls as-is — they're intentionally position-based.

**Also consider:** deprecating or removing `toggleSkill` from `BuildStep` to prevent future misuse.

---

#### D-111: Stable test identifiers for active state detection

**Priority:** Medium

E2E tests currently use `STEP_TEXT` display strings (e.g., `"Choose a stack"`, `"Framework"`) to identify wizard steps. These break when labels change. More critically, there's no way to assert which tab or domain is _active_ vs merely present — tests can only check that text exists on screen.

**Goal:** Tests should be able to assert that a specific tab/domain is in the active state (e.g., "Shared domain is active" not just "Shared text is visible").

**Ruled out approaches:**

- Zero-width Unicode characters (`\u200B`) — Yoga counts them as layout characters, breaking box border alignment
- Transparent/hidden text color — terminals have no concept of transparent; `getScreen()` strips color info

**Direction to investigate:**

- Parse raw ANSI escape sequences from the PTY buffer instead of using `getScreen()`. Active items already emit distinct ANSI codes (bold + warning color). A `TerminalSession` method like `hasStyledText("Shared", { bold: true })` could check the raw stream without any UI changes.
- Alternative: xterm's buffer API may expose cell-level style attributes that survive processing.

---

#### D-151: E2E session-level timeout override

**Priority:** Low

`TerminalSession` and `BaseStep` should hold a `defaultTimeout` property overridable at construction time, replacing the current pattern of threading timeout values through every per-call method parameter.

---

#### D-125: Fix weak E2E test assertions

**Priority:** Medium

(1) `source-switching-modes.e2e.test.ts` and `init-then-edit-merge.e2e.test.ts` use `agentInProject || agentInHome` cop-out assertions instead of verifying the agent is in the CORRECT scope-specific location. (2) `edit-wizard-detection.e2e.test.ts` asserts fragile category display names ("Framework", "Testing") on a screen that may show domain selection instead of skill grid. All assertions should verify exact expected location/content based on the agent/skill scope.

---

#### D-124: E2E tests for default source path

**Priority:** Medium

No E2E test exercises the `DEFAULT_SOURCE` / `BUILT_IN_MATRIX` code path (all tests use `--source`). Add tests for: (1) stale marketplace clone scenario (register, modify source, re-init), (2) local install mode without `--source` flag from a consuming project.

---

### Bugs

#### D-90: Add Sentry tracking for unresolved matrix references

**Priority:** Medium

In `src/cli/lib/matrix/matrix-resolver.ts`, `getDiscourageReason()` (lines 213-227) and `validateSelection()` (lines 315, 342, 381, 444) use `findSkill(id)` with fallback to the raw ID when a skill referenced in `requires`, `conflictsWith`, or `providesSetupFor` doesn't exist in the matrix. This is intentionally graceful — crashing the wizard on bad matrix data is worse than degraded labels. But we need visibility into how often this happens.

Add Sentry `captureMessage` (or `captureException`) calls on every fallback path so we can track unresolved matrix references in production. Include the referencing skill ID, the missing referenced ID, and the relationship type (`requires`, `conflictsWith`, `providesSetupFor`) in the Sentry context.

**Key file:** `src/cli/lib/matrix/matrix-resolver.ts`

---

### Skill Quality

#### D-162: Skill Olympics — benchmark and optimize expressive-typescript skill

**Priority:** Medium | **Plan:** [D-162-skill-olympics/plan.md](./D-162-skill-olympics/plan.md) | **Catalog:** [D-162-skill-olympics/test-catalog.md](./D-162-skill-olympics/test-catalog.md)

Competitive arena: 100 contestants catalogued, 10 selected for proof of concept × 5 test cases from codebase anti-patterns. Score on 10-axis rubric, Frankenstein winners, then chain skills (run A→B to test post-processing combos). Phases 1-4 done (harvest, test case extraction, constraints, contestant prompts). Next: Phase 3 (arena runs).

---

## Testing Tasks

See [TODO-testing.md](./TODO-testing.md) for the full testing guide: coverage table (what is and isn't tested), automated test tasks T1-T6, step-by-step manual procedures for every command, and the 28-point quick-pass checklist.

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/skills`
- CLI under test: `/home/vince/dev/cli`
