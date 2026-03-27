---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/api-baas-turso/examples/core.md
  - skills/src/skills/api-baas-turso/SKILL.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: api
root_cause: convention-undocumented
---

## What Was Wrong

The Turso skill's interactive transaction examples (SKILL.md Pattern 4 and core.md Pattern 4) used try/catch blocks without a `finally` clause calling `tx.close()`. The libSQL TypeScript client's `Transaction` object has a `close()` method that should be called in a `finally` block to ensure the database lock is released even if commit/rollback themselves throw. Context7 documentation for `@libsql/client` confirms this pattern with `transaction.close()` in finally blocks.

Additionally, the SKILL.md contained full code implementations in Patterns 1-5 that duplicated the content in examples/core.md, violating the "SKILL.md is the decision layer" standard. The philosophy section also duplicated the "When to use" / "When NOT to use" lists already present in the main body.

## Fix Applied

1. Added `finally { tx.close(); }` to the interactive transaction example in `examples/core.md` Pattern 4
2. Condensed SKILL.md Patterns 1-5 from full implementations to brief illustrative snippets (3-10 lines) with links to examples/core.md
3. The condensed SKILL.md Pattern 4 already includes the correct try/catch/finally with `tx.close()` pattern
4. Removed duplicated "When to use"/"When NOT to use" from the philosophy section, merging unique items up
5. Condensed Pattern 7 (CLI commands) to avoid duplicating reference.md
6. SKILL.md reduced from 476 to 298 lines with no content loss

## Proposed Standard

Add to `skill-atomicity-primer.md` under "API verification":

- When auditing database/ORM skills, verify resource cleanup patterns (transaction close, connection close, cursor close) against official docs. AI-generated skills frequently omit finally/close patterns.
