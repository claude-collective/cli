# D-37: Merge Global + Project Installations in Resolution

**Status:** Planning
**Depends on:** D-36 (Global install support with project-level override)
**Date:** 2026-02-26

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [D-36 Foundation Assumptions](#d-36-foundation-assumptions)
3. [Merge Strategy Design](#merge-strategy-design)
4. [Conflict Resolution Rules](#conflict-resolution-rules)
5. [Agent Merge Strategy](#agent-merge-strategy)
6. [Edit Command in Merge Mode](#edit-command-in-merge-mode)
7. [Type Changes](#type-changes)
8. [Step-by-Step Implementation Plan](#step-by-step-implementation-plan)
9. [Test Plan](#test-plan)
10. [Open Questions](#open-questions)

---

## Current State Analysis

### How Sources Are Loaded Today

**`source-loader.ts:67-107` (`loadSkillsMatrixFromSource`)**

The entry point for all skill loading. Currently operates on a single source resolution path:

1. Calls `resolveSource(sourceFlag, projectDir)` which returns a single `ResolvedConfig` (source-loader.ts:72)
2. Loads the matrix from either local or remote (source-loader.ts:80-84)
3. Discovers local skills from `{projectDir}/.claude/skills/` and merges them into the matrix (source-loader.ts:87-94)
4. Annotates skills with multi-source availability via `loadSkillsFromAllSources()` (source-loader.ts:96-102)
5. Runs health check (source-loader.ts:104)
6. Returns a single `SourceLoadResult` (source-loader.ts:106)

There is no concept of loading from two base paths (project + global) and merging the results. The function always loads from exactly one resolved source.

**`source-loader.ts:171-250` (`loadAndMergeFromBasePath`)**

The core loading function that:

1. Loads `ProjectSourceConfig` from the base path (line 172)
2. Loads the CLI's own skills-matrix.yaml as a baseline (line 178-179)
3. Discovers custom schema values from the source (line 184)
4. Loads and merges the source's skills-matrix.yaml on top of CLI's (lines 186-218)
5. Extracts all skills from the source's skills directory (lines 220-224)
6. Merges matrix with skills via `mergeMatrixWithSkills()` (line 224)
7. Loads stacks from source or CLI fallback (lines 227-233)
8. Loads agent domain definitions (lines 236-247)

This function takes a single `basePath` and returns a single `MergedSkillsMatrix`. It has no awareness of multiple installation levels.

### How Config Is Loaded Today

**`config.ts:63-85` (`loadProjectSourceConfig`)**

Loads `ProjectSourceConfig` from `{projectDir}/.claude-src/config.yaml` with fallback to `{projectDir}/.claude/config.yaml` (legacy). Returns `null` if neither exists. No home directory fallback.

**`config.ts:100-148` (`resolveSource`)**

Precedence: `--source` flag > `CC_SOURCE` env var > `{projectDir}/.claude-src/config.yaml` source field > default (`github:agents-inc/skills`). Only reads from one `projectDir`, never from `~/.claude-src/`.

**`project-config.ts:18-64` (`loadProjectConfig`)**

Loads full `ProjectConfig` (the installed config with skills, agents, stack mappings) from `{projectDir}/.claude-src/config.yaml` or legacy fallback. No home directory fallback. Returns `LoadedProjectConfig | null`.

### How Config Is Generated

**`config-generator.ts:39-109` (`generateProjectConfigFromSkills`)**

Takes selected skill IDs, the matrix, and options (agents, author, description). Builds a `ProjectConfig` with a `stack` property mapping each agent to each skill by subcategory. All selected skills are assigned to all selected agents.

**`config-merger.ts:18-82` (`mergeWithExistingConfig`)**

When saving a new config during edit/init, merges with existing on-disk config. Preserves identity fields (name, description, source, author) from existing. Unions agent arrays. Deep-merges stack property. This operates on a single config level -- no concept of merging project-level with global-level.

### How Installation Is Detected

**`installation.ts:23-61` (`detectInstallation`)**

Checks for config at `{projectDir}/.claude-src/config.yaml` or `{projectDir}/.claude/config.yaml`. Returns `Installation | null`. No home directory fallback.

### How Edit Mode Works Today

**`edit.tsx:59-286`**

1. Detects existing installation via `detectInstallation()` (line 62) -- project-level only
2. Loads skills matrix from source (lines 77-91)
3. Loads project config via `loadProjectConfig(projectDir)` (line 93)
4. Discovers current skills via `discoverAllPluginSkills(projectDir)` or falls back to `projectConfig.config.skills` (lines 96-111)
5. Opens wizard with `initialStep="build"`, passing `installedSkillIds`, saved domains, agents, install mode, expert mode (lines 120-141)
6. After wizard: diffs added/removed skills, detects source changes, performs plugin install/uninstall, recompiles agents (lines 144-284)
7. **Known gap**: Never persists wizard result changes back to config.yaml (see install-mode-redesign.md audit)

### How Wizard State Is Populated for Edit

**`use-wizard-initialization.ts:19-57`**

1. If `installedSkillIds` provided, calls `populateFromSkillIds()` which resolves each skill ID to its domain/subcategory and builds `domainSelections` (lines 34-37)
2. Sets `step` to `initialStep` and `approach` to `"scratch"` (line 39)
3. Restores `installMode`, `expertMode`, `selectedDomains`, `selectedAgents` from saved config (lines 41-55)

**`wizard-store.ts:486-514` (`populateFromSkillIds`)**

Takes a flat `SkillId[]`, looks up each skill's category and domain from the matrix, builds `domainSelections`. Warns for unresolvable skills. Only processes skills that exist in the current matrix.

---

## D-36 Foundation Assumptions

D-36 establishes the following foundation that D-37 builds upon:

1. **Global config location**: `~/.claude-src/config.yaml` (both `ProjectSourceConfig` and `ProjectConfig` fields in one file, mirroring the project-level structure)
2. **Global skills location**: `~/.claude/skills/` (for local mode) or `~/.claude/plugins/` (for plugin mode)
3. **Global agents location**: `~/.claude/agents/`
4. **`--global` flag on init**: `agentsinc init --global` installs to home directory
5. **Resolution order (D-36 Phase 1)**: Project-level completely overrides global. If `{cwd}/.claude-src/config.yaml` exists, global is ignored entirely.
6. **All fallback functions follow the same pattern**: check project-level first, fall back to global if project-level absent.

D-37 extends this from "full override" to "merge" semantics.

---

## Merge Strategy Design

### Core Principle: Project Extends Global

When both a global installation and a project installation exist, the merged result should contain the **union** of both skill sets, with project-level taking priority for overlapping categories.

```
Global: web-framework-react, web-state-zustand, web-testing-vitest, shared-methodology-agile
Project: api-framework-hono, api-orm-drizzle
Merged: all six skills active
```

### When Merging Occurs

Merging is triggered when:

1. A project-level config exists (`{cwd}/.claude-src/config.yaml`)
2. A global config also exists (`~/.claude-src/config.yaml`)
3. The project-level config declares `merge: true` (opt-in) OR merging is the default behavior (see Open Question Q1)

### What Gets Merged

| Field | Merge behavior |
|-------|---------------|
| `skills` (flat SkillId[]) | Union. Project skills + global skills. Deduped. |
| `agents` (AgentName[]) | Union. Project agents + global agents. Deduped. |
| `stack` (agent->subcat->skills) | Deep merge. Per-agent, per-subcategory: project wins on conflict. |
| `domains` | Union. All domains from both configs. |
| `selectedAgents` | Union. All selected agents from both. |
| `source` | Project wins if set. Falls back to global. |
| `marketplace` | Project wins if set. Falls back to global. |
| `author` | Project wins if set. Falls back to global. |
| `installMode` | Project wins if set. Falls back to global. |
| `expertMode` | Project wins if set. Falls back to global. |
| `name` | Project wins. (Global name is just "global" or similar.) |
| `description` | Project wins if set. |

### What Does NOT Get Merged

- **`ProjectSourceConfig` source resolution**: continues to follow existing precedence (flag > env > project > default). D-36 adds global as a fallback when project is absent. D-37 does NOT merge source configs -- it merges the installed configs.
- **Local skills on disk**: NOT merged at the filesystem level. The merge produces a unified `ProjectConfig` that is used by the wizard and compilation. Actual skill files remain where they were installed (global or project).
- **Matrix loading**: The `loadSkillsMatrixFromSource()` function continues to load from one resolved source. The merge applies to the installed config (what skills the user selected), not the available skills matrix.

### Merge Point in the Pipeline

The merge happens at the **config loading** level, not the matrix loading level.

```
BEFORE (D-36 Phase 1 -- full override):
  loadProjectConfig(projectDir) -> project config OR null
  loadProjectConfig(homedir)    -> global config OR null
  effectiveConfig = projectConfig ?? globalConfig

AFTER (D-37 -- merge):
  loadProjectConfig(projectDir) -> project config OR null
  loadProjectConfig(homedir)    -> global config OR null
  effectiveConfig = mergeInstallationConfigs(projectConfig, globalConfig)
```

The new `mergeInstallationConfigs()` function produces a unified `ProjectConfig` that represents the combined installation state.

---

## Conflict Resolution Rules

### Same Category, Different Skill

When both global and project select skills in the same subcategory:

**Rule: Project wins for exclusive categories. Both active for non-exclusive categories.**

```
Global: web-framework -> [web-framework-react]         (exclusive)
Project: web-framework -> [web-framework-vue]          (exclusive)
Merged: web-framework -> [web-framework-vue]           (project wins)

Global: web-testing -> [web-testing-vitest]            (non-exclusive)
Project: web-testing -> [web-testing-playwright]       (non-exclusive)
Merged: web-testing -> [web-testing-vitest, web-testing-playwright]   (both)
```

The exclusivity check uses `matrix.categories[subcategory].categoryExclusive`. Exclusive categories (like `web-framework`) can only have one skill active -- project wins. Non-exclusive categories (like `web-testing`) allow multiple skills -- both are kept.

### Same Skill in Both

When both global and project select the same skill:

**Rule: Deduplicate. Preserve the project-level's assignment details (preloaded flag, source selection).**

```
Global: web-testing-vitest (preloaded: false)
Project: web-testing-vitest (preloaded: true)
Merged: web-testing-vitest (preloaded: true)  -- project's value wins
```

### Stack (Agent-Level) Merge

The `stack` property maps agents to subcategory-skill assignments. Merge strategy:

1. Start with global stack as base
2. Overlay project stack on top
3. Per-agent, per-subcategory: project wins if present
4. Agents only in global: preserved
5. Agents only in project: added

```yaml
# Global stack:
web-developer:
  web-framework: [{ id: web-framework-react, preloaded: false }]
  web-state: [{ id: web-state-zustand, preloaded: false }]

# Project stack:
api-developer:
  api-framework: [{ id: api-framework-hono, preloaded: false }]

# Merged stack:
web-developer:
  web-framework: [{ id: web-framework-react, preloaded: false }]
  web-state: [{ id: web-state-zustand, preloaded: false }]
api-developer:
  api-framework: [{ id: api-framework-hono, preloaded: false }]
```

When the same agent exists in both and has the same subcategory:

```yaml
# Global:
web-developer:
  web-framework: [{ id: web-framework-react }]

# Project:
web-developer:
  web-framework: [{ id: web-framework-vue }]    # exclusive -> project wins
  web-orm: [{ id: web-orm-drizzle }]            # only in project -> added

# Merged:
web-developer:
  web-framework: [{ id: web-framework-vue }]
  web-orm: [{ id: web-orm-drizzle }]
```

---

## Agent Merge Strategy

**Rule: Union with project override for shared agents.**

Agents are merged, not fully overridden:

1. **Union of agent names**: `merged.agents = unique([...globalConfig.agents, ...projectConfig.agents])`
2. **Stack merging per agent**: see Stack section above
3. **Domain-agent mapping**: derived from the merged domain list via `DOMAIN_AGENTS` at runtime, not stored

This means a global installation that configures `web-developer` and `web-reviewer`, combined with a project that configures `api-developer`, results in all three agents being active. The project does NOT need to re-declare the global agents.

If both global and project declare the same agent with different skill mappings, the project's mapping wins per-subcategory (deep merge).

---

## Edit Command in Merge Mode

### Which Level Does `edit` Modify?

**Rule: `agentsinc edit` always modifies the level where it detects an installation.**

- If run from a directory with a project-level installation: edits the project-level config
- If run from a directory without a project-level installation (falling back to global): edits the global config
- If both exist (merge mode): edits the **project-level** config only

The global config is treated as a base layer that the project extends. Users should edit the global config by running `agentsinc edit --global` (from D-36) or by navigating to the global installation directory.

### Wizard Population in Merge Mode

When `edit` runs in merge mode, the wizard must show the **merged** state but only persist changes to the project-level config:

1. Load both configs: `globalConfig = loadProjectConfig(homedir)`, `projectConfig = loadProjectConfig(cwd)`
2. Compute merged config: `mergedConfig = mergeInstallationConfigs(projectConfig, globalConfig)`
3. Pass merged skill IDs to wizard as `installedSkillIds` (so the user sees everything that's active)
4. Mark global-only skills as "inherited" in the UI (dimmed, with a label like "(from global)")
5. When the wizard completes, diff against the **merged** state to detect changes
6. Persist only the changes to the project-level config

### Inherited Skills in the Wizard

Skills that come from the global config should be visually distinct in the wizard:

- Shown in the build step as pre-selected but dimmed with a "(global)" tag
- Cannot be deselected in the build step (would require editing global config)
- OR: can be "overridden" by selecting a different skill in the same exclusive category

**Simpler alternative**: Show the merged state as fully editable. When the user deselects a global skill, it gets added to a project-level "excluded" list. When the user changes a global skill's source, it gets added to project-level overrides.

This introduces a new concept: **project-level exclusions** for global skills. A project config would need:

```yaml
# Project-level config
excludeGlobalSkills:
  - web-testing-vitest   # Don't want the global testing choice for this project
```

See Open Question Q3 for whether this complexity is warranted.

---

## Type Changes

### New Fields on `ProjectSourceConfig` (`config.ts:38-51`)

```typescript
export type ProjectSourceConfig = {
  // ... existing fields ...

  /** Whether to merge with global installation config. Default behavior TBD (see Q1). */
  merge?: boolean;

  /** Global skills to exclude from the merged result (project-level only). */
  excludeGlobalSkills?: SkillId[];
};
```

### New Fields on `ProjectConfig` (`types/config.ts:37-108`)

```typescript
export type ProjectConfig = {
  // ... existing fields ...

  /** Indicates this is a global installation. Set by `init --global`. */
  global?: boolean;

  /** Skills inherited from global that this project explicitly excludes. */
  excludeGlobalSkills?: SkillId[];
};
```

### New Type: `MergedInstallationConfig`

```typescript
/** Result of merging global and project installation configs. */
export type MergedInstallationConfig = {
  /** The effective merged config used for wizard population and compilation. */
  effectiveConfig: ProjectConfig;

  /** The project-level config (null if only global exists). */
  projectConfig: ProjectConfig | null;

  /** The global config (null if no global installation). */
  globalConfig: ProjectConfig | null;

  /** Which level is being edited. */
  editLevel: "project" | "global";

  /** Skills that come from the global config (for UI annotation). */
  globalSkillIds: SkillId[];

  /** Skills that come from the project config. */
  projectSkillIds: SkillId[];
};
```

### Zod Schema Updates (`lib/schemas.ts`)

- Add `merge` field to `projectSourceConfigSchema`
- Add `excludeGlobalSkills` field to `projectSourceConfigSchema`
- Add `global` field to `projectConfigLoaderSchema`
- Add `excludeGlobalSkills` field to `projectConfigLoaderSchema`

---

## Step-by-Step Implementation Plan

### Phase 0: Prerequisites (from D-36)

D-36 must be complete before D-37 can start. Specifically:

- `loadProjectSourceConfig()` must support home directory fallback
- `loadProjectConfig()` must support home directory fallback
- `detectInstallation()` must support home directory fallback
- `resolveSource()` must support home directory fallback
- `--global` flag on `init` must work

### Phase 1: Config Merge Function

**Goal**: Create the core merge logic without any UI changes.

**Files to create/modify:**

| File | Action | Purpose |
|------|--------|---------|
| `src/cli/lib/configuration/config-merger.ts` | Modify | Add `mergeInstallationConfigs()` function |
| `src/cli/lib/configuration/index.ts` | Modify | Export new function |
| `src/cli/types/config.ts` | Modify | Add `global`, `excludeGlobalSkills` fields |
| `src/cli/lib/schemas.ts` | Modify | Add Zod fields for new config properties |

**New function: `mergeInstallationConfigs()`**

```typescript
export function mergeInstallationConfigs(
  projectConfig: ProjectConfig | null,
  globalConfig: ProjectConfig | null,
  matrix: MergedSkillsMatrix,
): MergedInstallationConfig {
  // 1. If only one exists, return it as the effective config
  // 2. If both exist, merge:
  //    a. Union skills (deduped)
  //    b. Union agents (deduped)
  //    c. Deep merge stack (project wins per-agent per-subcategory)
  //    d. Union domains
  //    e. Project wins for scalar fields (source, author, installMode, etc.)
  //    f. Apply excludeGlobalSkills filter
  // 3. For exclusive category conflicts, use matrix to determine category exclusivity
  //    and resolve project-wins rule
  // 4. Return MergedInstallationConfig with annotations
}
```

**Exclusive category conflict resolution implementation:**

```typescript
function resolveSkillConflicts(
  globalSkills: SkillId[],
  projectSkills: SkillId[],
  matrix: MergedSkillsMatrix,
): SkillId[] {
  // Group skills by subcategory
  // For exclusive subcategories: if project has a selection, drop global's
  // For non-exclusive: keep both
  // Return merged, deduped list
}
```

### Phase 2: Wire Merge Into Loading Pipeline

**Goal**: Make `loadProjectConfig()` and `detectInstallation()` merge-aware.

**Files to modify:**

| File | Action | Purpose |
|------|--------|---------|
| `src/cli/lib/configuration/project-config.ts` | Modify | Add `loadMergedConfig()` that loads both levels |
| `src/cli/lib/installation/installation.ts` | Modify | Make `detectInstallation()` aware of merge mode |
| `src/cli/lib/loading/source-loader.ts` | Modify | Load local skills from both project and global directories |

**New function: `loadMergedConfig()`**

```typescript
export async function loadMergedConfig(
  projectDir: string,
  matrix: MergedSkillsMatrix,
): Promise<MergedInstallationConfig> {
  const projectConfig = await loadProjectConfig(projectDir);
  const globalConfig = await loadProjectConfig(os.homedir());
  return mergeInstallationConfigs(
    projectConfig?.config ?? null,
    globalConfig?.config ?? null,
    matrix,
  );
}
```

**Modify `loadSkillsMatrixFromSource()` (source-loader.ts:67-107)**

After loading the matrix from source, discover local skills from BOTH project and global directories:

```typescript
// Existing: discover local skills from project dir
const localSkillsResult = await discoverLocalSkills(resolvedProjectDir);

// New: also discover local skills from global dir (home)
const globalDir = os.homedir();
if (globalDir !== resolvedProjectDir) {
  const globalLocalSkillsResult = await discoverLocalSkills(globalDir);
  if (globalLocalSkillsResult?.skills.length) {
    result.matrix = mergeLocalSkillsIntoMatrix(result.matrix, globalLocalSkillsResult);
  }
}
```

### Phase 3: Edit Command Merge Support

**Goal**: Make `agentsinc edit` show merged state and persist to the correct level.

**Files to modify:**

| File | Action | Purpose |
|------|--------|---------|
| `src/cli/commands/edit.tsx` | Modify | Load merged config, annotate global skills |
| `src/cli/components/hooks/use-wizard-initialization.ts` | Modify | Accept `globalSkillIds` for UI annotation |
| `src/cli/stores/wizard-store.ts` | Modify | Track which skills are inherited from global |

**Wizard store changes:**

```typescript
// New state field:
globalSkillIds: SkillId[];  // Skills inherited from global (for UI dimming)

// New action:
setGlobalSkillIds: (ids: SkillId[]) => void;
```

**Edit flow changes (edit.tsx):**

```typescript
// Replace:
const projectConfig = await loadProjectConfig(projectDir);

// With:
const mergedInstallation = await loadMergedConfig(projectDir, sourceResult.matrix);
const { effectiveConfig, globalSkillIds, editLevel } = mergedInstallation;

// Pass globalSkillIds to wizard:
<Wizard
  // ... existing props ...
  installedSkillIds={effectiveConfig.skills}
  globalSkillIds={globalSkillIds}
  initialDomains={effectiveConfig.domains}
  initialAgents={effectiveConfig.selectedAgents}
/>
```

**After wizard completion:**

```typescript
// Diff against merged state:
const addedSkills = result.selectedSkills.filter(id => !effectiveConfig.skills.includes(id));
const removedSkills = effectiveConfig.skills.filter(id => !result.selectedSkills.includes(id));

// Separate removals into "project removals" (remove from project config)
// and "global exclusions" (add to excludeGlobalSkills):
const projectRemovals = removedSkills.filter(id => projectSkillIds.includes(id));
const globalExclusions = removedSkills.filter(id => globalSkillIds.includes(id));

// Persist to project config only:
// - Add new skills to project skills
// - Remove project-level skills
// - Add global exclusions to excludeGlobalSkills
```

### Phase 4: Compile Command Merge Support

**Goal**: Make `agentsinc compile` use the merged config.

**Files to modify:**

| File | Action | Purpose |
|------|--------|---------|
| `src/cli/commands/compile.ts` | Modify | Load merged config for compilation |

The compile command needs to resolve skills from both global and project installations to produce the correct agent markdown. This means:

1. Load merged config to get the full skill list
2. Resolve skill files from both global and project skill directories
3. Compile agents with the merged skill set

---

## Test Plan

### Unit Tests

**`config-merger.test.ts` (new)**

1. Global only -> returns global config as effective
2. Project only -> returns project config as effective
3. Both exist, no overlap -> union of skills, agents, stack
4. Both exist, exclusive category conflict -> project wins
5. Both exist, non-exclusive category overlap -> both kept
6. Both exist, same skill in both -> deduped, project assignment details win
7. Both exist, project has `excludeGlobalSkills` -> excluded skills removed from merged
8. Stack deep merge: agents only in global, only in project, and in both
9. Scalar fields: project wins for source, author, installMode, name

**`source-loader.test.ts` (extend)**

10. Local skills discovered from both project and global directories
11. Global local skills don't duplicate project local skills
12. Global local skills appear in the matrix

**`edit.test.tsx` (extend)**

13. Edit in merge mode shows merged skill set
14. Removing a global skill adds to `excludeGlobalSkills`
15. Adding a skill persists to project config only
16. Global-only skills annotated correctly

### Integration Tests

17. Full init --global -> init project -> edit project shows merged state
18. Compile with merged config produces agents with skills from both levels
19. Editing project doesn't modify global config

### Manual Test Scenarios

20. `agentsinc init --global` with web skills -> `agentsinc init` in project with API skills -> verify merged output
21. `agentsinc edit` from project with global -> verify both skill sets visible
22. `agentsinc compile` from project with global -> verify compiled agents include both

---

## Open Questions

### Q1: Should merging be opt-in or the default behavior?

**Options:**

A. **Opt-in via `merge: true` in project config** -- Project must explicitly declare it wants to inherit from global. Without this flag, D-36's full-override behavior applies.

B. **Default behavior** -- When both project and global exist, they are always merged. Users who want full override can use `merge: false` or simply not install globally.

C. **Smart default** -- Merge by default, but if the project config has the same domains as global, treat as full override (the user re-selected everything).

**Recommendation**: Option A (opt-in). Rationale:
- Backward compatible with D-36's full-override behavior
- Users explicitly opt into the complexity of merge resolution
- Avoids surprising behavior when a user adds a global config to an existing project
- The project-level `config.yaml` gains a single `merge: true` line, which is clear intent
- Can be set during `init` based on whether a global installation is detected

### Q2: How should conflicts be surfaced to the user?

When a project selects `web-framework-vue` and global has `web-framework-react` (exclusive category), the project wins silently. Should the wizard show a conflict notification?

**Recommendation**: Show a subtle indicator. In the build step, if a global skill was overridden by a project-level selection in an exclusive category, show a dim note like "(overrides global: react)" next to the project skill. No blocking confirmation needed.

### Q3: Should project configs be able to exclude global skills?

The `excludeGlobalSkills` mechanism adds complexity. Alternative: the project simply doesn't use merge mode if it doesn't want global skills.

**Recommendation**: Defer `excludeGlobalSkills` to a later phase. For Phase 1, merged skills from global are always included. If a user doesn't want a global skill in a specific project, they either:
- Don't use merge mode for that project
- Override the exclusive category with a different skill (which implicitly excludes the global one)

This keeps Phase 1 simpler and avoids introducing a new config concept until there's clear user demand.

### Q4: How should `discoverLocalSkills()` handle both directories?

Currently `discoverLocalSkills()` takes a single project directory and looks in `{dir}/.claude/skills/`. In merge mode, skills may exist in both `{cwd}/.claude/skills/` and `~/.claude/skills/`.

**Recommendation**: Call `discoverLocalSkills()` twice -- once for project dir, once for home dir -- and merge the results. Project-level local skills override global local skills with the same ID (same as the general conflict resolution rule). This keeps the function simple and single-purpose.

### Q5: How does the `source` field work in merge mode?

The source determines which marketplace to load skills from. Should global and project use the same source, or can they differ?

**Recommendation**: Both configs can have different sources, but the matrix is loaded from ONE source (the resolved source per existing precedence). The merge applies to installed configs (what the user selected), not to the available skills. If the global was installed from Source A and the project from Source B, the merged config lists skills from both -- but the wizard loads skills from whichever source resolves for the current context.

This means some merged skills might not appear in the current matrix (if they came from a different source). The wizard should handle these gracefully -- `populateFromSkillIds()` already warns for unresolvable skills (wizard-store.ts:88-92).

### Q6: How does merge interact with the install mode redesign (D-37 install mode)?

The other D-37 (install mode UX redesign, `docs/features/proposed/install-mode-redesign.md`) introduces per-skill source selections and `installMode: "custom"`. If global uses plugin mode and project uses local mode, what's the merged installMode?

**Recommendation**: `installMode` follows the standard scalar merge rule -- project wins. The project's install mode determines how NEW skills from the wizard are installed. Existing global skills retain their installation method (they're already installed globally). This avoids needing to migrate global skills to a different mode.

### Q7: What about the `stack` property in merge mode with stacks?

If global was initialized with Stack A (which pre-configures agent-skill mappings) and the project was initialized with Stack B, what happens to the stack property?

**Recommendation**: Deep merge as described in the Stack Merge section. The project's stack mappings override global's per-agent per-subcategory. This means the merged stack may be a hybrid that doesn't match either Stack A or Stack B exactly. The `selectedStackId` field in the merged config should be `null` (no single stack selected) to reflect this.

### Q8: Performance impact of loading two configs?

Loading both global and project configs doubles the filesystem reads. Is this a concern?

**Recommendation**: No. The reads are simple YAML file loads (< 10ms each). The matrix loading (fetching remote sources, extracting skills) is orders of magnitude more expensive. Two extra `loadProjectConfig()` calls are negligible.
