---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/api-database-prisma/SKILL.md
  - skills/src/skills/api-database-prisma/reference.md
  - skills/src/skills/api-database-prisma/examples/core.md
  - skills/src/skills/api-database-prisma/examples/relations.md
  - skills/src/skills/api-database-prisma/examples/transactions.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: dry
domain: shared
root_cause: rule-not-specific-enough
---

## What Was Wrong

Full code examples were duplicated across SKILL.md, reference.md, and example files. Specifically:

1. PrismaClient singleton (20-line block) duplicated identically between SKILL.md and examples/core.md
2. N+1 anti-pattern code duplicated in SKILL.md, reference.md, and examples/relations.md
3. Serverless connection pattern duplicated in SKILL.md, reference.md, and examples/core.md
4. Transaction fund transfer example duplicated between SKILL.md and examples/transactions.md
5. "Using prisma instead of tx" bad example duplicated between SKILL.md and examples/transactions.md

The atomicity bible states each concept should live in ONE canonical location and SKILL.md should have "brief illustrative snippet (3-10 lines) + link to example file", but this rule is easy to overlook during initial skill creation.

## Fix Applied

- Shortened SKILL.md Pattern 1 (singleton) from full 20-line implementation to 3-line illustrative snippet with cross-reference
- Shortened SKILL.md Pattern 4 (relations) by removing the duplicated N+1 bad example, keeping the good patterns with a note
- Shortened SKILL.md Pattern 5 (transactions) by condensing the interactive transaction and removing duplicated bad example
- Shortened SKILL.md Pattern 6 (connection management) to prose-only with cross-reference (no code block)
- Replaced reference.md N+1 and Select code blocks with prose summaries and cross-references to examples/relations.md
- Replaced reference.md connection pooling code block with concise prose and cross-reference

SKILL.md reduced from 373 to 294 lines. reference.md reduced from 248 to 208 lines.

## Proposed Standard

Add explicit guidance to `skill-atomicity-bible.md` section "SKILL.md Content Standard":

> **Duplication rule:** When a code example appears in an example file, SKILL.md must use a condensed snippet (3-10 lines showing the essential pattern) with a `> See [examples/file.md]` cross-reference. Never copy a full implementation from an example file into SKILL.md. Similarly, reference.md should cross-reference example files rather than duplicating their code blocks.
