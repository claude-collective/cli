# Agents Inc. CLI - Deferred Tasks

| ID    | Task                                                                                 | Status                  |
| ----- | ------------------------------------------------------------------------------------ | ----------------------- |
| D-25  | Auto-version check + source staleness (see [plan](./D-25-auto-version-check.md))     | Ready for Dev           |
| D-14  | Import skills from third-party marketplaces                                          | Needs Assistance        |
| UX-04 | Interactive skill search polish                                                      | Needs Assistance        |
| UX-05 | Refine step - skills.sh integration                                                  | Needs Assistance        |
| #5    | Agents command for skill assignment                                                  | Needs Assistance        |
| D-01  | Update skill documentation conventions                                               | Needs Assistance        |
| D-11  | Development hooks for type checking                                                  | Needs Assistance        |
| D-13  | Eject skills by domain/category (see [plan](./D-13-eject-skills-filtered.md))        | Refined                 |
| UX-06 | Search with color highlighting                                                       | Needs Assistance        |
| #19   | Sub-agent learning capture system                                                    | Needs Assistance        |
| D-26  | Marketplace-specific uninstall (see [plan](./D-26-marketplace-uninstall.md))         | Ready for Dev           |
| D-08  | User-defined stacks in consumer projects (see [plan](./D-08-user-defined-stacks.md)) | Deferred                |
| D-47  | Eject standalone compile function (see [plan](./D-47-eject-compile-function.md))     | Deferred — low priority |
| P4-18 | Test: multiple skill/agent creation (depends on P4-17)                               | Deferred                |
| P4-17 | `agentsinc new` supports multiple items (see [plan](./P4-17-new-multiple-items.md))  | Refined                 |
| UX-09 | Animations/transitions                                                               | Needs Assistance        |
| UX-07 | Incompatibility tooltips                                                             | Needs Assistance        |
| D-19  | Improve template error messages (see [plan](./D-19-template-error-messages.md))      | Deferred — nice to have |
| R-06  | Slim down `ResolvedSkill` — separate resolved relationship data from skill identity  | Deferred — low priority |

---

> This file contains deferred tasks moved from [TODO.md](./TODO.md) to keep the main file lean.
> These tasks are not blocked but have been deprioritized for future implementation.

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

## D-19: Improve Template Error Messages

When template compilation fails, show which variables are missing and suggest which source files should be created.

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
