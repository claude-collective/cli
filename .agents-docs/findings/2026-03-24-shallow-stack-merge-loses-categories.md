---
type: anti-pattern
severity: high
affected_files:
  - src/cli/lib/configuration/config-writer.ts
  - src/cli/lib/installation/local-installer.ts
standards_docs: []
date: 2026-03-24
reporting_agent: cli-developer
category: architecture
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

Two related bugs in the inlined project config generation:

1. **Shallow stack merge loses categories**: `generateProjectConfigWithInlinedGlobal` in `config-writer.ts` merged stacks with `{ ...globalStackObj, ...projectStackObj }`. When both global and project stacks had the same agent (e.g., `web-developer`), the project entry completely overwrote the global one, losing global-only categories like `web-framework` and `web-meta-framework`.

2. **Config-types imports from global despite self-contained config**: `writeScopedConfigs` in `local-installer.ts` called `writeProjectConfigTypes` (which generates types importing `GlobalSkillId`, `GlobalAgentName` from global config-types) even when the config.ts was self-contained (inlined global). The types file should also be self-contained to match.

## Fix Applied

1. Replaced shallow spread with `deepMergeStacks()` helper that merges at the category level. For agents that appear in both stacks, it merges their category entries. For the same category in both (e.g., `web-styling`), it normalizes compacted values (bare strings, objects, arrays) and concatenates them.

2. Changed `writeProjectConfigTypes(...)` to `writeStandaloneConfigTypes(...)` with `finalConfig` (the complete config before splitting) so the project config-types.ts has all skill IDs, agent names, categories, and domains locally without imports.

## Proposed Standard

When merging nested config objects, always consider the depth of merge needed. Shallow spread (`{ ...a, ...b }`) is only safe when values are primitives. For nested record-of-record structures like stacks (agent -> category -> skills), deep merge is required. A code comment or test should verify that overlapping keys at each nesting level are handled correctly.
