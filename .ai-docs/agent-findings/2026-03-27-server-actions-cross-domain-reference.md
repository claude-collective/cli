---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/api-framework-hono/SKILL.md
  - skills/src/skills/api-framework-hono/reference.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: api
root_cause: rule-not-specific-enough
---

## What Was Wrong

Non-Next.js/non-React skills referenced "Server Actions" by name as an alternative to their own technology. This is a Category 2 atomicity violation (explicit tool recommendation) because "Server Actions" is a framework-specific concept (Next.js/React 19). Skills that are framework-agnostic (like Hono) should not name specific alternatives from other domains.

Found in `api-framework-hono` in 3 places:

- SKILL.md "When NOT to use" section
- reference.md decision framework summary
- reference.md "When NOT to Use" list

Grepping across the skills repo found 21 files referencing "Server Actions". Many are legitimate (the Next.js skill itself, auth skills that integrate with Next.js). Non-Next.js skills that reference "Server Actions" as an alternative should be audited.

## Fix Applied

Replaced "Server Actions" with "framework-native endpoints" in the Hono skill (3 occurrences across SKILL.md and reference.md).

## Proposed Standard

Add "Server Actions" to the Keywords to Watch section (Section 4) of `skill-atomicity-bible.md` under a new "API Domain" subsection:

```
### API Domain
Server Actions (Next.js/React-specific — replace with "framework-native endpoints" in non-Next.js skills)
```

This would catch the pattern in future audits. The rule: only the Next.js skill and skills that explicitly integrate with Next.js (like next-intl, next-auth) may reference "Server Actions" by name. All other skills should use generic alternatives like "framework-native endpoints" or "server-side form handlers".
