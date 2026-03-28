# Dependency Graph

**Last Updated:** 2026-03-28
**Purpose:** Maps how the major layers of the codebase depend on each other, which commands use which operations, and which operations wrap which lib modules. Use this to understand import boundaries and find the right layer for new code.

---

## Layer Diagram

```
                     +--------------------+
                     |     Commands       |   src/cli/commands/
                     | (oclif entry pts)  |
                     +----+-----------+---+
                          |           |
            +-------------+           +------------+
            |                                      |
            v                                      v
  +-------------------+                 +---------------------+
  |    Operations     |                 |     Components      |  src/cli/components/
  | (composable ops)  |                 |   (Ink React UI)    |
  | src/cli/lib/      |                 +----------+----------+
  |   operations/     |                            |
  +--------+----------+                            v
           |                             +-------------------+
           v                             |      Stores       |  src/cli/stores/
  +-------------------+                  | (Zustand state)   |
  |       Lib         |                  +--------+----------+
  | (business logic)  |                           |
  | src/cli/lib/      |                           v
  |   agents/         |             +----------------------------+
  |   configuration/  | <----------+     Lib (matrix, wizard,    |
  |   installation/   |            |     configuration, etc.)    |
  |   loading/        |            +----------------------------+
  |   matrix/         |
  |   plugins/        |
  |   skills/         |
  |   stacks/         |
  |   wizard/         |
  +--------+----------+
           |
           v
  +-------------------+     +-------------------+
  |      Types        |     |      Utils        |  src/cli/utils/
  | src/cli/types/    |     | (cross-cutting)   |
  +-------------------+     +-------------------+
```

**Allowed dependency directions:**

| From | May import from |
|------|-----------------|
| Commands | Operations, Lib, Components, Stores (none currently), Utils, Types, consts |
| Operations | Lib, Utils, Types, consts |
| Components | Stores, Lib (matrix-provider, wizard, configuration, feature-flags), Utils, Types, consts |
| Stores | Lib (matrix-provider, matrix, installation, wizard), Utils, Types, consts |
| Lib | Other Lib subdirs, Utils, Types, consts |
| Utils | consts, Types (none currently) |
| Types | (leaf -- no internal imports) |

**Anti-pattern:** Commands should not import stores directly. Currently none do -- the wizard component mediates all store access.

---

## Command -> Operations Map

Each command and which operations it imports from `lib/operations/`.

| Command | File | Operations Imported |
|---------|------|---------------------|
| `init` | `commands/init.tsx` | `loadSource`, `loadAgentDefs`, `copyLocalSkills`, `ensureMarketplace`, `installPluginSkills`, `writeProjectConfig`, `compileAgents`, `discoverInstalledSkills` |
| `edit` | `commands/edit.tsx` | `detectProject`, `loadSource`, `copyLocalSkills`, `ensureMarketplace`, `installPluginSkills`, `uninstallPluginSkills`, `loadAgentDefs`, `writeProjectConfig`, `compileAgents`, `discoverInstalledSkills` |
| `compile` | `commands/compile.ts` | `detectBothInstallations`, `loadAgentDefs`, `compileAgents`, `discoverInstalledSkills` |
| `update` | `commands/update.tsx` | `loadSource`, `compareSkillsWithSource`, `compileAgents`, `collectScopedSkillDirs`, `findSkillMatch`, `discoverInstalledSkills` |
| `outdated` | `commands/outdated.ts` | `loadSource`, `compareSkillsWithSource`, `detectProject` |
| `doctor` | `commands/doctor.ts` | `loadSource`, `detectProject` |
| `info` | `commands/info.ts` | `loadSource`, `resolveSkillInfo` |
| `diff` | `commands/diff.ts` | `loadSource`, `buildSourceSkillsMap`, `collectScopedSkillDirs` |
| `search` | `commands/search.tsx` | `loadSource` |
| `eject` | `commands/eject.ts` | `loadSource` |
| `list` | `commands/list.ts` | (none) |
| `uninstall` | `commands/uninstall.tsx` | (none) |
| `validate` | `commands/validate.ts` | (none) |
| `config` | `commands/config/index.ts` | (none) |
| `config show` | `commands/config/show.ts` | (none) |
| `config path` | `commands/config/path.ts` | (none) |
| `import skill` | `commands/import/skill.ts` | (none) |
| `new skill` | `commands/new/skill.ts` | (none) |
| `new agent` | `commands/new/agent.tsx` | (none) |
| `new marketplace` | `commands/new/marketplace.ts` | (none) |
| `build plugins` | `commands/build/plugins.ts` | (none) |
| `build stack` | `commands/build/stack.tsx` | (none) |
| `build marketplace` | `commands/build/marketplace.ts` | (none) |

---

## Command -> Direct Lib Imports (bypassing Operations)

Commands that import directly from `lib/` modules in addition to (or instead of) operations. `lib/exit-codes` is excluded as it is a leaf constant module used by nearly all commands.

| Command | Direct Lib Imports |
|---------|-------------------|
| `init` | `lib/plugins/plugin-info` (getInstallationInfo), `lib/configuration/project-config` (loadProjectConfig), `lib/installation/` (detectProjectInstallation, deriveInstallMode, resolveInstallPaths, buildAgentScopeMap), `lib/permission-checker` (checkPermissions), `lib/matrix/matrix-provider` (getSkillById), `lib/configuration/config-writer` (ensureBlankGlobalConfig) |
| `edit` | `lib/installation/` (detectMigrations, executeMigration, deriveInstallMode), `lib/matrix/matrix-provider` (matrix, getSkillById), `lib/plugins/` (discoverAllPluginSkills), `lib/skills/` (deleteLocalSkill, migrateLocalSkillScope) |
| `compile` | `lib/configuration` (resolveSource), `lib/installation` (Installation type) |
| `doctor` | `lib/configuration` (validateProjectConfig), `lib/matrix/matrix-provider` (matrix), `lib/skills` (discoverLocalSkills), `lib/stacks` (getStackSkillIds) |
| `eject` | `lib/configuration/` (saveSourceToProjectConfig, resolveSource, loadProjectSourceConfig), `lib/matrix/matrix-provider` (matrix), `lib/skills/` (copySkillsToLocalFlattened) |
| `search` | `lib/configuration/` (resolveAllSources), `lib/loading/` (fetchFromSource, parseFrontmatter) |
| `update` | `lib/skills/` (injectForkedFromMetadata, SkillComparisonResult type) |
| `diff` | `lib/skills/` (readForkedFromMetadata) |
| `outdated` | `lib/skills/` (SkillComparisonResult type) |
| `uninstall` | `lib/plugins/` (listPluginNames, getProjectPluginsDir), `lib/skills/` (readForkedFromMetadata), `lib/configuration/project-config` (loadProjectConfigFromDir) |
| `info` | `lib/matrix/matrix-provider` (matrix) |
| `list` | `lib/plugins/` (getInstallationInfo, formatInstallationDisplay) |
| `validate` | `lib/schema-validator` (validateAllSchemas, printValidationResults), `lib/plugins/` (validatePlugin, validateAllPlugins, printPluginValidationResult), `lib/source-validator` (validateSource) |
| `import skill` | `lib/loading/` (fetchFromSource), `lib/schemas` (importedSkillMetadataSchema), `lib/versioning` (getCurrentDate, computeFileHash), `lib/metadata-keys` (IMPORT_DEFAULTS) |
| `new skill` | `lib/configuration/` (resolveAuthor), `lib/configuration/config-loader` (loadConfig), `lib/configuration/config-types-writer` (loadConfigTypesDataInBackground, regenerateConfigTypes), `lib/versioning` (computeSkillFolderHash), `lib/installation/` (detectInstallation), `lib/metadata-keys` (LOCAL_DEFAULTS), `lib/skills/generators` (toTitleCase, generateSkillCategoriesTs, generateSkillRulesTs, buildCategoryEntry, formatTsExport) |
| `new agent` | `lib/configuration/` (resolveSource), `lib/configuration/config-types-writer` (loadConfigTypesDataInBackground, regenerateConfigTypes), `lib/agents/` (getAgentDefinitions) |
| `new marketplace` | `lib/marketplace-generator` (generateMarketplace, writeMarketplace), `lib/configuration/config-writer` (generateConfigSource), `lib/configuration/config-types-writer` (loadConfigTypesDataInBackground, regenerateConfigTypes), `lib/skills/skill-plugin-compiler` (compileAllSkillPlugins), `lib/skills/generators` (generateSkillCategoriesTs, generateSkillRulesTs), `lib/metadata-keys` (LOCAL_DEFAULTS) |
| `build plugins` | `lib/skills` (compileAllSkillPlugins, compileSkillPlugin, printCompilationSummary), `lib/agents` (compileAllAgentPlugins, printAgentCompilationSummary) |
| `build stack` | `lib/stacks` (compileStackPlugin, printStackCompilationSummary, loadStacks), `lib/agents` (getAgentDefinitions) |
| `build marketplace` | `lib/marketplace-generator` (generateMarketplace, writeMarketplace, getMarketplaceStats) |
| `config show` | `lib/configuration/` (resolveSource, resolveAgentsSource, loadProjectSourceConfig, getProjectConfigPath, formatOrigin, DEFAULT_SOURCE, SOURCE_ENV_VAR) |
| `config path` | `lib/configuration/` (getProjectConfigPath) |

---

## Command -> Component Imports

Commands that render Ink components.

| Command | Components Imported |
|---------|-------------------|
| `init` | `components/wizard/wizard` (Wizard), `components/common/select-list` (SelectList), `components/wizard/hotkeys` (KEY_LABEL_*) |
| `edit` | `components/wizard/wizard` (Wizard) |
| `update` | `components/common/confirm` (Confirm) |
| `uninstall` | `components/common/confirm` (Confirm) |
| `search` | `components/skill-search/` (SkillSearch) |
| `new agent` | (inline Ink components, no shared component imports) |
| `build stack` | (inline Ink Select from @inkjs/ui, no shared component imports) |

---

## Operations -> Lib Map

Each operation file and which lib modules it wraps.

### Source Operations (`lib/operations/source/`)

| Operation | File | Lib Modules Used |
|-----------|------|-----------------|
| `loadSource` | `source/load-source.ts` | `lib/loading/` (loadSkillsMatrixFromSource) |
| `ensureMarketplace` | `source/ensure-marketplace.ts` | `lib/loading/` (fetchMarketplace), `utils/exec` (claudePluginMarketplaceExists, claudePluginMarketplaceAdd, claudePluginMarketplaceUpdate) |

### Project Operations (`lib/operations/project/`)

| Operation | File | Lib Modules Used |
|-----------|------|-----------------|
| `detectProject` | `project/detect-project.ts` | `lib/installation/` (detectInstallation), `lib/configuration/` (loadProjectConfig) |
| `detectBothInstallations` | `project/detect-both-installations.ts` | `lib/installation/` (detectGlobalInstallation, detectProjectInstallation) |
| `compileAgents` | `project/compile-agents.ts` | `lib/agents/` (recompileAgents), `lib/configuration/` (loadProjectConfigFromDir), `lib/installation/` (buildAgentScopeMap) |
| `writeProjectConfig` | `project/write-project-config.ts` | `lib/installation/` (buildAndMergeConfig, writeScopedConfigs, resolveInstallPaths), `lib/loading/` (loadAllAgents), `lib/configuration/config-writer` (ensureBlankGlobalConfig) |
| `loadAgentDefs` | `project/load-agent-defs.ts` | `lib/agents/` (getAgentDefinitions), `lib/loading/` (loadAllAgents) |

### Skills Operations (`lib/operations/skills/`)

| Operation | File | Lib Modules Used |
|-----------|------|-----------------|
| `discoverInstalledSkills` | `skills/discover-skills.ts` | `lib/plugins/` (discoverAllPluginSkills), `lib/loading/` (parseFrontmatter) |
| `copyLocalSkills` | `skills/copy-local-skills.ts` | `lib/installation/` (resolveInstallPaths), `lib/skills/` (copySkillsToLocalFlattened) |
| `compareSkillsWithSource` | `skills/compare-skills.ts` | `lib/skills/` (compareLocalSkillsWithSource) |
| `collectScopedSkillDirs` | `skills/collect-scoped-skill-dirs.ts` | (none -- uses utils/fs directly) |
| `findSkillMatch` | `skills/find-skill-match.ts` | `lib/skills/` (SkillComparisonResult type only) |
| `resolveSkillInfo` | `skills/resolve-skill-info.ts` | `lib/skills/` (discoverLocalSkills) |
| `installPluginSkills` | `skills/install-plugin-skills.ts` | (none -- uses utils/exec directly) |
| `uninstallPluginSkills` | `skills/uninstall-plugin-skills.ts` | (none -- uses utils/exec directly) |

---

## Shared Utility Consumers

### `utils/exec.ts` (Claude CLI wrappers)

| Layer | Consumer Files |
|-------|---------------|
| Commands | `commands/uninstall.tsx`, `commands/edit.tsx`, `commands/new/agent.tsx` |
| Operations | `operations/skills/install-plugin-skills.ts`, `operations/skills/uninstall-plugin-skills.ts`, `operations/source/ensure-marketplace.ts` |
| Lib | `lib/installation/mode-migrator.ts`, `lib/stacks/stack-installer.ts` |

Total: 8 production consumers

### `utils/fs.ts` (file system helpers)

| Layer | Consumer Count | Notable Consumers |
|-------|---------------|-------------------|
| Commands | 12 | edit, uninstall, update, search, eject, diff, doctor, outdated, import/skill, new/marketplace, new/skill, new/agent |
| Operations | 5 | discover-skills, resolve-skill-info, copy-local-skills, collect-scoped-skill-dirs, write-project-config |
| Lib | 37 | Nearly all lib subdirs: compiler, loading/*, configuration/*, installation/*, skills/*, plugins/*, stacks/*, agents/*, resolver, versioning, schema-validator, source-validator, permission-checker, marketplace-generator |

Total: 54 production consumers (most-used utility in the project)

### `utils/logger.ts` (warn, verbose, log, message buffering)

| Layer | Consumer Count | Notable Consumers |
|-------|---------------|-------------------|
| Commands | 10 | init, edit, compile, doctor, import/skill, new/skill, validate, build/plugins, build/stack, build/marketplace |
| Operations | 3 | discover-skills, ensure-marketplace, load-source |
| Components | 3 | wizard/wizard-layout.tsx, wizard/wizard.tsx, wizard/step-settings.tsx |
| Stores | 1 | wizard-store.ts |
| Lib | 40 | Nearly all lib subdirs: compiler, loading/*, configuration/*, installation/*, skills/*, plugins/*, stacks/*, agents/*, matrix/*, schemas, output-validator, versioning |

Total: 57 production consumers (most-used utility overall)

### `utils/errors.ts` (getErrorMessage)

| Layer | Consumer Count | Notable Consumers |
|-------|---------------|-------------------|
| Commands | 12 | init, edit, uninstall, update, diff, doctor, outdated, import/skill, new/*, validate |
| Operations | 2 | install-plugin-skills, uninstall-plugin-skills |
| Components | 2 | hooks/use-source-operations.ts, wizard/step-settings.tsx |
| Lib | 18 | compiler, loading/*, configuration/*, installation/*, skills/*, plugins/*, stacks/*, agents/*, versioning, schema-validator |

Total: 34 production consumers

### `utils/messages.ts` (ERROR_MESSAGES, SUCCESS_MESSAGES, STATUS_MESSAGES, INFO_MESSAGES)

| Layer | Consumer Files |
|-------|---------------|
| Commands | `init`, `edit`, `compile`, `uninstall`, `update`, `search`, `info`, `import/skill`, `validate` |

Total: 9 consumers (commands only -- messages are a presentation concern)

### `utils/typed-object.ts` (typedEntries, typedKeys)

| Layer | Consumer Count | Notable Consumers |
|-------|---------------|-------------------|
| Commands | 1 | eject |
| Operations | 2 | discover-skills, compare-skills |
| Components | 3 | wizard/domain-selection, wizard/utils, wizard/step-agents |
| Stores | 1 | wizard-store.ts |
| Lib | 17 | compiler, matrix/*, loading/*, configuration/*, installation/*, stacks/*, agents/*, plugins/*, resolver, matrix-health-check |

Total: 24 production consumers

### `utils/string.ts` (truncateText)

| Layer | Consumer Files |
|-------|---------------|
| Commands | `search` |
| Operations | `skills/resolve-skill-info` |
| Components | `skill-search/skill-search.tsx` |

Total: 3 production consumers

### `utils/type-guards.ts` (isCategory, isDomain, isAgentName, isCategoryPath)

| Layer | Consumer Files |
|-------|---------------|
| Components | `wizard/utils.ts`, `wizard/step-agents.tsx` |

Total: 2 production consumers

### `utils/frontmatter.ts` (extractFrontmatter)

| Layer | Consumer Files |
|-------|---------------|
| Lib | `agents/agent-plugin-compiler.ts`, `plugins/plugin-validator.ts`, `output-validator.ts`, `schema-validator.ts` |

Total: 4 production consumers

### `utils/yaml.ts` (safeLoadYamlFile)

Currently unused -- defined but no production importers.

---

## Store -> Lib Dependencies

The wizard store (`stores/wizard-store.ts`) imports from:

| Lib Module | Imports |
|------------|---------|
| `lib/installation/installation.ts` | `deriveInstallMode` |
| `lib/matrix/` | `resolveAlias` |
| `lib/matrix/matrix-provider.ts` | `matrix`, `getSkillById`, `getCategoryDomain` |
| `lib/wizard/` | `isCompatibleWithSelectedFrameworks` |

---

## Component -> Lib Dependencies (production only)

| Component | Lib Module | Import |
|-----------|------------|--------|
| `hooks/use-build-step-props.ts` | `lib/matrix/matrix-provider` | `matrix` |
| `hooks/use-framework-filtering.ts` | `lib/wizard/` | `buildCategoriesForDomain` |
| `hooks/use-source-grid-search-modal.ts` | `lib/matrix/matrix-provider` | `matrix` |
| `hooks/use-source-operations.ts` | `lib/configuration/source-manager` | `addSource`, `removeSource` |
| `wizard/wizard-layout.tsx` | `lib/feature-flags` | `FEATURE_FLAGS` |
| `wizard/domain-selection.tsx` | `lib/matrix/matrix-provider` | `matrix` |
| `wizard/step-agents.tsx` | `lib/matrix/matrix-provider` | `matrix` |
| `wizard/step-sources.tsx` | `lib/feature-flags` | `FEATURE_FLAGS` |
| `wizard/step-sources.tsx` | `lib/configuration/` | `resolveAllSources` |
| `wizard/step-sources.tsx` | `lib/loading/multi-source-loader` | `searchExtraSources` |
| `wizard/stack-selection.tsx` | `lib/matrix/matrix-provider` | `matrix` |
| `wizard/category-grid.tsx` | `lib/matrix/matrix-provider` | `getSkillById` |
| `wizard/source-grid.tsx` | `lib/matrix/matrix-provider` | `getSkillById` |
| `wizard/info-panel.tsx` | `lib/matrix/matrix-provider` | `matrix` |
| `wizard/wizard.tsx` | `lib/matrix/` | `resolveAlias`, `validateSelection` |
| `wizard/wizard.tsx` | `lib/matrix/matrix-provider` | `matrix`, `findStack` |
| `wizard/wizard.tsx` | `lib/feature-flags` | `FEATURE_FLAGS` |
| `wizard/utils.ts` | `lib/matrix/matrix-provider` | `matrix`, `findStack` |
| `wizard/step-settings.tsx` | `lib/configuration/source-manager` | `getSourceSummary` |
| `wizard/step-settings.tsx` | `lib/configuration/config` | `DEFAULT_SOURCE` |

---

## Key Observations

1. **`init` and `edit` are the heaviest commands** -- each imports 8-10 operations plus 6-7 direct lib modules. They orchestrate the full install/edit pipeline.

2. **Operations layer is NOT exhaustive** -- many commands bypass operations and import lib directly (`uninstall`, `validate`, `list`, `import skill`, `new *`, `build *`). These are typically simpler commands or marketplace tooling commands.

3. **`lib/matrix/matrix-provider.ts` is the most cross-cutting lib module** -- imported by commands, components, stores, and other lib modules. It provides the global matrix singleton.

4. **Components access lib through a narrow set of modules**: primarily `matrix-provider`, `wizard/`, `feature-flags`, and `configuration/source-manager`. They never import from `installation/`, `plugins/`, `skills/`, or `stacks/` directly.

5. **`utils/fs.ts` and `utils/logger.ts` are the most-used utilities** at 54 and 57 production consumers respectively. They are consumed at every layer.

6. **`utils/yaml.ts` is dead code** -- defined but no production module imports it.

7. **`utils/messages.ts` is a command-only concern** -- no lib, operations, or component file imports it.

---

## Related Documentation

- [Architecture Overview](./architecture-overview.md) -- Directory structure, data flow, technology stack
- [Commands Reference](./commands.md) -- Command flags, exit codes, flow descriptions
- [Utilities Reference](./utilities.md) -- Detailed function signatures for all utils
- [Store Map](./store-map.md) -- WizardState shape, actions, consumers
