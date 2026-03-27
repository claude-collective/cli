---
type: anti-pattern
severity: medium
affected_files:
  - /home/vince/dev/skills/src/skills/shared-monorepo-turborepo/reference.md
  - /home/vince/dev/skills/src/skills/shared-monorepo-turborepo/SKILL.md
  - /home/vince/dev/skills/src/skills/shared-security-auth-security/reference.md
  - /home/vince/dev/skills/src/skills/shared-security-auth-security/SKILL.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
  - .ai-docs/standards/prompt-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: dry
domain: shared
root_cause: convention-undocumented
---

## What Was Wrong

Two recurring anti-patterns found across the audited skills:

1. **Integration Guide violation (Category 3)**: `shared-monorepo-turborepo/reference.md` had a "Works with:" section listing specific tools (Bun, ESLint, Syncpack, CI/CD, Vercel) and a "Replaces / Conflicts with:" section naming Lerna, Nx, Rush. This is the exact pattern flagged in the atomicity bible as a Category 3 HIGH severity violation.

2. **Red flags duplication**: Both skills duplicated red flags verbatim between SKILL.md and reference.md. The atomicity bible states "each concept should live in ONE canonical location" and designates SKILL.md as the canonical owner for red flags.

3. **Framework-specific references (.next)**: The turborepo skill used `.next/**` (Next.js output directory) throughout turbo.json examples and red flags. While illustrative, this is a Category 8 violation (Framework-Specific Names) since Turborepo works with any JS framework.

4. **Philosophy section duplication**: The turborepo SKILL.md had "When to use / When NOT to use" content stated twice -- once in the main body and again in the `<philosophy>` section with nearly identical bullets.

## Fix Applied

1. Removed the Integration Guide section entirely from `shared-monorepo-turborepo/reference.md`
2. Replaced `.next/**` references with generic `build/**` or `dist/**` across SKILL.md, reference.md, and examples
3. Removed duplicated When to use/When NOT to use from the philosophy section in turborepo SKILL.md
4. Genericized "Bun workspaces protocol" to "workspaces protocol" in critical requirements (workspace:\* is package-manager agnostic)
5. Deduplicated red flags in `shared-security-auth-security/reference.md` -- replaced with cross-reference to SKILL.md and kept only the additional common mistakes/gotchas not present in SKILL.md
6. Added two missing medium-priority red flags to auth-security SKILL.md that were only in reference.md

## Proposed Standard

The integration guide and red flags duplication patterns are already documented in the atomicity bible. No new standard needed -- just consistent enforcement during skill audits. The `.next/**` pattern should be added to the "Keywords to Watch" section of the atomicity bible under a new "Framework Output Directories" subsection:

```
### Framework Output Directories
.next (Next.js output)
.nuxt (Nuxt output)
.svelte-kit (SvelteKit output)
(replace with generic dist/** or build/** in non-framework-specific skills)
```
