---
type: anti-pattern
severity: high
affected_files:
  - ../skills/src/skills/ai-observability-promptfoo/SKILL.md
  - ../skills/src/skills/ai-observability-promptfoo/reference.md
  - ../skills/src/skills/ai-observability-promptfoo/examples/custom-providers.md
  - ../skills/src/skills/ai-observability-promptfoo/metadata.yaml
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: testing
domain: shared
root_cause: convention-undocumented
---

## What Was Wrong

The `ai-observability-promptfoo` skill contained a fabricated CLI flag (`--fail-on-error`) presented as a critical requirement. The skill claimed that `promptfoo eval` exits 0 on test failures and requires `--fail-on-error` to produce non-zero exit codes. Per the official promptfoo docs and Context7 verification, `promptfoo eval` returns exit code 100 on test failures **by default** -- the `--fail-on-error` flag does not exist in the CLI reference.

This false claim appeared in 6+ locations across SKILL.md (critical_requirements, critical_reminders, Quick Guide, philosophy, Pattern 6, red_flags), reference.md (CLI table, flags table), and examples/custom-providers.md (CI/CD workflows, npm scripts).

Additional issues found:

- Explicit tool naming (Vitest, Jest, k6, Artillery) in "When NOT to use" sections (atomicity Category 2 violation)
- Duplicated "When to use" and "When NOT to use" content between main sections and philosophy block
- Missing `version` (required integer) and `tags` fields in metadata.yaml

## Fix Applied

1. Replaced all `--fail-on-error` references with accurate exit code behavior (code 100 on test failures, code 1 on other errors)
2. Removed the fabricated bad example showing "CI without --fail-on-error"
3. Genericized tool names in "When NOT to use" (e.g., "use your test runner" instead of "use Vitest, Jest, etc.")
4. Removed duplicated "When to use" and "When NOT to use" from philosophy section
5. Added `version: 1` and `tags` array to metadata.yaml

## Proposed Standard

Add to skill-atomicity-primer.md under "API verification":

- When a skill makes claims about CLI flag behavior (exit codes, required flags), verify against the official CLI reference docs, not blog posts or integration guides. Blog posts may reference deprecated or non-existent flags.
- Flag any claim that a tool "exits 0" or "always succeeds" as high-priority for verification -- these are common AI hallucination patterns.
