---
type: convention-drift
severity: low
affected_files:
  - src/agents/planning/api-pm/workflow.md
  - src/agents/planning/api-pm/output-format.md
standards_docs: []
date: 2026-03-27
reporting_agent: agent-summoner
category: architecture
domain: shared
root_cause: convention-undocumented
---

## What Was Wrong

The api-pm agent used ASCII arrows (`->`) in self-correction triggers and output-format templates, while the reference agent web-pm uses Unicode arrows (`→`) in the same positions. This inconsistency makes the agents look like they were authored with different conventions.

## Fix Applied

Standardized api-pm to use `→` in self-correction triggers and output-format question template, matching web-pm's convention.

## Proposed Standard

Document in the agent architecture bible or a shared convention file: "Use Unicode right arrow `→` in self-correction triggers (`**pattern** → Stop.`) and output format templates. Use ASCII `->` in domain_scope defer-to lists (`Implementation -> web-developer`)." This ensures all agents use consistent formatting.
