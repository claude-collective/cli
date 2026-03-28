# Utilities Reference

**Last Updated:** 2026-03-28

## Utility Files

All utilities in `src/cli/utils/`.

| File              | Path                            | Purpose                                |
| ----------------- | ------------------------------- | -------------------------------------- |
| `errors.ts`       | `src/cli/utils/errors.ts`       | Error message extraction               |
| `exec.ts`         | `src/cli/utils/exec.ts`         | Shell command execution                |
| `frontmatter.ts`  | `src/cli/utils/frontmatter.ts`  | YAML frontmatter extraction            |
| `fs.ts`           | `src/cli/utils/fs.ts`           | File system wrappers                   |
| `logger.ts`       | `src/cli/utils/logger.ts`       | Logging: log, warn, verbose            |
| `messages.ts`     | `src/cli/utils/messages.ts`     | User-facing message constants          |
| `string.ts`       | `src/cli/utils/string.ts`       | String manipulation utilities          |
| `type-guards.ts`  | `src/cli/utils/type-guards.ts`  | Runtime type narrowing for union types |
| `typed-object.ts` | `src/cli/utils/typed-object.ts` | Type-safe Object.entries/keys          |
| `yaml.ts`         | `src/cli/utils/yaml.ts`         | Zod-validated YAML loading (DEAD CODE) |

## Error Handling

### `getErrorMessage()` (`src/cli/utils/errors.ts:2`)

```typescript
function getErrorMessage(error: unknown): string;
```

Extracts human-readable message from unknown error value. Returns `error.message` for Error instances, `String(error)` otherwise.

**Used in:** Every catch block across the codebase.

## Shell Execution

### `execCommand()` (`src/cli/utils/exec.ts:95`)

```typescript
function execCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
): Promise<ExecResult>;
```

Spawns a child process with stdio piped. Returns `{ stdout, stderr, exitCode }`.

### Exported Types

| Type              | Location | Fields                             |
| ----------------- | -------- | ---------------------------------- |
| `ExecResult`      | `:89`    | `stdout`, `stderr`, `exitCode`     |
| `MarketplaceInfo` | `:163`   | `name`, `source`, `repo?`, `path?` |

### Claude CLI Wrappers

All validate inputs before execution (injection prevention at lines 20-87):

| Function                          | Line   | Purpose                                                       |
| --------------------------------- | ------ | ------------------------------------------------------------- |
| `claudePluginInstall()`           | `:137` | Install a plugin via `claude plugin install`                  |
| `claudePluginUninstall()`         | `:259` | Uninstall via `claude plugin uninstall`                       |
| `claudePluginMarketplaceList()`   | `:170` | List marketplaces via `claude plugin marketplace list --json` |
| `claudePluginMarketplaceExists()` | `:197` | Check if marketplace is registered                            |
| `claudePluginMarketplaceAdd()`    | `:202` | Register marketplace via `claude plugin marketplace add`      |
| `claudePluginMarketplaceRemove()` | `:222` | Remove marketplace via `claude plugin marketplace remove`     |
| `claudePluginMarketplaceUpdate()` | `:242` | Update marketplace via `claude plugin marketplace update`     |
| `isClaudeCLIAvailable()`          | `:154` | Check if `claude` CLI is available                            |

**Total: 8 functions** (6 documented in prior version, 2 were missing: `Remove` and `Update`)

### Internal Helpers (not exported)

| Function                      | Line   | Purpose                                                         |
| ----------------------------- | ------ | --------------------------------------------------------------- |
| `validatePluginPath()`        | `:20`  | Validates plugin path string (length, chars, control)           |
| `validateMarketplaceSource()` | `:43`  | Validates marketplace source string                             |
| `validatePluginName()`        | `:66`  | Validates plugin name string                                    |
| `resolvePluginCwd()`          | `:133` | Returns home dir for `"user"` scope, projectDir for `"project"` |

## Frontmatter

### `extractFrontmatter()` (`src/cli/utils/frontmatter.ts:3`)

```typescript
function extractFrontmatter(content: string): unknown | null;
```

Extracts YAML frontmatter from `---\n...\n---` delimited content. Returns parsed YAML object or null.

**Note:** For SKILL.md parsing, use `parseFrontmatter()` from `src/cli/lib/loading/loader.ts` instead -- it adds Zod validation.

## File System

### `src/cli/utils/fs.ts`

Wraps `fs-extra` and `fast-glob`:

| Function             | Signature                                     | Purpose                               |
| -------------------- | --------------------------------------------- | ------------------------------------- |
| `readFile()`         | `(filePath: string) => Promise<string>`       | Read file as UTF-8                    |
| `readFileSafe()`     | `(filePath, maxSizeBytes) => Promise<string>` | Read with size limit (DoS prevention) |
| `readFileOptional()` | `(filePath, fallback?) => Promise<string>`    | Read or return fallback               |
| `fileExists()`       | `(filePath: string) => Promise<boolean>`      | Check file/dir existence              |
| `directoryExists()`  | `(dirPath: string) => Promise<boolean>`       | Check directory existence             |
| `listDirectories()`  | `(dirPath: string) => Promise<string[]>`      | List subdirectories                   |
| `glob()`             | `(pattern, cwd) => Promise<string[]>`         | Fast-glob file matching               |
| `writeFile()`        | `(filePath, content) => Promise<void>`        | Write file (ensures parent dir)       |
| `ensureDir()`        | `(dirPath: string) => Promise<void>`          | Create directory recursively          |
| `remove()`           | `(filePath: string) => Promise<void>`         | Remove file/directory                 |
| `copy()`             | `(src, dest) => Promise<void>`                | Copy file/directory                   |

## Logger

### `src/cli/utils/logger.ts`

| Function       | Signature                                      | Visibility      | Purpose                       |
| -------------- | ---------------------------------------------- | --------------- | ----------------------------- |
| `log(msg)`     | `(msg: string) => void`                        | Always          | User-facing progress output   |
| `warn(msg)`    | `(msg: string, options?: WarnOptions) => void` | Always          | Issues user should know about |
| `verbose(msg)` | `(msg: string) => void`                        | Only if enabled | Diagnostic/debug info         |
| `setVerbose()` | `(enabled: boolean) => void`                   | N/A             | Enable/disable verbose mode   |

### `WarnOptions` type (`src/cli/utils/logger.ts:66`)

```typescript
export type WarnOptions = {
  /** When true, suppresses this warning in test environments (VITEST=true). */
  suppressInTest?: boolean;
};
```

The `warn()` function accepts an optional second parameter. When `suppressInTest: true` is set and `process.env.VITEST` is truthy, the warning is silently dropped. This prevents noisy test output for expected warnings.

### Startup Message Buffering

Before Ink takes over the terminal, `warn()` messages would be overwritten. Buffering captures them for display in Ink's `<Static>` component.

| Function              | Purpose                                   |
| --------------------- | ----------------------------------------- |
| `enableBuffering()`   | Start capturing warn() messages in buffer |
| `drainBuffer()`       | Return captured messages and clear buffer |
| `disableBuffering()`  | Stop buffering and clear buffer           |
| `pushBufferMessage()` | Manually add a message to buffer          |

**Type:** `StartupMessage = { level: "info" | "warn" | "error"; text: string }`

**Used by:** `init.tsx` and `edit.tsx` to capture loading messages before wizard renders.

**Style guide** (from logger.ts comments):

- Start with capital letter
- End with period if complete sentence, no period if fragment after colon
- Wrap dynamic values in single quotes: `'value'`
- Do NOT prefix warn messages with "Warning:" (added automatically)
- After colon use lowercase
- Use em dash for supplemental info

## String Utilities

### `truncateText()` (`src/cli/utils/string.ts:1`)

```typescript
function truncateText(text: string, maxLength: number): string;
```

Truncates text to `maxLength` characters, appending an ellipsis character (U+2026) if truncated. Returns the original text if it fits within `maxLength`.

**Used by:**

- `src/cli/commands/search.tsx` -- truncate skill descriptions in search results
- `src/cli/components/skill-search/skill-search.tsx` -- truncate source names and display names
- `src/cli/lib/operations/skills/resolve-skill-info.ts` -- truncate long lines in skill info output

## Type Guards

### `src/cli/utils/type-guards.ts`

Runtime type narrowing functions for generated union types. Imports union arrays from `types/generated/source-types.ts`.

| Function           | Signature                                  | Purpose                              |
| ------------------ | ------------------------------------------ | ------------------------------------ |
| `isCategory()`     | `(value: string) => value is Category`     | Check if string is a valid Category  |
| `isDomain()`       | `(value: string) => value is Domain`       | Check if string is a valid Domain    |
| `isAgentName()`    | `(value: string) => value is AgentName`    | Check if string is a valid AgentName |
| `isCategoryPath()` | `(value: string) => value is CategoryPath` | Check Category or `"local"` literal  |

**Mandatory:** Use these instead of `as` casts for runtime narrowing at data boundaries (YAML/JSON parse, CLI args).

## Type-Safe Object Utilities

### `src/cli/utils/typed-object.ts`

```typescript
function typedEntries<K extends string, V>(obj: Partial<Record<K, V>>): [K, V][];
function typedKeys<K extends string>(obj: Partial<Record<K, unknown>>): K[];
```

**Mandatory:** Use these instead of raw `Object.entries()` / `Object.keys()` to preserve union type information and avoid boundary casts.

## YAML Loading (DEAD CODE)

### `safeLoadYamlFile()` (`src/cli/utils/yaml.ts:13`)

```typescript
function safeLoadYamlFile<T>(
  filePath: string,
  schema: z.ZodType<T>,
  maxSizeBytes?: number,
): Promise<T | null>;
```

Combines: file read (with size limit) -> YAML parse -> Zod validation.
Returns validated data or null (with warning on failure).

Default size limit: `MAX_CONFIG_FILE_SIZE` (1MB from `src/cli/consts.ts:144`).

**DEAD CODE WARNING:** As of 2026-03-28, `safeLoadYamlFile` has **zero production importers**. It is only imported by its own test file (`src/cli/utils/yaml.test.ts`). All production YAML loading uses the `yaml` package's `parseYaml()` directly (imported in 10+ files as `import { parse as parseYaml } from "yaml"`). This function can likely be removed.

## User-Facing Messages

### `src/cli/utils/messages.ts`

All user-facing strings centralized in constant objects:

| Object             | Count | Examples                                                              |
| ------------------ | ----- | --------------------------------------------------------------------- |
| `ERROR_MESSAGES`   | 10    | NO_INSTALLATION, NO_SKILLS_FOUND, VALIDATION_FAILED, SKILL_NOT_FOUND  |
| `SUCCESS_MESSAGES` | 5     | INIT_SUCCESS, PLUGIN_COMPILE_COMPLETE, ALL_SKILLS_UP_TO_DATE          |
| `STATUS_MESSAGES`  | 12    | LOADING_SKILLS, COMPILING_AGENTS, FETCHING_REPOSITORY, COPYING_SKILLS |
| `INFO_MESSAGES`    | 6     | NO_CHANGES_MADE, RUN_COMPILE, NOT_INSTALLED, NO_PLUGIN_INSTALLATION   |

## Constants Reference (`src/cli/consts.ts`)

### Paths

| Constant                | Value                        | Line  | Purpose                       |
| ----------------------- | ---------------------------- | ----- | ----------------------------- |
| `PROJECT_ROOT`          | CLI package root             | `:13` | Base for template resolution  |
| `GLOBAL_INSTALL_ROOT`   | `os.homedir()`               | `:23` | Root for global installations |
| `CLAUDE_DIR`            | `.claude`                    | `:15` | Claude config directory       |
| `CLAUDE_SRC_DIR`        | `.claude-src`                | `:16` | Source config directory       |
| `PLUGINS_SUBDIR`        | `plugins`                    | `:17` | Plugins subdirectory          |
| `PLUGIN_MANIFEST_DIR`   | `.claude-plugin`             | `:18` | Plugin manifest directory     |
| `PLUGIN_MANIFEST_FILE`  | `plugin.json`                | `:19` | Plugin manifest filename      |
| `DEFAULT_PLUGIN_NAME`   | `agents-inc`                 | `:20` | Default plugin name           |
| `CACHE_DIR`             | `~/.cache/agents-inc`        | `:25` | Source cache directory        |
| `SKILL_CATEGORIES_PATH` | `config/skill-categories.ts` | `:29` | Skill categories config file  |
| `SKILL_RULES_PATH`      | `config/skill-rules.ts`      | `:30` | Skill rules config file       |
| `STACKS_FILE_PATH`      | `config/stacks.ts`           | `:31` | Stacks config file            |
| `SKILLS_DIR_PATH`       | `src/skills`                 | `:32` | Skills source directory       |
| `LOCAL_SKILLS_PATH`     | `.claude/skills`             | `:33` | Local skills directory        |

### Directory Constants

`DIRS` object at line 35:

| Key         | Value                   | Purpose                   |
| ----------- | ----------------------- | ------------------------- |
| `agents`    | `src/agents`            | Agent templates directory |
| `skills`    | `src/skills`            | Skills source directory   |
| `stacks`    | `src/stacks`            | Stacks config directory   |
| `templates` | `src/agents/_templates` | Agent templates           |
| `commands`  | `src/commands`          | CLI commands directory    |

### Standard Files and Dirs

`STANDARD_FILES` constant at line 43. All well-known filenames:

| Constant                                  | Value                      |
| ----------------------------------------- | -------------------------- |
| `STANDARD_FILES.SKILL_MD`                 | `SKILL.md`                 |
| `STANDARD_FILES.METADATA_YAML`            | `metadata.yaml`            |
| `STANDARD_FILES.METADATA_JSON`            | `metadata.json`            |
| `STANDARD_FILES.CONFIG_YAML`              | `config.yaml`              |
| `STANDARD_FILES.SKILL_CATEGORIES_TS`      | `skill-categories.ts`      |
| `STANDARD_FILES.SKILL_RULES_TS`           | `skill-rules.ts`           |
| `STANDARD_FILES.AGENT_METADATA_YAML`      | `metadata.yaml`            |
| `STANDARD_FILES.PLUGIN_JSON`              | `plugin.json`              |
| `STANDARD_FILES.CONFIG_TS`                | `config.ts`                |
| `STANDARD_FILES.CONFIG_TYPES_TS`          | `config-types.ts`          |
| `STANDARD_FILES.CLAUDE_MD`                | `CLAUDE.md`                |
| `STANDARD_FILES.REFERENCE_MD`             | `reference.md`             |
| `STANDARD_FILES.IDENTITY_MD`              | `identity.md`              |
| `STANDARD_FILES.PLAYBOOK_MD`              | `playbook.md`              |
| `STANDARD_FILES.OUTPUT_MD`                | `output.md`                |
| `STANDARD_FILES.CRITICAL_REQUIREMENTS_MD` | `critical-requirements.md` |
| `STANDARD_FILES.CRITICAL_REMINDERS_MD`    | `critical-reminders.md`    |

`STANDARD_DIRS` constant at line 63:

| Constant                 | Value      |
| ------------------------ | ---------- |
| `STANDARD_DIRS.EXAMPLES` | `examples` |
| `STANDARD_DIRS.SCRIPTS`  | `scripts`  |
| `STANDARD_DIRS.SKILLS`   | `skills`   |

### Branding and Naming

| Constant                     | Value                           | Line   | Purpose                             |
| ---------------------------- | ------------------------------- | ------ | ----------------------------------- |
| `CLI_BIN_NAME`               | `agentsinc`                     | `:27`  | CLI binary name                     |
| `DEFAULT_BRANDING.NAME`      | `Agents Inc.`                   | `:162` | Default product name                |
| `DEFAULT_BRANDING.TAGLINE`   | `AI-powered development tools`  | `:162` | Default tagline                     |
| `DEFAULT_PUBLIC_SOURCE_NAME` | `agents-inc`                    | `:168` | Fallback marketplace name           |
| `SOURCE_DISPLAY_NAMES`       | `{ public, local, agents-inc }` | `:171` | Human-readable source type labels   |
| `DEFAULT_VERSION`            | `1.0.0`                         | `:69`  | Default skill version               |
| `DEFAULT_DISPLAY_VERSION`    | `0.0.0`                         | `:72`  | Indicates no version explicitly set |

### Versioning and Hashing

| Constant                       | Value | Line   | Purpose                     |
| ------------------------------ | ----- | ------ | --------------------------- |
| `HASH_PREFIX_LENGTH`           | 7     | `:132` | Hash prefix for display     |
| `CACHE_HASH_LENGTH`            | 16    | `:135` | Cache directory hash length |
| `CACHE_READABLE_PREFIX_LENGTH` | 32    | `:138` | Cache dir readable prefix   |

### Limits

| Constant                    | Value  | Line   | Purpose                     |
| --------------------------- | ------ | ------ | --------------------------- |
| `MAX_MARKETPLACE_FILE_SIZE` | 10 MB  | `:142` | marketplace.json size limit |
| `MAX_PLUGIN_FILE_SIZE`      | 1 MB   | `:143` | Plugin file size limit      |
| `MAX_CONFIG_FILE_SIZE`      | 1 MB   | `:144` | Config file size limit      |
| `MAX_JSON_NESTING_DEPTH`    | 10     | `:146` | JSON nesting limit          |
| `MAX_MARKETPLACE_PLUGINS`   | 10,000 | `:147` | Max plugins in marketplace  |

### YAML Formatting

| Constant                          | Value | Purpose            |
| --------------------------------- | ----- | ------------------ |
| `YAML_FORMATTING.INDENT`          | 2     | YAML indentation   |
| `YAML_FORMATTING.LINE_WIDTH`      | 120   | Default line width |
| `YAML_FORMATTING.LINE_WIDTH_NONE` | 0     | Disable wrapping   |

### UI Constants

`UI_SYMBOLS` at line 99, `UI_LAYOUT` at line 114, `CLI_COLORS` at line 177, `SCROLL_VIEWPORT` at line 149.

These are documented in detail in `reference/component-patterns.md`.

### Schema Paths

`SCHEMA_PATHS` object at line 78. JSON Schema URLs for yaml-language-server `$schema` comments:

| Key                   | Schema URL suffix                   |
| --------------------- | ----------------------------------- |
| `agent`               | `agent.schema.json`                 |
| `metadata`            | `metadata.schema.json`              |
| `marketplace`         | `marketplace.schema.json`           |
| `projectConfig`       | `project-config.schema.json`        |
| `projectSourceConfig` | `project-source-config.schema.json` |
| `stacks`              | `stacks.schema.json`                |

Helper: `yamlSchemaComment(schemaPath: string): string` at line 88 generates a `# yaml-language-server: $schema=...` comment.

### Source Resolution

| Constant                      | Value                             | Line   | Purpose                            |
| ----------------------------- | --------------------------------- | ------ | ---------------------------------- |
| `GITHUB_SOURCE.HTTPS_PREFIX`  | `https://github.com/`             | `:121` | GitHub HTTPS URL prefix            |
| `GITHUB_SOURCE.GITHUB_PREFIX` | `github:`                         | `:121` | GitHub shorthand prefix            |
| `GITHUB_SOURCE.GH_PREFIX`     | `gh:`                             | `:121` | GitHub short prefix                |
| `DEFAULT_SKILLS_SUBDIR`       | `skills`                          | `:127` | Default skills subdirectory name   |
| `KEBAB_CASE_PATTERN`          | `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/` | `:130` | Strict kebab-case validation regex |

### Domain Configuration

| Constant                  | Value                                                              | Line   |
| ------------------------- | ------------------------------------------------------------------ | ------ |
| `BUILT_IN_DOMAIN_ORDER`   | `["web", "api", "ai", "mobile", "cli", "infra", "meta", "shared"]` | `:190` |
| `DEFAULT_SCRATCH_DOMAINS` | `["web", "api", "mobile"]`                                         | `:202` |

## Remeda Utilities (External)

Used across 20+ files. Key functions:

| Function       | Usage                     |
| -------------- | ------------------------- |
| `unique()`     | Deduplicate arrays        |
| `uniqueBy()`   | Deduplicate by key        |
| `sortBy()`     | Sort with comparators     |
| `indexBy()`    | Index array into object   |
| `mapToObj()`   | Transform array to object |
| `pipe()`       | Functional pipeline       |
| `flatMap()`    | Flat map                  |
| `filter()`     | Type-safe filter          |
| `mapValues()`  | Transform record values   |
| `difference()` | Set difference            |
| `groupBy()`    | Group array by key        |
| `countBy()`    | Count occurrences         |
| `sumBy()`      | Sum by accessor           |

## Test Mocks

| Mock File                           | Mocks                  |
| ----------------------------------- | ---------------------- |
| `src/cli/utils/__mocks__/fs.ts`     | File system operations |
| `src/cli/utils/__mocks__/logger.ts` | Logging functions      |
