---
type: anti-pattern
severity: high
affected_files:
  - skills/src/skills/api-vector-db-pinecone/reference.md
  - skills/src/skills/api-vector-db-pinecone/examples/metadata-filtering.md
  - skills/src/skills/api-vector-db-pinecone/examples/inference.md
  - skills/src/skills/api-vector-db-pinecone/examples/namespaces.md
  - skills/src/skills/api-vector-db-pinecone/SKILL.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: api
root_cause: enforcement-gap
---

## What Was Wrong

The Pinecone skill contained four fabricated or incorrect API patterns that do not exist in the `@pinecone-database/pinecone` v7 SDK:

1. **`index.fetchByMetadata(options)`** -- This method does not exist in the Pinecone SDK. It was listed in reference.md, used in metadata-filtering.md examples, and included in SKILL.md auto-detection keywords.

2. **`pc.index(name, host)` two-arg shorthand** -- This calling convention does not exist. The v7 SDK only supports `pc.index({ host })` (options object form). Listed in reference.md.

3. **`pc.inference.listModels({ type: "embed" })` filter parameter** -- The `listModels()` method does not accept a `type` filter parameter. It returns all models; filtering must be done client-side.

4. **`index.listNamespaces({ prefix: "tenant-" })` prefix parameter** -- The `listNamespaces()` method does not accept a `prefix` filter parameter. Prefix filtering must be done client-side after fetching all namespaces.

These are exactly the kind of AI-hallucinated API signatures warned about in the skill-atomicity-primer: "not just outdated, but fundamentally wrong (wrong package, wrong parameter shape)."

## Fix Applied

1. Removed `fetchByMetadata` from reference.md method table, metadata-filtering.md example section, and SKILL.md auto-detection keywords.
2. Removed `pc.index(name, host)` row from reference.md method table.
3. Removed the `{ type: "embed" }` parameter from `listModels()` call in inference.md.
4. Changed `listNamespaces({ prefix: "tenant-" })` to `listNamespaces()` with client-side `.filter()` in namespaces.md.

## Proposed Standard

The skill-atomicity-primer already documents this risk well under "API verification." Enforcement could be strengthened by adding a checklist item to the quality gate in skill-atomicity-bible.md Section 6:

- [ ] Every SDK method name in reference.md and examples has been verified against official docs or Context7 -- no fabricated methods
