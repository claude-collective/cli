# Claude Collective CLI - Task Tracking

> **Agent Compliance Tests**: See [docs/bibles/AGENT-COMPLIANCE-BIBLE.md](./docs/bibles/AGENT-COMPLIANCE-BIBLE.md)
> Run these 30 tests periodically to verify agent alignment.
> For architecture details, see [docs/architecture.md](./docs/architecture.md).

## Current Focus

Phase 7B complete. Ready for user testing.

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).

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

See [docs/architecture.md](./docs/architecture.md) for system architecture.
Completed tasks archived in [TODO-completed.md](./TODO-completed.md).

#### U6: Interactive Skill Search Command [IN PROGRESS]

- [x] Add `SourceEntry` interface to config types
- [x] Add `sources` array to GlobalConfig and ProjectConfig
- [x] Add validation for sources array in config loading
- [x] Create `resolveAllSources()` function
- [x] Create interactive search component (`src/cli/components/skill-search/`)
- [x] Update search command to support dual-mode (static/interactive)
- [x] Support `--interactive` / `-i` flag
- [x] Support `--refresh` flag for cache refresh
- [x] Live filtering as user types
- [x] Multi-select with checkboxes
- [x] Keyboard navigation (j/k, space, enter, esc)
- [x] Import selected skills to `.claude/skills/`
- [ ] Test manually with real sources
- [ ] Add tests for interactive component

**Files modified:**

- `src/cli/lib/config.ts` - Added SourceEntry interface, sources array, resolveAllSources()
- `src/cli/commands/search.tsx` - Dual-mode search (static + interactive)
- `src/cli/components/skill-search/skill-search.tsx` - Interactive UI component
- `src/cli/components/skill-search/index.ts` - Exports

---

#### U9: Fixed Height for Main CLI Content

The main content area of the CLI application needs a fixed height so it doesn't cause the terminal to jump/reflow as content changes (e.g., when navigating wizard steps or toggling skills). Investigate how to constrain the Ink render area to a fixed height, potentially using `Box` with `height` prop or a viewport wrapper component.

**Research needed:**

- How Ink handles terminal height constraints
- Whether `Box height={N}` clips or scrolls overflow
- Best pattern for consistent layout across steps with varying content lengths

---

#### U10: Proper Effects for Active Skills

Currently active/selected skills may not have proper visual effects or feedback. Need to implement clear visual indicators for skills that are actively selected/enabled, such as:

- Highlight or background color for active skill entries
- Transition or animation when toggling skill state
- Clear differentiation between active, inactive, and disabled states

**Research needed:**

- Current skill rendering in `category-grid.tsx` and `step-build.tsx`
- What visual feedback patterns work in terminal UIs (Ink limitations)
- Consistent styling with existing theme (cyan/green/dim conventions)

---

#### U11: Update stacks.yaml agent configs with full skill distributions

The `config/stacks.yaml` stack definitions have many agents with empty configs (`web-pm: {}`, `agent-summoner: {}`, `cli-tester: {}`, etc.). While `generateProjectConfigFromSkills` + `getAgentsForSkill` now distributes skills broadly at init time, the stacks.yaml itself should reflect the intended skill assignments so it serves as readable documentation of what each stack provides.

For example, the `nextjs-fullstack` stack's `cli-developer` should know about React, Hono, etc. — not just `cli-framework`. Similarly, `web-pm` should have the full set of web + api skills since it needs context about the entire stack to write specs.

**What to do:**

- Review `SKILL_TO_AGENTS` mappings in `skill-agent-mappings.ts` for each domain
- Populate empty agent configs in all stacks with the skills they should know about
- Ensure consistency between stacks.yaml and the runtime `getAgentsForSkill` mappings

**Files:** `config/stacks.yaml`

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
