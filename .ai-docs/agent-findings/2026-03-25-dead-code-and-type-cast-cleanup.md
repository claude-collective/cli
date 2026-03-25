---
type: convention-drift
severity: medium
affected_files:
  - src/cli/lib/configuration/config-writer.ts
  - src/cli/lib/configuration/config-types-writer.ts
  - src/cli/lib/configuration/config-generator.ts
  - src/cli/lib/installation/local-installer.ts
  - src/cli/lib/configuration/__tests__/config-writer.test.ts
  - src/cli/lib/installation/local-installer.test.ts
  - src/cli/lib/configuration/index.ts
standards_docs:
  - CLAUDE.md
date: 2026-03-25
reporting_agent: cli-developer
category: typescript
domain: cli
root_cause: enforcement-gap
---

## What Was Wrong

Five issues found during code review:

1. **Blank global config emitted `SkillAssignment` instead of `SkillAssignment[]`** in `generateBlankGlobalConfigTypesSource()`, making the generated type inconsistent with the real `StackAgentConfig` type (which uses arrays).

2. **Dead `writeProjectConfigTypes` function** in `local-installer.ts` was superseded by `writeStandaloneConfigTypes` but never removed, leaving orphaned imports (`getCategoryDomain`, `generateProjectConfigTypesSource`).

3. **Dead `compactStackForYaml` and `compactAssignment`** in `config-generator.ts` were only used when YAML config format existed. After migration to TypeScript config, they were unreachable but still exported and mocked in tests.

4. **`as any` casts on valid AgentName literals** in config-writer tests. `"web-developer"` and `"web-reviewer"` are valid `AgentName` union members, so casts were unnecessary and violated the CLAUDE.md rule against `as` casts on valid union members.

5. **Duplicate entries in merged `selectedAgents` and `domains`** when global and project arrays contained the same values in `generateProjectConfigWithInlinedGlobal()`.

## Fix Applied

1. Changed `SkillAssignment` to `SkillAssignment[]` in blank config template and updated JSDoc.
2. Removed `writeProjectConfigTypes` function and orphaned imports.
3. Removed `compactStackForYaml`, `compactAssignment`, their re-export from index.ts, and mock reference in test.
4. Removed all `as any` casts from agent name literals in test file.
5. Wrapped merged arrays with `[...new Set([...])]` for deduplication.

## Proposed Standard

The existing CLAUDE.md rules already cover these patterns (no `as` casts on valid union members, no dead code). The enforcement gap is that dead code from format migrations (YAML to TypeScript) wasn't cleaned up at migration time. Consider adding a post-migration checklist item: "grep for all references to removed functionality and clean up dead code, mocks, and re-exports."
