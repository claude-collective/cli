## Reminders for Agents

### R1: Use Specialized Agents

- **CLI Developer** (`cli-developer`) - All refactors and features
- **CLI Tester** (`cli-tester`) - All test writing
- **Web Developer** (`web-developer`) - All react code

Do NOT implement features or write tests directly. Always delegate to the appropriate agent.

### R2: Handle Uncertainties

When encountering unknowns or uncertainties:

1. Spawn research subagents to investigate
2. Use CLI Developer to prototype if needed
3. **Create TODO tasks in this file** with findings
4. Document decisions in appropriate docs/ file

### R3: Blockers Go to Top

If a serious blocker is discovered, add it to the **Blockers** section at the top of this file immediately. Do not continue work that depends on the blocked item.

### R4: Do NOT Commit

**Keep all changes uncommitted.** The user will handle committing when ready.

### R5: Move Completed Tasks to Archive

Once a task is done, move it to [TODO-completed.md](./TODO-completed.md).

### R6: Update Task Status

When starting a task: `[IN PROGRESS]`. When completing: `[DONE]`.

**IMPORTANT:** Sub-agents MUST update this TODO.md file when starting and completing subtasks.

### R7: Compact at 70% Context

When context usage reaches 70%, run `/compact`.

### R8: Cross-Repository Changes Allowed

You may make changes in the claude-subagents directory (`/home/vince/dev/claude-subagents`) as well, if needed. This is the source marketplace for skills and agents.

### R9: Max 4 Concurrent Subagents

Always have at most 4 subagents running at the same time. Compact when main claude instance reaches 60% context usage.

### R10: Code Flow Quality

Always test for code flow. Code should flow naturally and in a logical sequence.

---

## Blockers

(none)

---

## All Tasks Completed

All night session tasks (80+) have been moved to [TODO-completed.md](./TODO-completed.md) under "Moved from TODO-night.md (2026-02-16)".

**Iterations covered:** 4-9
**Research agents:** a800b70, a270ca3, a8e974d, a7d237b, ac66e12, ab369bc, acf47f6, ab98ab7, a8a233b, a56412b, aa18e4c, ac0c15a, a129a25
**Tests added:** 233+
**Zero regressions, zero type errors**
