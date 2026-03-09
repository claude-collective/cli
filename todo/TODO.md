# Agents Inc. CLI - Task Tracking

| ID   | Task                                                                                                                  | Status        |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ------------- |
| D-52 | Expand `new agent` command: config lookup + compile-on-demand (see [implementation plan](./D-52-expand-new-agent.md)) | Ready for Dev |
| D-74 | Per-agent scope toggle (project/global) — same as per-skill scope but for agents in the wizard                        | Needs Design  |
| D-37 | Dual-installation resolution: global + project (see [design doc](./D-37-dual-installation.md))                        | Design        |
| D-76 | Init: generate project `config-types.ts` that imports from global `~/.claude-src/config-types.ts`                     | Ready for Dev |
| D-77 | Wizard: show stack scope origin labels (global vs project) in build step                                              | Needs Design  |
| D-38 | Remove web-base-framework, allow multi-framework (see [implementation plan](./D-38-remove-base-framework.md))         | Has Open Qs   |
| D-39 | Couple meta-frameworks with base frameworks (see [implementation plan](./D-39-couple-meta-frameworks.md))             | Ready for Dev |
| D-41 | Create `agents-inc` configuration skill (see [implementation plan](./D-41-config-sub-agent.md))                       | Ready for Dev |
| D-62 | Review default stacks: include meta/methodology/reviewing skills                                                      | Ready for Dev |
| D-64 | Create CLI E2E testing skill + update `cli-framework-oclif-ink` skill                                                 | Ready for Dev |
| D-66 | AI-assisted PR review: categorize diffs by type (mechanical vs logic vs test) for easier review                       | Investigate   |
| D-67 | Skill metadata as single source of truth — eliminate redundant central config for intrinsic skill properties          | Investigate   |
| D-69 | Config migration strategy — detect and handle outdated config shapes across CLI version upgrades                      | Investigate   |
| D-79 | Agent selection step causes infinite re-render — screen scrolls/refreshes every millisecond                           | Bug           |
| D-80 | Init with existing global install: project config-types doesn't import from global scope                             | Bug           |
| D-81 | Config.ts: extract agents, skills, and stack into named variables above `export default`                             | Ready for Dev |
| D-85 | Create a proper `SkillId` union type from all known skills, enforce in tests                                         | Ready for Dev |
| D-87 | Audit and remove unsafe `as` casts — only allowed at Zod/YAML parse boundaries                                       | Ready for Dev |
| D-88 | Audit and remove multi-tier resolution fallbacks — data should match or fail, not guess                              | Ready for Dev |
| D-89 | Audit and remove silent fallbacks on required data — `findSkill` → `getSkill`, remove `?.`/`?? ""` patterns         | Ready for Dev |
| D-90 | Add Sentry tracking for unresolved matrix references — `getDiscourageReason` and `validateSelection` fallback paths | Ready for Dev |

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

### Per-Agent and Global Resolution

#### D-74: Per-agent scope toggle (project/global)

**Priority:** Medium
**Depends on:** Per-skill scope (done in 0.57.0/0.58.0)

Add per-agent scope toggle in the wizard's agents step, mirroring the per-skill S key toggle. Each agent can be scoped to `"project"` (compiled to `.claude/agents/`) or `"global"` (compiled to `~/.claude/agents/`).

**Use case:** Meta agents (documenter, researcher, reviewer) are global — available in every project. Domain-specific agents (web-developer, api-developer) are project-scoped.

**Implementation areas:**

- Agents step UI: S key toggle on focused agent, [P]/[G] badge
- `AgentConfig` type: `{ name: AgentName, scope: "project" | "global" }` (mirrors `SkillConfig`)
- Wizard store: `agentConfigs: AgentConfig[]`, `toggleAgentScope`, `focusedAgentId`
- Confirm step: show per-agent scope summary
- Compilation: write agent `.md` files to the correct directory based on scope
- Config persistence: save `agentConfigs` array to the correct `config.ts` (global or project)

---

#### D-37: Dual-installation resolution (global + project)

**Priority:** Medium
**Depends on:** D-74
**Design doc:** [`D-37-dual-installation.md`](./D-37-dual-installation.md)

Two separate installations with their own configs. The project `config.ts` imports from global and extends it — standard TypeScript, no runtime merge. Both local and plugin global skills supported. Compiler resolves from both `~/.claude/` and `.claude/`. Auto-creates blank global on first init so the import is always valid.

**Phases:** (1) local installer path routing by scope, (2) config splitting on save with import generation, (3) compiler resolves both directories, (4) per-agent scope (D-74), (5) edit flow with scope migration

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

### Bugs

#### D-79: Agent selection step infinite re-render

**Priority:** High

The agent selection step in the wizard causes an infinite re-render loop — the screen scrolls and refreshes every millisecond. Needs investigation into which state change or effect is triggering the loop.

---

#### D-80: Project config-types doesn't import from global on init

**Priority:** High

When running `init` and a global installation is detected but the user chooses to create a project-level installation, the generated `config-types.ts` doesn't import from the global scope. It should automatically import everything from `~/.claude-src/config-types.ts` so project types extend global types.

**Related:** D-76 (generate project config-types that imports from global)

---

#### D-87: Audit and remove unsafe `as` casts — only allowed at Zod/YAML parse boundaries

**Priority:** Medium

Throughout the codebase (production and test), there are `as` type casts that bypass TypeScript's type system. These hide missing required properties and mask real type errors.

**Rule:** The only legitimate `as` casts are at data entry boundaries — immediately after `JSON.parse()`, `parseYaml()`, `safeLoadYamlFile()`, or a Zod `.parse()` / `.safeParse()` where the Zod output type is wider than the actual interface (due to `.passthrough()`). Every other `as` cast should be eliminated by fixing the data to be properly typed.

**Known example:** `wizard-store.test.ts` has numerous `as Record<Category, CategoryDefinition>` casts on incomplete category objects. These should use `createMockCategory()` factories that provide all required fields.

**Scope:** Grep for `\bas\b` casts across the entire codebase. Each site needs evaluation: is it at a parse boundary (keep), or is it papering over incomplete/wrong data (fix)?

---

#### D-85: Create proper `SkillId` union from all known skills

**Priority:** Medium

Currently `SkillId` is a loose template literal `` `${SkillIdPrefix}-${string}-${string}` `` which accepts any string matching the pattern (e.g., `"web-skill-a"`). This means `createMockSkill("web-skill-a")` compiles fine even though `"web-skill-a"` is not a real skill.

Create a proper union type of all actual skill IDs (generated from the skills matrix or marketplace), similar to how `Domain`, `Category`, and `AgentName` are explicit unions. This would:
- Catch invalid skill IDs at compile time in both production code and tests
- Eliminate the need for the canonical skill registry in `__tests__/helpers.ts` — TypeScript itself enforces validity
- Make `createMockSkill()` only accept real skill IDs

**Approach:** The union could be auto-generated into `config-types.ts` (already done per-project), but the base set of all marketplace skills needs a generated union in `types/skills.ts` or similar. May need a codegen step that reads the skills matrix.

---

#### D-89: Audit and remove silent fallbacks on required data — `findSkill` → `getSkill`, remove `?.`/`?? ""` patterns

**Priority:** Medium

Throughout the codebase, there are places where `findSkill(id)` (returns undefined) is used on data that **must** exist, followed by `?.` optional chaining and `?? ""` / `?? []` fallbacks. This silently hides bugs — if a skill doesn't exist when it should, we need to know immediately, not default to empty strings.

**Principle:** If the data must exist, use `getSkill(id)` (throws). Only use `findSkill(id)` when the data is genuinely optional (e.g., user input that might not match, search results).

**Known example:** `buildSourceRows()` in `wizard-store.ts` (lines 936-960) calls `findSkill(skillId)` on skills from `selectedTechnologies` — these must exist. The `skill?.slug ?? ""` and `skill?.availableSources || []` fallbacks should be removed.

**Scope:** Grep for `findSkill` calls followed by `?.` or `??` across the entire codebase. Each site needs evaluation: is the skill genuinely optional, or must it exist? Convert the "must exist" cases to `getSkill()`.

---

#### D-90: Add Sentry tracking for unresolved matrix references

**Priority:** Medium

In `src/cli/lib/matrix/matrix-resolver.ts`, `getDiscourageReason()` (lines 213-227) and `validateSelection()` (lines 315, 342, 381, 444) use `findSkill(id)` with fallback to the raw ID when a skill referenced in `requires`, `conflictsWith`, or `providesSetupFor` doesn't exist in the matrix. This is intentionally graceful — crashing the wizard on bad matrix data is worse than degraded labels. But we need visibility into how often this happens.

Add Sentry `captureMessage` (or `captureException`) calls on every fallback path so we can track unresolved matrix references in production. Include the referencing skill ID, the missing referenced ID, and the relationship type (`requires`, `conflictsWith`, `providesSetupFor`) in the Sentry context.

**Key file:** `src/cli/lib/matrix/matrix-resolver.ts`

---

#### D-88: Audit and remove multi-tier resolution fallbacks — data should match or fail, not guess

**Priority:** Medium

Throughout the codebase, there are multi-tier resolution patterns that silently guess when data doesn't match. Instead of trying progressively looser matches, data should be validated at the source — if it doesn't match, throw or warn and skip.

**Principle:** Don't build fallback chains to compensate for bad data. Fix the data instead. If a lookup fails, that's an error, not an invitation to try a fuzzier match.

**Known example:** `getPluginSkillIds()` in `plugin-finder.ts` (lines 73-135) has a three-tier fallback: (1) check if frontmatter `name` is a direct skill ID, (2) try slug/alias resolution, (3) fall back to directory name. The `name` field IS the canonical skill ID — if it doesn't match, that's a data error.

**Scope:** Grep for multi-step resolution patterns, `aliasToId` maps, directory-name fallbacks, and similar guess-and-try logic across the codebase. Each site should be simplified to: validate → match or throw.

---

#### D-81: Config.ts should use named variables instead of one massive object

**Priority:** Medium

Currently `generateConfigSource()` produces a single monolithic `export default { ... } satisfies ProjectConfig` with everything inlined. Instead, agents, skills, and stack should be extracted into typed named variables defined above the export, with the export default referencing them:

```typescript
import type { ProjectConfig, SkillConfig, AgentScopeConfig, StackAgentConfig } from "./config-types";

const skills: SkillConfig[] = [
  { id: "web-framework-react", scope: "project", source: "agents-inc" },
  // ...
];

const agents: AgentScopeConfig[] = [
  { name: "web-developer", scope: "global" },
  // ...
];

const stack: Record<string, StackAgentConfig> = {
  "web-developer": { "web-framework": "web-framework-react" },
  // ...
};

export default {
  name: "my-project",
  skills,
  agents,
  stack,
  source: ".",
} satisfies ProjectConfig;
```

This makes the config scannable at a glance — users see the shape of the export, then can jump to the section they want to edit.

**Key files:** `src/cli/lib/configuration/config-writer.ts` — `generateConfigSource()` and `generateProjectConfigWithGlobalImport()`

---

## Testing Tasks

See [TODO-testing.md](./TODO-testing.md) for the full testing guide: coverage table (what is and isn't tested), automated test tasks T1-T6, step-by-step manual procedures for every command, and the 28-point quick-pass checklist.

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/skills`
- CLI under test: `/home/vince/dev/cli`
