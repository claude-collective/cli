---
type: convention-drift
severity: medium
affected_files:
  - src/agents/reviewer/infra-reviewer/intro.md
  - src/agents/reviewer/infra-reviewer/workflow.md
standards_docs:
  - .ai-docs/DOCUMENTATION_MAP.md
date: 2026-03-27
reporting_agent: agent-summoner
category: architecture
domain: infra
root_cause: convention-undocumented
---

## What Was Wrong

The infra-reviewer agent had a custom `<core_principles>` block in `intro.md` containing 5 domain-specific review principles and a self-reminder instruction. The agent template (`agent.liquid`) automatically adds the standard `<core_principles>` section (with the 5 universal principles and self-reminder loop) to every compiled agent. Having a custom `<core_principles>` in `intro.md` creates either double-wrapping (two `<core_principles>` sections in compiled output) or confusion about which principles the agent should follow.

The domain-specific principles (Security is Non-Negotiable, Evidence-Based Findings, Severity Accuracy, Stay in Your Lane) are valuable review guidance but should not use the `<core_principles>` tag, which is reserved for the universal 5 principles injected by the template.

## Fix Applied

1. Removed `<core_principles>` block from `intro.md`
2. Moved the 4 domain-specific principles to `workflow.md` under a "Review Principles" section (without XML wrapper, since these are domain guidance not the template's core principles)
3. Dropped "Investigation First" from the domain list since it is already covered by the universal core principles

## Proposed Standard

Add to agent creation documentation: "NEVER add `<core_principles>` tags in agent source files (intro.md, workflow.md, etc.) -- the template automatically injects the standard core principles. Domain-specific guiding principles should use a descriptive section name like 'Review Principles' or 'Design Principles' without XML wrapper tags that conflict with template-injected sections."
