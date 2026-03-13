# D-91: `uninstall --all` should only uninstall CLI-installed plugins

## Current Behavior

### Plugin uninstall flow (lines 283-312 of `uninstall.tsx`)

1. `detectUninstallTarget()` calls `listPluginNames(projectDir)` (line 73)
2. `listPluginNames()` -> `getVerifiedPluginInstallPaths()` -> `getEnabledPluginKeys()` reads ALL entries from `.claude/settings.json` `enabledPlugins`
3. Every discovered plugin key is stored in `target.pluginNames`
4. The uninstall loop (lines 289-302) iterates ALL `target.pluginNames` and uninstalls each one

### The problem

`target.pluginNames` contains every plugin in `settings.json`, but some plugins may have been installed by other means (manually, another tool, etc.) — not by this CLI. When `--all` is passed, ALL of them get uninstalled.

Only plugins that have a matching skill entry in the project config (`config.ts` skills array) were installed by this CLI's init/install flow.

## Detection Heuristic

A plugin in `settings.json` was installed by this CLI if and only if the config's `skills` array contains a `SkillConfig` entry where `${id}@${source}` equals the plugin key.

**Example:**

- Config skill: `{ id: 'web-styling-cva', scope: 'project', source: 'agents-inc' }`
- Settings key: `"web-styling-cva@agents-inc": true`
- These match -> CLI-installed plugin, safe to uninstall

**Confirming the convention:**

- Install path in `init.tsx:438`: `const pluginRef = \`${skill.id}@${marketplace}\``
- Settings read in `plugin-settings.ts:63-98`: reads `enabledPlugins` from `.claude/settings.json`
- Config type in `types/config.ts:22-27`: `SkillConfig { id, scope, source }`

## Proposed Changes

**Single file change: `src/cli/commands/uninstall.tsx`**

### 1. Build a set of CLI-installed plugin keys

After loading `target` (which already has `config` and `pluginNames`), derive the set of plugin keys that match config skills:

```typescript
function getCliInstalledPluginKeys(target: UninstallTarget): Set<string> {
  if (!target.config?.skills) return new Set();
  return new Set(target.config.skills.map((skill) => `${skill.id}@${skill.source}`));
}
```

### 2. Filter `target.pluginNames` before the uninstall loop

At line 283, before iterating plugins, filter to only CLI-installed ones:

```typescript
const cliInstalledKeys = getCliInstalledPluginKeys(target);
const pluginsToRemove = target.pluginNames.filter((name) => cliInstalledKeys.has(name));
```

Then iterate `pluginsToRemove` instead of `target.pluginNames`.

### 3. Update `hasAnythingToRemove` check

The `target.hasPlugins` check (line 223) should reflect the filtered list, not the raw list. Either:

- Compute `pluginsToRemove` earlier and use `pluginsToRemove.length > 0`, or
- Add `cliPluginNames` to `UninstallTarget` during detection

### 4. Update confirmation UI

The plugins section in the confirmation UI (lines 119-123) should show only the filtered plugin names, not all discovered plugins.

## Edge Cases

| Case                                      | Behavior                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| No config exists (`config` is null)       | No skills to match -> no plugins identified as CLI-installed -> no plugins uninstalled |
| Config has no `skills` array              | Same as above                                                                          |
| All plugins match config skills           | All get uninstalled (same as current behavior)                                         |
| Some plugins match, some don't            | Only matching ones uninstalled; others left in settings.json                           |
| Plugin in config but not in settings.json | Not in `pluginNames` at all — irrelevant to this flow                                  |
| No settings.json                          | `pluginNames` is already empty — nothing to uninstall                                  |

## Files

| File                             | Change                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `src/cli/commands/uninstall.tsx` | Filter plugin list, update UI, update `hasAnythingToRemove`                       |
| (no other files)                 | `loadProjectSourceConfig` and `listPluginNames` already provide everything needed |

## Testing

Update existing tests in `src/cli/lib/__tests__/commands/uninstall.test.ts`:

1. **Mixed plugins**: settings.json has 3 plugins, config skills match 2 -> only 2 uninstalled
2. **No config**: settings.json has plugins but no config -> 0 uninstalled
3. **All match**: settings.json plugins all match config -> all uninstalled (regression)
4. **No plugins in settings**: config has skills but no settings entries -> 0 uninstalled (already works)
