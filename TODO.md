# Claude Collective CLI - Task Tracking

> **Agent Compliance Tests**: Moved to [docs/bibles/AGENT-COMPLIANCE-BIBLE.md](./docs/bibles/AGENT-COMPLIANCE-BIBLE.md)
> Run these 30 tests periodically to verify agent alignment.

## Current Focus

Phase 7B complete. Ready for user testing.

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).
For wizard architecture details, see [docs/wizard-index.md](./docs/wizard-index.md).

---

## Blockers

_None currently. Add serious blockers here immediately when discovered._

---

## Reminders for Agents

### R1: Use Specialized Agents

- **CLI Developer** (`cli-developer`) - All feature implementation work
- **CLI Tester** (`web-tester`) - All test writing
- **API Researcher** (`api-researcher`) - Backend/resolver research
- **Web Researcher** (`web-researcher`) - Frontend/component research

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

See [docs/CLI-IMPROVEMENTS-RESEARCH.md](./docs/CLI-IMPROVEMENTS-RESEARCH.md) for full research findings.

#### U1: Progress Navigation Bar - Tab Styling [DONE]

- [x] Replace circle indicators with tab-style navigation in `wizard-tabs.tsx`
- [x] Active step: green background with 1-char padding (`{" "}[N] Label{" "}`)
- [x] Completed steps: white background, dark text
- [x] Pending steps: default text, no background
- [x] Add horizontal divider lines above and below tabs
- [x] Remove symbol row entirely (no more checkmark/dot/circle)

**Files:** `src/cli/components/wizard/wizard-tabs.tsx`, tests

#### U2: Header - Add Version Display [DONE]

- [x] Add `version` prop to Wizard component
- [x] Pass `this.config.version` from Init command to Wizard
- [x] Display version in header area (near WizardTabs or in new header component)

**Files:** `src/cli/commands/init.tsx`, `src/cli/components/wizard/wizard.tsx`

#### U3: Footer - Split Layout with WizardFooter Component [DONE]

- [x] Create new `wizard-footer.tsx` component with left/right props
- [x] Use `justifyContent="space-between"` pattern
- [x] Left side: navigation controls (up/down, left/right, SPACE, etc.)
- [x] Right side: action hints (ESC back, ENTER continue)
- [x] Update all step components to use WizardFooter
- [x] Remove global footer from wizard.tsx

**Files:** `src/cli/components/wizard/wizard-footer.tsx` (NEW), `wizard.tsx`, `step-approach.tsx`, `step-build.tsx`, `step-refine.tsx`, `step-confirm.tsx`

---

### Needs Discussion

#### U4: Build Step - Framework-First Flow [DONE]

See [docs/CLI-IMPROVEMENTS-RESEARCH.md#4](./docs/CLI-IMPROVEMENTS-RESEARCH.md) for requirements.

- [x] Update `step-build.tsx` to implement framework-first filtering logic
- [x] Update `category-grid.tsx` to remove circles/strikethrough, add background colors
- [x] Add `compatibleWith` field to `ResolvedSkill` type in `types-matrix.ts`
- [x] Update `matrix-loader.ts` to preserve `compatibleWith` during skill resolution
- [x] Update tests in `category-grid.test.tsx` and `step-build.test.tsx`

**Files modified:**
- `src/cli/components/wizard/step-build.tsx` - Framework-first filtering logic
- `src/cli/components/wizard/category-grid.tsx` - Visual styling (backgrounds instead of circles)
- `src/cli/types-matrix.ts` - Added `compatibleWith` field to `ResolvedSkill`
- `src/cli/lib/matrix-loader.ts` - Preserve `compatibleWith` during resolution
- `src/cli/components/wizard/category-grid.test.tsx` - Updated tests for new styling
- `src/cli/components/wizard/step-build.test.tsx` - Updated tests for framework-first flow

**Implementation notes:**
- Web domain only: Framework-first flow hides other categories until framework selected
- Skills with empty `compatibleWith` array are shown (backwards compatible)
- Visual styling: selected = cyan background (black text), focused = gray background (white text), disabled = dimmed text
- Table layout with fixed column widths (16 chars) for vertical alignment
- Removed "(optional)" labels - optional is assumed by default
- Kept star and warning symbols for recommended/discouraged states
- Active step in tabs uses cyan background (matches theme focus color)

---

#### U5: Import Third-Party Skills Command [DONE]

- [x] Create `cc import skill` command
- [x] Support GitHub repo sources: `cc import skill github:owner/repo --skill skill-name`
- [x] Download skill to `.claude/skills/` directory
- [x] Add validation for SKILL.md and metadata.yaml
- [x] Track origin with `forked_from` metadata

**Test case:** Import from `https://github.com/vercel-labs/agent-skills` skills directory - VERIFIED

**Files:** `src/cli/commands/import/skill.ts` (NEW)

**Features implemented:**
- Multiple source formats: `github:owner/repo`, `https://github.com/...`, `owner/repo`
- `--list` to discover available skills
- `--skill <name>` to import specific skill
- `--all` to import all skills
- `--force` to overwrite existing
- `--refresh` to bypass cache
- `--subdir` to specify custom skills directory
- `--dry-run` for preview
- Validates SKILL.md exists (required)
- Handles metadata.yaml or metadata.json
- Injects `forked_from` tracking metadata

---

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

**UX Features:**
- No args = interactive mode
- With args = static table mode (scripting-friendly)
- `-i` flag forces interactive with pre-filled query
- Live filtering in interactive mode
- Source attribution in results
- Multi-select for batch import

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
