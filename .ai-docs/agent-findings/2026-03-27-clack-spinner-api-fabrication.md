---
type: anti-pattern
severity: medium
affected_files:
  - src/skills/cli-framework-cli-commander/SKILL.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: dry
domain: cli
root_cause: enforcement-gap
---

## What Was Wrong

The `cli-framework-cli-commander` skill contained two fabricated API references for @clack/prompts:

1. **Auto-detection keywords** listed `p.progress` which does not exist in @clack/prompts
2. **Red flags section** claimed the spinner has `.isCancelled` property and `.cancel()` / `.error()` methods — these do not exist; the spinner only exposes `.start(msg)`, `.stop(msg)`, and a `.message` setter

These are hallucinated API surfaces that would mislead agents into calling non-existent methods.

## Fix Applied

1. Replaced `p.progress` with real exports `p.multiselect` and `p.group` in auto-detection
2. Corrected the spinner red flag to accurately describe the actual API surface

## Proposed Standard

Add a check to the skill-atomicity-primer.md or skill-atomicity-bible.md quality gate checklist:

- [ ] All API method names, properties, and signatures verified against actual library exports — no fabricated methods

This is already implicitly covered by "API verification" in the primer, but an explicit checklist item would make it harder to skip during audits.
