---
type: convention-drift
severity: low
affected_files:
  - src/agents/tester/api-tester/workflow.md
  - src/agents/reviewer/ai-reviewer/workflow.md
  - src/agents/reviewer/infra-reviewer/workflow.md
  - src/agents/developer/ai-developer/intro.md
  - src/agents/developer/ai-developer/workflow.md
standards_docs: []
date: 2026-03-27
reporting_agent: agent-summoner
category: architecture
domain: shared
root_cause: convention-undocumented
---

## What Was Wrong

Three of the five new agents (api-tester, ai-reviewer, infra-reviewer) used ASCII `->` in self-correction triggers, while the convention established by reference agents (cli-developer, cli-tester, web-reviewer, web-pm) is Unicode `→`. Conversely, ai-developer used Unicode `→` in defer-to lists (intro.md and domain_scope), while the convention is ASCII `->`.

The arrow convention is:

- Self-correction triggers: `**pattern** → STOP.` (Unicode right arrow)
- Domain scope defer-to lists: `Component code -> web-developer` (ASCII arrow)
- Retrieval strategy examples: `Glob(...) -> Find files` (ASCII arrow)

## Fix Applied

Standardized all 5 new agents:

- Converted 30+ self-correction trigger arrows from `->` to `→` across api-tester, ai-reviewer, and infra-reviewer
- Converted 7 defer-to list arrows from `→` to `->` in ai-developer intro.md and workflow.md

## Proposed Standard

Document the arrow convention explicitly in agent creation documentation: "Use Unicode `→` in self-correction trigger lines. Use ASCII `->` in defer-to lists, retrieval strategy examples, and general prose."
