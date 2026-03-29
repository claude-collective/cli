---
type: standard-gap
severity: medium
affected_files:
  - src/cli/commands/doctor.ts
  - src/cli/lib/__tests__/commands/doctor.test.ts
standards_docs: []
date: 2026-03-29
reporting_agent: cli-tester
category: architecture
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

The `doctor` command was missing a check for eject-mode skills that are listed in `config.skills` but don't have their `SKILL.md` files on disk. The existing `checkSkillsResolved` only validated skill IDs in `config.stack` against the matrix and local skill discovery, but never verified that skills declared in `config.skills` with `source: "eject"` actually have files at `.claude/skills/<skill-id>/SKILL.md`.

Additionally, the `checkSkillsResolved` check (which detects broken agent-to-skill references via the stack config) had zero test coverage.

## Fix Applied

1. Added `checkSkillsInstalled` function to `doctor.ts` that checks each eject-mode skill in `config.skills` has its `SKILL.md` file present at the scope-appropriate path (project or global).
2. Wired the new check into `runAllChecks` as the "Skills Installed" check.
3. Added a tip in `formatTips` for the "missing from disk" warning.
4. Added 5 new tests covering both gaps:
   - 3 tests for the new `checkSkillsInstalled` check (missing skill, present skill, plugin-mode skip)
   - 2 tests for the existing `checkSkillsResolved` check (broken stack reference, resolved local skill)

## Proposed Standard

Doctor command checks should have a 1:1 correspondence between check functions and test coverage. When adding a new diagnostic check to `doctor.ts`, a corresponding test suite must be added to `doctor.test.ts`. This could be documented in `.ai-docs/reference/features/` as a doctor command reference doc.
