# Agents Inc. CLI - Task Tracking

| ID   | Task                                                  | Status       |
| ---- | ----------------------------------------------------- | ------------ |
| B-03 | Edit pre-selection allows incompatible skills          | Bug          |
| B-02 | Validate compatibleWith/conflictsWith refs in metadata | Pending      |
| B-01 | Edit wizard shows steps that were omitted during init | Bug          |
| U13  | Run Documentor Agent on CLI Codebase                  | Pending      |
| H18  | Tailor documentation-bible to CLI repo                | Phase 3 only |
| D-28 | Fix startup warning/error messages                    | Pending      |
| D-33 | README: frame Agents Inc. as an AI coding framework   | Pending      |

---

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).
For final release tasks, see [TODO-final.md](./TODO-final.md).

---

## Reminders for Agents

See [docs/guides/agent-reminders.md](../docs/guides/agent-reminders.md) for the full list of rules (use specialized agents, handle uncertainties, blockers, commit policy, archiving, status updates, context compaction, cross-repo changes).

---

## Active Tasks

### Bugs

#### B-03: Edit pre-selection allows incompatible skills

When running `agentsinc edit`, the wizard pre-selects skills from the existing config. However, it does not apply the same compatibility/validation logic that `init` uses. For example, skills like `web-state-*` (client state) and `web-i18n-*` (internationalization) that have `compatibleWith` constraints get pre-selected even when the selected framework doesn't match — during `init` these would be filtered out, but during `edit` they appear as already selected.

The `edit` command's pre-selection path needs to run the same validation that the `init` build step uses (framework compatibility filtering via `isCompatibleWithSelectedFrameworks` in `build-step-logic.ts`). Currently the pre-selection just restores raw skill IDs from config without checking whether they're still compatible with the current framework selection.

**Location:** `src/cli/commands/edit.tsx` pre-selection logic, `src/cli/lib/wizard/build-step-logic.ts` filtering logic.

---

#### B-02: Validate compatibleWith/conflictsWith refs in metadata

During matrix merge, `compatibleWith` and `conflictsWith` arrays in skill `metadata.yaml` can contain unresolvable references (e.g. display names with `(@author)` suffixes like `"react (@vince)"` or non-canonical IDs like `"setup-tooling"`). When `resolveToCanonicalId` can't resolve these, they pass through as-is and silently break framework compatibility filtering — skills disappear from the build step without any warning.

**Fix:** Add a post-merge validation pass that checks every `compatibleWith` and `conflictsWith` entry on each resolved skill. If a reference doesn't match any known skill ID in `matrix.skills`, emit a `warn()` with the skill ID, the field name, and the unresolved reference. This catches the problem at load time instead of silently filtering skills out.

**Location:** `src/cli/lib/matrix/matrix-loader.ts` — after `mergeMatrixWithSkills()` builds `resolvedSkills`, or in `checkMatrixHealth()` in `matrix-health-check.ts`.

---

#### B-01: Edit wizard shows steps that were omitted during init

When running `agentsinc edit`, the wizard presents build-phase steps (domain categories) that the user explicitly skipped during `agentsinc init`. For example, if you ran `init` and only selected web skills — deliberately skipping API, CLI, mobile — then running `edit` should only show the web step. Instead, it shows all domain steps again, forcing you to step through categories you already opted out of.

The edit wizard should respect the domains the user chose during init and only present those. This is related to T4 (domain filtering tests exist and pass), which suggests the filtering logic may work at the unit level but not in the real CLI flow.

---

### Documentation & Tooling

#### U13: Run Documentor Agent on CLI Codebase

Use the `documentor` sub-agent to create AI-focused documentation that helps other agents understand where and how to implement features. The documentor should work incrementally and track progress over time.

**What to document:**

- Component structure and patterns
- State management patterns (Zustand)
- Testing patterns and conventions
- CLI command structure
- Wizard flow and navigation
- Key utilities and helpers

**Output:** Documentation in `docs/` directory

---

#### H18: Generate CLI Documentation via Documentor Agent

Phases 1 (documentation-bible.md) and 2 (documentor workflow.md) are complete. Only Phase 3 remains.

##### Phase 3: Run documentor agent to generate docs

Create `.claude/docs/` directory with:

- `DOCUMENTATION_MAP.md` — master index tracking coverage
- `command-patterns.md` — oclif command conventions
- `wizard-architecture.md` — wizard flow, state management
- `compilation-system.md` — agent/skill compilation pipeline
- `test-patterns.md` — test infrastructure and fixtures
- `type-system.md` — type conventions and branded types

**Success criteria:** `.claude/docs/` exists with 5+ files that help agents answer "where is X?" and "how does Y work?"

---

### UX / Polish

#### D-28: Fix Startup Warning/Error Messages

**See research doc:** [docs/research/startup-message-persistence.md](../docs/research/startup-message-persistence.md)

The CLI shows warning/error messages and the ASCII logo on startup that flash briefly then disappear. Ink's `clearTerminal` wipes all pre-Ink terminal output because `WizardLayout` uses `height={terminalHeight}`, triggering a full-screen clear on every render cycle.

**Root cause:** Pre-Ink `this.log()` / `warn()` calls print to the terminal, then Ink's first render erases everything via `ansiEscapes.clearTerminal`.

**Planned fix:** Buffer pre-Ink messages and render them via Ink's `<Static>` component (which survives `clearTerminal`).

**Changes needed:**

- `src/cli/commands/init.tsx`, `src/cli/commands/edit.tsx` — buffer messages instead of `this.log()` / `this.warn()`, pass buffer to `<Wizard>`
- `src/cli/components/wizard/wizard-layout.tsx` — add `<Static>` block for startup messages
- `src/cli/utils/logger.ts` + loading modules — support buffered output mode
- Audit which warnings are actionable vs noise; downgrade informational messages to `verbose()`

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

## Testing Tasks

See [TODO-testing.md](./TODO-testing.md) for the full testing guide: coverage table (what is and isn't tested), automated test tasks T1-T6, step-by-step manual procedures for every command, and the 28-point quick-pass checklist.

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
