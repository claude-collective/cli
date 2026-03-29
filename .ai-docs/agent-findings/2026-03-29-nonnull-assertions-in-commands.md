---
type: anti-pattern
severity: medium
affected_files:
  - src/cli/commands/eject.ts
  - src/cli/commands/search.tsx
  - src/cli/commands/doctor.ts
standards_docs:
  - CLAUDE.md
date: 2026-03-29
reporting_agent: cli-tester
category: typescript
domain: cli
root_cause: enforcement-gap
---

## What Was Wrong

Four non-null assertions (`!`) found across three command files in `src/cli/commands/`:

1. **eject.ts:193,198** -- `sourceResult!` used in switch branches where `sourceResult` is typed `SourceLoadResult | undefined`. Logically safe because `loadSourceIfNeeded` returns a value for the branches that use it, but TypeScript cannot infer the correlation between the eject type argument and the return type.

2. **eject.ts:244,281** -- `result.skipReason!` used after `if (result.skipped)` guard. The `skipped` and `skipReason` fields are separate boolean + optional string instead of a discriminated union, so TS cannot narrow.

3. **search.tsx:367** -- `options.category!` used inside a `.filter()` callback after an outer `if (options.category)` guard. TypeScript loses narrowing inside closure callbacks.

4. **doctor.ts:308** -- `result.details!` used after a truthiness check stored in an intermediate `shouldShowDetails` boolean. TypeScript cannot narrow through intermediate boolean variables.

All four patterns violate the CLAUDE.md rule against non-null assertions. All are logically safe at the current code state but would silently break if the code evolves.

## Fix Applied

Items 2-4 fixed (items matching the spec's three issues):

- **eject.ts:244,281** (`result.skipReason!`): Converted `EjectAgentPartialsResult` and `EjectSkillsResult` from flat types with optional fields to discriminated unions on `skipped`. When `skipped: true`, `skipReason` is required `string`; when `skipped: false`, success fields (`destDir`, `sourceLabel`, etc.) are required. Non-null assertions removed.
- **search.tsx:367** (`options.category!`): Captured `const category = options.category` before the `if` block, then used `category` (narrowed to `string`) inside the `.filter()` closure.
- **doctor.ts:308** (`result.details!`): Destructured `const { details } = result` and inlined the truthiness check directly in the `if` condition, allowing TypeScript to narrow `details` to `string[]` inside the block.

Item 1 (`sourceResult!` at eject.ts:193,198) was not in scope for this fix.

## Proposed Standard

The CLAUDE.md rule "NEVER use `matrix.skills[id]!` non-null assertions" should be generalized and reinforced with specific fix patterns for the three common causes:

1. **Correlated conditionals** (eject.ts sourceResult): Move the load/assignment into the branch that uses the value so TS can see it is always defined.
2. **Boolean + optional field pairs** (eject.ts skipReason): Use discriminated unions (`{ skipped: true; skipReason: string } | { skipped: false }`) so TS narrows the optional field.
3. **Closure narrowing loss** (search.tsx category, doctor.ts details): Capture the narrowed value in a local `const` before entering the callback, or inline the truthiness check.

These three patterns cover all non-null assertion instances found in the commands directory. Adding them as examples under the existing CLAUDE.md rule would prevent recurrence.
