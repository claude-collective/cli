# D-65: Init/Edit Scope Behavior -- Global Config Detection

**Depends on:** D-46 (TS config migration must be complete first so config files are `.ts`)

**Goal:** Make `init` aware of global config and prompt the user. Make `edit` scope-aware.

---

## `agentsinc init`

When the user runs `init`:

1. Check for an existing **project-level** config (`.claude-src/config.ts` in cwd).
2. Check for an existing **global** config (`~/.claude-src/config.ts`).
3. If **project config exists** -> launch the wizard in edit mode for the project config.
4. If **no project config but global exists** -> prompt the user:
   - "Edit global config" -> launch wizard editing the global config.
   - "Create new project config" -> launch wizard creating a new project-level config (inherits/overrides global).
5. If **neither exists** -> launch wizard creating a new project-level config (current behavior).

## `agentsinc edit`

When the user runs `edit`:

1. Check for a **project-level** config (`.claude-src/config.ts` in cwd).
2. If found -> edit the project config (current behavior, just with `.ts`).
3. If not found -> check for **global** config (`~/.claude-src/config.ts`).
4. If global found -> edit the global config.
5. If neither found -> error (no config to edit).

The key principle: `edit` works on whatever is in scope -- project takes precedence, falls back to global. No prompting needed.

---

## Steps

1. Add global config detection to `init.tsx` -- check `~/.claude-src/config.ts` when no project config exists.
2. Add prompt UI (Ink component or simple select) for "Edit global / Create project" choice.
3. Update `edit.tsx` -- scope resolution: project -> global fallback.
4. Tests: test init global-detection prompt, test edit scope resolution.

## Files affected

| File                        | Change                                       |
| --------------------------- | -------------------------------------------- |
| `src/cli/commands/init.tsx` | Global config detection + prompt             |
| `src/cli/commands/edit.tsx` | Scope resolution: project -> global fallback |

## Verification

- `init` correctly detects global config and prompts when no project config exists.
- `edit` finds the right config based on scope.
- All existing tests pass.
