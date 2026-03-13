# Unified Config View with Split Writes

**Date:** 2026-03-13
**Status:** Design
**Related:** D-37-dual-installation.md, D-65-init-edit-scope.md, per-skill-scope-bugs.md

---

## Problem Statement

When a user runs `edit` from a project directory, the wizard shows the merged view of global + project skills (correct), but the post-wizard write logic has a gap: **ALL changes -- including project-scoped skills -- are written to the global config when `detectInstallation()` falls back to the global installation.** The user sees one unified interface but changes don't always route to the correct config file.

The desired behavior: the wizard always shows a **merged view**, but writes route by scope -- global-scoped items to `~/.claude-src/config.ts`, project-scoped items to `<project>/.claude-src/config.ts`.

---

## Current Behavior (end-to-end trace)

### 1. `edit.tsx` startup

```
detectInstallation() -> checks projectDir first, falls back to global
  returns Installation { projectDir, configPath, agentsDir, skillsDir }
```

When no project config exists but a global one does, `projectDir` is set to `os.homedir()` and the user sees the info message "No project installation found. Using global installation from ~/.claude-src/".

### 2. Loading existing state

```
loadProjectConfig(projectDir)
  -> loadProjectConfigFromDir(projectDir)  // project first
  -> if null, loadProjectConfigFromDir(homeDir)  // global fallback
```

Because `config.ts` uses TypeScript imports (`import globalConfig from "~/.claude-src/config"`), when the project config exists it already includes global items via the spread. The loaded config is already the merged view.

### 3. Determining locked items (D9)

```typescript
const isGlobalDir = projectDir === GLOBAL_INSTALL_ROOT;
const lockedSkillIds = isGlobalDir
  ? undefined // editing from ~/ -> nothing locked
  : projectConfig?.config?.skills?.filter((s) => s.scope === "global").map((s) => s.id);
const lockedAgentNames = isGlobalDir
  ? undefined
  : projectConfig?.config?.agents?.filter((a) => a.scope === "global").map((a) => a.name);
```

Global items are locked (non-toggleable) when editing from a project context. This is correct.

### 4. Wizard renders merged view

The wizard receives `installedSkillIds`, `installedSkillConfigs`, `installedAgentConfigs`, `lockedSkillIds`, `lockedAgentNames`. It shows all skills with scope badges ([G]/[P]) and prevents toggling locked items.

### 5. Post-wizard: computing diffs

```typescript
const newSkillIds = result.skills.map((s) => s.id);
const addedSkills = newSkillIds.filter((id) => !currentSkillIds.includes(id));
const removedSkills = currentSkillIds.filter((id) => !newSkillIds.includes(id));
// Also: sourceChanges, scopeChanges, agentScopeChanges
```

This correctly computes what changed.

### 6. Post-wizard: persisting config (THE KEY SECTION)

```typescript
const mergeResult = await buildAndMergeConfig(result, sourceResult, projectDir, flags.source);
// ...
await writeScopedConfigs(mergeResult.config, matrix, agents, projectDir, installation.configPath);
```

`writeScopedConfigs()` already handles split writes correctly:

- If `projectDir !== homeDir` (project context): calls `splitConfigByScope()` to partition into global/project, writes global to `~/.claude-src/config.ts`, writes project to `<project>/.claude-src/config.ts` with import from global.
- If `projectDir === homeDir` (global context): writes single standalone config.

### 7. Post-wizard: plugin install/uninstall

Plugin operations correctly use per-skill scope to determine `--scope user` vs `--scope project`.

### 8. Post-wizard: recompilation

```typescript
const agentScopeMap = new Map(result.agentConfigs.map(a => [a.name, a.scope]));
await recompileAgents({ ..., agentScopeMap });
```

Agent recompilation correctly routes global agents to `~/.claude/agents/` and project agents to `<project>/.claude/agents/`.

---

## What Already Works

Most of the "Unified Config View with Split Writes" feature is already implemented as part of D-37 phases 1-5:

1. **Config splitting** -- `splitConfigByScope()` in `config-generator.ts` partitions skills, agents, stack, domains, selectedAgents by scope.
2. **Scoped config writing** -- `writeScopedConfigs()` in `local-installer.ts` writes global config to `~/`, project config (with import) to `<project>/`.
3. **Scoped config-types writing** -- Global gets standalone types narrowed to global items; project gets types that import/extend global.
4. **Wizard scope tracking** -- `skillConfigs[]` and `agentConfigs[]` carry `scope` per item. S key toggles scope. [G]/[P] badges.
5. **Locked items** -- Global items are read-only in project context (D9).
6. **Plugin routing** -- `--scope user` for global, `--scope project` for project.
7. **Agent routing** -- `agentScopeMap` routes compiled agents to the correct directory.
8. **Local skill routing** -- `installLocal()` splits skills by scope and copies to the correct directory.
9. **Compile dual-pass** -- `compile.ts` runs separate global and project compilation passes.
10. **Auto-create blank global** -- `init.tsx` calls `ensureBlankGlobalConfig()` on first project init.

---

## Remaining Gap Analysis

After tracing all code paths, the actual remaining gaps are narrower than initially assumed:

### Gap 1: Edit from global-fallback context misroutes writes

**Scenario:** User has a global installation at `~/` but no project config. They run `edit` from a project directory.

**What happens:**

1. `detectInstallation()` falls back to global -> `installation.projectDir = os.homedir()`
2. The edit flow runs as if editing the global config directly
3. `writeScopedConfigs()` receives `projectDir = homeDir`, so `isProjectContext = false`
4. ALL items (including any that should be project-scoped) are written as a standalone global config

**Root cause:** When `detectInstallation()` falls back to global, the edit command has no project config path to write to. It treats the entire session as a global edit.

**Fix:** When the user is in a project directory but `detectInstallation()` falls back to global, the edit flow should:

- Still load the global config as the initial state
- Still show the merged view (which is just the global config in this case)
- BUT when saving, use `process.cwd()` as the project directory for `writeScopedConfigs()`, not `installation.projectDir`
- Create the project `.claude-src/` directory if needed

This way, if the user adds project-scoped items during edit, they get written to the project config. Global-scoped items go to the global config.

### Gap 2: No project config auto-creation during edit

**Scenario:** User has only a global config, runs `edit`, adds a project-scoped skill.

**What happens:** The skill's scope is set to "project" in the wizard, but on save, `writeScopedConfigs()` writes everything to the global config (because `projectDir === homeDir`).

**Fix:** `edit.tsx` should distinguish between the actual working directory (`process.cwd()`) and the installation's project directory. When they differ and the result contains project-scoped items, it should:

1. Ensure `<cwd>/.claude-src/` exists
2. Ensure a blank global config exists (via `ensureBlankGlobalConfig()`)
3. Call `writeScopedConfigs()` with `projectDir = process.cwd()`

### Gap 3: `mergeWithExistingConfig` uses `loadProjectConfig` which has global fallback

**In `config-merger.ts`:**

```typescript
const existingFullConfig = await loadProjectConfig(context.projectDir);
```

When `context.projectDir` is a project dir without a config, `loadProjectConfig()` falls back to the global config. This means `mergeWithExistingConfig()` merges with the global config even when creating a new project config. This is actually correct behavior -- the global config values should be preserved. But it means the resulting `mergeResult.config` contains both global and project items, which is what `splitConfigByScope()` then partitions.

**Verdict:** This is already working correctly. No change needed.

### Gap 4: Default scope for new skills during edit

**In `wizard-store.ts`:**

```typescript
function createDefaultSkillConfig(id: SkillId): SkillConfig {
  return { id, scope: "global", source: primarySource ?? DEFAULT_PUBLIC_SOURCE_NAME };
}
```

New skills default to `scope: "global"`. Per D4 in D-37, the default should be `scope: "project"`. This means a user adding skills in the wizard will have them default to global scope, which is the opposite of the intended behavior.

**Fix:** Change the default scope from `"global"` to `"project"`.

**Impact:** Also affects `toggleAgent` which defaults new agents to `scope: "global"`:

```typescript
agentConfigs: [...state.agentConfigs, { name: agent, scope: "global" as const }],
```

And `preselectAgentsFromDomains`:

```typescript
agentConfigs: sorted.map((name) => ({ name, scope: "global" as const })),
```

These should also default to `"project"`.

---

## Proposed Changes

### Phase 1: Fix default scope (quick win)

**Files:**

- `src/cli/stores/wizard-store.ts`

**Changes:**

1. `createDefaultSkillConfig()`: change `scope: "global"` to `scope: "project"`
2. `toggleAgent` action: change default scope from `"global"` to `"project"`
3. `preselectAgentsFromDomains` action: change default scope from `"global"` to `"project"`

**Risk:** Low. Users who want global scope explicitly press S to toggle. This matches D4.

### Phase 2: Fix edit context routing

**Files:**

- `src/cli/commands/edit.tsx`

**Changes:**

The core fix is to track two separate directories:

- `installationDir`: where the existing installation was found (could be `~` or `cwd`)
- `workingDir`: the user's actual working directory (`process.cwd()`)

Currently, `edit.tsx` uses `installation.projectDir` everywhere. Instead:

```
const workingDir = process.cwd();
const installation = await detectInstallation();
// installation.projectDir may be os.homedir() if no project config exists
```

When saving:

```
// Use workingDir for writeScopedConfigs so project-scoped items
// go to <cwd>/.claude-src/ rather than ~/.claude-src/
const saveDir = workingDir;

// Ensure blank global config exists (needed for import)
await ensureBlankGlobalConfig();

// writeScopedConfigs uses saveDir to determine isProjectContext
await writeScopedConfigs(mergeResult.config, matrix, agents, saveDir, configPath);
```

Where `configPath` is `path.join(saveDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS)`.

The key insight: `writeScopedConfigs()` already handles the split correctly when `projectDir !== homeDir`. The fix is just passing the correct directory.

**Detailed changes in `edit.tsx`:**

1. Introduce `workingDir = process.cwd()` at the top of `run()`
2. Continue using `installation.projectDir` for loading existing state (skills, config)
3. When computing the save directory, use `workingDir` instead of `installation.projectDir`
4. Before calling `writeScopedConfigs()`, call `ensureBlankGlobalConfig()` if `workingDir !== os.homedir()`
5. Update `recompileAgents` call to use the correct output directory based on `workingDir`

**Edge case:** If `workingDir` has no `.claude-src/` directory, `writeScopedConfigs()` calls `ensureDir()` to create it. This is already handled.

**Edge case:** If the user is already in `~/` (editing global directly), `workingDir === homeDir` so `isProjectContext = false` and everything writes to global. This is correct.

### Phase 3: Handle scope changes during edit (file migration)

This is already implemented in `edit.tsx`:

```typescript
// Handle scope migrations (P->G or G->P) for local-mode skills
for (const [skillId, change] of scopeChanges) {
  const skillConfig = result.skills.find((s) => s.id === skillId);
  if (skillConfig?.source === "local") {
    await migrateLocalSkillScope(skillId, change.from, projectDir);
  } else if (sourceResult.marketplace && skillConfig) {
    await claudePluginUninstall(skillId, oldPluginScope, projectDir);
    await claudePluginInstall(pluginRef, newPluginScope, projectDir);
  }
}
```

**Remaining fix:** The `projectDir` passed to `migrateLocalSkillScope` should be `workingDir`, not `installation.projectDir`, to ensure local skill files are migrated relative to the correct directories.

---

## File-by-File Change Summary

| File                             | Change                                                                                                                        | Phase |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----- |
| `src/cli/stores/wizard-store.ts` | Change default scope from "global" to "project" in `createDefaultSkillConfig`, `toggleAgent`, `preselectAgentsFromDomains`    | 1     |
| `src/cli/commands/edit.tsx`      | Introduce `workingDir` separate from `installation.projectDir`; use `workingDir` for save operations and recompilation output | 2     |
| `src/cli/commands/edit.tsx`      | Call `ensureBlankGlobalConfig()` before saving when in project context                                                        | 2     |

---

## Edge Cases

### 1. Mixed-scope agents with cross-scope skills

A global agent referencing project skills would be invalid (D7 cross-scope rule). `buildCompileAgents()` in `local-installer.ts` already enforces this:

```typescript
const filteredRefs =
  agentConfig.scope === "global" ? refs.filter((ref) => globalSkillIds.has(ref.id)) : refs;
```

No change needed.

### 2. Removing a global skill from project context

Global skills are locked in project context (D9). The user cannot remove them. To remove global skills, edit from `~/`. This is the correct behavior.

### 3. Migration from single-config (no project config exists)

When the user first runs `edit` from a project directory with only a global config:

- The wizard shows the global config state
- If the user makes no changes, no project config is created (early return on "no changes")
- If the user adds project-scoped items, a project config is created with an import from global
- If the user only modifies global-scoped items, only the global config is updated

### 4. Init creates project + global correctly

`init.tsx` already calls `ensureBlankGlobalConfig()` when not in the home directory, and the `installLocal` / `installPluginConfig` functions call `writeScopedConfigs()` with the project directory. This is already correct.

### 5. Compile after scoped edit

`compile.ts` runs dual passes (global + project) when both installations exist. After a scoped edit that creates a project config for the first time, `detectProjectInstallation(cwd)` will find the newly-created config and `compile` will run both passes. This is already correct.

### 6. Skill in both global and project local directories

The compiler's merge strategy (in `compile.ts:discoverAllSkills()`) loads global local skills first, then project local skills. Project wins on conflict (later sources override). This is already correct.

---

## Is the GlobalConfigPrompt Still Needed?

Yes. The `GlobalConfigPrompt` in `init.tsx` serves a different purpose: it asks the user whether to **edit the existing global installation** or **create a new project installation** when running `init` in a directory without a project config but where a global config exists.

This prompt remains useful because:

- "Edit global" dispatches to the `edit` command (editing `~/` directly)
- "Create project" falls through to the wizard, which creates a new project config that imports from global

No changes needed to this prompt.

---

## Verification Plan

### Manual Tests

1. **Edit from project with only global config -- add project skill:**
   - Setup: global config at `~/` with skills, no project config
   - Run `edit` from project dir, add a skill with default scope (should be [P])
   - Verify: project `.claude-src/config.ts` created with import from global, contains only the new skill
   - Verify: global `~/.claude-src/config.ts` unchanged

2. **Edit from project with only global config -- modify global skill:**
   - Setup: same as above
   - Run `edit`, toggle a global skill's source
   - Verify: global config updated, no project config created (all items remain global)

3. **Edit from project with both configs -- add project skill:**
   - Setup: both global and project configs exist
   - Run `edit`, add a new skill (defaults to [P])
   - Verify: project config updated with new skill, global config unchanged

4. **Edit from `~/` -- all items go to global:**
   - Run `edit` from home dir
   - Verify: only global config updated, no project config involved

5. **Default scope is project:**
   - Run `init` or `edit`, add skills without pressing S
   - Verify: all new skills default to [P] scope

### Automated Tests

- Update existing edit command tests to verify `workingDir` vs `installation.projectDir` routing
- Add test: edit with global-only installation creates project config when project-scoped items added
- Add test: edit with global-only installation does NOT create project config when no changes or only global changes
- Add test: default skill scope is "project" not "global"
- Add test: default agent scope is "project" not "global"

---

## Risks and Open Questions

### Risk 1: Existing installations with "global" default scope

Users who have already run init/edit will have skills defaulting to `scope: "global"`. Changing the default to "project" won't affect existing configs (scope is persisted per skill). But new installations will behave differently. This is acceptable for pre-1.0.

### Risk 2: Config loading performance

No additional performance impact. `loadProjectConfig()` already tries project then falls back to global. The only new work is `ensureBlankGlobalConfig()` which is a single `fileExists` check in the common case.

### Risk 3: jiti import chain

The project config uses `import globalConfig from "~/.claude-src/config"` which jiti resolves at load time. If the global config doesn't exist, jiti throws `MODULE_NOT_FOUND`. This is already handled by `ensureBlankGlobalConfig()` which creates blank configs before any project config is written.

### Open Question: Should edit auto-create project config?

Currently, if the user runs `edit` from a project dir (with only global config) and adds a single project-scoped skill, a project config is created. Is this the right UX? The alternative is to warn: "You're adding project-scoped items but no project config exists. Run `init` first."

**Recommendation:** Auto-create. The user explicitly scoped items to "project" -- the intent is clear. Requiring `init` first adds friction for no benefit. The blank global config pattern (already in place) ensures the import chain works.

### Open Question: Should `writeScopedConfigs` create an empty project config?

When the split produces an empty project config (all items are global), should the project config file still be created? Currently, `writeScopedConfigs()` always writes both. An empty project config with just `import globalConfig` and `{ ...globalConfig }` is harmless but adds a file.

**Recommendation:** Only write the project config if it has project-scoped items. If all items are global, don't create/update the project config. This avoids creating unnecessary files when the user edits only global items from a project directory.
