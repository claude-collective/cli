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

#### U6: Interactive Skill Search Command [DONE]

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

**Files modified:**

- `src/cli/lib/config.ts` - Added SourceEntry interface, sources array, resolveAllSources()
- `src/cli/commands/search.tsx` - Dual-mode search (static + interactive)
- `src/cli/components/skill-search/skill-search.tsx` - Interactive UI component
- `src/cli/components/skill-search/index.ts` - Exports

---

#### U9: Fixed Height for Main CLI Content

The main content area of the CLI application needs a fixed height so it doesn't cause the terminal to jump/reflow as content changes (e.g., when navigating wizard steps or toggling skills). Implement virtual windowing with dynamic terminal resize handling to constrain the visible content area.

**Research completed:** ✅

- Ink automatically handles terminal resize via `stdout.on('resize')` events
- Virtual windowing at data layer required (no native scroll in Ink)
- Custom `useTerminalDimensions()` hook pattern for reactive dimension tracking
- Existing pattern in `skill-search.tsx` provides reference implementation

**Implementation plan:** See [docs/implementation-scroll-viewport.md](./docs/implementation-scroll-viewport.md)

**Key components:**

- New hook: `use-terminal-dimensions.ts` for reactive resize handling
- New hook: `use-virtual-scroll.ts` for category-level windowing
- Modified: `category-grid.tsx` with scroll indicators
- Modified: `step-build.tsx` to calculate and pass available height

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

#### U12: Create CLAUDE.md with Documentation References

Create a root-level `CLAUDE.md` file that provides agents with quick references to key documentation:

- Link to TypeScript standards and conventions
- Link to architecture document (`docs/architecture.md`)
- Link to coding standards and patterns
- Link to test infrastructure and conventions
- Overview of project structure
- Quick reference for common patterns

This file will serve as the entry point for AI agents to understand the codebase conventions.

**Files:** `CLAUDE.md` (new), potentially reference existing docs

---

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

#### U14: Simplify Wizard Intro - Allow Direct Stack Selection

**Spec:** See [docs/stack-domain-filtering-spec.md](./docs/stack-domain-filtering-spec.md)

Merge the "approach" step and "stack" step into a single unified first step. Currently users must:

1. Choose "Use a template" or "Start from scratch"
2. Then see stacks OR domain selection

**New flow:**

1. Single step showing all stacks + "Start from scratch" as the last option
2. Domain selection follows (same for both paths)

**Benefits:**

- One fewer step in wizard
- More direct - users see stacks immediately
- Both paths converge on domain selection

**Implementation:**

- Delete `step-approach.tsx`
- Merge approach selection into `step-stack.tsx`
- Update `wizard.tsx` to remove "approach" step
- Add `getDomainsFromStack()` utility
- Reuse existing `<DomainSelection>` component

**Files:**

- `src/cli/components/wizard/step-stack.tsx` (merge approach into stack)
- `src/cli/components/wizard/step-approach.tsx` (delete)
- `src/cli/components/wizard/wizard.tsx` (remove approach step)
- `src/cli/stores/wizard-store.ts` (remove approach state)
- `src/cli/components/wizard/utils.ts` (add getDomainsFromStack)

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

#### U16: Fix Overlay Dismissal - Allow Hiding After Showing

**Issue:** The existing overlays (help modal, settings) can be shown with a hotkey but the user experience for hiding them needs improvement.

**Current behavior to verify:**

- Help modal: `?` key shows, but how to hide?
- Settings overlay: `G` key shows, but how to hide?

**Expected behavior:**

- Same key should toggle (show/hide)
- ESC should always dismiss
- Clear visual feedback about dismissal options

**Research needed:**

- Test current overlay dismissal in `help-modal.tsx` and `step-settings.tsx`
- Check if `showHelp` and `showSettings` state properly toggles
- Verify ESC key handling in overlays

**Files:**

- `src/cli/components/wizard/help-modal.tsx`
- `src/cli/components/wizard/step-settings.tsx`
- `src/cli/stores/wizard-store.ts` (toggle actions)
- `src/cli/components/wizard/wizard.tsx` (hotkey handling)

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
