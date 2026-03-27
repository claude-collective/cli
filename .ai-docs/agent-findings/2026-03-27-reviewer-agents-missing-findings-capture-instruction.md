---
type: convention-drift
severity: medium
affected_files:
  - src/agents/reviewer/cli-reviewer/workflow.md
  - src/agents/reviewer/cli-reviewer/critical-requirements.md
  - src/agents/reviewer/cli-reviewer/critical-reminders.md
  - src/agents/reviewer/infra-reviewer/workflow.md
  - src/agents/reviewer/infra-reviewer/critical-requirements.md
  - src/agents/reviewer/infra-reviewer/critical-reminders.md
standards_docs:
  - CLAUDE.md
date: 2026-03-27
reporting_agent: agent-summoner
category: architecture
domain: shared
root_cause: convention-undocumented
---

## What Was Wrong

CLAUDE.md requires that sub-agents write findings to `.ai-docs/agent-findings/` when they discover anti-patterns, missing standards, or convention drift. The `ai-reviewer` agent was missing this instruction. Upon checking, `cli-reviewer` and `infra-reviewer` also lack this instruction in their critical-requirements, critical-reminders, and workflow files.

## Fix Applied

Added the findings capture instruction to `ai-reviewer`'s critical-requirements.md, critical-reminders.md, and workflow.md. The other reviewer agents (`cli-reviewer`, `infra-reviewer`) still need the same fix.

## Proposed Standard

All reviewer agents should include `**(You MUST write a finding to '.ai-docs/agent-findings/' when you discover an anti-pattern, missing standard, or convention drift)**` in their critical-requirements.md and critical-reminders.md files. This should be part of the standard reviewer agent template.
