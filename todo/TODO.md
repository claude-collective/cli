# Agents Inc. CLI - Task Tracking

| ID   | Task                                                                                                                                       | Status        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| D-50 | ~~Matrix decomposition~~ — all 8 phases complete (see [phased plan](./TODO-matrix-decomposition.md))                                       | Done          |
| D-46 | Custom extensibility (see [design doc](../docs/features/proposed/custom-extensibility-design.md))                                          | In Progress   |
| D-37 | Install mode UX redesign (see [design doc](../docs/features/proposed/install-mode-redesign.md))                                            | Refined       |
| D-33 | ~~README: frame Agents Inc. as an agent composition framework~~ — done                                                                     | Done          |
| D-44 | Update README and Notion page for `eject templates` type (see [implementation plan](./D-44-docs-eject-templates.md))                       | Ready for Dev |
| D-47 | ~~Eject a standalone compile function~~ — deferred, low priority (see [TODO-deferred.md](./TODO-deferred.md))                              | Deferred      |
| T-12 | End-to-end tests for custom marketplace workflow (see [implementation plan](./T-12-e2e-marketplace-tests.md))                              | Has Open Qs   |
| D-52 | Expand `new agent` command: config lookup + compile-on-demand (see [implementation plan](./D-52-expand-new-agent.md))                      | Ready for Dev |
| D-54 | Remove expert mode: make expert mode behavior the default (see [implementation plan](./D-54-remove-expert-mode.md))                        | Ready for Dev |
| D-59 | Unified scrolling across all wizard views (see [implementation plan](./D-59-unified-scrolling.md))                                         | Ready for Dev |
| D-36 | Global install support with project-level override (see [implementation plan](./D-36-global-install.md))                                   | Ready for Dev |
| D-37 | Merge global + project installations in resolution (see [implementation plan](./D-37-merge-installs.md))                                   | Has Open Qs   |
| D-08 | ~~User-defined stacks~~ — deferred, not important (see [TODO-deferred.md](./TODO-deferred.md))                                             | Deferred      |
| D-53 | Rename `agent.yaml` to `metadata.yaml` (see [implementation plan](./D-53-rename-agent-yaml.md))                                            | Ready for Dev |
| D-38 | Remove web-base-framework, allow multi-framework (see [implementation plan](./D-38-remove-base-framework.md))                              | Has Open Qs   |
| D-39 | Couple meta-frameworks with base frameworks (see [implementation plan](./D-39-couple-meta-frameworks.md))                                  | Ready for Dev |
| D-40 | ~~`agentsinc register` command~~ — absorbed into D-41 (config sub-agent handles registration) (see [TODO-deferred.md](./TODO-deferred.md)) | Deferred      |
| D-41 | Create Agents Inc config sub-agent (see [implementation plan](./D-41-config-sub-agent.md))                                                 | Ready for Dev |
| D-60 | Remove `cli-migrator` subagent                                                                                                             | Ready for Dev |
| D-61 | Preserve stack skill selections when toggling domains                                                                                      | Ready for Dev |
| D-62 | Review default stacks: include meta/methodology/reviewing skills                                                                           | Ready for Dev |
| D-63 | Add E2E tests to pre-commit hook                                                                                                           | Ready for Dev |
| D-64 | Create CLI E2E testing skill + update `cli-framework-oclif-ink` skill                                                                      | Ready for Dev |
| B-07 | Fix skill sort order changing on select/deselect in build step                                                                             | Ready for Dev |
| D-65 | Refresh stale marketplace before plugin installation                                                                                       | Ready for Dev |
| D-66 | ~~Make config.yaml resilient to custom skill IDs without load-order dependency~~                                                           | Done          |

---

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).
For final release tasks, see [TODO-final.md](./TODO-final.md).

---

## Reminders for Agents

See [docs/guides/agent-reminders.md](../docs/guides/agent-reminders.md) for the full list of rules (use specialized agents, handle uncertainties, blockers, commit policy, archiving, status updates, context compaction, cross-repo changes).

---

## Active Tasks

### D-50: Matrix Decomposition — COMPLETE

All 8 phases complete. `skills-matrix.yaml` decomposed into `skill-categories.yaml` + `skill-rules.yaml` with directory-based skill discovery. Auto-synthesis for unknown categories. `categoryExclusive` removed from skill metadata. `cliName` renamed to `displayName`. `new skill` and `new marketplace` create/update config files. See [phased plan](./TODO-matrix-decomposition.md).

---

### CLI Improvements

#### D-37: Install mode UX redesign

Replace the hidden `P` hotkey toggle with an explicit install mode choice on the confirm step. Implement mode migration during edit (local to plugin, plugin to local, per-skill customize). The current `P` toggle during edit is completely broken -- config is never updated, artifacts are never migrated.

**Design doc:** [`docs/features/proposed/install-mode-redesign.md`](../docs/features/proposed/install-mode-redesign.md)

**Location:** `step-confirm.tsx`, `wizard.tsx`, `wizard-layout.tsx`, `help-modal.tsx`, `wizard-store.ts`, `edit.tsx`, `local-installer.ts`, `agent-recompiler.ts`, `types/config.ts`.

---

### Framework Infrastructure

#### D-36: Global install support with project-level override

**Priority:** Medium
**Implementation plan:** [`D-36-global-install.md`](./D-36-global-install.md)

Add a `--global` flag to `agentsinc init` for global vs project-level installation. Global installs go to `~/.claude-src/config.yaml`, `~/.claude/skills/`, `~/.claude/agents/`. Project-level installs remain at `{cwd}/.claude-src/` as today. Phase 1: full override (project replaces global, no merging).

**Acceptance criteria:**

- [ ] `agentsinc init --global` installs to home directory
- [ ] `agentsinc init` (no flag) installs to `{cwd}` (current behavior)
- [ ] `agentsinc edit` from a project with its own installation uses that project's config
- [ ] `agentsinc edit` from a project without its own installation falls back to global
- [ ] `agentsinc compile` follows the same resolution order
- [ ] Plugin mode: `--scope user` used for global, `--scope project` for project-level

---

#### D-37: Merge global + project installations in resolution

**Priority:** Low (deferred until D-36 is stable)
**Depends on:** D-36
**Implementation plan:** [`D-37-merge-installs.md`](./D-37-merge-installs.md)

Extend D-36's full-override behavior to support merging global and project-level installations. When a project-level installation exists, it currently replaces the global one entirely. This task adds the option to merge them — project-level selections take priority for overlapping categories, global fills in the rest.

**Example:**

- Global: `web-framework-react`, `web-state-zustand`, `web-testing-vitest`
- Project: `api-framework-hono`
- Merged result: all four skills active

**Key design decisions (from implementation plan):**

- Merge is opt-in via `merge: true` in project config (preserves D-36 full-override default)
- Exclusive category conflicts: project wins. Non-exclusive categories: union.
- Agents are merged (union), with project overriding per-agent per-subcategory stack mappings
- `edit` always modifies the project-level config; global skills shown as inherited
- `excludeGlobalSkills` deferred to a later phase for simplicity
- Merge operates at the config level, not the matrix loading level

---

#### D-53: Rename `agent.yaml` to `metadata.yaml`

**Implementation plan:** [`D-53-rename-agent-yaml.md`](./D-53-rename-agent-yaml.md)

Rename the agent definition file from `agent.yaml` to `metadata.yaml` for consistency with skill metadata files. CLI-repo-only change (~52 files). No fallback period needed (pre-1.0).

---

### Framework Features

#### D-38: Remove web-base-framework, allow multi-framework

**Priority:** Medium
**See plan:** [D-38-remove-base-framework.md](./D-38-remove-base-framework.md)

Remove the `web-base-framework` and `mobile-platform` stacks-only subcategory keys. Merge their skills into the `web-framework` / `mobile-framework` arrays. Change `web-framework` from fully exclusive to supporting compatible multi-selection (React + Remix, Vue + Nuxt, etc.).

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
- Only same-subcategory auto-selection (no cross-category)
- Expert mode bypasses auto-select and deselect blocking

---

#### D-41: Create Agents Inc config sub-agent

**Priority:** Medium

Create a specialized Claude Code sub-agent that understands the Agents Inc CLI's configuration system in depth. This is NOT a developer agent — it handles all configuration-related tasks that currently require manual knowledge of the CLI's YAML structures, schemas, and type system.

**What it does:**

- Creates and updates `metadata.yaml` files for skills (with correct domain-prefixed `category` values, author, displayName, etc.)
- Creates and updates `stacks.yaml` entries (agent definitions, skill assignments, preloaded flags)
- Updates `skills-matrix.yaml` (adding/modifying categories, skill entries, dependency rules)
- Updates `.claude-src/config.yaml` mappings (source paths, plugin settings, skill assignments)
- Updates `agent-mappings.yaml` skill-to-agent routing
- Knows the valid `Subcategory` enum values and enforces them
- Understands skill relationships (`requires`, `compatibleWith`, `conflictsWith`, `requiresSetup`, `providesSetupFor`)
- Can validate configs against JSON schemas before writing

**Key knowledge areas:**

- The 38 domain-prefixed subcategory values and their domains
- Stack structure: agents → subcategories → skill assignments (with `preloaded`, `selected` flags)
- Skills matrix: categories with `id`, `displayName`, `domain`, `categoryExclusive`, `skills` arrays with dependency rules (`needsAny`, `conflictsWith`)
- Metadata schema: required fields (`category`, `author`, `displayName`, `cliDescription`, `usageGuidance`)
- The distinction between matrix categories (36) and stacks-only keys (+2: `web-base-framework`, `mobile-platform`)
- How `extractSubcategoryFromPath` and `categoryPathSchema` resolve category paths

**Why this is needed:**

- Configuration tasks (creating metadata, adding stacks, updating the matrix) are error-prone and require deep familiarity with the schema
- The D-31 migration showed how many files need coordinated updates when config values change
- A dedicated config agent prevents developer agents from making config mistakes (wrong category values, invalid schema, missing required fields)
- Replaces D-40 (`agentsinc register`) entirely — the config agent handles skill registration conversationally (read SKILL.md, infer category, generate metadata.yaml, wire config.yaml) instead of requiring users to memorize flags

**Implementation:**

- Create `src/agents/meta/config-manager/` with the standard agent structure
- Pre-load the JSON schemas, `SUBCATEGORY_VALUES`, and example configs into the agent's context
- Give it Read, Write, Edit, Glob, Grep tools (no Bash needed — it's purely config manipulation)
- Add it to `agent-mappings.yaml` so it's available as a sub-agent for other agents

**Acceptance criteria:**

- [ ] Can create a valid `metadata.yaml` from a skill name and category
- [ ] Can register an existing skill: read its SKILL.md, infer category/description, generate metadata.yaml, wire into config.yaml (replaces D-40)
- [ ] Can add a new stack to `stacks.yaml` with correct agent/subcategory/skill structure
- [ ] Can add a new category to `skills-matrix.yaml` with proper schema
- [ ] Validates all output against schema rules
- [ ] Refuses to use bare subcategory names (enforces domain-prefix)
- [ ] Other agents can delegate config tasks to it via the Task tool

---

### Positioning & README

#### D-33: README: frame Agents Inc. as an AI coding framework

Rewrite the README to position Agents Inc. as an AI coding framework, not just a CLI tool. The key differentiator is the composability model and the level of extensibility — this needs to be worded carefully to be credible, not buzzwordy.

**What makes it genuinely a framework:**

- **Composable knowledge primitives** — skills are atomic, typed, categorized knowledge modules with a defined schema (markdown + YAML metadata + categories + tags + conflict rules)
- **Agent compilation pipeline** — skills are compiled into role-based agents via Liquid templates, YAML definitions, and markdown partials. This is a real build step, not just config
- **Ejectable internals** — users can eject agent templates, the skills matrix, and compilation artifacts to fully customize the pipeline. This is framework-level extensibility
- **Interactive agent composition** — the wizard lets you interactively build specialized sub-agents from modular skills, which is genuinely unique
- **Marketplace/plugin architecture** — custom skill sources, multi-source resolution, publishable stack plugins
- **Stack architecture** — pre-configured agent bundles with philosophy, agent roles, and skill assignments

**Wording constraints:**

- Must feel honest and specific, not like marketing fluff
- Lead with what it does concretely, then explain the framework aspect
- Avoid "revolutionary" / "powerful" / "game-changing" language
- The framework angle should emerge naturally from describing the features
- Don't overstate — it's a framework for composing Claude Code agents, not a general AI framework

**Possible framing angles to explore:**

- "A build system for AI coding agents" (emphasizes the compilation pipeline)
- "Composable skills for Claude Code" (emphasizes the modularity)
- "An agent composition framework" (emphasizes what makes it unique)
- The eject model mirrors how frameworks like Next.js/CRA work — sane defaults but full escape hatches

**Key sections to rework:**

- Opening paragraph — currently "the CLI for working with Agents Inc. skills" is underselling it
- "what this does" — should explain the framework concept
- "how skills work" — could emphasize the schema/type system aspect
- "architecture" — already describes framework internals, could be elevated

---

#### D-44: Update README and Notion page for `eject templates` type

Update external documentation to reflect D-43's change: `templates` is now a first-class eject type (`agentsinc eject templates`) instead of a flag (`--templates`) on `agent-partials`.

**What to update:**

- **README.md** — update any eject command examples or feature descriptions to show `agentsinc eject templates` instead of `agentsinc eject agent-partials --templates`
- **Notion page** — update the eject command documentation to list `templates` as a separate type alongside `agent-partials`, `skills`, and `all`
- Ensure the eject type list is consistent everywhere: `agent-partials | templates | skills | all`
- Remove any references to the `--templates` / `-t` flag

---

#### T-12: End-to-end tests for custom marketplace workflow

Test the full custom marketplace lifecycle: using `--source` to point at a custom marketplace, checking for outdated skills, and the change→build→update cycle.

**Test scenarios:**

1. **`--source` flag works with custom marketplaces** — `agentsinc init --source /path/to/custom-marketplace` loads skills from the custom source, not the default. Verify the wizard shows skills from the custom source and the compiled output references them correctly.

2. **`outdated` command detects stale skills** — After installing from a custom marketplace, make a change in the marketplace source, bump the version via `agentsinc build marketplace` + `agentsinc build plugins`, then verify `agentsinc outdated` correctly reports the consuming project has older versions.

3. **Full update cycle** — Make a change in a custom marketplace (add/modify a skill), run `agentsinc build marketplace` and `agentsinc build plugins` to bump the version, then run `agentsinc edit --refresh` (or equivalent) in the consuming app and verify it picks up the newer version.

**Test setup:**

- Use `createTestSource()` to create a fixture marketplace with versioned skills
- Use `/home/vince/dev/cv-launch` as the consuming project (or a temp directory)
- Tests should be self-contained — no dependency on the real skills repo

**Location:** `src/cli/lib/__tests__/integration/` or `src/cli/lib/__tests__/user-journeys/`

---

### Wizard UX

#### D-59: Unified scrolling across all wizard views

Apply the same scrolling pattern used in `step-agents.tsx`, `category-grid.tsx`, and `source-grid.tsx` to every wizard step that can overflow the terminal viewport. Currently only 3 of 8 step views support scrolling.

**Views that already scroll:**

- `step-build.tsx` → delegates to `category-grid.tsx` (pixel-offset + `measureElement`)
- `step-sources.tsx` → delegates to `source-grid.tsx` (same pattern)
- `step-agents.tsx` (row-based marginTop offset)

**Views that need scrolling:**

- **`step-stack.tsx`** (stack selection) — most important. With custom marketplace stacks + built-in stacks, the list can overflow. Currently delegates to `StackSelection` / `DomainSelection` subcomponents with no scroll support.
- **`step-settings.tsx`** (source management) — users with many custom sources (5+) will overflow.
- **`checkbox-grid.tsx`** (domain selection within `step-stack.tsx`) — with many custom domains, can overflow.

**Views that don't need scrolling:**

- `step-confirm.tsx` — intentionally brief summary
- `step-refine.tsx` — only 2 options

**Existing pattern to reuse (all three scrolling views use the same approach):**

1. Measure viewport height via `useMeasuredHeight()` hook
2. Pass `availableHeight` to the content component
3. Gate scrolling: `scrollEnabled = availableHeight > 0 && availableHeight >= SCROLL_VIEWPORT.MIN_VIEWPORT_ROWS`
4. Track focused item position, adjust `scrollTopPx` offset to keep it visible
5. Render: `<Box height={availableHeight} overflow="hidden"><Box marginTop={-scrollTopPx}>{content}</Box></Box>`

**Key files:**

- Scrolling pattern reference: `src/cli/components/wizard/category-grid.tsx:294-384`
- Height measurement hook: `src/cli/components/hooks/use-measured-height.ts`
- Scroll constants: `src/cli/consts.ts:145-156` (`SCROLL_VIEWPORT`)
- Unused virtual scroll hook (potential alternative): `src/cli/components/hooks/use-virtual-scroll.ts`

**Targets:**

- `src/cli/components/wizard/step-stack.tsx` + `stack-selection.tsx`
- `src/cli/components/wizard/step-settings.tsx`
- `src/cli/components/wizard/checkbox-grid.tsx`

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

#### D-61: Preserve stack skill selections when toggling domains

When a stack is selected and the user deselects a domain in the domain selection view, all skills for that domain are cleared. If the user re-selects the domain, the skills should be restored to the stack's defaults — currently they come back empty.

**Expected behavior:**

- Deselect a domain → skills for that domain are cleared (current behavior, correct)
- Re-select the same domain → skills are restored from the stack's preset selections

**Key files:**

- `src/cli/components/wizard/step-stack.tsx` — domain toggle handler
- `src/cli/components/wizard/wizard-store.ts` — domain/skill selection state
- `src/cli/components/wizard/checkbox-grid.tsx` — domain checkbox rendering

---

#### D-63: Add E2E tests to pre-commit hook

The pre-commit hook (`.husky/pre-commit`) currently runs `lint-staged` (prettier) and `bun run test` (unit tests only). E2E tests are not run, so broken E2E tests can be committed without detection.

Add the E2E test suite to the pre-commit hook so that both unit and E2E tests must pass before a commit is accepted.

**Current hook:**

```
npx lint-staged
bun run test
```

**Key considerations:**

- E2E tests take ~60s — acceptable for pre-commit but consider making it skippable for intermediate commits per the commit protocol (`--no-verify`)
- E2E tests require the binary to be built (`npm run build`) — the hook may need to ensure the binary is up to date
- The commit protocol already says to use `--no-verify` for intermediate sequential commits, so the longer runtime only applies to first/last commits

**Files:** `.husky/pre-commit`, possibly `package.json` scripts

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

#### D-66: Make config.yaml resilient to custom skill IDs without load-order dependency

**Priority:** Medium

Currently, custom skill IDs (like `engine-operations`) pass config.yaml validation only because `extendSchemasWithCustomValues()` is called during source loading BEFORE the config is parsed. This creates a fragile load-order dependency: if config.yaml is read without first scanning the source (e.g., during `compile`, `edit`, or any command that loads config independently), custom skill IDs fail `extensibleSkillIdSchema` validation because they haven't been registered yet.

**Problem:** The validation of config.yaml skill IDs depends on runtime state (`customExtensions.skillIds` Set) that must be populated first. If the ordering changes, or a new command reads config without loading the source, custom skills silently break.

**Possible approaches:**

1. **`custom: true` marker in config.yaml** — Add an explicit marker for custom skills in the config, e.g.:

   ```yaml
   skills:
     - web-framework-react
     - engine-operations # custom: true
   ```

   Or a separate `customSkills` array. This makes the config self-describing — no external state needed for validation.

2. **Two-pass validation** — Parse config.yaml leniently first (accept any kebab-case skill ID), load the source to discover custom values, then validate strictly. This preserves the current schema but adds a validation pass after source loading.

3. **Persisted custom extensions** — When `init`/`edit` writes config.yaml, also write a `customExtensions` section listing the custom skill IDs, categories, and domains. On read, populate `customExtensions` from the config itself before strict validation.

4. **Lenient config schema** — Accept any kebab-case string as a skill ID in config.yaml (no prefix enforcement). Strict validation only at compile time when the full source context is available.

**Affected files:**

- `src/cli/lib/schemas.ts` — `extensibleSkillIdSchema`, `projectConfigLoaderSchema`
- `src/cli/lib/loading/source-loader.ts` — `discoverAndExtendFromSource()` (current registration point)
- `src/cli/lib/configuration/config.ts` — `loadProjectSourceConfig()`
- `src/cli/lib/installation/local-installer.ts` — config writing

---

#### D-65: Refresh stale marketplace before plugin installation

**Priority:** Medium

When `init` or `edit` installs skill plugins, it shells out to `claude plugin install skillId@marketplace`. Claude CLI resolves the marketplace from its registered copy at `~/.claude/plugins/marketplaces/{name}/`. The `init` command (line 232-245) only checks whether the marketplace **exists** — if it does, it skips registration and never updates it. This means newly added skills (e.g., custom skills added after the marketplace was first registered) are invisible to `claude plugin install`.

**Problem:** The registered marketplace is a git clone. When new skills are added to the source repo, compiled, and the marketplace.json is updated, the registered copy at `~/.claude/plugins/marketplaces/` remains on the old commit. `claude plugin install` reads the stale copy and reports "Plugin not found in marketplace".

**Proposed fix:** Before installing plugins in `init` and `edit`, check if the registered marketplace is outdated and refresh it:

1. If the registered marketplace is a git repo, run `git pull` (or `git fetch` + compare)
2. If the registered marketplace was fetched from a remote source, re-fetch it
3. If the marketplace source is a local directory, compare timestamps or hashes

**Affected files:**

- `src/cli/commands/init.tsx` — `installSelectedPlugins()` method (line 224-259)
- `src/cli/commands/edit.tsx` — similar plugin installation flow
- `src/cli/utils/exec.ts` — may need a `claudePluginMarketplaceUpdate()` helper

**Acceptance criteria:**

- [ ] `init` refreshes a stale marketplace before installing plugins
- [ ] `edit` refreshes a stale marketplace before installing plugins
- [ ] Works for git-cloned marketplaces (the common case)
- [ ] Graceful fallback if refresh fails (warn and continue with stale copy)

---

## Testing Tasks

See [TODO-testing.md](./TODO-testing.md) for the full testing guide: coverage table (what is and isn't tested), automated test tasks T1-T6, step-by-step manual procedures for every command, and the 28-point quick-pass checklist.

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/skills`
- CLI under test: `/home/vince/dev/cli`
