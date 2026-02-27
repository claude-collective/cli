# D-40: `agentsinc register` Command for Local Skills

**Status:** Refined
**Priority:** Medium
**Related:** D-46 (custom extensibility), D-50 (eliminate skills-matrix.yaml), D-41 (config sub-agent)

## Implementation Overview

Create `src/cli/commands/register/skill.ts` — a flags-only command that takes a path to an existing skill directory (with `SKILL.md`) and generates `metadata.yaml` + wires the skill into `config.yaml`. Required flag: `--category`. Optional: `--name`, `--description`, `--author`, `--agents`, `--custom-category`, `--force`, `--skip-config`, `--dry-run`. Extract shared utilities (`toTitleCase`, `validateSkillName`) from `new/skill.ts` into `src/cli/utils/skill-helpers.ts`. Config wiring adds the skill to `config.skills` and `config.stack[agent][subcategory]` for selected agents. Validates generated metadata with `localRawMetadataSchema`. Custom categories use the existing `custom: true` mechanism — no schema changes needed. About 3 new files + 1 modified.

---

## Table of Contents

1. [Open Questions](#open-questions)
2. [Current State Analysis](#current-state-analysis)
3. [Command Design](#command-design)
4. [What the Command Does](#what-the-command-does)
5. [New Category Support](#new-category-support)
6. [Step-by-Step Implementation Plan](#step-by-step-implementation-plan)
7. [Edge Cases](#edge-cases)
8. [Test Plan](#test-plan)
9. [Files Changed/Created Summary](#files-changedcreated-summary)

---

## Open Questions

### 1. Should `register` support creating NEW categories?

**Recommendation: Yes, with `custom: true` in metadata.**

The `discoverAndExtendFromSource()` infrastructure (source-loader.ts:417-481) already handles custom categories at runtime. Skills with `custom: true` in metadata.yaml have relaxed validation -- `categoryPathSchema` accepts any kebab-case string when `custom: true` is set (schemas.ts:290-313, `validateCategoryField`). The `extendSchemasWithCustomValues()` function (schemas.ts:1091-1104) registers custom categories, domains, and skill IDs so subsequent Zod validation accepts them.

However, these custom categories only get schema-level acceptance. They do NOT get a `CategoryDefinition` entry in the matrix, which means they won't appear in the wizard's domain views (D-50 addresses this separately). For `register`, the pragmatic approach is:

- **Known subcategories (38 built-in):** Use as-is, no `custom: true` needed.
- **New custom categories:** Set `custom: true`, validate as kebab-case, warn the user that the skill won't appear in wizard domain views until D-50 is implemented (but will still work in `compile`, `validate`, and config).

### 2. How to handle agents wiring?

**Recommendation: Wire into ALL agents listed in the existing ProjectConfig, or prompt to select agents.**

When a ProjectConfig exists (`.claude-src/config.yaml`), it has an `agents` array and a `stack` record. The `register` command should:

1. Read existing config.
2. If agents exist, prompt: "Add this skill to which agents?" with the existing agents as options (default: all).
3. Add the skill's `SkillId` to the `skills` array.
4. Add the skill to `stack[agent][subcategory]` for each selected agent.
5. If no config exists, skip wiring (just generate metadata) and advise the user to run `agentsinc init` first or wire manually.

### 3. Interactive vs flags?

**Decision: Flags-only for v1.**

This follows the pattern of `new skill` and `import skill` which are non-interactive. All parameters are provided via flags. The category is validated against `SUBCATEGORY_VALUES` or accepted as custom with `--custom-category`. A `--dry-run` flag previews what would be generated without writing files.

Interactive prompts (category select, agent multiselect, etc.) can be added as a v2 enhancement if user feedback requests it.

### 4. Should register validate after wiring?

**Recommendation: Yes. Run validation on the generated metadata.yaml.**

After generating metadata, run `localRawMetadataSchema.safeParse()` (same validation `local-skill-loader.ts` uses) and report any issues. Do NOT run full `agentsinc validate` (too heavy), but do validate the single skill's metadata.

### 5. Should register also handle `new skill` use case?

**Recommendation: No. Keep commands separate.**

`new skill` scaffolds a fresh skill from scratch (creates SKILL.md + metadata.yaml). `register` takes an EXISTING SKILL.md and adds the metadata.yaml + config wiring. Different entry points, complementary use cases.

### 6. What about skills that already have metadata.yaml?

**Recommendation: Warn and offer to update/overwrite.**

If metadata.yaml exists, show what's there and offer to update specific fields (like category or agents wiring) vs. overwrite entirely. Similar to `new skill --force` behavior.

---

## Current State Analysis

### How local skills work today

**Discovery path:** `discoverLocalSkills()` in `local-skill-loader.ts`:

1. Looks in `.claude/skills/` (the `LOCAL_SKILLS_PATH` constant).
2. Lists all subdirectories.
3. For each directory, checks for both `metadata.yaml` AND `SKILL.md`.
4. If EITHER is missing, the skill is **skipped with a warning**.
5. Parses `metadata.yaml` with `localRawMetadataSchema.safeParse()`.
6. If the `displayName` field is missing, the skill is **skipped**.
7. Reads SKILL.md frontmatter via `parseFrontmatter()` -- the `name` field becomes the `skillId`.
8. Falls back to `LOCAL_DEFAULTS.CATEGORY` ("dummy-category") if no category in metadata.

**Required files for a local skill to be discovered:**

| File            | Required | Purpose                                                 |
| --------------- | -------- | ------------------------------------------------------- |
| `SKILL.md`      | Yes      | Skill content. Frontmatter `name` becomes the skill ID. |
| `metadata.yaml` | Yes      | Category, displayName, description, tags, etc.          |

**Required metadata.yaml fields** (for discovery to succeed):

| Field               | Required                                            | Validation                                                                                           | Example                                        |
| ------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `displayName`       | Yes (loader rejects without it)                     | Non-empty string                                                                                     | `"My Custom React"`                            |
| `cliDescription`    | No (falls back to SKILL.md frontmatter description) | String                                                                                               | `"Custom React patterns"`                      |
| `category`          | No (defaults to "dummy-category")                   | `CategoryPath` -- either a built-in subcategory, `"local"`, or custom kebab-case when `custom: true` | `"web-framework"`                              |
| `categoryExclusive` | No (defaults to `false`)                            | Boolean                                                                                              | `false`                                        |
| `usageGuidance`     | No                                                  | String, min 10 chars for strict validation                                                           | `"Use when building custom React components."` |
| `author`            | No (defaults to `"@dummy-author"`)                  | String, `@handle` format for strict validation                                                       | `"@vince"`                                     |
| `tags`              | No                                                  | String array                                                                                         | `["react", "custom"]`                          |
| `custom`            | No                                                  | Boolean                                                                                              | `true` (if using custom category)              |
| `contentHash`       | No                                                  | 7-char hex SHA                                                                                       | `"c48bfef"`                                    |
| `compatibleWith`    | No                                                  | SkillId array                                                                                        | `["web-framework-react"]`                      |
| `conflictsWith`     | No                                                  | SkillId array                                                                                        | `[]`                                           |
| `requires`          | No                                                  | SkillId array                                                                                        | `["web-framework-react"]`                      |

**SKILL.md frontmatter requirements** (for `parseFrontmatter()` to succeed):

| Field         | Required | Example                                |
| ------------- | -------- | -------------------------------------- |
| `name`        | Yes      | `my-custom-react-patterns`             |
| `description` | Yes      | `"Custom React patterns for our team"` |

### The gap `register` fills

Today, if a user creates `.claude/skills/my-patterns/SKILL.md` manually, they must:

1. Manually create `metadata.yaml` with exact field names, valid enum values, correct format.
2. Know the 38 valid subcategory values (or know to use `custom: true` + kebab-case).
3. Manually edit `.claude-src/config.yaml` to add the skill to the `skills` array.
4. Manually edit the `stack` mapping to wire the skill to agents/subcategories.
5. Run `agentsinc compile` and hope everything lines up.

`register` automates steps 1-4.

---

## Command Design

### Command signature

```
agentsinc register skill <path>
```

Where `<path>` is the path to a skill directory containing a `SKILL.md` (e.g., `.claude/skills/my-patterns` or an absolute path).

### Arguments

| Arg    | Required | Description                                     |
| ------ | -------- | ----------------------------------------------- |
| `path` | Yes      | Path to skill directory (must contain SKILL.md) |

### Flags

| Flag                | Short | Type    | Default                           | Description                                                   |
| ------------------- | ----- | ------- | --------------------------------- | ------------------------------------------------------------- |
| `--category`        | `-c`  | string  | (required)                        | Subcategory to assign (e.g., `web-framework`)                 |
| `--name`            | `-n`  | string  | (from frontmatter)                | Display name for the wizard (displayName field)               |
| `--description`     | `-d`  | string  | (from frontmatter)                | One-line description (cliDescription field)                   |
| `--author`          | `-a`  | string  | (from project config or `@local`) | Author handle                                                 |
| `--agents`          |       | string  | (all agents)                      | Comma-separated agent IDs to wire this skill to               |
| `--exclusive`       |       | boolean | false                             | Whether this category should be exclusive (radio vs checkbox) |
| `--custom-category` |       | boolean | false                             | Allow category values not in the built-in enum                |
| `--force`           | `-f`  | boolean | false                             | Overwrite existing metadata.yaml                              |
| `--skip-config`     |       | boolean | false                             | Only generate metadata, don't wire into config.yaml           |
| `--dry-run`         |       | boolean | false                             | Preview operations without writing files                      |
| `--source`          | `-s`  | string  |                                   | Skills source (inherited from BaseCommand)                    |

### Interactive prompts (future v2 enhancement)

> **Not included in v1.** All parameters are provided via flags for v1. The interactive flow below is documented for potential future enhancement if user feedback requests it.

1. **Category selection** -- `select` prompt listing all 38 built-in subcategories grouped by domain, plus "Create custom category..." option.
2. **Display name** -- `text` prompt, defaulting to title-cased frontmatter `name`.
3. **Description** -- `text` prompt, defaulting to frontmatter `description`.
4. **Agent selection** -- `multiselect` showing agents from existing config (if any). Skipped if no config exists.
5. **Confirmation** -- Show summary of what will be written/modified.

### Output

- Generated `metadata.yaml` path and content summary.
- Config changes (skills added, stack mappings added).
- Validation result.
- Next steps hint (`agentsinc compile` to include in agents).

### Exit codes

| Code | Constant                  | When                                             |
| ---- | ------------------------- | ------------------------------------------------ |
| 0    | `EXIT_CODES.SUCCESS`      | Registration successful                          |
| 1    | `EXIT_CODES.ERROR`        | General error (write failure, etc.)              |
| 2    | `EXIT_CODES.INVALID_ARGS` | Missing SKILL.md, invalid path, invalid category |
| 4    | `EXIT_CODES.CANCELLED`    | User cancelled interactive prompt                |

---

## What the Command Does

### Step-by-step flow

```
1. VALIDATE INPUT
   - Resolve path argument to absolute path
   - Check directory exists
   - Check SKILL.md exists in directory
   - Parse SKILL.md frontmatter (get name, description)
   - If metadata.yaml already exists and --force not set, error with hint

2. DETERMINE SKILL IDENTITY
   - skillId = frontmatter.name (e.g., "my-custom-patterns")
   - Validate skillId format (kebab-case)
   - Check if skillId conflicts with existing skills in matrix (warn if so)

3. GATHER METADATA (from flags with defaults)
   - category: --category flag (required, validated against SUBCATEGORY_VALUES or custom kebab-case with --custom-category)
   - displayName: --name flag OR toTitleCase(skillDirName)
   - cliDescription: --description flag OR frontmatter.description
   - author: --author flag OR resolveAuthor(projectDir) OR "@local"
   - exclusive: --exclusive flag OR false

4. GENERATE metadata.yaml
   - Build YAML content using generateMetadataYaml() pattern from new/skill.ts
   - If custom category: add `custom: true`
   - Compute contentHash via computeSkillFolderHash()
   - Write to <path>/metadata.yaml (with yaml-language-server schema comment)

5. VALIDATE GENERATED METADATA
   - Parse with localRawMetadataSchema.safeParse()
   - Report any validation errors
   - If invalid, still write but warn

6. WIRE INTO CONFIG (unless --skip-config)
   - Load existing ProjectConfig via loadProjectConfig()
   - If no config exists: skip wiring, advise user
   - If config exists:
     a. Add skillId to config.skills (if not already present)
     b. Determine subcategory from category
     c. Use --agents flag (defaults to all agents in config)
     d. For each selected agent: add to config.stack[agent][subcategory]
     e. Save config via writeConfigFile() pattern

7. OUTPUT SUMMARY
   - Show created/modified files
   - Show validation status
   - Hint: "Run 'agentsinc compile' to include this skill in your agents."
```

### Dry-run behavior

When `--dry-run` is set:

- Steps 1-3 execute normally (validation + metadata gathering).
- Steps 4-6 log what WOULD happen without writing.
- Show the metadata.yaml content that would be written.
- Show the config changes that would be made.

---

## New Category Support

### Built-in categories (38 values)

When the user picks a category from `SUBCATEGORY_VALUES`, no special handling is needed. The metadata.yaml uses the category value directly and all validation passes.

### Custom categories

When the user selects "Create custom category..." in the interactive flow or uses `--custom-category`:

1. Prompt for category name (kebab-case, e.g., `devops-terraform`).
2. Validate with `KEBAB_CASE_PATTERN`.
3. Set `custom: true` in metadata.yaml.
4. Optionally prompt for domain (web/api/cli/mobile/shared or a custom domain).
5. Warn: "Custom categories work for compilation and validation, but won't appear in wizard domain views until the category is added to skills-matrix.yaml."

**No changes to `SUBCATEGORY_VALUES`, `Subcategory` type, or JSON schemas needed** for custom categories. The existing `custom: true` + `extendSchemasWithCustomValues()` infrastructure handles this at runtime. The skill will be discovered by `discoverLocalSkills()` and accepted by `localRawMetadataSchema` (which uses `validateCategoryField` with relaxed rules for `custom: true`).

**Why not modify the enum:** Modifying `SUBCATEGORY_VALUES` and the `Subcategory` union type for every user's custom category is not viable -- these are compile-time constants in the CLI's source code. The `custom: true` mechanism was specifically designed for this (D-46). Modifying the enum should only happen when adding official built-in categories to the CLI.

### Future: D-50 integration

When D-50 (eliminate skills-matrix.yaml) is implemented, custom categories will be able to appear in wizard domain views because the matrix will be synthesized from skill metadata. Until then, custom categories work for compilation but are invisible in the wizard.

---

## Step-by-Step Implementation Plan

### Phase 1: Core command structure

**File: `src/cli/commands/register/skill.ts`** (new file)

Pattern: Follow `new/skill.ts` command structure (oclif BaseCommand, Args, Flags).

```
1. Create register topic directory: src/cli/commands/register/
2. Create skill.ts command extending BaseCommand
3. Define args: path (required)
4. Define flags: category, name, description, author, agents, exclusive,
   custom-category, force, skip-config, dry-run, source (from baseFlags)
5. Implement run() with the step-by-step flow above
```

### Phase 2: Metadata generation

**Extract shared utilities from `new/skill.ts`:**

`toTitleCase()` and `validateSkillName()` are currently defined in `commands/new/skill.ts` (lines 19-36) and are not exported for shared use. Since both `new skill` and `register skill` need them, per CLAUDE.md's "used by 2 files in same domain -> extract to shared module" rule, they must be extracted to a shared module before implementation:

1. Create `src/cli/utils/skill-helpers.ts` with `toTitleCase()` and `validateSkillName()`.
2. Update `commands/new/skill.ts` to import from `../../utils/skill-helpers.js`.
3. Import from the same shared module in `commands/register/skill.ts`.

**Reuse from `new/skill.ts` (after extraction):**

- `generateMetadataYaml()` -- adapted to accept more fields (may also be extracted or duplicated with register-specific variant)
- `toTitleCase()` -- for default display name (from `utils/skill-helpers.ts`)
- `validateSkillName()` -- for kebab-case validation (from `utils/skill-helpers.ts`)

**New helper: `buildMetadataContent()`**

A dedicated function that builds the metadata.yaml content string, supporting all fields the register command needs. Could go in a shared module or in the command file itself.

```typescript
type RegisterMetadataOptions = {
  category: CategoryPath;
  displayName: string;
  cliDescription: string;
  author: string;
  categoryExclusive: boolean;
  usageGuidance?: string;
  custom?: boolean;
  domain?: Domain;
  tags?: string[];
  contentHash: string;
};
```

### Phase 3: Config wiring

**Reuse from `configuration/` module:**

- `loadProjectConfig()` -- read existing config
- `compactStackForYaml()` -- for stack serialization

**New logic needed:**

A function to add a skill to an existing ProjectConfig:

```typescript
function addSkillToConfig(
  config: ProjectConfig,
  skillId: SkillId,
  subcategory: Subcategory,
  agentIds: AgentName[],
): ProjectConfig;
```

This function:

1. Adds `skillId` to `config.skills` (deduplicates).
2. For each agent in `agentIds`: ensures `config.stack[agent][subcategory]` exists and adds a `{ id: skillId, preloaded: false }` entry.
3. Returns the modified config.

**Saving:** Use the same `writeConfigFile()` pattern from `local-installer.ts` (YAML stringify with schema comment, compact stack).

### Phase 4: Flag validation and defaults

**v1 is flags-only** (no interactive prompts). This follows the pattern of `new skill` and `import skill` which are non-interactive.

- `--category` is required. Validate against `SUBCATEGORY_VALUES`, or accept custom kebab-case values when `--custom-category` is set.
- `--name` defaults to `toTitleCase(skillDirName)` if not provided.
- `--description` defaults to frontmatter `description` if not provided.
- `--author` defaults to `resolveAuthor(projectDir)` or `"@local"` if not provided.
- `--agents` defaults to all agents in existing config. If no config, skip wiring.

Interactive prompts may be added as a v2 enhancement if user feedback requests it.

### Phase 5: Validation

After generating metadata.yaml:

1. Parse the generated file with `localRawMetadataSchema.safeParse()`.
2. Also validate SKILL.md frontmatter with `parseFrontmatter()`.
3. Report errors/warnings.
4. Return appropriate exit code.

---

## Edge Cases

### 1. Skill already registered (metadata.yaml exists)

- **Without `--force`:** Error with message showing existing metadata and suggesting `--force`.
- **With `--force`:** Overwrite metadata.yaml, warn about overwrite.

### 2. Missing SKILL.md

- Error: "No SKILL.md found at `<path>`. Create a SKILL.md first or use `agentsinc new skill` to scaffold a new skill."
- Exit with `EXIT_CODES.INVALID_ARGS`.

### 3. Invalid SKILL.md frontmatter

- If frontmatter is missing or unparseable, error with clear message about required fields (`name`, `description`).
- Exit with `EXIT_CODES.INVALID_ARGS`.

### 4. Category conflicts

- If user picks a category where another skill exists and the category is exclusive (`categoryExclusive: true` in matrix), warn: "Category `web-framework` is exclusive -- only one skill can be active. Your skill will compete with existing skills in this category."
- Don't block -- just inform.

### 5. Name collisions

- If the `skillId` (from SKILL.md frontmatter `name`) already exists in the loaded matrix (i.e., a marketplace skill has the same ID), warn: "Skill ID `my-patterns` conflicts with an existing skill from the marketplace. Local skills take priority during compilation."
- Don't block (local skills override remote by design in `mergeLocalSkillsIntoMatrix()`).

### 6. Path outside `.claude/skills/`

- If the skill directory is NOT under `.claude/skills/`, warn: "This skill is at `<path>` which is outside `.claude/skills/`. The local skill loader only discovers skills in `.claude/skills/`. Consider moving the skill there or using `--skip-config` for metadata-only generation."
- Still generate metadata.yaml (useful for marketplace development).

### 7. No existing ProjectConfig

- Skip config wiring entirely.
- Log: "No project config found (.claude-src/config.yaml). Generated metadata.yaml only. Run `agentsinc init` to create a project config, then re-run `agentsinc register skill`."

### 8. Config has no agents

- If ProjectConfig exists but `agents` array is empty, skip agent wiring.
- Log: "No agents configured. Skill added to config.skills but not wired to any agent. Use `agentsinc edit` to select agents."

### 9. Skill directory name vs SKILL.md name mismatch

- The directory name and the `name` field in SKILL.md frontmatter might differ. This is valid (the `name` field is the canonical skillId). Log a note: "Skill ID from SKILL.md: `<name>`, directory: `<dirName>`."

### 10. SKILL.md name doesn't match SkillId pattern

- If the frontmatter `name` doesn't match `SKILL_ID_PATTERN` (`/^(web|api|cli|mobile|infra|meta|security)-.+-.+$/`), and `--custom-category` is not set, warn: "Skill ID `my-patterns` doesn't follow the standard prefix pattern (web-_, api-_, etc.). This is fine for local skills but may cause validation warnings. Use `--custom-category` to suppress this warning."
- With `--custom-category`, this is expected and no warning is needed.

---

## Test Plan

### Unit tests

**File: `src/cli/commands/register/__tests__/skill.test.ts`**

| Test                                        | Description                                    |
| ------------------------------------------- | ---------------------------------------------- |
| Validates path argument is required         | Missing path errors with INVALID_ARGS          |
| Rejects missing SKILL.md                    | Directory without SKILL.md errors              |
| Rejects invalid SKILL.md frontmatter        | Missing `name` or `description` in frontmatter |
| Generates valid metadata.yaml               | Given valid inputs, produces correct YAML      |
| Respects --category flag                    | Category from flag used in metadata            |
| Respects --name flag                        | displayName from flag used in metadata         |
| Respects --author flag                      | Author from flag used in metadata              |
| Defaults author from project config         | Uses `resolveAuthor()` when no flag            |
| Respects --force flag                       | Overwrites existing metadata.yaml              |
| Errors without --force when metadata exists | Existing metadata.yaml without --force errors  |
| Dry-run mode                                | No files written, summary shown                |
| Validates generated metadata                | `localRawMetadataSchema` passes on output      |
| Custom category with --custom-category      | Sets `custom: true` in metadata                |
| Custom category validates kebab-case        | Non-kebab-case custom category rejected        |
| Computes content hash                       | contentHash field present and valid            |

**File: `src/cli/lib/configuration/__tests__/register-config.test.ts`** (if config wiring is extracted)

| Test                             | Description                          |
| -------------------------------- | ------------------------------------ |
| Adds skill to config.skills      | SkillId added, no duplicates         |
| Adds skill to stack mapping      | stack[agent][subcategory] updated    |
| Handles missing stack            | Creates stack property if absent     |
| Handles missing agent entry      | Creates agent entry in stack         |
| Deduplicates skills              | Adding existing skill is idempotent  |
| Preserves existing config fields | Other config fields untouched        |
| Skips wiring when no config      | No error, metadata-only mode         |
| Skips wiring with --skip-config  | Metadata generated, config untouched |

### Integration tests

| Test                             | Description                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| Full register flow               | Create skill dir, write SKILL.md, run register, verify metadata.yaml and config.yaml |
| Register + compile               | Register skill, then compile, verify skill appears in agent output                   |
| Register outside .claude/skills/ | Warns about path, still generates metadata                                           |

### Manual testing

1. Create `.claude/skills/test-register/SKILL.md` with frontmatter.
2. Run `agentsinc register skill .claude/skills/test-register --category web-framework --name "Test Skill"`.
3. Verify `metadata.yaml` created with correct content.
4. Verify `.claude-src/config.yaml` updated (if exists).
5. Run `agentsinc compile` and verify skill is included.
6. Test `--dry-run` mode.
7. Test `--force` overwrite.
8. Test `--custom-category` with a novel category name.

---

## Files Changed/Created Summary

### New files

| File                                                | Purpose                                                                                |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/cli/commands/register/skill.ts`                | Main command implementation                                                            |
| `src/cli/commands/register/__tests__/skill.test.ts` | Command tests                                                                          |
| `src/cli/utils/skill-helpers.ts`                    | Shared utilities extracted from `new/skill.ts`: `toTitleCase()`, `validateSkillName()` |

### Modified files

| File                            | Change                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/cli/commands/new/skill.ts` | Update imports: use `toTitleCase()` and `validateSkillName()` from `../../utils/skill-helpers.js` instead of local definitions |

**Additionally, if extracting config wiring helper:**

| File                                            | Change                                    |
| ----------------------------------------------- | ----------------------------------------- |
| `src/cli/lib/configuration/config-generator.ts` | Add `addSkillToExistingConfig()` function |
| `src/cli/lib/configuration/index.ts`            | Export new function                       |

### Dependencies

No new dependencies required. Uses existing:

- `yaml` (parse/stringify)
- `@oclif/core` (Command, Args, Flags)
- Existing utilities: `fs.ts` (writeFile, fileExists, etc.), `versioning.ts` (computeSkillFolderHash), `schemas.ts` (localRawMetadataSchema), `metadata-keys.ts` (LOCAL_DEFAULTS), `loading/loader.ts` (parseFrontmatter)

### Reused utilities

| Utility                    | From                                                              | Purpose                              |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| `toTitleCase()`            | `utils/skill-helpers.ts` (extracted from `commands/new/skill.ts`) | Default displayName                  |
| `validateSkillName()`      | `utils/skill-helpers.ts` (extracted from `commands/new/skill.ts`) | Validate skill name format           |
| `computeSkillFolderHash()` | `lib/versioning.ts`                                               | contentHash field                    |
| `parseFrontmatter()`       | `lib/loading/loader.ts`                                           | Read SKILL.md frontmatter            |
| `localRawMetadataSchema`   | `lib/schemas.ts`                                                  | Validate generated metadata          |
| `loadProjectConfig()`      | `lib/configuration/project-config.ts`                             | Read existing config                 |
| `resolveAuthor()`          | `lib/configuration/index.ts`                                      | Default author                       |
| `compactStackForYaml()`    | `lib/configuration/config-generator.ts`                           | Config serialization                 |
| `SUBCATEGORY_VALUES`       | `lib/schemas.ts`                                                  | Category enum values                 |
| `STANDARD_FILES`           | `consts.ts`                                                       | File name constants                  |
| `LOCAL_SKILLS_PATH`        | `consts.ts`                                                       | Default skill location               |
| `EXIT_CODES`               | `lib/exit-codes.ts`                                               | Exit code constants                  |
| `KEBAB_CASE_PATTERN`       | `consts.ts`                                                       | Category name validation             |
| `YAML_FORMATTING`          | `consts.ts`                                                       | YAML output formatting               |
| `SCHEMA_PATHS`             | `consts.ts`                                                       | yaml-language-server schema comments |

### NOT changing (scope control)

- `src/cli/lib/schemas.ts` -- No changes to `SUBCATEGORY_VALUES` or any schema. Custom categories are handled by the existing `custom: true` mechanism.
- `src/cli/types/matrix.ts` -- No changes to `Subcategory` union type.
- `scripts/generate-json-schemas.ts` -- No need to regenerate schemas.
- `src/cli/lib/loading/source-loader.ts` -- No changes needed. `discoverAndExtendFromSource()` already handles custom values at runtime.
