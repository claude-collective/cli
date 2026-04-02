---
type: convention-drift
severity: medium
affected_files:
  - .ai-docs/reference/features/plugin-system.md
standards_docs:
  - .ai-docs/standards/documentation-bible.md
date: 2026-04-02
reporting_agent: codex-keeper
category: architecture
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

`plugin-system.md` documented `MigrationPlan` type fields as `toLocal` and `MigrationResult` fields as `localizedSkills`, but the actual code in `src/cli/lib/installation/mode-migrator.ts` uses `toEject` and `ejectedSkills` respectively. This was a leftover from the "local" -> "eject" terminology migration that was missed in all previous audit rounds (rounds 1-3), likely because:

1. Round 1 (remaining-docs agent) had 8 files and only lightly audited these type definitions
2. Round 2 fixed a different `deriveInstallMode` issue but did not check the MigrationPlan/MigrationResult type field names
3. Round 3 (cross-document audit) focused on cross-document inconsistencies but did not verify individual type field names against source

The error survived because the old field names (`toLocal`, `localizedSkills`) were plausible enough to pass surface-level review. Only a line-by-line comparison of documented type fields against actual TypeScript type definitions caught it.

## Fix Applied

Changed in `plugin-system.md`:

- `MigrationPlan` field `toLocal` -> `toEject`
- `MigrationResult` field `localizedSkills` -> `ejectedSkills`

## Proposed Standard

When auditing documentation for type definitions, always read the EXACT field names from the source TypeScript type/interface. Do not assume field names are correct just because the type name is correct. This is especially important after terminology renames -- field names inside types are the easiest to miss.
