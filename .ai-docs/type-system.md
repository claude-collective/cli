# Type System

**Last Updated:** 2026-02-25

## Type Module Structure

All types are defined in `src/cli/types/` and re-exported through `src/cli/types/index.ts`.

| Module  | File                       | Purpose                                                |
| ------- | -------------------------- | ------------------------------------------------------ |
| Skills  | `src/cli/types/skills.ts`  | SkillId, SkillFrontmatter, SkillAssignment             |
| Agents  | `src/cli/types/agents.ts`  | AgentName, AgentConfig, CompiledAgentData              |
| Matrix  | `src/cli/types/matrix.ts`  | Domain, Subcategory, ResolvedSkill, MergedSkillsMatrix |
| Config  | `src/cli/types/config.ts`  | ProjectConfig, CompileConfig, ValidationResult         |
| Stacks  | `src/cli/types/stacks.ts`  | Stack, StackAgentConfig, StacksConfig                  |
| Plugins | `src/cli/types/plugins.ts` | PluginManifest, Marketplace, MarketplacePlugin         |

## Union Types (Single Source of Truth: `src/cli/types/`)

### SkillId (`src/cli/types/skills.ts:7`)

```typescript
type SkillIdPrefix = "web" | "api" | "cli" | "mobile" | "infra" | "meta" | "security";
type SkillId = `${SkillIdPrefix}-${string}-${string}`;
```

- Template literal type: always dashes, never `(@author)` suffix
- Minimum 3 segments enforced (prefix-subcategory-name)
- Examples: `"web-framework-react"`, `"meta-methodology-anti-over-engineering"`, `"api-database-drizzle"`

### AgentName (`src/cli/types/agents.ts:5-31`)

```typescript
type AgentName =
  | "web-developer"
  | "api-developer"
  | "cli-developer"
  | "web-architecture"
  | "agent-summoner"
  | "documentor"
  | "skill-summoner"
  | "cli-migrator"
  | "pattern-scout"
  | "web-pattern-critique"
  | "web-pm"
  | "api-researcher"
  | "web-researcher"
  | "api-reviewer"
  | "cli-reviewer"
  | "web-reviewer"
  | "cli-tester"
  | "web-tester";
```

18 members total.

### Domain (`src/cli/types/matrix.ts:5`)

```typescript
type Domain = "web" | "api" | "cli" | "mobile" | "shared";
```

### Subcategory (`src/cli/types/matrix.ts:8-46`)

38 values covering all skill categories across domains:

- web-\*: framework, styling, client-state, server-state, forms, testing, ui-components, mocking, error-handling, i18n, file-upload, files, utilities, realtime, animation, pwa, accessibility, performance, base-framework (19)
- api-\*: api, database, auth, observability, analytics, email, performance (7)
- mobile-\*: framework, platform (2)
- shared-\*: monorepo, tooling, security, methodology, research, reviewing, ci-cd (7)
- cli-\*: framework, prompts, testing (3)

### CategoryPath (`src/cli/types/skills.ts:124`)

```typescript
type CategoryPath = `${SkillIdPrefix}-${string}` | Subcategory | "local";
```

### SkillDisplayName (`src/cli/types/skills.ts:13-118`)

82 literal string values (e.g., `"react"`, `"zustand"`, `"vitest"`, `"drizzle"`).

### ModelName (`src/cli/types/matrix.ts:49`)

```typescript
type ModelName = "sonnet" | "opus" | "haiku" | "inherit";
```

### PermissionMode (`src/cli/types/matrix.ts:52-58`)

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

| Alias                       | Definition                                                         | File:Line       |
| --------------------------- | ------------------------------------------------------------------ | --------------- |
| `SubcategorySelections`     | `Partial<Record<Subcategory, SkillId[]>>`                          | `skills.ts:131` |
| `DomainSelections`          | `Partial<Record<Domain, Partial<Record<Subcategory, SkillId[]>>>>` | `matrix.ts:76`  |
| `CategoryMap`               | `Partial<Record<Subcategory, CategoryDefinition>>`                 | `matrix.ts:65`  |
| `ResolvedSubcategorySkills` | `Partial<Record<Subcategory, SkillId>>`                            | `skills.ts:138` |
| `StackAgentConfig`          | `Partial<Record<Subcategory, SkillAssignment[]>>`                  | `stacks.ts:6`   |
| `PluginSkillRef`            | `` `${SkillId}:${SkillId}` ``                                      | `skills.ts:10`  |

Note: There is no `SkillRef` type alias. The type at `skills.ts:163` is `SkillReference` (an object type, not an alias).

## Core Data Structures

### ResolvedSkill (`src/cli/types/matrix.ts:196-240`)

The primary skill representation after matrix merge. Contains:

- Identity: `id`, `displayName`, `description`, `category`, `path`
- Relationships: `conflictsWith`, `recommends`, `requires`, `alternatives`, `discourages`
- Metadata: `tags`, `author`, `compatibleWith`
- Setup: `requiresSetup`, `providesSetupFor`
- Sources: `availableSources`, `activeSource`
- Local: `local`, `localPath`
- Guidance: `usageGuidance`

### MergedSkillsMatrix (`src/cli/types/matrix.ts:175-190`)

The primary read model for the wizard and CLI commands:

- `version: string`
- `categories: CategoryMap` - Category definitions
- `skills: Partial<Record<SkillId, ResolvedSkill>>` - All resolved skills
- `suggestedStacks: ResolvedStack[]` - Pre-configured stacks
- `displayNameToId` / `displayNames` - Bidirectional alias maps
- `agentDefinedDomains` - Domain overrides from agent metadata
- `generatedAt: string` - ISO timestamp

### ProjectConfig (`src/cli/types/config.ts:37-108`)

Unified project configuration stored at `.claude-src/config.yaml`:

- `version?: "1"`
- `name`, `description`, `author`
- `agents: AgentName[]`
- `skills: SkillId[]`
- `installMode: "local" | "plugin"`
- `stack?: Record<string, StackAgentConfig>`
- `source`, `marketplace`, `agentsSource`
- `domains?: Domain[]`, `selectedAgents?: AgentName[]`
- `expertMode?: boolean`

### CompileConfig (`src/cli/types/config.ts:12-19`)

Compile configuration derived from stack:

- `name`, `description`
- `stack?: string`
- `agents: Record<string, CompileAgentConfig>`

### CompileContext (`src/cli/types/config.ts:22-27`)

Compilation context passed through pipeline:

- `stackId`, `verbose`, `projectRoot`, `outputDir`

### ValidationResult (`src/cli/types/config.ts:30-34`)

Generic validation result:

- `valid: boolean`, `errors: string[]`, `warnings: string[]`

### AgentConfig (`src/cli/types/agents.ts:78-82`)

Fully resolved agent for compilation:

- All `AgentDefinition` fields (title, description, model, tools, etc.)
- `name: string`
- `skills: Skill[]` - Unified skills list

### CompiledAgentData (`src/cli/types/agents.ts:112-129`)

Template context for Liquid rendering:

- `agent: AgentConfig`
- Section content: `intro`, `workflow`, `examples`, `criticalRequirementsTop`, `criticalReminders`, `outputFormat`
- `skills: Skill[]` - All skills
- Skill splits: `preloadedSkills`, `dynamicSkills`, `preloadedSkillIds`

### ExtractedSkillMetadata (`src/cli/types/matrix.ts:381-416`)

Skill metadata extracted from SKILL.md frontmatter + metadata.yaml before matrix merge:

- Identity: `id`, `directoryPath`, `description`, `category`, `path`
- Metadata: `author`, `tags`, `usageGuidance`
- Relationships (may contain display names at this stage): `compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor`
- Flags: `local`, `localPath`, `domain`, `custom`

### Wizard/UI Types in `matrix.ts`

| Type                  | Lines   | Purpose                                                            |
| --------------------- | ------- | ------------------------------------------------------------------ | --------- | -------- |
| `SkillOption`         | 331-351 | Skill as displayed in wizard (disabled/recommended/selected state) |
| `SelectionValidation` | 354-358 | Result of validating skill selections                              |
| `ValidationError`     | 361-365 | Blocking validation error                                          |
| `ValidationWarning`   | 368-372 | Non-blocking validation warning                                    |
| `SkillSource`         | 285-297 | Source from which a skill can be obtained                          |
| `SkillSourceType`     | 282     | `"public"                                                          | "private" | "local"` |
| `BoundSkill`          | 300-311 | Foreign skill bound to subcategory via search                      |
| `BoundSkillCandidate` | 314-325 | Search result candidate before binding                             |
| `ResolvedStack`       | 267-276 | Stack with resolved skill IDs                                      |

## Type Narrowing Rules

**From CLAUDE.md and memory:**

1. Use union types for finite sets (< 30 values)
2. Use template literal types for patterned IDs (`SkillId`)
3. Boundary casts only at data entry points (YAML parse, JSON parse, CLI args) with comments
4. Use `typedEntries()` / `typedKeys()` from `src/cli/utils/typed-object.ts` instead of raw `Object.entries()`/`Object.keys()`
5. Zod schemas at parse boundaries; post-safeParse `as T` casts are intentional (`.passthrough()` widens type)

## Zod Schemas

All schemas in `src/cli/lib/schemas.ts`. Key schemas:

| Schema                         | Validates                  | Pattern          |
| ------------------------------ | -------------------------- | ---------------- |
| `domainSchema`                 | Domain union               | `z.enum()`       |
| `subcategorySchema`            | Subcategory union          | `z.enum()`       |
| `skillIdSchema`                | SkillId format             | `z.string()`     |
| `categoryPathSchema`           | CategoryPath               | Custom + enum    |
| `skillFrontmatterLoaderSchema` | SKILL.md frontmatter       | `.passthrough()` |
| `skillMetadataLoaderSchema`    | metadata.yaml              | `.passthrough()` |
| `projectConfigLoaderSchema`    | .claude-src/config.yaml    | `.passthrough()` |
| `projectSourceConfigSchema`    | Source config              | `.passthrough()` |
| `skillsMatrixConfigSchema`     | skills-matrix.yaml         | `.passthrough()` |
| `stacksConfigSchema`           | stacks.yaml                | `.passthrough()` |
| `marketplaceSchema`            | marketplace.json           | `.passthrough()` |
| `pluginManifestSchema`         | plugin.json                | `.passthrough()` |
| `agentYamlConfigSchema`        | agent.yaml                 | `.passthrough()` |
| `boundSkillSchema`             | BoundSkill                 | `z.object()`     |
| `settingsFileSchema`           | settings.json              | `.passthrough()` |
| `metadataValidationSchema`     | Strict metadata validation | Strict schema    |

Schemas support runtime extension via `customExtensions` object for custom categories/domains/agents discovered from source matrices.
