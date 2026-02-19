# Agents Inc. CLI - Task Tracking

| ID   | Task                                                  | Status       |
| ---- | ----------------------------------------------------- | ------------ |
| B-01 | Edit wizard shows steps that were omitted during init | Bug          |
| U13  | Run Documentor Agent on CLI Codebase                  | Pending      |
| H18  | Tailor documentation-bible to CLI repo                | Phase 3 only |
| D-28 | Fix startup warning/error messages                    | Pending      |

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

## Testing Tasks

See [TODO-testing.md](./TODO-testing.md) for the full testing guide: coverage table (what is and isn't tested), automated test tasks T1-T6, step-by-step manual procedures for every command, and the 28-point quick-pass checklist.

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
