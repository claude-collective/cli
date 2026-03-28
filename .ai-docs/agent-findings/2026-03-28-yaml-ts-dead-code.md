---
type: convention-drift
severity: low
affected_files:
  - src/cli/utils/yaml.ts
  - src/cli/utils/yaml.test.ts
standards_docs:
  - .ai-docs/reference/dependency-graph.md
date: 2026-03-28
reporting_agent: codex-keeper
category: architecture
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

`src/cli/utils/yaml.ts` exports `safeLoadYamlFile()` but no production module imports it. The function has a test file (`yaml.test.ts`) but zero consumers in `src/cli/`. It appears to be dead code -- either leftover from a migration to TypeScript config files (`config.yaml` -> `config.ts`) or a utility that was written but never adopted.

## Fix Applied

None -- discovery only. Documented in `dependency-graph.md` under "Shared Utility Consumers > utils/yaml.ts".

## Proposed Standard

Consider removing `yaml.ts` and `yaml.test.ts` during the next cleanup pass, or grep to confirm no consumer was missed. If the utility is intentionally kept for future use, add a comment explaining why.
