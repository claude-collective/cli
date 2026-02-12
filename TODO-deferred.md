# Claude Collective CLI - Deferred Tasks

> This file contains deferred tasks moved from [TODO.md](./TODO.md) to keep the main file lean.
> These tasks are not blocked but have been deprioritized for future implementation.

---

## Work-Related Agents and Skills

**M | T5 | Create Work-Related Agents and Skills**

- [ ] Identify gaps in current agent ecosystem for work use cases
- [ ] Create specialized agents for common work patterns
- [ ] Create skills for work-specific technologies
- [ ] Ensure new agents follow corrected architecture patterns

---

## Phase 6 Future Work

**M | D-08 | Support user-defined stacks in consumer projects**
Allow consumers to define custom stacks in their own `config/stacks.yaml` file. The stack loader should merge user stacks with CLI built-in stacks, with user stacks taking precedence (following the pattern used for agent loading in `stack-plugin-compiler.ts:301-308`). Currently only CLI built-in stacks from `/home/vince/dev/cli/config/stacks.yaml` are supported.

**M | D-09 | Fix agent-recompiler tests for Phase 6**
7 tests in `src/cli/lib/agent-recompiler.test.ts` are skipped because agents now have skills in their YAMLs (Phase 6). Tests need to either provide the skills that agents reference, use test agents without skills, or bypass skill resolution.
**Note:** Phase 7 will remove skills from agent YAMLs entirely (P7-0-1). This task may become obsolete.

---

## Phase 3 Deferred

**L | P3-14 | Individual skill plugin installation**
Plugin mode only supports stacks. Would need to support installing individual skills as plugins.

---

## Phase 4 Deferred

**M | P4-17 | Feature: `cc new skill/agent` supports multiple items**
Deferred until after migration. Allow creating multiple skills/agents in one command.

**S | P4-18 | Test: Multiple skill/agent creation works**
Depends on P4-17. Test coverage for multi-item creation.

---

## Phase 5 Deferred

**M | P5-6-4 | Cross-platform terminal testing** DEFERRED (depends: P5-4-12)
Test on macOS, Linux, Windows terminals, and CI environments

**S | P5-6-5 | Performance validation (<300ms startup)** DEFERRED (depends: P5-5-6)
Measure and validate startup time is within acceptable range

---

## General Deferred Tasks

**M | D-01 | Update skill documentation conventions**
Replace `examples-*.md` files with folder structure. Split examples vs patterns. Namespace files (e.g., `examples/core.md`, `patterns/testing.md`). Update `docs/skill-extraction-criteria.md` accordingly.

**S | D-05 | Improve `cc init` behavior when already initialized**
Currently, running `cc init` a second time just warns "already initialized" and suggests `cc edit`. This is not discoverable.

**Suggested approach:** When `cc init` detects an existing installation, show a "home screen" menu instead of just warning. Options could include:

- Reconfigure installation (change mode, stack, skills)
- Add/remove skills
- View current configuration
- Recompile agents
- Uninstall

This follows the pattern of CLIs like `npm init` (asks about overwriting) and provides better discoverability of available actions. The current behavior requires users to know about `cc edit`, `cc compile`, etc.

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

## D-16: Init Should Populate Config Options with Defaults

**S | D-16 | Show all config options in generated config.yaml with defaults**

When `cc init` creates `.claude/config.yaml`, it should include all available config options with their default values (commented out if not explicitly set). This makes the options discoverable.

**Current behavior:**

```yaml
name: claude-collective
installMode: local
skills:
  - web-framework-react
# ... no source/marketplace/agents_source shown
```

**Desired behavior:**

```yaml
name: claude-collective
installMode: local

# Source for skills (default: public marketplace)
source: github:claude-collective/skills

# Marketplace identifier for plugin installation
# marketplace: claude-collective

# Source for agents (default: CLI bundled)
# agents_source: /path/to/cli

skills:
  - web-framework-react
```

### Implementation Notes

- Show `source` with default value (`github:claude-collective/skills`)
- Show `marketplace` commented out (optional)
- Show `agents_source` commented out (defaults to CLI)
- Users can uncomment and modify to use custom sources
- Makes configuration discoverable without reading docs

### Files to Modify

- `src/cli/commands/init.tsx` - Update config generation in `installLocalMode()` and `installPluginMode()`
- `src/cli/lib/config-generator.ts` - May need to add source fields to generated config

---

## D-12: Eject Full Agents from Custom Sources

**M | D-12 | Support ejecting full compiled agents from custom sources**

Add support for ejecting complete agent markdown files from custom sources/marketplaces.

```bash
cc eject agents --source /path/to/marketplace
```

Currently `eject agent-partials` only ejects the CLI's bundled partials and templates (the building blocks). This future feature would allow ejecting fully-compiled agent files from third-party sources.

### Implementation Notes

- Different from `agent-partials` which are building blocks
- Would copy compiled `.md` agent files from `<source>/agents/`
- Useful for forking/customizing agents from other marketplaces
- When implemented, update `EJECT_TYPES` to include `agents` as separate option

---

## D-13: Eject Skills by Domain/Category

**S | D-13 | Filter ejected skills by domain or category**

Add `--domain` and `--category` flags to `cc eject skills` to selectively eject skills from specific areas instead of all skills.

```bash
# Eject only frontend skills
cc eject skills --domain frontend

# Eject only framework skills across all domains
cc eject skills --category framework

# Combine filters
cc eject skills --domain backend --category api
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

## D-21: Agent Naming Prefix Alignment

**S | D-21 | Prefix tester and planning agents with domain**

- `tester` references should be `web-tester`, `cli-tester`
- `pm` should be `web-pm`
- `architecture` should be `web-architecture`
- `pattern-critique` should be `web-pattern-critique`

This is for documentation alignment - the actual agents are already correctly named.

---

## D-22: Agent Tester - Automated Quality Assurance

**M | D-22 | Create automated agent-tester for quality assurance**

Based on comprehensive testing performed in the Ralph Loop session (TESTER 51+), create an automated agent-tester that validates all agents against agent-summoner standards.

### Test Categories (from Ralph Loop)

1. **PROMPT_BIBLE Essential Techniques (13 tests)**
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
- [ ] Suggests fixes based on PROMPT_BIBLE and canonical structure
- [ ] Can run incrementally (single category) or full suite
- [ ] Integrates with `cc compile` to validate before compilation

---

## D-14: Consume Third-Party Marketplace Skills

**M | D-14 | Command to import skills from third-party marketplaces**

Create a command to download skills from external marketplaces and integrate them into the local skill library using an AI agent (skill summoner).

```bash
# Download and integrate a skill from another marketplace
cc import skill https://example.com/marketplace/my-skill

# Or from a git repo
cc import skill github:someuser/their-skills --skill react-patterns
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
