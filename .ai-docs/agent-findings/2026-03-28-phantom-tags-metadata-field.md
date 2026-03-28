---
type: convention-drift
severity: medium
affected_files:
  - .ai-docs/reference/features/skills-and-matrix.md
standards_docs:
  - .ai-docs/standards/documentation-bible.md
date: 2026-03-28
reporting_agent: codex-keeper
category: architecture
domain: cli
root_cause: enforcement-gap
---

## What Was Wrong

The skills-and-matrix.md documentation contained a phantom `tags` field in the metadata.yaml example that never existed in the `rawMetadataSchema` (at `src/cli/lib/matrix/matrix-loader.ts:26-36`). The schema validates: category, author, slug, domain, displayName, cliDescription, usageGuidance, custom. There is no `tags` field.

This phantom field survived at least 3 prior validation passes (2026-02-25, 2026-03-14 targeted, 2026-03-14 second-pass) because validations focused on function line numbers and type definitions, not on example code snippets.

## Fix Applied

Removed `tags: ["react", "hooks", "components"]` from the metadata.yaml example. Added explicit schema field list with required/optional annotations. Added note: "tags and version are NOT part of the schema."

## Proposed Standard

Documentation validation passes should explicitly verify example code snippets (YAML, TypeScript, etc.) against the actual schemas or source code they claim to represent. Add to `.ai-docs/standards/documentation-bible.md` under validation requirements:

> When validating documentation that contains example code snippets (YAML, TypeScript, JSON), verify every field/property in the example against the actual schema or type definition. Phantom fields in examples are a common hallucination that survives line-number-focused audits.
