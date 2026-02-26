# Agents Inc. CLI - Deferred Tasks

| ID    | Task                                                                                                                               | Status                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| D-28  | Fix startup warning/error messages (see [plan](./D-28-fix-startup-messages.md))                                                    | Refined                        |
| D-05  | Project dashboard — default command + already-initialized (see [plan](./D-05-improve-init-existing.md))                            | Ready for Dev                  |
| P4-17 | `agentsinc new` supports multiple items (see [plan](./P4-17-new-multiple-items.md))                                                | Refined                        |
| P4-18 | Test: multiple skill/agent creation (depends on P4-17)                                                                             | Deferred                       |
| D-01  | Update skill documentation conventions                                                                                             | Needs Assistance               |
| D-11  | Development hooks for type checking                                                                                                | Needs Assistance               |
| D-12  | ~~Eject full agents from custom sources~~ — scrapped; agents are compiled, not plugins to be ejected                               | Deleted                        |
| D-13  | Eject skills by domain/category (see [plan](./D-13-eject-skills-filtered.md))                                                      | Refined                        |
| D-18  | Template system documentation improvements                                                                                         | Trivial (no refinement needed) |
| D-19  | Improve template error messages (see [plan](./D-19-template-error-messages.md))                                                    | Deferred — nice to have        |
| D-20  | Add Edit tool to documentor agent                                                                                                  | Trivial (no refinement needed) |
| D-22  | ~~Automated agent-tester~~ — scrapped; existing validation should be made stricter over time instead                               | Deleted                        |
| D-24  | ~~Configurable documentation file locations~~ — convention-only, no code needed (see [plan](./D-24-configurable-doc-locations.md)) | Closed                         |
| D-14  | Import skills from third-party marketplaces                                                                                        | Needs Assistance               |
| UX-04 | Interactive skill search polish                                                                                                    | Needs Assistance               |
| UX-05 | Refine step - skills.sh integration                                                                                                | Needs Assistance               |
| UX-06 | Search with color highlighting                                                                                                     | Needs Assistance               |
| UX-07 | Incompatibility tooltips                                                                                                           | Needs Assistance               |
| UX-09 | Animations/transitions                                                                                                             | Needs Assistance               |
| #5    | Agents command for skill assignment                                                                                                | Needs Assistance               |
| #19   | Sub-agent learning capture system                                                                                                  | Needs Assistance               |
| D-25  | Auto-version check + source staleness (see [plan](./D-25-auto-version-check.md))                                                   | Ready for Dev                  |
| D-26  | Marketplace-specific uninstall (see [plan](./D-26-marketplace-uninstall.md))                                                       | Ready for Dev                  |
| D-08  | User-defined stacks in consumer projects (see [plan](./D-08-user-defined-stacks.md))                                               | Deferred                       |
| D-40  | `agentsinc register` command — absorbed into D-41 (see [plan](./D-40-register-command.md))                                         | Deferred — replaced by D-41    |
| D-47  | Eject standalone compile function (see [plan](./D-47-eject-compile-function.md))                                                   | Deferred — low priority        |

---

## D-28: Fix Startup Warning/Error Messages

**See research doc:** [docs/research/startup-message-persistence.md](../docs/research/startup-message-persistence.md)

The CLI shows warning/error messages and the ASCII logo on startup that flash briefly then disappear. Ink's `clearTerminal` wipes all pre-Ink terminal output because `WizardLayout` uses `height={terminalHeight}`, triggering a full-screen clear on every render cycle.

**Root cause:** Pre-Ink `this.log()` / `warn()` calls print to the terminal, then Ink's first render erases everything via `ansiEscapes.clearTerminal`.

**Planned fix:** Buffer pre-Ink messages and render them via Ink's `<Static>` component (which survives `clearTerminal`).

**Changes needed:**

- `src/cli/commands/init.tsx`, `src/cli/commands/edit.tsx` — buffer messages instead of `this.log()` / `this.warn()`, pass buffer to `<Wizard>`
- `src/cli/components/wizard/wizard-layout.tsx` — add `<Static>` block for startup messages
- `src/cli/utils/logger.ts` + loading modules — support buffered output mode
- Audit which warnings are actionable vs noise; downgrade informational messages to `verbose()`

---

> This file contains deferred tasks moved from [TODO.md](./TODO.md) to keep the main file lean.
> These tasks are not blocked but have been deprioritized for future implementation.

---

## D-05: Improve `agentsinc init` When Already Initialized

**See refinement doc:** [D-05-improve-init-existing.md](./D-05-improve-init-existing.md)

When `agentsinc init` is run in a project that's already initialized, show a summary dashboard (mode, skill count, agent names, config path, source) and suggest next steps (`edit`, `compile`, `doctor`, `list`) instead of a terse warning.

**Recommended approach:** Non-interactive summary (Option A). Single file change in `src/cli/commands/init.tsx` (~40 lines added, ~5 removed). Reuses existing `loadProjectConfig()` and `Installation` type.

**Files:** `src/cli/commands/init.tsx`

---

## Phase 4 Deferred

**M | P4-17 | Feature: `agentsincnew skill/agent` supports multiple items**
Deferred until after migration. Allow creating multiple skills/agents in one command.

**S | P4-18 | Test: Multiple skill/agent creation works**
Depends on P4-17. Test coverage for multi-item creation.

---

## General Deferred Tasks

**M | D-01 | Update skill documentation conventions**
Replace `examples-*.md` files with folder structure. Split examples vs patterns. Namespace files (e.g., `examples/core.md`, `patterns/testing.md`). Update Section 8 of `docs/standards/content/skill-atomicity-bible.md` accordingly.

---

## D-11: Development Hooks for Type Checking

**M | D-11 | Enable hooks to run tsc after changes**

Add configurable development hooks that can run commands like `tsc --noEmit` after file changes. This should:

1. **Be opt-in/configurable** - Users should be able to enable/disable and configure which commands run
2. **Work in this repo by default** - The CLI repo itself should have hooks pre-configured
3. **Support multiple hook types:**
   - Post-edit hooks (after file modifications)
   - Pre-commit hooks (before git commits)
   - On-demand validation

### Implementation Ideas

- Use existing Claude Code hooks system if available
- Add `.claude/hooks.yaml` or similar config file
- Example config:

  ```yaml
  hooks:
    post_edit:
      - command: "bun tsc --noEmit"
        enabled: true
        on_failure: warn # or "block"
    pre_commit:
      - command: "bun run format:check"
        enabled: true
  ```

### Acceptance Criteria

- [ ] Hooks are configurable per-project
- [ ] This repo has tsc hook enabled by default
- [ ] Hook failures can either warn or block the action
- [ ] Easy to disable hooks temporarily (env var or flag)

---

## D-12: Eject Full Agents from Custom Sources

**See refinement doc:** [D-12-eject-full-agents.md](./D-12-eject-full-agents.md)

---

## D-13: Eject Skills by Domain/Category

**S | D-13 | Filter ejected skills by domain or category**

Add `--domain` and `--category` flags to `agentsinceject skills` to selectively eject skills from specific areas instead of all skills.

```bash
# Eject only frontend skills
agentsinc eject skills --domain frontend

# Eject only framework skills across all domains
agentsinc eject skills --category framework

# Combine filters
agentsinc eject skills --domain backend --category api
```

### Implementation Notes

- Use `matrix.categories` to filter skills by their category paths
- Domain = top-level category (e.g., `frontend`, `backend`, `tooling`)
- Category = subcategory (e.g., `framework`, `state-management`, `testing`)
- Skills have `category` field with format `domain/subcategory`

---

## D-18: Template System Documentation Improvements

**S | D-18 | Add inline documentation to agent.liquid template**

From agent architecture research:

1. Add comments in `agent.liquid` explaining each section's variables and purpose
2. Document which variables are required vs optional
3. Document where each variable comes from in the source files
4. Document cascading resolution order in agent-summoner

**S | D-19 | Improve template error messages**
When template compilation fails, show which variables are missing and suggest which source files should be created.

---

## D-20: Agent Tool Consistency

**S | D-20 | Add Edit tool to documentor agent**

The documentor agent has Write but no Edit tool, breaking the pattern where writers have Edit. This is a minor inconsistency to address later.

---

## D-22: Agent Tester - Automated Quality Assurance

**M | D-22 | Create automated agent-tester for quality assurance**

Based on comprehensive testing performed in the Ralph Loop session (TESTER 51+), create an automated agent-tester that validates all agents against agent-summoner standards.

### Test Categories (from Ralph Loop)

1. **prompt-bible Essential Techniques (13 tests)**
   - Self-reminder loop, investigation-first, emphatic repetition
   - XML semantic tags, expansion modifiers, self-correction triggers
   - Post-action reflection, progress tracking, positive framing
   - "Think" alternatives, just-in-time loading, write verification, doc-first ordering

2. **Canonical Agent Structure (7 tests)**
   - Required files: agent.yaml, intro.md, workflow.md, critical-requirements.md, critical-reminders.md, output-format.md, examples.md
   - Template integration, XML nesting, compilation verification

3. **Domain Scope and Boundaries (6 tests)**
   - Handles vs deferrals, agent cross-references, integration documentation

4. **Output Format and Examples Quality (7 tests)**
   - Section alignment, XML tag matching, code blocks, tables, checklists

5. **Tonality and Style (7 tests)**
   - Sentence length, imperative mood, hedging language, specificity, positive framing

6. **Anti-Over-Engineering (6 tests)**
   - Minimal changes rule, scope control, self-correction triggers

7. **Verbosity and Context Constraints (3 tests)**
   - Filler words, redundancy, time estimates removal

8. **Investigation-First Compliance (3 tests)**
   - Enforcement points, self-correction trigger quality

9. **Post-Action Reflection (3 tests)**
   - Structure, integration with workflow

10. **Write Verification (3 tests)**
    - Rule quality, gate conditions

11. **Progress Tracking (3 tests)**
    - Structure, complexity protocol integration

12. **Just-In-Time Loading (3 tests)**
    - Retrieval strategy, tool guidance

13. **Emphatic Repetition (3 tests)**
    - Rule matching, template placement

14. **XML Semantic Tags (3 tests)**
    - Tag inventory, closure verification

15. **Common Mistakes Documentation (3 tests)**
    - Contrast format, coverage alignment

16. **Agent Integration (3 tests)**
    - Cross-references, help-seeking guidance

17. **Extended Reasoning Guidance (3 tests)**
    - Tiered complexity, "think" alternatives

### Implementation Approach

- Create `agent-tester` agent in `src/agents/meta/agent-tester/`
- Use agent-summoner as the validation authority
- Run automated checks via Grep, file comparison, pattern matching
- Generate compliance report with pass/fail per test
- Identify specific line numbers for failures
- Suggest fixes based on patterns from compliant agents

### Acceptance Criteria

- [ ] Runs all 17 test categories against any agent
- [ ] Produces detailed compliance report
- [ ] Identifies specific violations with file:line references
- [ ] Suggests fixes based on prompt-bible and canonical structure
- [ ] Can run incrementally (single category) or full suite
- [ ] Integrates with `agentsinccompile` to validate before compilation

---

## D-24: Configurable Documentation File Locations for Agent Compilation

**See refinement doc:** [D-24-configurable-doc-locations.md](./D-24-configurable-doc-locations.md)

**S | D-24 | Configure documentation file locations in consumer projects**

Agent markdown files reference documentation files by filename only (e.g., `claude-architecture-bible.md`, `prompt-bible.md`, `documentation-bible.md`). Consumer projects can configure where these files live so they can be resolved and included during agent compilation.

### Acceptance Criteria

- [ ] `config.yaml` supports a `documentation` mapping section
- [ ] Compiler resolves doc filenames to configured paths
- [ ] Missing/unconfigured docs are gracefully omitted
- [ ] Existing agent compilation still works without the new config section

---

## D-14: Consume Third-Party Marketplace Skills

**M | D-14 | Command to import skills from third-party marketplaces**

Create a command to download skills from external marketplaces and integrate them into the local skill library using an AI agent (skill summoner).

```bash
# Download and integrate a skill from another marketplace
agentsinc import skill https://example.com/marketplace/my-skill

# Or from a git repo
agentsinc import skill github:someuser/their-skills --skill react-patterns
```

### Workflow

1. **Download**: Fetch the skill from the third-party source
2. **Analyze**: Run skill summoner agent to understand the skill's purpose and patterns
3. **Adapt**: Agent adapts the skill to match local conventions and format
4. **Integrate**: Place adapted skill in `.claude/skills/` or source marketplace
5. **Validate**: Run validation to ensure skill is properly formatted

### Implementation Notes

- Reuse `source-fetcher.ts` for downloading from git sources
- Create new agent: `skill-summoner` or `skill-importer`
- Agent prompt should include:
  - Local skill format/conventions
  - How to extract key patterns from external skill
  - How to handle conflicts with existing skills
- Consider licensing/attribution requirements

---

## CLI UX Backlog

**M | UX-04 | Interactive skill search polish**
Manual testing + tests for interactive search component.

**S | UX-05 | Refine step - skills.sh integration**
Community skill alternatives in Refine step.

**S | UX-06 | Search with color highlighting**
Needs more UX thought.

**S | UX-07 | Incompatibility tooltips**
Show reason when hovering disabled options.

**S | UX-08 | Keyboard shortcuts help overlay**
In-wizard help for keybindings.

**S | UX-09 | Animations/transitions**
Polish pass for step transitions.

**M | UX-13 | Add readable schemas on subagents and skills**

---

**D | #5 | Agents command for skill assignment**
Implement an agents command that allows users to assign specific skills to agents and configure whether those skills should be preloaded or loaded on-demand. This will give users fine-grained control over agent capabilities and performance characteristics.

---

## D-25: Auto-Version Check and Source Staleness

**M | D-25 | CLI version check in wizard header + source staleness TTL**

**See research doc:** [docs/research/auto-version-check.md](../docs/research/auto-version-check.md)

### Feature 1 (primary): CLI version check in wizard header

The main goal is to notify users when a newer CLI version is available. On startup, check the latest published version on npm in the background (non-blocking, so startup is instant). If a newer version exists, display it in the wizard header next to the current version (e.g., `v0.35.0 → v0.36.0 available, will update on restart`).

- **Already installed:** `@oclif/plugin-warn-if-update-available` — its cache at `~/Library/Caches/agents-inc/version` stores `dist-tags` from npm, but the default 60-day timeout is too infrequent
- **Recommended approach:** Read the existing oclif cache file on startup (non-blocking), reduce the check frequency to 1 hour, thread `latestVersion` as a prop through Wizard → WizardLayout → WizardTabs
- **Version display:** Currently at `wizard-tabs.tsx:101-103` as `<Text dimColor>v{version}</Text>`
- **Background check:** The oclif plugin already spawns a detached background process to fetch npm dist-tags — just need to reduce its frequency and read the cached result in the wizard
- **Files:** `src/cli/hooks/init.ts`, `src/cli/commands/init.tsx`, `src/cli/commands/edit.tsx`, `src/cli/components/wizard/wizard.tsx`, `src/cli/components/wizard/wizard-layout.tsx`, `src/cli/components/wizard/wizard-tabs.tsx`

### Feature 2 (secondary): Source staleness (TTL-based auto-refresh)

When fetching skills from a remote source, auto-refresh if the cache is stale.

- Store a `.last-fetched` timestamp file in each source cache directory (`~/.cache/agents-inc/sources/{hash}/.last-fetched`)
- If older than threshold (default 1 hour), set `forceRefresh=true` automatically
- Clear giget cache via existing `clearGigetCache()` when auto-refreshing
- **Files:** `src/cli/lib/loading/source-fetcher.ts`, `src/cli/consts.ts`

---

## D-26: Marketplace-Specific Uninstall

Allow passing a specific marketplace/source to the uninstall command so that only skills and agents from that source are removed, leaving other sources' installations intact.

```
agentsinc uninstall --source github:acme-corp/skills
```

This would:

- Read config.yaml for the list of configured sources
- Only remove skills/agents that match the specified source
- Preserve skills/agents from other sources

**Depends on:** Uninstall redesign (config-based removal logic) being completed first.

---
