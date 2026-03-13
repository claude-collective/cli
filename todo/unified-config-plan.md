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

## The Bug

**Scenario:** User has a global installation at `~/` but no project config. They run `edit` from `/home/user/my-project/`.

1. `detectInstallation()` checks `/home/user/my-project/.claude-src/config.ts` — not found
2. Falls back to global → `installation.projectDir = os.homedir()`
3. `edit.tsx` sets `const projectDir = installation.projectDir` (now `~/`)
4. Every downstream call uses this `projectDir`:
   - `writeScopedConfigs(..., projectDir, ...)` → sees `projectDir === homeDir` → `isProjectContext = false`
   - Writes everything as a standalone global config
   - Project-scoped items silently land in `~/.claude-src/config.ts`

**Root cause:** `edit.tsx` uses `installation.projectDir` for writes. When installation falls back to global, this is `~/` instead of the user's actual working directory.

---

## The Fix

### 1. Use `process.cwd()` for save operations in `edit.tsx`

**File:** `src/cli/commands/edit.tsx`

Use `installation.projectDir` for **reading** existing state (loading config, discovering installed skills). Use `process.cwd()` for **writing** (config saves, plugin installs, scope migrations, recompilation output).

Every `projectDir` reference in the post-wizard section of `edit.tsx` that feeds into a write operation must use `process.cwd()`:

| Line    | Current call                                                                                     | What changes                                                 |
| ------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 297     | `executeMigration(migrationPlan, projectDir, ...)`                                               | `projectDir` → `cwd`                                         |
| 313     | `migrateLocalSkillScope(skillId, change.from, projectDir)`                                       | `projectDir` → `cwd`                                         |
| 319     | `claudePluginUninstall(skillId, oldPluginScope, projectDir)`                                     | `projectDir` → `cwd`                                         |
| 321     | `claudePluginInstall(pluginRef, newPluginScope, projectDir)`                                     | `projectDir` → `cwd`                                         |
| 335     | `deleteLocalSkill(projectDir, skillId)`                                                          | `projectDir` → `cwd`                                         |
| 348+    | Plugin install loop `projectDir`                                                                 | `projectDir` → `cwd`                                         |
| 394     | `buildAndMergeConfig(..., projectDir, ...)`                                                      | `projectDir` → `cwd`                                         |
| 401-407 | `writeScopedConfigs(..., projectDir, installation.configPath)`                                   | `projectDir` → `cwd`, `configPath` → recomputed from `cwd`   |
| 414     | `discoverAllPluginSkills(projectDir)`                                                            | `projectDir` → `cwd`                                         |
| 420-428 | `recompileAgents({ pluginDir: projectDir, projectDir, outputDir: installation.agentsDir, ... })` | All three → `cwd` and `path.join(cwd, CLAUDE_DIR, "agents")` |

**Critical:** `installation.configPath` also needs recomputing. When installation falls back to global, `installation.configPath` points to `~/.claude-src/config.ts`. But `writeScopedConfigs` uses this parameter as the **project** config path (line 452 of local-installer.ts). Must recompute: `path.join(cwd, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS)`.

**When `cwd === os.homedir()`:** Everything works unchanged — `isProjectContext = false` in `writeScopedConfigs`, single standalone config written. No edge case.

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

// Always write global config
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

Remove the message at line 99-103 ("No project installation found. Using global installation from ~/.claude-src/"). The edit command should go straight into the wizard regardless of whether it found a project config or a global config. The user doesn't need to know which config was loaded — the wizard shows the merged view with [G]/[P] badges, which is sufficient context.

### 5. No auto-recompile after scoped edit

The edit command does NOT need to recompile after creating a new project config. The user should run `compile` separately. This keeps the edit command focused on config changes and avoids surprising side effects when a project config is created for the first time.

---

## Edge Cases

### 1. Mixed-scope agents with cross-scope skills

A global agent referencing project skills is invalid (D7 cross-scope rule). `buildCompileAgents()` already enforces this by filtering. No change needed.

### 2. Removing a global skill from project context

Global skills are locked in project context (D9). The user cannot remove them. To remove global skills, edit from `~/`. Correct behavior.

### 3. First edit from project dir (no project config exists)

- Wizard shows the global config state (loaded via fallback)
- If the user makes no changes → early return, no project config created
- If the user adds project-scoped items → project config created with import from global
- If the user only modifies global-scoped items → only global config updated, no project config created (empty project guard)

### 4. Compile after scoped edit

`compile.ts` runs dual passes when both installations exist. After an edit that creates a project config for the first time, `detectProjectInstallation(cwd)` finds the new config and compile runs both passes. Already correct.

### 5. GlobalConfigPrompt in init

Still needed. It asks whether to edit the existing global or create a new project installation. Unrelated to this fix.

---

## Verification Plan

### Manual Tests

1. **Edit from project with only global config — add project skill:**
   - Setup: global config at `~/` with skills, no project config
   - Run `edit` from project dir, add a skill, press S to set scope to [P]
   - Verify: `<project>/.claude-src/config.ts` created with import from global, contains only the new skill
   - Verify: `~/.claude-src/config.ts` unchanged

2. **Edit from project with only global config — modify global skill only:**
   - Same setup
   - Run `edit`, change a global skill's source (don't add project-scoped items)
   - Verify: global config updated, NO project config created

3. **Edit from project with both configs — add project skill:**
   - Setup: both global and project configs exist
   - Run `edit`, add a new skill scoped to [P]
   - Verify: project config updated with new skill, global config unchanged

4. **Edit from `~/` — all items go to global:**
   - Run `edit` from home dir
   - Verify: only global config updated, no project config involved

### Automated Tests

- Add test: edit with global-only installation, `process.cwd()` used for saves (not `installation.projectDir`)
- Add test: edit with global-only + project-scoped additions creates project config
- Add test: edit with global-only + global-only changes does NOT create project config
- Add test: `writeScopedConfigs` skips project config file when project split is empty

---

## Risks

### Existing installations unaffected

Users who have already run init/edit will have persisted scope per skill. This fix only changes write routing, not scope defaults. No migration needed.

### jiti import chain

Project config uses `import globalConfig from "~/.claude-src/config"`. If global config doesn't exist, jiti throws `MODULE_NOT_FOUND`. Mitigated by `ensureBlankGlobalConfig()` call before any project config write.

### No performance impact

`loadProjectConfig()` already does project-then-global fallback. The only new work is `ensureBlankGlobalConfig()` (single `fileExists` check) and the empty-project guard (checking two array lengths).
