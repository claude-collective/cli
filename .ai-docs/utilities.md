# Utilities Reference

**Last Updated:** 2026-02-25

## Utility Files

All utilities in `src/cli/utils/`.

| File              | Path                            | Purpose                       |
| ----------------- | ------------------------------- | ----------------------------- |
| `errors.ts`       | `src/cli/utils/errors.ts`       | Error message extraction      |
| `exec.ts`         | `src/cli/utils/exec.ts`         | Shell command execution       |
| `frontmatter.ts`  | `src/cli/utils/frontmatter.ts`  | YAML frontmatter extraction   |
| `fs.ts`           | `src/cli/utils/fs.ts`           | File system wrappers          |
| `logger.ts`       | `src/cli/utils/logger.ts`       | Logging: log, warn, verbose   |
| `messages.ts`     | `src/cli/utils/messages.ts`     | User-facing message constants |
| `typed-object.ts` | `src/cli/utils/typed-object.ts` | Type-safe Object.entries/keys |
| `yaml.ts`         | `src/cli/utils/yaml.ts`         | Zod-validated YAML loading    |

## Error Handling

### `getErrorMessage()` (`src/cli/utils/errors.ts:2`)

```typescript
function getErrorMessage(error: unknown): string;
```

Extracts human-readable message from unknown error value. Returns `error.message` for Error instances, `String(error)` otherwise.

**Used in:** Every catch block across the codebase.

## Shell Execution

### `execCommand()` (`src/cli/utils/exec.ts:94-129`)

```typescript
function execCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
): Promise<ExecResult>;
```

Spawns a child process with stdio piped. Returns `{ stdout, stderr, exitCode }`.

### Claude CLI Wrappers

All validate inputs before execution (injection prevention):

| Function                          | Purpose                                                       |
| --------------------------------- | ------------------------------------------------------------- |
| `claudePluginInstall()`           | Install a plugin via `claude plugin install`                  |
| `claudePluginUninstall()`         | Uninstall via `claude plugin uninstall`                       |
| `claudePluginMarketplaceList()`   | List marketplaces via `claude plugin marketplace list --json` |
| `claudePluginMarketplaceExists()` | Check if marketplace is registered                            |
| `claudePluginMarketplaceAdd()`    | Register marketplace via `claude plugin marketplace add`      |
| `isClaudeCLIAvailable()`          | Check if `claude` CLI is available                            |

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

| Function       | Visibility      | Purpose                       |
| -------------- | --------------- | ----------------------------- |
| `log(msg)`     | Always          | User-facing progress output   |
| `warn(msg)`    | Always          | Issues user should know about |
| `verbose(msg)` | Only if enabled | Diagnostic/debug info         |
| `setVerbose()` | N/A             | Enable/disable verbose mode   |

**Style guide** (from logger.ts comments):

- Start with capital letter
- End with period if complete sentence, no period if fragment after colon
- Wrap dynamic values in single quotes: `'value'`
- Do NOT prefix warn messages with "Warning:" (added automatically)
- After colon use lowercase
- Use em dash for supplemental info

## Type-Safe Object Utilities

### `src/cli/utils/typed-object.ts`

```typescript
function typedEntries<K extends string, V>(obj: Partial<Record<K, V>>): [K, V][];
function typedKeys<K extends string>(obj: Partial<Record<K, unknown>>): K[];
```

**Mandatory:** Use these instead of raw `Object.entries()` / `Object.keys()` to preserve union type information and avoid boundary casts.

## YAML Loading

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

Default size limit: `MAX_CONFIG_FILE_SIZE` (1MB from `src/cli/consts.ts:140`).

## User-Facing Messages

### `src/cli/utils/messages.ts`

All user-facing strings centralized in constant objects:

| Object             | Count | Examples                                                              |
| ------------------ | ----- | --------------------------------------------------------------------- |
| `ERROR_MESSAGES`   | 10    | NO_INSTALLATION, NO_SKILLS_FOUND, VALIDATION_FAILED, SKILL_NOT_FOUND  |
| `SUCCESS_MESSAGES` | 6     | INIT_SUCCESS, PLUGIN_COMPILE_COMPLETE                                 |
| `STATUS_MESSAGES`  | 12    | LOADING_SKILLS, COMPILING_AGENTS, FETCHING_REPOSITORY, COPYING_SKILLS |
| `INFO_MESSAGES`    | 7     | NO_CHANGES_MADE, RUN_COMPILE, NOT_INSTALLED, NO_AGENTS_TO_COMPILE     |
| `DRY_RUN_MESSAGES` | 5     | PREVIEW_NO_FILES_CREATED, COMPLETE_NO_FILES_WRITTEN                   |

## Constants Reference (`src/cli/consts.ts`)

### Paths

| Constant               | Value                       | Purpose                      |
| ---------------------- | --------------------------- | ---------------------------- |
| `PROJECT_ROOT`         | CLI package root            | Base for template resolution |
| `CLAUDE_DIR`           | `.claude`                   | Claude config directory      |
| `CLAUDE_SRC_DIR`       | `.claude-src`               | Source config directory      |
| `PLUGINS_SUBDIR`       | `plugins`                   | Plugins subdirectory         |
| `PLUGIN_MANIFEST_DIR`  | `.claude-plugin`            | Plugin manifest directory    |
| `PLUGIN_MANIFEST_FILE` | `plugin.json`               | Plugin manifest filename     |
| `DEFAULT_PLUGIN_NAME`  | `agents-inc`                | Default plugin name          |
| `CACHE_DIR`            | `~/.cache/agents-inc`       | Source cache directory       |
| `SKILLS_MATRIX_PATH`   | `config/skills-matrix.yaml` | Matrix config file           |
| `STACKS_FILE_PATH`     | `config/stacks.yaml`        | Stacks config file           |
| `SKILLS_DIR_PATH`      | `src/skills`                | Skills source directory      |
| `LOCAL_SKILLS_PATH`    | `.claude/skills`            | Local skills directory       |

### Standard Files and Dirs

`STANDARD_FILES` and `STANDARD_DIRS` constants enumerate all well-known file and directory names used throughout the codebase. Key entries:

| Constant                             | Value           |
| ------------------------------------ | --------------- |
| `STANDARD_FILES.SKILL_MD`            | `SKILL.md`      |
| `STANDARD_FILES.METADATA_YAML`       | `metadata.yaml` |
| `STANDARD_FILES.CONFIG_YAML`         | `config.yaml`   |
| `STANDARD_FILES.AGENT_METADATA_YAML` | `metadata.yaml` |
| `STANDARD_FILES.PLUGIN_JSON`         | `plugin.json`   |
| `STANDARD_FILES.CLAUDE_MD`           | `CLAUDE.md`     |
| `STANDARD_DIRS.EXAMPLES`             | `examples`      |
| `STANDARD_DIRS.SCRIPTS`              | `scripts`       |
| `STANDARD_DIRS.SKILLS`               | `skills`        |

### Limits

| Constant                       | Value  | Purpose                     |
| ------------------------------ | ------ | --------------------------- |
| `MAX_MARKETPLACE_FILE_SIZE`    | 10 MB  | marketplace.json size limit |
| `MAX_PLUGIN_FILE_SIZE`         | 1 MB   | Plugin file size limit      |
| `MAX_CONFIG_FILE_SIZE`         | 1 MB   | Config file size limit      |
| `MAX_JSON_NESTING_DEPTH`       | 10     | JSON nesting limit          |
| `MAX_MARKETPLACE_PLUGINS`      | 10,000 | Max plugins in marketplace  |
| `HASH_PREFIX_LENGTH`           | 7      | Hash prefix for display     |
| `CACHE_HASH_LENGTH`            | 16     | Cache directory hash length |
| `CACHE_READABLE_PREFIX_LENGTH` | 32     | Cache dir readable prefix   |

### YAML Formatting

| Constant                          | Value | Purpose            |
| --------------------------------- | ----- | ------------------ |
| `YAML_FORMATTING.INDENT`          | 2     | YAML indentation   |
| `YAML_FORMATTING.LINE_WIDTH`      | 120   | Default line width |
| `YAML_FORMATTING.LINE_WIDTH_NONE` | 0     | Disable wrapping   |

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
