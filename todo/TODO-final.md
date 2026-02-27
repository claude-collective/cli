# Agents Inc. CLI - Final TODO

These are the remaining tasks to complete for the CLI.

| ID             | Task                                          | Status  |
| -------------- | --------------------------------------------- | ------- |
| WUX-3          | Visually verify wizard UX changes             | Pending |
| U-UI-ITERATION | Wizard UI polish pass                         | Pending |
| #2             | Add proper documentation                      | Pending |
| #1             | Create proper Work web stack                  | Pending |
| U15            | Add comprehensive help overlay                | Pending |
| D-65           | Task confidence scoring for agent invocations | Pending |

---

## WUX-3: Visually Verify Wizard UX Changes

The agents reported success on wizard UX changes but visual verification is needed. Manually verify:

- No icons in skill tags
- No colored borders on unfocused tags
- Stable skill order
- Proper tag wrapping on narrow terminals

**Action:** Manual testing with `agentsinc init` or `agentsinc edit` in an 80-column terminal.

---

## U-UI-ITERATION: Wizard UI Polish Pass

Iterate over the full wizard UI to improve visual consistency, spacing, and clarity across all steps (Stack, Build, Sources, Confirm). Review column widths, alignment, color usage, empty states, and overall visual hierarchy.

**Files:** `src/cli/components/wizard/`

---

## #2: Add Proper Documentation

Create comprehensive documentation covering the project structure, usage patterns, configuration options, and development guidelines. This should help developers understand and contribute to the project effectively.

---

## #1: Create Proper Work Web Stack

Build a comprehensive web stack configuration for work-related projects. This should include all necessary tooling, frameworks, and configurations needed for professional web development.

---

## U15: Add Comprehensive Help Overlay (also UX-08)

Add a comprehensive help section/overlay accessible via `?` key to show users how to get the most out of the CLI. This consolidates the deferred UX-08 (keyboard shortcuts help overlay) task.

- Keyboard shortcuts (expand on existing help modal)
- Navigation patterns
- Tips for wizard flow
- Common workflows (init, edit, compile, update)
- Source management tips
- Expert mode features
- Context-sensitive help (different content per step)
- In-wizard help for keybindings (from UX-08)

**Files:** `src/cli/components/wizard/help-modal.tsx`

---

## D-65: Task Confidence Scoring for Agent Invocations

Each task delegated to a subagent should report a confidence value indicating whether it had enough context and clarity to complete the work properly. This catches under-specified tasks early rather than discovering incomplete work after the fact.

**What this means:**

- When a subagent finishes a task, it reports a confidence level (e.g., high/medium/low or a numeric score)
- Low confidence = the task description was ambiguous, key files were missing, the implementation plan was incomplete, or assumptions had to be made
- High confidence = clear spec, all files identified, straightforward execution

**Possible implementations:**

- Structured output from subagents: require a `confidence` field in the result
- Pre-commit hook that checks whether all tasks in the PR tracking file have confidence annotations
- A validation step in the PR workflow that flags tasks without confidence scores
- Could be enforced via CLAUDE.md rules for subagent delegation patterns

**Open questions:**

- Should this be a property of the subagent prompt template (baked into how agents report results)?
- Or a separate validation pass (like a pre-commit hook that parses PR tracking files)?
- What's the right granularity: per-task, per-commit, or per-PR?
