# D-145 Implementation Guide: Operations Layer

**Status:** Ready for execution
**Spec:** `todo/D-145-operations-layer.md`
**Target:** `src/cli/lib/operations/`

---

## Quick Reference

### Complete File Tree

```
src/cli/lib/operations/
├── index.ts                          # Barrel export (all functions + types)
├── types.ts                          # Re-export of all operation-specific types
├── load-source.ts                    # Phase 1 — loadSource()
├── detect-project.ts                 # Phase 1 — detectProject()
├── load-agent-defs.ts                # Phase 1 — loadAgentDefs()
├── copy-local-skills.ts              # Phase 2 — copyLocalSkills()
├── install-plugin-skills.ts          # Phase 2 — installPluginSkills()
├── uninstall-plugin-skills.ts        # Phase 2 — uninstallPluginSkills()
├── ensure-marketplace.ts             # Phase 2 — ensureMarketplace()
├── compare-skills.ts                 # Phase 2 — compareSkillsWithSource()
├── write-project-config.ts           # Phase 3 — writeProjectConfig()
├── compile-agents.ts                 # Phase 3 — compileAgents()
├── execute-installation.ts           # Phase 4 — executeInstallation()
└── recompile-project.ts              # Phase 4 — recompileProject()
```

### Command-to-Operations Mapping

| Command         | Operations Used                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init.tsx`      | `loadSource`, `copyLocalSkills`, `ensureMarketplace`, `installPluginSkills`, `writeProjectConfig` (composed individually per G9 — NOT `executeInstallation`)                  |
| `edit.tsx`      | `detectProject`, `loadSource`, `loadAgentDefs`, `uninstallPluginSkills`, `ensureMarketplace`, `installPluginSkills`, `copyLocalSkills`, `writeProjectConfig`, `compileAgents` |
| `compile.ts`    | `loadAgentDefs`, `compileAgents` (keeps `run()`, `runCompilePass`, `discoverAllSkills` per G8)                                                                                |
| `outdated.ts`   | `detectProject`, `loadSource`, `compareSkillsWithSource`                                                                                                                      |
| `update.tsx`    | `loadSource`, `compareSkillsWithSource`, `compileAgents`                                                                                                                      |
| `diff.ts`       | `loadSource` (does NOT use `compareSkillsWithSource` — uses its own `diffSkill`)                                                                                              |
| `doctor.ts`     | `loadSource` (minimal — replaces 1 call inside `checkSourceReachable`)                                                                                                        |
| `info.ts`       | `loadSource`                                                                                                                                                                  |
| `search.tsx`    | `loadSource` (2 call sites: `runInteractive` + `runStatic`)                                                                                                                   |
| `eject.ts`      | `loadSource`                                                                                                                                                                  |
| `uninstall.tsx` | None (has its own `claudePluginUninstall` logic on plugin names, not SkillIds)                                                                                                |

### Phase-to-Files Mapping

| Phase                     | New Files Created                                                                                                              | Existing Files Modified                                                                                                                                        | Gate                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **1: Foundation**         | `types.ts`, `index.ts`, `load-source.ts`, `detect-project.ts`, `load-agent-defs.ts`                                            | `init.tsx` (loadSource), `edit.tsx` (detectProject + ~12 access patterns), `compile.ts` (loadAgentDefs)                                                        | `npm test -- --run` + compile E2E |
| **2: Skill Ops**          | `copy-local-skills.ts`, `install-plugin-skills.ts`, `uninstall-plugin-skills.ts`, `ensure-marketplace.ts`, `compare-skills.ts` | `init.tsx` (copyLocalSkills), `edit.tsx` (copyLocalSkills, ensureMarketplace), `outdated.ts` (compareSkillsWithSource), `update.tsx` (compareSkillsWithSource) | `npm test -- --run`               |
| **3: Config+Compile**     | `write-project-config.ts`, `compile-agents.ts`                                                                                 | `edit.tsx` (writeProjectConfig, compileAgents), `compile.ts` (compileAgents inside runCompilePass)                                                             | `npm test -- --run` + compile E2E |
| **4: Pipelines+Refactor** | `execute-installation.ts`, `recompile-project.ts`                                                                              | ALL 10 command files (see Phase 4 detail section)                                                                                                              | Full unit + E2E + `tsc --noEmit`  |
| **5: Cleanup+Tests**      | 12 `*.test.ts` files (one per operation)                                                                                       | Remove dead methods from init.tsx, compile.ts; remove unused imports                                                                                           | Full unit + E2E + `tsc --noEmit`  |

### E2E Risk Matrix

| Phase | Operations Created                                                                                      | Commands Modified                           | E2E Risk                                                                                                                               | Mitigation                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **1** | loadSource, detectProject, loadAgentDefs                                                                | init.tsx, edit.tsx, compile.ts              | **MEDIUM** — edit.tsx access patterns change (`projectConfig?.config?.X` to `projectConfig?.X`); if any are missed, silent `undefined` | Grep `projectConfig?.config` and `projectConfig\.config` in edit.tsx; update ALL ~15 matches (G7)                                |
| **2** | copyLocalSkills, installPluginSkills, uninstallPluginSkills, ensureMarketplace, compareSkillsWithSource | init.tsx, edit.tsx, outdated.ts, update.tsx | **LOW** — operations are additive wrappers; commands still emit the same log messages                                                  | Run unit tests after each operation                                                                                              |
| **3** | writeProjectConfig, compileAgents                                                                       | edit.tsx, compile.ts                        | **MEDIUM** — compile.ts E2E tests assert on per-scope messages; must NOT replace `runCompilePass` (G8)                                 | Only replace `recompileAgents()` call inside runCompilePass; keep all user-facing log messages                                   |
| **4** | executeInstallation, recompileProject                                                                   | ALL 10 commands                             | **HIGH** — init.tsx E2E tests assert on per-skill install messages; edit.test.ts mocks may break                                       | Use individual operations with logging (G9); `executeInstallation` created but NOT used by init.tsx; skip edit.test.ts if broken |
| **5** | 12 unit test files                                                                                      | Dead code removal only                      | **LOW** — no behavioral changes, only removing methods replaced in Phase 4                                                             | Run full suite before and after                                                                                                  |

---

## Prerequisites

Before starting, read these files:

- `CLAUDE.md` — project conventions and rules
- `todo/D-145-operations-layer.md` — the design proposal

**Critical rules for implementors:**

- Do NOT run any git commands
- Do NOT modify test files unless explicitly told to skip them
- Use named exports only, kebab-case filenames
- Use `.js` extensions on relative imports (match existing files in `lib/`)
- Use `typedEntries()`/`typedKeys()` from `utils/typed-object.ts` instead of `Object.entries()`/`Object.keys()`
- Use `EXIT_CODES.*` constants from `lib/exit-codes.ts`
- Use `verbose()`, `warn()`, `log()` from `utils/logger.ts` in operations (not `this.log()`)
- Use existing factories for any test data

---

## Phase-by-Phase Execution Order

### Phase 1: Foundation (types.ts, index.ts, loadSource, detectProject, loadAgentDefs)

### Phase 2: Skill Operations (copyLocalSkills, installPluginSkills, uninstallPluginSkills, ensureMarketplace, compareSkillsWithSource)

### Phase 3: Config + Compilation (writeProjectConfig, compileAgents)

### Phase 4: Composed Pipelines (executeInstallation, recompileProject) + Full Command Refactor

### Phase 5: Cleanup + Operation Unit Tests

---

## Operation: loadSource (Phase 1)

### File

`src/cli/lib/operations/load-source.ts`

### Extracts from

- `init.tsx:235-253` — buffered source loading with startup messages
- `edit.tsx:108-150` — buffered source loading with extra push to buffer
- `diff.ts:184-188` — simple unbuffered source loading
- `outdated.ts:99-102` — simple unbuffered source loading
- `update.tsx:159-162` — simple unbuffered source loading

### Function signature

```typescript
// NOTE: All imports for this operation are consolidated in the "Imports needed" section below.
// Do NOT duplicate import statements between the signature and imports sections.

export type LoadSourceOptions = {
  sourceFlag?: string;
  projectDir: string;
  forceRefresh?: boolean;
  /** When true, enables message buffering and captures startup messages. Default: false. */
  captureStartupMessages?: boolean;
};

export type LoadedSource = {
  sourceResult: SourceLoadResult;
  /** Empty array when captureStartupMessages is false. */
  startupMessages: StartupMessage[];
};

/**
 * Loads the skills matrix from a resolved source.
 *
 * When `captureStartupMessages` is true, wraps the load in buffer mode so
 * warn() calls during loading are captured instead of written to stderr.
 * The caller (init/edit) passes these messages to the Wizard's <Static> block.
 *
 * @throws {Error} If source resolution or fetching fails.
 */
export async function loadSource(options: LoadSourceOptions): Promise<LoadedSource>;
```

### Implementation outline

```
1. If captureStartupMessages:
   a. Call enableBuffering() from utils/logger.js
2. Try:
   a. Call loadSkillsMatrixFromSource({ sourceFlag, projectDir, forceRefresh }) from lib/loading/index.js
3. Catch:
   a. If captureStartupMessages: call disableBuffering()
   b. Re-throw the error (let commands handle it)
4. If captureStartupMessages:
   a. startupMessages = drainBuffer()
   b. disableBuffering()
5. Return { sourceResult, startupMessages: startupMessages ?? [] }
```

### Call sites (before -> after)

**init.tsx:235-253** — buffered loading

```typescript
// BEFORE (lines 235-253):
enableBuffering();

let sourceResult: SourceLoadResult;
let startupMessages: StartupMessage[] = [];
try {
  sourceResult = await loadSkillsMatrixFromSource({
    sourceFlag: flags.source,
    projectDir,
    forceRefresh: flags.refresh,
  });
} catch (error) {
  disableBuffering();
  this.error(getErrorMessage(error), {
    exit: EXIT_CODES.ERROR,
  });
}

startupMessages = drainBuffer();
disableBuffering();

// AFTER:
let loaded: LoadedSource;
try {
  loaded = await loadSource({
    sourceFlag: flags.source,
    projectDir,
    forceRefresh: flags.refresh,
    captureStartupMessages: true,
  });
} catch (error) {
  this.error(getErrorMessage(error), { exit: EXIT_CODES.ERROR });
}
const { sourceResult, startupMessages } = loaded;
```

**edit.tsx:108-150** — buffered loading with extra push

```typescript
// BEFORE (lines 108-150):
// NOTE: edit.tsx's buffer scope wraps MORE than just the source load — it also
// covers loadProjectConfig (line 129) and discoverAllPluginSkills (lines 132-147),
// each with their own pushBufferMessage calls (lines 120-123 and 143).
// The buffer is drained/disabled at lines 149-150, AFTER all three operations complete.
enableBuffering();
let sourceResult;
let startupMessages: StartupMessage[] = [];
try {
  sourceResult = await loadSkillsMatrixFromSource({ ... });
  pushBufferMessage("info", `Loaded ${...} skills (${sourceInfo})`);
} catch (error) {
  disableBuffering();
  this.handleError(error);
}
const projectConfig = await loadProjectConfig(projectDir);
// ... discoverAllPluginSkills + pushBufferMessage ...
startupMessages = drainBuffer();
disableBuffering();

// AFTER:
// loadSource with captureStartupMessages handles enableBuffering -> load -> drainBuffer -> disableBuffering.
// But this means the buffer is disabled BEFORE loadProjectConfig and discoverAllPluginSkills run,
// so their warn() calls would NOT be buffered. In practice this is acceptable because those
// calls only emit simple info-level pushBufferMessage (not warn()), and we push those manually.
let sourceResult: SourceLoadResult;
let startupMessages: StartupMessage[] = [];
try {
  const loaded = await loadSource({
    sourceFlag: flags.source,
    projectDir,
    forceRefresh: flags.refresh,
    captureStartupMessages: true,
  });
  sourceResult = loaded.sourceResult;
  startupMessages = loaded.startupMessages;
} catch (error) {
  this.handleError(error);
}
// Push extra messages directly into the startupMessages array (buffer already drained):
const sourceInfo = sourceResult.isLocal ? "local" : sourceResult.sourceConfig.sourceOrigin;
startupMessages.push({ level: "info", text: `Loaded ${Object.keys(matrix.skills).length} skills (${sourceInfo})` });
// loadProjectConfig and discoverAllPluginSkills run AFTER buffer is disabled — push manually:
const projectConfig = await loadProjectConfig(projectDir);
// ... discoverAllPluginSkills + push into startupMessages array ...
```

**IMPORTANT:** Since `loadSource` drains and disables buffering, edit.tsx can no longer push to the buffer after the call. Instead, edit.tsx pushes messages directly into the `startupMessages` array returned by `loadSource`. This is cleaner than keeping buffer mode active.

**diff.ts:184-188** — unbuffered

```typescript
// BEFORE:
const { matrix, sourcePath, isLocal } = await loadSkillsMatrixFromSource({
  sourceFlag: flags.source,
  projectDir,
});

// AFTER:
const { sourceResult } = await loadSource({
  sourceFlag: flags.source,
  projectDir,
});
const { matrix, sourcePath, isLocal } = sourceResult;
```

**outdated.ts:99-102** — unbuffered (same pattern as diff)

**update.tsx:159-162** — unbuffered (same pattern as diff)

**doctor.ts:194** — unbuffered (inside `checkSourceReachable` helper function)

```typescript
// NOTE: doctor.ts calls loadSkillsMatrixFromSource inside a standalone helper function
// (checkSourceReachable at line 189). The loadSource operation can replace this call,
// but the helper function may need to accept a LoadedSource or the raw sourceResult.
```

**info.ts** — unbuffered (inside `run()` method, same pattern as diff)

**search.tsx:180,266** — unbuffered (called in both `runInteractive` and `runStatic` methods)

**eject.ts:140** — unbuffered (inside `run()` method, conditional on eject type being "skills" or "all")

### Imports needed

```typescript
import { loadSkillsMatrixFromSource, type SourceLoadResult } from "../loading/index.js";
import {
  enableBuffering,
  drainBuffer,
  disableBuffering,
  type StartupMessage,
} from "../../utils/logger.js";
```

---

## Operation: detectProject (Phase 1)

### File

`src/cli/lib/operations/detect-project.ts`

### Extracts from

- `edit.tsx:95-106` — detectInstallation + projectDir extraction
- `outdated.ts:69-70` — detectInstallation + projectDir fallback
- `compile.ts:137-145` — detectGlobalInstallation + detectProjectInstallation (separate, NOT this operation)

### Function signature

```typescript
// NOTE: All imports for this operation are consolidated in the "Imports needed" section below.
// Do NOT duplicate import statements between the signature and imports sections.

export type DetectedProject = {
  installation: Installation;
  config: ProjectConfig | null;
  configPath: string | null;
};
// NOTE: The proposal includes `installation: Installation & { scope: "project" | "global" }`
// but the scope can be derived by callers via `installation.projectDir === os.homedir()`.
// Keeping the type simple; add scope field later if multiple callers need it.

/**
 * Detects an existing CLI installation and loads its project config.
 *
 * Uses detectInstallation() which checks project-level first, then falls back
 * to global. Returns the installation metadata plus the loaded config.
 *
 * @throws — Does NOT throw. Returns null if no installation found.
 *           Commands decide how to handle null (error out, warn, etc.).
 */
export async function detectProject(projectDir?: string): Promise<DetectedProject | null>;
```

### Implementation outline

```
1. Call detectInstallation(projectDir) from lib/installation/index.js
2. If null, return null
3. Call loadProjectConfig(installation.projectDir) from lib/configuration/index.js
4. Return {
     installation,
     config: loaded?.config ?? null,
     configPath: loaded?.configPath ?? null,
   }
```

### Call sites (before -> after)

**edit.tsx:95-106,129**

```typescript
// BEFORE:
const installation = await detectInstallation();
if (!installation) {
  this.error(ERROR_MESSAGES.NO_INSTALLATION, { exit: EXIT_CODES.ERROR });
}
const projectDir = installation.projectDir;
// ... later at line 129:
const projectConfig = await loadProjectConfig(projectDir);

// AFTER:
const detected = await detectProject();
if (!detected) {
  this.error(ERROR_MESSAGES.NO_INSTALLATION, { exit: EXIT_CODES.ERROR });
}
const { installation, config: projectConfig, configPath } = detected;
const projectDir = installation.projectDir;
```

**WARNING: Access pattern change.** Currently `projectConfig` is `LoadedProjectConfig | null`
(with shape `{ config: ProjectConfig, configPath: string }`), accessed as `projectConfig?.config?.skills`.
After this change, `projectConfig` is `ProjectConfig | null`, so ALL downstream access patterns
in edit.tsx must change from `projectConfig?.config?.skills` to `projectConfig?.skills`. There are
~12 such references in edit.tsx (lines 139, 161, 173, 175, 218, 240, 302, 358, 389, etc.).
The implementor must grep for `projectConfig?.config` and update all occurrences.

**outdated.ts:69-70**

```typescript
// BEFORE:
const installation = await detectInstallation();
const projectDir = installation?.projectDir ?? process.cwd();

// AFTER:
const detected = await detectProject();
const projectDir = detected?.installation.projectDir ?? process.cwd();
```

### Imports needed

```typescript
import { detectInstallation, type Installation } from "../installation/index.js";
import { loadProjectConfig } from "../configuration/index.js";
import type { ProjectConfig } from "../../types/index.js";
```

---

## Operation: loadAgentDefs (Phase 1)

### File

`src/cli/lib/operations/load-agent-defs.ts`

### Extracts from

- `edit.tsx:435-450` — getAgentDefinitions (435-450) + loadAllAgents merge (457-459, inside next try block)
- `compile.ts:331-351` — getAgentDefinitions with verbose logging
- `local-installer.ts:152-156` — loadMergedAgents (CLI + source agents)

**Note:** In edit.tsx, the `getAgentDefinitions` call (435-450) and the `loadAllAgents` merge
(457-459) are in different try blocks. The operation combines both into a single call.

### Function signature

```typescript
// NOTE: All imports for this operation are consolidated in the "Imports needed" section below.

export type AgentDefs = {
  /** Merged agent definitions (CLI defaults + source overrides). Source takes precedence. */
  agents: Record<AgentName, AgentDefinition>;
  /** The sourcePath used to load agent partials (for compilation). */
  sourcePath: string;
  /** Full agent source paths (agentsDir, templatesDir, sourcePath). */
  agentSourcePaths: AgentSourcePaths;
};

/**
 * Loads agent definitions from the CLI and optionally from a remote source.
 *
 * Merges CLI built-in agents with source repository agents (source overrides CLI).
 * Returns the merged definitions plus the source path for compilation.
 */
export async function loadAgentDefs(
  agentSource?: string,
  options?: { projectDir?: string; forceRefresh?: boolean },
): Promise<AgentDefs>;
```

### Implementation outline

```
1. Call getAgentDefinitions(agentSource, options) from lib/agents/index.js
   -> returns AgentSourcePaths { agentsDir, templatesDir, sourcePath }
2. Call loadAllAgents(PROJECT_ROOT) from lib/loading/index.js for CLI agents
3. Call loadAllAgents(agentSourcePaths.sourcePath) from lib/loading/index.js for source agents
4. Merge: agents = { ...cliAgents, ...sourceAgents }
5. Return { agents, sourcePath: agentSourcePaths.sourcePath, agentSourcePaths }
```

### Call sites (before -> after)

**edit.tsx:435-459** (spans two separate try blocks)

```typescript
// BEFORE (lines 435-450 — first try block):
let sourcePath: string;
const agentDefs = await getAgentDefinitions(flags["agent-source"], {
  forceRefresh: flags.refresh,
});
sourcePath = agentDefs.sourcePath;

// BEFORE (lines 457-459 — second try block at 452-488):
const cliAgents = await loadAllAgents(PROJECT_ROOT);
const sourceAgents = await loadAllAgents(sourcePath);
const agents: Record<AgentName, AgentDefinition> = { ...cliAgents, ...sourceAgents };

// AFTER:
const agentDefs = await loadAgentDefs(flags["agent-source"], {
  forceRefresh: flags.refresh,
});
const { agents, sourcePath } = agentDefs;
```

**compile.ts:331-351** — `loadAgentDefsForCompile` method

```typescript
// BEFORE:
const agentDefs = await getAgentDefinitions(flags["agent-source"], { projectDir });
return agentDefs;

// AFTER:
// compile.ts uses getAgentDefinitions directly since it doesn't need merged agents
// at load time — it discovers agents per pass. Keep loadAgentDefsForCompile as-is,
// OR refactor to use loadAgentDefs and extract sourcePath.
// Recommendation: compile uses loadAgentDefs for consistency:
const defs = await loadAgentDefs(flags["agent-source"], { projectDir });
return defs; // compile.ts accesses defs.agentSourcePaths.sourcePath for recompileAgents
```

### Imports needed

```typescript
import { getAgentDefinitions } from "../agents/index.js";
import { loadAllAgents } from "../loading/index.js";
import { PROJECT_ROOT } from "../../consts.js";
import type { AgentDefinition, AgentName, AgentSourcePaths } from "../../types/index.js";
```

---

## Operation: copyLocalSkills (Phase 2)

### File

`src/cli/lib/operations/copy-local-skills.ts`

### Extracts from

- `init.tsx:316-356` — mixed mode scope-split skill copying
- `edit.tsx:400-433` — added local skills scope-split copying
- `local-installer.ts:590-616` — installLocal's scope-split copying

### Function signature

```typescript
// NOTE: All imports for this operation are consolidated in the "Imports needed" section below.

export type SkillCopyResult = {
  projectCopied: CopiedSkill[];
  globalCopied: CopiedSkill[];
  totalCopied: number;
};

/**
 * Copies local-source skills to their scope-appropriate directories.
 *
 * Splits skills by scope (project vs global), resolves install paths,
 * ensures directories exist, and copies from source.
 *
 * @param skills - SkillConfig[] (must have scope field for routing)
 * @param projectDir - Project root directory
 * @param sourceResult - Loaded source data for skill file resolution
 */
export async function copyLocalSkills(
  skills: SkillConfig[],
  projectDir: string,
  sourceResult: SourceLoadResult,
): Promise<SkillCopyResult>;
```

### Implementation outline

```
1. Filter skills by scope:
   projectLocalSkills = skills.filter(s => s.scope !== "global")
   globalLocalSkills = skills.filter(s => s.scope === "global")
2. Resolve paths:
   projectPaths = resolveInstallPaths(projectDir, "project")
   globalPaths = resolveInstallPaths(projectDir, "global")
3. Copy project-scoped skills:
   if projectLocalSkills.length > 0:
     await ensureDir(projectPaths.skillsDir)
     projectCopied = await copySkillsToLocalFlattened(
       projectLocalSkills.map(s => s.id),
       projectPaths.skillsDir,
       sourceResult.matrix,
       sourceResult,
     )
   else: projectCopied = []
4. Copy global-scoped skills:
   if globalLocalSkills.length > 0:
     await ensureDir(globalPaths.skillsDir)
     globalCopied = await copySkillsToLocalFlattened(
       globalLocalSkills.map(s => s.id),
       globalPaths.skillsDir,
       sourceResult.matrix,
       sourceResult,
     )
   else: globalCopied = []
5. Return { projectCopied, globalCopied, totalCopied: projectCopied.length + globalCopied.length }
```

### Call sites (before -> after)

**init.tsx:316-356** — mixed mode

```typescript
// BEFORE (lines 316-356):
const projectLocalSkills = localSkills.filter((s) => s.scope !== "global");
const globalLocalSkills = localSkills.filter((s) => s.scope === "global");
const projectPaths = resolveInstallPaths(projectDir, "project");
const globalPaths = resolveInstallPaths(projectDir, "global");
// ... ensureDir + copySkillsToLocalFlattened for each scope ...

// AFTER:
const copyResult = await copyLocalSkills(localSkills, projectDir, sourceResult);
if (copyResult.projectCopied.length > 0 && copyResult.globalCopied.length > 0) {
  this.log(
    `Copied ${copyResult.totalCopied} local skills (${copyResult.projectCopied.length} project, ${copyResult.globalCopied.length} global)`,
  );
} else if (copyResult.globalCopied.length > 0) {
  this.log(`Copied ${copyResult.globalCopied.length} local skills to ~/.claude/skills/`);
} else {
  this.log(`Copied ${copyResult.projectCopied.length} local skills to .claude/skills/`);
}
```

**edit.tsx:400-433** — added local skills

```typescript
// BEFORE (lines 400-433):
const addedLocalSkills = result.skills.filter(
  (s) => addedSkills.includes(s.id) && s.source === "local",
);
if (addedLocalSkills.length > 0) {
  // ... scope split (406-407), ensureDir + copySkillsToLocalFlattened (412-430) ...
}

// AFTER:
const addedLocalSkills = result.skills.filter(
  (s) => addedSkills.includes(s.id) && s.source === "local",
);
if (addedLocalSkills.length > 0) {
  const copyResult = await copyLocalSkills(addedLocalSkills, cwd, sourceResult);
  this.log(`Copied ${copyResult.totalCopied} local skill(s) to .claude/skills/`);
}
```

### Imports needed

```typescript
import { resolveInstallPaths } from "../installation/index.js";
import { copySkillsToLocalFlattened, type CopiedSkill } from "../skills/index.js";
import { ensureDir } from "../../utils/fs.js";
import type { SkillConfig } from "../../types/config.js";
import type { SourceLoadResult } from "../loading/source-loader.js";
```

---

## Operation: installPluginSkills (Phase 2)

### File

`src/cli/lib/operations/install-plugin-skills.ts`

### Extracts from

- `init.tsx:409-420` — per-skill claudePluginInstall loop (inside `installIndividualPlugins`)
- `edit.tsx:373-386` — per-skill claudePluginInstall for added skills

### Function signature

```typescript
// NOTE: All imports for this operation are consolidated in the "Imports needed" section below.

export type PluginInstallResult = {
  installed: Array<{ id: SkillId; ref: string }>;
  failed: Array<{ id: SkillId; error: string }>;
};

/**
 * Installs skill plugins via the Claude CLI, routing by scope.
 *
 * For each skill, constructs the plugin ref as `{skillId}@{marketplace}`
 * and invokes `claudePluginInstall` with the correct scope.
 *
 * @param skills - Skills to install (must have scope for routing)
 * @param marketplace - Marketplace name for plugin ref construction
 * @param projectDir - Project directory for plugin installation
 */
export async function installPluginSkills(
  skills: SkillConfig[],
  marketplace: string,
  projectDir: string,
): Promise<PluginInstallResult>;
```

### Implementation outline

```
1. Filter to plugin-source skills: skills.filter(s => s.source !== "local")
2. For each skill:
   a. pluginRef = `${skill.id}@${marketplace}`
   b. pluginScope = skill.scope === "global" ? "user" : "project"
   c. Try: await claudePluginInstall(pluginRef, pluginScope, projectDir)
      - Push to installed: { id: skill.id, ref: pluginRef }
   d. Catch: Push to failed: { id: skill.id, error: getErrorMessage(error) }
3. Return { installed, failed }
```

### Call sites (before -> after)

**init.tsx:409-420**

```typescript
// BEFORE (inside installIndividualPlugins method):
for (const skill of result.skills.filter((s) => s.source !== "local")) {
  const pluginRef = `${skill.id}@${marketplace}`;
  const pluginScope = skill.scope === "global" ? "user" : "project";
  try {
    await claudePluginInstall(pluginRef, pluginScope, projectDir);
    this.log(`  Installed ${pluginRef}`);
  } catch (error) { ... }
}

// AFTER:
const pluginResult = await installPluginSkills(
  result.skills.filter(s => s.source !== "local"),
  marketplace,
  projectDir,
);
for (const item of pluginResult.installed) {
  this.log(`  Installed ${item.ref}`);
}
for (const item of pluginResult.failed) {
  this.error(`Failed to install plugin ${item.id}: ${item.error}`, { exit: EXIT_CODES.ERROR });
}
```

**edit.tsx:373-386**

```typescript
// BEFORE:
for (const skillId of addedSkills) {
  const skillConfig = result.skills.find((s) => s.id === skillId);
  if (!skillConfig || skillConfig.source === "local") continue;
  const pluginRef = `${skillId}@${sourceResult.marketplace}`;
  // ...
}

// AFTER:
const addedPluginSkills = result.skills.filter(
  (s) => addedSkills.includes(s.id) && s.source !== "local",
);
if (addedPluginSkills.length > 0 && sourceResult.marketplace) {
  const pluginResult = await installPluginSkills(addedPluginSkills, sourceResult.marketplace, cwd);
  for (const item of pluginResult.failed) {
    this.warn(`Failed to install plugin ${item.id}: ${item.error}`);
  }
}
```

### Imports needed

```typescript
import { claudePluginInstall } from "../../utils/exec.js";
import { getErrorMessage } from "../../utils/errors.js";
import type { SkillId } from "../../types/index.js";
import type { SkillConfig } from "../../types/config.js";
```

---

## Operation: uninstallPluginSkills (Phase 2)

### File

`src/cli/lib/operations/uninstall-plugin-skills.ts`

### Extracts from

- `edit.tsx:387-397` — per-skill claudePluginUninstall for removed skills

### Function signature

```typescript
// NOTE: All imports for this operation are consolidated in the "Imports needed" section below.

export type PluginUninstallResult = {
  uninstalled: SkillId[];
  failed: Array<{ id: SkillId; error: string }>;
};

/**
 * Uninstalls skill plugins via the Claude CLI, using scope from old config.
 *
 * @param skillIds - Skill IDs to uninstall
 * @param oldSkills - Previous skill configs (for scope lookup)
 * @param projectDir - Project directory for plugin uninstallation
 */
export async function uninstallPluginSkills(
  skillIds: SkillId[],
  oldSkills: SkillConfig[],
  projectDir: string,
): Promise<PluginUninstallResult>;
```

### Implementation outline

```
1. For each skillId:
   a. Find old config: oldSkills.find(s => s.id === skillId)
   b. pluginScope = oldSkill?.scope === "global" ? "user" : "project"
   c. Try: await claudePluginUninstall(skillId, pluginScope, projectDir)
      - Push to uninstalled
   d. Catch: Push to failed: { id: skillId, error: getErrorMessage(error) }
2. Return { uninstalled, failed }
```

### Call sites (before -> after)

**edit.tsx:387-397** (inside `if (sourceResult.marketplace)` guard at line 364)

```typescript
// BEFORE:
// Note: this block is inside `if (sourceResult.marketplace) {` (line 364)
for (const skillId of removedSkills) {
  const oldSkill = projectConfig?.config?.skills?.find(s => s.id === skillId);
  const pluginScope = oldSkill?.scope === "global" ? "user" : "project";
  this.log(`Uninstalling plugin: ${skillId}...`);
  try {
    await claudePluginUninstall(skillId, pluginScope, cwd);
  } catch (error) { ... }
}

// AFTER:
if (removedSkills.length > 0 && sourceResult.marketplace) {
  const uninstallResult = await uninstallPluginSkills(
    removedSkills,
    projectConfig?.config?.skills ?? [],  // NOTE: after detectProject refactor, this becomes projectConfig?.skills ?? []
    cwd,
  );
  for (const item of uninstallResult.failed) {
    this.warn(`Failed to uninstall plugin ${item.id}: ${item.error}`);
  }
}
```

### Imports needed

```typescript
import { claudePluginUninstall } from "../../utils/exec.js";
import { getErrorMessage } from "../../utils/errors.js";
import type { SkillId } from "../../types/index.js";
import type { SkillConfig } from "../../types/config.js";
```

---

## Operation: compareSkillsWithSource (Phase 2)

### File

`src/cli/lib/operations/compare-skills.ts`

### Extracts from

- `outdated.ts:73-126` — hasProject/hasGlobal checks + buildSourceSkillsMap + compareLocalSkillsWithSource for both scopes + merge
- `update.tsx:146-193` — identical pattern with hasProject/hasGlobal checks + skillBaseDir tracking
- `diff.ts:193-199` — builds sourceSkills map inline (NOTE: diff does NOT use this operation — it uses its own diffSkill comparison. Listed here only for the shared sourceSkills map pattern)

### Function signature

```typescript
// NOTE: All imports for this operation are consolidated in the "Imports needed" section below.

export type SkillComparisonResults = {
  projectResults: SkillComparisonResult[];
  globalResults: SkillComparisonResult[];
  /** Merged results with project taking precedence over global. */
  merged: SkillComparisonResult[];
};

/**
 * Compares local skills (project + global scope) against their source versions.
 *
 * Builds a source skills map from the matrix (excluding local-only skills),
 * runs compareLocalSkillsWithSource for both project and global scopes,
 * and merges results with project taking precedence.
 */
export async function compareSkillsWithSource(
  projectDir: string,
  sourcePath: string,
  matrix: MergedSkillsMatrix,
): Promise<SkillComparisonResults>;
```

### Implementation outline

```
1. Build sourceSkills map from matrix:
   const sourceSkills: Record<string, { path: string }> = {};
   for (const [skillId, skill] of typedEntries(matrix.skills)) {
     if (!skill) continue;
     if (!skill.local) {
       sourceSkills[skillId] = { path: skill.path };
     }
   }
2. Determine paths:
   const homeDir = os.homedir();
   const projectLocalPath = path.join(projectDir, LOCAL_SKILLS_PATH);
   const globalLocalPath = path.join(homeDir, LOCAL_SKILLS_PATH);
   const hasProject = await fileExists(projectLocalPath);
   const hasGlobal = projectDir !== homeDir && await fileExists(globalLocalPath);
3. Run comparisons:
   projectResults = hasProject
     ? await compareLocalSkillsWithSource(projectDir, sourcePath, sourceSkills)
     : [];
   globalResults = hasGlobal
     ? await compareLocalSkillsWithSource(homeDir, sourcePath, sourceSkills)
     : [];
4. Merge with project precedence:
   const seenIds = new Set(projectResults.map(r => r.id));
   const merged = [...projectResults, ...globalResults.filter(r => !seenIds.has(r.id))];
5. Return { projectResults, globalResults, merged }
```

### Call sites (before -> after)

**outdated.ts:73-126** (hasProject/hasGlobal checks at 73-77, sourceSkills map at 108-114, compare+merge at 117-126)

```typescript
// BEFORE (lines 73-77 + 108-126):
const projectLocalPath = path.join(projectDir, LOCAL_SKILLS_PATH);
const homeDir = os.homedir();
const globalLocalPath = path.join(homeDir, LOCAL_SKILLS_PATH);
const hasProject = await fileExists(projectLocalPath);
const hasGlobal = projectDir !== homeDir && (await fileExists(globalLocalPath));
// ... (lines 79-107 are the early exit check + source loading) ...
const sourceSkills: Record<string, { path: string }> = {};
for (const [skillId, skill] of typedEntries(matrix.skills)) { ... }
const projectResults = hasProject ? await compareLocalSkillsWithSource(...) : [];
const globalResults = hasGlobal ? await compareLocalSkillsWithSource(...) : [];
const seenIds = new Set(projectResults.map(r => r.id));
const results = [...projectResults, ...globalResults.filter(r => !seenIds.has(r.id))];

// AFTER:
const { merged: results } = await compareSkillsWithSource(
  projectDir,
  sourceResult.sourcePath,
  sourceResult.matrix,
);
```

Note: outdated.ts still needs the "no local skills" early exit check (hasProject/hasGlobal). The operation returns empty merged array in that case, so the command can check `results.length === 0`.

**update.tsx:168-193** — same pattern plus skillBaseDir tracking

```typescript
// BEFORE: same sourceSkills + compare + merge pattern, plus:
const skillBaseDir = new Map<string, string>();
for (const r of projectResults) skillBaseDir.set(r.id, projectDir);
for (const r of globalResults) {
  if (!skillBaseDir.has(r.id)) skillBaseDir.set(r.id, homeDir);
}

// AFTER:
const comparison = await compareSkillsWithSource(
  projectDir,
  sourceResult.sourcePath,
  sourceResult.matrix,
);
const allResults = comparison.merged;
// Build skillBaseDir from separate results:
const skillBaseDir = new Map<string, string>();
for (const r of comparison.projectResults) skillBaseDir.set(r.id, projectDir);
for (const r of comparison.globalResults) {
  if (!skillBaseDir.has(r.id)) skillBaseDir.set(r.id, os.homedir());
}
```

**diff.ts:193-199** — builds sourceSkills map inline

```typescript
// BEFORE: builds sourceSkills from Object.entries(matrix.skills), then passes to diffSkill
// NOTE: diff.ts does NOT call compareLocalSkillsWithSource — it does its own per-skill diff.
// This operation does NOT replace diff.ts's logic. Diff uses a different comparison method.
// diff.ts should import buildSourceSkillsMap as a helper if desired, but the main
// operation is not a fit for diff's unified-diff approach.
```

### Imports needed

```typescript
import os from "os";
import path from "path";
import { compareLocalSkillsWithSource, type SkillComparisonResult } from "../skills/index.js";
import { fileExists } from "../../utils/fs.js";
import { LOCAL_SKILLS_PATH } from "../../consts.js";
import { typedEntries } from "../../utils/typed-object.js";
import type { MergedSkillsMatrix } from "../../types/index.js";
```

---

## Operation: ensureMarketplace (Phase 2)

### File

`src/cli/lib/operations/ensure-marketplace.ts`

### Extracts from

- `init.tsx:372-406` — lazy marketplace resolution + exists check + add/update
- `edit.tsx:364-371` — marketplace exists check + add

### Function signature

```typescript
// NOTE: All imports for this operation are consolidated in the "Imports needed" section below.
// Do NOT duplicate import statements between the signature and imports sections.

export type MarketplaceResult = {
  /** The resolved marketplace name, or null if no marketplace is configured. */
  marketplace: string | null;
  /** Whether a new marketplace was registered (vs. updated or already existed). */
  registered: boolean;
};

/**
 * Ensures the marketplace is registered with the Claude CLI.
 *
 * If the marketplace does not exist, registers it. If it exists, updates it.
 * Handles lazy marketplace name resolution when sourceResult.marketplace is undefined.
 *
 * Operation is intentionally SILENT — commands decide what to log based on the
 * `registered` flag. See G2 in Gotchas for why.
 *
 * @returns marketplace name + whether it was newly registered. Null marketplace
 *          means no marketplace is configured (e.g., local source without marketplace.json).
 */
export async function ensureMarketplace(sourceResult: SourceLoadResult): Promise<MarketplaceResult>;
```

### Implementation outline

```
1. If !sourceResult.marketplace:
   a. Try: fetch marketplace name from source
      const marketplaceResult = await fetchMarketplace(sourceResult.sourceConfig.source, {});
      sourceResult.marketplace = marketplaceResult.marketplace.name;
      // NOTE: This mutates the input object (matches current init.tsx behavior).
      // Callers rely on sourceResult.marketplace being set for subsequent plugin operations.
   b. Catch: return { marketplace: null, registered: false } (no marketplace available)
2. const marketplace = sourceResult.marketplace
3. const exists = await claudePluginMarketplaceExists(marketplace)
4. If !exists:
   a. const marketplaceSource = sourceResult.sourceConfig.source.replace(/^github:/, "")
   b. await claudePluginMarketplaceAdd(marketplaceSource)
   // NOTE: Operation is intentionally SILENT — no log/verbose output.
   // Commands decide what to log based on the returned `registered` flag.
   // See G2 in Gotchas: E2E tests assert on "Registering marketplace" text.
   c. registered = true
5. Else:
   a. Try: await claudePluginMarketplaceUpdate(marketplace)
   b. Catch: warn(`Could not update marketplace — continuing with cached version`)
   c. registered = false
6. Return { marketplace, registered }
```

### Call sites (before -> after)

**init.tsx:372-406**

```typescript
// BEFORE:
if (!sourceResult.marketplace) {
  try {
    const marketplaceResult = await fetchMarketplace(sourceResult.sourceConfig.source, {});
    sourceResult.marketplace = marketplaceResult.marketplace.name;
  } catch { ... fallback to local ... }
}
const marketplace = sourceResult.marketplace;
const marketplaceExists = await claudePluginMarketplaceExists(marketplace);
if (!marketplaceExists) { ... add ... } else { ... update ... }

// AFTER:
const mpResult = await ensureMarketplace(sourceResult);
if (!mpResult.marketplace) {
  this.warn("Could not resolve marketplace. Falling back to Local Mode...");
  await this.installLocalMode(result, sourceResult, flags, projectDir);
  return;
}
if (mpResult.registered) {
  this.log(`Registered marketplace: ${mpResult.marketplace}`);
}
```

**edit.tsx:364-371**

```typescript
// BEFORE:
if (sourceResult.marketplace) {
  const marketplaceExists = await claudePluginMarketplaceExists(sourceResult.marketplace);
  if (!marketplaceExists) { ... add ... }
  // ... install added skills ...
}

// AFTER:
if (sourceResult.marketplace) {
  const mpResult = await ensureMarketplace(sourceResult);
  if (mpResult.registered) {
    this.log(`Registered marketplace: ${mpResult.marketplace}`);
  }
  // ... install added skills using installPluginSkills ...
}
```

### Imports needed

```typescript
import {
  claudePluginMarketplaceExists,
  claudePluginMarketplaceAdd,
  claudePluginMarketplaceUpdate,
} from "../../utils/exec.js";
import { fetchMarketplace } from "../loading/index.js";
import { warn } from "../../utils/logger.js";
import type { SourceLoadResult } from "../loading/source-loader.js";
```

---

## Operation: writeProjectConfig (Phase 3)

### File

`src/cli/lib/operations/write-project-config.ts`

### Extracts from

- `local-installer.ts:492-558` — installPluginConfig (config generation + writing)
- `local-installer.ts:584-663` — installLocal (config generation + writing portion)
- `edit.tsx:452-488` — inline config build + write + writeScopedConfigs

### Function signature

```typescript
// NOTE: All imports for this operation are consolidated in the "Imports needed" section below.
// Do NOT duplicate import statements between the signature and imports sections.

export type ConfigWriteOptions = {
  wizardResult: WizardResultV2;
  sourceResult: SourceLoadResult;
  projectDir: string;
  sourceFlag?: string;
  /** Pre-loaded agent definitions. If omitted, loads from CLI + source. */
  agents?: Record<AgentName, AgentDefinition>;
};

export type ConfigWriteResult = {
  config: ProjectConfig;
  configPath: string;
  globalConfigPath?: string;
  wasMerged: boolean;
  existingConfigPath?: string;
  filesWritten: number;
};

/**
 * Builds, merges, and writes project configuration files.
 *
 * Handles the full config pipeline:
 * 1. buildAndMergeConfig() — generates config from wizard result, merges with existing
 * 2. loadAllAgents() — loads agent definitions for config-types generation
 * 3. ensureBlankGlobalConfig() — ensures global config exists (when in project context)
 * 4. writeScopedConfigs() — writes config.ts and config-types.ts split by scope
 */
export async function writeProjectConfig(options: ConfigWriteOptions): Promise<ConfigWriteResult>;
```

### Implementation outline

```
1. const { wizardResult, sourceResult, projectDir, sourceFlag } = options
2. const projectPaths = resolveInstallPaths(projectDir, "project")
3. Ensure directories: await ensureDir(path.dirname(projectPaths.configPath))
4. Load agents (if not provided):
   // IMPORTANT: loadMergedAgents is a PRIVATE function in local-installer.ts — NOT exported.
   // Inline the logic directly:
   if (!options.agents) {
     const cliAgents = await loadAllAgents(PROJECT_ROOT);
     const sourceAgents = await loadAllAgents(sourceResult.sourcePath);
     agents = { ...cliAgents, ...sourceAgents };
   } else {
     agents = options.agents;
   }
5. const mergeResult = await buildAndMergeConfig(wizardResult, sourceResult, projectDir, sourceFlag)
6. const finalConfig = mergeResult.config
7. Determine project context:
   // NOTE: This value is passed as the `projectInstallationExists` parameter of writeScopedConfigs.
   // The parameter name differs from the variable name, but the semantics are equivalent during
   // init/edit: if we're in a project context, a project installation exists (or is being created).
   const isProjectContext = fs.realpathSync(projectDir) !== fs.realpathSync(os.homedir())
8. If isProjectContext: await ensureBlankGlobalConfig()
9. await writeScopedConfigs(
     finalConfig, sourceResult.matrix, agents, projectDir,
     projectPaths.configPath, isProjectContext)
10. Return {
      config: finalConfig,
      configPath: projectPaths.configPath,
      wasMerged: mergeResult.merged,
      existingConfigPath: mergeResult.existingConfigPath,
      filesWritten: isProjectContext ? 4 : 2, // (config.ts + config-types.ts) x (global + project)
    }
```

### Call sites (before -> after)

**edit.tsx:452-488**

```typescript
// BEFORE:
const mergeResult = await buildAndMergeConfig(result, sourceResult, cwd, flags.source);
const cliAgents = await loadAllAgents(PROJECT_ROOT);
const sourceAgents = await loadAllAgents(sourcePath);
const agents = { ...cliAgents, ...sourceAgents };
if (cwd !== os.homedir()) { await ensureBlankGlobalConfig(); }
const configPath = path.join(cwd, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
const projectInstallationExists = ...
await writeScopedConfigs(mergeResult.config, sourceResult.matrix, agents, cwd, configPath, projectInstallationExists);

// AFTER:
const configResult = await writeProjectConfig({
  wizardResult: result,
  sourceResult,
  projectDir: cwd,
  sourceFlag: flags.source,
  agents, // already loaded via loadAgentDefs
});
```

**init.tsx (via installPluginConfig/installLocal)** — these proto-operations already contain writeProjectConfig logic internally. In Phase 4, `executeInstallation` will compose `writeProjectConfig` directly.

### Imports needed

```typescript
import fs from "fs";
import os from "os";
import path from "path";
import {
  buildAndMergeConfig,
  writeScopedConfigs,
  resolveInstallPaths,
} from "../installation/index.js";
import { loadAllAgents, type SourceLoadResult } from "../loading/index.js";
import { ensureBlankGlobalConfig } from "../configuration/config-writer.js";
import { ensureDir } from "../../utils/fs.js";
import { PROJECT_ROOT } from "../../consts.js";
import type {
  ProjectConfig,
  AgentDefinition,
  AgentName,
  MergedSkillsMatrix,
} from "../../types/index.js";
import type { WizardResultV2 } from "../../components/wizard/wizard.js";
```

---

## Operation: compileAgents (Phase 3)

### File

`src/cli/lib/operations/compile-agents.ts`

### Extracts from

- `agent-recompiler.ts:157-231` — recompileAgents (the main function this wraps)
- `compile.ts:241-318` — runCompilePass (skill discovery + recompile per scope)
- `edit.tsx:490-524` — recompileAgents call with scope map and outputDir

### Function signature

```typescript
// NOTE: All imports for this operation are consolidated in the "Imports needed" section below.

export type CompileAgentsOptions = {
  projectDir: string;
  sourcePath: string;
  pluginDir?: string;
  skills?: SkillDefinitionMap;
  agentScopeMap?: Map<AgentName, "project" | "global">;
  agents?: AgentName[];
  /** When set, loads config and filters agents to only those matching this scope. */
  scopeFilter?: "project" | "global";
  outputDir?: string;
  installMode?: InstallMode;
};

export type CompilationResult = {
  compiled: AgentName[];
  failed: AgentName[];
  warnings: string[];
};

/**
 * Compiles agent markdown files from templates + skill content.
 *
 * Thin wrapper around recompileAgents() that standardizes options.
 * The caller invokes this once (edit, update) or twice with scopeFilter (compile).
 */
export async function compileAgents(options: CompileAgentsOptions): Promise<CompilationResult>;
```

### Implementation outline

```
1. If scopeFilter is set, resolve it to an agents list:
   a. const loadedConfig = await loadProjectConfigFromDir(projectDir)
      // IMPORTANT: loadProjectConfigFromDir returns LoadedProjectConfig | null
      // which has shape { config: ProjectConfig, configPath: string }.
      // You MUST access loadedConfig?.config?.agents, NOT loadedConfig?.agents.
   b. const filteredAgents = loadedConfig?.config?.agents
        ?.filter(a => a.scope === scopeFilter)
        .map(a => a.name)
   c. Merge with any explicit agents filter (intersection if both set)
2. Map CompileAgentsOptions to RecompileAgentsOptions:
   {
     pluginDir: options.pluginDir ?? options.projectDir,
     sourcePath: options.sourcePath,
     agents: resolvedAgents,  // from step 1, or options.agents if no scopeFilter
     skills: options.skills,
     projectDir: options.projectDir,
     outputDir: options.outputDir,
     installMode: options.installMode,
     agentScopeMap: options.agentScopeMap,
   }
3. Call recompileAgents(recompileOptions)
4. Return { compiled, failed, warnings } from result
```

Note: This is intentionally a thin wrapper. The value is in the standardized options type
and the fact that all commands import from `operations/` rather than reaching into `lib/agents/`.

**scopeFilter handling:** `RecompileAgentsOptions` does not have a `scopeFilter` parameter.
The compile command (lines 275-278) resolves scopeFilter to an `agents` list by filtering
`config.agents` to those matching the scope. `compileAgents` must do this same resolution
when `scopeFilter` is set. This requires loading the project config internally.

**projectConfig removal:** The `projectConfig` field in `CompileAgentsOptions` is not forwarded
to `recompileAgents` (which loads config internally). Consider removing it from the type to
avoid confusion. If a future optimization passes pre-loaded config to avoid double-loading,
add it then — not now.

### Call sites (before -> after)

**edit.tsx:490-524**

```typescript
// BEFORE:
const recompileSkills = await discoverAllPluginSkills(cwd);
const agentScopeMap = new Map(result.agentConfigs.map((a) => [a.name, a.scope] as const));
const outputDir = path.join(cwd, CLAUDE_DIR, "agents");
const recompileResult = await recompileAgents({
  pluginDir: cwd,
  sourcePath,
  skills: recompileSkills,
  projectDir: cwd,
  outputDir,
  installMode: deriveInstallMode(result.skills),
  agentScopeMap,
});

// AFTER:
// NOTE: skills param is omitted — recompileAgents will auto-discover via
// discoverAllPluginSkills(projectDir), which is the same behavior as the "before" code.
// The explicit discoverAllPluginSkills(cwd) call is no longer needed.
const agentScopeMap = new Map(result.agentConfigs.map((a) => [a.name, a.scope] as const));
const compilationResult = await compileAgents({
  projectDir: cwd,
  sourcePath,
  pluginDir: cwd,
  outputDir: path.join(cwd, CLAUDE_DIR, "agents"),
  installMode: deriveInstallMode(result.skills),
  agentScopeMap,
});
```

**compile.ts runCompilePass** — calls recompileAgents with scopeFilter

```typescript
// BEFORE:
const recompileResult = await recompileAgents({
  pluginDir: projectDir,
  sourcePath: agentDefs.sourcePath,
  skills: allSkills,
  projectDir,
  outputDir: installation.agentsDir,
  agentScopeMap,
  agents: filteredAgents,
});

// AFTER:
const compilationResult = await compileAgents({
  projectDir,
  sourcePath: agentDefs.sourcePath,
  skills: allSkills,
  outputDir: installation.agentsDir,
  agentScopeMap,
  agents: filteredAgents,
});
```

### Imports needed

```typescript
import { recompileAgents, type RecompileAgentsResult } from "../agents/index.js";
import { loadProjectConfigFromDir } from "../configuration/index.js";
import type { AgentName, SkillDefinitionMap } from "../../types/index.js";
import type { InstallMode } from "../installation/index.js";
```

---

## Operation: executeInstallation (Phase 4)

### File

`src/cli/lib/operations/execute-installation.ts`

### Extracts from

- `init.tsx:288-364` — `handleInstallation` (mode detection + branching)
- `init.tsx:366-465` — `installIndividualPlugins` (marketplace + plugin install + installPluginConfig)
- `init.tsx:467-523` — `installLocalMode` (installLocal wrapper with logging)
- `local-installer.ts:492-558` — installPluginConfig
- `local-installer.ts:584-663` — installLocal

### Function signature

```typescript
// NOTE: All imports for this operation are consolidated in the "Imports needed" section below.

export type ExecuteInstallationOptions = {
  wizardResult: WizardResultV2;
  sourceResult: SourceLoadResult;
  projectDir: string;
  sourceFlag?: string;
};

export type ExecuteInstallationResult = {
  mode: InstallMode;
  copiedSkills: CopiedSkill[];
  config: ProjectConfig;
  configPath: string;
  compiledAgents: AgentName[];
  wasMerged: boolean;
  mergedConfigPath?: string;
  skillsDir?: string;
  agentsDir: string;
};

/**
 * Executes the full installation pipeline for init command.
 *
 * Derives install mode from wizard selections and branches:
 * - local: copyLocalSkills -> writeProjectConfig -> compileAgents (via installLocal)
 * - plugin: ensureMarketplace -> installPluginSkills -> writeProjectConfig -> compileAgents (via installPluginConfig)
 * - mixed: copyLocalSkills -> ensureMarketplace -> installPluginSkills -> writeProjectConfig -> compileAgents
 *
 * Keeps installLocal() and installPluginConfig() as lower-level composed functions.
 */
export async function executeInstallation(
  options: ExecuteInstallationOptions,
): Promise<ExecuteInstallationResult>;
```

### Implementation outline

```
1. const installMode = deriveInstallMode(options.wizardResult.skills)
2. Branch on mode:

   "local":
     a. result = await installLocal(options)
     b. Return mapped result with mode: "local"

   "plugin":
     a. marketplace = await ensureMarketplace(options.sourceResult)
     b. If !marketplace: fall through to local mode
     c. pluginResult = await installPluginSkills(
          options.wizardResult.skills, marketplace, options.projectDir)
     d. configResult = await installPluginConfig(options)
     e. Return mapped result with mode: "plugin"

   "mixed":
     a. localSkills = skills.filter(s => s.source === "local")
     b. copyResult = await copyLocalSkills(localSkills, projectDir, sourceResult)
     c. marketplace = await ensureMarketplace(sourceResult)
     d. If !marketplace: fall through to installLocal
     e. pluginResult = await installPluginSkills(
          skills.filter(s => s.source !== "local"), marketplace, projectDir)
     f. configResult = await installPluginConfig(options)
     g. Return mapped result with mode: "mixed", copiedSkills from copyResult
```

### Call sites (before -> after)

**init.tsx:288-523** — three private methods: handleInstallation (288-364), installIndividualPlugins (366-465), installLocalMode (467-523)

```typescript
// BEFORE: ~236 lines across 3 private methods

// AFTER (REVISED per G9 — use individual operations with per-step logging):
// DO NOT use a single executeInstallation() call — E2E tests assert on intermediate
// messages like "Installing skill plugins...", "Installed X@Y", "Registering marketplace".
// Instead, compose individual operations with logging between each:
const installMode = deriveInstallMode(result.skills);
this.log(
  `Install mode: ${installMode === "plugin" ? "Plugin (native install)" : installMode === "mixed" ? `Mixed (${localSkills.length} local, ${pluginSkills.length} plugin)` : "Local (copy to .claude/skills/)"}`,
);
// where localSkills = result.skills.filter(s => s.source === "local")
// and pluginSkills = result.skills.filter(s => s.source !== "local")

// Step 1: Copy local skills (for local or mixed modes)
if (installMode !== "plugin") {
  const localSkills = result.skills.filter((s) => s.source === "local");
  const copyResult = await copyLocalSkills(localSkills, projectDir, sourceResult);
  this.log(`Copied ${copyResult.totalCopied} local skills...`);
}

// Step 2: Marketplace registration (for plugin or mixed modes)
if (installMode !== "local") {
  const mpResult = await ensureMarketplace(sourceResult);
  if (!mpResult.marketplace) {
    this.warn("Could not resolve marketplace. Falling back to Local Mode...");
    // ... fall back to local mode ...
  } else {
    if (mpResult.registered) {
      this.log(`Registering marketplace "${mpResult.marketplace}"...`); // E2E tests assert on this
    }
    this.log("Installing skill plugins...");
    const pluginResult = await installPluginSkills(
      result.skills.filter((s) => s.source !== "local"),
      mpResult.marketplace,
      projectDir,
    );
    for (const item of pluginResult.installed) {
      this.log(`  Installed ${item.ref}`); // E2E tests assert on this
    }
  }
}

// Step 3: Write config (all modes)
this.log("Generating configuration...");
const configResult = await writeProjectConfig({
  wizardResult: result,
  sourceResult,
  projectDir,
  sourceFlag: flags.source,
});

// Step 4: Report success
this.log(SUCCESS_MESSAGES.INIT_SUCCESS);
// ... etc
```

**NOTE:** `executeInstallation` is still created as a convenience for programmatic callers
but is NOT used by init.tsx in Phase 4 due to E2E logging requirements.

### Imports needed

```typescript
import {
  installLocal,
  installPluginConfig,
  deriveInstallMode,
  type InstallMode,
} from "../installation/index.js";
import { copyLocalSkills } from "./copy-local-skills.js";
import { ensureMarketplace } from "./ensure-marketplace.js";
import { installPluginSkills } from "./install-plugin-skills.js";
import type { WizardResultV2 } from "../../components/wizard/wizard.js";
import type { SourceLoadResult } from "../loading/source-loader.js";
import type { ProjectConfig, AgentName } from "../../types/index.js";
import type { CopiedSkill } from "../skills/skill-copier.js";
```

---

## Operation: recompileProject (Phase 4)

### File

`src/cli/lib/operations/recompile-project.ts`

### Extracts from

- `compile.ts:129-187` — the run() method's dual-scope detection + compile passes

### Function signature

```typescript
// NOTE: All imports for this operation are consolidated in the "Imports needed" section below.

export type RecompileProjectOptions = {
  projectDir: string;
  sourceFlag?: string;
  agentSource?: string;
  verbose?: boolean;
};

export type RecompileProjectResult = {
  globalCompiled: AgentName[];
  projectCompiled: AgentName[];
  totalCompiled: number;
  warnings: string[];
};

/**
 * Recompiles all agents for a project (global + project scopes).
 *
 * Detects global and project installations, loads agent definitions,
 * and runs compilation passes for each scope. This is the main
 * entry point for the `compile` command.
 */
export async function recompileProject(
  options: RecompileProjectOptions,
): Promise<RecompileProjectResult>;
```

### Implementation outline

```
1. const cwd = options.projectDir
2. If options.verbose: setVerbose(true) from utils/logger.js
3. Resolve source: await resolveSource(options.sourceFlag, cwd) (matches compile.ts:320-328)
4. Detect installations:
   globalInstallation = await detectGlobalInstallation()
   projectInstallation = cwd === os.homedir() ? null : await detectProjectInstallation(cwd)
5. If neither: throw error (ERROR_MESSAGES.NO_INSTALLATION)
6. Load agent defs: const defs = await loadAgentDefs(options.agentSource, { projectDir: cwd })
7. Determine hasBothScopes = !!globalInstallation && !!projectInstallation
8. If globalInstallation:
   a. Discover all skills for homedir via discoverAllSkills(os.homedir()):
      - globalPluginSkills = {} (skip when projectDir is homedir, which it is)
      - globalLocalSkills = {} (skip when projectDir is homedir)
      - pluginSkills = await discoverAllPluginSkills(os.homedir())
      - localSkills = await discoverLocalProjectSkills(os.homedir())
      - allSkills = mergeSkills(pluginSkills, localSkills)
   b. Load config: loadProjectConfigFromDir(os.homedir()) for agentScopeMap
   c. Filter agents by scope if hasBothScopes
   d. globalResult = await compileAgents({
        projectDir: os.homedir(),
        sourcePath: defs.agentSourcePaths.sourcePath,
        skills: allSkills,
        outputDir: globalInstallation.agentsDir,
        agentScopeMap,
        agents: filteredAgents,
      })
9. If projectInstallation:
   a. Discover all skills for cwd via discoverAllSkills(cwd):
      - globalPluginSkills = await discoverAllPluginSkills(os.homedir())
      - globalLocalSkills = await loadSkillsFromDir(~/.claude/skills/)
      - pluginSkills = await discoverAllPluginSkills(cwd)
      - localSkills = await discoverLocalProjectSkills(cwd)
      - allSkills = mergeSkills(globalPluginSkills, globalLocalSkills, pluginSkills, localSkills)
   b. Load config: loadProjectConfigFromDir(cwd) for agentScopeMap
   c. Filter agents by scope if hasBothScopes
   d. projectResult = await compileAgents({
        projectDir: cwd,
        sourcePath: defs.agentSourcePaths.sourcePath,
        skills: allSkills,
        outputDir: projectInstallation.agentsDir,
        agentScopeMap,
        agents: filteredAgents,
      })
10. Return merged result
```

### Note

This operation absorbs compile.ts's `runCompilePass`, `discoverAllSkills`, `resolveSourceForCompile`, and `loadAgentDefsForCompile` methods. Since compile.ts has 352 lines of which most is orchestration, this is the highest-reduction operation.

**CRITICAL: 4-way skill discovery.** The `discoverAllSkills` method in compile.ts (lines 189-239) does a 4-way merge:

1. Global plugins — `discoverAllPluginSkills(os.homedir())` (skipped when projectDir is homedir)
2. Global local — `loadSkillsFromDir(~/.claude/skills/)` (skipped when projectDir is homedir)
3. Project plugins — `discoverAllPluginSkills(projectDir)`
4. Project local — `discoverLocalProjectSkills(projectDir)`

These are merged with "later sources win" semantics (`mergeSkills()`), plus verbose logging.
`recompileProject` MUST absorb this logic — the operation cannot just delegate to `recompileAgents`
auto-discovery, which only calls `discoverAllPluginSkills(projectDir)` (misses global skills and
local skills). The outline steps 8a and 9a above contain the full 4-way discovery algorithm.

**Implementation approach:** Extract `discoverAllSkills` as an internal helper inside
`recompile-project.ts` (or into a shared helper in `lib/plugins/`). Each compile pass calls
it with the appropriate `projectDir`. The helper calls `discoverAllPluginSkills` +
`loadSkillsFromDir` + `discoverLocalProjectSkills` and merges them. The `compileAgents` operation
receives the discovered skills via the `skills` parameter.

Note that `loadSkillsFromDir` and `discoverLocalProjectSkills` are currently private functions
defined at the top of compile.ts (lines 24-78). These must either be:

- Moved to `recompile-project.ts` (co-located with the operation), or
- Extracted to `lib/plugins/` or `lib/skills/` and exported (preferred if other operations need them)

### Call sites (before -> after)

**compile.ts:129-352** — the entire `run()` method body + 4 private methods (discoverAllSkills:189-239, runCompilePass:241-318, resolveSourceForCompile:320-329, loadAgentDefsForCompile:331-351)

```typescript
// BEFORE: ~224 lines across run() + 4 private methods

// AFTER (REVISED per G8 — keep runCompilePass, replace only inner calls):
// DO NOT replace the entire run() body with recompileProject().
// 7 E2E tests assert on per-scope messages like "Compiling global agents..."
// which come from runCompilePass. Instead, keep compile.ts structure intact
// and replace individual calls:
//
// 1. Replace loadAgentDefsForCompile() with loadAgentDefs():
const defs = await loadAgentDefs(flags["agent-source"], { projectDir: cwd });
//
// 2. Keep discoverAllSkills() as-is (contains user-facing skill count messages)
//
// 3. Inside runCompilePass, replace recompileAgents() with compileAgents():
const compilationResult = await compileAgents({
  projectDir,
  sourcePath: defs.agentSourcePaths.sourcePath,
  skills: allSkills,
  outputDir: installation.agentsDir,
  agentScopeMap,
  agents: filteredAgents,
});
//
// This preserves ALL user-facing messages while using the operations layer.
// recompileProject is created in Phase 4 for programmatic use but NOT
// wired into compile.ts until E2E tests are updated to use flexible assertions.
```

### Imports needed

```typescript
import os from "os";
import path from "path";
import {
  detectGlobalInstallation,
  detectProjectInstallation,
  buildAgentScopeMap,
} from "../installation/index.js";
import { resolveSource, loadProjectConfigFromDir } from "../configuration/index.js";
import { loadAgentDefs } from "./load-agent-defs.js";
import { compileAgents } from "./compile-agents.js";
import { discoverAllPluginSkills } from "../plugins/index.js";
import { setVerbose, verbose } from "../../utils/logger.js";
import { ERROR_MESSAGES } from "../../utils/messages.js";
import { GLOBAL_INSTALL_ROOT, LOCAL_SKILLS_PATH } from "../../consts.js";
import { typedKeys } from "../../utils/typed-object.js";
import type { AgentName, SkillDefinitionMap, SkillId } from "../../types/index.js";
// NOTE: loadSkillsFromDir and discoverLocalProjectSkills must be either:
// - Moved from compile.ts to a shared location (e.g., lib/skills/), or
// - Copied into this file as private helpers
```

---

## Types File (Phase 1, updated each phase)

### File: `src/cli/lib/operations/types.ts`

```typescript
// Re-export operation-specific types for convenience.
// Shared types (SkillConfig, ProjectConfig, etc.) stay in their original locations.

export type { LoadSourceOptions, LoadedSource } from "./load-source.js";
export type { DetectedProject } from "./detect-project.js";
export type { SkillCopyResult } from "./copy-local-skills.js";
export type { PluginInstallResult } from "./install-plugin-skills.js";
export type { PluginUninstallResult } from "./uninstall-plugin-skills.js";
export type { SkillComparisonResults } from "./compare-skills.js";
export type { MarketplaceResult } from "./ensure-marketplace.js";
export type { ConfigWriteOptions, ConfigWriteResult } from "./write-project-config.js";
export type { CompileAgentsOptions, CompilationResult } from "./compile-agents.js";
export type {
  ExecuteInstallationOptions,
  ExecuteInstallationResult,
} from "./execute-installation.js";
export type { RecompileProjectOptions, RecompileProjectResult } from "./recompile-project.js";
export type { AgentDefs } from "./load-agent-defs.js";
```

---

## Barrel Export (Phase 1, updated each phase)

### File: `src/cli/lib/operations/index.ts`

```typescript
// Operations — composable building blocks for CLI commands.
// Each operation wraps lower-level lib functions into a single typed call.

export { loadSource, type LoadSourceOptions, type LoadedSource } from "./load-source.js";
export { detectProject, type DetectedProject } from "./detect-project.js";
export { loadAgentDefs, type AgentDefs } from "./load-agent-defs.js";
export { copyLocalSkills, type SkillCopyResult } from "./copy-local-skills.js";
export { installPluginSkills, type PluginInstallResult } from "./install-plugin-skills.js";
export { uninstallPluginSkills, type PluginUninstallResult } from "./uninstall-plugin-skills.js";
export { compareSkillsWithSource, type SkillComparisonResults } from "./compare-skills.js";
export { ensureMarketplace, type MarketplaceResult } from "./ensure-marketplace.js";
export {
  writeProjectConfig,
  type ConfigWriteOptions,
  type ConfigWriteResult,
} from "./write-project-config.js";
export {
  compileAgents,
  type CompileAgentsOptions,
  type CompilationResult,
} from "./compile-agents.js";
export {
  executeInstallation,
  type ExecuteInstallationOptions,
  type ExecuteInstallationResult,
} from "./execute-installation.js";
export {
  recompileProject,
  type RecompileProjectOptions,
  type RecompileProjectResult,
} from "./recompile-project.js";
```

---

## Test Disable List

Operations are additive (new files). Existing tests should NOT break during Phases 1-3 because:

- Operations wrap existing lib functions — they don't modify them
- Commands are only refactored in Phase 4

**Phase 4 may break these unit tests** (if they mock command internals or test command methods directly):

| Test File                                                        | Risk | Why                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/__tests__/commands/init.test.ts`                            | LOW  | Tests `runCliCommand()` + dashboard helpers, not internals                                                                                                                                                                                  |
| `lib/__tests__/commands/edit.test.ts`                            | HIGH | Mocks `detectInstallation`, `loadSkillsMatrixFromSource`, `discoverAllPluginSkills`, `copySkillsToLocalFlattened` directly — import paths won't change (operations are additive) but command code restructuring may break mock expectations |
| `lib/__tests__/commands/compile.test.ts`                         | LOW  | Tests via `runCliCommand()`                                                                                                                                                                                                                 |
| `lib/__tests__/commands/diff.test.ts`                            | LOW  | Tests via `runCliCommand()`                                                                                                                                                                                                                 |
| `lib/__tests__/commands/outdated.test.ts`                        | LOW  | Tests via `runCliCommand()`                                                                                                                                                                                                                 |
| `lib/__tests__/commands/update.test.ts`                          | LOW  | Tests via `runCliCommand()`                                                                                                                                                                                                                 |
| `lib/__tests__/commands/doctor.test.ts`                          | LOW  | Tests via `runCliCommand()`                                                                                                                                                                                                                 |
| `lib/__tests__/commands/eject.test.ts`                           | LOW  | Tests via `runCliCommand()` (but uses 26k lines, may have indirect sensitivity)                                                                                                                                                             |
| `lib/__tests__/commands/search.test.ts`                          | LOW  | Tests via `runCliCommand()`                                                                                                                                                                                                                 |
| `lib/__tests__/user-journeys/edit-recompile.test.ts`             | LOW  | Imports `recompileAgents` directly from `lib/agents` — unchanged by operations                                                                                                                                                              |
| `lib/__tests__/user-journeys/compile-flow.test.ts`               | LOW  | Tests via `runCliCommand()`                                                                                                                                                                                                                 |
| `lib/__tests__/integration/installation.test.ts`                 | NONE | Tests `detectInstallation` directly, unchanged                                                                                                                                                                                              |
| `lib/__tests__/integration/wizard-init-compile-pipeline.test.ts` | LOW  | Imports `installLocal`, `recompileAgents` directly — unchanged (operations wrap, don't replace)                                                                                                                                             |
| `lib/__tests__/integration/init-flow.integration.test.ts`        | LOW  | Imports `installLocal`, `deriveInstallMode` directly — unchanged                                                                                                                                                                            |
| `lib/__tests__/integration/init-end-to-end.integration.test.ts`  | LOW  | Imports `installLocal`, `installPluginConfig` directly — unchanged                                                                                                                                                                          |
| `lib/__tests__/commands/info.test.ts`                            | LOW  | Tests via `runCliCommand()` — info.ts only gets `loadSource` substitution                                                                                                                                                                   |
| `lib/__tests__/integration/source-switching.integration.test.ts` | NONE | Imports `installLocal` directly from `../../installation/local-installer` — unchanged                                                                                                                                                       |
| `lib/__tests__/user-journeys/user-journeys.integration.test.ts`  | NONE | Imports `installLocal` and `recompileAgents` directly — unchanged (operations wrap, don't replace)                                                                                                                                          |
| `lib/__tests__/user-journeys/install-compile.test.ts`            | NONE | Does not import any functions being replaced                                                                                                                                                                                                |

**Why edit.test.ts is HIGH risk:** It mocks 6 modules via `vi.mock()` (installation, loading, configuration, plugins, skills, fs). While the mock target import paths won't change (operations import from lib, not the reverse), the command's internal logic changes. For example, `detectInstallation` may no longer be called directly if the command uses `detectProject()` — but the mock is on `../../installation/index.js` which `detectProject` also imports from. The mock should still work via transitive mocking, BUT the command may call functions in a different order or with different arguments, causing assertion failures.

**Recommendation:** During Phase 4, if `edit.test.ts` breaks (HIGH risk), temporarily add `describe.skip` to its top-level describe block while refactoring. Re-enable after updating mocks.

---

## E2E Verification Commands

Run after each phase to ensure nothing broke:

### After Phase 1 (Foundation)

```bash
# Unit tests (should all pass — operations are additive)
npm test -- --run

# E2E sanity check (init + compile are the most exercised commands)
npx vitest run e2e/commands/compile.e2e.test.ts
npx vitest run e2e/interactive/init-wizard-default-source.e2e.test.ts
```

### After Phase 2 (Skill Operations)

```bash
npm test -- --run

# E2E: diff/outdated/update exercise comparison operations
npx vitest run e2e/commands/compile.e2e.test.ts
npx vitest run e2e/interactive/init-wizard-default-source.e2e.test.ts
```

### After Phase 3 (Config + Compilation)

```bash
npm test -- --run

# Full compile E2E suite
npx vitest run e2e/commands/compile.e2e.test.ts
npx vitest run e2e/commands/compile-edge-cases.e2e.test.ts
npx vitest run e2e/commands/compile-scope-filtering.e2e.test.ts
```

### After Phase 4 (Full Command Refactor) -- CRITICAL GATE

```bash
# Full unit test suite
npm test -- --run

# Full E2E suite (all 65 tests)
npx vitest run e2e/

# Type check
npx tsc --noEmit
```

### After Phase 5 (Cleanup + Operation Unit Tests)

```bash
# Everything green
npm test -- --run
npx vitest run e2e/
npx tsc --noEmit
```

---

## Detailed Phase Execution

### Phase 1: Foundation Operations

**Create these files in order:**

1. `src/cli/lib/operations/types.ts` — empty initially, add types as operations are created
2. `src/cli/lib/operations/load-source.ts` — see operation spec above
3. `src/cli/lib/operations/detect-project.ts` — see operation spec above
4. `src/cli/lib/operations/load-agent-defs.ts` — see operation spec above
5. `src/cli/lib/operations/index.ts` — barrel with Phase 1 exports only

**Wire into commands (proof of concept only -- replace ONE call site per operation):**

- `init.tsx`: Replace lines 235-253 with `loadSource()` call
- `edit.tsx`: Replace lines 95-106,129 with `detectProject()` call. **Also update ~12 `projectConfig?.config?.X` references to `projectConfig?.X`** (see WARNING in detectProject call site section).
- `compile.ts`: Replace `loadAgentDefsForCompile` with `loadAgentDefs()` call

**Gate:** `npm test -- --run` and `npx vitest run e2e/commands/compile.e2e.test.ts`

### Phase 2: Skill Operations

**Create these files:**

1. `src/cli/lib/operations/copy-local-skills.ts`
2. `src/cli/lib/operations/install-plugin-skills.ts`
3. `src/cli/lib/operations/uninstall-plugin-skills.ts`
4. `src/cli/lib/operations/ensure-marketplace.ts`
5. `src/cli/lib/operations/compare-skills.ts`
6. Update `index.ts` and `types.ts` with Phase 2 exports

**Wire into commands:**

- `init.tsx`: Replace mixed-mode copy block (316-356) with `copyLocalSkills()`
- `edit.tsx`: Replace added-local copy block (400-433) with `copyLocalSkills()`
- `edit.tsx`: Replace marketplace check (364-371) with `ensureMarketplace()`
- `outdated.ts`: Replace comparison block (73-126) with `compareSkillsWithSource()`
- `update.tsx`: Replace comparison block (168-193) with `compareSkillsWithSource()`

**Gate:** `npm test -- --run`

### Phase 3: Config + Compilation Operations

**Create these files:**

1. `src/cli/lib/operations/write-project-config.ts`
2. `src/cli/lib/operations/compile-agents.ts`
3. Update `index.ts` and `types.ts`

**Wire into commands:**

- `edit.tsx`: Replace config write block (452-488) with `writeProjectConfig()`
- `edit.tsx`: Replace recompile block (490-524) with `compileAgents()`
- `compile.ts`: Replace `recompileAgents()` calls in `runCompilePass()` with `compileAgents()`

**Gate:** `npm test -- --run` and `npx vitest run e2e/commands/compile.e2e.test.ts`

### Phase 4: Composed Pipelines + Full Command Refactor

**Create these files:**

1. `src/cli/lib/operations/execute-installation.ts`
2. `src/cli/lib/operations/recompile-project.ts`
3. Update `index.ts` and `types.ts`

**Refactor ALL commands:**

- `init.tsx`: Replace `handleInstallation` + `installIndividualPlugins` + `installLocalMode` with individual operation calls (`copyLocalSkills`, `ensureMarketplace`, `installPluginSkills`, `writeProjectConfig`), keeping per-step logging between each call. Do NOT use `executeInstallation()` — E2E tests assert on intermediate messages (see G9). Keep dashboard logic, wizard rendering, and user-facing log messages.
- `edit.tsx`: Compose from `detectProject()` + `loadSource()` + wizard + `uninstallPluginSkills()` + `ensureMarketplace()` + `installPluginSkills()` + `copyLocalSkills()` + `writeProjectConfig()` + `compileAgents()`. Keep diff calculation, migration logic, scope change handling, and user-facing log messages.
- `compile.ts`: Replace `loadAgentDefsForCompile` with `loadAgentDefs()` and `recompileAgents()` calls inside `runCompilePass` with `compileAgents()`. Keep `run()`, `runCompilePass`, `discoverAllSkills` intact — they contain user-facing log messages that 7 E2E tests assert on (see G8). `recompileProject` is created but NOT wired into compile.ts in this phase.
- `outdated.ts`: Compose from `detectProject()` + `loadSource()` + `compareSkillsWithSource()`. Keep formatting and output.
- `update.tsx`: Compose from `loadSource()` + `compareSkillsWithSource()` + user confirm + per-skill update + `compileAgents()`. Keep confirmation UI and output.
- `diff.ts`: Compose from `loadSource()` + per-skill diff logic (NOT compareSkillsWithSource -- diff uses its own comparison). Minimal change.
- `doctor.ts`: Replace `loadSkillsMatrixFromSource` call (inside `checkSourceReachable`) with `loadSource()`. Doctor does NOT use `detectInstallation`, so `detectProject` is NOT applicable. Replace `loadProjectConfig` with direct call (doctor loads config independently). Minimal change (~1 call site).
- `info.ts`: Replace `loadSkillsMatrixFromSource` call with `loadSource()`. Minimal change.
- `search.tsx`: Replace both `loadSkillsMatrixFromSource` calls (in `runInteractive` and `runStatic`) with `loadSource()`. Minimal change.
- `eject.ts`: Replace `loadSkillsMatrixFromSource` call with `loadSource()`. Minimal change (~1 call site).
- `uninstall.tsx`: Does NOT use any operation-layer functions (has its own `claudePluginUninstall` logic that operates on plugin names, not SkillIds). No change.

**Gate:** Full test suite + full E2E suite + tsc --noEmit

### Phase 5: Cleanup + Operation Unit Tests

**Cleanup:**

- Remove dead private methods from command classes:
  - `Init.handleInstallation`, `Init.installIndividualPlugins`, `Init.installLocalMode`
  - `Compile.loadAgentDefsForCompile` (replaced by `loadAgentDefs`)
  - NOTE (per G8): `Compile.discoverAllSkills`, `Compile.runCompilePass`, `Compile.resolveSourceForCompile`
    and top-level functions `loadSkillsFromDir`, `discoverLocalProjectSkills`, `mergeSkills` are KEPT
    in compile.ts — they contain user-facing log messages asserted by E2E tests. They may be
    moved to `recompile-project.ts` in a future phase after E2E test assertions are updated.
- Remove unused imports from command files
- Verify no unused exports in `lib/installation/index.ts` (keep all -- operations still use them)

**Operation unit tests (one .test.ts per operation, co-located):**

- `load-source.test.ts` — mock `loadSkillsMatrixFromSource`, test buffering on/off
- `detect-project.test.ts` — mock `detectInstallation` + `loadProjectConfig`
- `load-agent-defs.test.ts` — mock `getAgentDefinitions` + `loadAllAgents`
- `copy-local-skills.test.ts` — mock `copySkillsToLocalFlattened` + `ensureDir`, test scope split
- `install-plugin-skills.test.ts` — mock `claudePluginInstall`, test scope routing
- `uninstall-plugin-skills.test.ts` — mock `claudePluginUninstall`, test scope lookup
- `compare-skills.test.ts` — mock `compareLocalSkillsWithSource` + `fileExists`, test merge
- `ensure-marketplace.test.ts` — mock `claudePluginMarketplaceExists/Add/Update`
- `write-project-config.test.ts` — mock `buildAndMergeConfig` + `writeScopedConfigs`
- `compile-agents.test.ts` — mock `recompileAgents`, verify option mapping
- `execute-installation.test.ts` — mock `installLocal` + `installPluginConfig` + sub-operations
- `recompile-project.test.ts` — mock detection + `compileAgents`

**Gate:** Full test suite green (all existing + 12 new operation tests)

---

## Import Removal Checklist (Phase 4)

After refactoring commands, these imports should be removable from command files:

### init.tsx — remove:

- `enableBuffering`, `drainBuffer`, `disableBuffering` (handled by `loadSource`)
- `loadSkillsMatrixFromSource` (handled by `loadSource`)
- `resolveInstallPaths` (handled by `copyLocalSkills`)
- `copySkillsToLocalFlattened` (handled by `copyLocalSkills`)
- `ensureDir` (handled by operations)
- `claudePluginInstall`, `claudePluginMarketplaceExists`, `claudePluginMarketplaceAdd`, `claudePluginMarketplaceUpdate` (handled by `ensureMarketplace` + `installPluginSkills`)
- `fetchMarketplace` (handled by `ensureMarketplace`)
- `installLocal`, `installPluginConfig` (handled by `executeInstallation` / individual operations)
- NOTE: `deriveInstallMode` is KEPT — init.tsx calls it directly per G9 (individual operations, not executeInstallation)

### edit.tsx — remove:

- `enableBuffering`, `drainBuffer`, `disableBuffering`, `pushBufferMessage` (handled by `loadSource`)
- `loadSkillsMatrixFromSource` (handled by `loadSource`)
- `detectInstallation` (handled by `detectProject`)
- `loadProjectConfig` (handled by `detectProject`)
- `buildAndMergeConfig`, `writeScopedConfigs`, `resolveInstallPaths` (handled by `writeProjectConfig`)
- `loadAllAgents` (handled by `loadAgentDefs`)
- `getAgentDefinitions` (handled by `loadAgentDefs`)
- `recompileAgents` (handled by `compileAgents`)
- NOTE: `discoverAllPluginSkills` is KEPT — still used at line 133 for building `currentSkillIds` (wizard installed skills list). Only the recompilation call at line 492 is replaced by `compileAgents`.
- `copySkillsToLocalFlattened` (handled by `copyLocalSkills`)
- `claudePluginMarketplaceExists`, `claudePluginMarketplaceAdd` (handled by `ensureMarketplace`)
- NOTE: `claudePluginInstall` and `claudePluginUninstall` are KEPT — still used at lines 342-344 for plugin-mode scope migrations (P->G / G->P). The `installPluginSkills`/`uninstallPluginSkills` operations handle add/remove, NOT scope changes.
- `ensureBlankGlobalConfig` (handled by `writeProjectConfig`)
- `ensureDir` (handled by operations)

### compile.ts — remove:

- `recompileAgents` (replaced by `compileAgents`)
- `getAgentDefinitions` (replaced by `loadAgentDefs`)
  NOTE: Per G8, compile.ts keeps `run()`, `runCompilePass`, `discoverAllSkills`, `resolveSourceForCompile`
  intact. Only the inner `recompileAgents` and `getAgentDefinitions` calls are replaced.
  The following imports are KEPT (NOT removed):
- `discoverAllPluginSkills` (still used by `discoverAllSkills`)
- `resolveSource`, `loadProjectConfigFromDir` (still used by `resolveSourceForCompile` and `runCompilePass`)
- `parseFrontmatter` (still used by `loadSkillsFromDir`)
- Local functions `loadSkillsFromDir`, `discoverLocalProjectSkills`, `mergeSkills` (still used by `discoverAllSkills`)
- `detectGlobalInstallation`, `detectProjectInstallation`, `buildAgentScopeMap` (still used by `run()`)

### outdated.ts — remove:

- `loadSkillsMatrixFromSource` (handled by `loadSource`)
- `detectInstallation` (handled by `detectProject`)
- `compareLocalSkillsWithSource` (handled by `compareSkillsWithSource`)
- `typedEntries` (no longer needed for sourceSkills map building)

### update.tsx — remove:

- `loadSkillsMatrixFromSource` (handled by `loadSource`)
- `compareLocalSkillsWithSource` (handled by `compareSkillsWithSource`)
- `recompileAgents` (handled by `compileAgents`)
- `matrix` import from matrix-provider (comparison handled by operation)

### diff.ts — remove:

- `loadSkillsMatrixFromSource` (handled by `loadSource`)

### doctor.ts — remove:

- `loadSkillsMatrixFromSource` (handled by `loadSource`, inside `checkSourceReachable`)

### info.ts — remove:

- `loadSkillsMatrixFromSource` (handled by `loadSource`)

### search.tsx — remove:

- `loadSkillsMatrixFromSource` (handled by `loadSource`)

### eject.ts — remove:

- `loadSkillsMatrixFromSource` (handled by `loadSource`)

---

## Key Design Decisions for Implementors

1. **Operations are additive.** Create new files, don't modify existing lib/ files. Operations import from lib/ -- they don't replace lib/ functions.

2. **Commands keep their user-facing output.** Operations return data; commands decide what to log. Don't put `this.log()` calls in operations -- use `verbose()` from logger.ts for diagnostic messages only.

3. **Error handling stays in commands.** Operations throw errors; commands catch them via `try/catch` + `this.handleError()` or `this.error()`.

4. **Migration logic stays in lib/.** `detectMigrations()` and `executeMigration()` are domain logic in `lib/installation/mode-migrator.ts` -- operations don't wrap them.

5. **diff.ts uses its own comparison.** Don't force `compareSkillsWithSource` into diff.ts -- it uses `diffSkill()` which produces unified diffs, not hash comparisons. Only use `loadSource` for diff.ts.

6. **compile.ts keeps its structure.** Per G8, compile.ts keeps `run()`, `runCompilePass`, `discoverAllSkills`, and `resolveSourceForCompile` intact because 7 E2E tests assert on their user-facing log messages. Only replace `recompileAgents()` with `compileAgents()` and `loadAgentDefsForCompile` with `loadAgentDefs()`. The `recompileProject` operation is created for programmatic use but NOT wired into compile.ts in Phase 4.

7. **installLocal and installPluginConfig stay in local-installer.ts.** They're proto-operations used internally by `executeInstallation`. Don't move or rename them.

8. **Use `.js` extensions on all relative imports** in the new operation files (matching existing convention in `lib/` files).

---

## Gotchas and Edge Cases

### G1: Buffer state leak in edit.tsx after loadSource encapsulation

**Risk: MEDIUM — Visible behavior change for warnings during config load/skill discovery**

Currently, edit.tsx wraps a WIDER scope in buffer mode than just `loadSkillsMatrixFromSource`:

```
enableBuffering()                        // line 108
  loadSkillsMatrixFromSource()           // warn() calls -> captured in buffer
  pushBufferMessage("info", "Loaded...") // line 120
  loadProjectConfig()                    // warn() calls -> captured in buffer
  discoverAllPluginSkills()              // warn() calls -> captured in buffer
  pushBufferMessage("info", "Found...")  // line 143
drainBuffer()                            // line 149
disableBuffering()                       // line 150
```

After `loadSource({ captureStartupMessages: true })`, the buffer is drained and disabled
BEFORE `loadProjectConfig()` and `discoverAllPluginSkills()` run. Their `warn()` calls would
go directly to stderr instead of being captured as startup messages in the wizard.

**Functions that CAN emit warn() during this window:**

- `loadProjectConfig()` via `project-config.ts:54,60` — warns on config load errors, missing skills array
- `discoverAllPluginSkills()` via `plugin-finder.ts:86,93,102` — warns on missing frontmatter, invalid names, unknown skills

**Impact:** Warnings would flash on terminal before Ink renders, then be cleared by the wizard.
They would NOT appear in the wizard's startup message block. No E2E test currently asserts on
these specific warnings, but the visual change could cause test flakiness if a test captures
full terminal output.

**Mitigation options:**

1. **Accept the change** — these warnings are rare in practice (only when config is malformed or plugins have bad frontmatter)
2. **Keep buffer active longer** — have `loadSource` return without draining, let edit.tsx drain manually:
   ```typescript
   const loaded = await loadSource({
     sourceFlag: flags.source,
     projectDir,
     forceRefresh: flags.refresh,
     captureStartupMessages: true,
     drainOnReturn: false, // NEW: keep buffer active, caller drains
   });
   ```
3. **Move loadProjectConfig/discoverAllPluginSkills into the operation** — but this
   bloats `loadSource` beyond its purpose

**Recommendation:** Option 1 (accept). The implementation doc already acknowledges this at
lines 160-161 and the workaround (pushing directly into the returned array) is clean.
The warn() calls in project-config.ts and plugin-finder.ts are edge cases that
rarely trigger during normal edit flows.

---

### G2: E2E tests assert on log messages that would move into operations

**Risk: HIGH — Multiple E2E tests will FAIL if user-facing messages are downgraded to verbose()**

The implementation doc's design principle #2 states: "Commands keep their user-facing output.
Operations return data; commands decide what to log." But several operations' outlines
use `verbose()` for messages that are currently `this.log()` and tested by E2E:

**ensureMarketplace:**

- Current (init.tsx:390): `this.log('Registering marketplace "${marketplace}"...')`
- Proposed (outline step 4c): `verbose('Registered marketplace: ${marketplace}')`
- E2E assertion: `expect(output).toContain("Registering marketplace")` (init-wizard-default-source.e2e.test.ts:69)
- **FIX APPLIED:** Changed `ensureMarketplace` return type from `string | null` to
  `MarketplaceResult { marketplace, registered }`. The `registered` flag tells the
  command whether a new marketplace was registered, so it can log:
  ```typescript
  const mpResult = await ensureMarketplace(sourceResult);
  if (mpResult.registered) {
    this.log(`Registering marketplace "${mpResult.marketplace}"...`);
  }
  ```
  All call sites (init.tsx, edit.tsx, executeInstallation AFTER) have been updated.

**recompileProject:**

- Current (compile.ts:253): `this.log('Compiling ${label.toLowerCase()} agents...')`
- Proposed: absorbed into `recompileProject()` which returns data
- E2E assertions (6 tests):
  - `expect(output).toContain("Compiling global agents")` (compile.e2e.test.ts:41, compile-scope-filtering.e2e.test.ts:95,493, dual-scope.e2e.test.ts:184)
  - `expect(output).toContain("Compiling project agents")` (compile-scope-filtering.e2e.test.ts:96,494, dual-scope.e2e.test.ts:185)
- **FIX REQUIRED:** Either:
  (a) `recompileProject` emits these messages via `log()` from logger.ts (always visible), or
  (b) `recompileProject` returns scope labels so compile.ts can log before/after, or
  (c) compile.ts keeps `runCompilePass` with scope-based logging, calling `compileAgents()` inside

  **Recommendation:** Option (c) for Phase 4 — keep compile.ts's `runCompilePass` method
  intact but replace `recompileAgents()` calls inside it with `compileAgents()`. This
  preserves all user-facing messages without adding a callback or event system.
  Only use `recompileProject` in a future simplified CLI command or programmatic API.

**executeInstallation:**

- Current (init.tsx:408): `this.log("Installing skill plugins...")`
- Current (init.tsx:414): `this.log('  Installed ${pluginRef}')`
- E2E assertions:
  - `expect(output).toContain("Installing skill plugins...")` (init-wizard-plugin.e2e.test.ts:48, plugin-lifecycle.e2e.test.ts:71)
  - `expect(output).toContain('Installed web-framework-react@...')` (init-wizard-plugin.e2e.test.ts:51, plugin-lifecycle.e2e.test.ts:73)
- **FIX REQUIRED:** The `executeInstallation` AFTER block (lines 1314-1326) is too brief.
  Init.tsx must log per-skill installation progress messages AFTER calling the operation.
  The operation returns `installed: Array<{ id, ref }>`, so init.tsx can iterate:
  ```typescript
  this.log("Installing skill plugins...");
  const pluginResult = await installPluginSkills(...);
  for (const item of pluginResult.installed) {
    this.log(`  Installed ${item.ref}`);
  }
  ```
  This is already shown in the `installPluginSkills` AFTER block at lines 616-618,
  but NOT in the `executeInstallation` AFTER block. The `executeInstallation` AFTER
  block at lines 1314-1326 must be expanded to include these messages.

---

### G3: Matrix singleton initialization ordering

**Risk: LOW — No change from current behavior, but documents an implicit dependency**

The `matrix` singleton in `matrix-provider.ts` starts as `BUILT_IN_MATRIX` and is replaced
by `initializeMatrix()` during `loadSkillsMatrixFromSource()`. Several downstream operations
depend on the matrix singleton:

- `discoverAllPluginSkills()` (plugin-finder.ts:99) — validates skill names against matrix
- `buildLocalSkillsMap()` (local-installer.ts:139) — reads descriptions from matrix
- `config-generator.ts` — uses matrix for config generation
- `skill-copier.ts` — uses `getSkillById()` for skill resolution

**Ordering constraint:** `loadSource()` (which calls `loadSkillsMatrixFromSource()`) MUST
execute before any of: `copyLocalSkills`, `installPluginSkills`, `writeProjectConfig`,
`compileAgents`, `executeInstallation`.

**compile.ts exception:** The compile command does NOT call `loadSkillsMatrixFromSource()`
and operates on the default `BUILT_IN_MATRIX`. This works because `discoverAllPluginSkills`
only uses the matrix to validate discovered skill IDs exist. If the `recompileProject`
operation were to call `loadSource()` internally, it would change the matrix state as a
side effect. The current design correctly avoids this.

**Validation:** All current call orderings in init.tsx, edit.tsx, and compile.ts satisfy
this constraint. The operations layer preserves the same ordering.

---

### G4: ensureMarketplace mutates sourceResult

**Risk: LOW — Matches current behavior but limits future flexibility**

The `ensureMarketplace` operation mutates `sourceResult.marketplace` in place (outline step 1a).
This is intentional and matches init.tsx:376 current behavior. Callers rely on
`sourceResult.marketplace` being set after the call for subsequent plugin operations.

**Consequences:**

- `sourceResult` cannot be frozen or shared between concurrent operations
- The mutation is a side effect that is not reflected in the return type
- If a caller passes the same `sourceResult` to multiple operations, the mutation
  is visible to all

**No fix needed.** The current design accepts this pattern. Document in JSDoc.

---

### G5: writeProjectConfig ensureBlankGlobalConfig redundancy and ordering

**Risk: NONE — Redundant but harmless**

The `writeProjectConfig` operation calls `ensureBlankGlobalConfig()` (step 8) BEFORE
`writeScopedConfigs()` (step 9). But `writeScopedConfigs()` writes the REAL global
config at lines 393-394, immediately overwriting the blank one.

The blank config is a safety net for error recovery: if `writeScopedConfigs()` fails
between writing the global config and writing the project config, the project
config's `import globalConfig from "..."` would fail at load time.

In init.tsx, `ensureBlankGlobalConfig` is called even earlier (line 229, before source loading)
so the global config exists before ANY operation runs. The `writeProjectConfig` call
at step 8 is redundant with init.tsx's earlier call but harmless.

**For edit.tsx:** `ensureBlankGlobalConfig()` is currently called at line 464. After the
refactoring to use `writeProjectConfig`, this call moves inside the operation. The behavior
is equivalent.

**writeScopedConfigs internal ordering is correct:** It writes global config FIRST (line 394),
then project config (line 410). Since project config imports from global, this satisfies the
dependency. No issue here.

---

### G6: Claude CLI availability — no pre-check in operations

**Risk: LOW — Same behavior as current code**

The operations `installPluginSkills`, `uninstallPluginSkills`, and `ensureMarketplace`
call `claudePluginInstall`, `claudePluginUninstall`, `claudePluginMarketplaceAdd`, etc.
These functions spawn `claude` as a subprocess via `execCommand("claude", ...)`.

If the Claude CLI is not installed, `spawn` will throw with `ENOENT`. The current
code in init.tsx and edit.tsx does NOT pre-check Claude CLI availability before
calling these functions — it relies on try/catch around the calls.

The `isClaudeCLIAvailable()` function exists in exec.ts but is only used by
`uninstall.tsx`, `new/agent.tsx`, and `stack-installer.ts`.

**No change needed.** The operations replicate the existing error handling pattern.
A future improvement could add `isClaudeCLIAvailable()` checks before plugin
operations, but that's out of scope for D-145.

---

### G7: detectProject flattens LoadedProjectConfig — downstream access pattern breakage

**Risk: HIGH — ~12 access pattern changes in edit.tsx, must be comprehensive**

The `detectProject` operation returns `ProjectConfig | null` instead of
`LoadedProjectConfig | null` (which has shape `{ config: ProjectConfig, configPath: string }`).
This means ALL downstream access patterns in edit.tsx must change:

```typescript
// BEFORE: projectConfig is LoadedProjectConfig | null
projectConfig?.config?.skills; // ~12 occurrences
projectConfig?.config?.agents; // ~4 occurrences
projectConfig?.config?.domains; // 1 occurrence
projectConfig?.config?.selectedAgents; // 1 occurrence

// AFTER: projectConfig is ProjectConfig | null
projectConfig?.skills; // direct access
projectConfig?.agents;
projectConfig?.domains;
projectConfig?.selectedAgents;
```

**Known locations in edit.tsx that must change** (grep for `projectConfig?.config`):

- Line 139: `projectConfig?.config?.skills?.map(...)`
- Line 161: `projectConfig?.config?.skills?.filter(...)`
- Line 164: `projectConfig?.config?.agents?.filter(...)`
- Line 171: `projectConfig?.config?.domains`
- Line 172: `projectConfig?.config?.selectedAgents`
- Line 173: `projectConfig?.config?.skills`
- Line 175: `projectConfig?.config?.agents`
- Line 208: `projectConfig?.config?.agents?.map(...)`
- Line 218: `projectConfig?.config?.skills`
- Line 220: `projectConfig.config.skills.find(...)`
- Line 240: `projectConfig?.config?.agents`
- Line 242: `projectConfig.config.agents.find(...)`
- Line 302: `projectConfig?.config?.skills ?? []`
- Line 358: `projectConfig?.config?.skills?.find(...)`
- Line 389: `projectConfig?.config?.skills?.find(...)`

**Missing ANY of these will cause runtime errors** — the code would silently get `undefined`
from `projectConfig?.config` (since `config` is not a field on `ProjectConfig`) and proceed
with no data, potentially causing empty configs, missing migrations, or incorrect diffs.

**Implementor MUST:** Run `grep -n 'projectConfig\?.config\|projectConfig\.config' src/cli/commands/edit.tsx` and update ALL matches.

---

### G8: recompileProject scope-filtered compile loses intermediate status messages

**Risk: HIGH — 6 E2E tests assert on scope labels in compile output**

The compile command currently logs per-scope status messages from `runCompilePass`:

- `"Compiling global agents..."` (compile.ts:253)
- `"Compiling project agents..."` (compile.ts:253)
- Skill discovery counts (compile.ts:229-236)
- Per-scope completion messages (compile.ts:314)

If `recompileProject` absorbs this logic, these messages must be preserved. The implementation
doc's recommended approach (verbose() for intermediate, user-facing summary at end) will break
E2E tests that assert on "Compiling global agents" and "Compiling project agents".

**Concrete E2E test failures if messages are lost:**

| Test File                           | Assertion                    | Line |
| ----------------------------------- | ---------------------------- | ---- |
| compile.e2e.test.ts                 | `"Compiling global agents"`  | 41   |
| compile-scope-filtering.e2e.test.ts | `"Compiling global agents"`  | 95   |
| compile-scope-filtering.e2e.test.ts | `"Compiling project agents"` | 96   |
| compile-scope-filtering.e2e.test.ts | `"Compiling global agents"`  | 493  |
| compile-scope-filtering.e2e.test.ts | `"Compiling project agents"` | 494  |
| dual-scope.e2e.test.ts              | `"Compiling global agents"`  | 184  |
| dual-scope.e2e.test.ts              | `"Compiling project agents"` | 185  |

**Recommended approach:** Do NOT use `recompileProject` in Phase 4 for compile.ts.
Instead, keep compile.ts's `runCompilePass` method structure intact but replace the
`recompileAgents()` call inside it with `compileAgents()`. This gives the benefit of
using the operations layer without losing intermediate user-facing output. The
`recompileProject` operation can be used by future programmatic callers that don't
need per-scope progress output.

Update compile.ts Phase 4 refactor plan from:

> Replace `run()` body with `recompileProject()`. Keep flag parsing, verbose setup, and user-facing log messages.

To:

> Replace `recompileAgents()` calls inside `runCompilePass` with `compileAgents()`.
> Replace `loadAgentDefsForCompile` with `loadAgentDefs()`.
> Keep `run()`, `runCompilePass`, `discoverAllSkills` intact — they contain user-facing log messages.
> `recompileProject` is deferred to Phase 5 or later (no current caller benefits from it).

---

### G9: executeInstallation AFTER block is too brief for E2E compliance

**Risk: HIGH — executeInstallation swallows per-skill log messages that E2E tests assert on**

The `executeInstallation` AFTER block at lines 1314-1326 shows:

```typescript
const installResult = await executeInstallation({...});
this.log(`Install mode: ${installResult.mode}`);
if (installResult.copiedSkills.length > 0) {
  this.log(`Copied ${installResult.copiedSkills.length} skills`);
}
```

But E2E tests assert on INTERMEDIATE messages from inside the current init.tsx methods:

- `"Installing skill plugins..."` (init.tsx:408)
- `"Installed web-framework-react@..."` per-skill (init.tsx:414)
- `"Registering marketplace \"...\"..."` (init.tsx:390)
- `"Copied N local skills to .claude/skills/"` (init.tsx:355)
- `"Generating configuration..."` (init.tsx:425)
- `"Configuration saved (...)"` (init.tsx:438)
- `"Compiled N agents to .claude/agents/"` (init.tsx:440)
- init success message (init.tsx:442)

**The `executeInstallation` operation cannot emit these messages** — it doesn't have
access to `this.log()`. And using `log()` from logger.ts would work but violates the
design principle that operations return data and commands log.

**Recommended approach:** `executeInstallation` should be structured as a PIPELINE
with per-step returns, NOT a single monolithic call. The init.tsx AFTER block should
call individual operations in sequence with logging between each:

```typescript
// Instead of one executeInstallation() call, use individual operations:
const installMode = deriveInstallMode(result.skills);

if (installMode !== "plugin") {
  const copyResult = await copyLocalSkills(localSkills, projectDir, sourceResult);
  this.log(`Copied ${copyResult.totalCopied} local skills...`);
}

const marketplace = await ensureMarketplace(sourceResult);
if (marketplace) {
  this.log(`Registering marketplace "${marketplace}"...`);
  this.log("Installing skill plugins...");
  const pluginResult = await installPluginSkills(pluginSkills, marketplace, projectDir);
  for (const item of pluginResult.installed) {
    this.log(`  Installed ${item.ref}`);
  }
}

this.log("Generating configuration...");
const configResult = await writeProjectConfig({...});
// ... etc
```

This means `executeInstallation` may NOT be useful for the init command
as currently designed. It's a valid abstraction for programmatic use but
the init command needs fine-grained control over logging.

**Alternative:** Keep `executeInstallation` but add a `logger` callback parameter:

```typescript
export async function executeInstallation(
  options: ExecuteInstallationOptions,
  logger?: { log: (msg: string) => void; warn: (msg: string) => void },
): Promise<ExecuteInstallationResult>;
```

But this introduces callback-based logging which is the opposite of the "operations return data" principle. Not recommended.

---

### G10: outdated.ts early exit check for "no local skills" must remain in command

**Risk: LOW — Implementation doc note at line 828 already acknowledges this**

The `compareSkillsWithSource` operation handles empty results correctly (returns empty
`merged` array). But outdated.ts has an early exit check (lines 79-93) that runs BEFORE
source loading: if neither project nor global local skills directories exist, it skips
source loading entirely and shows a warning.

After the refactoring, the command cannot check for local skills before loading source
because `compareSkillsWithSource` encapsulates both the directory check and the comparison.
The operation would load the source (potentially doing a git clone) only to return empty results.

**Mitigation:** The implementation doc correctly notes (line 828): "The operation returns
empty merged array in that case, so the command can check `results.length === 0`."

However, the current early exit AVOIDS the source load entirely (saving time and network).
Consider keeping the early exit in the command:

```typescript
// Keep fast path: check directories exist before loading source
const hasProject = await fileExists(path.join(projectDir, LOCAL_SKILLS_PATH));
const hasGlobal = projectDir !== homeDir && await fileExists(path.join(homeDir, LOCAL_SKILLS_PATH));
if (!hasProject && !hasGlobal) { /* warn and return */ }

// Only load source and compare if local skills exist
const { sourceResult } = await loadSource({...});
const { merged: results } = await compareSkillsWithSource(...);
```

---

## Revision History

### Pass 5 (2026-03-25) — Polish, consistency, completeness

Final review for sub-agent readiness. All names, types, and cross-references verified consistent.

**Added Quick Reference section at document top:**

- Complete file tree with Phase annotations for each operation file
- Command-to-operations mapping table (11 commands, showing which operations each uses)
- Phase-to-files mapping table (5 phases, showing new files created, existing files modified, and gate criteria)
- E2E risk matrix table (per-phase risk level with concrete mitigation strategies)

**Phase labels added to all operation headers:**

- Every `## Operation:` header now includes `(Phase N)` suffix
- `Types File` and `Barrel Export` headers marked `(Phase 1, updated each phase)`
- Implementors can immediately see which phase creates each operation

**Consistency fixes:**

- Fixed incomplete template literal in `executeInstallation` AFTER block (line 1343): expanded `...` to full ternary matching init.tsx:302-308 (`installMode === "mixed"` and `"Local"` branches)
- Fixed stale "placeholder" reference in `recompileProject` CRITICAL note: the outline steps 8a/9a now contain the full 4-way discovery algorithm (expanded in Pass 2), but the note still said "is a placeholder that must be fully implemented". Updated to reference the completed outline steps.

**Completeness verification:**

- All 12 operations have: File path, Extracts from, Function signature, Implementation outline, Call sites (before/after), Imports needed
- All function names match between signature sections, types.ts re-exports, index.ts barrel exports, and AFTER blocks
- All type names match between definition sites and usage sites
- All file names are kebab-case and correspond to their function names
- No TODO/FIXME/PLACEHOLDER comments remain in implementation outlines
- No truncated implementation outlines (all numbered steps are complete)
- `compareSkillsWithSource` file is `compare-skills.ts` (shortened, but consistent across all references)

**Cross-reference verification:**

- Every import path verified against actual barrel exports (`types/index.ts`, `installation/index.ts`, `configuration/index.ts`, `skills/index.ts`, `agents/index.ts`, `loading/index.ts`)
- `AgentSourcePaths` confirmed exported via `export type * from "./agents"` in `types/index.ts`
- `ensureBlankGlobalConfig` confirmed at `configuration/config-writer.ts` (not in barrel — direct import is correct)
- `buildAndMergeConfig`, `writeScopedConfigs`, `resolveInstallPaths`, `buildAgentScopeMap` confirmed in `installation/index.ts` barrel

---

### Pass 4 (2026-03-25) — Implementation correctness

Verified import completeness, type compatibility, phase gates, AFTER block accuracy, dead imports, and test file coverage against actual source code. All function names, export paths, and type shapes verified by reading the actual TypeScript files.

**Import consolidation — eliminated duplicate type imports across all 12 operations:**

Every operation had type imports duplicated between the "Function signature" header and the "Imports needed" section (often with different import paths for the same type, e.g., `SourceLoadResult` from `source-loader.js` in the signature vs `loading/index.js` in imports). Replaced all signature-level imports with a standardized note: "All imports for this operation are consolidated in the Imports needed section below." This prevents implementors from including both import statements, which would cause TypeScript duplicate identifier errors.

**Import path corrections:**

- `compileAgents`: `InstallMode` import changed from `"../installation/installation.js"` to `"../installation/index.js"` (use barrel, not direct file)
- `executeInstallation`: Consolidated `InstallMode` and `deriveInstallMode` into single import from `"../installation/index.js"`, removed duplicate `InstallMode` from `"../installation/installation.js"`

**`ensureMarketplace` imports: removed unused `verbose`:**
The outline is intentionally SILENT (design principle #2 + G2 fix). Only `warn` is used (step 5b: marketplace update failure). Removed `verbose` from the imports section.

**`writeProjectConfig` — `loadMergedAgents` is PRIVATE (not exported):**
The outline step 4 referenced `loadMergedAgents(sourceResult.sourcePath)`, but this function is defined as `async function loadMergedAgents(...)` in `local-installer.ts:152` WITHOUT the `export` keyword. It is NOT exported and cannot be imported by operation files. Fixed the outline to inline the logic: `loadAllAgents(PROJECT_ROOT)` + `loadAllAgents(sourceResult.sourcePath)` with spread merge. Added explicit code showing the if/else for `options.agents` presence.

**`writeProjectConfig` — `writeScopedConfigs` 6th parameter semantics:**
The outline step 9 passes `isProjectContext` as the last argument, but the actual parameter is named `projectInstallationExists` (local-installer.ts:375). While the values are equivalent in practice (both compare projectDir vs homedir), the naming mismatch could confuse implementors. Added a NOTE comment in the outline explaining the semantic equivalence and why the variable name differs from the parameter name.

**`compileAgents` — `LoadedProjectConfig` destructuring gap:**
The outline step 1b said "Filter config.agents" but `loadProjectConfigFromDir` returns `LoadedProjectConfig | null` (shape: `{ config: ProjectConfig, configPath: string }`), not `ProjectConfig` directly. An implementor writing `config.agents` would get `undefined`. Expanded the outline to show the full destructuring pattern: `loadedConfig?.config?.agents?.filter(a => a.scope === scopeFilter).map(a => a.name)`.

**Import removal checklist — `deriveInstallMode` KEPT in init.tsx:**
Per G9, init.tsx does NOT use `executeInstallation` — it calls individual operations with logging between each. The AFTER block at line 1337 shows `const installMode = deriveInstallMode(result.skills)`. Removed `deriveInstallMode` from the "init.tsx remove" list and added a NOTE that it's kept.

**Test disable list — 4 missing test files added:**

- `info.test.ts` (LOW risk — tests via `runCliCommand()`)
- `source-switching.integration.test.ts` (NONE — imports `installLocal` directly, unchanged)
- `user-journeys.integration.test.ts` (NONE — imports `installLocal` + `recompileAgents` directly, unchanged)
- `install-compile.test.ts` (NONE — no imports of replaced functions)

**`ensureMarketplace` outline — return type mismatch:**
Step 1b said `return null` but the return type is `Promise<MarketplaceResult>` (not nullable). Fixed to return `{ marketplace: null, registered: false }` which matches the type's `marketplace: string | null` field.

**`edit.tsx` import removal — `discoverAllPluginSkills` KEPT:**
The import removal list said `discoverAllPluginSkills` was handled by `compileAgents` internally. But `discoverAllPluginSkills` is still used at edit.tsx line 133 for building `currentSkillIds` (the wizard's installed skills list). Only the recompilation call at line 492 is replaced by `compileAgents`. Changed the removal entry to a NOTE explaining the import is kept.

**`edit.tsx` import removal — `claudePluginInstall` and `claudePluginUninstall` KEPT:**
The import removal list said both were handled by operations. But edit.tsx lines 342-344 use them directly for plugin-mode scope migrations (P->G / G->P): uninstall from old scope, install to new scope. The `installPluginSkills`/`uninstallPluginSkills` operations handle add/remove for new/deleted skills, NOT scope changes for existing skills. Split the removal entry to only remove `claudePluginMarketplaceExists` and `claudePluginMarketplaceAdd`, keeping the plugin install/uninstall functions.

---

### Pass 3 (2026-03-25)

Edge cases, race conditions, and subtle behavior changes that could break E2E tests. Changes made:

**Added "Gotchas and Edge Cases" section with 10 findings:**

- **G1 (MEDIUM):** Buffer state in edit.tsx — `loadProjectConfig()` and `discoverAllPluginSkills()` lose buffering after `loadSource` encapsulation. Their `warn()` calls (project-config.ts:54,60 and plugin-finder.ts:86,93,102) would go to stderr instead of startup messages. No E2E tests assert on these specific warnings but visual artifacts are possible.
- **G2 (HIGH):** E2E tests assert on log messages that operations would downgrade to `verbose()`. Three operations affected: `ensureMarketplace` (1 E2E test), `recompileProject` (7 E2E assertions), `executeInstallation` (4 E2E assertions). Fix required for each.
- **G3 (LOW):** Matrix singleton must be initialized before skill/plugin/config operations. `loadSource()` must precede all downstream operations. compile.ts is an exception (uses default BUILT_IN_MATRIX).
- **G4 (LOW):** `ensureMarketplace` mutates `sourceResult.marketplace` in place. Matches current behavior, document in JSDoc.
- **G5 (NONE):** `writeProjectConfig` calls `ensureBlankGlobalConfig` redundantly before `writeScopedConfigs`. Harmless — `writeScopedConfigs` writes global first, project second.
- **G6 (LOW):** Operations don't pre-check `isClaudeCLIAvailable()` before plugin operations. Same as current code. Future improvement, not in scope.
- **G7 (HIGH):** `detectProject` flattens `LoadedProjectConfig` to `ProjectConfig`, requiring ~15 access pattern changes in edit.tsx. Missing any causes silent `undefined` propagation.
- **G8 (HIGH):** `recompileProject` absorbing compile.ts loses per-scope status messages asserted by 7 E2E tests. Recommended: defer `recompileProject` from Phase 4, keep compile.ts structure with `compileAgents()` substitution instead.
- **G9 (HIGH):** `executeInstallation` AFTER block is too brief — 4 E2E tests assert on per-skill installation messages. Recommended: init.tsx should call individual operations with logging between each, not one monolithic `executeInstallation()` call.
- **G10 (LOW):** outdated.ts early exit check avoids source loading when no local skills exist. Keep this optimization in the command, don't let `compareSkillsWithSource` trigger unnecessary source loads.

**Implementation outline fixes based on edge case findings:**

- `ensureMarketplace` return type: changed from `Promise<string | null>` to `Promise<MarketplaceResult>` with `{ marketplace, registered }` — commands use the `registered` flag to decide whether to log "Registering marketplace..." (E2E tests assert on this text)
- `ensureMarketplace` outline: changed step 4c from `verbose(...)` to note that the operation should be SILENT — commands log based on the returned `registered` flag
- `ensureMarketplace` call sites (init.tsx, edit.tsx, executeInstallation AFTER): updated to destructure `MarketplaceResult` and conditionally log marketplace registration
- `recompileProject`: added recommendation to defer Phase 4 usage in compile.ts; keep `runCompilePass` structure with `compileAgents()` substitution
- `executeInstallation`: noted that init.tsx should call individual operations with per-step logging rather than a single `executeInstallation()` call for E2E compliance
- compile.ts Phase 4: revised to keep `run()`, `runCompilePass`, `discoverAllSkills` intact; only replace `recompileAgents()` -> `compileAgents()` and `loadAgentDefsForCompile` -> `loadAgentDefs()`
- compile.ts Phase 5 cleanup: revised to only remove `loadAgentDefsForCompile`, keeping all other methods
- compile.ts import removal checklist: revised to keep most imports (only remove `recompileAgents` and `getAgentDefinitions`)
- Key Design Decision #6: updated to reflect compile.ts structure preservation per G8
- Added `MarketplaceResult` to types.ts and barrel export

### Pass 2 (2026-03-25)

Cross-referenced every line number, function signature, and before/after block against actual source code. Changes made:

**Line number corrections:**

- `copyLocalSkills` extracts: edit.tsx range corrected from `401-432` to `400-433`
- `loadAgentDefs` extracts: edit.tsx range corrected from `436-450` to `435-450`, noted spans two try blocks
- `installPluginSkills` extracts: init.tsx range corrected from `408-423` to `409-420`
- `executeInstallation` extracts: split `init.tsx:288-523` into three separate methods with individual ranges (288-364, 366-465, 467-523)
- `compareSkillsWithSource` extracts: outdated.ts range expanded from `108-127` to `73-126` to include hasProject/hasGlobal checks
- `recompileProject` compile.ts range expanded from `129-187` to `129-352` to include 4 private methods

**Before/after block fixes:**

- `loadSource` edit.tsx: Rewrote "before" to show full buffer scope (108-150) covering loadProjectConfig and discoverAllPluginSkills; added note that these callers lose buffering after refactor since loadSource drains buffer
- `detectProject` edit.tsx: Added WARNING about access pattern change — `projectConfig` changes from `LoadedProjectConfig | null` to `ProjectConfig | null`, requiring ~12 downstream access pattern changes (`projectConfig?.config?.skills` -> `projectConfig?.skills`)
- `uninstallPluginSkills` edit.tsx: Added note that "before" code is inside `if (sourceResult.marketplace)` guard at line 364
- `compileAgents` edit.tsx: Added NOTE explaining why skills param is omitted (auto-discovery equivalent)
- `compileAgents` compile.ts: Added `pluginDir` omission note (defaults to projectDir in the operation)

**Missing operations coverage:**

- Added `loadSource` call sites for doctor.ts, info.ts, search.tsx, eject.ts (4 commands previously omitted from the 9 listed in the proposal)
- Added Phase 4 refactor entries for doctor.ts, info.ts, search.tsx, eject.ts, uninstall.tsx (with note that uninstall has no applicable operations)
- Added import removal checklist entries for doctor.ts, info.ts, search.tsx, eject.ts

**Critical gap: recompileProject skill discovery:**

- Expanded `recompileProject` implementation outline from placeholder ("discover skills for homedir") to full 4-way skill discovery algorithm matching compile.ts:189-239
- Added CRITICAL note about `loadSkillsFromDir` and `discoverLocalProjectSkills` being private functions in compile.ts (lines 24-78) that must be extracted or moved
- Added required imports for recompileProject (resolveSource, loadProjectConfigFromDir, buildAgentScopeMap, setVerbose, verbose, etc.)

**Type signature fixes:**

- Removed dead `projectConfig?: ProjectConfig | null` field from `CompileAgentsOptions` (not forwarded to `recompileAgents`)
- Added JSDoc to `scopeFilter` in `CompileAgentsOptions` explaining it resolves to `agents` list internally
- Added `scopeFilter` resolution step to `compileAgents` implementation outline
- Added `loadProjectConfigFromDir` import to `compileAgents` (needed for scopeFilter resolution)

**Test disable list updates:**

- Added 5 missing test files: doctor.test.ts, eject.test.ts, search.test.ts, init-flow.integration.test.ts, init-end-to-end.integration.test.ts
- Updated edit.test.ts risk description: clarified that import paths won't change (operations are additive) but mock expectations may break due to command code restructuring
- Added detailed explanation of WHY edit.test.ts is HIGH risk (transitive mocking, call order changes)
