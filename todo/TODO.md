# Agents Inc. CLI - Task Tracking

| ID    | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Status                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------- |
| D-135 | Investigate: edit-to-local flow writes agents to real HOME despite TerminalSession HOME override — `agent-recompiler.ts:134` uses `os.homedir()` which should respect `HOME=cwd`, but after `cc edit` switching skills to local mode, the compiled agent ends up at the real `~/.claude/agents/` instead of `projectDir/.claude/agents/`. The `agentInProject \|\| agentInHome` assertions in `source-switching-modes.e2e.test.ts` and `init-then-edit-merge.e2e.test.ts` may be masking a genuine scope-routing bug. Possible causes: Claude CLI plugin operations writing agents as a side effect, subprocess not inheriting env, or WSL2 `os.homedir()` quirk.                                                 | Investigate                                                                                  |
| D-137 | Standards feedback loop — sub-agents capture anti-pattern findings during work, a `convention-keeper` agent synthesizes them into doc updates. Three-stage pipeline: Capture (sub-agents write structured findings to `.agents-docs/findings/`), Accumulate (findings pile up across sessions), Synthesize (reviewer agent reads findings, cross-refs existing standards, proposes updates). See detailed spec below.                                                                                                                                                                                                                                                                                             | Done                                                                                         |
| D-138 | Iterate on sub-agents — review and improve all agent definitions in `src/agents/` using the agent-summoner. Audit each agent's instructions against actual usage patterns, findings from the convention-keeper, and CLAUDE.md rules. Update prompts, add missing guardrails, improve output formats, and ensure agents write findings to `.agents-docs/findings/` when they discover anti-patterns.                                                                                                                                                                                                                                                                                                               | Ready for Dev                                                                                |
| D-134 | Declarative E2E test utilities — replace imperative `session.waitForText()`/`session.enter()`/try-catch patterns with high-level helpers that read like user stories (e.g., `wizard.selectStack("full-stack")`, `wizard.selectSkill("web", "framework", "react")`, `wizard.completeWizard()`, `assertAgentCompiled(dir, "web-developer")`). Tests should describe user interactions and expected output, not terminal scraping mechanics. Follows D-120/D-121/D-125.                                                                                                                                                                                                                                              | Ready for Dev                                                                                |
| D-133 | E2E tests for 13 untested bug fixes — (1) source priority override in wizard-store.ts, (2) splitConfigByScope missing fields, (3) shouldRemoveSkill forkedFrom-only check, (4) uninstall using loadProjectConfigFromDir, (5) config merger preserving agent scope changes, (6) old agent file deletion on scope change, (7) stack scope leak filtering, (8) duplicate domains fix, (9) global config including all domains, (10) config-types.ts Domain type including config.domains, (11) compile scope-aware dual pass (global vs project agent filtering), (12) compile global plugin discovery for project pass, (13) compile project agents missing skills when global stack entries override project stack | Ready for Dev                                                                                |
| D-132 | Skip incompatibility markers in exclusive categories — in radio (max 1) categories like Framework and Meta-Framework, the single-selection constraint already prevents conflicts. Incompatibility styling is redundant noise there. Only show incompatibility markers in non-exclusive (checkbox) categories where users could select conflicting skills. Check `exclusive: true` on the category definition.                                                                                                                                                                                                                                                                                                     | Ready for Dev                                                                                |
| D-131 | Track project installations in global config — add `projects?: string[]` to global config, updated by init/edit/uninstall. Warn on global uninstall if project installations still depend on it. Prevents broken TypeScript imports when global is uninstalled before projects. Stale entries handled by `fileExists` check.                                                                                                                                                                                                                                                                                                                                                                                      | Investigate                                                                                  |
| D-130 | Narrow stack type safety — `StackAgentConfig` allows any `SkillId` in any `Category`. Generate a discriminated type where each category key only accepts skill IDs that belong to that category (e.g., `"web-framework"` only accepts `"web-framework-react"                                                                                                                                                                                                                                                                                                                                                                                                                                                      | "web-framework-vue"`). Depends on D-97 (pre-generated matrix) to avoid regeneration overhead | Investigate |
| D-129 | Add visibility into global config contents from project config — the `...globalConfig.skills` spread hides what's available. Consider generating comments listing the spread contents, or another approach to make the project config self-documenting without duplicating data                                                                                                                                                                                                                                                                                                                                                                                                                                   | Investigate                                                                                  |
| D-128 | Disable scope toggle (S hotkey) when editing from global scope (`~`) — changing a global skill/agent to project scope is undefined when there's no project. Grey out or ignore S with a message like "Run `cc edit` from a project to change scope"                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Ready for Dev                                                                                |
| D-127 | UX for changing global-scoped skills/agents to project scope from within a project — when running `cc edit` from a project dir, allow users to "claim" global skills/agents into the project. Needs design: how to present this, confirmation UX, what happens to the global config entry                                                                                                                                                                                                                                                                                                                                                                                                                         | Investigate                                                                                  |
| D-126 | Global uninstall skips local skills — `uninstall --all` from home dir shows "Skipping: not created by Agents Inc. CLI" for global-scoped local skills. The `forkedFrom` metadata check in uninstall likely fails because skills were copied to `~/.claude/skills/` but the uninstall code can't find or validate their metadata. May be related to scope-blind path fixes in this session                                                                                                                                                                                                                                                                                                                         | Ready for Dev                                                                                |
| D-125 | Fix weak E2E test assertions — (1) `source-switching-modes.e2e.test.ts` and `init-then-edit-merge.e2e.test.ts` use `agentInProject \|\| agentInHome` cop-out assertions instead of verifying the agent is in the CORRECT scope-specific location. (2) `edit-wizard-detection.e2e.test.ts` asserts fragile category display names ("Framework", "Testing") on a screen that may show domain selection instead of skill grid. All assertions should verify exact expected location/content based on the agent/skill scope.                                                                                                                                                                                          | Ready for Dev                                                                                |
| D-124 | E2E tests for default source path — no E2E test exercises the `DEFAULT_SOURCE` / `BUILT_IN_MATRIX` code path (all tests use `--source`). Add tests for: (1) stale marketplace clone scenario (register, modify source, re-init), (2) local install mode without `--source` flag from a consuming project                                                                                                                                                                                                                                                                                                                                                                                                          | Ready for Dev                                                                                |
| D-123 | Local mode ENOENT on consuming projects — `source-loader.ts` sets `sourcePath: ""` for `BUILT_IN_MATRIX`, so `skill-copier.ts` builds relative paths that only work inside the marketplace repo. Local mode needs to fetch source first (like pre-`9189b22` `loadFromRemote` did) when default source is used                                                                                                                                                                                                                                                                                                                                                                                                     | Ready for Dev                                                                                |
| D-122 | Auto-update marketplace before plugin install — stale Claude CLI marketplace clone causes "not found" errors for renamed/new skills. Add `claudePluginMarketplaceUpdate()` to `exec.ts`, call in `init.tsx` when marketplace already exists (retry-on-failure or always-update)                                                                                                                                                                                                                                                                                                                                                                                                                                   | Ready for Dev                                                                                |
| D-121 | Remove step numbers from wizard tabs (remove [1], [2], [3], [4], [5] prefixes from Stack, Skills, Sources, Agents, Confirm tabs)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Ready for Dev                                                                                |
| D-120 | Add dedicated domain selection step to wizard flow — move domain selection out of stack step into its own step between stack and build                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Ready for Dev                                                                                |
| D-119 | Update READMEs to mention 100+ skills (currently 103), 13 stacks (explain what stacks are and how they work), and other up-to-date stats                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Ready for Dev                                                                                |
| D-118 | Investigate renaming scope terminology from "project/global" to "project/user" to align with Claude's terminology and distinguish from install mode (local/plugin)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Investigate                                                                                  |
| D-117 | Show count of selected global skills and project skills somewhere in the wizard UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Ready for Dev                                                                                |
| D-116 | Filter Incompatible toggle should also deselect all skills currently marked as incompatible when activated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Ready for Dev                                                                                |
| D-62  | Review default stacks: add reviewing/research skills (methodology part done via D-106 template inlining)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Ready for Dev                                                                                |
| D-97  | Improve startup time — lazy-load matrix, only generate custom skills on startup                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Investigate                                                                                  |
| D-112 | Create a guide for setting up AI documentation — use documenter sub-agent, create `.ai-docs/` directory, iterate over docs, symlink into repo root. Link from README alongside other guides.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Ready for Dev                                                                                |
| D-111 | Create a GIF demo showing how the CLI works for the README                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Ready for Dev                                                                                |
| D-110 | Fix the logo in the README                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Ready for Dev                                                                                |
| D-109 | Fix the screenshots in the README                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Ready for Dev                                                                                |
| D-111 | Update tests to point to stable strings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Ready for Dev                                                                                |
| D-92  | Global config missing `source`, `marketplace`, `selectedAgents` when init writes global-scoped skills                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Investigate                                                                                  |
| D-93  | Global-scoped plugins double-installed to both project and global `settings.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Investigate                                                                                  |
| D-90  | Add Sentry tracking for unresolved matrix references — `getDiscourageReason` and `validateSelection` fallback paths                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Ready for Dev                                                                                |
| D-41  | Create `agents-inc` configuration skill (see [implementation plan](./D-41-config-sub-agent.md))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Ready for Dev                                                                                |
| D-52  | Expand `new agent` command: config lookup + compile-on-demand (see [implementation plan](./D-52-expand-new-agent.md))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Ready for Dev                                                                                |
| D-64  | Create CLI E2E testing skill + update `cli-framework-oclif-ink` skill                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Ready for Dev                                                                                |
| D-66  | AI-assisted PR review: categorize diffs by type (mechanical vs logic vs test) for easier review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Investigate                                                                                  |
| D-69  | Config migration strategy — detect and handle outdated config shapes across CLI version upgrades                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Investigate                                                                                  |
| D-100 | Fix pre-existing E2E test violations — `undefined!`, magic timeouts, raw `readFile`, cleanup patterns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Ready for Dev                                                                                |

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

#### D-93: Global-scoped plugins double-installed to both project and global `settings.json`

**Priority:** High

When running `cc init` from a project directory and selecting global-scoped skills, the plugins appear in BOTH `~/.claude/settings.json` AND `<project>/.claude/settings.json`. Global-scoped plugins should only be in the global settings.

**Reproduction:** Run `cc init` from a project dir, select global-scoped skills. Check both `~/.claude/settings.json` and `<project>/.claude/settings.json` — both contain the plugin entries.

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

#### D-137: Standards feedback loop — automated capture and synthesis of anti-pattern findings

**Priority:** Medium

Sub-agents discover implicit standards during refactoring and review work (e.g., "toEqual should be toStrictEqual for objects", "always check shared helpers before writing local ones"). Today these discoveries die with the agent's context. The user must manually synthesize findings and update documentation.

**Three-stage pipeline:**

**Stage 1 — Capture (automatic, during sub-agent work):**
When a sub-agent fixes an anti-pattern or discovers a standard gap, it writes a structured finding to `.agents-docs/findings/`. Each finding is a small markdown file (~10 lines) with frontmatter:

```yaml
type: anti-pattern | standard-gap | convention-drift
severity: high | medium | low
affected_files: [...]
standards_docs: [...]
date: YYYY-MM-DD
```

Body sections: "What Was Wrong", "Fix Applied", "Proposed Standard". Written in-the-moment when context is fresh.

**Stage 2 — Accumulate (passive):**
Findings pile up across sessions. No processing needed — each review/refactor session produces 3-8 findings.

**Stage 3 — Synthesize (on-demand, `convention-keeper` agent):**
A new agent type that:

1. Reads unprocessed findings in `.agents-docs/findings/`
2. Groups by theme (DRY, assertions, constants, type safety)
3. Cross-references against `docs/standards/` and `CLAUDE.md`
4. Determines: existing rule violated (enforcement gap) or missing rule (documentation gap)?
5. Proposes targeted additions to specific docs
6. Marks findings as incorporated

**How this differs from the `scribe` agent:**
The scribe documents _code_ — it reads source and produces reference docs. The convention-keeper documents _conventions_ — it reads evidence of what went wrong and proposes rules to prevent recurrence.

**Implementation pieces:**

1. `.agents-docs/findings/` directory and finding schema
2. CLAUDE.md delegation update — instruct sub-agents to write findings when fixing anti-patterns
3. `convention-keeper` agent definition (new agent type or skill)
4. Optional: `/standards-review` invocable skill

**Capture sources (both):**

- Sub-agents write raw findings during work (full context, most detail)
- Orchestrator writes findings when synthesizing across multiple agent results (cross-cutting patterns)

**Motivation:** In the D-134 E2E framework audit, 4 review agents found 28 issues across 103 files. The fixes were straightforward, but the _standards documentation updates_ that prevent recurrence required manual synthesis — reading all 4 agent reports, categorizing patterns, identifying doc gaps, and writing 5 targeted doc changes. This task automates that synthesis.

---

#### D-138: Iterate on sub-agents — systematic improvement pass

**Priority:** Medium

All agent definitions in `src/agents/` should be reviewed and improved using the agent-summoner's Improve Mode. Each agent was written at a point in time and may not reflect current project conventions, CLAUDE.md rules, or lessons learned from the convention-keeper's findings.

**Scope:**

| Category  | Agents                                                    |
| --------- | --------------------------------------------------------- |
| Meta      | agent-summoner, skill-summoner, scribe, convention-keeper |
| Reviewer  | cli-reviewer, web-reviewer, api-reviewer                  |
| Developer | cli-developer, web-developer                              |
| Tester    | cli-tester, web-tester                                    |
| Pattern   | web-pattern-critique, pattern-scout                       |
| Planning  | web-pm                                                    |
| Research  | web-researcher                                            |

**For each agent:**

1. Read the current source files (`metadata.yaml`, `intro.md`, `workflow.md`, `critical-requirements.md`, `output-format.md`, `critical-reminders.md`, `examples.md`)
2. Cross-reference against CLAUDE.md NEVER/ALWAYS rules — does the agent enforce them?
3. Check `.agents-docs/findings/` for findings where `reporting_agent` matches — does the agent's instructions prevent recurrence?
4. Ensure the agent includes the findings capture instruction (write to `.agents-docs/findings/` when anti-patterns are discovered)
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

### Wizard UX

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
