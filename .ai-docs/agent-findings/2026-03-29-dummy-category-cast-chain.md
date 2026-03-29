---
type: convention-drift
severity: low
affected_files:
  - src/cli/lib/metadata-keys.ts
  - src/cli/commands/new/marketplace.ts
standards_docs:
  - CLAUDE.md
date: 2026-03-29
reporting_agent: cli-tester
category: typescript
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

`LOCAL_DEFAULTS.CATEGORY` is defined as `"dummy-category" as CategoryPath` in `metadata-keys.ts`, but `"dummy-category"` is not a member of `CategoryPath` (`Category | "local"`). This makes the cast technically invalid -- the value does not belong to the target type. Downstream in `marketplace.ts`, it is cast again with `LOCAL_DEFAULTS.CATEGORY as Category`, compounding the invalid narrowing.

The CLAUDE.md rule states: "Only cast at parse boundaries (YAML, JSON, CLI args)." These casts are at a code-generation boundary (scaffolding a new marketplace's `config.ts`), which is analogous but not explicitly covered by the rule.

## Fix Applied

None -- discovery only. The casts are acceptable in context (code-generation boundary), and inline comments already explain the rationale. Full analysis written to `todo/D-138-audit-marketplace-casts.md`.

## Proposed Standard

Add a clarification to CLAUDE.md or `clean-code-standards.md` that explicitly acknowledges **code-generation boundaries** as a valid cast site alongside parse boundaries. Suggested addition to the existing rule:

> "Only cast at parse boundaries (YAML, JSON, CLI args) **or code-generation boundaries** (scaffolding TypeScript source files where placeholder values will be written to disk, not consumed at runtime). Code-generation casts must have inline comments explaining why the value is not in the union."

This would prevent future audits from flagging these casts while keeping the rule strict for runtime code paths.
