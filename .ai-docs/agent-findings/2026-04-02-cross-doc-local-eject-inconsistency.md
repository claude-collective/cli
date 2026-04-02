---
type: convention-drift
severity: medium
affected_files:
  - .ai-docs/reference/utilities.md
  - .ai-docs/reference/store-map.md
  - .ai-docs/reference/state-transitions.md
  - .ai-docs/reference/architecture-overview.md
  - .ai-docs/reference/commands.md
  - .ai-docs/reference/features/configuration.md
  - .ai-docs/reference/features/plugin-system.md
  - .ai-docs/reference/boundary-map.md
  - .ai-docs/reference/dependency-graph.md
  - .ai-docs/reference/features/wizard-flow.md
  - .ai-docs/reference/component-patterns.md
standards_docs:
  - .ai-docs/standards/documentation-bible.md
date: 2026-04-02
reporting_agent: codex-keeper
category: architecture
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

The codebase renamed `InstallMode` from `"local" | "plugin" | "mixed"` to `"eject" | "plugin" | "mixed"` and renamed `setAllSourcesLocal()` to `setAllSourcesEject()`, but documentation across multiple reference files still used the old "local" terminology in install mode contexts. This was invisible to single-doc audits because each doc was internally consistent -- the inconsistency only appeared when cross-referencing docs against each other and against the codebase.

Initial discovery was in utilities.md (`SOURCE_DISPLAY_NAMES` still showed `local` instead of `eject`) and store-map.md (`setAllSourcesLocal` still referenced instead of `setAllSourcesEject`). Cross-doc audit then revealed the same drift in 5 additional files.

Additionally, 3 stale line numbers in boundary-map.md referenced incorrect consts.ts lines (from before a +8 line shift), and 3 docs still referenced `utils/yaml.ts` as if it existed (it was previously removed as dead code).

**Root cause:** The rename was applied to some docs (store-map.md, plugin-system.md Eject Mode section) but missed in others during the original documentation update. No cross-document consistency check was performed after the rename.

## Fix Applied

21 fixes across 7 files:

- 12 local->eject rename fixes across 5 files (including utilities.md and store-map.md where the issue was first discovered)
- 3 line number corrections in boundary-map.md
- 6 deleted file reference updates across 3 files

**Remaining:** `wizard-flow.md:194` and `component-patterns.md:215` still reference `HOTKEY_SET_ALL_LOCAL` -- the constant name is correct (it exists in `hotkeys.ts:29`). The descriptive text "Set all sources to local" matches the user-facing UI label in `wizard-layout.tsx:200` ("Set all local"), even though the internal action is `setAllSourcesEject()`. This is an intentional UX choice -- the user-facing term is "local" while the internal code uses "eject." No documentation change needed for these references.

## Proposed Standard

Add a "Cross-Document Consistency Checklist" to `standards/documentation-bible.md` that requires:

1. When any terminology rename occurs in the codebase, grep ALL reference docs for the old term
2. When line numbers are fixed in one doc, check all other docs that reference the same function
3. When a file is marked as deleted in one doc, grep all other docs for references to that file
4. Distinguish between legitimate uses of a term (function names, type names) and stale documentation references
