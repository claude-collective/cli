# Claude Collective CLI - Task Tracking

## Current Focus

Phase 7B complete. Ready for user testing.

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).
For wizard architecture details, see [docs/wizard-index.md](./docs/wizard-index.md).

---

## Blockers

_None currently. Add serious blockers here immediately when discovered._

---

## Reminders for Agents

### R1: Use Specialized Agents

- **CLI Developer** (`cli-developer`) - All feature implementation work
- **CLI Tester** (`web-tester`) - All test writing
- **API Researcher** (`api-researcher`) - Backend/resolver research
- **Web Researcher** (`web-researcher`) - Frontend/component research

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

### Migrate to `.claude-src/` for source files

**Goal:** Separate source files (agent partials, config) from Claude Code's directory (`.claude/`).

**Architecture:**

```
project/
├── .claude/                      # Claude Code's directory
│   ├── agents/                   # Compiled agents (OUTPUT)
│   └── skills/                   # Skills (directly here)
│
├── .claude-src/                  # Source files for customization
│   ├── agents/                   # Agent partials + templates (INPUT)
│   │   ├── _templates/
│   │   └── {agent-name}/
│   └── config.yaml               # THE config file
```

**Changes Required:**

1. **Constants** (`src/cli-v2/consts.ts`):
   - Add `CLAUDE_SRC_DIR = ".claude-src"`
   - Update paths for config, agent partials

2. **Config resolution** (`src/cli-v2/lib/config.ts`):
   - Always read from `.claude-src/config.yaml` (no fallback to `.claude/`)
   - Fall back to defaults if file doesn't exist

3. **Eject command** (`src/cli-v2/commands/eject.ts`):
   - `agent-partials` → `.claude-src/agents/`
   - `skills` → `.claude/skills/` (unchanged)
   - Create/update `.claude-src/config.yaml` with all options

4. **Compile command** (`src/cli-v2/commands/compile.ts`, `lib/agent-recompiler.ts`):
   - Check `.claude-src/agents/` for partials first, fall back to CLI
   - Check `.claude-src/agents/_templates/` for templates first
   - Read config from `.claude-src/config.yaml`
   - Output to `.claude/agents/`

5. **Init command** (`src/cli-v2/commands/init.tsx`):
   - Write config to `.claude-src/config.yaml`
   - Skills to `.claude/skills/`

6. **Compiler** (`src/cli-v2/lib/compiler.ts`):
   - Update `createLiquidEngine()` to check `.claude-src/agents/_templates/` before CLI

7. **Loader** (`src/cli-v2/lib/loader.ts`):
   - Add function to load agents from `.claude-src/agents/`

8. **Installation detection** (`src/cli-v2/lib/installation.ts`):
   - Check for `.claude-src/config.yaml`

**Files to modify:**

- `src/cli-v2/consts.ts`
- `src/cli-v2/lib/config.ts`
- `src/cli-v2/commands/eject.ts`
- `src/cli-v2/commands/compile.ts`
- `src/cli-v2/commands/init.tsx`
- `src/cli-v2/lib/compiler.ts`
- `src/cli-v2/lib/loader.ts`
- `src/cli-v2/lib/agent-recompiler.ts`
- `src/cli-v2/lib/installation.ts`
- Tests for all above

---

### [DONE] Move all config to project-level `.claude/config.yaml`

**Goal:** Eliminate global config at `~/.claude-collective/config.yaml`. All config should be visible in the project's `.claude/config.yaml`.

**Properties to move:**

- `source` - Skills source path/URL
- `author` - Default author for new skills/agents
- `marketplace` - Marketplace identifier
- `agents_source` - Separate source for agents

**Files to modify:**

1. **`src/cli-v2/lib/config.ts`**
   - Update `ProjectConfig` interface to include all properties (source, author, marketplace, agents_source)
   - Change `resolveSource()` to read from `.claude/config.yaml` instead of `.claude-collective/config.yaml`
   - Change `resolveAgentsSource()` similarly
   - Add function to get/save author from project config
   - Remove or deprecate global config functions

2. **`src/cli-v2/commands/eject.ts`**
   - When `--source` is passed, save it to `.claude/config.yaml`
   - Create/update the config file if it doesn't exist

3. **`src/cli-v2/commands/init.tsx`**
   - Save source to `.claude/config.yaml` when provided via `--source`

4. **`src/cli-v2/commands/new/skill.ts`** and **`new/agent.tsx`**
   - Update to read author from `.claude/config.yaml`

**New `.claude/config.yaml` structure:**

```yaml
name: my-project
description: Project description
source: /path/to/marketplace
author: "@vince"
marketplace: claude-collective
agents_source: /path/to/agents # optional

agents:
  - web-developer
  - api-developer

agent_skills:
  web-developer:
    - react
```

**Resolution priority (simplified):**

1. `--source` flag (ephemeral, highest priority)
2. `CC_SOURCE` env var
3. `.claude/config.yaml` in project
4. Default (`github:claude-collective/skills`)

---

### [DONE] Refactor `cc eject` command

**Goal:** Fix `eject skills` to load from source marketplace, consolidate templates+agents into `agent-partials`, remove config eject.

**Changes Required:**

1. **Remove `config` from eject types** - Config is generated during `init`, nothing to eject
2. **Rename `templates` + `agents` → `agent-partials`** - These work together as a unified system
3. **Fix `eject skills` to use source loading** - Currently broken (looks in plugin dir instead of source)
4. **Support `--source` flag for skills** - Load from custom marketplace or default to public
5. **Add `--refresh` flag** - Force refresh cached remote sources

**New Eject Types:**

- `agent-partials` - CLI's `_templates/*.liquid` + agent partials (always from CLI)
- `skills` - All skills from source (default: public marketplace, or custom via `--source`)
- `all` - Both of the above

**Implementation Details:**

```typescript
// New imports needed
import { loadSkillsMatrixFromSource, type SourceLoadResult } from "../lib/source-loader.js";
import { copySkillsToLocalFlattened } from "../lib/skill-copier.js";

// Updated types
const EJECT_TYPES = ["agent-partials", "skills", "all"] as const;

// Add refresh flag
static flags = {
  ...BaseCommand.baseFlags,
  force: Flags.boolean({ ... }),
  output: Flags.string({ ... }),
  refresh: Flags.boolean({
    description: "Force refresh from remote source",
    default: false,
  }),
};
```

**ejectAgentPartials()** - Combines templates + agents from CLI:

- Copy `PROJECT_ROOT/src/agents/_templates/` to `<dest>/_templates/`
- Copy `PROJECT_ROOT/src/agents/` (excluding `_templates`) to `<dest>/`

**ejectSkills()** - Uses source loading:

- Load skills matrix via `loadSkillsMatrixFromSource({ sourceFlag: flags.source, ... })`
- Copy all non-local skills via `copySkillsToLocalFlattened()`

**Files to modify:**

- `src/cli-v2/commands/eject.ts`

**Expected usage:**

```bash
cc eject agent-partials          # From CLI
cc eject skills                  # From public marketplace
cc eject skills --source /path   # From custom source
cc eject all                     # Everything
cc eject all --source /path      # Everything, skills from custom source
```

---

### [DONE] BUG: Compiled agents missing preloaded_skills in frontmatter

**Problem:** Agents compiled by `cc init` do not have `preloaded_skills` in their frontmatter header and don't reference any skills.

**Root Causes:** (Three issues identified and fixed)

1. **Type mismatch:** `init.tsx` used deprecated `WizardResult` type (which has `selectedStack: { id: string }`) instead of `WizardResultV2` (which has `selectedStackId: string`). This caused `loadedStack` to always be `null` since `result.selectedStack` didn't exist on `WizardResultV2`.

2. **Missing parameters:** `resolveAgents()` was called WITHOUT the `stack` and `skillAliases` parameters needed for Phase 7 skill resolution.

3. **"Customize" path not pre-populated:** When user selected a stack but chose "customize" instead of "defaults", the wizard didn't pre-populate `domainSelections` with the stack's default technologies. This caused the user's customizations to start from scratch, missing required skills.

**Code Fix: [DONE]**

- `src/cli-v2/commands/init.tsx`:
  - Import changed from `WizardResult` to `WizardResultV2`
  - All `result.selectedStack` references changed to `result.selectedStackId`
  - All `result.selectedStack.id` references changed to `result.selectedStackId`
  - Now passes `loadedStack ?? undefined` and `skillAliases` to `resolveAgents()`

- `src/cli-v2/stores/wizard-store.ts`:
  - Added `populateFromStack()` action to pre-populate `domainSelections` from stack configuration

- `src/cli-v2/components/wizard/step-stack-options.tsx`:
  - Now accepts `matrix` prop
  - Calls `populateFromStack()` when "customize" is selected to pre-load stack defaults

**Tests Added:** (in `src/cli-v2/lib/resolver.test.ts`)

- [x] `resolveAgentSkillsFromStack` - Unit tests for Phase 7 stack-based skill resolution
  - Returns skill references from stack agent config
  - Marks framework subcategory skills as preloaded
  - Handles agent not in stack, empty config, unknown aliases
- [x] `getAgentSkills` - Unit tests with stack and skillAliases parameters
  - Returns skills from stack when stack and skillAliases provided
  - Prioritizes explicit agentConfig.skills over stack skills
  - Returns empty array when no stack/skillAliases provided
- [x] `resolveAgents` - Integration tests for agents with skills from stack configuration
  - Resolves agents with skills from stack configuration (verifies skills array populated)
  - Returns agents without skills when stack/skillAliases not provided
  - Handles agent in compileConfig but not in stack

**Tests Still Needed:**

- [ ] Full E2E integration test verifying `cc init` produces agents with skills in frontmatter
  - This would require mocking the wizard flow which is complex
  - The unit tests above verify the core logic is correct

**Related:**

- `src/cli-v2/lib/resolver.ts` lines 320-358 - getAgentSkills() priority logic
- `src/cli-v2/lib/stacks-loader.ts` lines 90-116 - resolveAgentConfigToSkills()
- `src/agents/_templates/agent.liquid` lines 8-10 - Template rendering

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
