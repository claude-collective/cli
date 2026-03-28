# Commands Reference

**Last Updated:** 2026-03-28

## Command Architecture

All commands extend `BaseCommand` (`src/cli/base-command.ts`).

**Base flags available to all commands:**

| Flag     | Short | Type   | Description               |
| -------- | ----- | ------ | ------------------------- |
| --source | -s    | string | Skills source path or URL |

**Operations layer:** Commands use composable operations from `src/cli/lib/operations/index.ts` as the primary interface to lower-level lib functions. Commands should not bypass operations for functionality that an operation covers. See `reference/features/operations-layer.md` for full operations documentation.

## Commands Index

| Command             | File                                    | Type | Summary                                           |
| ------------------- | --------------------------------------- | ---- | ------------------------------------------------- |
| `init`              | `src/cli/commands/init.tsx`             | tsx  | Initialize project (interactive wizard/dashboard)  |
| `edit`              | `src/cli/commands/edit.tsx`             | tsx  | Edit installed skills via wizard                   |
| `compile`           | `src/cli/commands/compile.ts`           | ts   | Compile agents from skills (global + project pass) |
| `validate`          | `src/cli/commands/validate.ts`          | ts   | Validate schemas, plugins, or skills source        |
| `info`              | `src/cli/commands/info.ts`              | ts   | Show detailed info about a skill                   |
| `list`              | `src/cli/commands/list.ts`              | ts   | Show installation information (alias: `ls`)        |
| `diff`              | `src/cli/commands/diff.ts`             | ts   | Show diffs between local forked skills and source  |
| `doctor`            | `src/cli/commands/doctor.ts`            | ts   | Diagnose configuration issues                      |
| `eject`             | `src/cli/commands/eject.ts`             | ts   | Eject skills, agent partials, or templates         |
| `outdated`          | `src/cli/commands/outdated.ts`          | ts   | Check for skill updates against source             |
| `search`            | `src/cli/commands/search.tsx`           | tsx  | Search skills across sources                       |
| `uninstall`         | `src/cli/commands/uninstall.tsx`        | tsx  | Uninstall from project                             |
| `update`            | `src/cli/commands/update.tsx`           | tsx  | Update local skills from source                    |
| `import skill`      | `src/cli/commands/import/skill.ts`      | ts   | Import a skill from third-party GitHub repo        |
| `new skill`         | `src/cli/commands/new/skill.ts`         | ts   | Create a new local skill scaffold                  |
| `new agent`         | `src/cli/commands/new/agent.tsx`        | tsx  | Create a new agent via AI generation               |
| `new marketplace`   | `src/cli/commands/new/marketplace.ts`   | ts   | Scaffold a new private marketplace                 |
| `build marketplace` | `src/cli/commands/build/marketplace.ts` | ts   | Generate marketplace.json from built plugins       |
| `build plugins`     | `src/cli/commands/build/plugins.ts`     | ts   | Build skill/agent plugins                          |
| `build stack`       | `src/cli/commands/build/stack.tsx`      | tsx  | Build a stack into a standalone plugin             |
| `config`            | `src/cli/commands/config/index.ts`      | ts   | Show config overview (alias for show)              |
| `config show`       | `src/cli/commands/config/show.ts`       | ts   | Display all resolved config values                 |
| `config path`       | `src/cli/commands/config/path.ts`       | ts   | Show config file paths                             |

## Primary Commands (Detailed)

### `init` (src/cli/commands/init.tsx)

**Purpose:** Interactive wizard to set up skills and agents in a project. When run in an already-initialized project, shows a dashboard with quick actions (Edit, Compile, Doctor, List).

**Flags:**

| Flag      | Type    | Description                    |
| --------- | ------- | ------------------------------ |
| --refresh | boolean | Force refresh from remote      |
| --source  | string  | Skills source path or URL      |

**Flow:**

1. Detect if already initialized (`detectProjectInstallation()` from `installation/index.ts`)
2. If initialized: `showDashboard()` renders Dashboard component with quick actions (Edit/Compile/Doctor/List). In non-interactive (no TTY): prints `formatDashboardText()` and returns null.
3. If not initialized: `ensureBlankGlobalConfig()` creates global config if running from project dir (not home dir)
4. **Operation: `loadSource()`** -- load skills matrix with optional startup message capture
5. Render `<Wizard>` component, await `waitUntilExit()`
6. On wizard result: `deriveInstallMode()` determines local/plugin/mixed install mode
7. If local/mixed: **Operation: `copyLocalSkills()`** -- copy local-source skills split by scope
8. If plugin/mixed: **Operation: `ensureMarketplace()`** -- register marketplace, then **Operation: `installPluginSkills()`** -- install each plugin by scope. Falls back to local if marketplace unavailable.
9. **Operation: `writeProjectConfig()`** -- generate and write `.claude-src/config.ts`
10. **Operation: `loadAgentDefs()`** -- load agent definitions
11. **Operation: `discoverInstalledSkills()`** -- find all installed skills
12. **Operation: `compileAgents()`** -- compile agents to `.claude/agents/`
13. `checkPermissions()` -- render permission warning if needed

**Key dependencies:**

- `src/cli/lib/operations/index.ts` -- `loadSource`, `ensureMarketplace`, `installPluginSkills`, `copyLocalSkills`, `writeProjectConfig`, `compileAgents`, `discoverInstalledSkills`, `loadAgentDefs`
- `src/cli/lib/installation/index.ts` -- `detectProjectInstallation`, `deriveInstallMode`, `resolveInstallPaths`, `buildAgentScopeMap`
- `src/cli/lib/configuration/config-writer.ts` -- `ensureBlankGlobalConfig`
- `src/cli/lib/permission-checker.ts` -- `checkPermissions`
- `src/cli/components/wizard/wizard.tsx` -- Wizard component
- `src/cli/components/common/select-list.tsx` -- SelectList for dashboard

**Exported utilities:**

- `formatDashboardText(data: DashboardData): string`
- `showDashboard(projectDir, log?): Promise<string | null>`
- `getDashboardData(projectDir): Promise<DashboardData>`

### `edit` (src/cli/commands/edit.tsx)

**Purpose:** Modify installed skills via wizard re-entry with diff-based change detection.

**Flags:**

| Flag           | Type    | Description                                      |
| -------------- | ------- | ------------------------------------------------ |
| --refresh      | boolean | Force refresh from remote sources                |
| --agent-source | string  | Remote agent partials source (default: local CLI) |
| --source       | string  | Skills source path or URL                        |

**Flow:**

1. **Operation: `detectProject()`** -- detect installation + load project config
2. **Operation: `loadSource()`** -- load matrix with startup messages
3. Discover current installed skills: `discoverAllPluginSkills()` + merge with config skills
4. Render `<Wizard>` with `initialStep="build"`, `installedSkillIds`, `installedSkillConfigs`, `lockedSkillIds`, `lockedAgentNames`, `isEditingFromGlobalScope`
5. `detectConfigChanges()` -- compute added/removed skills, added/removed agents, source changes, scope changes, agent scope changes
6. `detectMigrations()` + `executeMigration()` -- handle local-to-plugin and plugin-to-local mode migrations
7. `applyScopeChanges()` -- `migrateLocalSkillScope()` for local skills, `migratePluginSkillScopes()` for plugin skills (uninstall old scope + install new scope)
8. `applySourceChanges()` -- delete old local copies for non-migration source changes
9. `applyPluginChanges()` -- **Operation: `ensureMarketplace()`**, **Operation: `installPluginSkills()`** for added plugins, **Operation: `uninstallPluginSkills()`** for removed
10. **Operation: `copyLocalSkills()`** for newly added local-source skills
11. **Operation: `loadAgentDefs()`**, **Operation: `writeProjectConfig()`**, **Operation: `discoverInstalledSkills()`**, **Operation: `compileAgents()`**
12. `cleanupStaleAgentFiles()` -- remove old agent .md files after scope changes

**Key dependencies:**

- `src/cli/lib/operations/index.ts` -- `detectProject`, `loadSource`, `ensureMarketplace`, `installPluginSkills`, `uninstallPluginSkills`, `copyLocalSkills`, `writeProjectConfig`, `compileAgents`, `discoverInstalledSkills`, `loadAgentDefs`
- `src/cli/lib/installation/index.ts` -- `detectMigrations`, `executeMigration`, `deriveInstallMode`
- `src/cli/lib/plugins/index.ts` -- `discoverAllPluginSkills`
- `src/cli/lib/skills/index.ts` -- `deleteLocalSkill`, `migrateLocalSkillScope`

### `compile` (src/cli/commands/compile.ts)

**Purpose:** Compile agents using installed skills and agent definitions. Runs dual-pass for global and project installations.

**Flags:**

| Flag           | Type    | Description                                      |
| -------------- | ------- | ------------------------------------------------ |
| --verbose (-v) | boolean | Enable verbose logging                           |
| --agent-source | string  | Remote agent partials source (default: local CLI) |
| --source       | string  | Skills source path or URL                        |

**Flow:**

1. **Operation: `detectBothInstallations(cwd)`** -- returns `{ global, project, hasBoth }`
2. Error if neither installation found
3. `resolveSource()` from configuration -- resolve and log source
4. **Operation: `loadAgentDefs(agentSource, { projectDir })`** -- load agent definitions (CLI built-in + source)
5. `buildCompilePasses()` -- build compile pass list: global pass (if exists) + project pass (if exists). When both exist, each pass gets a `scopeFilter` to prevent cross-scope overwrites.
6. For each pass:
   a. **Operation: `discoverInstalledSkills(projectDir)`** -- discover all skills
   b. **Operation: `compileAgents({ projectDir, sourcePath, skills, pluginDir, outputDir, scopeFilter })`** -- compile agents with optional scope filter

**Key dependencies:**

- `src/cli/lib/operations/index.ts` -- `detectBothInstallations`, `loadAgentDefs`, `compileAgents`, `discoverInstalledSkills`
- `src/cli/lib/configuration/index.ts` -- `resolveSource`

### `validate` (src/cli/commands/validate.ts)

**Purpose:** Validate YAML schemas, compiled plugins, or skills source repositories.

**Args:**

| Arg  | Required | Description                                          |
| ---- | -------- | ---------------------------------------------------- |
| path | no       | Path to plugin or plugins directory to validate      |

**Flags:**

| Flag           | Short | Type    | Description                       |
| -------------- | ----- | ------- | --------------------------------- |
| --verbose      | -v    | boolean | Enable verbose logging            |
| --all          | -a    | boolean | Validate all plugins in directory |
| --plugins      | -p    | boolean | Validate plugins instead of schemas |
| --source       | -s    | string  | Skills source path or URL         |

**Modes:**

- `--source <path>`: validate skills source via `validateSource()`
- `args.path` or `--plugins`: validate plugin(s) via `validatePlugin()` / `validateAllPlugins()`
- No args: validate YAML schemas via `validateAllSchemas()`

### `info` (src/cli/commands/info.ts)

**Purpose:** Show detailed information about a skill (metadata, relationships, content preview).

**Args:**

| Arg   | Required | Description                    |
| ----- | -------- | ------------------------------ |
| skill | yes      | Skill ID or alias to look up   |

**Flags:**

| Flag      | Type    | Description                        |
| --------- | ------- | ---------------------------------- |
| --preview | boolean | Show content preview (default true, use --no-preview to disable) |
| --source  | string  | Skills source path or URL          |

**Key dependencies:** **Operation: `loadSource()`**, **Operation: `resolveSkillInfo()`**

### `list` (src/cli/commands/list.ts)

**Purpose:** Show installation information (skills, agents, mode). Alias: `ls`.

**Flags:** `--source` (inherited)

**Key dependencies:** `getInstallationInfo()`, `formatInstallationDisplay()` from `src/cli/lib/plugins/index.ts`

### `diff` (src/cli/commands/diff.ts)

**Purpose:** Show differences between local forked skills and their source versions using unified diff format with colored output.

**Args:**

| Arg   | Required | Description                        |
| ----- | -------- | ---------------------------------- |
| skill | no       | Show diff for specific skill only  |

**Flags:**

| Flag      | Short | Type    | Description                                |
| --------- | ----- | ------- | ------------------------------------------ |
| --quiet   | -q    | boolean | Suppress output, only return exit code     |
| --source  | -s    | string  | Skills source path or URL                  |

**Key dependencies:** **Operation: `loadSource()`**, **Operation: `collectScopedSkillDirs()`**, **Operation: `buildSourceSkillsMap()`**. Uses `readForkedFromMetadata()` from skills, `createTwoFilesPatch()` from `diff` package.

### `doctor` (src/cli/commands/doctor.ts)

**Purpose:** Diagnose common configuration issues (config validity, skills resolved, agents compiled, orphan detection, source reachable).

**Flags (defined directly, not via BaseCommand.baseFlags):**

| Flag      | Short | Type    | Description                |
| --------- | ----- | ------- | -------------------------- |
| --source  | -s    | string  | Skills source path or URL  |
| --verbose | -v    | boolean | Show detailed output       |

**Checks run:** Config Valid, Skills Resolved, Agents Compiled, No Orphans, Source Reachable.

**Key dependencies:** **Operation: `detectProject()`**, **Operation: `loadSource()`**. Uses `validateProjectConfig()` from configuration, `discoverLocalSkills()` from skills, `getStackSkillIds()` from stacks.

### `eject` (src/cli/commands/eject.ts)

**Purpose:** Eject skills, agent partials, or templates for local customization.

**Args:**

| Arg  | Required | Description                                          |
| ---- | -------- | ---------------------------------------------------- |
| type | no       | What to eject: `agent-partials`, `templates`, `skills`, `all` |

**Flags:**

| Flag      | Short | Type    | Description                             |
| --------- | ----- | ------- | --------------------------------------- |
| --force   | -f    | boolean | Overwrite existing files                |
| --output  | -o    | string  | Output directory (default: .claude/)    |
| --refresh |       | boolean | Force refresh from remote source        |
| --source  | -s    | string  | Skills source path or URL               |

**Key dependencies:** **Operation: `loadSource()`**. Uses `saveSourceToProjectConfig()`, `resolveSource()`, `loadProjectSourceConfig()` from configuration. `copySkillsToLocalFlattened()` from skills.

### `outdated` (src/cli/commands/outdated.ts)

**Purpose:** Check which local skills are out of date compared to source.

**Flags:**

| Flag     | Type    | Description             |
| -------- | ------- | ----------------------- |
| --json   | boolean | Output results as JSON  |
| --source | string  | Skills source path or URL |

**Key dependencies:** **Operation: `detectProject()`**, **Operation: `loadSource()`**, **Operation: `compareSkillsWithSource()`**. Uses `@oclif/table` for formatted output.

### `search` (src/cli/commands/search.tsx)

**Purpose:** Search available skills by ID, alias, description, or category. Interactive or static mode.

**Args:**

| Arg   | Required | Description                                |
| ----- | -------- | ------------------------------------------ |
| query | no       | Search query (matches name, desc, category) |

**Flags:**

| Flag          | Short | Type    | Description                              |
| ------------- | ----- | ------- | ---------------------------------------- |
| --interactive | -i    | boolean | Launch interactive search with multi-select |
| --category    | -c    | string  | Filter by category                       |
| --refresh     |       | boolean | Force refresh from remote sources        |
| --source      | -s    | string  | Skills source path or URL                |

**Key dependencies:** **Operation: `loadSource()`**. Uses `resolveAllSources()` from configuration, `fetchFromSource()`, `parseFrontmatter()` from loading, `SkillSearch` component.

### `uninstall` (src/cli/commands/uninstall.tsx)

**Purpose:** Remove CLI-managed skills, compiled agents, and plugins from project. Preserves user-created content.

**Flags:**

| Flag   | Short | Type    | Description                            |
| ------ | ----- | ------- | -------------------------------------- |
| --yes  | -y    | boolean | Skip confirmation prompt               |
| --all  |       | boolean | Also remove .claude-src/ config dir    |
| --source | -s  | string  | Skills source path or URL              |

**Key dependencies:** `listPluginNames()`, `getProjectPluginsDir()` from plugins. `readForkedFromMetadata()` from skills. `loadProjectConfigFromDir()` from configuration. `claudePluginUninstall()`, `isClaudeCLIAvailable()` from exec.

### `update` (src/cli/commands/update.tsx)

**Purpose:** Update local skills from source. Compare, confirm, copy, recompile.

**Args:**

| Arg   | Required | Description                        |
| ----- | -------- | ---------------------------------- |
| skill | no       | Specific skill to update (optional) |

**Flags:**

| Flag           | Short | Type    | Description                         |
| -------------- | ----- | ------- | ----------------------------------- |
| --yes          | -y    | boolean | Skip confirmation prompt            |
| --no-recompile |       | boolean | Skip agent recompilation after update |
| --source       | -s    | string  | Skills source path or URL           |

**Key dependencies:** **Operation: `loadSource()`**, **Operation: `compareSkillsWithSource()`**, **Operation: `collectScopedSkillDirs()`**, **Operation: `findSkillMatch()`**, **Operation: `compileAgents()`**, **Operation: `discoverInstalledSkills()`**. Uses `injectForkedFromMetadata()` from skills.

### `import skill` (src/cli/commands/import/skill.ts)

**Purpose:** Import skills from third-party GitHub repositories into local `.claude/skills/`.

**Args:**

| Arg    | Required | Description                                  |
| ------ | -------- | -------------------------------------------- |
| source | yes      | GitHub repository source (github:owner/repo, etc.) |

**Flags:**

| Flag      | Short | Type    | Description                            |
| --------- | ----- | ------- | -------------------------------------- |
| --skill   | -n    | string  | Name of the specific skill to import   |
| --all     | -a    | boolean | Import all skills from the repository  |
| --list    | -l    | boolean | List available skills without importing |
| --subdir  |       | string  | Subdirectory containing skills (default: `skills`) |
| --force   | -f    | boolean | Overwrite existing skills              |
| --refresh |       | boolean | Force refresh from remote (ignore cache) |
| --source  | -s    | string  | Skills source path or URL              |

**Key dependencies:** `fetchFromSource()` from loading. `importedSkillMetadataSchema` from schemas. `computeFileHash()`, `getCurrentDate()` from versioning.

### `new skill` (src/cli/commands/new/skill.ts)

**Purpose:** Create a new local skill scaffold with SKILL.md and metadata.yaml.

**Args:**

| Arg  | Required | Description                         |
| ---- | -------- | ----------------------------------- |
| name | yes      | Name of the skill (kebab-case)      |

**Flags:**

| Flag       | Short | Type    | Description                                     |
| ---------- | ----- | ------- | ----------------------------------------------- |
| --author   | -a    | string  | Author identifier (e.g., @myhandle)             |
| --category | -c    | string  | Skill category (default: from LOCAL_DEFAULTS)   |
| --domain   | -d    | string  | Domain (e.g., web, api, cli)                    |
| --force    | -f    | boolean | Overwrite existing skill directory              |
| --output   | -o    | string  | Output directory (overrides marketplace detection) |
| --source   | -s    | string  | Skills source path or URL                       |

**Key dependencies:** `resolveAuthor()` from configuration. `loadConfigTypesDataInBackground()`, `regenerateConfigTypes()` from config-types-writer. `detectInstallation()` from installation. `generateSkillCategoriesTs()`, `generateSkillRulesTs()` from skills/generators.

### `new agent` (src/cli/commands/new/agent.tsx)

**Purpose:** Create a new custom agent using AI generation via the agent-summoner meta-agent.

**Args:**

| Arg  | Required | Description                |
| ---- | -------- | -------------------------- |
| name | yes      | Name of the agent          |

**Flags:**

| Flag              | Short | Type    | Description                         |
| ----------------- | ----- | ------- | ----------------------------------- |
| --purpose         | -p    | string  | Purpose/description of the agent    |
| --non-interactive | -n    | boolean | Run in non-interactive mode         |
| --refresh         | -r    | boolean | Force refresh remote source         |
| --source          | -s    | string  | Skills source path or URL           |

**Key dependencies:** `resolveSource()` from configuration. `getAgentDefinitions()` from agents. `isClaudeCLIAvailable()` from exec. Spawns `claude` CLI process. `loadConfigTypesDataInBackground()`, `regenerateConfigTypes()` from config-types-writer.

### `new marketplace` (src/cli/commands/new/marketplace.ts)

**Purpose:** Scaffold a new private marketplace directory with skills, stacks, categories, rules, and config.

**Args:**

| Arg  | Required | Description                                         |
| ---- | -------- | --------------------------------------------------- |
| name | yes      | Marketplace name (kebab-case), or "." for current dir |

**Flags:**

| Flag     | Short | Type    | Description                                      |
| -------- | ----- | ------- | ------------------------------------------------ |
| --force  | -f    | boolean | Overwrite existing directory                     |
| --output | -o    | string  | Parent directory to create marketplace in        |
| --source | -s    | string  | Skills source path or URL                        |

**Key dependencies:** `generateConfigSource()` from config-writer. `generateMarketplace()`, `writeMarketplace()` from marketplace-generator. `compileAllSkillPlugins()` from skill-plugin-compiler. `generateSkillCategoriesTs()`, `generateSkillRulesTs()` from skills/generators. `loadConfigTypesDataInBackground()`, `regenerateConfigTypes()` from config-types-writer.

## Build Subcommands

### `build marketplace` (src/cli/commands/build/marketplace.ts)

**Purpose:** Generate marketplace.json from built plugins for plugin distribution.

**Flags:**

| Flag          | Short | Type    | Description              |
| ------------- | ----- | ------- | ------------------------ |
| --plugins-dir | -p    | string  | Plugins directory (default: `dist/plugins`) |
| --output      | -o    | string  | Output file (default: `.claude-plugin/marketplace.json`) |
| --name        |       | string  | Marketplace name         |
| --version     |       | string  | Marketplace version      |
| --description |       | string  | Marketplace description  |
| --owner-name  |       | string  | Owner name               |
| --owner-email |       | string  | Owner email              |
| --verbose     | -v    | boolean | Enable verbose logging   |
| --source      | -s    | string  | Skills source path or URL |

**Key dependencies:** `generateMarketplace()`, `writeMarketplace()`, `getMarketplaceStats()` from marketplace-generator.

### `build plugins` (src/cli/commands/build/plugins.ts)

**Purpose:** Build skills and agents into standalone plugins.

**Flags:**

| Flag         | Short | Type    | Description                                |
| ------------ | ----- | ------- | ------------------------------------------ |
| --skills-dir | -s    | string  | Skills source directory (default: `DIRS.skills`) |
| --agents-dir | -a    | string  | Agents source directory (optional)         |
| --output-dir | -o    | string  | Output directory (default: `dist/plugins`) |
| --skill      |       | string  | Compile only a specific skill              |
| --verbose    | -v    | boolean | Enable verbose logging                     |
| --source     | -s    | string  | Skills source path or URL                  |

**Note:** `--skills-dir` and `--source` both use `-s` short flag; the BaseCommand `--source` flag is inherited but the `--skills-dir` flag takes precedence for `-s`.

**Key dependencies:** `compileAllSkillPlugins()`, `compileSkillPlugin()` from skills. `compileAllAgentPlugins()` from agents.

### `build stack` (src/cli/commands/build/stack.tsx)

**Purpose:** Build a stack into a standalone plugin. Interactive stack selector if no `--stack` flag.

**Flags:**

| Flag           | Short | Type    | Description                         |
| -------------- | ----- | ------- | ----------------------------------- |
| --stack        |       | string  | Stack ID to compile                 |
| --output-dir   | -o    | string  | Output directory (default: `dist/stacks`) |
| --agent-source |       | string  | Agent partials source               |
| --refresh      |       | boolean | Force refresh remote agent source   |
| --verbose      | -v    | boolean | Enable verbose logging              |
| --source       | -s    | string  | Skills source path or URL           |

**Key dependencies:** `compileStackPlugin()`, `loadStacks()` from stacks. `getAgentDefinitions()` from agents. Uses `<Select>` from `@inkjs/ui` for interactive stack selection.

## Config Subcommands

Manage `.claude-src/config.ts` project configuration.

| Subcommand    | Purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| `config`      | Overview showing source resolution layers (alias for `show`)   |
| `config show` | Display all resolved config values (source, marketplace, etc.) |
| `config path` | Show config file locations                                     |

**Config `show` key functions:** `resolveSource()`, `resolveAgentsSource()`, `loadProjectSourceConfig()`, `getProjectConfigPath()`, `formatOrigin()` from configuration.

## Error Handling Pattern

All commands follow this pattern:

```typescript
try {
  // operation
} catch (error) {
  this.handleError(error); // from BaseCommand -> this.error(message, { exit: EXIT_CODES.ERROR })
}
```

For specific exit codes:

```typescript
this.error(message, { exit: EXIT_CODES.INVALID_ARGS });
```

Exit codes defined in `src/cli/lib/exit-codes.ts`:

- `SUCCESS: 0`
- `ERROR: 1`
- `INVALID_ARGS: 2`
- `NETWORK_ERROR: 3`
- `CANCELLED: 4`

## User-Facing Messages

All message constants centralized in `src/cli/utils/messages.ts`:

- `ERROR_MESSAGES` - Error strings (10 entries)
- `SUCCESS_MESSAGES` - Success strings (5 entries)
- `STATUS_MESSAGES` - Progress/status strings (12 entries)
- `INFO_MESSAGES` - Informational strings (6 entries)

## Operations Layer Usage by Command

| Command        | Operations Used                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `init`         | `loadSource`, `ensureMarketplace`, `installPluginSkills`, `copyLocalSkills`, `writeProjectConfig`, `compileAgents`, `discoverInstalledSkills`, `loadAgentDefs` |
| `edit`         | `detectProject`, `loadSource`, `ensureMarketplace`, `installPluginSkills`, `uninstallPluginSkills`, `copyLocalSkills`, `writeProjectConfig`, `compileAgents`, `discoverInstalledSkills`, `loadAgentDefs` |
| `compile`      | `detectBothInstallations`, `loadAgentDefs`, `compileAgents`, `discoverInstalledSkills`                       |
| `info`         | `loadSource`, `resolveSkillInfo`                                                                             |
| `diff`         | `loadSource`, `collectScopedSkillDirs`, `buildSourceSkillsMap`                                               |
| `doctor`       | `detectProject`, `loadSource`                                                                                |
| `eject`        | `loadSource`                                                                                                 |
| `outdated`     | `detectProject`, `loadSource`, `compareSkillsWithSource`                                                     |
| `search`       | `loadSource`                                                                                                 |
| `update`       | `loadSource`, `compareSkillsWithSource`, `collectScopedSkillDirs`, `findSkillMatch`, `compileAgents`, `discoverInstalledSkills` |
| `validate`     | (none -- uses lib functions directly)                                                                        |
| `list`         | (none -- uses plugin-info directly)                                                                          |
| `uninstall`    | (none -- uses lib functions directly)                                                                        |
| `import skill` | (none -- uses loading/fetching directly)                                                                     |
| `new skill`    | (none -- uses configuration/installation directly)                                                           |
| `new agent`    | (none -- uses agents/configuration directly)                                                                 |
| `new marketplace` | (none -- uses generators directly)                                                                        |
| `build *`      | (none -- uses skill/agent compilers directly)                                                                |
| `config *`     | (none -- uses configuration directly)                                                                        |
