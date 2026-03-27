---
type: standard-gap
severity: medium
affected_files:
  - src/agents/planning/api-pm/workflow.md
  - src/agents/planning/web-pm/workflow.md
standards_docs:
  - CLAUDE.md
date: 2026-03-27
reporting_agent: agent-summoner
category: architecture
domain: api
root_cause: rule-not-visible
---

## What Was Wrong

The api-pm agent's workflow.md did not include instructions to propagate the findings capture requirement to downstream agents (api-developer, api-tester, api-reviewer). CLAUDE.md requires: "ALWAYS write a finding to `.ai-docs/agent-findings/` when a sub-agent fixes an anti-pattern, discovers a missing standard, or notices convention drift." Planning agents coordinate downstream agents and should relay this instruction.

Note: web-pm has the same gap -- it also lacks findings capture instructions.

## Fix Applied

Added a "Findings capture" paragraph to the "Coordination with Claude Code" section in api-pm's workflow.md, instructing the agent to tell downstream agents to write findings.

## Proposed Standard

All planning agents (web-pm, api-pm) should include a findings capture instruction in their coordination/handoff section. Consider adding to a planning-agent template or to the category-level workflow conventions. The instruction text:

> When delegating to downstream agents, instruct them: "If you fix an anti-pattern or discover a missing standard, write a finding to `.ai-docs/agent-findings/` using the template in `.ai-docs/agent-findings/TEMPLATE.md`."
