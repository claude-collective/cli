# Agents Inc. CLI - Task Tracking

| ID   | Task                                                                                                                  | Status        |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ------------- |
| D-92 | Global config missing `source`, `marketplace`, `selectedAgents` when init writes global-scoped skills                 | Investigate   |
| D-93 | Global-scoped plugins double-installed to both project and global `settings.json`                                     | Investigate   |
| D-91 | `uninstall --all` only removes CLI-installed plugins, not all skills in config                                        | Investigate   |
| D-94 | Stack change or "start from scratch" doesn't reset previously selected skills                                         | Ready for Dev |
| D-95 | Create a reusable view title component for wizard steps                                                               | Ready for Dev |
| D-96 | Remove redundant left/right arrow navigation description below views                                                  | Ready for Dev |
| D-97 | Improve startup time — lazy-load matrix, only generate custom skills on startup                                       | Investigate   |
| D-62 | Review default stacks: include meta/methodology/reviewing skills                                                      | Ready for Dev |
| D-38 | Remove web-base-framework, allow multi-framework (see [implementation plan](./D-38-remove-base-framework.md))         | Has Open Qs   |
| D-39 | Couple meta-frameworks with base frameworks (see [implementation plan](./D-39-couple-meta-frameworks.md))             | Ready for Dev |
| D-90 | Add Sentry tracking for unresolved matrix references — `getDiscourageReason` and `validateSelection` fallback paths   | Ready for Dev |
| D-41 | Create `agents-inc` configuration skill (see [implementation plan](./D-41-config-sub-agent.md))                       | Ready for Dev |
| D-52 | Expand `new agent` command: config lookup + compile-on-demand (see [implementation plan](./D-52-expand-new-agent.md)) | Ready for Dev |
| D-64 | Create CLI E2E testing skill + update `cli-framework-oclif-ink` skill                                                 | Ready for Dev |
| D-66 | AI-assisted PR review: categorize diffs by type (mechanical vs logic vs test) for easier review                       | Investigate   |
| D-69 | Config migration strategy — detect and handle outdated config shapes across CLI version upgrades                      | Investigate   |

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

#### D-91: `uninstall --all` only removes CLI-installed plugins, not all skills in config

**Priority:** High

`cc uninstall --all` uninstalls ALL discovered plugins (every entry in `settings.json` `enabledPlugins`). It should only uninstall plugins that were installed via this CLI — i.e., plugins whose settings key (`web-styling-cva@agents-inc`) has a matching skill entry in the project config (`{ id: 'web-styling-cva', source: 'agents-inc' }`).

**Detection heuristic:** A plugin in `settings.json` is CLI-installed if the config's `skills` array contains a matching `{ id, source }` where `${id}@${source}` equals the settings key.

**See plan:** [D-91-uninstall-all-filter.md](./D-91-uninstall-all-filter.md)

---

#### D-94: Stack change or "start from scratch" doesn't reset previously selected skills

**Priority:** Medium

When a user selects a stack (which auto-selects skills), then goes back to the stack selection step and either chooses a different stack or chooses "start from scratch," the previously selected skills are not reset. Skills that were auto-selected by the prior stack or manually selected by the user persist into the new selection context.

**Expected behavior:** Every time the user returns to the stack selection step and makes a new choice (different stack or "start from scratch"), all skill selections should be cleared — both stack-auto-selected and manually-selected skills.

**Reproduction:** Run `cc init`, select a stack (e.g., "Full-Stack Web"), observe skills are auto-selected, go back to stack selection, choose "Start from scratch" — previously selected skills are still checked.

---

### Framework Features

#### D-38: Remove web-base-framework, allow multi-framework

**Priority:** Medium
**See plan:** [D-38-remove-base-framework.md](./D-38-remove-base-framework.md)

Remove the `web-base-framework` and `mobile-platform` stacks-only category keys. Merge their skills into the `web-framework` / `mobile-framework` arrays. Change `web-framework` from fully exclusive to supporting compatible multi-selection (React + Remix, Vue + Nuxt, etc.).

When a user selects a meta-framework (Next.js, Remix, Nuxt), the corresponding base framework (React, Vue) should be recommended or auto-included. However, some base framework patterns conflict with meta-framework patterns (e.g., React Router vs Next.js App Router). A "slimmed down" version of the base framework skill may be needed for meta-framework contexts.

**Problem:** The React skill teaches generic React patterns including routing, but when using Next.js, you want Next.js routing, not React Router. Similarly for data fetching patterns. The full React skill includes patterns that conflict with Next.js conventions.

**Possible approaches:**

- **Skill variants:** Create slimmed-down variants of base framework skills for meta-framework contexts (e.g., `web-framework-react-for-nextjs` that excludes routing/data-fetching sections)
- **Conditional sections:** Add conditional sections in SKILL.md that are included/excluded based on what other skills are selected (e.g., `<!-- if not: web-framework-nextjs -->` around the routing section)
- **Skill composition:** Split framework skills into atomic sub-skills (react-components, react-routing, react-data-fetching) and let meta-frameworks exclude the ones they replace
- **Conflict rules in metadata.yaml:** Use existing `conflictsWith` to mark specific patterns as conflicting, letting the system warn users

**Investigation needed:**

- Audit each meta-framework skill to identify which base framework patterns it replaces
- Determine the right granularity (full skill variants vs conditional sections vs sub-skills)
- Consider whether this is even a problem in practice — does having both the React routing skill and Next.js routing skill actually cause issues for the AI agent consuming them?

---

#### D-39: Couple meta-frameworks with base frameworks

**Priority:** Medium
**Depends on:** D-38
**See plan:** [D-39-couple-meta-frameworks.md](./D-39-couple-meta-frameworks.md)

When a user selects a meta-framework (e.g., Next.js), automatically select the corresponding base framework skill (e.g., React) and block deselection while the meta-framework depends on it. This ensures users get both the meta-framework-specific patterns and the underlying framework knowledge.

**Key decisions (from refinement):**

- Auto-select base framework when meta-framework is toggled on (not just validation)
- Block deselection of base framework while dependents exist
- Add `requiredBy` visual indicator ("required by Next.js") to locked skills
- Auto-select logic lives in `use-build-step-props.ts` hook (not the store)
- Only same-category auto-selection (no cross-category)
- Expert mode bypasses auto-select and deselect blocking

---

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

### Wizard UX

#### D-95: Create a reusable view title component

**Priority:** Medium

Create a shared `ViewTitle` component that wizard steps can use for consistent step headers. Currently each view renders its own title/heading ad hoc. A reusable component would standardize the look and reduce duplication.

---

#### D-96: Remove redundant left/right arrow navigation description below views

**Priority:** Low

Many wizard views display a left/right arrow navigation hint below the content. This is redundant — the navigation is self-evident from the UI and takes up vertical space unnecessarily. Remove these descriptions to reduce clutter.

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
