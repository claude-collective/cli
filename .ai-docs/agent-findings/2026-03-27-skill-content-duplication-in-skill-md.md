---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/api-cms-sanity/SKILL.md
  - skills/src/skills/api-cms-sanity/examples/core.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: dry
domain: web
root_cause: rule-not-specific-enough
---

## What Was Wrong

The api-cms-sanity SKILL.md contained 8 full code implementation patterns (435 lines in the `<patterns>` section alone, 674 total) that were nearly identical copies of examples already in the `examples/` folder. The atomicity bible states SKILL.md should have "brief illustrative snippet (3-10 lines) + link to example file" and should target ~500 lines, but the existing skill had full good/bad examples with complete implementations duplicated across SKILL.md and example files. Additionally, a cross-domain reference to "Supabase" existed in core.md and "Contentful, Strapi" were named in SKILL.md.

## Fix Applied

- Condensed all 8 patterns in SKILL.md from full implementations to brief snippets (3-8 lines each) with explicit links to the relevant example files
- Reduced SKILL.md from 674 to 375 lines
- Removed "Supabase" reference from core.md (genericized to "not a `{ data, error }` tuple")
- Genericized "Contentful, Strapi, etc." to "the dedicated skill for your CMS"
- Decision frameworks, red flags, critical requirements/reminders left intact (these belong in SKILL.md)

## Proposed Standard

The atomicity bible's SKILL.md Content Standard table already says patterns should have "brief illustrative snippet (3-10 lines) + link to example file," but this is easy to miss since it's in a table row. Consider adding a more prominent callout in the "Skill Directory Structure" section:

> **SKILL.md patterns must not duplicate example files.** Each pattern gets a 1-2 sentence description, a 3-10 line snippet showing the essential API, and a link to the full example. Full good/bad implementations belong exclusively in `examples/`.
