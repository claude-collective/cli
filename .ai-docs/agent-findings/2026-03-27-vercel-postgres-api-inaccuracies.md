---
type: anti-pattern
severity: high
affected_files:
  - /home/vince/dev/skills/src/skills/api-database-vercel-postgres/SKILL.md
  - /home/vince/dev/skills/src/skills/api-database-vercel-postgres/reference.md
  - /home/vince/dev/skills/src/skills/api-database-vercel-postgres/examples/core.md
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

Three API accuracy issues in the `api-database-vercel-postgres` skill:

1. **Wrong underlying dependency claim**: SKILL.md and philosophy section stated `@vercel/postgres` is "a thin wrapper around `@neondatabase/serverless`". This is factually incorrect -- the npm README explicitly states it "uses the `pg` package" (node-postgres). `@neondatabase/serverless` is the **replacement**, not the underlying dependency.

2. **Non-existent package referenced**: Both SKILL.md and reference.md recommended `@neondatabase/vercel-postgres-compat` as a "drop-in replacement". While Neon's transition guide docs mention this package name, it does **not exist on npm** (confirmed via `npm view` and `npm search`). Referencing a non-existent package as a migration path is misleading.

3. **Missing API export**: The `postgresConnectionString(type: 'pool' | 'direct')` function is a documented export in the npm README but was not listed in reference.md's API Exports table.

Additionally, a content duplication issue: SKILL.md's `<patterns>` section contained full 20+ line implementations (good AND bad examples) that were nearly verbatim duplicates of content in `examples/core.md`. Per the atomicity bible, SKILL.md patterns should be "Name + brief illustrative snippet (3-10 lines) + link to example file".

## Fix Applied

1. Changed "thin wrapper around `@neondatabase/serverless`" to "wraps the `pg` (node-postgres) driver" in Quick Guide and Philosophy sections
2. Removed all references to `@neondatabase/vercel-postgres-compat` -- simplified to single recommended migration path (`@neondatabase/serverless`)
3. Added `postgresConnectionString` to reference.md API Exports table
4. Trimmed SKILL.md patterns from ~190 lines of full implementations to ~65 lines of brief snippets with links to core.md
5. Added migration examples (Pattern 7) to core.md since SKILL.md now points there

## Proposed Standard

Add to `skill-atomicity-primer.md` under "API verification":

- **Verify underlying dependencies**: When a skill claims "wraps X" or "built on X", confirm via npm README or package.json -- AI-generated content frequently confuses a package's dependency with its replacement/competitor
- **Verify referenced packages exist**: Run `npm view <package>` for any package recommended as an alternative or migration target. Documentation sites may reference packages that have not been published
