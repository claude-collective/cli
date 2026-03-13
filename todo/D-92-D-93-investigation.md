# D-92 & D-93 Investigation Report

## D-92: Global config missing `source`, `marketplace`, `selectedAgents`

### Root Cause

The `splitConfigByScope` function in `src/cli/lib/configuration/config-generator.ts:199-248` deliberately omits `source`, `marketplace`, and `selectedAgents` from the global config partition. These fields are only included in the project config partition.

### Code Path

1. **`init.tsx:375`** -- `handleInstallation()` is called with the wizard result
2. **`init.tsx:393`** -- calls `installIndividualPlugins()` (for plugin mode)
3. **`init.tsx:455`** -- calls `installPluginConfig()` from `local-installer.ts`
4. **`local-installer.ts:545`** -- `buildAndMergeConfig()` is called
5. **`local-installer.ts:291`** -- `setConfigMetadata()` adds `source`, `marketplace`, `selectedAgents` to the **unified** `finalConfig`
6. **`local-installer.ts:548-554`** -- `writeScopedConfigs()` is called with `finalConfig`
7. **`local-installer.ts:440`** -- inside `writeScopedConfigs`, calls `splitConfigByScope(finalConfig)`
8. **`config-generator.ts:224-229`** -- the global partition is built:

```typescript
// config-generator.ts:224-229
const globalConfig: ProjectConfig = {
  name: "global",
  agents: globalAgents,
  skills: globalSkills,
  ...(Object.keys(globalStack).length > 0 && { stack: globalStack }),
  ...(config.domains && config.domains.length > 0 && { domains: config.domains }),
};
```

**Missing fields:** `source`, `marketplace`, `selectedAgents` are NOT spread into `globalConfig`.

Compare with the project partition at lines 232-246 which includes all three:

```typescript
...(config.source && { source: config.source }),
...(config.marketplace && { marketplace: config.marketplace }),
...(config.selectedAgents && config.selectedAgents.length > 0 && { selectedAgents: config.selectedAgents }),
```

### Impact

When a user selects only global-scoped skills, the global config at `~/.claude-src/config.ts` is missing the metadata needed for:

- **`source`**: The `cc edit` command needs this to know where to load skills from without `--source`
- **`marketplace`**: Plugin reinstall/update needs this to construct `skill@marketplace` refs
- **`selectedAgents`**: The edit wizard needs this to restore the user's agent selection

### Proposed Fix

In `splitConfigByScope` (`config-generator.ts:224-229`), add `source`, `marketplace`, and `selectedAgents` to the global config partition:

```typescript
const globalConfig: ProjectConfig = {
  name: "global",
  agents: globalAgents,
  skills: globalSkills,
  ...(Object.keys(globalStack).length > 0 && { stack: globalStack }),
  ...(config.domains && config.domains.length > 0 && { domains: config.domains }),
  ...(config.source && { source: config.source }),
  ...(config.marketplace && { marketplace: config.marketplace }),
  ...(config.selectedAgents &&
    config.selectedAgents.length > 0 && { selectedAgents: config.selectedAgents }),
};
```

These fields are shared metadata about the installation source. Both scopes need them because:

- The global config should be self-sufficient (usable from `~` without a project)
- The project config imports from global, so having them in both is harmless (project overrides global via spread)

---

## D-93: Global-scoped plugins double-installed (appear in project settings.json too)

### Root Cause

This is a **Claude CLI behavior**, not a bug in our code. The issue is:

1. **`init.tsx:441`** calls `claudePluginInstall(pluginRef, "user", projectDir)` where `projectDir = process.cwd()` (the project directory)
2. **`exec.ts:138-139`** executes: `claude plugin install <ref> --scope user` with `cwd: projectDir`

The Claude CLI's `plugin install --scope user` command:

- Writes the plugin to `~/.claude/settings.json` (correct -- user scope)
- **Also** writes the plugin to `<cwd>/.claude/settings.json` (the project-level settings)

This is because the Claude CLI tracks which plugins are "enabled" in the current project's settings.json regardless of the install scope. The `--scope` flag controls where the plugin files are stored (user-global cache vs project-local), but the "enabled" flag is written to the project settings.json as well since the CLI runs from that working directory.

### Evidence

The `claudePluginInstall` function in `exec.ts:131-145`:

```typescript
export async function claudePluginInstall(
  pluginPath: string,
  scope: "project" | "user",
  projectDir: string,
): Promise<void> {
  validatePluginPath(pluginPath);
  const args = ["plugin", "install", pluginPath, "--scope", scope];
  const result = await execCommand("claude", args, { cwd: projectDir });
```

The `cwd: projectDir` means the Claude CLI resolves the project-level `.claude/settings.json` relative to `projectDir`. Even with `--scope user`, the Claude CLI apparently adds the plugin to the project's `enabledPlugins` in `settings.json`.

### Impact

Global-scoped plugins appear in both:

- `~/.claude/settings.json` (correct -- user scope)
- `<project>/.claude/settings.json` (incorrect -- should only be in user scope)

This causes the plugin to be listed as installed at both levels, which could lead to confusion and potentially duplicate loading.

### Proposed Fixes (two options)

**Option A: Change `cwd` to `os.homedir()` for user-scoped plugins**

In `init.tsx:441`, pass `os.homedir()` as the `projectDir` for user-scoped installs:

```typescript
const installDir = pluginScope === "user" ? os.homedir() : projectDir;
await claudePluginInstall(pluginRef, pluginScope, installDir);
```

This would make the Claude CLI run from the home directory for user-scoped plugins, so it would only write to `~/.claude/settings.json`. However, this assumes the Claude CLI creates the project `.claude/settings.json` based on `cwd`.

**Option B: Clean up the project settings.json after user-scoped installs**

After installing all plugins, read `<project>/.claude/settings.json`, remove any user-scoped plugin keys, and write it back. This is more defensive but adds complexity.

**Recommended: Option A** -- it's the simplest fix and addresses the root cause (running `claude plugin install --scope user` from the project directory). This needs testing to verify the Claude CLI behavior matches the hypothesis.

---

## Summary

| Bug  | Root Cause                                                                                                                      | File:Line                      | Fix Location                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------- |
| D-92 | `splitConfigByScope` omits `source`, `marketplace`, `selectedAgents` from global partition                                      | `config-generator.ts:224-229`  | Add missing fields to global config object literal    |
| D-93 | `claudePluginInstall` runs with `cwd: projectDir` for user-scoped plugins, causing Claude CLI to write to project settings.json | `init.tsx:441` + `exec.ts:139` | Pass `os.homedir()` as `cwd` for user-scoped installs |
