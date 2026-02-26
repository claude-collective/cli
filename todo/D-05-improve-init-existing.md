# D-05: Project Dashboard — Default Command + Already-Initialized

**Status:** Ready for Dev
**Priority:** Medium
**Complexity:** Medium

---

## 1. Open Questions (All Resolved)

1. **Should this flow be non-interactive by default?**
   **RESOLVED:** Show a text summary with selectable options (edit, compile, doctor, list). When the user selects an option, launch that command.

2. **Should the summary show real-time health data?**
   **RESOLVED:** No. Use config-only data for speed. No matrix loading, no network calls.

3. **Should `init --force` exist?**
   **RESOLVED:** No. Re-initialization should be done via `uninstall` + `init`.

4. **How should plugin mode vs local mode affect the summary?**
   **RESOLVED:** Show the same summary structure for both. Mode label adapts ("Local" vs "Plugin").

5. **Should the `edit` redirect be automatic after a timeout, or require user action?**
   **RESOLVED:** No auto-redirect. Show options the user can select.

6. **When should this dashboard appear?**
   **RESOLVED:** Two triggers:
   - Running `agentsinc` with no command (when a project is already initialized)
   - Running `agentsinc init` on an already-initialized project
   Both show the same dashboard.

---

## 2. Current State Analysis

### What Happens Today

**File:** `src/cli/commands/init.tsx` (lines 81-92)

When `agentsinc init` runs in an already-initialized project:

```typescript
const individualPluginsExist = await hasIndividualPlugins(projectDir);
const existingInstallation = await detectExistingInstallation(projectDir);

if (individualPluginsExist || existingInstallation) {
  const location = individualPluginsExist
    ? `.claude/settings.json`
    : (existingInstallation?.configPath ?? projectDir);
  this.warn(`Agents Inc. is already initialized at ${location}`);
  this.log(`Use 'agentsinc edit' to modify skills.`);
  this.log(INFO_MESSAGES.NO_CHANGES_MADE);
  return;
}
```

**Current output:**

```
 !   Warning: Agents Inc. is already initialized at .claude-src/config.yaml
Use 'agentsinc edit' to modify skills.
No changes made.
```

### Why This Is Lacking

1. **No context** - User has no idea what's currently installed (which skills, how many agents, what mode)
2. **No actionable options** - Only told to run `edit`, but may want to `compile`, `doctor`, `list`, or `update`
3. **Abrupt** - Three lines and exit; feels like an error rather than a helpful response
4. **No status indication** - Doesn't tell user if things are healthy or need attention

### Existing Utilities That Provide Summary Data

| Utility | Location | What It Returns |
|---------|----------|-----------------|
| `getInstallationInfo()` | `lib/plugins/plugin-info.ts` | mode, name, skillCount, agentCount, configPath, agentsDir, skillsDir |
| `formatInstallationDisplay()` | `lib/plugins/plugin-info.ts` | Formatted multi-line string of installation info |
| `detectInstallation()` | `lib/installation/installation.ts` | mode, configPath, agentsDir, skillsDir, projectDir |
| `loadProjectConfig()` | `lib/configuration/project-config.ts` | Full `ProjectConfig` with skills[], agents[], installMode, domains, source, etc. |
| `discoverAllPluginSkills()` | `lib/plugins/plugin-discovery.ts` | Map of all discovered plugin skills |
| `hasIndividualPlugins()` | `lib/plugins/plugin-discovery.ts` | Boolean: any plugins enabled in settings.json |

### Commands That Already Display Summary Data

- **`agentsinc list` (ls)** - Uses `getInstallationInfo()` + `formatInstallationDisplay()` to show mode, skill count, agent count, paths
- **`agentsinc doctor`** - Runs health checks (config validity, skills resolved, agents compiled, orphans, source reachable)

---

## 3. Design

### Triggers

The dashboard appears in two scenarios:

1. **`agentsinc` with no command** — when a project is already initialized, show the dashboard instead of help text
2. **`agentsinc init` on already-initialized project** — show the dashboard instead of the current terse warning

Both show the same output.

### Output

```
Agents Inc.

  Skills:   12 installed
  Agents:   3 compiled
  Source:   github:agents-inc/skills (custom marketplace)

  [Edit]  [Compile]  [Doctor]  [List]
```

The summary shows:
- Number of agents installed
- Number of skills installed
- Whether there's a custom marketplace source
- A few selectable options that navigate to those commands

### Key Design Decisions

1. **Text-based summary** with selectable options — not a full Ink UI, just enough to orient the user
2. **Fast** — only reads config + filesystem, no matrix loading, no network calls
3. **Replace `this.warn()` with `this.log()`** — being already initialized is not a warning
4. **Show skill count** from `config.skills.length`
5. **Show agent count** from compiled agents directory
6. **Show source** from `config.source` if present, note if custom marketplace
7. **Exit with SUCCESS (0)** — not an error state
8. **No `--force` flag** — re-initialization should be done via `uninstall` + `init`

---

## 5. Step-by-Step Implementation Plan

### Step 1: Create dashboard display function

Create a shared function that takes config data and displays the project summary with options. This is used by both the no-command path and the init-already-initialized path.

Uses `loadProjectConfig()` for skill count, `detectInstallation()` for agent count (from compiled agents dir), and config for source info.

### Step 2: Update `init.tsx` — already-initialized path

Replace the current 3-line warning block (lines 84-92) with a call to the dashboard function. Replace `this.warn()` with `this.log()`. Exit with `EXIT_CODES.SUCCESS`.

### Step 3: Add no-command handler

When `agentsinc` is run with no arguments and a project is already initialized, show the same dashboard instead of the default oclif help text.

**Approach options (for implementer to investigate):**
- oclif doesn't natively support default commands in v4
- Could use a custom oclif `init` hook to intercept zero-args
- Could create a root command that oclif routes to
- Could override the help hook behavior when no command is matched

### Step 4: Wire selectable options

The options (Edit, Compile, Doctor, List) should be selectable. When the user picks one, launch that command. The exact UX (interactive select, numbered choices, or just text suggestions) is left to the implementer — but the user's intent is that these are actionable, not just text.

---

## 6. Edge Cases

| Edge Case | Current Behavior | Proposed Behavior |
|-----------|-----------------|-------------------|
| Config exists but is invalid/corrupt | Shows warning + redirect to edit | Shows basic message + suggests `doctor` |
| Plugin mode with no config.yaml (only settings.json) | Shows `.claude/settings.json` path | Shows summary with plugin mode, skill count from plugin discovery |
| Config exists but skills array is empty | Shows warning + redirect | Shows summary with "0 installed" |
| Config exists but agents array is empty | Shows warning + redirect | Shows summary with "0 compiled" |
| `--dry-run` flag is set | Shows dry-run header, then warning | Shows dry-run header, then summary (dry-run doesn't affect read-only display) |
| Project config at legacy location (.claude/config.yaml) | Shows path to legacy location | Summary shows relative path (works with either location) |
| Both `hasIndividualPlugins` AND `detectInstallation` are true | Shows settings.json path | Shows summary from config (config is richer data source) |
| `agentsinc` with no args, project NOT initialized | Shows oclif help | Shows oclif help (unchanged — dashboard only for initialized projects) |
| User selects an option (Edit, Compile, etc.) | N/A | Launches the corresponding command |

---

## 7. Test Plan

### Unit Tests (Dashboard Function)

1. **Dashboard with full config** - Verify dashboard output with all fields populated (skills, agents, source)
2. **Dashboard with minimal config** - Config with empty skills/agents arrays shows "0 installed" / "0 compiled"
3. **Dashboard without source** - Config.source is undefined; "Source:" line should be omitted
4. **Dashboard local vs plugin mode** - Verify mode label adapts
5. **Fallback when config is unreadable** - loadProjectConfig returns null; verify basic message + suggests `doctor`

### Integration Tests (Command Level)

6. **`agentsinc init` in already-initialized project shows dashboard** - Mock `detectInstallation` + `loadProjectConfig` to return valid data; verify output contains skill count, agent count, and selectable options
7. **`agentsinc init` in already-initialized project exits with SUCCESS** - Verify exit code is 0 (not error)
8. **`agentsinc init` in fresh project proceeds normally** - Verify existing init flow is unchanged when no installation is detected
9. **`agentsinc init` with --dry-run in already-initialized project** - Verify dry-run banner appears before dashboard
10. **`agentsinc` with no args in initialized project shows dashboard** - Same dashboard as init path
11. **`agentsinc` with no args in uninitialized project shows help** - Default oclif help text (unchanged)

### Patterns to Follow for Tests

- Use `createMockSkill()`, `createMockMatrix()` from `__tests__/helpers.ts` for test data
- Mock `detectInstallation` and `loadProjectConfig` at module level
- Follow existing command test patterns (check `init.test.ts` if it exists, or `compile.test.ts`)

---

## 8. Files Changed Summary

| File | Change | Complexity |
|------|--------|------------|
| `src/cli/commands/init.tsx` | Replace warn+redirect with dashboard display; add dashboard helper; add `loadProjectConfig` import | Low |
| `src/cli/hooks/init.ts` or root command | Intercept zero-args when project is initialized; show dashboard | Medium |

**Total files changed:** 2
**New files:** 0-1 (depends on approach for no-command handler)
**Estimated lines changed:** ~60-80 added, ~5 removed

---

## 9. What This Does NOT Include

- **`--force` flag for re-initialization** - Out of scope; use `uninstall` + `init`
- **Health checks in dashboard** - Use `doctor` for that; keeps dashboard fast
- **Network calls to check source** - Dashboard uses config-only data for speed
- **Full Ink UI** - Text-based summary with selectable options, not a full wizard
