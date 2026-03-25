---
type: anti-pattern
severity: high
affected_files:
  - src/cli/lib/configuration/config-generator.ts
standards_docs:
  - docs/standards/clean-code-standards.md
date: 2026-03-24
reporting_agent: cli-developer
category: typescript
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

`Object.fromEntries()` silently overwrites entries with duplicate keys. In `generateProjectConfigFromSkills`, skills were mapped to `[category, [assignment]]` pairs and passed to `Object.fromEntries`. When multiple skills share the same category (e.g., `web-styling-scss-modules` and `web-styling-tailwind` both in `web-styling`), only the last skill survived -- all earlier ones were silently dropped.

This is a common JavaScript footgun: `Object.fromEntries([["a", 1], ["a", 2]])` produces `{ a: 2 }`, not `{ a: [1, 2] }`.

## Fix Applied

Replaced `Object.fromEntries(validSkills.map(...))` with a `Map<Category, SkillAssignment[]>` grouping loop that accumulates all skills per category, then converted the Map to an object via `Object.fromEntries(grouped)`.

Added a regression test with `web-styling-scss-modules` and `web-styling-tailwind` (both `web-styling` category) verifying both skills appear in the stack.

## Proposed Standard

Add to `docs/standards/clean-code-standards.md`:

**Never use `Object.fromEntries()` with potentially duplicate keys.** When mapping items to key-value pairs where multiple items can share the same key, group items first (using `Map`, `groupBy` from remeda, or a reduce) before converting to an object. `Object.fromEntries` silently drops duplicates.
