---
type: convention-drift
severity: high
affected_files:
  - .ai-docs/standards/skill-atomicity-bible.md
  - .ai-docs/standards/prompt-bible.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
  - .ai-docs/standards/prompt-bible.md
date: 2026-04-02
reporting_agent: codex-keeper
category: architecture
domain: shared
root_cause: convention-undocumented
---

## What Was Wrong

The skill-atomicity-bible.md had 6 factual errors about metadata.yaml schema fields and CLI commands:

1. Claimed metadata.yaml has `tags` and `version` fields -- neither exists (per MEMORY.md rule and actual `metadataValidationSchema` in `src/cli/lib/schemas.ts`).
2. Listed required fields with snake_case names (`cli_name`, `cli_description`, `usage_guidance`) -- actual schema uses camelCase (`displayName`, `cliDescription`, `usageGuidance`).
3. Missing `slug` from required fields list -- it is required in the actual schema.
4. Referenced `claude-architecture-bible.md` for category enum -- that file does not exist.
5. Referenced `bun cc:validate` command -- no such script exists; the actual CLI command is `agentsinc validate`.

Additionally, prompt-bible.md had a dead cross-reference to `claude-architecture-bible.md`.

## Fix Applied

All issues fixed directly in the affected files. See DOCUMENTATION_MAP.md Round 8 validation history for details.

## Proposed Standard

When metadata.yaml schema fields change, the skill-atomicity-bible.md Quality Gate Checklist should be updated in the same commit. Consider adding a comment in `src/cli/lib/schemas.ts` near `metadataValidationSchema` referencing the standards doc that depends on it, so future schema changes trigger a doc update.
