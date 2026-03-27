---
type: anti-pattern
severity: high
affected_files:
  - /home/vince/dev/skills/src/skills/api-vector-db-weaviate/SKILL.md
  - /home/vince/dev/skills/src/skills/api-vector-db-weaviate/reference.md
  - /home/vince/dev/skills/src/skills/api-vector-db-weaviate/examples/core.md
  - /home/vince/dev/skills/src/skills/api-vector-db-weaviate/examples/search.md
  - /home/vince/dev/skills/src/skills/api-vector-db-weaviate/examples/multi-tenancy.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: api-accuracy
domain: api
root_cause: ai-generated-wrong-api
---

## What Was Wrong

The `api-vector-db-weaviate` skill used `client.collections.use('Name')` throughout all files (30+ occurrences) to obtain a collection reference. The correct Weaviate TypeScript client v3 API method is `client.collections.get('Name')`. The `.use()` method does not exist on the Weaviate client. This would cause runtime errors for any agent following the skill's code patterns.

Additionally, the "When NOT to use" section in SKILL.md named 5 specific external tools (PostgreSQL, Elasticsearch/Meilisearch, Redis, TimescaleDB/InfluxDB, Neo4j) in violation of the atomicity bible's Category 2 (Explicit Tool Recommendations).

## Fix Applied

1. Replaced all `client.collections.use()` with `client.collections.get()` across all 5 files (30+ occurrences)
2. Genericized the "When NOT to use" entries to use category descriptions instead of specific tool names (e.g., "use a relational database" instead of "use PostgreSQL")

## Proposed Standard

AI-generated skills should have their primary API method names verified against official documentation before publishing. The `skill-atomicity-primer.md` already recommends API verification via Context7 or WebSearch, but a specific checklist item for "verify the most-used method name in the skill appears in official API docs" would catch pervasive errors like this earlier.
