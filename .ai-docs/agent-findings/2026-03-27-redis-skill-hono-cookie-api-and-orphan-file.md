---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/api-database-redis/examples/sessions.md
  - skills/src/skills/api-database-redis/examples/setup.md
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

Two issues in the `api-database-redis` skill:

1. **Incorrect Hono cookie API** -- `sessions.md` used `c.req.cookie(name)` to read cookies and raw `c.header("Set-Cookie", ...)` to set them. The correct Hono API is `getCookie(c, name)` and `setCookie(c, name, value, options)` from `"hono/cookie"`. This was a fabricated API that does not exist in Hono.

2. **Orphaned `setup.md` file** -- A full duplicate of `core.md` existed as `examples/setup.md` but was not referenced from SKILL.md TOC. This is the "old technology-named example files" pattern from Iteration 1 learnings where content was moved to `core.md` but the original file was never deleted.

## Fix Applied

1. Updated `sessions.md` Hono middleware to import and use `getCookie`/`setCookie` from `"hono/cookie"` with proper options object for cookie attributes (path, httpOnly, sameSite, maxAge).

2. Deleted the orphaned `setup.md` file.

## Proposed Standard

The skill-atomicity-primer.md already documents the "old technology-named example files" cleanup requirement. No new rule needed -- this is enforcement of existing rules. For API accuracy, the primer's "API verification" section covers this: always verify import paths and method signatures via Context7 or official docs before accepting AI-generated code.
