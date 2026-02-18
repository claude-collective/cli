# Architecture

> Source of truth for the Agents Inc. CLI codebase. Consult this document before
> contributing code, adding tests, or performing refactors.

---

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [Project Structure](#project-structure)
3. [Data Flow](#data-flow)
4. [Domain-Driven Library Organization](#domain-driven-library-organization)
5. [Type System](#type-system)
6. [Runtime Validation (Zod)](#runtime-validation-zod)
7. [CLI Commands](#cli-commands)
8. [Wizard & UI Components](#wizard--ui-components)
9. [Test Infrastructure](#test-infrastructure)
10. [Utility Patterns](#utility-patterns)
11. [Configuration & Resolution](#configuration--resolution)
12. [Agent Compilation](#agent-compilation)
13. [Third-Party Dependencies](#third-party-dependencies)
14. [Conventions & Philosophy](#conventions--philosophy)

---

## High-Level Overview

Agents Inc. CLI (`cc`) is a TypeScript CLI tool that manages AI agent configurations
for Claude. It loads skill definitions from a marketplace, lets users select technology
stacks via an interactive wizard, compiles agents with selected skills via Liquid templates,
and installs them as Claude plugins or local files.

**Key characteristics:**

- **oclif** command framework with **Ink** (React) terminal UI
- **TypeScript strict mode** with zero-`any` policy
- **Zod** runtime validation at all parse boundaries
- **Remeda** for functional, immutable data transformations
- **Zustand** for wizard state management
- **Domain-driven** library organization with barrel exports
- **Three-tier test strategy**: unit, integration, command tests

---

## Project Structure

```
/
+-- bin/                          # Executable scripts (dev.js, run.js)
+-- config/                       # Data configuration files
|   +-- skills-matrix.yaml        #   All skill definitions, categories, relationships (~35KB)
|   +-- stacks.yaml               #   Pre-built stack definitions
+-- dist/                         # Build output (tsup)
+-- docs/                         # Documentation (you are here)
+-- src/
|   +-- agents/                   # Agent source partials (YAML + markdown)
|   |   +-- developer/            #   web-developer, api-developer, cli-developer, web-architecture
|   |   +-- meta/                 #   agent-summoner, documentor, skill-summoner
|   |   +-- migration/            #   cli-migrator
|   |   +-- pattern/              #   pattern-scout, web-pattern-critique
|   |   +-- planning/             #   web-pm
|   |   +-- researcher/           #   api-researcher, web-researcher
|   |   +-- reviewer/             #   api-reviewer, cli-reviewer, web-reviewer
|   |   +-- tester/               #   cli-tester, web-tester
|   +-- cli/                      # CLI application source
|   |   +-- commands/             #   oclif commands (29 total)
|   |   +-- components/           #   Ink React UI components
|   |   |   +-- common/           #     Confirm, Message, Spinner
|   |   |   +-- skill-search/     #     Interactive skill search
|   |   |   +-- themes/           #     Terminal color themes
|   |   |   +-- wizard/           #     Multi-step wizard (8+ components)
|   |   +-- defaults/             #   Default data (agent-mappings.yaml)
|   |   +-- hooks/                #   oclif lifecycle hooks (init.ts)
|   |   +-- lib/                  #   Core business logic (domain-driven)
|   |   |   +-- __tests__/        #     Integration, command, and user-journey tests
|   |   |   +-- agents/           #     Agent fetching, recompilation
|   |   |   +-- configuration/    #     Config loading, merging, saving, generation
|   |   |   +-- installation/     #     Installation detection, local installer
|   |   |   +-- loading/          #     Skills/agents/matrix/defaults loading
|   |   |   +-- matrix/           #     Matrix loading, resolution, health checks
|   |   |   +-- plugins/          #     Plugin finding, manifest, validation, versioning
|   |   |   +-- skills/           #     Skill fetching, copying, metadata, compilation
|   |   |   +-- stacks/           #     Stack loading, installation, compilation
|   |   |   +-- compiler.ts       #     Liquid template compilation (cross-cutting)
|   |   |   +-- resolver.ts       #     CLAUDE.md resolution (cross-cutting)
|   |   |   +-- schemas.ts        #     All Zod schemas (cross-cutting, ~30KB)
|   |   |   +-- schema-validator.ts   # Bulk YAML/JSON validation runner
|   |   |   +-- exit-codes.ts     #     Named exit code constants
|   |   |   +-- versioning.ts     #     Version management utilities
|   |   |   +-- validator.ts      #     Agent file structure validation
|   |   |   +-- output-validator.ts   # Compiled agent output validation
|   |   |   +-- marketplace-generator.ts  # Marketplace metadata generation
|   |   |   +-- permission-checker.tsx    # Installation permission checks
|   |   +-- stores/               #   Zustand state (wizard-store.ts)
|   |   +-- types/                #   TypeScript type definitions
|   |   |   +-- index.ts          #     Barrel: re-exports all type modules
|   |   |   +-- skills.ts         #     SkillId, SkillDefinition, ExtractedSkillMetadata
|   |   |   +-- agents.ts         #     AgentName, AgentConfig, CompiledAgentData
|   |   |   +-- config.ts         #     ProjectConfig, CompileConfig, ValidationResult
|   |   |   +-- matrix.ts         #     Domain, Subcategory, CategoryDefinition, MergedSkillsMatrix
|   |   |   +-- stacks.ts         #     Stack, StackAgentConfig, StacksConfig
|   |   |   +-- plugins.ts        #     PluginManifest, Marketplace, MarketplacePlugin
|   |   +-- utils/                #   Shared utilities
|   |   |   +-- fs.ts             #     File system wrapper (fs-extra + fast-glob)
|   |   |   +-- exec.ts           #     Process execution, Claude CLI integration
|   |   |   +-- logger.ts         #     Verbose logging control
|   |   |   +-- frontmatter.ts    #     YAML frontmatter extraction
|   |   |   +-- typed-object.ts   #     Type-safe Object.entries/keys helpers
|   |   |   +-- __mocks__/        #     Vitest auto-mocks (fs.ts, logger.ts)
|   |   +-- base-command.ts       #   BaseCommand class (shared flags, error handling)
|   |   +-- consts.ts             #   CLI constants (paths, preselected skills)
|   |   +-- index.ts              #   Entry point (oclif run)
|   +-- schemas/                  # JSON Schema files (generated from Zod)
|       +-- agent.schema.json
|       +-- agent-frontmatter.schema.json
|       +-- hooks.schema.json
|       +-- marketplace.schema.json
|       +-- metadata.schema.json
|       +-- plugin.schema.json
|       +-- skill-frontmatter.schema.json
|       +-- skills-matrix.schema.json
|       +-- stack.schema.json
|       +-- stacks.schema.json
+-- package.json                  # @agents-inc/cli, ESM, oclif config
+-- tsconfig.json                 # ES2022, strict, bundler resolution
+-- vitest.config.ts              # 3 test projects: unit, integration, commands
```

---

## Data Flow

### Core Pipeline

```
Source Resolution -> Skill Loading -> Matrix Merging -> Multi-Source Annotation -> Wizard Selection -> Config Generation -> Compilation -> Installation
```

### Detailed Flow

```
1. CONFIG RESOLUTION
   --source flag > CC_SOURCE env > .claude-src/config.yaml > .claude/config.yaml > default

2. SKILL LOADING
   config/skills-matrix.yaml ──> parseYaml()
                                     |
                              skillsMatrixConfigSchema.safeParse()
                                     |
                              SkillsMatrixConfig (categories, relationships, aliases)
                                     |
   Source skills (SKILL.md) ──> parseFrontmatter() + skillMetadataConfigSchema
                                     |
                              ExtractedSkillMetadata[]
                                     |
                              mergeMatrixWithSkills()
                                     |
                              MergedSkillsMatrix (resolved skills, stacks, display names)

3. MULTI-SOURCE ANNOTATION
   MergedSkillsMatrix ──> loadSkillsFromAllSources()
                              |
                       5-phase tagging pipeline (public -> local -> plugin -> extras -> active)
                              |
                       Each skill gets: availableSources[], activeSource

4. WIZARD SELECTION
   MergedSkillsMatrix ──> Wizard component (Ink/React)
                              |
                       Zustand store tracks: approach, domains, categories, skills,
                                             sourceSelections, boundSkills
                              |
                       WizardResultV2: selected skills, stack, install mode, sourceSelections

5. CONFIG GENERATION
   WizardResultV2 ──> generateProjectConfig()
                         |
                   ProjectConfig (name, agents, stack mappings)

6. COMPILATION
   ProjectConfig + Agent partials + Skills ──> Liquid templates
                                                   |
                                            Compiled agent .md files
                                                   |
                                            Plugin manifest (plugin.json)

7. INSTALLATION
   Plugin mode: .claude/plugins/agents-inc/
   Local mode:  .claude/agents/ + .claude/skills/
   Source switching: archiveLocalSkill() / restoreArchivedSkill() for local skills
```

### Skill Metadata Flow

```
SKILL.md (frontmatter)                metadata.yaml
        |                                    |
skillFrontmatterLoaderSchema          skillMetadataConfigSchema
   (lenient, any name)                   (strict skill IDs)
        |                                    |
SkillFrontmatter                      SkillMetadataConfig
        |___________________  _______________|
                            \/
                  ExtractedSkillMetadata (normalized IDs)
                            |
                  Matrix Resolution
                            |
                  ResolvedSkill (full relationships, display names)
```

### Multi-Source System

Skills can come from multiple sources: the public marketplace, private repositories, local
files, or installed plugins. The multi-source system tracks where each skill is available
and lets users choose which source to use per skill.

**Why multi-source exists:** Teams often maintain private skill forks with company-specific
conventions (e.g., internal API patterns, proprietary tooling). Multi-source lets users mix
public skills with private alternatives without forking the entire marketplace.

#### Source Types

```typescript
type SkillSourceType = "public" | "private" | "local";

type SkillSource = {
  name: string; // "public", marketplace name, "local"
  type: SkillSourceType;
  url?: string; // For remote sources (e.g., "github:acme-corp/claude-skills")
  version?: string; // Skill content version from metadata.yaml
  installed: boolean; // Whether this source's version is currently on disk
  installMode?: "plugin" | "local"; // How it was installed (separate from provenance)
};
```

Each `ResolvedSkill` carries:

- `availableSources: SkillSource[]` -- all known sources providing this skill
- `activeSource: SkillSource` -- the currently installed or preferred source

#### Multi-Source Loading Pipeline

`loadSkillsFromAllSources()` in `src/cli/lib/loading/multi-source-loader.ts` runs a
five-phase tagging pipeline that mutates `MergedSkillsMatrix.skills` in place:

```
Phase 1: PUBLIC       Tag all skills with a "public" source entry
              |
Phase 2: LOCAL        Tag skills with `local: true` as installed via local source
              |
Phase 3: PLUGIN       Detect plugin-installed skills in .claude/plugins/
              |
Phase 4: EXTRA        Fetch each configured extra source, tag matching skills as "private"
              |
Phase 5: ACTIVE       Set activeSource = installed variant, or first available
```

The pipeline is fault-tolerant: errors from individual extra sources are warned and skipped,
never thrown. Network requests use cached data when available (`forceRefresh: false`).

#### Source Configuration

Extra sources are configured in project config and managed via `source-manager.ts`:

```yaml
# .claude-src/config.yaml
sources:
  - name: acme-corp
    url: "github:acme-corp/claude-skills"
  - name: internal
    url: "github:my-org/private-skills"
```

`source-manager.ts` provides CRUD operations:

- `addSource(projectDir, url)` -- validates by fetching marketplace, persists to config
- `removeSource(projectDir, name)` -- removes by name (cannot remove "public")
- `getSourceSummary(projectDir)` -- lists all sources with local/plugin skill counts

#### Source Selection Flow

The wizard's Sources step (`step-sources.tsx`) lets users choose between:

1. **Recommended** -- use the default/installed sources (skip customization)
2. **Customize** -- per-skill source selection via `SourceGrid`

The `SourceGrid` component renders each selected technology as a row with source variant
pills. Users navigate with arrow keys and select with Space. Source choices are stored as
`sourceSelections: Partial<Record<SkillId, string>>` in the Zustand wizard store, mapping
each skill ID to a source name.

```
WizardResultV2.sourceSelections
       |
       v
skill-copier.ts: copySkillsToPluginFromSource(skills, sourceDir, ..., sourceSelections)
       |
       v
For each skill: check sourceSelections[skillId]
  - "local" -> preserve local skill on disk
  - remote source name -> copy from that source's fetched directory
  - undefined -> use activeSource or public default
```

#### Source Switching (Archive/Restore)

When a user switches a local skill to a remote source, `source-switcher.ts` preserves
the local version:

```
archiveLocalSkill(projectDir, skillId)
  .claude/skills/{skillId}/  -->  .claude/skills/_archived/{skillId}/

restoreArchivedSkill(projectDir, skillId)
  .claude/skills/_archived/{skillId}/  -->  .claude/skills/{skillId}/
```

Both operations validate skill IDs against `SKILL_ID_PATTERN` and enforce path boundary
checks to prevent traversal attacks. The archive directory (`_archived/`) is a sibling
of active skill directories.

#### Bound Skill Search

The `SourceGrid` includes a search pill per skill row. When activated, it opens
`SearchModal` which searches configured extra sources for matching skills:

```
User presses Space on search pill for "react"
       |
       v
searchExtraSources("react", configuredSources)
  -- fetches each extra source repository
  -- matches by last directory segment (case-insensitive)
       |
       v
BoundSkillCandidate[] displayed in SearchModal
       |
       v
User selects a candidate -> bindSkill() in wizard store
       |
       v
BoundSkill { id, sourceUrl, sourceName, boundTo: "react" }
  -- appears as an additional source option in the SourceGrid row
  -- persisted in WizardResultV2 for downstream compilation
```

`BoundSkill` represents a foreign skill explicitly bound to a subcategory via search.
`BoundSkillCandidate` is the search result before binding. Both types live in
`src/cli/types/matrix.ts`.

#### Settings Overlay

The `G` hotkey on the Sources step opens `StepSettings`, an overlay for managing
configured sources:

- View all configured marketplaces with local/plugin skill counts
- `A` to add a new source URL (validated via `fetchMarketplace()`)
- `DEL` to remove a source (except "public")
- `ESC` to close and return to the Sources step

---

## Domain-Driven Library Organization

`src/cli/lib/` is organized into **8 domain subdirectories**, each with a barrel `index.ts`.
Cross-cutting modules remain at the lib root.

### Domain: `agents/`

Agent definition loading and recompilation.

| File                  | Key Exports                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `agent-fetcher.ts`    | `getAgentDefinitions()`, `getLocalAgentDefinitions()`, `fetchAgentDefinitionsFromRemote()` |
| `agent-recompiler.ts` | `recompileAgents()`, `RecompileAgentsResult`                                               |

### Domain: `configuration/`

Config loading, generation, merging, and persistence.

| File                  | Key Exports                                                                         |
| --------------------- | ----------------------------------------------------------------------------------- |
| `config.ts`           | `DEFAULT_SOURCE`, `resolveSource()`, `resolveAllSources()`, `resolveAgentsSource()` |
| `config-generator.ts` | `generateProjectSourceConfig()`, `buildStackProperty()`                             |
| `config-merger.ts`    | `mergeConfigWithExisting()`                                                         |
| `config-saver.ts`     | `saveProjectConfig()`, `saveSourceToProjectConfig()`                                |
| `project-config.ts`   | `loadProjectConfig()`, `loadProjectSourceConfig()`                                  |
| `source-manager.ts`   | `addSource()`, `removeSource()`, `getSourceSummary()` — CRUD for configured sources |

### Domain: `installation/`

Installation mode detection and local installation.

| File                 | Key Exports                                                                       |
| -------------------- | --------------------------------------------------------------------------------- |
| `installation.ts`    | `detectInstallation()`, `getInstallationOrThrow()`, `InstallMode`, `Installation` |
| `local-installer.ts` | `installLocal()`, `LocalInstallOptions`, `LocalInstallResult`                     |

### Domain: `loading/`

Data loading from sources (skills, agents, matrix, defaults).

| File                     | Key Exports                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `loader.ts`              | `parseFrontmatter()`, `loadAllAgents()`, `loadProjectAgents()`, `loadSkillsByIds()` |
| `source-loader.ts`       | `loadSkillsMatrixFromSource()`                                                      |
| `multi-source-loader.ts` | `loadSkillsFromAllSources()` — tags skills with provenance from all sources         |
| `source-fetcher.ts`      | `fetchFromSource()`, `fetchMarketplace()`, `sanitizeSourceForCache()`               |
| `defaults-loader.ts`     | `loadDefaultMappings()`, `getCachedDefaults()`                                      |

### Domain: `matrix/`

Skills matrix operations and validation.

| File                     | Key Exports                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `matrix-loader.ts`       | `loadSkillsMatrix()`, `extractAllSkills()`, `mergeMatrixWithSkills()`, `loadAndMergeSkillsMatrix()`                        |
| `matrix-resolver.ts`     | `resolveAlias()`, `getDependentSkills()`, `isDisabled()`, `isRecommended()`, `validateSelection()`, `getAvailableSkills()` |
| `matrix-health-check.ts` | `checkMatrixHealth()`                                                                                                      |

### Domain: `plugins/`

Plugin discovery, validation, manifest management, and versioning.

| File                        | Key Exports                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `plugin-finder.ts`          | `getUserPluginsDir()`, `getProjectPluginsDir()`, `getPluginSkillsDir()`, `readPluginManifest()`, `getPluginSkillIds()` |
| `plugin-manifest.ts`        | `generateSkillPluginManifest()`, `generateStackPluginManifest()`, `writePluginManifest()`                              |
| `plugin-manifest-finder.ts` | `findPluginManifest()`                                                                                                 |
| `plugin-info.ts`            | `getPluginInfo()`, `formatPluginDisplay()`                                                                             |
| `plugin-validator.ts`       | `validatePlugin()`, `validateAllPlugins()`, `validatePluginStructure()`                                                |
| `plugin-version.ts`         | `bumpPluginVersion()`, `getPluginVersion()`                                                                            |

### Domain: `skills/`

Skill fetching, copying, metadata, compilation, and agent mappings.

| File                       | Key Exports                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `skill-fetcher.ts`         | `fetchSkills()`                                                                          |
| `skill-copier.ts`          | `copySkill()`, `copySkillFromSource()`, `copySkillsToPluginFromSource()`                 |
| `skill-metadata.ts`        | `readForkedFromMetadata()`, `getLocalSkillsWithMetadata()`, `injectForkedFromMetadata()` |
| `skill-agent-mappings.ts`  | `SKILL_TO_AGENTS`, `getAgentsForSkill()`                                                 |
| `skill-plugin-compiler.ts` | `compileSkillPlugin()`, `compileAllSkillPlugins()`                                       |
| `local-skill-loader.ts`    | `discoverLocalSkills()`                                                                  |
| `source-switcher.ts`       | `archiveLocalSkill()`, `restoreArchivedSkill()`, `hasArchivedSkill()`                    |

### Domain: `stacks/`

Stack loading, resolution, installation, and compilation.

| File                       | Key Exports                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `stacks-loader.ts`         | `loadStacks()`, `loadStackById()`, `resolveAgentConfigToSkills()`, `resolveStackSkills()` |
| `stack-installer.ts`       | `compileStackToTemp()`, `installStackAsPlugin()`                                          |
| `stack-plugin-compiler.ts` | `compileAgentForPlugin()`, `compileStackPlugin()`                                         |

### Cross-Cutting Modules (lib root)

| File                       | Purpose                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `compiler.ts`              | Liquid template compilation for agents                                             |
| `resolver.ts`              | CLAUDE.md resolution from stacks                                                   |
| `schemas.ts`               | All Zod runtime validation schemas (60+)                                           |
| `schema-validator.ts`      | Bulk YAML/JSON validation runner                                                   |
| `exit-codes.ts`            | Named exit codes: `SUCCESS`, `ERROR`, `INVALID_ARGS`, `NETWORK_ERROR`, `CANCELLED` |
| `versioning.ts`            | Content hashing, version metadata                                                  |
| `validator.ts`             | Agent file structure validation                                                    |
| `output-validator.ts`      | Compiled agent output validation                                                   |
| `marketplace-generator.ts` | Marketplace JSON generation                                                        |
| `permission-checker.tsx`   | Installation permission checks                                                     |

---

## Type System

Types live in `src/cli/types/` with a barrel `index.ts`. All types are exported as
`export type` (type-only exports).

### Foundation: Union Types

All foundational union types are defined in the type files as the **single source of truth**.

```typescript
// src/cli/types/skills.ts
type SkillIdPrefix = "web" | "api" | "cli" | "mobile" | "infra" | "meta" | "security";
type SkillId = `${SkillIdPrefix}-${string}-${string}`;  // e.g., "web-framework-react" (3+ segments)
type SkillDisplayName = "react" | "vue" | ...;       // 137 values - human-readable labels
type CategoryPath = `${SkillIdPrefix}/${string}` | `${SkillIdPrefix}-${string}` | Subcategory | "local";

// src/cli/types/matrix.ts
type Domain = "web" | "api" | "cli" | "mobile" | "shared";
type Subcategory = "framework" | "styling" | ...;  // 36 values
type ModelName = "sonnet" | "opus" | "haiku" | "inherit";
type SkillSourceType = "public" | "private" | "local";  // skill provenance (install mode is separate)

// src/cli/types/agents.ts
type AgentName = "web-developer" | "api-developer" | "cli-developer" | ...;  // 18 values
```

### Named Aliases

Complex nested types have named aliases for readability:

```typescript
type SubcategorySelections = Partial<Record<Subcategory, SkillId[]>>;
type ResolvedSubcategorySkills = Partial<Record<Subcategory, SkillId>>;
type CategoryMap = Partial<Record<Subcategory, CategoryDefinition>>;
type DomainSelections = Partial<Record<Domain, Partial<Record<Subcategory, SkillId[]>>>>;
```

### Type-Safe Object Helpers

`src/cli/utils/typed-object.ts` provides type-preserving wrappers:

```typescript
typedEntries<K, V>(obj); // replaces Object.entries(obj) as [K, V][]
typedKeys<K>(obj); // replaces Object.keys(obj) as K[]
```

Use these **instead of** boundary casts on `Object.entries/keys`.

### Key Interfaces

| Type                  | File         | Purpose                                                 |
| --------------------- | ------------ | ------------------------------------------------------- |
| `ResolvedSkill`       | `matrix.ts`  | Fully merged skill with all relationships               |
| `MergedSkillsMatrix`  | `matrix.ts`  | Complete matrix with skills, stacks, display name maps  |
| `CategoryDefinition`  | `matrix.ts`  | Category metadata (domain, exclusive, required, order)  |
| `AgentConfig`         | `agents.ts`  | Agent definition merged with compile config             |
| `CompiledAgentData`   | `agents.ts`  | Fully compiled agent with content sections              |
| `ProjectConfig`       | `config.ts`  | User's project configuration                            |
| `Stack`               | `stacks.ts`  | Stack with agent-subcategory-skill mappings             |
| `PluginManifest`      | `plugins.ts` | Plugin metadata for .claude-plugin/plugin.json          |
| `SkillSource`         | `matrix.ts`  | Source provenance (name, type, url, version, installed) |
| `BoundSkill`          | `matrix.ts`  | Foreign skill bound to a subcategory via search         |
| `BoundSkillCandidate` | `matrix.ts`  | Search result candidate before binding                  |

### Type Convention Rules

1. **IDs use dashes**, never slashes: `web-framework-react`, not `web/framework/react`
2. **No `(@author)` suffixes** in IDs - that's old filesystem format
3. **Casts allowed ONLY at data entry boundaries** (YAML/JSON parsing)
4. **No casts in consumer code** - if it doesn't type-check, fix the interface
5. **Test strings are type-checked** - use valid SkillId patterns like `"web-test-a"`
6. **Template literals validate at compile time** - `SkillId` rejects malformed strings

---

## Runtime Validation (Zod)

All JSON/YAML parse boundaries use **Zod v4** schemas defined in `src/cli/lib/schemas.ts`.

### Bridge Pattern

Schemas are typed against existing TypeScript interfaces:

```typescript
export const skillIdSchema = z.string().regex(/^(web|api|cli|mobile|infra|meta|security)-.+-.+$/)
  as z.ZodType<SkillId>;
```

This ensures runtime validation matches compile-time types without duplicating definitions.

### Lenient vs Strict Schemas

| Strategy    | Modifier         | Use Case                                                                                          |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| **Lenient** | `.passthrough()` | Loading/parsing boundaries - allows unknown fields for forward compatibility                      |
| **Strict**  | `.strict()`      | Validation boundaries - rejects unknown fields, matches JSON Schema `additionalProperties: false` |

```typescript
// LENIENT: Loading a config file (may have new fields from newer versions)
export const projectConfigLoaderSchema = z
  .object({
    name: z.string().optional(),
    agents: z.array(z.string()).optional(),
  })
  .passthrough();

// STRICT: Validating a plugin manifest (must match expected shape exactly)
export const agentFrontmatterValidationSchema = z
  .object({
    name: z.string(),
    description: z.string(),
  })
  .strict();
```

### Post-Parse Boundary Casts

After `safeParse()`, casting the result is intentional and correct:

```typescript
const result = projectConfigLoaderSchema.safeParse(parsed);
if (!result.success) return null;
return result.data as ProjectConfig; // OK: Zod validated; cast narrows from passthrough type
```

### Schema Categories (60+ schemas)

1. **Union type schemas**: `domainSchema`, `subcategorySchema`, `agentNameSchema`, `modelNameSchema`
2. **Template literal schemas**: `skillIdSchema`, `categoryPathSchema`
3. **Hook schemas**: `agentHookActionSchema`, `agentHookDefinitionSchema`
4. **Skill schemas**: `skillFrontmatterSchema` (strict), `skillFrontmatterLoaderSchema` (lenient)
5. **Plugin schemas**: `pluginManifestSchema`
6. **Config schemas**: `projectConfigSchema` (strict), `projectConfigLoaderSchema` (lenient)
7. **Matrix schemas**: `categoryDefinitionSchema`, relationship rule schemas
8. **Stack schemas**: `stackSchema`, `stacksConfigSchema`
9. **Marketplace schemas**: `marketplaceSchema`
10. **Validation schemas**: `*ValidationSchema` variants (all strict)

---

## CLI Commands

### Framework

- **oclif** command framework with pattern-based auto-discovery
- All commands extend `BaseCommand` (`src/cli/base-command.ts`)
- `BaseCommand` provides: `--dry-run`, `--source` flags + `handleError()`, `logSuccess()`, `logWarning()`
- **Init hook** (`src/cli/hooks/init.ts`) runs before each command to resolve source config
- **Exit codes**: Named constants from `exit-codes.ts` (SUCCESS=0, ERROR=1, INVALID_ARGS=2, NETWORK_ERROR=3, CANCELLED=130)

### Command Inventory (29 commands)

| Command                | File                      | Type                    | Complexity |
| ---------------------- | ------------------------- | ----------------------- | ---------- |
| `init`                 | `init.tsx`                | Interactive wizard      | High       |
| `edit`                 | `edit.tsx`                | Interactive wizard      | High       |
| `compile`              | `compile.ts`              | Logic-heavy             | High       |
| `search`               | `search.tsx`              | Interactive + static    | High       |
| `update`               | `update.tsx`              | Interactive confirm     | High       |
| `uninstall`            | `uninstall.tsx`           | Interactive confirm     | High       |
| `doctor`               | `doctor.ts`               | Health checks           | High       |
| `info`                 | `info.ts`                 | Display                 | Medium     |
| `diff`                 | `diff.ts`                 | Comparison              | Medium     |
| `eject`                | `eject.ts`                | File operations         | Medium     |
| `outdated`             | `outdated.ts`             | Comparison              | Medium     |
| `validate`             | `validate.ts`             | Validation              | Medium     |
| `list`                 | `list.ts`                 | Display (alias: `ls`)   | Thin       |
| `new skill`            | `new/skill.ts`            | File generation         | Medium     |
| `new agent`            | `new/agent.tsx`           | Interactive + spawn     | High       |
| `import skill`         | `import/skill.ts`         | Network + files         | High       |
| `build plugins`        | `build/plugins.ts`        | Compilation             | Medium     |
| `build stack`          | `build/stack.tsx`         | Interactive select      | Medium     |
| `build marketplace`    | `build/marketplace.ts`    | Generation              | Medium     |
| `config`               | `config/index.ts`         | Alias to `config show`  | Thin       |
| `config show`          | `config/show.ts`          | Display                 | Thin       |
| `config get`           | `config/get.ts`           | Display                 | Thin       |
| `config path`          | `config/path.ts`          | Display                 | Thin       |
| `config set-project`   | `config/set-project.ts`   | File write              | Thin       |
| `config unset-project` | `config/unset-project.ts` | File write              | Thin       |
| `version`              | `version/index.ts`        | Alias to `version show` | Thin       |
| `version show`         | `version/show.ts`         | Display                 | Thin       |
| `version bump`         | `version/bump.ts`         | File write              | Thin       |
| `version set`          | `version/set.ts`          | File write + validation | Thin       |

### Command Execution Flow

```
User: cc <command> [args] [flags]
  |
  v
oclif loads dist/commands/<command>.js
  |
  v
Init hook runs: resolve source config from flags/env/project
  |
  v
Command.run(): parse args/flags, execute logic
  |
  v
Return or throw with exit code
```

---

## Wizard & UI Components

### Component Hierarchy

```
Wizard (src/cli/components/wizard/wizard.tsx)
+-- StepApproach     choose: stack template or build from scratch
+-- StepStack        select pre-built stack OR choose domains (scratch)
+-- StepBuild        technology selection per domain via CategoryGrid
|   +-- CategoryGrid    2D grid: rows=categories, cols=skills (✓ installed indicator)
+-- StepSources      choose skill sources (recommended vs per-skill customize)
|   +-- SourceGrid      per-skill source variant grid (arrow keys, space to select)
|   |   +-- SearchModal    bound skill search results (up/down, enter to bind)
|   +-- StepSettings    source management overlay (G hotkey, add/remove sources)
+-- StepConfirm      review and install
```

### State Management: Zustand

`src/cli/stores/wizard-store.ts` manages all wizard state:

```typescript
type WizardState = {
  step: WizardStep; // "approach" | "stack" | "build" | "sources" | "confirm"
  approach: "stack" | "scratch" | null;
  selectedStackId: string | null;
  selectedDomains: Domain[];
  domainSelections: DomainSelections;
  focusedRow: number;
  focusedCol: number;
  showDescriptions: boolean;
  expertMode: boolean;
  installMode: "plugin" | "local";
  sourceSelections: Partial<Record<SkillId, string>>; // per-skill source choices
  customizeSources: boolean;
  showSettings: boolean;
  enabledSources: Record<string, boolean>;
  boundSkills: BoundSkill[]; // foreign skills bound via search
  history: WizardStep[]; // enables back navigation
  // ... actions (setSourceSelection, bindSkill, buildSourceRows, etc.)
};
```

### Keyboard Navigation

- Arrow keys + vim keys (h/j/k/l) for grid navigation
- Enter to select/continue
- Escape to go back (history-based)
- Tab to cycle domains
- `d` to toggle descriptions
- `a` to accept defaults (stack flow)
- `e` to toggle expert mode
- `g` to open source settings (Sources step only)
- `p` to toggle install mode

---

## Test Infrastructure

### Configuration (`vitest.config.ts`)

Three test projects with separate patterns:

| Project         | Pattern                                                     | Purpose               |
| --------------- | ----------------------------------------------------------- | --------------------- |
| **unit**        | `src/**/*.test.ts(x)` excluding **tests**/ subdirs          | Co-located unit tests |
| **integration** | `src/cli/lib/__tests__/integration/**` + `user-journeys/**` | Multi-module flows    |
| **commands**    | `src/cli/lib/__tests__/commands/**`                         | CLI command execution |

**Settings:** globals enabled, mocks auto-cleared, 10s timeout, console intercept disabled
(required for oclif/ink test libraries).

### Statistics

- **83 test files**, **1,598 tests** (34 skipped), all passing
- **Execution time:** ~19 seconds

### Mock Infrastructure

**Auto-mocks** in `src/cli/utils/__mocks__/`:

- `fs.ts` - All file operations as `vi.fn()`
- `logger.ts` - `verbose()`, `warn()`, `setVerbose()` as `vi.fn()`

**Pattern:** Declare `vi.mock()` before module imports:

```typescript
vi.mock("../../utils/fs");
vi.mock("../../utils/logger");

import { someFunction } from "./module";
import { readFile } from "../../utils/fs";

// Configure per test:
vi.mocked(readFile).mockResolvedValue("content");
```

### Test Helpers (`src/cli/lib/__tests__/`)

| File                                          | Purpose                                                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `helpers.ts` (~1,120 lines)                   | `runCliCommand()`, `createMockSkill()`, `createMockMatrix()`, `createComprehensiveMatrix()`, `createBasicMatrix()`, `writeTestSkill()`, `writeTestAgent()`, temp dir management |
| `test-fixtures.ts` (~106 lines)               | Pre-built skill factories: `createTestReactSkill()`, `createTestZustandSkill()`, etc.                                                                                           |
| `test-constants.ts` (~69 lines)               | Keyboard sequences (`ARROW_UP`, `ENTER`, `ESCAPE`), timing constants (`INPUT_DELAY_MS=50`, `RENDER_DELAY_MS=100`)                                                               |
| `fixtures/create-test-source.ts` (~546 lines) | Complete project structure generator for integration tests                                                                                                                      |

### Test Patterns

**1. Unit tests with mocks** (most lib files):

```typescript
vi.mock("../../utils/fs");
import { compile } from "./compiler";
it("creates output directory", async () => {
  vi.mocked(readFile).mockResolvedValue("# content");
  await compile(agents, ctx);
  expect(ensureDir).toHaveBeenCalledWith(expectedPath);
});
```

**2. Component tests with ink-testing-library** (wizard components):

```typescript
const { lastFrame, stdin } = render(<CategoryGrid {...props} />);
expect(lastFrame()).toContain("Framework");
stdin.write(ARROW_DOWN);
await delay(INPUT_DELAY_MS);
expect(onFocusChange).toHaveBeenCalledWith(1, 0);
```

**3. Store tests** (Zustand):

```typescript
beforeEach(() => useWizardStore.getState().reset());
it("tracks navigation history", () => {
  const store = useWizardStore.getState();
  store.setStep("stack");
  expect(useWizardStore.getState().history).toEqual(["approach"]);
});
```

**4. Integration tests with real file system**:

```typescript
let tempDir: string;
beforeEach(async () => { tempDir = await mkdtemp(...); });
afterEach(async () => { await rm(tempDir, { recursive: true, force: true }); });
it("detects local installation", async () => {
  await mkdir(path.join(tempDir, ".claude-src"), { recursive: true });
  const result = await detectInstallation(tempDir);
  expect(result?.mode).toBe("local");
});
```

**5. CLI command tests** (oclif runCommand):

```typescript
beforeEach(async () => {
  process.chdir(projectDir);
});
it("accepts --verbose flag", async () => {
  const { error } = await runCliCommand(["compile", "--verbose"]);
  expect(error?.message?.toLowerCase()).not.toContain("unknown flag");
});
```

### Test Data Convention

Test skill IDs **must** match the `SkillId` pattern:

```typescript
// CORRECT
createMockSkill("web-test-a", "framework");

// WRONG (won't type-check)
createMockSkill("test-skill-a", "framework");
```

---

## Utility Patterns

### File System (`utils/fs.ts`)

Thin wrapper around `fs-extra` + `fast-glob`:

```typescript
readFile(path); // Read UTF-8 file
readFileOptional(path, ""); // Read with fallback (no throw)
writeFile(path, content); // Write with auto-ensureDir
fileExists(path); // Check file exists
directoryExists(path); // Check directory exists
listDirectories(path); // List subdirectories
glob(pattern, cwd); // fast-glob file matching
ensureDir(path); // Create directory tree
remove(path); // Delete file/directory
copy(src, dest); // Copy file/directory
```

### Process Execution (`utils/exec.ts`)

```typescript
execCommand(cmd, args, opts); // Generic process execution
isClaudeCLIAvailable(); // Check claude CLI exists
claudePluginInstall(path, scope); // Install plugin
claudePluginUninstall(name, scope); // Remove plugin
claudePluginMarketplaceAdd(repo); // Add marketplace
claudePluginMarketplaceExists(name); // Check marketplace
```

### Remeda Utilities

Tree-shakeable functional transforms used across 20+ files:

| Function       | Usage                             |
| -------------- | --------------------------------- |
| `sortBy()`     | Sort arrays by property (6 files) |
| `unique()`     | Deduplicate arrays (3 files)      |
| `uniqueBy()`   | Deduplicate by predicate (1 file) |
| `countBy()`    | Count grouped elements (3 files)  |
| `sumBy()`      | Sum element properties (2 files)  |
| `groupBy()`    | Group elements by key (2 files)   |
| `mapValues()`  | Transform object values (3 files) |
| `mapToObj()`   | Map array to object (2 files)     |
| `indexBy()`    | Create object index (1 file)      |
| `pipe()`       | Function composition (1 file)     |
| `flatMap()`    | Map + flatten (1 file)            |
| `filter()`     | Conditional filtering (1 file)    |
| `difference()` | Set difference (1 file)           |

---

## Configuration & Resolution

### Precedence

```
--source flag > CC_SOURCE env > .claude-src/config.yaml > .claude/config.yaml > default
```

For agents source:

```
--agent-source flag > project config agents_source > global config agents_source > bundled agents
```

### Installation Modes

| Mode       | Location                              | Managed By             |
| ---------- | ------------------------------------- | ---------------------- |
| **Plugin** | `~/.claude/plugins/agents-inc/`       | Native Claude CLI      |
| **Local**  | `.claude/agents/` + `.claude/skills/` | Direct file operations |

Detection: `detectInstallation()` checks plugin dir first, then local dirs.

### Project Config Schema

```yaml
# .claude-src/config.yaml
version: "1"
name: my-project
description: Optional description
agents:
  - web-developer
  - api-developer
stack:
  web-developer:
    framework: web-framework-react
    styling: web-styling-scss-modules
  api-developer:
    framework: api-framework-hono
    database: api-database-drizzle
source: https://github.com/org/skills
marketplace: my-marketplace
agents_source: https://github.com/org/agents
```

---

## Agent Compilation

### Source Structure

Each agent in `src/agents/{category}/{agent-name}/`:

```
agent.yaml           # Agent definition (title, description, model, tools, permissions)
intro.md             # Required: introduction section
workflow.md          # Required: workflow section
examples.md          # Optional: examples section
critical-requirements.md  # Optional: injected at top of compiled output
critical-reminders.md     # Optional: injected at bottom
output-format.md          # Optional: output format section
```

### Compilation Process

1. Load agent definition from `agent.yaml` (validated by `agentYamlConfigSchema`)
2. Read all markdown partials (intro, workflow, examples, etc.)
3. Resolve skills: preloaded (embedded) vs dynamic (via Skill tool)
4. Render through **liquidjs** Liquid template
5. Generate frontmatter (name, description, tools, model, permissions, hooks)
6. Write compiled `.md` file to output directory
7. Generate `plugin.json` manifest if plugin mode

### Skill Injection

- **Preloaded skills**: Full SKILL.md content embedded directly in the agent
- **Dynamic skills**: Listed in frontmatter `skills:` array, loaded via Skill tool at runtime

---

## Third-Party Dependencies

| Package       | Version | Purpose                                             |
| ------------- | ------- | --------------------------------------------------- |
| `@oclif/core` | 4.x     | CLI command framework                               |
| `ink`         | 5.x     | React terminal rendering                            |
| `@inkjs/ui`   | 2.x     | Terminal UI components (Select, TextInput, Spinner) |
| `react`       | 18.x    | UI component model                                  |
| `zustand`     | 5.x     | Wizard state management                             |
| `zod`         | 4.3.x   | Runtime schema validation                           |
| `remeda`      | 2.33.x  | Functional utilities                                |
| `liquidjs`    | 10.x    | Agent template rendering                            |
| `yaml`        | 2.8.x   | YAML parsing/serialization                          |
| `fs-extra`    | 11.x    | Enhanced file system operations                     |
| `fast-glob`   | 3.3.x   | File pattern matching                               |
| `giget`       | 1.2.x   | GitHub repository cloning/downloading               |
| `diff`        | 8.x     | Text diffing                                        |
| `gray-matter` | 4.x     | Markdown frontmatter parsing                        |

**Testing:**

| Package               | Purpose                  |
| --------------------- | ------------------------ |
| `vitest`              | Test runner + assertions |
| `@vitest/coverage-v8` | Code coverage            |
| `ink-testing-library` | Ink component testing    |
| `@oclif/test`         | CLI command testing      |

---

## Conventions & Philosophy

### Code Style

- **TypeScript strict mode** with zero `any` (justify with comment if unavoidable)
- **Named exports only** (no default exports in library code)
- **kebab-case** file and directory names
- **SCREAMING_SNAKE_CASE** for constants
- **No magic numbers** - all numbers as named constants
- **Import ordering**: React > external > internal > relative > styles

### Architecture Principles

- **Domain-driven modules** with barrel exports for clean imports
- **Zod at boundaries, types everywhere else** - validate once, trust downstream
- **Lenient loading, strict validation** - accept partial data, validate before use
- **Remeda over manual loops** - immutable, composable, tree-shakeable
- **Type safety over casts** - fix interfaces, don't cast in consumer code
- **Functional composition** - `pipe()`, `flatMap()`, `filter()` chains
- **Error tolerance** - `safeParse` with warnings, not crashes, at data boundaries

### Testing Philosophy

- **Unit tests** for pure functions and isolated modules (mock fs/logger)
- **Integration tests** for multi-module flows (real file system, temp dirs)
- **Command tests** for CLI wiring (oclif test runner, flag/arg validation)
- **Component tests** for Ink UI (ink-testing-library, keyboard simulation)
- **User journey tests** for end-to-end workflows
- Co-locate unit tests with source (`*.test.ts` alongside `*.ts`)
- Integration/command/journey tests in `lib/__tests__/`

### Evolution History

| Phase | What Changed                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| P1-P4 | Core commands, test coverage from 384 to 1160 tests                                                                                      |
| P5    | Commander.js + @clack/prompts migrated to oclif + Ink                                                                                    |
| P6    | Agent-centric configuration (skills in stacks, not agents)                                                                               |
| P7A   | Architecture fix (stack-based skill resolution)                                                                                          |
| P7B   | Wizard UX redesign (2D grid, domain-based, vim keys)                                                                                     |
| D5    | Type simplification (types over interfaces, shared base, display names)                                                                  |
| D6    | Type narrowing (union types, named aliases, Zod schemas, Remeda, typed helpers)                                                          |
| D7    | Domain restructuring (8 lib subdirectories, barrel exports, ~140 import paths)                                                           |
| MS    | Multi-source UX (6 phases: source grid, multi-source loader, archive/restore, installed indicators, source settings, bound skill search) |
