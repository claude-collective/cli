# Agents Inc. CLI - Task Tracking

> **Agent Compliance Tests**: See [docs/standards/content/agent-compliance-bible.md](./docs/standards/content/agent-compliance-bible.md)
> Run these 30 tests periodically to verify agent alignment.
> For architecture details, see [docs/reference/architecture.md](./docs/reference/architecture.md).

## Current Focus

Phase 7B complete. Ready for user testing.

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).

---

## Blockers

_None currently. Add serious blockers here immediately when discovered._

---

## Reminders for Agents

### R1: Use Specialized Agents

- **CLI Developer** (`cli-developer`) - All refators and features
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

---

## Active Tasks

### CLI UX Improvements (Phase 8)

See [docs/reference/architecture.md](./docs/reference/architecture.md) for system architecture.
Completed tasks archived in [TODO-completed.md](./TODO-completed.md).

#### U13: Run Documentor Agent on CLI Codebase

Use the `documentor` sub-agent to create AI-focused documentation that helps other agents understand where and how to implement features. The documentor should work incrementally and track progress over time.

**What to document:**

- Component structure and patterns
- State management patterns (Zustand)
- Testing patterns and conventions
- CLI command structure
- Wizard flow and navigation
- Key utilities and helpers

**Output:** Documentation in `docs/` directory

---

#### U15: Add Comprehensive Help Overlay

Add a comprehensive help section/overlay accessible via `?` key to show users how to get the most out of the CLI:

**Content to include:**

- Keyboard shortcuts (expand on existing help modal)
- Navigation patterns
- Tips for wizard flow
- Common workflows (init, edit, compile, update)
- Source management tips
- Expert mode features

**Implementation:**

- Expand existing `help-modal.tsx` with more comprehensive content
- Add context-sensitive help (different content per step)
- Include examples and tips
- Make it easy to discover (`?` key always visible)

**Files:** `src/cli/components/wizard/help-modal.tsx`

---

#### D-05: Improve `agentsinc init` Behavior When Already Initialized

When `agentsinc init` is run in a project that's already initialized, instead of just warning and suggesting `agentsinc edit`, show the edit screen directly (same as running `agentsinc edit`).

**Simplified scope:** Just redirect to the edit flow when already initialized.

**Files:** `src/cli/commands/init.tsx`

---

#### D-16: Init Should Populate Config Options with Defaults

When `agentsinc init` creates `.claude-src/config.yaml`, include commented-out default values for discoverable config options (source, marketplace, agents_source). Path overrides are already included -- this extends to the remaining config options.

**Files:** `src/cli/lib/installation/local-installer.ts` (writeConfigFile function)

---

#### R-1: Consolidate Agent-Skill Mappings into YAML

The hardcoded `SKILL_TO_AGENTS` and `AGENT_SKILL_PREFIXES` in `src/cli/lib/skills/skill-agent-mappings.ts` should be fully driven by `src/cli/defaults/agent-mappings.yaml`:

1. Add `agent_skill_prefixes` section to `agent-mappings.yaml`
2. Remove the hardcoded `SKILL_TO_AGENTS` constant (the YAML already has the same data; keep only as inline fallback if YAML fails to load)
3. Load `AGENT_SKILL_PREFIXES` from YAML via `getCachedDefaults()`
4. Update `skill-agent-mappings.test.ts` to test the YAML-loaded values rather than re-asserting hardcoded constants
5. Move the `availableSkills` test array to `__tests__/test-constants.ts` or generate from matrix

---

#### H18: Tailor Documentation-Bible and Documentor Agent to This CLI Repo

Adapt the existing documentation-bible and documentor agent to be tailor-made for this CLI repository. This is **surgical precision work** — NOT a rewrite from scratch.

**CRITICAL: Surgical Approach**

- Do NOT randomly remove sections from existing files
- Every single change must be justified (wrong project context, outdated info, missing CLI-specific guidance)
- Read the FULL existing content before making ANY changes
- Preserve any sections that are technology-agnostic and still useful
- Add CLI-specific sections alongside existing content where possible
- The goal is ADAPTATION to this repo, not replacement

**Phase 1: Surgically adapt documentation-bible.md**

The current `docs/standards/content/documentation-bible.md` contains some content from a different project (web app with MobX). Adapt it:

1. **KEEP** any universal documentation principles (structure, tone, formatting guidelines)
2. **REPLACE** only project-specific references (MobX → Zustand, web app patterns → CLI patterns)
3. **ADD** CLI-specific documentation categories:
   - Command Patterns (oclif structure, flags, interactive modes)
   - Wizard Flow (Ink components, Zustand state, step navigation)
   - Agent/Skill Compilation (pipeline, Liquid templates, plugins)
   - Test Infrastructure (helpers, fixtures, factories)
   - Type System (branded types, template literals, boundary casts)
   - Configuration (config loading, multi-source support)
   - Ink UI Patterns (components, useInput, scroll management)

**Phase 2: Surgically update documentor agent**

In `src/agents/meta/documentor/workflow.md`:

- Add a reference to `docs/standards/content/documentation-bible.md` in the documentation philosophy section
- Add CLI-specific patterns to the templates section
- Do NOT remove existing workflow steps — only add CLI context where needed

**Phase 3: Run documentor agent to generate docs**

Create `.claude/docs/` directory structure with:

- `DOCUMENTATION_MAP.md` - Master index tracking coverage
- `command-patterns.md` - oclif command conventions
- `wizard-architecture.md` - Wizard flow, state management
- `compilation-system.md` - Agent/skill compilation pipeline
- `test-patterns.md` - Test infrastructure and fixtures
- `type-system.md` - Type conventions and branded types

**Success criteria:**

- documentation-bible.md retains universal principles + gains CLI-specific guidance
- No sections removed without explicit justification in a comment
- Documentor agent workflow references the Bible without losing existing steps
- `.claude/docs/` directory exists with 5+ documentation files
- Documentation helps agents answer "where is X?" and "how does Y work?"

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
