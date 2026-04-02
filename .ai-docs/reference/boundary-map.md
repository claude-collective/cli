# Boundary Map

**Last Updated:** 2026-04-02

## Overview

**Purpose:** Identifies all system boundaries where external data enters or leaves the CLI, and documents what validation/sanitization exists at each boundary.

**Key Files:**

| File                                         | Purpose                                                |
| -------------------------------------------- | ------------------------------------------------------ |
| `src/cli/base-command.ts`                    | Base `--source` flag definition, error handling        |
| `src/cli/hooks/init.ts`                      | Raw argv extraction of `--source` before oclif parsing |
| `src/cli/utils/exec.ts`                      | Shell execution boundary, input validation             |
| `src/cli/utils/fs.ts`                        | `readFileSafe()` with size limits                      |
| `src/cli/lib/schemas.ts`                     | All Zod schemas (30+) for parse boundaries             |
| `src/cli/lib/configuration/config.ts`        | Source validation (`validateSourceFormat`)             |
| `src/cli/lib/configuration/config-loader.ts` | jiti TypeScript config loading                         |
| `src/cli/lib/configuration/config-writer.ts` | Config file generation                                 |
| `src/cli/lib/compiler.ts`                    | Liquid template sanitization, agent output             |
| `src/cli/lib/skills/skill-copier.ts`         | Path traversal prevention                              |
| `src/cli/lib/plugins/plugin-settings.ts`     | Claude settings/registry JSON parsing                  |
| `src/cli/lib/plugins/plugin-finder.ts`       | Plugin manifest JSON parsing                           |
| `src/cli/lib/plugins/plugin-validator.ts`    | Plugin/skill/agent frontmatter validation              |
| `src/cli/consts.ts`                          | File size limit constants                              |

---

## 1. CLI Input Boundaries

### 1.1 Base Flag: `--source`

| Property       | Value                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------- |
| **Location**   | `src/cli/base-command.ts:13-18`                                                              |
| **Direction**  | IN                                                                                           |
| **Data**       | Skills source path or URL                                                                    |
| **Validation** | oclif `Flags.string()` (accepts any string), then `validateSourceFormat()` in `config.ts:97` |
| **Schema**     | None (string flag); validated by `validateSourceFormat()`                                    |

All commands inherit `baseFlags` via `...BaseCommand.baseFlags`. The `--source` (`-s`) flag is optional and accepts any string. Actual validation happens in `resolveSource()` at `config.ts:84`.

### 1.2 Init Hook: Raw argv Extraction

| Property       | Value                                                                        |
| -------------- | ---------------------------------------------------------------------------- |
| **Location**   | `src/cli/hooks/init.ts:24-40`                                                |
| **Direction**  | IN                                                                           |
| **Data**       | `--source` and `-s` flags extracted from raw `options.argv`                  |
| **Validation** | Manual string extraction (indexOf + split), then passed to `resolveSource()` |
| **Schema**     | None at extraction point; downstream `validateSourceFormat()` validates      |

The init hook runs before oclif parses flags. It manually extracts `--source` / `--source=value` / `-s` from `options.argv` to pre-resolve the source config. This is a raw CLI input boundary with no validation at extraction -- validation happens in `resolveSource()` at `config.ts:84-131`.

### 1.3 Per-Command Flag Definitions

Every command extends `BaseCommand` and defines `static flags`. oclif handles type coercion, required validation, and enum constraints.

| Command             | File                                  | Flags (beyond `--source`)                                                                     |
| ------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `init`              | `commands/init.tsx:162-168`           | `--refresh` (boolean)                                                                         |
| `edit`              | `commands/edit.tsx:81-90`             | `--refresh` (boolean), `--agent-source` (string)                                              |
| `compile`           | `commands/compile.ts:31-41`           | `--verbose` (boolean), `--agent-source` (string)                                              |
| `list`              | `commands/list.tsx:64-66`             | (base only)                                                                                   |
| `info`              | `commands/info.ts:85-92`              | `--preview` (boolean, allowNo)                                                                |
| `eject`             | `commands/eject.ts:79-94`             | `--force` (boolean), `--output` (string), `--refresh` (boolean)                               |
| `search`            | `commands/search.tsx:58-78`           | `--interactive` (boolean), `--category` (string), `--refresh` (boolean), `--json` (boolean)   |
| `update`            | `commands/update.tsx:69-80`           | `--yes` (boolean), `--no-recompile` (boolean)                                                 |
| `uninstall`         | `commands/uninstall.tsx:96-107`       | `--yes` (boolean), `--all` (boolean)                                                          |
| `validate`          | `commands/validate.ts:60-77`          | `--verbose` (boolean), `--all` (boolean), `--plugins` (boolean)                               |
| `doctor`            | `commands/doctor.ts:372-382`          | `--source` (string, own definition), `--verbose` (boolean)                                    |
| `import skill`      | `commands/import/skill.ts:65-95`      | `--skill` (string), `--all` (boolean), `--list` (boolean), `--subdir` (string), `--force` (boolean), `--refresh` (boolean) |
| `new skill`         | `commands/new/skill.ts:47-73`         | `--author` (string), `--category` (string), `--domain` (string), `--force` (boolean), `--output` (string) |
| `new agent`         | `commands/new/agent.tsx:80-97`        | `--purpose` (string), `--non-interactive` (boolean), `--refresh` (boolean)                    |
| `new marketplace`   | `commands/new/marketplace.ts:137-148` | `--force` (boolean), `--output` (string)                                                      |
| `build plugins`     | `commands/build/plugins.ts:30-53`     | `--skills-dir` (string), `--agents-dir` (string), `--output-dir` (string), `--skill` (string), `--verbose` (boolean) |
| `build stack`       | `commands/build/stack.tsx:52-74`      | `--stack` (string), `--output-dir` (string), `--agent-source` (string), `--refresh` (boolean), `--verbose` (boolean) |
| `build marketplace` | `commands/build/marketplace.ts:39-76` | `--plugins-dir` (string), `--output` (string), `--name` (string), `--version` (string), `--description` (string), `--owner-name` (string), `--owner-email` (string), `--verbose` (boolean) |

**Validation pattern:** oclif validates flag types, required status, and enum `options` at parse time. String flags pass through without content validation -- downstream code validates semantics (e.g., `validateSourceFormat` for source strings).

---

## 2. File System Parse Boundaries (Data IN)

### 2.1 YAML Parse Pattern

**Note:** `src/cli/utils/yaml.ts` (`safeLoadYamlFile`) was removed as dead code. Production code uses the same validation pattern inline at each call site:

`readFileSafe()` (size limit) -> `parseYaml()` -> `schema.safeParse()`

Default size limit: `MAX_CONFIG_FILE_SIZE` (1 MB, `consts.ts:152`).

### 2.2 TypeScript Config via `loadConfig` (jiti)

| Property       | Value                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------- |
| **Location**   | `src/cli/lib/configuration/config-loader.ts:26-65`                                                 |
| **Direction**  | IN                                                                                                 |
| **Data**       | `.claude-src/config.ts`, `config/stacks.ts`, `config/skill-categories.ts`, `config/skill-rules.ts` |
| **Validation** | Optional Zod schema via `schema.safeParse()`                                                       |
| **Mechanism**  | jiti dynamic import with module cache disabled, alias for `@agents-inc/cli/config`                 |

Callers:

| Caller                         | File                                    | Schema Used                                            |
| ------------------------------ | --------------------------------------- | ------------------------------------------------------ |
| `loadProjectConfigFromDir()`   | `configuration/project-config.ts:31-34` | `projectConfigLoaderSchema` (via raw load + safeParse) |
| `loadGlobalSourceConfig()`     | `configuration/config.ts`               | `projectSourceConfigSchema`                            |
| `validateFile()` (config mode) | `schema-validator.ts:177-183`           | Various (per `VALIDATION_TARGETS`)                     |
| Skill categories loader        | via `schema-validator.ts`               | `skillCategoriesFileSchema`                            |
| Skill rules loader             | via `schema-validator.ts`               | `skillRulesFileSchema`                                 |
| Stacks loader                  | via `schema-validator.ts`               | `stacksConfigSchema`                                   |

### 2.3 Direct YAML Parse + Zod safeParse (Production Call Sites)

| File                              | Line | What Is Parsed                           | Schema Used                                                 |
| --------------------------------- | ---- | ---------------------------------------- | ----------------------------------------------------------- |
| `matrix/matrix-loader.ts`         | :123 | `metadata.yaml` per skill                | `rawMetadataSchema` (local schema at :26, stricter than `skillMetadataLoaderSchema` — requires `author`, `category`) |
| `skills/skill-plugin-compiler.ts` | :51  | `metadata.yaml` for skill compilation    | `skillMetadataLoaderSchema`                                 |
| `skills/skill-metadata.ts`        | :110 | `metadata.yaml` for local skill metadata | `localSkillMetadataSchema`                                  |
| `skills/skill-metadata.ts`        | :315 | `metadata.yaml` for fork injection       | `localSkillMetadataSchema`                                  |
| `source-validator.ts`             | :189 | `metadata.yaml` for strict validation    | `metadataValidationSchema` / `customMetadataValidationSchema` |
| `agents/agent-plugin-compiler.ts` | :35  | Agent `.md` frontmatter                  | `agentFrontmatterValidationSchema`                          |

### 2.4 JSON Parse Boundaries (Production)

| File                          | Line           | What Is Parsed                                     | Validation After Parse                                     |
| ----------------------------- | -------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| `utils/exec.ts`               | :180           | Claude CLI JSON stdout (`marketplace list --json`) | `Array.isArray()` check, cast to `MarketplaceInfo[]`       |
| `plugins/plugin-finder.ts`    | :59            | `plugin.json` manifest                             | `pluginManifestSchema.parse()` (throws on failure)         |
| `plugins/plugin-validator.ts` | :129           | `plugin.json` for validation                       | `pluginManifestValidationSchema.safeParse()`               |
| `plugins/plugin-validator.ts` | :335           | `plugin.json` as raw Record                        | Type assertion only (`loadManifestForValidation()`)        |
| `plugins/plugin-settings.ts`  | :73            | `.claude/settings.json`                            | `pluginSettingsSchema.safeParse()`                         |
| `plugins/plugin-settings.ts`  | :120           | `~/.claude/plugins/installed_plugins.json`         | `installedPluginsSchema.safeParse()`                       |
| `marketplace-generator.ts`    | :28            | `plugin.json` for marketplace build                | `pluginManifestSchema.parse()`                             |
| `versioning.ts`               | :86            | `plugin.json` for version check                    | `pluginManifestSchema.parse()`                             |
| `loading/source-fetcher.ts`   | :267           | `marketplace.json` from fetched source             | `validateNestingDepth()` + `marketplaceSchema.safeParse()` |
| `commands/import/skill.ts`    | :471, :499-508 | Imported skill metadata (YAML + JSON fallback)     | `importedSkillMetadataSchema.safeParse()`                  |
| `schema-validator.ts`         | :152           | `plugin.json` in validation targets                | `pluginManifestSchema` via `safeParse()`                   |

### 2.5 File Size Enforcement

| Constant                    | Value  | File        | Line | Used By                                                                                |
| --------------------------- | ------ | ----------- | ---- | -------------------------------------------------------------------------------------- |
| `MAX_CONFIG_FILE_SIZE`      | 1 MB   | `consts.ts` | :152 | `permission-checker.tsx`, `plugin-settings.ts`                                         |
| `MAX_PLUGIN_FILE_SIZE`      | 1 MB   | `consts.ts` | :151 | `plugin-finder.ts`, `plugin-validator.ts`, `versioning.ts`, `marketplace-generator.ts` |
| `MAX_MARKETPLACE_FILE_SIZE` | 10 MB  | `consts.ts` | :150 | `source-fetcher.ts`                                                                    |
| `MAX_JSON_NESTING_DEPTH`    | 10     | `consts.ts` | :154 | `source-fetcher.ts` (marketplace.json)                                                 |
| `MAX_MARKETPLACE_PLUGINS`   | 10,000 | `consts.ts` | :155 | (available for marketplace size validation)                                            |

All enforced via `readFileSafe()` at `utils/fs.ts:13-21` which checks `stats.size` before reading.

---

## 3. File System Write Boundaries (Data OUT)

### 3.1 Config Writer

| Function                                 | File                             | Line | What It Writes                         | Where                          |
| ---------------------------------------- | -------------------------------- | ---- | -------------------------------------- | ------------------------------ |
| `generateConfigSource()`                 | `configuration/config-writer.ts` | :35  | TypeScript config source               | Returns string (caller writes) |
| `ensureBlankGlobalConfig()`              | `configuration/config-writer.ts` | :525 | Global `config.ts` + `config-types.ts` | `~/.claude-src/`               |
| `generateBlankGlobalConfigSource()`      | `configuration/config-writer.ts` | :489 | Empty global config                    | Returns string                 |
| `generateBlankGlobalConfigTypesSource()` | `configuration/config-writer.ts` | :503 | Never-type config types                | Returns string                 |

Config writer uses `JSON.parse(JSON.stringify(x))` at lines :40-41, :59 to strip undefined values before generating TypeScript source.

### 3.2 Config Types Writer

| Function                       | File                                      | What It Writes                                  | Where                           |
| ------------------------------ | ----------------------------------------- | ----------------------------------------------- | ------------------------------- |
| `writeStandaloneConfigTypes()` | `installation/local-installer.ts:344`     | Narrowed union types (SkillId, AgentName, etc.) | `.claude-src/config-types.ts`   |
| `getGlobalConfigTypesPath()`   | `configuration/config-types-writer.ts:22` | (reads, not writes)                             | `~/.claude-src/config-types.ts` |

### 3.3 Skill Copier

| Function       | File                     | Line        | What It Writes                                    | Where                        |
| -------------- | ------------------------ | ----------- | ------------------------------------------------- | ---------------------------- |
| `copySkillsToPluginFromSource()` / `copySkillsToLocalFlattened()` | `skills/skill-copier.ts` | :131 / :199 | Skill directories (SKILL.md, metadata.yaml, etc.) | `.claude/skills/<skill-id>/` |

Path traversal validation via `validateSkillPath()` at `skill-copier.ts:25-45` -- resolves paths and verifies they stay within the expected parent directory. Checks for null bytes at :30.

### 3.4 Local Installer

| Function                       | File                              | Line      | What It Writes                            | Where                                        |
| ------------------------------ | --------------------------------- | --------- | ----------------------------------------- | -------------------------------------------- |
| `writeScopedConfigs()`         | `installation/local-installer.ts` | :369-425  | Scoped config.ts files (global + project) | `.claude-src/config.ts` per scope            |
| `compileAndWriteAgents()`      | `installation/local-installer.ts` | :427-469  | Compiled agent markdown files             | `.claude/agents/<name>.md` (project or `~/`) |
| `writeStandaloneConfigTypes()` | (called from local-installer)     |           | Config types                              | `.claude-src/config-types.ts`                |

### 3.5 Compiler Agent Output

| Function                     | File          | Line      | What It Writes                                    | Where                          |
| ---------------------------- | ------------- | --------- | ------------------------------------------------- | ------------------------------ |
| `compileAgentForPlugin()`    | `compiler.ts` | (various) | Compiled agent markdown via Liquid templates      | Returns string (caller writes) |
| `removeCompiledOutputDirs()` | `compiler.ts` | :422-426  | Removes `agents/`, `skills/`, `commands/` subdirs | Output directory               |

Template root resolution at `compiler.ts:394-419`: checks local `.claude-src/agents/_templates/`, legacy `.claude/templates/`, then CLI built-in `DIRS.templates`.

### 3.6 Skill Metadata Injection

| Function                     | File                       | Line   | What It Writes                        | Where                   |
| ---------------------------- | -------------------------- | ------ | ------------------------------------- | ----------------------- |
| `injectForkedFromMetadata()` | `skills/skill-metadata.ts` | :299 | Updated metadata.yaml with forkedFrom | Skill's `metadata.yaml` |

---

## 4. Shell Execution Boundaries

All shell execution goes through `execCommand()` at `src/cli/utils/exec.ts:95-130`.

### 4.1 Validation Functions

| Function                      | File      | Line   | What It Validates                              | Patterns                                          |
| ----------------------------- | --------- | ------ | ---------------------------------------------- | ------------------------------------------------- |
| `validatePluginPath()`        | `exec.ts` | :20-41 | Plugin path (max 1024 chars, no control chars) | `SAFE_PLUGIN_PATH_PATTERN`: `[a-zA-Z0-9._@/:~-]+` |
| `validateMarketplaceSource()` | `exec.ts` | :43-64 | Marketplace source (max 1024 chars)            | Same as `SAFE_PLUGIN_PATH_PATTERN`                |
| `validatePluginName()`        | `exec.ts` | :66-87 | Plugin name (max 256 chars)                    | `SAFE_NAME_PATTERN`: `[a-zA-Z0-9._@/-]+`          |

All three validate: non-empty, length limit, no control characters (`[\x00-\x08\x0E-\x1F\x7F]`), allowlist character pattern.

### 4.2 Shell Commands Executed

| Function                          | File      | Line     | Command                                          | Input Validation              |
| --------------------------------- | --------- | -------- | ------------------------------------------------ | ----------------------------- |
| `claudePluginInstall()`           | `exec.ts` | :137-152 | `claude plugin install <path> --scope <scope>`   | `validatePluginPath()`        |
| `claudePluginUninstall()`         | `exec.ts` | :259-278 | `claude plugin uninstall <name> --scope <scope>` | `validatePluginName()`        |
| `claudePluginMarketplaceAdd()`    | `exec.ts` | :202-220 | `claude plugin marketplace add <source>`         | `validateMarketplaceSource()` |
| `claudePluginMarketplaceRemove()` | `exec.ts` | :222-240 | `claude plugin marketplace remove <name>`        | `validatePluginName()`        |
| `claudePluginMarketplaceUpdate()` | `exec.ts` | :242-257 | `claude plugin marketplace update <name>`        | `validatePluginName()`        |
| `claudePluginMarketplaceList()`   | `exec.ts` | :170-195 | `claude plugin marketplace list --json`          | (no user input in args)       |
| `isClaudeCLIAvailable()`          | `exec.ts` | :154-161 | `claude --version`                               | (no user input in args)       |

**Execution method:** `spawn()` with args array (not shell string interpolation). The `stdio` is `["ignore", "pipe", "pipe"]` -- stdin is ignored, stdout/stderr are captured.

---

## 5. Security Boundaries

### 5.1 Source Format Validation

| Property         | Value                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| **Location**     | `src/cli/lib/configuration/config.ts:291-447`                            |
| **Entry points** | `resolveSource()` (:84), `resolveAgentsSource()` (:142)                  |
| **Applied to**   | `--source` flag, `AGENTS_INC_SOURCE` env var, config file `source` field |

**Checks performed:**

| Check                         | Implementation                                         | Purpose                                                                              |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Null byte detection           | `NULL_BYTE_PATTERN` test at :293                       | Prevent C-level string termination bypass in git/giget                               |
| Length limit                  | `MAX_SOURCE_LENGTH` (512) at :303                      | Prevent oversized input                                                              |
| Path traversal in remote URLs | `PATH_TRAVERSAL_PATTERN` (`..`) at :336                | Block `?branch=../../etc/passwd`                                                     |
| UNC path blocking             | `UNC_PATH_PATTERN` (`\\` or `//` prefix) at :418       | Prevent SMB auth credential leaks                                                    |
| Control character blocking    | `CONTROL_CHAR_PATTERN` at :406                         | Prevent terminal injection                                                           |
| HTTP URL hostname validation  | `validateHttpUrl()` at :357-387                        | Require valid hostname                                                               |
| Private IP blocking (SSRF)    | `PRIVATE_IPV4_PATTERN`, `PRIVATE_IPV6_PATTERN` at :377 | Block `127.x.x.x`, `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`, `0.0.0.0`, `169.254.x.x`, `::1`, `fd*:`, `fe80:*` |
| Git shorthand validation      | `validateGitShorthand()` at :389-399                   | Require `owner/repo` format                                                          |

### 5.2 Liquid Template Injection Prevention

| Property     | Value                                    |
| ------------ | ---------------------------------------- | ---- | --- | ---- |
| **Location** | `src/cli/lib/compiler.ts:31-70`          |
| **Function** | `sanitizeCompiledAgentData()` at :77-111 |
| **Pattern**  | `LIQUID_SYNTAX_PATTERN`: `\{\{           | \}\} | \{% | %\}` |

Sanitizes ALL user-controlled fields before Liquid template rendering:

- `agent.name`, `agent.title`, `agent.description`, `agent.tools[]`, `agent.disallowedTools[]`, `agent.model`, `agent.permissionMode`
- `identity`, `playbook`, `output`, `criticalRequirementsTop`, `criticalReminders`
- All skills: `skill.id`, `skill.description`, `skill.usage`, `skill.pluginRef`
- `preloadedSkillIds[]`

Strips `{{`, `}}`, `{%`, `%}` from values and logs a warning when stripping occurs.

### 5.3 Path Traversal Prevention (Skill Copier)

| Property     | Value                                      |
| ------------ | ------------------------------------------ |
| **Location** | `src/cli/lib/skills/skill-copier.ts:25-45` |
| **Function** | `validateSkillPath()`                      |

Validates that resolved skill paths stay within the expected parent directory:

1. Null byte check on the raw skill path (:30)
2. `path.resolve()` both the resolved path and expected parent (:34-35)
3. Verify resolved path starts with parent + path separator (:37-39)

Called for every skill copy operation to prevent `../../sensitive` traversal in skill paths.

### 5.4 `isLocalSource()` Traversal Check

| Property     | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| **Location** | `src/cli/lib/configuration/config.ts:431-447`                         |
| **Purpose**  | Blocks `..` and `~` in paths that don't have remote protocol prefixes |

### 5.5 File Size Limits

See Section 2.5 above. All parse boundaries use `readFileSafe()` which enforces size limits before reading content.

### 5.6 JSON Nesting Depth

| Property      | Value                                           |
| ------------- | ----------------------------------------------- |
| **Location**  | `src/cli/lib/schemas.ts:784-796`                |
| **Function**  | `validateNestingDepth()`                        |
| **Max depth** | `MAX_JSON_NESTING_DEPTH` = 10 (`consts.ts:154`) |
| **Used at**   | `source-fetcher.ts:269` for marketplace.json    |

Recursively checks that parsed JSON/YAML does not exceed max nesting depth. Prevents stack overflow from deeply nested structures.

---

## 6. Plugin/Marketplace API Boundaries

### 6.1 Plugin Discovery

| Function                          | File                         | Line     | What It Reads                                              | Validation                                                                  |
| --------------------------------- | ---------------------------- | -------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| `readPluginManifest()`            | `plugins/plugin-finder.ts`   | :49-71   | `plugin.json`                                              | `readFileSafe(MAX_PLUGIN_FILE_SIZE)` + `pluginManifestSchema.parse()`       |
| `getEnabledPluginKeys()`          | `plugins/plugin-settings.ts` | :63-98   | `.claude/settings.json`                                    | `readFileSafe(MAX_CONFIG_FILE_SIZE)` + `pluginSettingsSchema.safeParse()`   |
| `resolvePluginInstallPaths()`     | `plugins/plugin-settings.ts` | :103-173 | `~/.claude/plugins/installed_plugins.json`                 | `readFileSafe(MAX_CONFIG_FILE_SIZE)` + `installedPluginsSchema.safeParse()` |
| `getVerifiedPluginInstallPaths()` | `plugins/plugin-settings.ts` | :179-198 | Combines settings + registry, verifies paths exist on disk | `fileExists()` check for each plugin manifest                               |

### 6.2 Plugin Validation

| Function                     | File                                   | What It Validates       | Schema                                      |
| ---------------------------- | -------------------------------------- | ----------------------- | ------------------------------------------- |
| `validatePluginManifest()`   | `plugins/plugin-validator.ts:114-183`  | `plugin.json` structure | `pluginManifestValidationSchema` (strict)   |
| `validateSkillFrontmatter()` | `plugins/plugin-validator.ts:185-219`  | `SKILL.md` frontmatter  | `skillFrontmatterValidationSchema` (strict) |
| `validateAgentFrontmatter()` | `plugins/plugin-validator.ts:221-264`  | Agent `.md` frontmatter | `agentFrontmatterValidationSchema` (strict) |

### 6.3 Marketplace Registration (Shell Boundary)

| Function                          | File      | Line     | Direction                     | Validation                    |
| --------------------------------- | --------- | -------- | ----------------------------- | ----------------------------- |
| `claudePluginMarketplaceAdd()`    | `exec.ts` | :202-220 | OUT (registers marketplace)   | `validateMarketplaceSource()` |
| `claudePluginMarketplaceRemove()` | `exec.ts` | :222-240 | OUT (deregisters marketplace) | `validatePluginName()`        |
| `claudePluginInstall()`           | `exec.ts` | :137-152 | OUT (installs plugin)         | `validatePluginPath()`        |
| `claudePluginUninstall()`         | `exec.ts` | :259-278 | OUT (uninstalls plugin)       | `validatePluginName()`        |

### 6.4 Marketplace File Parsing

| Property       | Value                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Location**   | `src/cli/lib/loading/source-fetcher.ts:~255-284`                                                                                                 |
| **Direction**  | IN                                                                                                                                               |
| **Data**       | `marketplace.json` from fetched remote source                                                                                                    |
| **Validation** | `readFileSafe(MAX_MARKETPLACE_FILE_SIZE)` -> `JSON.parse()` -> `validateNestingDepth(MAX_JSON_NESTING_DEPTH)` -> `marketplaceSchema.safeParse()` |

This is the most heavily validated parse boundary: size limit (10 MB), nesting depth (10), and full Zod schema validation.

### 6.5 Marketplace Generation

| Function                                        | File                       | Line   | Direction                                           |
| ----------------------------------------------- | -------------------------- | ------ | --------------------------------------------------- |
| `readPluginManifest()`                          | `marketplace-generator.ts` | :23-33 | IN (reads plugin manifests to generate marketplace) |
| (output written by `build marketplace` command) |                            |        | OUT (writes `marketplace.json`)                     |

---

## 7. Schema Reference

### Lenient Schemas (Parse Boundaries)

Used at data entry points with `.passthrough()` for forward compatibility.

| Schema                         | File                         | Line     | Used For                             |
| ------------------------------ | ---------------------------- | -------- | ------------------------------------ |
| `projectConfigLoaderSchema`    | `schemas.ts`                 | :251-292 | `.claude-src/config.ts` loading      |
| `projectSourceConfigSchema`    | `schemas.ts`                 | :510-549 | `.claude-src/config.yaml` loading    |
| `skillMetadataLoaderSchema`    | `schemas.ts`                 | :172-181 | `metadata.yaml` in skill compilation |
| `localSkillMetadataSchema`     | `schemas.ts`                 | :393-408 | Local skill metadata (forkedFrom)    |
| `localRawMetadataSchema`       | `schemas.ts`                 | :371-390 | Raw metadata in local skills         |
| `skillFrontmatterLoaderSchema` | `schemas.ts`                 | :165-169 | SKILL.md frontmatter (lenient)       |
| `pluginManifestSchema`         | `schemas.ts`                 | :188-198 | `plugin.json` loading                |
| `marketplaceSchema`            | `schemas.ts`                 | :455-463 | `marketplace.json` loading           |
| `pluginSettingsSchema`         | `plugins/plugin-settings.ts` | :34-38   | `.claude/settings.json`              |
| `installedPluginsSchema`       | `plugins/plugin-settings.ts` | :50-55   | `installed_plugins.json`             |
| `settingsFileSchema`           | `schemas.ts`                 | :474-478 | Settings YAML                        |
| `importedSkillMetadataSchema`  | `schemas.ts`                 | :481-496 | Imported skill metadata              |
| `stacksConfigSchema`           | `schemas.ts`                 | :422-424 | `config/stacks.ts`                   |
| `skillCategoriesFileSchema`    | `schemas.ts`                 | :353-356 | `config/skill-categories.ts`         |
| `skillRulesFileSchema`         | `schemas.ts`                 | :362-365 | `config/skill-rules.ts`              |
| `agentYamlConfigSchema`        | `schemas.ts`                 | :215-227 | Agent YAML definition                |

### Strict Schemas (Validation Boundaries)

Used for validation commands and build-time checks. Reject unknown fields via `.strict()`.

| Schema                             | File         | Line     | Used For                                   |
| ---------------------------------- | ------------ | -------- | ------------------------------------------ |
| `pluginManifestValidationSchema`   | `schemas.ts` | :201-213 | `agentsinc validate` plugin validation     |
| `skillFrontmatterValidationSchema` | `schemas.ts` | :591-609 | SKILL.md strict validation                 |
| `agentFrontmatterValidationSchema` | `schemas.ts` | :573-588 | Agent frontmatter strict validation        |
| `metadataValidationSchema`         | `schemas.ts` | :612-653 | Published skill metadata strict validation |
| `customMetadataValidationSchema`   | `schemas.ts` | :656-699 | Custom skill metadata validation           |
| `agentYamlGenerationSchema`        | `schemas.ts` | :555-570 | Compiled agent metadata validation         |
| `stackConfigValidationSchema`      | `schemas.ts` | :710-773 | Published stack config validation          |

### Utility Schemas (Shared Building Blocks)

| Schema                   | File         | Line     | Used In                                         |
| ------------------------ | ------------ | -------- | ----------------------------------------------- |
| `skillIdSchema`          | `schemas.ts` | :85-90   | Validated against generated `SKILL_IDS` array   |
| `skillSlugSchema`        | `schemas.ts` | :82      | Validated against generated `SKILL_SLUGS` array |
| `categorySchema`         | `schemas.ts` | :62      | Validated against generated `CATEGORIES` array  |
| `categoryPathSchema`     | `schemas.ts` | :119-129 | Known category, "local", or kebab-case          |
| `domainSchema`           | `schemas.ts` | :45      | Validated against generated `DOMAINS` array     |
| `agentNameSchema`        | `schemas.ts` | :64      | Validated against generated `AGENT_NAMES` array |
| `modelNameSchema`        | `schemas.ts` | :66-71   | `"sonnet" \| "opus" \| "haiku" \| "inherit"`    |
| `permissionModeSchema`   | `schemas.ts` | :73-80   | Agent permission modes                          |
| `skillAssignmentSchema`  | `schemas.ts` | :157-162 | Skill assignment objects                        |
| `stackAgentConfigSchema` | `schemas.ts` | :241-244 | Per-agent stack categories                      |
| `boundSkillSchema`       | `schemas.ts` | :53-59   | Bound skill entries                             |

### Helper Functions

| Function                 | File         | Line     | Purpose                            |
| ------------------------ | ------------ | -------- | ---------------------------------- |
| `formatZodErrors()`      | `schemas.ts` | :776-778 | Format Zod issues to string        |
| `validateNestingDepth()` | `schemas.ts` | :784-796 | Check JSON nesting depth           |
| `warnUnknownFields()`    | `schemas.ts` | :803-813 | Log warnings for unexpected fields |

---

## 8. Boundary Pattern Summary

### Data IN: Validation Chain

All data entering the system follows one of these validated paths:

```
CLI flags --> oclif type checking --> downstream semantic validation (validateSourceFormat)
YAML files --> readFileSafe(sizeLimit) --> parseYaml() --> schema.safeParse()
JSON files --> readFileSafe(sizeLimit) --> JSON.parse() --> schema.safeParse() or schema.parse()
TS configs --> fileExists() --> jiti.import() --> optional schema.safeParse()
Shell output --> JSON.parse(stdout) --> Array.isArray() / type assertion
```

### Data OUT: Generation Chain

```
Config objects --> JSON.parse(JSON.stringify(x)) to strip undefined --> generateConfigSource() --> writeFile()
Agent data --> sanitizeCompiledAgentData() --> Liquid template rendering --> writeFile()
Skill files --> validateSkillPath() (traversal check) --> copy()
Shell commands --> validate{PluginPath|PluginName|MarketplaceSource}() --> spawn() with args array
```

### Unvalidated Boundaries (Potential Gaps)

| Location                                      | Issue                                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `exec.ts:180` (`claudePluginMarketplaceList`) | JSON.parse of Claude CLI stdout, only `Array.isArray()` check, no Zod schema, cast to `MarketplaceInfo[]` |
| `exec.ts:191`                                 | Array elements cast as `MarketplaceInfo[]` without per-element validation                                 |

These are low-risk since the data comes from the locally-installed Claude CLI binary (trusted source), not from user or network input.
