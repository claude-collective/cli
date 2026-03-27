---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/api-flags-posthog-flags/SKILL.md
  - skills/src/skills/api-flags-posthog-flags/examples/server-side.md
  - skills/src/skills/api-flags-posthog-flags/examples/development.md
  - skills/src/skills/api-flags-posthog-flags/examples/core.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-primer.md
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: api
root_cause: convention-undocumented
---

## What Was Wrong

Three categories of issues found in the `api-flags-posthog-flags` skill:

1. **Wrong API defaults**: `featureFlagsPollingInterval` was documented as defaulting to 300,000ms (5 minutes). The actual default is 30,000ms (30 seconds) per PostHog Node.js SDK docs.

2. **Wrong callback signature**: `onFeatureFlags` was documented as receiving 2 parameters `(flagVariants, { errorsLoading })`. The actual signature has 3 parameters: `(flags, flagVariants, { errorsLoading })` where `flags` is `string[]`.

3. **Codebase-specific imports**: All example files used `@/lib/feature-flags` and `@/lib/posthog-server` path aliases, which is a Category 7 atomicity violation (codebase-specific imports).

## Fix Applied

- Corrected polling interval default from 300,000ms to 30,000ms in SKILL.md and examples/server-side.md
- Fixed `onFeatureFlags` callback to show all 3 parameters in examples/development.md
- Updated SKILL.md red_flags to say "third parameter" instead of "second parameter"
- Replaced all `@/lib/` imports with relative `../lib/` imports in examples/core.md and examples/server-side.md (9 occurrences)
- Removed redundant `enableLocalEvaluation: true` from Redis cache example (personalApiKey enables it automatically)

## Proposed Standard

The skill-atomicity-primer.md already calls out "Wrong API signatures" as a common defect. No new rule needed, but this reinforces that numeric defaults (timeouts, intervals, polling frequencies) and callback parameter counts are high-risk areas for AI-generated content and should always be verified against official SDK docs.
