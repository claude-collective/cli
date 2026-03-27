---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/api-database-typeorm/examples/core.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: dry
domain: api
root_cause: enforcement-gap
---

## What Was Wrong

A "Good Example" in `core.md` used glob patterns for entity paths (`[__dirname + "/entities/*.entity.{ts,js}"]`) while the SKILL.md Pattern 1 bad example and red flags section explicitly warned against glob patterns ("breaks with bundlers", "non-deterministic"). This contradicts the skill's own guidance and could cause an agent to produce code the skill itself marks as a red flag.

Similarly, the critical requirements referenced `transactionalEntityManager` as the parameter name, but every code example in the skill used `manager` as the callback parameter. This naming mismatch could cause an agent to look for a non-existent variable.

Also, `@VirtualColumn` was documented as added in `v0.3.17+` but was actually introduced in `v0.3.11` per the TypeORM changelog.

## Fix Applied

1. Replaced glob entity paths in `core.md` good example with explicit entity class imports (`entities: [User, Post]`), matching SKILL.md Pattern 1 good example
2. Updated `transactionalEntityManager` to `transaction \`manager\` parameter` in both critical_requirements and critical_reminders (2 occurrences) to match code examples
3. Corrected `@VirtualColumn` version from `v0.3.17+` to `v0.3.11+` in `advanced.md`

## Proposed Standard

Add to skill-atomicity-bible.md Quality Gate Checklist under "Coherence":

- [ ] Good examples do not use patterns the same skill's red flags or bad examples warn against
- [ ] Terminology in critical_requirements/critical_reminders matches variable and parameter names used in code examples
- [ ] Version annotations on API features are verified against changelogs or official docs
