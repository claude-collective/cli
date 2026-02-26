# D-36: Global Install Support with Project-Level Override

## Implementation Overview

Add a `--global` flag to `agentsinc init` that installs to `~/.claude-src/config.yaml` and `~/.claude/skills/` + `~/.claude/agents/` instead of the current working directory. Extend `detectInstallation()` with a home-directory fallback: check `{cwd}` first, then `~/` — project fully overrides global (no merging in Phase 1). Add `InstallScope = "project" | "global"` to the `Installation` type. Update `edit`, `compile`, and `outdated` commands to use `installation.projectDir` instead of `process.cwd()`. Plugin mode uses `--scope user` for global installs. About 11 files modified, mostly low-complexity plumbing to thread the resolved directory through existing code paths.

## Current State Analysis

### How installation detection works today

**File:** `src/cli/lib/installation/installation.ts`

`detectInstallation(projectDir)` checks only the provided `projectDir` (defaults to `process.cwd()`):

1. Looks for `{projectDir}/.claude-src/config.yaml` (line 26)
2. Falls back to `{projectDir}/.claude/config.yaml` (legacy, line 27)
3. If neither exists, returns `null` (line 35-37)
4. If found, loads the project config to read `installMode` (line 39-41)
5. Returns an `Installation` object with `mode`, `configPath`, `agentsDir`, `skillsDir`, `projectDir`

**No home-directory fallback exists.** If neither path has config, it returns `null` and every consumer treats that as "not installed."

### How project source config works today

**File:** `src/cli/lib/configuration/config.ts`

`loadProjectSourceConfig(projectDir)` loads the `.claude-src/config.yaml` (or legacy `.claude/config.yaml`) from the given project directory. This config contains `source`, `marketplace`, `author`, `sources`, `boundSkills`, `branding`, and path overrides.

**No home-directory fallback.** Returns `null` if neither file exists in the project.

### How project config (full) works today

**File:** `src/cli/lib/configuration/project-config.ts`

`loadProjectConfig(projectDir)` loads the full `ProjectConfig` (name, agents, skills, stack, installMode, etc.) from `.claude-src/config.yaml` or `.claude/config.yaml`.

**No home-directory fallback.** Returns `null` if neither file exists.

### How local skill discovery works today

**File:** `src/cli/lib/skills/local-skill-loader.ts`

`discoverLocalSkills(projectDir)` scans `{projectDir}/.claude/skills/` for skill directories containing `SKILL.md` + `metadata.yaml`.

**No home-directory fallback.** Returns `null` if the directory doesn't exist.

### How plugin settings work today

**File:** `src/cli/lib/plugins/plugin-settings.ts`

`getEnabledPluginKeys(projectDir)` reads `{projectDir}/.claude/settings.json` for enabled plugin keys. `resolvePluginInstallPaths()` looks up the global registry at `~/.claude/plugins/installed_plugins.json`.

**Plugin key reading has no home-level fallback.** But the install path registry is already global.

### How permission checking works today

**File:** `src/cli/lib/permission-checker.tsx`

`checkPermissions(projectRoot)` reads `{projectRoot}/.claude/settings.local.json` and `{projectRoot}/.claude/settings.json` for permission config.

**No home-directory fallback.**

### How install paths are resolved today

**File:** `src/cli/lib/installation/local-installer.ts`

`resolveInstallPaths(projectDir)` (line 99-105) returns hardcoded paths under `projectDir`:
- `skillsDir`: `{projectDir}/.claude/skills`
- `agentsDir`: `{projectDir}/.claude/agents`
- `configPath`: `{projectDir}/.claude-src/config.yaml`

**No concept of a global target directory.**

### How commands use installation today

- **`init.tsx`** (line 82): Calls `detectExistingInstallation(projectDir)` to check for existing install. If found, warns and suggests `edit`. Always installs to `process.cwd()`.
- **`edit.tsx`** (line 62): Calls `detectInstallation()` (no args, defaults to `process.cwd()`). If not found, errors with `NO_INSTALLATION`.
- **`compile.ts`** (line 156): Calls `detectInstallation()`. If not found, errors. Uses `installation.agentsDir` and `installation.projectDir`.
- **`outdated.ts`** (line 69-70): Uses `process.cwd()` directly for local skills path check. No installation detection.

---

## Design Decisions

### Resolution Order (Phase 1: Full Override)

1. Check `{cwd}/.claude-src/config.yaml` -- if found, use **project-level** exclusively
2. If not found, check `~/.claude-src/config.yaml` -- if found, use **global** exclusively
3. If neither found, error: "No installation found"

**No merging.** Project completely replaces global. This is intentional for Phase 1 simplicity.

### Global Installation Directory Layout

```
~/.claude-src/config.yaml       # Global source config (source, marketplace, branding, etc.)
~/.claude/skills/               # Global skills directory (local mode)
~/.claude/agents/               # Global compiled agents
~/.claude/settings.json         # Global plugin settings (already exists for Claude CLI)
~/.claude/plugins/              # Global plugin cache (already exists)
```

This mirrors the project layout but rooted at `$HOME` instead of `{cwd}`.

### Scope Concept

Add an `InstallScope` type:

```typescript
export type InstallScope = "project" | "global";
```

The `Installation` type gains a `scope` field so consumers know where the installation lives.

### Flag Design

- `agentsinc init --global` -- installs to home directory
- `agentsinc init` (no flag) -- installs to `{cwd}` (unchanged behavior)
- `agentsinc edit`, `agentsinc compile`, `agentsinc outdated` -- auto-detect via resolution order (no new flags needed)

---

## Step-by-Step Implementation Plan

### Step 1: Add Constants for Global Paths

**File:** `src/cli/consts.ts`

Add:

```typescript
import os from "os"; // already imported

/** Home directory used as the root for global installations */
export const GLOBAL_INSTALL_ROOT = os.homedir();
```

No new path constants needed -- the existing `CLAUDE_SRC_DIR`, `CLAUDE_DIR`, `LOCAL_SKILLS_PATH` are all relative and will be joined with either `projectDir` or `GLOBAL_INSTALL_ROOT`.

### Step 2: Extend the `Installation` Type

**File:** `src/cli/lib/installation/installation.ts`

Add `scope` to the `Installation` type:

```typescript
export type InstallScope = "project" | "global";

export type Installation = {
  mode: InstallMode;
  scope: InstallScope;
  configPath: string;
  agentsDir: string;
  skillsDir: string;
  projectDir: string;
};
```

### Step 3: Update `detectInstallation()` with Home-Level Fallback

**File:** `src/cli/lib/installation/installation.ts`

Modify `detectInstallation()` to accept an optional `enableGlobalFallback` parameter (default `true`):

```typescript
export async function detectInstallation(
  projectDir: string = process.cwd(),
): Promise<Installation | null> {
  // 1. Check project-level first (existing logic)
  const projectInstallation = await detectProjectInstallation(projectDir);
  if (projectInstallation) return projectInstallation;

  // 2. Fall back to global (home directory)
  const globalInstallation = await detectGlobalInstallation();
  return globalInstallation;
}
```

Extract the existing project-level detection into `detectProjectInstallation()`. Add a new `detectGlobalInstallation()` that does the same check but rooted at `os.homedir()`.

Key detail: For global installations, `projectDir` in the `Installation` should be `os.homedir()`, not `process.cwd()`. This ensures all path calculations are correct.

```typescript
async function detectProjectInstallation(
  projectDir: string,
): Promise<Installation | null> {
  // Existing logic from current detectInstallation(), with scope: "project"
}

async function detectGlobalInstallation(): Promise<Installation | null> {
  const homeDir = os.homedir();
  const srcConfigPath = path.join(homeDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);

  if (!(await fileExists(srcConfigPath))) return null;

  const loaded = await loadProjectConfig(homeDir);
  const mode: InstallMode = loaded?.config?.installMode ?? "local";

  if (mode === "local") {
    return {
      mode: "local",
      scope: "global",
      configPath: srcConfigPath,
      agentsDir: path.join(homeDir, CLAUDE_DIR, "agents"),
      skillsDir: path.join(homeDir, CLAUDE_DIR, "skills"),
      projectDir: homeDir,
    };
  }

  return {
    mode: "plugin",
    scope: "global",
    configPath: srcConfigPath,
    agentsDir: path.join(homeDir, CLAUDE_DIR, "agents"),
    skillsDir: path.join(homeDir, CLAUDE_DIR, PLUGINS_SUBDIR),
    projectDir: homeDir,
  };
}
```

### Step 4: Update `loadProjectSourceConfig()` with Home-Level Fallback

**File:** `src/cli/lib/configuration/config.ts`

The `loadProjectSourceConfig()` function is called by `resolveSource()`, `resolveAgentsSource()`, `resolveAuthor()`, `resolveBranding()`, `resolveAllSources()`, and `loadAndMergeFromBasePath()`.

When called with a `projectDir`, it should also fall back to home. But we need to be careful: when called from `loadAndMergeFromBasePath(basePath)` (line 172 of source-loader.ts), `basePath` is the source repository path, not the consumer project. We should NOT fall back to home in that case.

**Strategy:** Add a separate `loadGlobalSourceConfig()` function. Modify consumers that need fallback behavior to call project-level first, then global. Do NOT modify `loadProjectSourceConfig()` itself -- it should remain project-scoped.

```typescript
export async function loadGlobalSourceConfig(): Promise<ProjectSourceConfig | null> {
  const homeDir = os.homedir();
  const globalConfigPath = path.join(homeDir, CLAUDE_SRC_DIR, PROJECT_CONFIG_FILE);

  if (!(await fileExists(globalConfigPath))) {
    verbose(`Global config not found at ${globalConfigPath}`);
    return null;
  }

  const data = await safeLoadYamlFile(globalConfigPath, projectSourceConfigSchema);
  if (!data) return null;

  verbose(`Loaded global config from ${globalConfigPath}`);
  return data as ProjectSourceConfig;
}
```

Then update `resolveSource()` to add a global fallback:

```typescript
export async function resolveSource(
  flagValue?: string,
  projectDir?: string,
): Promise<ResolvedConfig> {
  const projectConfig = projectDir ? await loadProjectSourceConfig(projectDir) : null;
  // If no project config found, try global
  const effectiveConfig = projectConfig ?? (await loadGlobalSourceConfig());
  const marketplace = effectiveConfig?.marketplace;

  // ... rest of resolution uses effectiveConfig instead of projectConfig
}
```

Similarly update: `resolveAgentsSource()`, `resolveAuthor()`, `resolveBranding()`, `resolveAllSources()`.

### Step 5: Update `loadProjectConfig()` (Full Config) with Home-Level Fallback

**File:** `src/cli/lib/configuration/project-config.ts`

Add the same fallback pattern. The full `loadProjectConfig()` is used by:
- `edit.tsx` line 93: to read existing config for wizard pre-selection
- `compile.ts`: to read config for plugin mode
- `installation.ts` line 39: to read `installMode`

```typescript
export async function loadProjectConfig(projectDir: string): Promise<LoadedProjectConfig | null> {
  // Existing project-level check
  const projectResult = await loadProjectConfigFromDir(projectDir);
  if (projectResult) return projectResult;

  // Global fallback
  const homeDir = os.homedir();
  if (projectDir !== homeDir) {
    return loadProjectConfigFromDir(homeDir);
  }

  return null;
}
```

Extract existing logic into `loadProjectConfigFromDir()`.

### Step 6: Update `discoverLocalSkills()` with Home-Level Fallback

**File:** `src/cli/lib/skills/local-skill-loader.ts`

The source loader (`loadSkillsMatrixFromSource()` at source-loader.ts line 87) calls `discoverLocalSkills(resolvedProjectDir)`. If the project has no `.claude/skills/`, we should check the home directory.

**However:** This function is called from `source-loader.ts` which is a "discovery during load" path. The `resolvedProjectDir` passed in is either the explicit `projectDir` or `process.cwd()`. If we modify `discoverLocalSkills` to fallback, we need to ensure it doesn't double-discover when `projectDir` is already the home dir.

**Strategy:** Don't modify `discoverLocalSkills()` itself. Instead, modify `loadSkillsMatrixFromSource()` in `source-loader.ts` to try both project and global:

```typescript
// In loadSkillsMatrixFromSource():
const resolvedProjectDir = projectDir || process.cwd();
let localSkillsResult = await discoverLocalSkills(resolvedProjectDir);

// If no local skills in project, try global
if (!localSkillsResult || localSkillsResult.skills.length === 0) {
  const homeDir = os.homedir();
  if (resolvedProjectDir !== homeDir) {
    localSkillsResult = await discoverLocalSkills(homeDir);
  }
}
```

### Step 7: Update `getEnabledPluginKeys()` with Home-Level Fallback

**File:** `src/cli/lib/plugins/plugin-settings.ts`

Currently reads `{projectDir}/.claude/settings.json`. For global installs, the settings might be at `~/.claude/settings.json`.

**Strategy:** The consumers of this function already pass `projectDir`. When `detectInstallation()` returns a global installation, `installation.projectDir` will be `os.homedir()`, so the existing code will naturally read `~/.claude/settings.json`. **No change needed here** -- the fix flows through `detectInstallation()`.

### Step 8: Update `checkPermissions()` with Home-Level Fallback

**File:** `src/cli/lib/permission-checker.tsx`

Same reasoning as Step 7. When the installation is global, `projectRoot` passed in will be `os.homedir()`, so it will check `~/.claude/settings.json` and `~/.claude/settings.local.json`. **No change needed here** if callers pass the right `projectRoot`.

**However:** In `init.tsx` and `edit.tsx`, `checkPermissions(projectDir)` is called with `process.cwd()`. This needs to change:
- In `init.tsx` line 295: pass the actual install target directory (either `process.cwd()` or `os.homedir()`)
- In `edit.tsx`: pass `installation.projectDir` instead of `process.cwd()`

### Step 9: Update `resolveInstallPaths()` in Local Installer

**File:** `src/cli/lib/installation/local-installer.ts`

`resolveInstallPaths()` takes `projectDir` and returns paths under it. Since `installLocal()` and `installPluginConfig()` receive `projectDir` from the caller, and the caller will pass either `process.cwd()` or `os.homedir()`, **no change needed here** -- it's already parameterized.

### Step 10: Update `init.tsx` -- Add `--global` Flag

**File:** `src/cli/commands/init.tsx`

Changes:
1. Add `--global` flag:
   ```typescript
   static flags = {
     ...BaseCommand.baseFlags,
     global: Flags.boolean({
       char: "g",
       description: "Install globally to home directory (~/.claude-src/)",
       default: false,
     }),
     refresh: Flags.boolean({ ... }),
   };
   ```

2. Determine target directory based on flag:
   ```typescript
   const projectDir = flags.global ? os.homedir() : process.cwd();
   ```

3. Update the existing installation check (line 82-91) to check the target directory:
   ```typescript
   const existingInstallation = await detectExistingInstallation(projectDir);
   ```

4. Pass `projectDir` (instead of hardcoded `process.cwd()`) through to:
   - `loadSkillsMatrixFromSource()` (line 96-101)
   - `installLocal()` / `installPluginConfig()` (via `handleInstallation`)
   - `checkPermissions()` (lines 295, 357)
   - Wizard's `projectDir` prop (line 117)

5. When `--global` is used with plugin mode, use `--scope user` instead of `--scope project`:
   ```typescript
   const pluginScope = flags.global ? "user" : "project";
   await claudePluginInstall(pluginRef, pluginScope, projectDir);
   ```

6. Update user-facing messages to indicate global vs project install:
   ```typescript
   if (flags.global) {
     this.log("Installing globally to home directory...");
   }
   ```

### Step 11: Update `edit.tsx` -- Use Installation's `projectDir`

**File:** `src/cli/commands/edit.tsx`

Changes:
1. Use `installation.projectDir` instead of `process.cwd()` for all installation-related operations (line 70):
   ```typescript
   const projectDir = installation.projectDir;
   ```

2. When using plugin install/uninstall, derive scope from installation:
   ```typescript
   const pluginScope = installation.scope === "global" ? "user" : "project";
   await claudePluginInstall(pluginRef, pluginScope, projectDir);
   ```

3. `detectInstallation()` already has the global fallback from Step 3, so edit will automatically find global installations.

### Step 12: Update `compile.ts` -- Use Installation's `projectDir`

**File:** `src/cli/commands/compile.ts`

Changes:
1. `detectInstallation()` already falls back to global (Step 3)
2. The `installation.projectDir` and `installation.agentsDir` will point to the right directories
3. `discoverAllSkills()` (line 177-210) currently uses `process.cwd()` -- this should use `installation.projectDir` for plugin skill discovery, but keep `process.cwd()` for local project skills when in global mode

**Subtlety:** When compiling with a global installation from a project directory, the compile command should:
- Read config from global (`~/.claude-src/config.yaml`)
- Read plugins from global (`~/.claude/settings.json`)
- Write agents to global (`~/.claude/agents/`)
- **But** the compiled agents reference skills relative to `~/.claude/skills/`

This is correct because the user's `CLAUDE.md` or other setup mechanism will reference the global agents.

### Step 13: Update `outdated.ts` -- Use Installation for Path Resolution

**File:** `src/cli/commands/outdated.ts`

Changes:
1. Add installation detection to determine the correct skills path:
   ```typescript
   const installation = await detectInstallation();
   const effectiveDir = installation?.projectDir ?? process.cwd();
   const localSkillsPath = path.join(effectiveDir, LOCAL_SKILLS_PATH);
   ```

### Step 14: Update Installation Index Exports

**File:** `src/cli/lib/installation/index.ts`

Export the new `InstallScope` type:

```typescript
export {
  type InstallMode,
  type InstallScope,
  type Installation,
  detectInstallation,
  getInstallationOrThrow,
} from "./installation";
```

### Step 15: Update Configuration Index Exports

**File:** `src/cli/lib/configuration/index.ts`

Export the new `loadGlobalSourceConfig` function:

```typescript
export {
  // ... existing exports
  loadGlobalSourceConfig,
} from "./config";
```

---

## Type Changes Summary

| Type | File | Change |
|------|------|--------|
| `InstallScope` | `installation.ts` | New type: `"project" \| "global"` |
| `Installation` | `installation.ts` | Add `scope: InstallScope` field |

No changes to `ProjectConfig`, `ProjectSourceConfig`, or any other existing types.

---

## Config Changes Summary

No new config fields. The existing `config.yaml` format works for both project and global installations. The `installMode` field already distinguishes local vs plugin.

---

## New Constants/Paths

| Constant | File | Value |
|----------|------|-------|
| `GLOBAL_INSTALL_ROOT` | `consts.ts` | `os.homedir()` |

All other paths are composed from existing constants (`CLAUDE_SRC_DIR`, `CLAUDE_DIR`, `LOCAL_SKILLS_PATH`, etc.) joined with the appropriate root directory.

---

## Files to Modify (Ordered)

| # | File | Change Type | Complexity |
|---|------|-------------|------------|
| 1 | `src/cli/consts.ts` | Add `GLOBAL_INSTALL_ROOT` constant | Trivial |
| 2 | `src/cli/lib/installation/installation.ts` | Add `InstallScope`, refactor `detectInstallation()` with global fallback | Medium |
| 3 | `src/cli/lib/installation/index.ts` | Export `InstallScope` | Trivial |
| 4 | `src/cli/lib/configuration/config.ts` | Add `loadGlobalSourceConfig()`, update `resolveSource()` and sibling functions | Medium |
| 5 | `src/cli/lib/configuration/project-config.ts` | Add global fallback to `loadProjectConfig()` | Low |
| 6 | `src/cli/lib/configuration/index.ts` | Export `loadGlobalSourceConfig` | Trivial |
| 7 | `src/cli/lib/loading/source-loader.ts` | Add global fallback for local skill discovery in `loadSkillsMatrixFromSource()` | Low |
| 8 | `src/cli/commands/init.tsx` | Add `--global` flag, parameterize `projectDir` throughout | Medium |
| 9 | `src/cli/commands/edit.tsx` | Use `installation.projectDir` and `installation.scope` | Low |
| 10 | `src/cli/commands/compile.ts` | Use `installation.projectDir` | Low |
| 11 | `src/cli/commands/outdated.ts` | Use installation detection for path resolution | Low |

---

## Test Plan

### Unit Tests

1. **`installation.test.ts`** -- Test `detectInstallation()`:
   - Project config exists -> returns project-scoped installation
   - No project config, global config exists -> returns global-scoped installation
   - Neither exists -> returns null
   - Both exist -> returns project-scoped (project takes precedence)
   - Global installation with `installMode: "plugin"` -> correct paths

2. **`config.test.ts`** -- Test `resolveSource()` with global fallback:
   - Project source config exists -> uses project source
   - No project config, global config has source -> uses global source
   - Neither has source -> uses default
   - Project source overrides global source

3. **`project-config.test.ts`** -- Test `loadProjectConfig()` with global fallback:
   - Project config exists -> loads project config
   - No project config, global config exists -> loads global config
   - Neither exists -> returns null

4. **`source-loader.test.ts`** -- Test local skill discovery fallback:
   - Project has local skills -> discovers from project
   - No project skills, global has skills -> discovers from global
   - Neither has skills -> no skills discovered

### Integration Tests

5. **`init` command**: Verify `--global` flag installs to home directory
6. **`edit` command**: Verify it finds and uses global installation when no project installation exists
7. **`compile` command**: Verify it compiles using global installation when appropriate
8. **`outdated` command**: Verify it checks skills in the correct location

### Manual Verification

9. `agentsinc init --global` creates `~/.claude-src/config.yaml`, `~/.claude/skills/`, `~/.claude/agents/`
10. `cd /some/project && agentsinc edit` (project without own installation) -> uses global config
11. `cd /some/project && agentsinc init` (project-level) -> new project install, overrides global
12. `cd /same/project && agentsinc edit` -> uses project config, not global
13. Plugin mode: `agentsinc init --global` with plugin mode uses `--scope user`

---

## Risks and Edge Cases

### Risk 1: Accidental Global Modification
**Issue:** A user runs `agentsinc edit` intending to edit a project's config, but no project config exists. The command silently falls back to global and modifies the global config.
**Mitigation:** Log a clear message when falling back to global: "No project installation found. Using global installation from ~/.claude-src/". Consider adding a confirmation prompt in edit mode when using global.

### Risk 2: `process.cwd()` Assumptions
**Issue:** Many places hardcode `process.cwd()` as the project directory. When using a global installation, operations like "copy skills to .claude/skills/" should target the home directory, not the current working directory.
**Mitigation:** Consistently use `installation.projectDir` instead of `process.cwd()` in all installation-related code paths. The plan above addresses each instance.

### Risk 3: Home Directory Permissions
**Issue:** Writing to `~/.claude/` and `~/.claude-src/` may fail due to permissions or disk space.
**Mitigation:** Existing `ensureDir()` calls will throw on permission errors. The error handler in each command (`handleError`) will catch and display these.

### Risk 4: Global Config Polluting Source Resolution
**Issue:** `loadAndMergeFromBasePath()` in `source-loader.ts` calls `loadProjectSourceConfig(basePath)` where `basePath` is the source repository, not the consumer. If `loadProjectSourceConfig()` gains a global fallback, it could incorrectly load the user's global config when loading a marketplace's source config.
**Mitigation:** Do NOT add global fallback to `loadProjectSourceConfig()` directly. Instead, add a separate `loadGlobalSourceConfig()` function and only use the fallback in the specific consumer functions (`resolveSource()`, etc.) that should have it. The `loadAndMergeFromBasePath()` call at source-loader.ts:172 should continue to use `loadProjectSourceConfig(basePath)` without fallback.

### Risk 5: Circular Dependency in Installation Detection
**Issue:** `detectInstallation()` calls `loadProjectConfig()`, and if `loadProjectConfig()` gains a global fallback, there's a risk of recursive resolution.
**Mitigation:** `detectGlobalInstallation()` should call `loadProjectConfigFromDir(homeDir)` (the non-fallback version) directly, avoiding any recursion.

### Risk 6: Edit Command Recompile Paths
**Issue:** When editing a global installation, `recompileAgents()` in `edit.tsx` (line 255) passes `pluginDir: projectDir` and `outputDir: installation.agentsDir`. If `projectDir` is `process.cwd()` but the installation is global, skill discovery and agent output will point to different directories.
**Mitigation:** Use `installation.projectDir` consistently for `pluginDir`, `projectDir`, and `outputDir` when operating on the installation.

### Risk 7: Outdated Command Path Assumptions
**Issue:** `outdated.ts` uses `path.join(projectDir, LOCAL_SKILLS_PATH)` directly. For global installations, this should be `~/.claude/skills/`.
**Mitigation:** Use installation detection to determine the correct base path (as described in Step 13).

### Edge Case: Both Global and Project Config During Init
**Scenario:** User has a global installation and runs `agentsinc init` (without `--global`) in a project.
**Expected:** Creates a project-level installation. The "already initialized" check should only look at the project directory, not fall back to global. This is correct because `detectExistingInstallation(projectDir)` in init.tsx should check only the target directory.
**Resolution:** In `init.tsx`, the existing installation check should use a project-only check (no global fallback). Add a helper or pass a flag: `detectProjectInstallation(projectDir)` instead of `detectInstallation(projectDir)`.

### Edge Case: `--global` + `--source` Flag
**Scenario:** `agentsinc init --global --source github:myorg/skills`
**Expected:** Installs globally with the custom source persisted to `~/.claude-src/config.yaml`.
**Resolution:** Works naturally -- `sourceFlag` is passed through to `installLocal()` / `installPluginConfig()` which writes it to config.

### Edge Case: Global Plugin Mode Scope
**Scenario:** `agentsinc init --global` in plugin mode.
**Expected:** `claude plugin install <skill>@<marketplace> --scope user` (not `--scope project`).
**Resolution:** Handled in Step 10 -- derive scope from `flags.global`.
