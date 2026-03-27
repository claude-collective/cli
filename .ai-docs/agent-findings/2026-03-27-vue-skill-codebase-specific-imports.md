---
type: anti-pattern
severity: medium
affected_files:
  - /home/vince/dev/skills/src/skills/web-framework-vue-composition-api/examples/core.md
  - /home/vince/dev/skills/src/skills/web-framework-vue-composition-api/examples/async.md
  - /home/vince/dev/skills/src/skills/web-framework-vue-composition-api/examples/provide-inject.md
  - /home/vince/dev/skills/src/skills/web-framework-vue-composition-api/examples/composables.md
  - /home/vince/dev/skills/src/skills/web-framework-vue-composition-api/examples/vue-3-5-features.md
  - /home/vince/dev/skills/src/skills/web-framework-vue-composition-api/SKILL.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: web
root_cause: convention-undocumented
---

## What Was Wrong

The Vue Composition API skill contained 10 instances of `@/` path alias imports (`@/components/...`, `@/views/...`, `@/types`, `@/contexts/...`, `@/composables/...`) across 6 files. These are codebase-specific path aliases (Category 7 violation per the atomicity bible) that assume a specific project path alias configuration. Skills should use generic relative imports to be portable across any Vue project.

## Fix Applied

Replaced all `@/` path alias imports with generic relative imports:

- `@/components/X.vue` -> `./X.vue`
- `@/views/X.vue` -> `./X.vue`
- `@/types` -> `../types`
- `@/contexts/theme` -> `../contexts/theme`
- `@/composables/use-fetch` -> `./use-fetch`
- `@/composables/use-auto-focus` -> `./use-auto-focus`

## Proposed Standard

Vue skills are particularly susceptible to `@/` alias imports because Vue CLI and Vite-based Vue projects conventionally configure this alias. Add `@/` to the atomicity bible Keywords to Watch section under "Codebase-Specific" alongside `@repo/` and `@/lib/`. The existing `@/lib/` pattern is too narrow -- the broader `@/` prefix should be flagged.
