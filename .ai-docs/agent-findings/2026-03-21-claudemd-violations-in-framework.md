---
type: convention-drift
severity: high
affected_files:
  - e2e/fixtures/project-builder.ts
  - e2e/pages/wizards/init-wizard.ts
  - e2e/pages/constants.ts
standards_docs:
  - CLAUDE.md
date: 2026-03-21
reporting_agent: cli-tester
category: typescript
domain: e2e
root_cause: enforcement-gap
---

## What Was Wrong

New framework infrastructure code introduced patterns explicitly forbidden by CLAUDE.md:

- 4x `as unknown as Record<string, unknown>` double casts in `project-builder.ts` (CLAUDE.md: "NEVER use `as unknown as T` double casts")
- `as SkillId`/`as AgentName`/`as Domain` on valid union members (CLAUDE.md: "NEVER use `as SkillId` casts on valid union members")
- Backward-compatibility re-export of `DashboardSession` (CLAUDE.md: "NEVER add backward-compatibility shims")
- Duplicate `AGENT_METADATA_YAML` constant identical to `METADATA_YAML`

## Fix Applied

Replaced double casts with `writeProjectConfig()`, removed unnecessary union casts, removed backward-compat re-export, consolidated duplicate constant. 7 files changed.

## Proposed Standard

No new standard needed -- existing CLAUDE.md rules cover all cases. This is an enforcement gap. Sub-agents creating new framework code should be explicitly told to check CLAUDE.md NEVER rules before writing infrastructure code.
