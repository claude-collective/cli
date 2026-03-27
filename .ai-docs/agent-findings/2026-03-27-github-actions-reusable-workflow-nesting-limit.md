---
type: standard-gap
severity: medium
affected_files:
  - skills/src/skills/infra-ci-cd-github-actions/SKILL.md
  - skills/src/skills/infra-ci-cd-github-actions/reference.md
  - skills/src/skills/infra-ci-cd-github-actions/examples/core.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: infra
root_cause: rule-not-specific-enough
---

## What Was Wrong

The GitHub Actions skill consistently described the reusable workflow nesting limit as "up to 10 nested levels" across SKILL.md, reference.md, and core.md. The actual GitHub documentation states the limit is "10 levels total (top-level caller + up to 9 nested levels)." The distinction matters: "10 nested" implies 11 total levels (1 caller + 10 nested), overstating the actual capability by 1 level.

Additionally, reference.md included an inline comment `# v4 is still current` next to `aws-actions/configure-aws-credentials@v4`, which is no longer accurate since v5 has been released.

## Fix Applied

- Updated all 6 occurrences of "10 nested levels" to "10 levels total (caller + 9 nested)" across SKILL.md (3 locations), reference.md (2 locations), and core.md (1 location)
- Updated "50 total" to "50 unique per run" for clarity
- Removed the misleading `# v4 is still current` comment from reference.md

## Proposed Standard

When documenting GitHub Actions limits, always use GitHub's exact phrasing from the official docs to avoid subtle inaccuracies. Add a note to `skill-atomicity-bible.md` or a new verification checklist: "When a skill quotes platform-specific limits (nesting depth, input counts, cache sizes), verify exact wording against official documentation -- paraphrasing often introduces off-by-one errors."
