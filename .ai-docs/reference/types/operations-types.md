---
scope: reference
area: types
keywords: [operations, LoadedSource, ConfigChanges, detectConfigChanges, migratePluginSkillScopes, edit-command]
related:
  - reference/types/core-types.md
  - reference/features/operations-layer.md
  - reference/commands/edit.md
last_validated: 2026-04-13
---

# Operations Layer Types

**Last Updated:** 2026-04-13
**Last Validated:** 2026-04-13

> **Split from:** `reference/type-system.md`. See also: [core-types.md](./core-types.md), [zod-schemas.md](./zod-schemas.md).

## Operations Layer Types (`src/cli/lib/operations/types.ts`)

The operations layer defines focused result types for each operation, re-exported from `src/cli/lib/operations/types.ts`:

### Source Operations

| Type                | File                                       | Purpose                                     |
| ------------------- | ------------------------------------------ | ------------------------------------------- |
| `LoadSourceOptions` | `operations/source/load-source.ts`         | Options for loading a skills source         |
| `LoadedSource`      | `operations/source/load-source.ts`         | Result of loading a source (matrix + paths) |
| `MarketplaceResult` | `operations/source/ensure-marketplace.ts`  | Result of marketplace registration          |

### Skill Operations

| Type                     | File                                              | Purpose                                         |
| ------------------------ | ------------------------------------------------- | ----------------------------------------------- |
| `DiscoveredSkills`       | `operations/skills/discover-skills.ts`            | Result of skill discovery (local + marketplace) |
| `ScopedSkillDir`         | `operations/skills/collect-scoped-skill-dirs.ts`  | Single scoped skill directory entry             |
| `ScopedSkillDirsResult`  | `operations/skills/collect-scoped-skill-dirs.ts`  | Collected scoped dirs with counts               |
| `SkillCopyResult`        | `operations/skills/copy-local-skills.ts`          | Result of copying local skills                  |
| `SkillComparisonResults` | `operations/skills/compare-skills.ts`             | Comparison results (added/removed/changed)      |
| `SkillMatchResult`       | `operations/skills/find-skill-match.ts`           | Result of matching a skill to a source          |
| `PluginInstallResult`    | `operations/skills/install-plugin-skills.ts`      | Result of plugin skill installation             |
| `PluginUninstallResult`  | `operations/skills/uninstall-plugin-skills.ts`    | Result of plugin skill uninstallation           |

### Project Operations

| Type                   | File                                              | Purpose                                    |
| ---------------------- | ------------------------------------------------- | ------------------------------------------ |
| `DetectedProject`      | `operations/project/detect-project.ts`            | Detected project installation state        |
| `BothInstallations`    | `operations/project/detect-both-installations.ts` | Combined project + global installation     |
| `ConfigWriteOptions`   | `operations/project/write-project-config.ts`      | Options for writing project config         |
| `ConfigWriteResult`    | `operations/project/write-project-config.ts`      | Result of config write operation           |
| `CompileAgentsOptions` | `operations/project/compile-agents.ts`            | Options for agent compilation              |
| `CompilationResult`    | `operations/project/compile-agents.ts`            | Result of agent compilation                |
| `AgentDefs`            | `operations/project/load-agent-defs.ts`           | Loaded agent definitions with source paths |

## Edit Command Types (`src/cli/commands/edit.tsx`)

Types and functions exported from `edit.tsx` for config change detection and plugin scope migration. All marked `@internal` (exported for testing).

### ConfigChanges (`src/cli/commands/edit.tsx`)

```typescript
type ConfigChanges = {
  addedSkills: SkillId[];
  removedSkills: SkillId[];
  addedAgents: AgentName[];
  removedAgents: AgentName[];
  sourceChanges: Map<SkillId, { from: string; to: string }>;
  scopeChanges: Map<SkillId, { from: "project" | "global"; to: "project" | "global" }>;
  agentScopeChanges: Map<AgentName, { from: "project" | "global"; to: "project" | "global" }>;
};
```

### detectConfigChanges (`src/cli/commands/edit.tsx`)

```typescript
function detectConfigChanges(
  oldConfig: ProjectConfig | null,
  wizardResult: WizardResultV2,
): ConfigChanges;
```

Compares old project config against wizard result. Uses `remeda.difference()` for added/removed and `remeda.indexBy()` for property change detection (source, scope, agent scope).

### PluginScopeMigrationResult (`src/cli/commands/edit.tsx`)

```typescript
type PluginScopeMigrationResult = {
  migrated: SkillId[];
  failed: Array<{ id: SkillId; error: string }>;
};
```

### migratePluginSkillScopes (`src/cli/commands/edit.tsx`)

```typescript
async function migratePluginSkillScopes(
  scopeChanges: Map<SkillId, { from: "project" | "global"; to: "project" | "global" }>,
  skills: Array<{ id: SkillId; source: string }>,
  marketplace: string,
  projectDir: string,
): Promise<PluginScopeMigrationResult>;
```

Handles plugin-mode skill scope migrations. Skips `source === "eject"` skills (handled separately by `migrateLocalSkillScope`). For project-to-global: uninstalls project-scope, installs global-scope. For global-to-project: adds project-scope registration (keeps global for other projects).
