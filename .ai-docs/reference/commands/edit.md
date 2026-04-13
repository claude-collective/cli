---
scope: reference
area: commands
keywords: [edit, ConfigChanges, detectConfigChanges, migratePluginSkillScopes, change-summary, scope-migration]
related:
  - reference/commands/index.md
  - reference/types/operations-types.md
  - reference/concepts/scope-system.md
  - reference/concepts/tombstone-pattern.md
last_validated: 2026-04-13
---

# Edit Command (Detailed)

**Last Updated:** 2026-04-13
**Last Validated:** 2026-04-13

> **Extracted from:** `reference/commands.md` (edit section) and `reference/type-system.md` (edit command types). See [commands/index.md](./index.md) for the full commands reference.

## File: `src/cli/commands/edit.tsx`

**Purpose:** Modify installed skills via wizard re-entry with diff-based change detection. Outputs a styled change summary (chalk-colored `+`/`-`/`~` lines for added/removed/changed skills, agents, sources, scopes) and a simplified completion message (`"Done"`). Change summary uses skill display names (from matrix) and scope labels (`[G]`/`[P]`). Global-to-project scope changes render as green `+` additions.

## Flags

| Flag           | Type    | Description                                       |
| -------------- | ------- | ------------------------------------------------- |
| --refresh      | boolean | Force refresh from remote sources                 |
| --agent-source | string  | Remote agent partials source (default: local CLI) |
| --source       | string  | Skills source path or URL                         |

## Flow

1. **Operation: `detectProject()`** -- detect installation + load project config
2. **Operation: `loadSource()`** -- load matrix with startup messages
3. Discover current installed skills: `discoverAllPluginSkills()` + merge with config skills
4. Render `<Wizard>` with `initialStep="build"`, `installedSkillIds`, `installedSkillConfigs`, `installedAgentConfigs`, `isEditingFromGlobalScope`, `initialDomains`, `initialAgents`, `startupMessages`
5. `detectConfigChanges()` -- compute added/removed skills, added/removed agents, source changes, scope changes, agent scope changes. Returns `ConfigChanges` type.
6. `logChangeSummary(changes, newSkills, oldSkills)` -- renders styled diff using display names from matrix, scope labels `[G]`/`[P]`, and green `+` for G-to-P scope migrations
7. `detectMigrations()` + `executeMigration()` -- handle eject-to-plugin and plugin-to-eject mode migrations
8. `applyScopeChanges()` -- `migrateLocalSkillScope()` for local skills, `migratePluginSkillScopes()` for plugin skills (uninstall old scope + install new scope)
9. `applySourceChanges()` -- delete old local copies for non-migration source changes
10. `applyPluginChanges()` -- **Operation: `ensureMarketplace()`**, **Operation: `installPluginSkills()`** for added plugins, **Operation: `uninstallPluginSkills()`** for removed
11. **Operation: `copyLocalSkills()`** for newly added local-source skills
12. **Operation: `loadAgentDefs()`**, **Operation: `writeProjectConfig()`**, **Operation: `discoverInstalledSkills()`**, **Operation: `compileAgents()`**
13. `cleanupStaleAgentFiles()` -- remove old agent .md files after scope changes

## Exported Types and Functions

All marked `@internal` (exported for testing).

### ConfigChanges (in `edit.tsx`)

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

### detectConfigChanges (in `edit.tsx`)

```typescript
function detectConfigChanges(
  oldConfig: ProjectConfig | null,
  wizardResult: WizardResultV2,
): ConfigChanges;
```

Compares old project config against wizard result. Uses `remeda.difference()` for added/removed and `remeda.indexBy()` for property change detection (source, scope, agent scope).

### PluginScopeMigrationResult (in `edit.tsx`)

```typescript
type PluginScopeMigrationResult = {
  migrated: SkillId[];
  failed: Array<{ id: SkillId; error: string }>;
};
```

### migratePluginSkillScopes (in `edit.tsx`)

```typescript
async function migratePluginSkillScopes(
  scopeChanges: Map<SkillId, { from: "project" | "global"; to: "project" | "global" }>,
  skills: Array<{ id: SkillId; source: string }>,
  marketplace: string,
  projectDir: string,
): Promise<PluginScopeMigrationResult>;
```

Handles plugin-mode skill scope migrations. Skips `source === "eject"` skills (handled separately by `migrateLocalSkillScope`). For project-to-global: uninstalls project-scope, installs global-scope. For global-to-project: adds project-scope registration (keeps global for other projects).

## Key Dependencies

- `src/cli/lib/operations/index.ts` -- `detectProject`, `loadSource`, `ensureMarketplace`, `installPluginSkills`, `uninstallPluginSkills`, `copyLocalSkills`, `writeProjectConfig`, `compileAgents`, `discoverInstalledSkills`, `loadAgentDefs`
- `src/cli/lib/installation/index.ts` -- `detectMigrations`, `executeMigration`, `deriveInstallMode`
- `src/cli/lib/plugins/index.ts` -- `discoverAllPluginSkills`
- `src/cli/lib/skills/index.ts` -- `deleteLocalSkill`, `migrateLocalSkillScope`
