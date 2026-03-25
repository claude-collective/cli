# Type System

**Last Updated:** 2026-03-14

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

### SkillId (`src/cli/types/generated/source-types.ts:96`)

```typescript
export const SKILL_MAP = {
  react: "web-framework-react",
  zustand: "web-state-zustand",
  // ... 86 entries total
} as const;

export type SkillSlug = keyof typeof SKILL_MAP;
export type SkillId = (typeof SKILL_MAP)[SkillSlug];
```

- Derived from `SKILL_MAP` constant (slug-to-ID mapping), not a template literal
- Runtime validation uses `skillIdSchema` in `schemas.ts` with `.refine()` against `SKILL_IDS` array
- 86 skill IDs, 86 skill slugs
- Re-exported from `src/cli/types/skills.ts:4`
- Examples: `"web-framework-react"`, `"meta-methodology-anti-over-engineering"`, `"api-database-drizzle"`

### SkillSlug (`src/cli/types/generated/source-types.ts:95`)

```typescript
type SkillSlug = keyof typeof SKILL_MAP;
```

- 86 members (one per skill): `"react"`, `"zustand"`, `"vitest"`, `"drizzle"`, etc.
- Used in relationship rules (conflicts, recommends, requires) instead of full SkillId
- Re-exported from `src/cli/types/skills.ts:4`

### AgentName (`src/cli/types/generated/source-types.ts:347`)

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

17 members total. Re-exported from `src/cli/types/agents.ts:5`.

### Domain (`src/cli/types/generated/source-types.ts:323`)

```typescript
export const DOMAINS = ["api", "cli", "mobile", "shared", "web"] as const;
export type Domain = (typeof DOMAINS)[number];
```

5 members. Re-exported from `src/cli/types/matrix.ts:4`.

### Category (`src/cli/types/generated/source-types.ts:317`)

34 values covering all skill categories across domains:

- api-\*: analytics, api, auth, database, email, observability, performance (7)
- cli-\*: framework (1)
- mobile-\*: framework (1)
- shared-\*: ci-cd, methodology, monorepo, research, reviewing, security, tooling (7)
- web-\*: accessibility, animation, client-state, error-handling, file-upload, files, forms, framework, i18n, mocking, performance, pwa, realtime, server-state, styling, testing, ui-components, utilities (18)

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
| `SkillAlias`             | `string`                                                                                           | `matrix.ts:252`     |

Note: There is no `SkillRef` type alias. The type at `skills.ts:56` is `SkillReference` (an object type, not an alias).

## Core Data Structures

### ResolvedSkill (`src/cli/types/matrix.ts:169-213`)

The primary skill representation after matrix merge. Contains:

- Identity: `id`, `slug`, `displayName`, `description`, `category`, `path`
- Guidance: `usageGuidance`
- Relationships: `conflictsWith`, `requires`, `alternatives`, `discourages`, `compatibleWith`
- Recommendation: `isRecommended`, `recommendedReason`
- Metadata: `tags`, `author`
- Local: `local`, `custom`, `localPath`
- Sources: `availableSources`, `activeSource`

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

### CompiledAgentData (`src/cli/types/agents.ts:89-106`)

Template context for Liquid rendering:

- `agent: AgentConfig`
- Section content: `intro`, `workflow`, `examples`, `criticalRequirementsTop`, `criticalReminders`, `outputFormat`
- `skills: Skill[]` - All skills
- Skill splits: `preloadedSkills`, `dynamicSkills`, `preloadedSkillIds`

### ExtractedSkillMetadata (`src/cli/types/matrix.ts:347-372`)

Skill metadata extracted from SKILL.md frontmatter + metadata.yaml before matrix merge:

- Identity: `id`, `directoryPath`, `description`, `category`, `path`, `slug`, `displayName`
- Metadata: `author`, `tags`, `usageGuidance`
- Flags: `local`, `localPath`, `domain`, `custom`

### Wizard/UI Types in `matrix.ts`

| Type                  | Lines   | Purpose                                                               |
| --------------------- | ------- | --------------------------------------------------------------------- |
| `SkillOption`         | 304-318 | Skill as displayed in wizard (discouraged/recommended/selected state) |
| `SelectionValidation` | 321-325 | Result of validating skill selections                                 |
| `ValidationError`     | 328-332 | Blocking validation error                                             |
| `ValidationWarning`   | 335-339 | Non-blocking validation warning                                       |
| `SkillSource`         | 258-270 | Source from which a skill can be obtained                             |
| `SkillSourceType`     | 255     | `"public" \| "private" \| "local"`                                    |
| `BoundSkill`          | 273-284 | Foreign skill bound to category via search                            |
| `BoundSkillCandidate` | 287-298 | Search result candidate before binding                                |
| `ResolvedStack`       | 240-249 | Stack with resolved skill IDs                                         |
| `SuggestedStack`      | 129-136 | Pre-configured stack from stacks.ts (before resolution)               |

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

All schemas in `src/cli/lib/schemas.ts`. Key schemas:

| Schema                             | Validates                  | Pattern                         |
| ---------------------------------- | -------------------------- | ------------------------------- |
| `domainSchema`                     | Domain union               | `z.enum(DOMAINS)` bridge        |
| `categorySchema`                   | Category union             | `z.enum(CATEGORIES)` bridge     |
| `agentNameSchema`                  | AgentName union            | `z.enum(AGENT_NAMES)` bridge    |
| `skillSlugSchema`                  | SkillSlug union            | `z.enum(SKILL_SLUGS)` bridge    |
| `skillIdSchema`                    | SkillId membership         | `.refine()` against `SKILL_IDS` |
| `categoryPathSchema`               | CategoryPath               | Custom refine + enum            |
| `skillFrontmatterLoaderSchema`     | SKILL.md frontmatter       | Lenient object                  |
| `skillMetadataLoaderSchema`        | metadata.yaml              | `.passthrough()` + superRefine  |
| `projectConfigLoaderSchema`        | .claude-src/config.ts      | `.passthrough()`                |
| `projectSourceConfigSchema`        | Source config              | `.passthrough()`                |
| `skillCategoriesFileSchema`        | skill-categories.ts        | `z.object()`                    |
| `skillRulesFileSchema`             | skill-rules.ts             | `z.object()`                    |
| `stacksConfigSchema`               | stacks.ts                  | `z.object()`                    |
| `marketplaceSchema`                | marketplace.json           | Bridge pattern                  |
| `pluginManifestSchema`             | plugin.json                | Bridge pattern                  |
| `agentYamlConfigSchema`            | agent metadata.yaml        | Bridge pattern                  |
| `boundSkillSchema`                 | BoundSkill                 | Bridge pattern                  |
| `settingsFileSchema`               | settings.yaml              | `.passthrough()`                |
| `importedSkillMetadataSchema`      | Imported skill metadata    | `.passthrough()`                |
| `localRawMetadataSchema`           | Local skill metadata.yaml  | `.passthrough()` + superRefine  |
| `localSkillMetadataSchema`         | Local skill forkedFrom     | `.passthrough()`                |
| `metadataValidationSchema`         | Strict metadata validation | `.strict()`                     |
| `customMetadataValidationSchema`   | Custom skill metadata      | `z.object()`                    |
| `agentYamlGenerationSchema`        | Compiled agent output      | `.strict()`                     |
| `agentFrontmatterValidationSchema` | AGENT.md frontmatter       | `.strict()`                     |
| `skillFrontmatterValidationSchema` | SKILL.md frontmatter       | `.strict()`                     |
| `pluginManifestValidationSchema`   | plugin.json strict         | `.strict()`                     |
| `stackConfigValidationSchema`      | Published stack config     | `.strict()`                     |

Schema bridge pattern: `z.enum(GENERATED_ARRAY) as z.ZodType<UnionType>` ensures Zod output matches TypeScript union types from generated source.

Utility functions: `formatZodErrors()`, `validateNestingDepth()`, `warnUnknownFields()`.
