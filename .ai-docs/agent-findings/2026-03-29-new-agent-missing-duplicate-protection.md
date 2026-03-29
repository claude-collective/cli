---
type: standard-gap
severity: medium
affected_files:
  - src/cli/commands/new/agent.tsx
standards_docs:
  - src/cli/commands/new/skill.tsx
date: 2026-03-29
reporting_agent: cli-tester
category: architecture
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

The `new:agent` command (`src/cli/commands/new/agent.tsx`) is missing two features that `new:skill` already implements:

1. **No duplicate agent checking** -- Creating an agent that already exists proceeds without warning. The `new:skill` command checks if the skill directory exists and errors with `EXIT_CODES.ERROR` unless `--force` is provided.

2. **No `--force` flag** -- There is no way to explicitly overwrite an existing agent. The `new:skill` command has this flag (`Flags.boolean({ char: 'f', ... })`).

3. **No installation check** -- The command does not verify that an installation exists before proceeding. It relies on `ensureClaudeCliAvailable()` as its first gate, then `loadMetaAgent()`. In a fresh project with `claude` CLI installed but no compiled agents, the error message is "Agent 'agent-summoner' not found" with advice to run `compile` first -- but `compile` also requires an initialized project. The error chain is confusing for new users.

## Fix Applied

None -- discovery only. Tests were added documenting current behavior:

- Test that the command fails with `agent-summoner` not found error
- Test that `--force` is rejected as an unknown flag
- Test that behavior is the same with and without `.claude-src/`

## Proposed Standard

Add to `src/cli/commands/new/agent.tsx`:

1. Add `--force` flag matching `new:skill`'s implementation
2. Add duplicate agent directory check (look in `CLAUDE_DIR/agents/_custom/<name>/`) before invoking `claude` CLI
3. Consider adding an installation existence check early in `run()` that produces a clear "run init first" message, similar to how other commands handle this
