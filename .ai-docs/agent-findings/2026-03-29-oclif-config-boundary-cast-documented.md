---
type: standard-gap
severity: low
affected_files:
  - src/cli/base-command.ts
  - src/cli/hooks/init.ts
standards_docs:
  - CLAUDE.md
date: 2026-03-29
reporting_agent: cli-tester
category: typescript
domain: cli
root_cause: rule-not-specific-enough
---

## What Was Wrong

CLAUDE.md rule "NEVER use `as unknown as T` double casts -- fix the upstream type instead" was flagged by the D-138 audit against two casts in `base-command.ts` and `hooks/init.ts`. Investigation found these are legitimate framework boundary casts where oclif's `Config` is a class with no index signature and no extensibility mechanism. The casts are already documented with inline comments.

The rule does not explicitly acknowledge that third-party framework boundaries may require documented double casts when the upstream type is not fixable (library class, no index signature, no augmentation path).

## Fix Applied

None -- discovery only. The casts are correctly documented and unavoidable. The finding documents why they are acceptable.

## Proposed Standard

Add a clarification to the CLAUDE.md "NEVER use `as unknown as T`" rule acknowledging the exception:

> Exception: Framework boundary casts where the upstream type is a third-party class that cannot be augmented. These MUST have a comment explaining: (1) what framework limitation requires the cast, and (2) where the symmetric read/write sites are. See `base-command.ts` and `hooks/init.ts` for the canonical example.

This prevents future audits from re-flagging the same legitimate pattern.
