---
type: anti-pattern
severity: medium
affected_files:
  - /home/vince/dev/skills/src/skills/api-database-drizzle/SKILL.md
  - /home/vince/dev/skills/src/skills/api-database-drizzle/examples/core.md
  - /home/vince/dev/skills/src/skills/api-database-drizzle/examples/queries.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: dry
domain: api
root_cause: rule-not-specific-enough
---

## What Was Wrong

The `api-database-drizzle` skill had extensive content duplication across files:

1. **SKILL.md duplicated its own content**: A `<philosophy>` section (lines 73-92) repeated the same "When to use / When NOT to use" guidance already present at lines 45-56. A "Key patterns covered" bulleted list (lines 58-69) restated the same information as the TOC links (lines 30-39).

2. **SKILL.md duplicated example files**: Full 20+ line code blocks for database connection setup, Drizzle Kit config, schema definition, and relational queries were copy-pasted identically in both SKILL.md and their corresponding example files (core.md, queries.md). The atomicity bible says SKILL.md should have "brief 3-10 line snippet + link to example file", not full implementations.

3. **API version inaccuracy**: `drizzle-seed` minimum version was listed as `drizzle-orm@0.36.4+` but official docs state `drizzle-orm@0.29.1+`. The `drizzle-zod` deprecation version was also unspecified (now corrected to `drizzle-orm@0.31.0`).

4. **Platform-specific names**: "Vercel Edge, Cloudflare Workers" appeared instead of generic "serverless edge environments".

## Fix Applied

- Removed duplicated `<philosophy>` section and "Key patterns covered" list from SKILL.md
- Replaced full code blocks in SKILL.md Patterns 1-3 with brief 3-7 line snippets + bullet-point guidance + links to example files
- Fixed `drizzle-seed` version to `0.29.1+`, `drizzle-zod` deprecation to `drizzle-orm@0.31.0`
- Replaced "Vercel Edge, Cloudflare Workers" with "serverless edge environments" in reference.md
- SKILL.md reduced from 320 to 186 lines while preserving all decision guidance and red flags

## Proposed Standard

The skill-atomicity-bible.md "SKILL.md Content Standard" section already states the rule ("brief 3-10 line snippet + link to example file"), but the original skill was generated before this standard was applied. No new rule needed -- this is an enforcement gap where existing content was not audited against the standard. The iteration process (skill-atomicity-primer.md) correctly identifies this as a common defect ("Content duplicated in 2-3 files").
