---
type: standard-gap
severity: high
affected_files:
  - .claude-src/config.ts
  - src/agents/developer/ai-developer/workflow.md
  - src/agents/developer/ai-developer/critical-requirements.md
  - src/agents/developer/ai-developer/critical-reminders.md
standards_docs:
  - CLAUDE.md
date: 2026-03-27
reporting_agent: agent-summoner
category: architecture
domain: shared
root_cause: convention-undocumented
---

## What Was Wrong

Three issues discovered during ai-developer agent review (improvement pass 2-5):

1. **Missing config entry:** The `ai-developer` agent is not listed in `.claude-src/config.ts` agents array or stack mapping. This means it will not compile when `agentsinc compile` is run. All other agents in `src/agents/` that are intended to be compiled have entries in config.ts.

2. **Stale file references:** workflow.md referenced `@.claude/skills/testing/SKILL.md` (a path that doesn't exist in this project) and hardcoded `.claude/conventions.md`, `.claude/patterns.md`, `.claude/progress.md` paths. These are leftover template paths from the agent creation template.

3. **Missing findings capture instruction:** Neither critical-requirements.md nor critical-reminders.md included the CLAUDE.md-mandated rule about writing findings to `.ai-docs/agent-findings/`. This applies to all developer agents -- the cli-developer has the same gap.

## Fix Applied

- Fixed items 2 and 3: Removed stale testing skill reference, replaced hardcoded `.claude/` paths with generic project convention references, added findings capture MUST rule to both critical-requirements.md and critical-reminders.md.
- Item 1 (missing config entry): Discovery only -- requires user decision on whether ai-developer should be added to the active config.

## Proposed Standard

- **Agent onboarding checklist:** When creating a new agent in `src/agents/`, the agent MUST be added to `.claude-src/config.ts` agents array and stack mapping, or explicitly documented as "not yet compiled" in a TODO.
- **Findings capture rule:** All developer-category agents should include the `.ai-docs/agent-findings/` instruction in their critical-requirements. Audit cli-developer, api-developer, and web-developer for the same gap.
- **Template path audit:** After creating agents from templates, grep for `.claude/conventions.md`, `.claude/patterns.md`, `.claude/skills/testing/SKILL.md` and replace with project-appropriate references.
