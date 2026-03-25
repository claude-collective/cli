---
type: anti-pattern
severity: high
affected_files:
  - src/cli/lib/configuration/config-writer.ts
standards_docs: []
date: 2026-03-24
reporting_agent: cli-developer
category: architecture
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

The `generateProjectConfigWithInlinedGlobal` function in `config-writer.ts` merged global+project data for skills, agents, domains, and selectedAgents, but NOT for the stack. Line 279 only read the project stack (`cleaned.stack`), entirely ignoring the global stack (`cleanedGlobal.stack`). This meant global agents' stack assignments (their category-to-skill mappings) were silently lost in the generated config.

The other merge function (`generateProjectConfigWithGlobalImport`) was not affected because it generates runtime spread syntax (`...globalConfig`) rather than static inlining.

## Fix Applied

- Read both `cleaned.stack` (project) and `cleanedGlobal.stack` (global) as separate variables
- Merge them with spread: `{ ...globalStackObj, ...projectStackObj }` so project entries override on conflict
- Use the merged stack everywhere the old `stackObj` was referenced

Added 3 tests:

1. Merges global and project stack entries (different agents)
2. Project stack entries override global stack entries for the same agent
3. Global-only stack appears even when project has no stack

## Proposed Standard

When adding a new merged field to `generateProjectConfigWithInlinedGlobal`, the pattern should be: read from both `cleaned` (project) and `cleanedGlobal`, merge with global-first precedence, and test all three scenarios (both present, conflict override, global-only). A code comment or checklist in the function JSDoc listing all merged fields (skills, agents, stack, domains, selectedAgents) would help prevent omissions.
