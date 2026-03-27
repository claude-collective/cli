---
type: convention-drift
severity: medium
affected_files:
  - src/agents/tester/api-tester/intro.md
  - src/agents/tester/api-tester/critical-reminders.md
  - src/agents/tester/api-tester/critical-requirements.md
standards_docs:
  - .ai-docs/standards/prompt-bible.md
date: 2026-03-27
reporting_agent: agent-summoner
category: architecture
domain: shared
root_cause: convention-undocumented
---

## What Was Wrong

Three issues found in the api-tester agent source files:

1. **Template-injected content duplicated in source files.** `intro.md` contained a `<core_principles>` block and `critical-reminders.md` contained `<write_verification_protocol>`, "DISPLAY ALL 5 CORE PRINCIPLES...", and "ALWAYS RE-READ FILES..." lines. The agent template (`agent.liquid`) injects all of these automatically. Including them in source files causes double-rendering in compiled output. The reference agent (cli-tester) correctly omits all of these from its source files.

2. **Missing findings capture instruction.** CLAUDE.md mandates: "ALWAYS tell sub-agents: If you fix an anti-pattern or discover a missing standard, write a finding to `.ai-docs/agent-findings/`". Neither api-tester nor cli-tester had this instruction in their critical-requirements or critical-reminders.

3. **Missing git safety self-correction trigger.** CLAUDE.md prohibits git commands that modify staging/working tree. The api-tester had no self-correction checkpoint for this, unlike implementation agents that already have this guard.

## Fix Applied

1. Removed `<core_principles>` block from `intro.md`.
2. Removed `<write_verification_protocol>`, self-reminder loop closers from `critical-reminders.md`.
3. Added findings capture instruction to both `critical-requirements.md` and `critical-reminders.md`.
4. Added git safety self-correction trigger to `workflow.md`.
5. Added git safety note to domain scope "DON'T handle" list.
6. Added missing `import request from "supertest"` to first workflow code example.

## Proposed Standard

New agents created by agent-summoner should always:

- Include the findings capture MUST rule in both critical-requirements.md and critical-reminders.md
- Include a git safety self-correction trigger in workflow.md for any agent that has Bash tool access
- Never include `<core_principles>`, `<write_verification_protocol>`, or self-reminder loop closers in source files (these are template-injected)

The cli-tester agent should also receive the findings capture instruction and git safety trigger in a subsequent improvement pass.
