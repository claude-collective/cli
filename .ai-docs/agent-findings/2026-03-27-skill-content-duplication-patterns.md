---
type: anti-pattern
severity: medium
affected_files:
  - /home/vince/dev/skills/src/skills/api-cms-payload/SKILL.md
  - /home/vince/dev/skills/src/skills/api-cms-payload/examples/core.md
  - /home/vince/dev/skills/src/skills/api-cms-payload/examples/advanced.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: dry
domain: api
root_cause: rule-not-specific-enough
---

## What Was Wrong

The `api-cms-payload` SKILL.md contained full code implementations (30+ line code blocks) for all 6 patterns that were essentially duplicated in the example files. This violated the atomicity bible's SKILL.md Content Standard which states SKILL.md is the "decision layer" with "brief illustrative snippet (3-10 lines) + link to example file." The SKILL.md was 785 lines, exceeding the ~500 line target.

Additionally, hooks examples across all files were missing the `context` parameter that Payload v3 provides for preventing infinite loops when hooks trigger other operations. The versions/drafts config only showed `drafts: true` (boolean) but not the advanced object form with `autosave`, `schedulePublish`, and `validate` options.

## Fix Applied

1. Replaced full code implementations in SKILL.md patterns section with brief snippets (3-10 lines each) + links to example files. SKILL.md reduced from 785 to 370 lines.
2. Added `context` parameter to `afterChange` hook examples in both `examples/core.md` and `examples/advanced.md`.
3. Updated versions/drafts config in `examples/advanced.md` to show advanced `drafts: { autosave, schedulePublish, validate }` object form.
4. Added `interfaceName` to block definitions in `examples/core.md`.
5. Added `req` parameter for transaction threading in cross-collection hook operations.
6. Removed "Drizzle"/"Mongoose" ORM names from philosophy section (users don't interact with these directly).
7. Removed duplicated "When NOT to use" section from philosophy (already in main section).

## Proposed Standard

The atomicity bible's SKILL.md Content Standard section could be more explicit about what "brief illustrative snippet" means. Consider adding: "SKILL.md code blocks should be 3-10 lines showing the essential shape of the API, not complete working implementations. Full implementations belong in example files only." This would prevent AI-generated skills from putting full code in both SKILL.md and examples.
