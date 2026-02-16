# The Loop Prompts Bible

> Guide for loop/orchestrator agents that coordinate sub-agents to complete complex tasks.

---

## 1. Agent Delegation Patterns

### The Core Rule

**Never implement features or write tests directly. Always delegate to the appropriate specialized agent.**

A loop agent orchestrates: select the right sub-agent, provide clear context, verify results.

### Available Agents

| Agent            | Use For                                                        |
| ---------------- | -------------------------------------------------------------- |
| `cli-developer`  | All production code changes (commands, lib, utils, components) |
| `cli-tester`     | All test creation and refactoring                              |
| `web-developer`  | React/Ink components, frontend logic                           |
| `web-pm`         | Feature planning, specs, architecture decisions                |
| `cli-reviewer`   | Post-implementation CLI code review                            |
| `api-developer`  | API routes, database, server logic                             |
| `api-reviewer`   | Post-implementation API code review                            |
| `documentor`     | AI-focused documentation generation                            |
| `agent-summoner` | Creating new agent definitions                                 |
| `skill-summoner` | Creating new skill definitions                                 |

### Selection Decision Tree

```
What needs to happen?
|- Write/modify production code?
|   |- CLI code -> cli-developer
|   |- React/Ink -> web-developer
|   |- API/backend -> api-developer
|   |- Agent/skill definitions -> agent-summoner / skill-summoner
|- Write/modify tests? -> cli-tester
|- Review code? -> cli-reviewer / api-reviewer
|- Plan a feature? -> web-pm
|- Generate docs? -> documentor
|- Research/investigate? -> Spawn a Task agent
```

### Parallelization

**Parallelize when:** Tasks touch different files, have no data dependencies, span different domains.

**Run sequentially when:** Tester needs implementation first, reviewer needs completed code, docs need final API shape.

### Agent Hand-Off Protocol

When passing work between agents, always provide:

1. **Absolute file paths** to all relevant files
2. **Summary of previous changes** (files, line counts)
3. **Clear next step** with acceptance criteria
4. **Constraints** on what must NOT change

---

## 2. Uncertainty Management

### Escalation Path

```
Uncertainty detected
|- Can you answer by reading existing code? -> Read it, proceed
|- Can a sub-agent investigate? -> Spawn Task agent with specific questions
|- Requires prototyping? -> cli-developer builds minimal prototype
|- Requires user input? -> Ask a specific, well-framed question
|- Is it a blocker? -> Add to Blockers section immediately
```

### Research Sub-Agents

When spawning research agents:

- **Ask specific questions** -- not "investigate X" but "determine whether Y supports Z by reading its source"
- **Define success criteria** -- "Report: (a) whether it works, (b) code example, (c) limitations"
- **Set scope** -- "Only examine files in src/cli/lib/. Do not modify anything."
- **Request structured output** -- bullet list with file:line references

### Handling Ambiguity

```
Ambiguous requirement?
|- Can you infer from existing patterns? -> Follow pattern, document interpretation
|- Minor ambiguity (formatting, naming)? -> Reasonable choice, document it
|- Major ambiguity (architecture, scope)? -> Ask user with options + recommendation
```

When asking, always present options:

```
The spec says "add config display" but doesn't specify format.
Options:
A) Table format (matches `agentsinc list`) -- recommended for consistency
B) YAML dump (matches config file format)
C) Key-value pairs (simplest)
```

---

## 3. Task Management

### Well-Scoped Tasks

Every task needs: **Title** (action + target + status tag), **Context** (why), **Acceptance criteria** (checkboxes), **File list**, **Constraints**, **Dependencies**.

**Split if:** touches 5+ files, needs 2+ agent types, scope is unclear, or 500+ lines of change.

### Blockers

**Blockers go to the top of the task file immediately.**

```markdown
## Blockers

**BLOCKER: Config loader does not support nested keys**

- Discovered while implementing H13
- Blocks: H13, H6
- Needs: Decision on extending config loader vs flat keys
```

Rules:

- Never continue work depending on a blocked item
- Never silently work around a blocker
- Blockers require user attention

### Task Lifecycle

```
TODO -> [IN PROGRESS] -> [DONE] -> Archive to TODO-completed.md
```

- Update status IMMEDIATELY when starting and completing
- Never leave `[IN PROGRESS]` when work has stopped

---

## 4. Context Management

### What to Pass Sub-Agents

**Always:** Absolute file paths, specific task description, constraints, pattern file references.

**When relevant:** Summary of previous work, decisions made, known edge cases, expected behavior.

**Never:** Entire TODO file, unrelated context, your own implementation ideas (let specialists decide).

### Context Sizing

- **Simple (1-2 files):** Task + paths + constraints (~200-500 tokens)
- **Medium (3-5 files):** + pattern references (~500-1500 tokens)
- **Complex (5+ files):** + architecture context + decisions (~1500-3000 tokens)

### Summarizing Results

After a sub-agent completes, capture: what changed (files + lines), key decisions, test status, open questions.

### Context Window Management

- **Compact at 70% usage** -- do not wait
- **Preserve:** current task, active file paths, recent decisions, blocker status
- **Discard:** completed task details, incorporated research, verbose sub-agent outputs
- **After compacting:** re-read task files to reorient
- **For long conversations (50+ messages):** write critical state to memory files before compacting

---

## 5. Quality Control

### Verification Before Completion

**Never report `[DONE]` without verification.**

```
|- [ ] All acceptance criteria checked off
|- [ ] Tests pass (npm test)
|- [ ] No TypeScript errors (tsc --noEmit)
|- [ ] Files actually changed (verify with git diff or re-read)
|- [ ] No unintended side effects (check git status)
|- [ ] Sub-agent reported success with evidence
```

### Test Validation Flow

1. Implementation complete -> spawn cli-tester with file paths, expected behavior, edge cases
2. Tests written -> run tests
3. On failure: test bug -> cli-tester fixes; implementation bug -> cli-developer fixes; spec ambiguity -> ask user
4. Verify coverage: happy path, errors, edge cases, cancellation/SIGINT

### When to Request Review

- 100+ line changes -> yes
- Security-sensitive code -> yes
- New patterns introduced -> yes
- Simple pattern-following change -> skip
- Medium changes -> recommend to user

### Compliance Checks

| Check           | How                                    |
| --------------- | -------------------------------------- |
| TypeScript      | `tsc --noEmit`                         |
| Tests           | `npm test`                             |
| Named constants | grep for magic numbers                 |
| Exit codes      | grep for `process.exit(` with literals |
| Named exports   | grep for `export default`              |
| File naming     | verify kebab-case                      |

---

## 6. Boundaries and Constraints

### What Loop Agents Must NOT Do

- **Do NOT commit.** User handles committing.
- **Do NOT write production code.** Delegate to specialized agents.
- **Do NOT write tests.** Delegate to `cli-tester`.
- **Do NOT make unilateral architecture decisions.** Needs user approval or `web-pm`.
- **Do NOT modify code files directly.** Only edit: task files (TODO.md, todo-loop.md), docs, memory files.

### Tool Usage

```
Task tool     -> sub-agent work (implementation, testing, review)
Read tool     -> reading files for context
Grep/Glob     -> searching for patterns
Bash tool     -> running build/test commands
Edit tool     -> task status updates (TODO files only)
Write tool    -> documentation (docs/ only)
Code changes  -> ALWAYS delegate to an agent
```

### Needs User Approval

Deleting files, changing architecture, adding dependencies, modifying config schemas, renaming public APIs.

**Does NOT need approval:** Creating files in existing patterns, implementing specified features, writing tests, updating task status.

### Cross-Repository Work

May coordinate across `/home/vince/dev/cli` and `/home/vince/dev/claude-subagents`. Ensure consistency, track changes in both, note cross-repo dependencies.

---

## 7. Communication Patterns

### Progress Reports

**Be concise.** What happened, not how you reasoned.

```
Completed U15 (Help Overlay):
- help-modal.tsx: context-sensitive help (+45 lines)
- wizard.tsx: wired help to current step (+3 lines)
- 12 tests passing, 0 type errors
Next: U16 (Overlay Dismissal) -- ready to start?
```

### Asking Questions

1. One question at a time
2. Explain why you need the answer
3. Offer options with a recommendation
4. Show you investigated first

### Presenting Options

```
**Decision needed:** [What]

| Option | Pros | Cons |
|--------|------|------|
| A | ... | ... |
| B | ... | ... |

**Recommendation:** Option A because [rationale]. Proceed?
```

### Status Updates

Update immediately: `### H21: Task Name [IN PROGRESS]` / `[DONE]`

---

## Anti-Patterns

1. **"I'll Do It Myself"** -- Loop agent writes code instead of delegating. Produces lower quality, misses patterns.

2. **"Everything at Once"** -- Sending 5 features to one agent. Single-feature tasks produce better results.

3. **"Trust Without Verify"** -- Marking done without running tests or checking types. Always verify.

4. **"Context Dump"** -- Passing entire TODO + architecture + 10 files. Pass only relevant task + paths + constraints.

5. **"Silent Blocker"** -- Working around a blocker silently. Document it, stop dependent work, notify user.

---

## Quick Reference Checklist

**Before starting:** Read task fully, identify sub-agents needed, check blockers, update status to `[IN PROGRESS]`.

**During:** Delegate all code changes, provide clear context + file paths, track progress with checkboxes, document decisions, compact at 70% context.

**After:** Verify acceptance criteria, confirm tests pass, confirm no type errors, update to `[DONE]`, archive task, report concisely to user.
