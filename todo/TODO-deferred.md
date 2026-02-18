# Agents Inc. CLI - Deferred Tasks

| ID    | Task                                                  | Status   |
| ----- | ----------------------------------------------------- | -------- |
| D-31  | Prefix categories with their domain                   | Deferred |
| D-05  | Improve `agentsinc init` when already initialized     | Deferred |
| P4-17 | `agentsinc new` supports multiple items               | Deferred |
| D-08  | Support user-defined stacks in consumer projects      | Deferred |
| P4-18 | Test: multiple skill/agent creation                   | Deferred |
| D-01  | Update skill documentation conventions                | Deferred |
| D-11  | Development hooks for type checking                   | Deferred |
| D-12  | Eject full agents from custom sources                 | Deferred |
| D-13  | Eject skills by domain/category                       | Deferred |
| D-18  | Template system documentation improvements            | Deferred |
| D-19  | Improve template error messages                       | Deferred |
| D-20  | Add Edit tool to documentor agent                     | Deferred |
| D-22  | Automated agent-tester for quality assurance          | Deferred |
| D-23  | Test version bumping, create version bump command     | Deferred |
| D-24  | Configurable documentation file locations             | Deferred |
| D-14  | Import skills from third-party marketplaces           | Deferred |
| UX-04 | Interactive skill search polish                       | Deferred |
| UX-05 | Refine step - skills.sh integration                   | Deferred |
| UX-06 | Search with color highlighting                        | Deferred |
| UX-07 | Incompatibility tooltips                              | Deferred |
| UX-09 | Animations/transitions                                | Deferred |
| #5    | Agents command for skill assignment                   | Deferred |
| #19   | Sub-agent learning capture system                     | Deferred |
| D-25  | Auto-version check + source staleness                 | Deferred |
| D-26  | Marketplace-specific uninstall                        | Deferred |
| D-30  | Update schemas when generating new categories/domains | Deferred |

---

## D-31: Prefix Categories with Their Domain

**Priority: Highest deferred task.**

Currently, subcategory keys in stacks, the skills matrix, and metadata are bare names (e.g., `framework`, `testing`, `client-state`). These should be prefixed with their parent domain to avoid ambiguity and align with the `domain/subcategory` pattern already used in `CategoryPath` (e.g., `web/framework`, `api/testing`).

**Example:**

```yaml
# Before (current)
agents:
  web-developer:
    framework: web-framework-react

# After (proposed)
agents:
  web-developer:
    web/framework: web-framework-react
```

**Scope:**

- Skills matrix categories: `framework` → `web/framework`, `testing` → `web/testing`, etc.
- Stacks agent configs: subcategory keys become domain-prefixed
- Metadata `category` field: currently bare subcategory, should become `domain/subcategory`
- Schema enums: update all `subcategorySchema`, `stackSubcategorySchema`, and generated JSON schemas
- TypeScript types: `Subcategory` type and `CategoryPath` may need to converge

**Investigation needed:**

- Audit all places where bare subcategory names are used vs `CategoryPath` (`domain/subcategory`)
- Determine if `Subcategory` and `CategoryPath` can be unified
- Assess impact on existing stacks.yaml, skills-matrix.yaml, and all metadata.yaml files
- Plan migration for source marketplaces (claude-subagents, skills, etc.)

**Related:** D-30 (schema generation for new categories)

---

> This file contains deferred tasks moved from [TODO.md](./TODO.md) to keep the main file lean.
> These tasks are not blocked but have been deprioritized for future implementation.

---

## D-05: Improve `agentsinc init` When Already Initialized

When `agentsinc init` is run in a project that's already initialized, show a richer experience than simply redirecting to the edit view. The exact UX is TBD — something more nuanced than a plain redirect (e.g. a summary of what's installed, options to edit/recompile/update).

**Files:** `src/cli/commands/init.tsx`

---

## Phase 4 Deferred

**M | P4-17 | Feature: `agentsincnew skill/agent` supports multiple items**
Deferred until after migration. Allow creating multiple skills/agents in one command.

**S | P4-18 | Test: Multiple skill/agent creation works**
Depends on P4-17. Test coverage for multi-item creation.

---

## D-08: Support User-Defined Stacks in Consumer Projects

**See research doc:** [docs/research/user-defined-stacks.md](../docs/research/user-defined-stacks.md)

Allow consumers to define stacks at four levels with a clear hierarchy in the wizard:

1. **Project-level stacks** (top) — defined in a `stacks.yaml` referenced from `.claude-src/config.yaml` via the existing `stacks_file` field
2. **Global stacks** — user-defined stacks that apply across all projects (e.g., `~/.config/agents-inc/stacks.yaml`)
3. **Private marketplace stacks** — from configured marketplace sources
4. **Public stacks** (bottom) — built-in CLI stacks from `config/stacks.yaml`, hidden when a private source is configured

Each section has its own heading in the Stack Selection screen. Stacks are tagged with a `StackOrigin` (`"project" | "global" | "marketplace" | "public"`) and `originLabel` for display. The loader needs to change from either/or to merging from all origins.

**Files:** `src/cli/lib/stacks/stacks-loader.ts`, `src/cli/lib/loading/source-loader.ts`

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

**M | D-12 | Support ejecting full compiled agents from custom sources**

Add support for ejecting complete agent markdown files from custom sources/marketplaces.

```bash
agentsinc eject agents --source /path/to/marketplace
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

## D-23: Test Version Bumping and Create Version Bump Command

**M | D-23 | Test version bumping workflow and create dedicated command**

Test the existing version bumping workflow and create a dedicated command (e.g., `agentsincversion bump`) to automate the release process. The command should:

- Bump version in package.json (major, minor, patch)
- Update version references in relevant files
- Create a git commit with the version bump
- **Important:** Ensure Claude is NOT added as co-author in the commit
- Automatically update or generate changelog entry for the new version
- Optionally create a git tag for the release
- Follow semantic versioning conventions

Add comprehensive tests for the version bumping logic to ensure it handles edge cases correctly.

**Origin:** Hackathon Task #16

---

## D-24: Configurable Documentation File Locations for Agent Compilation

**S | D-24 | Configure documentation file locations in consumer projects**

Agent markdown files reference documentation files by filename only (e.g., `claude-architecture-bible.md`, `prompt-bible.md`, `documentation-bible.md`). Eventually, consumer projects should be able to configure where these files live so they can be resolved and included during agent compilation.

### Implementation Notes

- Add a `documentation` section to `config.yaml` in consuming projects:

  ```yaml
  documentation:
    claude-architecture-bible: docs/standards/content/claude-architecture-bible.md
    prompt-bible: docs/standards/content/prompt-bible.md
    documentation-bible: docs/standards/content/documentation-bible.md
  ```

- During `agentsinccompile`, if a doc file location is configured and the file exists, inject its content into the compiled agent output (e.g., as a `<preloaded_content>` section or inline reference)
- If a doc file is not configured or does not exist, omit the reference entirely from compiled output
- Agent source files continue to reference docs by filename only -- resolution is the compiler's responsibility

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

## UX-14: Build Step "Show Description" Toggle [DONE]

**S | UX-14 | Add "show description" toggle to the Build step**

Add a toggle to the Build step (alongside the existing toggles) called "show description". When enabled, it shows the recommended/discouraged/selected labels within the skill tags, giving users more context about each skill's status.

**Behavior:**

- Off by default (current compact view)
- When toggled on, each skill tag displays its recommendation status (e.g., "Recommended", "Discouraged", "Selected")
- Labels should use appropriate colors to match the existing color scheme

**Files:** `src/cli/components/wizard/category-grid.tsx`, `src/cli/components/wizard/step-build.tsx`

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

## D-30: Update Schemas When Generating New Categories/Domains

When a user creates a new category or domain, the JSON schemas (e.g., `metadata.schema.json`, `skills-matrix.schema.json`) should be updated to include the new values. Currently there is no code that handles this — generating a new category or domain does not update any schemas.

**Investigation needed:**

- Determine whether categories/domains are currently hardcoded in schemas or dynamically derived
- Identify what flows create new categories or domains (if any exist yet)
- Design how schema regeneration should be triggered (automatic on compile? explicit command? pre-commit hook?)
- Ensure `$schema` references in metadata.yaml remain valid after schema changes

**Related:** D-29 (`$schema` in metadata.yaml)
