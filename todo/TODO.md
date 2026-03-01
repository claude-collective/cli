# Agents Inc. CLI - Task Tracking

| ID   | Task                                                                                                                                       | Status        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| B-08 | Uninstall does not remove compiled agents — `loadProjectSourceConfig` returns null so `target.config` guard skips agent removal            | Bug           |
| D-50 | ~~Matrix decomposition~~ — all 8 phases complete (see [phased plan](./TODO-matrix-decomposition.md))                                       | Done          |
| D-46 | Custom extensibility — generated types for custom skills/agents/categories (see [implementation plan](./D-46-ts-config-migration.md))      | Ready for Dev |
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
| D-41 | Create `agents-inc` configuration skill (see [implementation plan](./D-41-config-sub-agent.md))                                            | Ready for Dev |
| D-60 | Remove `cli-migrator` subagent                                                                                                             | Ready for Dev |
| D-61 | Preserve stack skill selections when toggling domains                                                                                      | Ready for Dev |
| D-62 | Review default stacks: include meta/methodology/reviewing skills                                                                           | Ready for Dev |
| D-63 | Add E2E tests to pre-commit hook                                                                                                           | Ready for Dev |
| D-64 | Create CLI E2E testing skill + update `cli-framework-oclif-ink` skill                                                                      | Ready for Dev |
| D-65 | Init/edit scope: global config detection + prompt (see [implementation plan](./D-65-init-edit-scope.md))                                   | Ready for Dev |
| D-66 | AI-assisted PR review: categorize diffs by type (mechanical vs logic vs test) for easier review                                            | Investigate   |
| D-67 | Remove `aliases` from skill-rules.ts — derive display name mappings from a typed `Record<SkillId, SkillDisplayName>` map                   | Investigate   |
| D-68 | Remove `--dry-run` flag entirely — wizard confirm step already previews, operations are local/reversible                                   | Ready for Dev |
| D-69 | Config migration strategy — detect and handle outdated config shapes across CLI version upgrades                                           | Investigate   |
| D-70 | `new skill` / `new agent` should update config.ts + rename Subcategory → Category                                                          | Ready for Dev |
| B-07 | Fix skill sort order changing on select/deselect in build step                                                                             | Ready for Dev |
| B-09 | `new skill` + `edit` installs custom skill as plugin source instead of local                                                               | Bug           |
| R-01 | `loadStackById` should check default stacks internally — callers shouldn't need to know about both sources                                 | Refactor      |
| R-02 | Flatten nested for-loops in `default-stacks.test.ts` — parameterize per (stack, agent, subcategory) instead of nesting inside `it.each`    | Refactor      |
| R-03 | Simplify `config-generator.ts` — reduce nested loops, intermediate maps, and function complexity                                           | Refactor      |

---

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).
For final release tasks, see [TODO-final.md](./TODO-final.md).

---

## Reminders for Agents

See [docs/guides/agent-reminders.md](../docs/guides/agent-reminders.md) for the full list of rules (use specialized agents, handle uncertainties, blockers, commit policy, archiving, status updates, context compaction, cross-repo changes).

---

## Active Tasks

### B-08: Uninstall does not remove compiled agents

**Symptom:** Running `agentsinc uninstall` does not remove `.claude/agents/` even when agents were compiled by the CLI.

**Root cause:** Agent removal is gated on `target.config !== null` (line 398 of `uninstall.tsx`). The `loadProjectSourceConfig` call uses jiti to load `.claude-src/config.ts`, which may fail silently and return `null` — causing the guard to skip agent removal entirely.

**Likely failure modes:**

1. jiti fails to resolve `@agents-inc/cli/config` (the `defineConfig` import) when the CLI binary path differs from what the alias expects
2. The `projectSourceConfigSchema` Zod validation rejects the loaded config (e.g., missing required fields, or the `defineConfig` wrapper confuses the parser)
3. Edge case: user has a `config.yaml` from before the TS migration — the code only checks for `config.ts`

**Why unit tests pass:** The test helper `createProjectConfig` writes a bare `export default {...}` without the `defineConfig` import, so jiti always succeeds. Real configs use `import { defineConfig } from "@agents-inc/cli/config"` which requires the jiti alias to work.

**Fix direction:** Debug why `loadProjectSourceConfig` returns null in production. The agent removal guard should probably also check for the agents directory being CLI-compiled via a different signal (e.g., presence of compiled agent frontmatter) rather than relying solely on config load success.

**Location:** `src/cli/commands/uninstall.tsx:396-411`, `src/cli/lib/configuration/config.ts:55-70`

---

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

#### D-41: Create `agents-inc` configuration skill

**Priority:** Medium

Create a configuration **skill** (not a sub-agent) that gives Claude deep expertise in the Agents Inc CLI's YAML config system. The skill loads into the main conversation on demand, enabling interactive config work — Claude can ask clarifying questions, propose changes, and iterate with the user.

**Why a skill instead of an agent:** Sub-agents (Task tool) are not interactive — they run autonomously and return a single result. Config tasks frequently need clarification ("Which category?", "Replace or add alongside?"). A skill in the main conversation preserves full interactivity.

**What it teaches Claude:**

- Creates and updates `metadata.yaml` files for skills (with correct domain-prefixed `category` values, author, displayName, etc.)
- Creates and updates `stacks.yaml` entries (agent definitions, skill assignments, preloaded flags)
- Updates `skills-matrix.yaml` (adding/modifying categories, skill entries, dependency rules)
- Updates `.claude-src/config.yaml` mappings (source paths, plugin settings, skill assignments)
- Knows the valid `Subcategory` enum values (38) and enforces them
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
- [ ] Can add a new stack to `stacks.yaml` with correct agent/subcategory/skill structure
- [ ] Can add a new category to `skills-matrix.yaml` with proper schema
- [ ] Validates all output against schema rules (embedded knowledge)
- [ ] Refuses to use bare subcategory names (enforces domain-prefix)
- [ ] Loads correctly via Skill tool for both users and other agents

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

#### D-67: Remove `aliases` from skill-rules.ts

**Priority:** Low
**Status:** Investigate

Now that configs are TypeScript (D-46), the `aliases` object in `skill-rules.ts` (mapping display names like `"react"` to full skill IDs like `"web-framework-react"`) may be redundant. The same mapping could be derived from a typed `Record<SkillId, SkillDisplayName>` map, with both directions (ID→name, name→ID) generated at build time or load time.

**Current flow:**

- `skill-rules.ts` has `aliases: { react: "web-framework-react", vue: "web-framework-vue-composition-api", ... }`
- `loadSkillRules()` parses this into `SkillRulesConfig.aliases`
- `mergeMatrixWithSkills()` uses aliases to build `displayNameToId` / `displayNames` on the merged matrix
- `resolveAlias()` resolves display names to canonical IDs throughout the wizard and validation

**Investigation needed:**

- Can `displayName` from `metadata.yaml` (already extracted per-skill) replace the aliases map entirely?
- If so, skill-rules.ts only needs `relationships` and `perSkillRules` — no `aliases` section
- The `SkillRulesConfig` type, `loadSkillRules()`, and `mergeMatrixWithSkills()` would simplify
- `displayNameToId` / `displayNames` on `MergedSkillsMatrix` would be built from extracted metadata instead of a hand-maintained aliases map
- Check if any aliases differ from the `displayName` in metadata (i.e., are there aliases that aren't just the display name?)

**Key files:**

- `src/cli/types/matrix.ts` — `SkillRulesConfig.aliases`, `MergedSkillsMatrix.displayNameToId`
- `src/cli/lib/matrix/matrix-loader.ts` — `loadSkillRules()`, `mergeMatrixWithSkills()`
- `src/cli/lib/matrix/matrix-resolver.ts` — `resolveAlias()`
- Skills repo: `config/skill-rules.ts` — the aliases object itself

---

#### D-68: Remove `--dry-run` flag entirely

**Priority:** Low

The `--dry-run` flag adds ~143 lines of conditional preview logic across 3 commands, plus 13 unit tests and 1 e2e test. The wizard's confirm step already previews what will be installed, and all operations are local/reversible. 19 of 22 commands inherit the flag but don't implement it.

**What to remove:**

- `base-command.ts`: `dry-run` from `baseFlags`
- `compile.ts`: 3 `if (flags["dry-run"])` branches (~28 lines)
- `init.tsx`: dry-run preview block (~55 lines)
- `uninstall.tsx`: dry-run branches + `dryRunLocalRemoval()` method (~60 lines)
- `utils/messages.ts`: `DRY_RUN_MESSAGES` constants
- Unit tests: 13 dry-run test cases across compile, init, uninstall test files
- E2E tests: dry-run assertions in compile e2e

---

#### D-69: Config migration strategy

**Priority:** Medium
**Status:** Investigate

When the CLI's `ProjectConfig` shape changes between versions (new required fields, renamed properties, restructured objects), users with older configs will hit failures on `edit` or `compile`. Need a strategy for detecting and handling outdated config shapes.

**Scenarios to handle:**

- New optional field added → no breakage (Zod `.passthrough()` handles this)
- New required field added → old configs fail Zod validation
- Field renamed → old field ignored, new field missing
- Field type changed → Zod validation fails
- Structural change (e.g., YAML → TS migration) → config unreadable

**Possible approaches:**

1. **Config version field** — add `version: "1"` to ProjectConfig. CLI checks version on load and runs migration functions for older versions
2. **Lenient loading + migration on write** — load with a permissive schema, detect missing/changed fields, fix them, write the updated config
3. **`agentsinc migrate` command** — explicit migration command that updates config shape (like `prisma migrate` or `next codemod`)
4. **Silent auto-migration** — CLI detects old format, migrates in-place, warns the user
5. **Re-init prompt** — if config is too old, prompt the user to re-run `init` with their existing selections preserved

**Investigation needed:**

- How do Prisma, Next.js, ESLint handle config schema evolution?
- What's the right granularity for version numbers? Per-field? Per-schema? Semver-tied?
- Should migration be automatic or explicit?
- How to preserve user customizations during migration (e.g., hand-edited fields)?
- Should the CLI refuse to run with an outdated config, or best-effort load it?

**Related:** D-46 (TS config migration) was the first instance of this problem. The approach there was a breaking change with no migration path (pre-1.0). Post-1.0 will need a real strategy.

**Key files:**

- `src/cli/lib/configuration/ts-config-loader.ts` — config loading
- `src/cli/lib/schemas.ts` — Zod validation schemas
- `src/cli/types/config.ts` — ProjectConfig type definition

---

#### D-70: `new skill` / `new agent` should update config.ts + rename Subcategory → Category

**Priority:** Medium

Four related changes:

**Part 1: Add to config.ts arrays with sectioned comments** — Ready for Dev

When running `agentsinc new skill` or `agentsinc new agent`, add the entity to the project's `.claude-src/config.ts`. Arrays should use `// Custom` / `// Marketplace` section comments:

```typescript
skills: [
  // Custom
  "my-custom-skill",
  // Marketplace
  "web-framework-react",
  "api-framework-hono",
],
domains: [
  // Custom
  "dummy",
  // Marketplace
  "web",
  "api",
],
```

Expected behavior:

- `agentsinc new skill my-custom-skill --domain dummy` → adds skill to `skills[]`, domain to `domains[]`
- `agentsinc new agent my-custom-agent` → adds agent to `agents[]`
- If the entity is already in the array, skip (no duplicates)
- If no `config.ts` exists yet, warn the user to run `init` first
- Requires a custom serializer for config.ts (current `generateConfigSource` uses `JSON.stringify` — no comments)
- Classification data (custom vs marketplace) needed at write time — use the matrix from background load

**Part 2: Add custom domain/category to config-types.ts unions** — DONE

`regenerateConfigTypes` now accepts `extras.extraSkillIds`, `extras.extraAgentNames`, `extras.extraDomains`, and `extras.extraCategories`. All four are merged into their respective union types and custom sets. `new/skill.ts` passes domain and category alongside skill ID.

**Part 3: E2e tests for config-types.ts regeneration** — Ready for Dev

Test that `new skill` with custom domain/category produces correct config-types.ts output:

- Custom skill ID appears in `SkillId` union under `// Custom`
- Custom domain appears in `Domain` union under `// Custom`
- Custom category appears in `Subcategory` union under `// Custom`
- Marketplace values remain under `// Marketplace`

**Part 4: Rename Subcategory → Category**

The type `Subcategory` in `config-types.ts` and `types-matrix.ts` is confusing — it represents the same concept as `category` in `metadata.yaml`. Rename throughout:

- `Subcategory` type → `Category`
- `subcategorySchema` → `categorySchema`
- `SUBCATEGORY_VALUES` → `CATEGORY_VALUES`
- `SUBCATEGORY_VALUES_SET` → `CATEGORY_VALUES_SET`
- `extensibleSubcategorySchema` → `extensibleCategorySchema`
- `SubcategorySelections` → `CategorySelections`
- `ResolvedSubcategorySkills` → `ResolvedCategorySkills`
- `StackAgentConfig` key type: `Partial<Record<Subcategory, ...>>` → `Partial<Record<Category, ...>>`
- All `typedEntries<Subcategory, ...>` / `typedKeys<Subcategory>` call sites
- All test data using `Subcategory` type annotations
- Update `config-types-writer.ts` to emit `export type Category = ...` instead of `export type Subcategory = ...`

This is a mechanical rename — grep for `Subcategory` (case-sensitive) across the entire codebase. The `CategoryPath` type alias can stay (it adds `"local"` and bare forms on top of `Category`).

**Key files:**

- `src/cli/types-matrix.ts` — `Subcategory` union definition, `SubcategorySelections`, `ResolvedSubcategorySkills`
- `src/cli/lib/schemas.ts` — `SUBCATEGORY_VALUES`, `subcategorySchema`, `extensibleSubcategorySchema`, `SUBCATEGORY_VALUES_SET`
- `src/cli/lib/configuration/config-types-writer.ts` — generates `Subcategory` type, `extraCategories`/`extraDomains` support
- `src/cli/lib/configuration/config-writer.ts` — `generateConfigSource()` needs sectioned array serializer
- `src/cli/commands/new/skill.ts` — `new skill` command
- `src/cli/commands/new/agent.tsx` — `new agent` command
- `src/cli/lib/configuration/config-loader.ts` — `loadConfig()` for reading existing config
- ~50+ files referencing `Subcategory` type

---

### B-09: `new skill` + `edit` installs custom skill as plugin source instead of local

**Symptom:** After `agentsinc new skill dummy-react`, running `agentsinc edit` and selecting the new skill shows it being installed as `dummy-react@agents-inc` (plugin source), which fails because the skill doesn't exist in the marketplace. The source should be `local` since the skill was just created locally.

**Reproduction:**

1. `agentsinc new skill dummy-react --domain dummy`
2. `agentsinc edit` → select the new `dummy-react` skill → confirm
3. Error: `Plugin "dummy-react" not found in marketplace "agents-inc"`

**Likely root cause:** When the edit wizard resolves skill sources, locally-created skills are not being detected as local-source skills. The source resolution logic may default to plugin/marketplace when it can't find source metadata, or the `new skill` command may not be writing enough metadata for the resolver to classify it as local.

**Investigation areas:**

- `src/cli/lib/loading/source-loader.ts` — how skill sources are resolved
- `src/cli/lib/resolver.ts` — skill resolution logic
- `src/cli/commands/new/skill.ts` — what metadata/config `new skill` writes
- `src/cli/lib/installation/local-installer.ts` — local install path
- How `availableSources` / `activeSource` on `ResolvedSkill` are populated for locally-created skills

---

## Testing Tasks

See [TODO-testing.md](./TODO-testing.md) for the full testing guide: coverage table (what is and isn't tested), automated test tasks T1-T6, step-by-step manual procedures for every command, and the 28-point quick-pass checklist.

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/skills`
- CLI under test: `/home/vince/dev/cli`
