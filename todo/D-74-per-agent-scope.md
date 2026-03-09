# D-74: Per-Agent Scope Toggle — Refinement

## Status: Mostly Implemented

The core per-agent scope system is already in place. Only edit-mode restoration and help modal documentation remain.

## What Already Works

| Component               | Status | Details                                                                                       |
| ----------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `AgentScopeConfig` type | Done   | `{ name: AgentName, scope: "project" \| "global" }` in `types/config.ts`                      |
| Store state             | Done   | `agentConfigs`, `focusedAgentId`, `toggleAgentScope`, `setFocusedAgentId`, `lockedAgentNames` |
| Hotkey handler          | Done   | S key in wizard.tsx agents step reads `focusedAgentId`, calls `toggleAgentScope`              |
| Agents step UI          | Done   | [P]/[G] badges rendered in `step-agents.tsx` with `CLI_COLORS.WARNING`/`CLI_COLORS.INFO`      |
| Confirm step            | Done   | Shows "X project, Y global" agent scope summary                                               |
| Config generator        | Done   | `splitConfigByScope()` splits agents by scope                                                 |
| Config writer           | Done   | Writes `AgentScopeConfig[]` objects, global import spreads global agents                      |
| Local installer         | Done   | `buildAgentScopeMap()`, `compileAndWriteAgents()` routes by scope                             |
| WizardResultV2          | Done   | Includes `agentConfigs: AgentScopeConfig[]`                                                   |
| Store tests             | Done   | Agent scope tests exist (initial state, sync, toggle, focused, locked)                        |

## Remaining Gaps

### Gap 1: Edit-mode agent scope restoration (PRIMARY)

**Problem:** `use-wizard-initialization.ts` restores `selectedAgents` from `initialAgents` but does NOT restore `agentConfigs`. Agent scope (project vs global) is lost when reopening the wizard in edit mode — all agents reset to `scope: "project"`.

**Fix:** Follow the `installedSkillConfigs` pattern:

- `wizard.tsx` — add `installedAgentConfigs?: AgentScopeConfig[]` to `WizardProps`
- `use-wizard-initialization.ts` — accept and restore `agentConfigs` alongside `selectedAgents`
- `edit.tsx` — pass `projectConfig?.config?.agents` as `installedAgentConfigs`

### Gap 2: Help modal missing S key for agents step

**Problem:** `help-modal.tsx` has `AGENTS_KEYS` with an empty `keys` array. The S key for agent scope toggle is not listed.

**Fix:** Add `{ key: HOTKEY_SCOPE.label, description: "Toggle agent scope (project/global)" }` to `AGENTS_KEYS.keys`.

### Gap 3: Edit command doesn't detect agent scope changes

**Problem:** `edit.tsx` scope change detection (lines 200-220) only handles skill scope changes, not agent scope changes.

**Fix:** Add agent scope diff logic: compare old `agentConfigs` to new, display `~ agent-name ([P] -> [G])` in change summary, handle agent `.md` file migration between directories.

### Gap 4: Edit command doesn't pass agent scope info

**Problem:** Edit command passes `initialAgents` as `AgentName[]` but no scope info. On edit-mode open, all agents re-initialize with `scope: "project"`.

**Fix:** Pass `projectConfig?.config?.agents` as `installedAgentConfigs` prop. This is the agent-side equivalent of the `installedSkillConfigs` fix.

### Gap 5: Default scope always "project"

**Status:** Intentional. `preselectAgentsFromDomains` defaults to `scope: "project"`. User toggles to global via S key. This matches D4 convention.

## Implementation Plan

### Phase 1: Edit-mode restoration (Gaps 1, 4)

Files:

- `src/cli/components/wizard/wizard.tsx` — add `installedAgentConfigs` prop
- `src/cli/components/hooks/use-wizard-initialization.ts` — restore `agentConfigs`
- `src/cli/commands/edit.tsx` — pass agent configs from loaded project config

### Phase 2: Help modal (Gap 2)

Files:

- `src/cli/components/wizard/help-modal.tsx` — add S key to `AGENTS_KEYS`

### Phase 3: Edit command scope diff (Gap 3)

Files:

- `src/cli/commands/edit.tsx` — agent scope change detection, display, and `.md` file migration

### Edge Cases

- **Scope change file migration:** toggling agent project->global requires deleting `.md` from `.claude/agents/` and recompiling to `~/.claude/agents/` (and vice versa). `recompileAgents` handles recompilation if config is correct, but old `.md` in wrong directory needs explicit cleanup.
- **Locked agents:** already handled — `lockedAgentNames` prevents toggle on existing global agents in project wizard.
- **No migration needed:** `ProjectConfig.agents` is already typed as `AgentScopeConfig[]` since D-37. Old `AgentName[]` configs were already recreated.
