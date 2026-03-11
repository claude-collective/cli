# D-74: Per-Agent Scope Toggle — Refinement

## Status: Complete

All per-agent scope features are implemented: store state, hotkey handling, UI badges, config generation, edit-mode restoration, help modal docs, and edit command change detection.

## What's Implemented

| Component                        | Status | Details                                                                                       |
| -------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `AgentScopeConfig` type          | Done   | `{ name: AgentName, scope: "project" \| "global" }` in `types/config.ts`                      |
| Store state                      | Done   | `agentConfigs`, `focusedAgentId`, `toggleAgentScope`, `setFocusedAgentId`, `lockedAgentNames` |
| Hotkey handler                   | Done   | S key in wizard.tsx agents step reads `focusedAgentId`, calls `toggleAgentScope`              |
| Agents step UI                   | Done   | [P]/[G] badges rendered in `step-agents.tsx` with `CLI_COLORS.WARNING`/`CLI_COLORS.INFO`      |
| Confirm step                     | Done   | Shows "X project, Y global" agent scope summary                                               |
| Config generator                 | Done   | `splitConfigByScope()` splits agents by scope                                                 |
| Config writer                    | Done   | Writes `AgentScopeConfig[]` objects, global import spreads global agents                      |
| Local installer                  | Done   | `buildAgentScopeMap()`, `compileAndWriteAgents()` routes by scope                             |
| WizardResultV2                   | Done   | Includes `agentConfigs: AgentScopeConfig[]`                                                   |
| Store tests                      | Done   | Agent scope tests exist (initial state, sync, toggle, focused, locked)                        |
| Edit-mode agent scope restore   | Done   | `installedAgentConfigs` prop flows wizard.tsx -> use-wizard-initialization.ts -> store         |
| Help modal S key docs            | Done   | `AGENTS_KEYS` lists S key for scope toggle                                                    |
| Edit command agent scope diff    | Done   | Detects agent scope changes, displays `~ agent ([P] -> [G])`, includes in summary count      |
| Default scope                    | Done   | Default is "global" — `preselectAgentsFromDomains` defaults to `scope: "global"`              |

## Notes

- **Locked agents:** `lockedAgentNames` prevents toggle on existing global agents in project wizard.
- **No migration needed:** `ProjectConfig.agents` is already typed as `AgentScopeConfig[]` since D-37.
