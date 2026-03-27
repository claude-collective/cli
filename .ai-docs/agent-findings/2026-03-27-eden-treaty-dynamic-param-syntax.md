---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/api-framework-elysia/SKILL.md
  - skills/src/skills/api-framework-elysia/examples/eden-treaty.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: api
root_cause: rule-not-specific-enough
---

## What Was Wrong

The Elysia skill had an incorrect red flag claiming that Eden Treaty bracket notation for dynamic path params "doesn't work" (`api.user[1].get()`). The official Elysia docs confirm bracket notation IS supported (`api.user['123'].get()`), but the value must be a string, not a numeric index. The skill was conflating "numeric index doesn't work" with "bracket notation doesn't work."

Additionally, the skill's `<philosophy>` section contained a "Use Elysia when" / "Use a different framework when" block that duplicated the "When to use" / "When NOT to use" section earlier in the same file, violating the single-location rule.

The `as('plugin')` red flag claimed it was "removed in 1.3+" but it was actually renamed to `as('scoped')` in Elysia 1.1.

## Fix Applied

1. Corrected the Eden Treaty red flag to specify that bracket notation works with string keys but not numeric indices
2. Updated the bad example in eden-treaty.md to clarify the actual issue (string vs number, not bracket vs function)
3. Removed the duplicated "Use Elysia when" / "Use a different framework when" from the `<philosophy>` section
4. Fixed the `as('plugin')` red flag to say "renamed to `as('scoped')` since 1.1" instead of "removed in 1.3+"
5. Genericized a `trpc integration` reference in reference.md to `shared schema libraries`

## Proposed Standard

The skill-atomicity-primer.md "API verification" section should emphasize verifying not just API signatures but also red flags and gotchas claims against official docs. AI-generated skills frequently state things "don't work" when actually only a specific variant doesn't work, leading to overly restrictive guidance.
