# Agents Inc. CLI - Task Tracking

| ID   | Task                                                                                                                  | Status        |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ------------- |
| D-37 | Install mode UX redesign (see [design doc](../docs/features/proposed/install-mode-redesign.md))                       | Refined       |
| D-52 | Expand `new agent` command: config lookup + compile-on-demand (see [implementation plan](./D-52-expand-new-agent.md)) | Ready for Dev |
| D-37 | Merge global + project installations in resolution (see [implementation plan](./D-37-merge-installs.md))              | Has Open Qs   |
| D-53 | Rename `agent.yaml` to `metadata.yaml` (see [implementation plan](./D-53-rename-agent-yaml.md))                       | Ready for Dev |
| D-38 | Remove web-base-framework, allow multi-framework (see [implementation plan](./D-38-remove-base-framework.md))         | Has Open Qs   |
| D-39 | Couple meta-frameworks with base frameworks (see [implementation plan](./D-39-couple-meta-frameworks.md))             | Ready for Dev |
| D-41 | Create `agents-inc` configuration skill (see [implementation plan](./D-41-config-sub-agent.md))                       | Ready for Dev |
| D-62 | Review default stacks: include meta/methodology/reviewing skills                                                      | Ready for Dev |
| D-64 | Create CLI E2E testing skill + update `cli-framework-oclif-ink` skill                                                 | Ready for Dev |
| D-65 | Init/edit scope: global config detection + prompt (see [implementation plan](./D-65-init-edit-scope.md))              | Ready for Dev |
| D-66 | AI-assisted PR review: categorize diffs by type (mechanical vs logic vs test) for easier review                       | Investigate   |
| D-67 | Skill metadata as single source of truth — eliminate redundant central config for intrinsic skill properties          | Investigate   |
| D-69 | Config migration strategy — detect and handle outdated config shapes across CLI version upgrades                      | Investigate   |
| B-09 | `new skill` + `edit` installs custom skill as plugin source instead of local                                          | Bug           |

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

### CLI Improvements

#### D-37: Install mode UX redesign

Replace the hidden `P` hotkey toggle with an explicit install mode choice on the confirm step. Implement mode migration during edit (local to plugin, plugin to local, per-skill customize). The current `P` toggle during edit is completely broken -- config is never updated, artifacts are never migrated.

**Design doc:** [`docs/features/proposed/install-mode-redesign.md`](../docs/features/proposed/install-mode-redesign.md)

**Location:** `step-confirm.tsx`, `wizard.tsx`, `wizard-layout.tsx`, `help-modal.tsx`, `wizard-store.ts`, `edit.tsx`, `local-installer.ts`, `agent-recompiler.ts`, `types/config.ts`.

---

### Framework Infrastructure

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
- Agents are merged (union), with project overriding per-agent per-category stack mappings
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

#### D-67: Skill metadata as single source of truth — eliminate redundant central config

**Priority:** Low
**Status:** Investigate

The current architecture stores skill properties in three places: `metadata.yaml` per-skill, `skill-categories.ts` centrally, and `skill-rules.ts` centrally. These get merged at load time into a massive `MergedSkillsMatrix` object. This means intrinsic skill properties (display name, description, category, domain) are duplicated between the skill's own metadata and central config files.

**Goal:** Skill metadata should be the authoritative source for all intrinsic skill properties. Central config should only contain inter-skill concerns (relationships, conflicts, recommendations, per-skill compatibility rules). Display names / aliases should come from `metadata.yaml` `displayName` field, not a hand-maintained central map.

**This is part of a larger direction:**

- Make `displayName` required in `metadata.yaml` (currently optional)
- Remove the `aliases` section from `skill-rules.ts` — derive `displayNameToId` / `displayNames` from extracted skill metadata at load time
- Evaluate whether `skill-categories.ts` and `skill-rules.ts` need to be files at all, vs. populating a global store directly from skill metadata + typed inter-skill rules
- The `perSkill` section in `skill-rules.ts` currently uses alias keys (e.g., `react`, `zustand`) — these would need to use either full skill IDs or the `displayName` from metadata
- Investigate an intermediate store pattern that collects skill metadata at load time and serves as the single lookup point for all skill properties

**Current files involved:**

- `src/cli/lib/configuration/default-rules.ts` — hardcoded aliases + relationships + perSkill rules
- `src/cli/lib/matrix/matrix-loader.ts` — `loadSkillRules()`, `mergeMatrixWithSkills()`
- `src/cli/types/matrix.ts` — `SkillRulesConfig.aliases`, `MergedSkillsMatrix.displayNameToId`
- `src/cli/lib/matrix/matrix-resolver.ts` — `resolveAlias()`
- Skills repo: `config/skill-rules.ts`, `config/skill-categories.ts`, individual `metadata.yaml` files

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
