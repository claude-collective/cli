---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/web-mocks-msw/metadata.yaml
  - skills/src/skills/web-performance-web-performance/metadata.yaml
  - skills/src/skills/web-pwa-offline-first/metadata.yaml
  - skills/src/skills/web-pwa-service-workers/metadata.yaml
  - skills/src/skills/web-pwa-offline-first/SKILL.md
  - skills/src/skills/web-pwa-service-workers/SKILL.md
  - skills/src/skills/web-mocks-msw/examples/browser.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: web
root_cause: convention-undocumented
---

## What Was Wrong

Three distinct anti-patterns found across four audited skills:

1. **Missing metadata fields**: All four skills lacked `version` and `tags` in metadata.yaml. The atomicity bible requires `version` (integer) and kebab-case tags, but many skills were created without them.

2. **CLAUDE.md template contamination**: `web-pwa-offline-first` and `web-pwa-service-workers` both contained `> **All code must follow project conventions in CLAUDE.md**` in their `<critical_requirements>` and `<critical_reminders>` sections. Skills are marketplace plugins consumed by arbitrary projects -- they should not reference project-specific files like CLAUDE.md.

3. **Framework-specific imports in framework-agnostic skills**: `web-mocks-msw` browser.md used `import { createRoot } from "react-dom/client"` and `import.meta.env.DEV` (Vite-specific) in its SPA integration example. MSW is a mocking tool, not a React/Vite skill -- the integration pattern should be framework-agnostic.

## Fix Applied

1. Added `version: 1` and relevant kebab-case `tags` to all four metadata.yaml files.
2. Removed CLAUDE.md references from both `<critical_requirements>` and `<critical_reminders>` in offline-first and service-workers SKILL.md files.
3. Replaced React/Vite-specific code in MSW browser.md Pattern 8 with framework-agnostic `process.env.NODE_ENV` check and generic `renderApp()` call.
4. Moved misplaced "Detailed Resources" TOC in service-workers SKILL.md from after `</patterns>` to after "When NOT to use" (standard location).

## Proposed Standard

Add to skill-atomicity-bible.md Quality Gate Checklist under "Template Contamination":

- [ ] No references to `CLAUDE.md` or other project-specific configuration files in skill content -- skills are standalone marketplace plugins
- [ ] `metadata.yaml` includes `version` (integer) and `tags` (kebab-case array) fields

Add to skill-atomicity-primer.md "Learnings from Iteration" section:

- **Missing `version` and `tags` in metadata.yaml** (~many skills) -- add `version: 1` and relevant kebab-case tags
- **CLAUDE.md references in critical_requirements** (~2 skills) -- remove project-specific file references from marketplace skills
