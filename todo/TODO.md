# Agents Inc. CLI - Task Tracking

| ID    | Task                                                                                                                                      | Status        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| D-157 | Eliminate hardcoded marketplace data from CLI — categories, rules, domain-agents. [Plan](./D-157-eliminate-hardcoded-marketplace-data.md) | Investigate   |
| D-156 | Rename "local mode" to "eject mode" across CLI commands, config, types, and documentation                                                 | Ready for Dev |
| D-155 | Declarative commands — two-tier orchestrator for all commands. [Plan](./D-155-declarative-commands.md)                                    | Complete      |
| D-152 | Fix ENOENT in dual-scope skill copy — global `localPath` resolved against cwd not homedir                                                 | Ready for Dev |
| D-149 | Stop inferring metadata from names/paths. [Findings](../.ai-docs/agent-findings/2026-03-25-skill-metadata-inference-from-names.md)        | Complete      |
| D-148 | Remove unnecessary test mocks in 3 plugin test files                                                                                      | Complete      |
| D-154 | Organize 26 operation files into domain subfolders, update barrel exports and imports                                                     | Ready for Dev |
| D-153 | Standardize operation result types — consistent list/single-action return patterns                                                        | Deferred      |
| D-145 | Operations layer — centralize repeated command sequences. [Proposal](./D-145-operations-layer.md)                                         | Complete      |
| D-124 | E2E tests for default source path (`BUILT_IN_MATRIX` code path)                                                                           | Ready for Dev |
| D-123 | Local mode ENOENT — empty `sourcePath` for built-in matrix on consuming projects                                                          | Ready for Dev |
| D-92  | Global config missing `source`, `marketplace`, `selectedAgents` on init                                                                   | In Progress   |
| D-144 | Info panel — replace `?` overlay with `I` panel (stats, context, toggles)                                                                 | Investigate   |
| D-118 | Investigate renaming "project/global" scope to "project/user"                                                                             | Investigate   |
| D-97  | Improve startup time — lazy-load matrix generation                                                                                        | Investigate   |
| D-138 | Iterate on sub-agents — review and improve all agent definitions                                                                          | Ready for Dev |
| D-150 | Migrate E2E tests from `toggleSkill` to `selectSkill` for correct grid targeting                                                          | Ready for Dev |
| D-116 | Filter Incompatible toggle should also deselect incompatible skills                                                                       | Complete      |
| D-132 | Skip incompatibility markers in exclusive (radio) categories                                                                              | Complete      |
| D-131 | Track project installations in global config                                                                                              | Investigate   |
| D-140 | Agent gap analysis — add 5 new agents. [Proposal](./D-140-agent-gap-analysis.md)                                                          | Ready for Dev |
| D-111 | Create a GIF demo for the README                                                                                                          | Ready for Dev |
| D-110 | Fix the logo in the README                                                                                                                | Ready for Dev |
| D-109 | Fix the screenshots in the README                                                                                                         | Ready for Dev |
| D-130 | Narrow stack type safety — category-scoped SkillId unions. Depends on D-97                                                                | Investigate   |
| D-129 | Add visibility into global config contents from project config                                                                            | Complete      |
| D-127 | UX for claiming global skills/agents into project scope                                                                                   | Investigate   |
| D-125 | Fix weak E2E assertions — scope-blind `\|\|` checks and fragile display names                                                             | Ready for Dev |
| D-122 | Auto-update marketplace before plugin install                                                                                             | Ready for Dev |
| D-62  | Review default stacks: add reviewing/research skills                                                                                      | Ready for Dev |
| D-112 | Create a guide for setting up AI documentation                                                                                            | Ready for Dev |
| D-111 | Replace E2E text anchors with stable test identifiers                                                                                     | Investigate   |
| D-90  | Add Sentry tracking for unresolved matrix references                                                                                      | Ready for Dev |
| D-41  | Create `agents-inc` configuration skill. [Plan](./D-41-config-sub-agent.md)                                                               | Ready for Dev |
| D-52  | Expand `new agent` command. [Plan](./D-52-expand-new-agent.md)                                                                            | Ready for Dev |
| D-64  | Create CLI E2E testing skill + update `cli-framework-oclif-ink`                                                                           | Ready for Dev |
| D-66  | AI-assisted PR review: categorize diffs by type                                                                                           | Investigate   |
| D-69  | Config migration strategy for outdated config shapes                                                                                      | Investigate   |
| D-151 | E2E session-level timeout — configurable `defaultTimeout` in `TerminalSession`                                                            | Ready for Dev |

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

### Bugs

#### D-92: Global config missing `source`, `marketplace`, `selectedAgents`

**Priority:** High

When running `cc init` from a project directory and selecting global-scoped skills, the global config at `~/.claude-src/config.ts` is written without `source`, `marketplace`, or `selectedAgents`. These fields only appear in the project config. The global config should include them so that `cc edit` from global context can resolve the marketplace and install plugins.

**Reproduction:** Run `cc init` from a project dir, select global-scoped skills. Compare `~/.claude-src/config.ts` (missing fields) with `<project>/.claude-src/config.ts` (has all fields).

---

#### D-152: Fix ENOENT in dual-scope skill copy

**Priority:** High

`skill-copier.ts:215` resolves global skill `localPath` against `process.cwd()` instead of the discovery context (`homedir`). Root cause: `localPath` is stored as a relative path during discovery with no context tracking. 8 E2E tests currently use `it.fails()` as a workaround.

---

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

#### D-130: Narrow stack type safety

**Priority:** Low

`StackAgentConfig` allows any `SkillId` in any `Category`. Generate a discriminated type where each category key only accepts skill IDs that belong to that category (e.g., `"web-framework"` only accepts `"web-framework-react" | "web-framework-vue"`). Depends on D-97 (pre-generated matrix) to avoid regeneration overhead.

---

#### D-129: Add visibility into global config contents from project config

**Priority:** Low

The `...globalConfig.skills` spread hides what's available. Consider generating comments listing the spread contents, or another approach to make the project config self-documenting without duplicating data.

---

### Operations Layer

#### D-155: Declarative commands

**Priority:** High

Move single-use operations back into commands, apply the two-tier orchestrator pattern to all commands. See [D-155-declarative-commands.md](./D-155-declarative-commands.md) for the full plan.

---

#### D-154: Organize operations into domain folders

**Priority:** Medium

Group the 26 operation files into domain subdirectories: `source/`, `skills/`, `plugins/`, `config/`, `agents/`, `scaffold/`, `lifecycle/`. Update barrel exports and all import paths across the codebase.

---

#### D-153: Standardize operation result types

**Priority:** Medium

Current return types are inconsistent — some use counts, some arrays, some booleans. Define consistent patterns:

- **List operations** return `{ succeeded: T[], failed: Array<{item, error}>, total }`
- **Single-action operations** return `{ success, result?, error? }`

Touches every operation file, call site, and test.

---

#### D-148: Remove unnecessary test mocks in plugin test files

**Priority:** Low

Three plugin test files mock modules that don't need mocking: `getErrorMessage`, `consts`, and `DEFAULT_SOURCE`. Remove these unnecessary mocks.

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

#### D-141: Merge AI documentation — consolidate `.ai-docs/` with `reference/` and `standards/` split

**Priority:** Medium
**Status:** Complete (2026-03-25)

All AI-consumed documentation now lives in `.ai-docs/` with a clear internal split:

```
.ai-docs/
  DOCUMENTATION_MAP.md              # master index for both sections
  reference/                        # descriptive — "how things work"
  standards/                        # prescriptive — "how to write code" (moved from docs/standards/)
```

See `.ai-docs/DOCUMENTATION_MAP.md` for the full file listing.

---

#### D-142: Rename meta documentation agents — scribe → codex-keeper

**Priority:** Low (naming only, no behavior change)

**Depends on:** D-141 (doc merge should land first so references are stable)

The meta agent category currently has four agents with two naming patterns:

| Current Name      | Role                                | Pattern      |
| ----------------- | ----------------------------------- | ------------ |
| agent-summoner    | Creates/improves agents             | `*-summoner` |
| skill-summoner    | Creates/improves skills             | `*-summoner` |
| scribe            | Creates AI reference docs           | standalone   |
| convention-keeper | Synthesizes findings into standards | `*-keeper`   |

The "summoner" pair shares a role word differentiated by domain. The documentation pair should share "keeper" — both keep knowledge, differentiated by what they maintain:

| New Name          | Role                                                            | Pattern    |
| ----------------- | --------------------------------------------------------------- | ---------- |
| codex-keeper      | Descriptive docs (architecture, types, store maps, commands)    | `*-keeper` |
| convention-keeper | Prescriptive docs (standards, rules from anti-pattern findings) | `*-keeper` |

**Naming rationale:** "Keeper" fits the lore/fantasy theme (summoners summon, keepers keep knowledge). A "codex" is a structured body of reference knowledge — maps directly to `.ai-docs/reference/`. Convention-keeper already has the right name and keeps `.ai-docs/standards/`.

**Implementation steps:**

1. Rename directory:
   - `src/agents/meta/scribe/` → `src/agents/meta/codex-keeper/`

2. Update `metadata.yaml`:
   - `id: scribe` → `id: codex-keeper`, `title: Codex Keeper Agent`

3. Update cross-references (grep for `scribe` excluding skill-summoner's unrelated uses):
   - `CLAUDE.md` — delegation rules, agent mentions
   - `todo/TODO.md` — D-137 spec mentions scribe by name
   - `src/agents/meta/agent-summoner/workflow.md` — agent category tables
   - `src/agents/meta/scribe/workflow.md` — self-references, `documentation-bible.md` reference
   - `src/agents/meta/convention-keeper/workflow.md` — mentions scribe as distinct from itself
   - D-138 agent audit table
   - D-141 scribe agent update references
   - Any stacks or config referencing the `scribe` agent ID

4. Update generated types if `AgentName` union includes `scribe`

5. Verify: `tsc --noEmit`, `npm test`, grep for orphaned references

---

### Wizard UX

#### D-144: Info panel

**Priority:** Medium

Replace the `?` help overlay with an `I` info panel (opened via the `I` key) that shows all selected skills and agents in a table layout.

**Layout:** Plugin/Local on Y axis (rows), Global/Project on X axis (columns). Two sub-columns per scope to use horizontal space. Local row collapses to 1-2 lines or disappears when empty.

```
┌─ Info ─────────────────────────────────────────────────────────────┐
│                                                                    │
│  SKILLS (9)     Global                     Project                 │
│  ──────────────────────────────────────────────────────────────── │
│  Plugin         react       hono           tailwind    prisma      │
│                 vitest      eslint         zod                     │
│                                                                    │
│  Local          my-custom-auth             my-project-util         │
│                                                                    │
│  AGENTS (5)     Global                     Project                 │
│  ──────────────────────────────────────────────────────────────── │
│                 web-developer  cli-developer   api-reviewer        │
│                 web-reviewer   codex-keeper                        │
│                                                                    │
│  I close                                                           │
└────────────────────────────────────────────────────────────────────┘
```

**Design rationale:**

- Local skills are rare, so they sit on the Y axis — the row naturally collapses to 1 line or disappears
- Two sub-columns per scope halve the row count for large selections
- Gap between Global and Project columns acts as the visual divider (no border needed)
- No separator between Plugin and Local — just an empty row for breathing room

**Scrolling:** Use `useRowScroll` for the content area — `Box overflow="hidden"` with negative `marginTop` offset. The unused `useVirtualScroll` hook already calculates `hiddenAbove`/`hiddenBelow` counts for scroll indicators.

**First implementation scope:**

- `I` key toggles the panel as a full overlay
- Show all selected skills grouped in the 2x2 grid (scope x mode)
- Show all selected agents grouped by scope
- Scrollable when content exceeds viewport
- No other stats/toggles in v1

---

#### D-132: Skip incompatibility markers in exclusive categories

**Priority:** Low

In radio (max 1) categories like Framework and Meta-Framework, the single-selection constraint already prevents conflicts. Incompatibility styling is redundant noise there. Only show incompatibility markers in non-exclusive (checkbox) categories where users could select conflicting skills. Check `exclusive: true` on the category definition.

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

### Performance

#### D-97: Improve startup time — lazy-load matrix generation

**Priority:** High

The CLI is unresponsive for up to ~5 seconds on startup (varies by machine speed). The likely cause is that the entire skills matrix is generated eagerly on startup — including resolving all marketplace skills, local skills, and custom skills.

**Proposed approach:** Only generate the matrix for custom/local skills on startup, then merge them into the pre-existing marketplace matrix rather than recreating everything from scratch. The marketplace matrix is static between CLI updates and could be cached or loaded as a pre-built artifact, with only the user's custom additions computed at runtime.

**Investigation needed:**

- Profile startup to confirm matrix generation is the bottleneck
- Determine which parts of matrix generation are expensive (YAML parsing, skill resolution, category building)
- Design a merge strategy: pre-built marketplace matrix + incremental custom skill overlay
- Consider caching the marketplace matrix to disk after first generation

---

## Testing Tasks

See [TODO-testing.md](./TODO-testing.md) for the full testing guide: coverage table (what is and isn't tested), automated test tasks T1-T6, step-by-step manual procedures for every command, and the 28-point quick-pass checklist.

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/skills`
- CLI under test: `/home/vince/dev/cli`
