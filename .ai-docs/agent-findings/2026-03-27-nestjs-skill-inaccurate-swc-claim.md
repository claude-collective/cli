---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/api-framework-nestjs/SKILL.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: api
root_cause: convention-undocumented
---

## What Was Wrong

The NestJS skill claimed "SWC is the default compiler" in NestJS 11 (in both the Quick Guide and the red_flags/gotchas section). This is factually incorrect. The official NestJS 11 announcement (trilon.io) does not mention SWC as a default at all. SWC remains an opt-in compiler configured via `"builder": "swc"` in `nest-cli.json`. The skill also had a `console.log` in an example (MailerService in core.md) which contradicts the skill's own guidance to use NestJS Logger.

## Fix Applied

1. Quick Guide: Changed "(SWC default compiler, ...)" to "(opt-in SWC compiler, ...)"
2. Red flags section: Changed "SWC is the default compiler (20x faster builds)" to "SWC is a supported opt-in compiler via `nest-cli.json` (`"builder": "swc"`) -- 20x faster builds than tsc"
3. examples/core.md: Replaced `console.log` in MailerService with a comment placeholder

## Proposed Standard

Add a requirement to `skill-atomicity-primer.md` under "API verification": when a skill makes claims about version-specific changes (e.g., "X is now the default in v11"), those claims must be verified against the official release announcement or migration guide, not just general documentation pages. Version-specific behavioral changes are the most common source of inaccurate claims in skills.
