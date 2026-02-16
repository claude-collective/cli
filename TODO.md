# Agents Inc. CLI - Task Tracking

> **Agent Compliance Tests**: See [docs/standards/content/agent-compliance-bible.md](./docs/standards/content/agent-compliance-bible.md)
> Run these 30 tests periodically to verify agent alignment.
> For architecture details, see [docs/reference/architecture.md](./docs/reference/architecture.md).

## Current Focus

Phase 7B complete. Ready for user testing.

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).
For autonomous loop tasks, see [todo-loop.md](./todo-loop.md).

---

## Blockers

_None currently. Add serious blockers here immediately when discovered._

---

## Reminders for Agents

### R1: Use Specialized Agents

- **CLI Developer** (`cli-developer`) - All refators and features
- **CLI Tester** (`cli-tester`) - All test writing
- **Web Developer** (`web-developer`) - All react code

Do NOT implement features or write tests directly. Always delegate to the appropriate agent.

### R2: Handle Uncertainties

When encountering unknowns or uncertainties:

1. Spawn research subagents to investigate
2. Use CLI Developer to prototype if needed
3. **Create TODO tasks in this file** with findings
4. Document decisions in appropriate docs/ file

### R3: Blockers Go to Top

If a serious blocker is discovered, add it to the **Blockers** section at the top of this file immediately. Do not continue work that depends on the blocked item.

### R4: Do NOT Commit

**Keep all changes uncommitted.** The user will handle committing when ready.

### R5: Move Completed Tasks to Archive

Once a task is done, move it to [TODO-completed.md](./TODO-completed.md).

### R6: Update Task Status

When starting a task: `[IN PROGRESS]`. When completing: `[DONE]`.

**IMPORTANT:** Sub-agents MUST update this TODO.md file when starting and completing subtasks.

### R7: Compact at 70% Context

When context usage reaches 70%, run `/compact`.

### R8: Cross-Repository Changes Allowed

You may make changes in the claude-subagents directory (`/home/vince/dev/claude-subagents`) as well, if needed. This is the source marketplace for skills and agents.

---

## Active Tasks

### CLI UX Improvements (Phase 8)

See [docs/reference/architecture.md](./docs/reference/architecture.md) for system architecture.
Completed tasks archived in [TODO-completed.md](./TODO-completed.md).

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

#### U15: Add Comprehensive Help Overlay

Add a comprehensive help section/overlay accessible via `?` key to show users how to get the most out of the CLI:

**Content to include:**

- Keyboard shortcuts (expand on existing help modal)
- Navigation patterns
- Tips for wizard flow
- Common workflows (init, edit, compile, update)
- Source management tips
- Expert mode features

**Implementation:**

- Expand existing `help-modal.tsx` with more comprehensive content
- Add context-sensitive help (different content per step)
- Include examples and tips
- Make it easy to discover (`?` key always visible)

**Files:** `src/cli/components/wizard/help-modal.tsx`

---

#### D-05: Improve `cc init` Behavior When Already Initialized

When `cc init` is run in a project that's already initialized, instead of just warning and suggesting `cc edit`, show the edit screen directly (same as running `cc edit`).

**Simplified scope:** Just redirect to the edit flow when already initialized.

**Files:** `src/cli/commands/init.tsx`

---

#### D-16: Init Should Populate Config Options with Defaults

When `cc init` creates `.claude-src/config.yaml`, include commented-out default values for discoverable config options (source, marketplace, agents_source). Path overrides are already included -- this extends to the remaining config options.

**Files:** `src/cli/lib/installation/local-installer.ts` (writeConfigFile function)

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
