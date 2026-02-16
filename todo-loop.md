# Loop Agent Tasks — Fully Independent

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

### R9: Have at most 5 subagents active at a time

### R10: Do not stage, stash or commit any changes

### R11: Always compact when the main claude instance reaches 60% context

---

### P1: Update GitHub URLs from claude-collective to agents-inc ✅

Priority: HIGH — **DONE**

Updated all `claude-collective` GitHub references across the codebase to `agents-inc`. This included:

- `SCHEMA_BASE_URL` in `src/cli/consts.ts`
- `DEFAULT_SOURCE` in `src/cli/lib/configuration/config.ts`
- All 17 agent YAML `$schema` comments in `src/agents/`
- `output-format.md` in skill-summoner
- `source-loader.ts` JSDoc comments
- Test files: `config.test.ts`, `multi-source-loader.test.ts`, `step-settings.test.ts`

### R-1: Consolidate agent-skill mappings into YAML

The hardcoded `SKILL_TO_AGENTS` and `AGENT_SKILL_PREFIXES` in `src/cli/lib/skills/skill-agent-mappings.ts` should be fully driven by `src/cli/defaults/agent-mappings.yaml`:

1. Add `agent_skill_prefixes` section to `agent-mappings.yaml`
2. Remove the hardcoded `SKILL_TO_AGENTS` constant (the YAML already has the same data; keep only as inline fallback if YAML fails to load)
3. Load `AGENT_SKILL_PREFIXES` from YAML via `getCachedDefaults()`
4. Update `skill-agent-mappings.test.ts` to test the YAML-loaded values rather than re-asserting hardcoded constants
5. Move the `availableSkills` test array to `__tests__/test-constants.ts` or generate from matrix

---

## Final Task (Run Last)

### H18: Tailor documentation-bible and documentor agent to this CLI repo

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

## Summary

- **Total Remaining Tasks:** 3
- **High Priority:** 1 (P1)
- **Refactoring:** 1 (R-1)
- **Documentation:** 1 (H18)
- **Completed tasks moved to:** [TODO-completed.md](./TODO-completed.md)
