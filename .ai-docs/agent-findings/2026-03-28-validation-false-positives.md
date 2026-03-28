---
type: standard-gap
severity: medium
affected_files:
  - .ai-docs/DOCUMENTATION_MAP.md
  - .ai-docs/reference/features/configuration.md
standards_docs:
  - .ai-docs/standards/documentation-bible.md
date: 2026-03-28
reporting_agent: codex-keeper
category: architecture
domain: shared
root_cause: rule-not-specific-enough
---

## What Was Wrong

The 2026-03-14 validation audit of configuration.md marked 9 line numbers as "verified correct" that were actually already wrong at audit time. Examples:

- `generateConfigSource at config-writer.ts:29` -- actual was `:35` (the function signature is preceded by a type definition and JSDoc block)
- `writeScopedConfigs at local-installer.ts:422` -- actual was `:369` (function had moved significantly)
- `buildStackProperty` at `:142` -- actual was `:146`
- `splitConfigByScope` at `:199` -- actual was `:169`
- `compactStackForYaml` was documented as existing -- function does not exist anywhere in the codebase

This means the prior audit either:

1. Checked documentation claims against stale cached reads rather than fresh file reads
2. Spot-checked some values and assumed the rest matched
3. Used grep for function names without verifying the exact line number

## Fix Applied

All 9 errors and 1 phantom function fixed in this 2026-03-28 audit. Documentation map validation history now notes the prior audit's false positives.

## Proposed Standard

The validation process in `documentation-bible.md` should include an explicit rule:

> **Validation Rule: Line numbers must be verified by reading the actual file at the claimed offset, not by grepping for the function name.** A grep match confirms the function exists but does NOT confirm its line number. The validator must either:
>
> 1. Read the file and confirm the function declaration starts at the documented line, OR
> 2. Use `grep -n` with the exact function signature and confirm the line number matches

This would prevent future "verified correct" false positives where the function exists but has moved.
