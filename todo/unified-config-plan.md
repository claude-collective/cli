# Unified Config View with Split Writes

**Date:** 2026-03-13
**Status:** Design
**Related:** D-37-dual-installation.md, D-65-init-edit-scope.md, per-skill-scope-bugs.md

---

## Problem Statement

When a user runs `edit` from a project directory and `detectInstallation()` falls back to the global installation, **ALL changes are written to the global config** — even project-scoped skills. The root cause is simple: the edit command uses `installation.projectDir` (which is `os.homedir()` after fallback) for all write operations, so it forgets where the user is standing.

There are only two directories that matter:

- **Global:** `~/.claude-src/` — always `os.homedir()`, always the same.
- **Project:** `<cwd>/.claude-src/` — wherever the user ran the command from.

The fix: use `process.cwd()` for project writes, `os.homedir()` for global writes.

---

## What Already Works

The split-write infrastructure is fully implemented (D-37 phases 1-5). The bug is that `edit.tsx` passes the wrong directory:

1. **Config splitting** — `splitConfigByScope()` partitions skills, agents, stack, domains by scope.
2. **Scoped config writing** — `writeScopedConfigs()` writes global to `~/`, project (with import) to `<project>/`.
3. **Scoped config-types writing** — Global gets standalone types; project gets types that import/extend global.
4. **Wizard scope tracking** — `skillConfigs[]` and `agentConfigs[]` carry `scope` per item. S key toggles. [G]/[P] badges.
5. **Locked items** — Global items are read-only in project context (D9).
6. **Plugin routing** — `--scope user` for global, `--scope project` for project.
7. **Agent routing** — `agentScopeMap` routes compiled agents to the correct directory.
8. **Local skill routing** — `installLocal()` splits skills by scope and copies to the correct directory.
9. **Compile dual-pass** — `compile.ts` runs separate global and project compilation passes.
10. **Auto-create blank global** — `init.tsx` calls `ensureBlankGlobalConfig()` on first project init.

---

## Precondition

`edit` requires at least one installation (global or project) to exist. If neither exists, `detectInstallation()` returns `null` and the command exits with an error: "No Agents Inc. installation found. Run 'agentsinc init' to create one." This is already handled at `edit.tsx` line 89-93. No change needed.

---

## The Bug

**Scenario:** User has a global installation at `~/` but no project config. They run `edit` from `/home/user/my-project/`.

1. `detectInstallation()` checks `/home/user/my-project/.claude-src/config.ts` — not found
2. Falls back to global → `installation.projectDir = os.homedir()`
3. `edit.tsx` sets `const projectDir = installation.projectDir` (now `~/`)
4. Every downstream call uses this `projectDir`:
   - `writeScopedConfigs(..., projectDir, ...)` → sees `projectDir === homeDir` → `isProjectContext = false`
   - Writes everything as a standalone global config
   - Project-scoped items silently land in `~/.claude-src/config.ts`

**Secondary bug:** The `isGlobalDir` check at line 152 (`projectDir === GLOBAL_INSTALL_ROOT`) also uses `installation.projectDir`. When installation falls back to global, `isGlobalDir = true`, so nothing is locked — the user can toggle off global skills even though they're in a project directory. Fixing `projectDir` to `cwd` also fixes this: `isGlobalDir` becomes `false` in a project directory, and global items are correctly locked.

**Root cause:** `edit.tsx` uses `installation.projectDir` for writes. When installation falls back to global, this is `~/` instead of the user's actual working directory.

---

## The Fix

### 1. Use `process.cwd()` for save operations and locked-items check in `edit.tsx`

**File:** `src/cli/commands/edit.tsx`

Use `installation.projectDir` for **reading** existing state (loading config, discovering installed skills). Use `process.cwd()` for **writing** (config saves, plugin installs, scope migrations, recompilation output) and for the **locked-items check** (determining whether global items are read-only).

Every `projectDir` reference in `edit.tsx` that feeds into a write operation or the `isGlobalDir` check must use `process.cwd()`:

| Line    | Current call                                                                                     | What changes                                                 |
| ------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 152     | `const isGlobalDir = projectDir === GLOBAL_INSTALL_ROOT`                                         | `projectDir` → `cwd`                                         |
| 297     | `executeMigration(migrationPlan, projectDir, ...)`                                               | `projectDir` → `cwd`                                         |
| 313     | `migrateLocalSkillScope(skillId, change.from, projectDir)`                                       | `projectDir` → `cwd`                                         |
| 319     | `claudePluginUninstall(skillId, oldPluginScope, projectDir)`                                     | `projectDir` → `cwd`                                         |
| 321     | `claudePluginInstall(pluginRef, newPluginScope, projectDir)`                                     | `projectDir` → `cwd`                                         |
| 335     | `deleteLocalSkill(projectDir, skillId)`                                                          | `projectDir` → `cwd`                                         |
| 348+    | Plugin install loop `projectDir` (lines 357, 368)                                                | `projectDir` → `cwd`                                         |
| 368     | `claudePluginUninstall(skillId, pluginScope, projectDir)` (removed-skills loop)                  | `projectDir` → `cwd`                                         |
| 394     | `buildAndMergeConfig(..., projectDir, ...)`                                                      | `projectDir` → `cwd`                                         |
| 401-407 | `writeScopedConfigs(..., projectDir, installation.configPath)`                                   | `projectDir` → `cwd`, `configPath` → recomputed from `cwd`   |
| 414     | `discoverAllPluginSkills(projectDir)`                                                            | `projectDir` → `cwd`                                         |
| 420-428 | `recompileAgents({ pluginDir: projectDir, projectDir, outputDir: installation.agentsDir, ... })` | All three → `cwd` and `path.join(cwd, CLAUDE_DIR, "agents")` |

**Critical:** `installation.configPath` also needs recomputing. When installation falls back to global, `installation.configPath` points to `~/.claude-src/config.ts`. But `writeScopedConfigs` uses this parameter as the **project** config path (line 452 of local-installer.ts). Must recompute: `path.join(cwd, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS)`.

**When `cwd === os.homedir()`:** Everything works unchanged — `isProjectContext = false` in `writeScopedConfigs`, single standalone config written. `isGlobalDir = true`, nothing locked. No edge case.

### 2. Call `ensureBlankGlobalConfig()` before scoped writes

**File:** `src/cli/commands/edit.tsx`

Before calling `writeScopedConfigs()`, if `cwd !== os.homedir()`, call `ensureBlankGlobalConfig()`. This ensures the global config file exists so the project config's `import globalConfig from "~/.claude-src/config"` doesn't throw `MODULE_NOT_FOUND`.

`ensureBlankGlobalConfig()` is a no-op if the file already exists (single `fileExists` check).

### 3. Skip writing empty project configs in `writeScopedConfigs`

**File:** `src/cli/lib/installation/local-installer.ts`

After `splitConfigByScope()`, if the project split has zero skills and zero agents, don't write a project config file. An empty project config with just `import globalConfig` and `{ ...globalConfig }` is pointless file litter.

Guard:

```typescript
const { global: globalConfig, project: projectSplitConfig } = splitConfigByScope(finalConfig);

// Always write global config (idempotent — content comes from splitConfigByScope)
await writeConfigFile(globalConfig, globalConfigPath);
await writeStandaloneConfigTypes(globalConfigPath, matrix, agents, globalConfig);

// Only write project config if there are project-scoped items
const hasProjectItems =
  (projectSplitConfig.skills?.length ?? 0) > 0 || (projectSplitConfig.agents?.length ?? 0) > 0;

if (hasProjectItems) {
  await writeConfigFile(projectSplitConfig, projectConfigPath, { isProjectConfig: true });
  await writeProjectConfigTypes(projectConfigPath, projectDir, projectSplitConfig, matrix);
}
```

### 4. Remove info message

**File:** `src/cli/commands/edit.tsx`

Remove the message at line 99-103 ("No project installation found. Using global installation from ~/.claude-src/"). The edit command should go straight into the wizard. The user doesn't need to know which config was loaded — the wizard shows the merged view with [G]/[P] badges, which is sufficient context.

### 5. Confirmation step shows scope changes and project config cleanup

**File:** `src/cli/components/wizard/step-confirm.tsx`

The confirmation step (last wizard step) must show:

- Skills that changed scope (P→G or G→P)
- Skills that were deselected

If, after the edit, there are zero project-scoped skills and zero project-scoped agents remaining, the confirmation step should warn that the project installation will be removed.

**Implementation notes:**

- The confirmation step currently has no concept of "before" state. It would need new props: previous skill configs and previous agent configs (passed from the wizard's initial state).
- Scope change detection currently happens post-wizard in `edit.tsx` (lines 203-224). Either this logic needs to be duplicated in the wizard store for the confirm step to display, or the confirm step needs to receive the previous configs and compute diffs itself.
- On confirm, the edit command runs the equivalent of `uninstall --all` scoped to the project directory. The `uninstall` command's cleanup logic is in private methods and uses `process.cwd()` internally, so it cannot be called as a function. The cleanup logic (removing `.claude-src/`, `.claude/agents/`, `.claude/skills/`, plugins) needs to be extracted into shared utility functions that both `uninstall` and `edit` can use, or `edit` should invoke `uninstall` via oclif's command runner: `this.config.runCommand('uninstall', ['--all', '--yes'])`.

---

## Edge Cases

### 1. Mixed-scope agents with cross-scope skills

A global agent referencing project skills is invalid (D7 cross-scope rule). `buildCompileAgents()` already enforces this by filtering. No change needed.

### 2. Removing a global skill from project context

Global skills are locked in project context (D9). The user cannot toggle them off. To remove global skills, edit from `~/`. Correct behavior. The user can still toggle any skill that isn't locked — they just can't remove something that belongs to global from a project edit.

### 3. First edit from project dir (no project config exists)

- Wizard shows the global config state (loaded via fallback)
- Global items are locked (the `isGlobalDir` fix at line 152 ensures this)
- If the user makes no changes → early return, no project config created
- If the user adds project-scoped items → project config created with import from global
- If the user only modifies global-scoped items → this cannot happen because global items are locked

### 4. Project config becomes empty after edit

User has a project config with project-scoped skills. They edit and either deselect them all or move them all to global scope. The project split is now empty. The confirmation step warns that the project installation will be removed. On confirm, `uninstall --all` runs scoped to the project directory.

### 5. Recompile after edit

The edit command already recompiles agents after saving. This behavior stays as-is.

### 6. GlobalConfigPrompt in init — remove

The `GlobalConfigPrompt` ("Edit global installation or create new project installation?") is no longer needed. The wizard shows the merged view with scope badges, and writes route by scope automatically. The user doesn't need to choose — they just edit, and global items go to `~/`, project items go to `<cwd>/`. Remove the prompt from `init.tsx` and go straight into the wizard when a global config exists but no project config does.

---

## Verification Plan

### Manual Tests

1. **Edit from project with only global config — add project skill:**
   - Setup: global config at `~/` with skills, no project config
   - Run `edit` from project dir, add a skill, press S to set scope to [P]
   - Verify: `<project>/.claude-src/config.ts` created with import from global, contains only the new skill
   - Verify: `~/.claude-src/config.ts` unchanged
   - Verify: global skills are locked (cannot toggle off)

2. **Edit from project with only global config — cannot modify global skills:**
   - Same setup
   - Verify: global skills show [G] badge and cannot be toggled off

3. **Edit from project with both configs — add project skill:**
   - Setup: both global and project configs exist
   - Run `edit`, add a new skill scoped to [P]
   - Verify: project config updated with new skill, global config unchanged

4. **Edit from `~/` — all items go to global:**
   - Run `edit` from home dir
   - Verify: only global config updated, no project config involved
   - Verify: nothing is locked (can toggle any skill)

5. **Edit from project — remove all project skills:**
   - Setup: project config with 2 project-scoped skills
   - Run `edit`, deselect both project skills
   - Verify: confirmation step warns about project installation removal
   - Verify: project `.claude-src/` and `.claude/` cleaned up after confirm

### Automated Tests

- Add test: edit with global-only installation, `process.cwd()` used for saves (not `installation.projectDir`)
- Add test: edit with global-only installation, global skills are locked
- Add test: edit with global-only + project-scoped additions creates project config
- Add test: edit with global-only + no changes does NOT create project config
- Add test: `writeScopedConfigs` skips project config file when project split is empty
- Add test: project config deleted (uninstall) when all project-scoped items removed

---

## Risks

### Existing installations unaffected

Users who have already run init/edit will have persisted scope per skill. This fix only changes write routing, not scope defaults. No migration needed.

### jiti import chain

Project config uses `import globalConfig from "~/.claude-src/config"`. If global config doesn't exist, jiti throws `MODULE_NOT_FOUND`. Mitigated by `ensureBlankGlobalConfig()` call before any project config write.

### No performance impact

`loadProjectConfig()` already does project-then-global fallback. The only new work is `ensureBlankGlobalConfig()` (single `fileExists` check) and the empty-project guard (checking two array lengths).
