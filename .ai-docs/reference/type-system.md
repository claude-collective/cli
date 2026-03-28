# Type System

**Last Updated:** 2026-03-28

## Type Module Structure

All types are defined in `src/cli/types/` and re-exported through `src/cli/types/index.ts`.

| Module    | File                                      | Purpose                                                                     |
| --------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| Generated | `src/cli/types/generated/source-types.ts` | Generated union types: SkillId, SkillSlug, Category, Domain, AgentName      |
| Generated | `src/cli/types/generated/matrix.ts`       | Generated built-in matrix data (BUILT_IN_MATRIX constant)                   |
| Skills    | `src/cli/types/skills.ts`                 | SkillId (re-export), SkillFrontmatter, SkillAssignment, CategoryPath        |
| Agents    | `src/cli/types/agents.ts`                 | AgentName (re-export), AgentConfig, CompiledAgentData                       |
| Matrix    | `src/cli/types/matrix.ts`                 | Domain (re-export), Category (re-export), ResolvedSkill, MergedSkillsMatrix |
| Config    | `src/cli/types/config.ts`                 | ProjectConfig, CompileConfig, ValidationResult                              |
| Stacks    | `src/cli/types/stacks.ts`                 | Stack, StackAgentConfig, StacksConfig                                       |
| Plugins   | `src/cli/types/plugins.ts`                | PluginManifest, Marketplace, MarketplacePlugin                              |

## Union Types (Single Source of Truth: `src/cli/types/generated/source-types.ts`)

Union types for Domain, Category, AgentName, SkillId, and SkillSlug are **auto-generated** from the skills source and agent metadata. Run `bun run generate:types` to regenerate.

### SkillId (`src/cli/types/generated/source-types.ts:165`)

```typescript
export const SKILL_MAP = {
  react: "web-framework-react",
  zustand: "web-state-zustand",
  // ... 155 entries total
} as const;

export type SkillSlug = keyof typeof SKILL_MAP;
export type SkillId = (typeof SKILL_MAP)[SkillSlug];
```

- Derived from `SKILL_MAP` constant (slug-to-ID mapping), not a template literal
- Runtime validation uses `skillIdSchema` in `schemas.ts` with `.refine()` against `SKILL_IDS` array
- 155 skill IDs, 155 skill slugs
- Re-exported from `src/cli/types/skills.ts:4`
- Examples: `"web-framework-react"`, `"meta-methodology-research-methodology"`, `"api-database-drizzle"`, `"ai-provider-anthropic-sdk"`

### SkillSlug (`src/cli/types/generated/source-types.ts:164`)

```typescript
type SkillSlug = keyof typeof SKILL_MAP;
```

- 155 members (one per skill): `"react"`, `"zustand"`, `"vitest"`, `"drizzle"`, `"anthropic-sdk"`, etc.
- Used in relationship rules (conflicts, recommends, requires) instead of full SkillId
- Re-exported from `src/cli/types/skills.ts:4`

### AgentName (`src/cli/types/generated/source-types.ts:571`)

```typescript
export const AGENT_NAMES = [
  "agent-summoner",
  "api-developer",
  "api-researcher",
  "api-reviewer",
  "cli-developer",
  "cli-reviewer",
  "cli-tester",
  "codex-keeper",
  "convention-keeper",
  "pattern-scout",
  "skill-summoner",
  "web-architecture",
  "web-developer",
  "web-pattern-critique",
  "web-pm",
  "web-researcher",
  "web-reviewer",
  "web-tester",
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];
```

18 members total. Re-exported from `src/cli/types/agents.ts:5`.

### Domain (`src/cli/types/generated/source-types.ts:546`)

```typescript
export const DOMAINS = ["ai", "api", "cli", "infra", "meta", "mobile", "shared", "web"] as const;
export type Domain = (typeof DOMAINS)[number];
```

8 members. Re-exported from `src/cli/types/matrix.ts:4`.

### Category (`src/cli/types/generated/source-types.ts:540`)

50 values covering all skill categories across domains:

- ai-\*: infrastructure, observability, orchestration, patterns, provider (5)
- api-\*: analytics, api, auth, baas, cms, commerce, database, email, framework, observability, performance, search, vector-db (13)
- cli-\*: framework (1)
- infra-\*: ci-cd, config, platform (3)
- meta-\*: design, methodology, reviewing (3)
- mobile-\*: framework (1)
- shared-\*: monorepo, security, tooling (3)
- web-\*: accessibility, animation, client-state, error-handling, file-upload, files, forms, framework, i18n, meta-framework, mocking, performance, pwa, realtime, routing, server-state, styling, testing, tooling, ui-components, utilities (21)

Re-exported from `src/cli/types/matrix.ts:4`.

### CategoryPath (`src/cli/types/skills.ts:14`)

```typescript
type CategoryPath = Category | "local";
```

### ModelName (`src/cli/types/matrix.ts:11`)

```typescript
type ModelName = "sonnet" | "opus" | "haiku" | "inherit";
```

### PermissionMode (`src/cli/types/matrix.ts:14-20`)

```typescript
type PermissionMode =
  | "default"
  | "acceptEdits"
  | "dontAsk"
  | "bypassPermissions"
  | "plan"
  | "delegate";
```

## Named Aliases (Composite Types)

| Alias                    | Definition                                                                                         | File:Line           |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ------------------- |
| `CategorySelections`     | `Partial<Record<Category, SkillId[]>>`                                                             | `skills.ts:21`      |
| `ResolvedCategorySkills` | `Partial<Record<Category, SkillId>>`                                                               | `skills.ts:28`      |
| `DomainSelections`       | `Partial<Record<Domain, Partial<Record<Category, SkillId[]>>>>`                                    | `matrix.ts:41`      |
| `CategoryMap`            | `Partial<Record<Category, CategoryDefinition>>`                                                    | `matrix.ts:27`      |
| `CategoryDomainMap`      | `Partial<Record<Category, { domain?: Domain }>>`                                                   | `matrix.ts:30`      |
| `SkillSlugMap`           | `{ slugToId: Partial<Record<SkillSlug, SkillId>>; idToSlug: Partial<Record<SkillId, SkillSlug>> }` | `matrix.ts:139-144` |
| `StackAgentConfig`       | `Partial<Record<Category, SkillAssignment[]>>`                                                     | `stacks.ts:6`       |
| `PluginSkillRef`         | `` `${SkillId}:${SkillId}` ``                                                                      | `skills.ts:8`       |
| `SkillDefinitionMap`     | `Partial<Record<SkillId, SkillDefinition>>`                                                        | `skills.ts:38`      |
| `SkillAlias`             | `string`                                                                                           | `matrix.ts:251`     |

Note: There is no `SkillRef` type alias. The type at `skills.ts:56` is `SkillReference` (an object type, not an alias).

## Core Data Structures

### ResolvedSkill (`src/cli/types/matrix.ts:169-212`)

The primary skill representation after matrix merge. Contains:

- Identity: `id`, `slug`, `displayName`, `description`, `category`, `path`
- Guidance: `usageGuidance`
- Relationships: `conflictsWith`, `requires`, `alternatives`, `discourages`, `compatibleWith`
- Recommendation: `isRecommended`, `recommendedReason`
- Local: `local`, `custom`, `localPath`
- Sources: `availableSources`, `activeSource`
- Author: `author`

### MergedSkillsMatrix (`src/cli/types/matrix.ts:150-163`)

The primary read model for the wizard and CLI commands:

- `version: string`
- `categories: CategoryMap` - Category definitions
- `skills: Partial<Record<SkillId, ResolvedSkill>>` - All resolved skills
- `suggestedStacks: ResolvedStack[]` - Pre-configured stacks
- `slugMap: SkillSlugMap` - Bidirectional slug-to-ID mapping
- `agentDefinedDomains` - Domain overrides from agent metadata
- `generatedAt: string` - ISO timestamp

### ProjectConfig (`src/cli/types/config.ts:66-146`)

Unified project configuration stored at `.claude-src/config.ts`:

- `version?: "1"`
- `name`, `description`, `author`
- `agents: AgentScopeConfig[]` - Per-agent scope config (`{ name, scope }`)
- `skills: SkillConfig[]` - Per-skill scope+source config (`{ id, scope, source }`)
- `stack?: Record<string, StackAgentConfig>`
- `source`, `marketplace`, `agentsSource`
- `domains?: Domain[]`, `selectedAgents?: AgentName[]`
- `sources?: SourceEntry[]` - Additional skill sources
- `boundSkills?: BoundSkill[]` - Skills bound via search
- `branding?: BrandingConfig` - White-label overrides
- Directory overrides: `skillsDir`, `agentsDir`, `stacksFile`, `categoriesFile`, `rulesFile`

### CompileConfig (`src/cli/types/config.ts:41-48`)

Compile configuration derived from stack:

- `name`, `description`
- `stack?: string`
- `agents: Record<string, CompileAgentConfig>`

### CompileContext (`src/cli/types/config.ts:51-56`)

Compilation context passed through pipeline:

- `stackId`, `verbose`, `projectRoot`, `outputDir`

### ValidationResult (`src/cli/types/config.ts:59-63`)

Generic validation result:

- `valid: boolean`, `errors: string[]`, `warnings: string[]`

### AgentConfig (`src/cli/types/agents.ts:55-59`)

Fully resolved agent for compilation:

- All `AgentDefinition` fields (title, description, model, tools, etc.)
- `name: string`
- `skills: Skill[]` - Unified skills list

### CompiledAgentData (`src/cli/types/agents.ts:89-105`)

Template context for Liquid rendering:

- `agent: AgentConfig`
- Section content: `identity`, `playbook`, `output`, `criticalRequirementsTop`, `criticalReminders`
- `skills: Skill[]` - All skills
- Skill splits: `preloadedSkills`, `dynamicSkills`, `preloadedSkillIds`

### ExtractedSkillMetadata (`src/cli/types/matrix.ts:353-377`)

Skill metadata extracted from SKILL.md frontmatter + metadata.yaml before matrix merge:

- Identity: `id`, `directoryPath`, `description`, `category`, `path`, `slug`, `displayName`
- Metadata: `author`, `usageGuidance`
- Flags: `local`, `localPath`, `domain`, `custom`

### Wizard/UI Types in `matrix.ts`

| Type                  | Lines   | Purpose                                                                                    |
| --------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `OptionState`         | 302-306 | Discriminated union for skill advisory state (normal/recommended/discouraged/incompatible) |
| `SkillOption`         | 312-324 | Skill as displayed in wizard (advisoryState/selected/unmetRequirements state)              |
| `SelectionValidation` | 327-331 | Result of validating skill selections                                                      |
| `ValidationError`     | 334-338 | Blocking validation error                                                                  |
| `ValidationWarning`   | 341-345 | Non-blocking validation warning                                                            |
| `SkillSource`         | 257-271 | Source from which a skill can be obtained                                                  |
| `SkillSourceType`     | 254     | `"public" \| "private" \| "local"`                                                         |
| `BoundSkill`          | 274-285 | Foreign skill bound to category via search                                                 |
| `BoundSkillCandidate` | 288-299 | Search result candidate before binding                                                     |
| `ResolvedStack`       | 239-248 | Stack with resolved skill IDs                                                              |
| `SuggestedStack`      | 129-136 | Pre-configured stack from stacks.ts (before resolution)                                    |

## Operations Layer Types (`src/cli/lib/operations/types.ts`)

The operations layer defines focused result types for each operation, re-exported from `src/cli/lib/operations/types.ts`:

### Source Operations

| Type                | File                                         | Purpose                                     |
| ------------------- | -------------------------------------------- | ------------------------------------------- |
| `LoadSourceOptions` | `operations/source/load-source.ts:9`         | Options for loading a skills source         |
| `LoadedSource`      | `operations/source/load-source.ts:17`        | Result of loading a source (matrix + paths) |
| `MarketplaceResult` | `operations/source/ensure-marketplace.ts:10` | Result of marketplace registration          |

### Skill Operations

| Type                      | File                                                | Purpose                                         |
| ------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| `DiscoveredSkills`        | `operations/skills/discover-skills.ts:12`           | Result of skill discovery (local + marketplace) |
| `ScopedSkillDir`          | `operations/skills/collect-scoped-skill-dirs.ts:6`  | Single scoped skill directory entry             |
| `ScopedSkillDirsResult`   | `operations/skills/collect-scoped-skill-dirs.ts:12` | Collected scoped dirs with counts               |
| `SkillCopyResult`         | `operations/skills/copy-local-skills.ts:7`          | Result of copying local skills                  |
| `SkillComparisonResults`  | `operations/skills/compare-skills.ts:7`             | Comparison results (added/removed/changed)      |
| `SkillMatchResult`        | `operations/skills/find-skill-match.ts:3`           | Result of matching a skill to a source          |
| `ResolveSkillInfoOptions` | `operations/skills/resolve-skill-info.ts:23`        | Options for resolving skill info                |
| `ResolvedSkillInfo`       | `operations/skills/resolve-skill-info.ts:12`        | Resolved skill info with metadata               |
| `SkillInfoResult`         | `operations/skills/resolve-skill-info.ts:18`        | Result wrapping resolved skill info             |
| `PluginInstallResult`     | `operations/skills/install-plugin-skills.ts:6`      | Result of plugin skill installation             |
| `PluginUninstallResult`   | `operations/skills/uninstall-plugin-skills.ts:6`    | Result of plugin skill uninstallation           |

### Project Operations

| Type                   | File                                                | Purpose                                    |
| ---------------------- | --------------------------------------------------- | ------------------------------------------ |
| `DetectedProject`      | `operations/project/detect-project.ts:5`            | Detected project installation state        |
| `BothInstallations`    | `operations/project/detect-both-installations.ts:9` | Combined project + global installation     |
| `ConfigWriteOptions`   | `operations/project/write-project-config.ts:16`     | Options for writing project config         |
| `ConfigWriteResult`    | `operations/project/write-project-config.ts:25`     | Result of config write operation           |
| `CompileAgentsOptions` | `operations/project/compile-agents.ts:7`            | Options for agent compilation              |
| `CompilationResult`    | `operations/project/compile-agents.ts:20`           | Result of agent compilation                |
| `AgentDefs`            | `operations/project/load-agent-defs.ts:6`           | Loaded agent definitions with source paths |

## Type Narrowing Rules

**From CLAUDE.md and memory:**

1. Union types are generated from source (`bun run generate:types`) for finite sets
2. Skill ID validation uses `skillIdSchema` with `.refine()` against the generated `SKILL_IDS` array
3. Boundary casts only at data entry points (YAML parse, JSON parse, CLI args) with comments
4. Use `typedEntries()` / `typedKeys()` from `src/cli/utils/typed-object.ts` instead of raw `Object.entries()`/`Object.keys()`
5. Zod schemas at parse boundaries; post-safeParse `as T` casts are intentional (`.passthrough()` widens type)
6. Use type guards (`isCategory()`, `isDomain()`, `isAgentName()`, `isCategoryPath()`) from `src/cli/utils/type-guards.ts` for runtime narrowing

## Type Guards (`src/cli/utils/type-guards.ts`)

| Function           | Signature                                  | Purpose                                       |
| ------------------ | ------------------------------------------ | --------------------------------------------- |
| `isCategory()`     | `(value: string) => value is Category`     | Validates against generated CATEGORIES array  |
| `isDomain()`       | `(value: string) => value is Domain`       | Validates against generated DOMAINS array     |
| `isAgentName()`    | `(value: string) => value is AgentName`    | Validates against generated AGENT_NAMES array |
| `isCategoryPath()` | `(value: string) => value is CategoryPath` | Validates: `"local"` or valid Category        |

All guards import from `src/cli/types/generated/source-types.ts` and check against the generated const arrays.

## Typed Object Helpers (`src/cli/utils/typed-object.ts`)

| Function         | Signature                                                       | Purpose                                         |
| ---------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| `typedEntries()` | `<K extends string, V>(obj: Partial<Record<K, V>>) => [K, V][]` | Type-safe `Object.entries` preserving key types |
| `typedKeys()`    | `<K extends string>(obj: Partial<Record<K, unknown>>) => K[]`   | Type-safe `Object.keys` preserving key types    |

## Zod Schemas

All schemas in `src/cli/lib/schemas.ts`. 39 exported schemas total.

### Bridge Schemas (union type validation)

| Schema                  | Validates             | Pattern                          |
| ----------------------- | --------------------- | -------------------------------- |
| `domainSchema`          | Domain union          | `z.enum(DOMAINS)` bridge         |
| `categorySchema`        | Category union        | `z.enum(CATEGORIES)` bridge      |
| `agentNameSchema`       | AgentName union       | `z.enum(AGENT_NAMES)` bridge     |
| `skillSlugSchema`       | SkillSlug union       | `z.enum(SKILL_SLUGS)` bridge     |
| `skillIdSchema`         | SkillId membership    | `.refine()` against `SKILL_IDS`  |
| `categoryPathSchema`    | CategoryPath          | Custom refine + enum             |
| `modelNameSchema`       | ModelName union       | `z.enum(["sonnet", ...])` bridge |
| `permissionModeSchema`  | PermissionMode union  | `z.enum([...])` bridge           |
| `skillSourceTypeSchema` | SkillSourceType union | `z.enum(["public", ...])` bridge |

### Loader Schemas (lenient, `.passthrough()`)

| Schema                         | Validates                 | Pattern                        |
| ------------------------------ | ------------------------- | ------------------------------ |
| `skillFrontmatterLoaderSchema` | SKILL.md frontmatter      | Lenient object                 |
| `skillMetadataLoaderSchema`    | metadata.yaml             | `.passthrough()` + superRefine |
| `projectConfigLoaderSchema`    | .claude-src/config.ts     | `.passthrough()`               |
| `projectSourceConfigSchema`    | Source config             | `.passthrough()`               |
| `localRawMetadataSchema`       | Local skill metadata.yaml | `.passthrough()` + superRefine |
| `localSkillMetadataSchema`     | Local skill forkedFrom    | `.passthrough()`               |
| `settingsFileSchema`           | settings.yaml             | `.passthrough()`               |
| `importedSkillMetadataSchema`  | Imported skill metadata   | `.passthrough()`               |

### Structural Schemas (data shapes)

| Schema                      | Validates                 | Pattern               |
| --------------------------- | ------------------------- | --------------------- |
| `skillCategoriesFileSchema` | skill-categories.ts       | `z.object()`          |
| `skillRulesFileSchema`      | skill-rules.ts            | `z.object()`          |
| `stacksConfigSchema`        | stacks.ts                 | `z.object()`          |
| `marketplaceSchema`         | marketplace.json          | Bridge pattern        |
| `pluginManifestSchema`      | plugin.json               | Bridge pattern        |
| `agentYamlConfigSchema`     | agent metadata.yaml       | Bridge pattern        |
| `boundSkillSchema`          | BoundSkill                | Bridge pattern        |
| `skillAssignmentSchema`     | SkillAssignment           | Bridge pattern        |
| `stackAgentConfigSchema`    | Stack agent config record | `z.record()` + union  |
| `pluginAuthorSchema`        | PluginAuthor              | Bridge pattern        |
| `compatibilityGroupSchema`  | CompatibilityGroup        | Bridge pattern        |
| `agentHookActionSchema`     | AgentHookAction           | Bridge pattern        |
| `agentHookDefinitionSchema` | AgentHookDefinition       | Bridge pattern        |
| `hooksRecordSchema`         | Hooks record (lenient)    | `z.record()` + array  |
| `strictHooksRecordSchema`   | Hooks record (strict)     | `z.record()` + min(1) |

### Strict Validation Schemas (`.strict()`, reject unknown fields)

| Schema                             | Validates              | Pattern      |
| ---------------------------------- | ---------------------- | ------------ |
| `metadataValidationSchema`         | Strict metadata        | `.strict()`  |
| `customMetadataValidationSchema`   | Custom skill metadata  | `z.object()` |
| `agentYamlGenerationSchema`        | Compiled agent output  | `.strict()`  |
| `agentFrontmatterValidationSchema` | AGENT.md frontmatter   | `.strict()`  |
| `skillFrontmatterValidationSchema` | SKILL.md frontmatter   | `.strict()`  |
| `pluginManifestValidationSchema`   | plugin.json strict     | `.strict()`  |
| `stackConfigValidationSchema`      | Published stack config | `.strict()`  |

Schema bridge pattern: `z.enum(GENERATED_ARRAY) as z.ZodType<UnionType>` ensures Zod output matches TypeScript union types from generated source.

Utility functions: `formatZodErrors()`, `validateNestingDepth()`, `warnUnknownFields()`.
