---
type: convention-drift
severity: medium
affected_files:
  - .ai-docs/reference/features/wizard-flow.md
  - .ai-docs/reference/component-patterns.md
standards_docs:
  - .ai-docs/standards/documentation-bible.md
date: 2026-04-02
reporting_agent: codex-keeper
category: architecture
domain: cli
root_cause: enforcement-gap
---

## What Was Wrong

Two reference documentation files referenced deleted source files (`view-title.tsx` and `stats-panel.tsx`) as if they still existed. The wizard-flow.md documented `view-title.tsx` as "imported by multiple steps but some usages are commented out" and `stats-panel.tsx` as "currently unused in render tree." Both files were deleted from the codebase but the documentation was never updated.

Additionally:

- `FEATURE_FLAGS.INFO_PANEL` was documented as defaulting to `false` when it had been changed to `true`
- `InfoPanel` was described with internal helpers (`groupSkillsByBucket`, `groupAgentsByScope`) that no longer exist after the component was redesigned to use `SkillAgentSummary`
- New component `skill-agent-summary.tsx` (extracted from confirm step redesign) was completely undocumented
- New component `toast.tsx` was completely undocumented
- New UI constants (`EJECT`, `BULLET`, `LABEL_BG`) were not in the symbol/color tables
- `CategoryOption` type was missing the `locked` field
- Multiple line number references were stale (BUILT_IN_DOMAIN_ORDER, DEFAULT_SCRATCH_DOMAINS, CLI_COLORS, SCROLL_VIEWPORT)

## Fix Applied

All issues fixed in this validation session:

- Removed references to deleted `view-title.tsx` and `stats-panel.tsx`
- Updated `INFO_PANEL` default to `true`
- Rewrote InfoPanel documentation to reflect new marketplace/stack header + SkillAgentSummary delegation
- Added `SkillAgentSummary` documentation with exports, props, and consumers
- Added `toast.tsx` to component listings
- Added `LOCK`, `EJECT`, `BULLET` to UI_SYMBOLS table
- Added `LABEL_BG` to CLI_COLORS table
- Added `locked` field to CategoryOption type
- Fixed all stale line number references

## Proposed Standard

When components are deleted or significantly redesigned, the commit checklist should include a step to grep `.ai-docs/reference/` for references to the affected files. This could be added to `.ai-docs/standards/documentation-bible.md` as a maintenance rule: "After deleting or renaming a source file, run `grep -r 'filename' .ai-docs/reference/` and update any stale references."
