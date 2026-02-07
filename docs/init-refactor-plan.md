# Init.tsx Refactor Plan (Option A: Pragmatic Refactor)

## Executive Summary

`init.tsx` is 591 lines with three large methods (`run`, `handleInstallation`, `installPluginMode`, `installLocalMode`, `saveSourceToProjectConfig`) that mix orchestration with business logic. The goal is to extract logic into library/utility files so init.tsx becomes a thin ~100-line orchestrator.

During investigation, significant **cross-command duplication** was discovered that the same extractions will fix:

| Duplicated Code                | Files Affected                                                             |
| ------------------------------ | -------------------------------------------------------------------------- |
| `saveSourceToProjectConfig()`  | `init.tsx`, `eject.ts`                                                     |
| `readForkedFromMetadata()`     | `update.tsx`, `diff.ts`, `outdated.ts`                                     |
| `getLocalSkillsWithMetadata()` | `update.tsx`, `outdated.ts`                                                |
| `compareSkills()`              | `update.tsx`, `outdated.ts`                                                |
| `computeSourceHash()`          | `update.tsx`, `outdated.ts`                                                |
| `getCurrentDate()`             | `import/skill.ts`, `update.tsx`, `skill-copier.ts`, `versioning.ts`        |
| `findPluginManifest()`         | `version/bump.ts`, `version/set.ts`, `version/show.ts`, `version/index.ts` |

**Strategy:** Extract init.tsx logic into focused lib files. Where duplication exists across commands, consolidate into the same shared lib file. Each new lib file follows the existing pattern (pure functions, no `this`, typed inputs/outputs).

---

## Extraction Inventory

### New Files to Create

| #   | New File                                | Purpose                                                                         | Used By                                                                    |
| --- | --------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | `src/cli/lib/config-saver.ts`           | Save source/config to project config YAML                                       | `init.tsx`, `eject.ts`                                                     |
| 2   | `src/cli/lib/config-merger.ts`          | Merge new config with existing project config                                   | `init.tsx`                                                                 |
| 3   | `src/cli/lib/local-installer.ts`        | Orchestrate local mode installation (copy skills, build config, compile agents) | `init.tsx`                                                                 |
| 4   | `src/cli/lib/plugin-installer.ts`       | Orchestrate plugin mode installation (marketplace registration, stack install)  | `init.tsx`                                                                 |
| 5   | `src/cli/lib/skill-metadata.ts`         | Shared forked_from metadata reading/comparison                                  | `update.tsx`, `diff.ts`, `outdated.ts`                                     |
| 6   | `src/cli/lib/plugin-manifest-finder.ts` | Find plugin.json in directory tree                                              | `version/bump.ts`, `version/set.ts`, `version/show.ts`, `version/index.ts` |

### Existing Files to Extend

| #   | Existing File               | Addition                                                                 | Used By                                            |
| --- | --------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------- |
| 7   | `src/cli/lib/versioning.ts` | Already exports `getCurrentDate()` - other files should import from here | `import/skill.ts`, `update.tsx`, `skill-copier.ts` |

---

## Detailed Extraction Specs

### 1. `src/cli/lib/config-saver.ts` (NEW)

**Purpose:** Save source URL and other metadata to the project-level `.claude-src/config.yaml`.

**Replaces duplicate code in:** `init.tsx:274-290`, `eject.ts:163-181`

```typescript
// src/cli/lib/config-saver.ts
import path from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { ensureDir, writeFile, readFile, fileExists } from "../utils/fs";
import { CLAUDE_SRC_DIR } from "../consts";

/**
 * Save or merge a source URL into the project-level .claude-src/config.yaml.
 * Creates the file if it doesn't exist; merges with existing config if it does.
 */
export async function saveSourceToProjectConfig(projectDir: string, source: string): Promise<void>;

// Signature: (projectDir: string, source: string) => Promise<void>
// Dependencies: yaml, ../utils/fs, ../consts
// Lines replaced in init.tsx: 274-290 (17 lines)
// Lines replaced in eject.ts: 163-181 (19 lines)
```

**Calling code in init.tsx after extraction:**

```typescript
import { saveSourceToProjectConfig } from "../lib/config-saver.js";
// ...
await saveSourceToProjectConfig(projectDir, flags.source);
```

---

### 2. `src/cli/lib/config-merger.ts` (NEW)

**Purpose:** Merge a new ProjectConfig with an existing one, following the field-by-field precedence rules.

**Replaces:** `init.tsx:399-495` (97 lines -- the massive merge block in `installLocalMode`)

```typescript
// src/cli/lib/config-merger.ts
import type { ProjectConfig } from "../../types";
import { loadProjectConfig as loadFullProjectConfig } from "./project-config";
import { loadProjectConfig } from "./config";

export interface MergeContext {
  projectDir: string;
}

/**
 * Merge a newly generated ProjectConfig with any existing project config.
 *
 * Merge strategy:
 * - Existing values take precedence for identity fields (name, description, source, author)
 * - Skills arrays are unioned (existing + new, deduplicated)
 * - Agents arrays are unioned
 * - Stack is deep-merged (existing agent configs take precedence)
 * - Other optional fields preserved from existing if present
 *
 * Returns the merged config and whether an existing config was found.
 */
export async function mergeWithExistingConfig(
  newConfig: ProjectConfig,
  context: MergeContext,
): Promise<{ config: ProjectConfig; merged: boolean }>;

// Signature: (newConfig, context) => Promise<{ config, merged }>
// Dependencies: ./project-config, ./config, ../../types
// Lines replaced in init.tsx: 399-495 (97 lines)
```

**Calling code in init.tsx after extraction:**

```typescript
import { mergeWithExistingConfig } from "../lib/config-merger.js";
// ...
const { config: finalConfig, merged } = await mergeWithExistingConfig(localConfig, { projectDir });
if (merged) {
  this.log(`Merged with existing config`);
}
```

---

### 3. `src/cli/lib/local-installer.ts` (NEW)

**Purpose:** Orchestrate the entire local mode installation: copy skills, build config, compile agents, write config file. This is the big extraction from `installLocalMode`.

**Replaces:** `init.tsx:295-590` (the `installLocalMode` method minus the try/catch wrapper and logging)

```typescript
// src/cli/lib/local-installer.ts
import type { ProjectConfig, CompileConfig, CompileAgentConfig } from "../../types";
import type { SourceLoadResult } from "./source-loader";
import type { WizardResultV2 } from "../components/wizard/wizard";
import type { CopiedSkill } from "./skill-copier";

export interface LocalInstallOptions {
  /** Wizard result with selected skills and mode */
  wizardResult: WizardResultV2;
  /** Source load result with matrix and paths */
  sourceResult: SourceLoadResult;
  /** Project directory (cwd) */
  projectDir: string;
  /** Source flag value (if provided) */
  sourceFlag?: string;
}

export interface LocalInstallResult {
  /** Skills that were copied */
  copiedSkills: CopiedSkill[];
  /** Final merged project config */
  config: ProjectConfig;
  /** Path where config was saved */
  configPath: string;
  /** Names of compiled agents */
  compiledAgents: string[];
  /** Whether config was merged with existing */
  wasMerged: boolean;
  /** Local skills directory path */
  skillsDir: string;
  /** Local agents directory path */
  agentsDir: string;
}

/**
 * Install in Local Mode: copy skills, generate config, compile agents.
 *
 * Steps:
 * 1. Create directories (.claude/skills, .claude/agents, .claude-src/)
 * 2. Copy selected skills to .claude/skills/ (flattened)
 * 3. Generate project config from skills/stack selection
 * 4. Set source, marketplace, installMode on config
 * 5. Merge with existing project config (if any)
 * 6. Write config to .claude-src/config.yaml
 * 7. Compile agents to .claude/agents/
 *
 * Returns structured result for the caller to format output.
 */
export async function installLocal(options: LocalInstallOptions): Promise<LocalInstallResult>;

// Dependencies: ./skill-copier, ./config-generator, ./config-merger,
//   ./loader, ./stacks-loader, ./resolver, ./stack-plugin-compiler,
//   ./compiler, ../consts, ../utils/fs, ../../types
// Lines replaced in init.tsx: 295-590 (~295 lines of method body)
```

The key insight: this function does the **work** and returns a **result object**. The command file does the **logging** based on the result. This separation keeps the lib file pure and testable.

**Calling code in init.tsx after extraction:**

```typescript
import { installLocal } from "../lib/local-installer.js";
// ...
const result = await installLocal({
  wizardResult: result,
  sourceResult,
  projectDir,
  sourceFlag: flags.source,
});
// ... log result summary
```

---

### 4. `src/cli/lib/plugin-installer.ts` (NEW -- or extend existing `stack-installer.ts`)

**Purpose:** Orchestrate plugin mode installation: register marketplace, install stack, save source config.

**Replaces:** `init.tsx:197-269` (the `installPluginMode` method body)

After investigation, `src/cli/lib/stack-installer.ts` already exists and handles `installStackAsPlugin()`. The init.tsx `installPluginMode` method adds marketplace registration and result logging on top of that. Since `stack-installer.ts` is already the right home, the remaining init-specific orchestration is thin enough that we should **not** create a separate file. Instead, the marketplace registration (lines 209-223) should be extracted to a small helper in `stack-installer.ts`, and the rest stays as orchestration in init.tsx.

**Decision: Don't create a new file.** The plugin mode code in init.tsx (lines 197-269) is already reasonably well-factored -- it delegates to `installStackAsPlugin()` and `claudePluginMarketplaceAdd()`. After extracting `saveSourceToProjectConfig`, the remaining code is ~40 lines of straightforward orchestration that belongs in the command.

---

### 5. `src/cli/lib/skill-metadata.ts` (NEW)

**Purpose:** Shared utilities for reading forked_from metadata and comparing skills against source.

**Replaces duplicate code in:** `update.tsx:29-197`, `outdated.ts:15-197`, `diff.ts:14-55`

```typescript
// src/cli/lib/skill-metadata.ts
import path from "path";
import { parse as parseYaml } from "yaml";
import { fileExists, readFile, listDirectories } from "../utils/fs";
import { hashFile } from "./versioning";
import { LOCAL_SKILLS_PATH } from "../consts";

export interface ForkedFromMetadata {
  skill_id: string;
  content_hash: string;
  date: string;
}

export interface LocalSkillMetadata {
  forked_from?: ForkedFromMetadata;
  [key: string]: unknown;
}

export type SkillStatus = "current" | "outdated" | "local-only";

export interface SkillComparisonResult {
  id: string;
  localHash: string | null;
  sourceHash: string | null;
  status: SkillStatus;
  dirName: string;
  sourcePath?: string;
}

/**
 * Read forked_from metadata from a local skill's metadata.yaml
 */
export async function readForkedFromMetadata(skillDir: string): Promise<ForkedFromMetadata | null>;

/**
 * Get local skills with their forked_from metadata.
 * Returns a map of skillId -> { dirName, forkedFrom }.
 */
export async function getLocalSkillsWithMetadata(
  projectDir: string,
): Promise<Map<string, { dirName: string; forkedFrom: ForkedFromMetadata | null }>>;

/**
 * Compute source hash for a skill's SKILL.md file.
 */
export async function computeSourceHash(
  sourcePath: string,
  skillPath: string,
): Promise<string | null>;

/**
 * Compare local skills against source and determine status.
 * Returns sorted array of comparison results.
 */
export async function compareSkills(
  projectDir: string,
  sourcePath: string,
  sourceSkills: Record<string, { path: string }>,
): Promise<SkillComparisonResult[]>;

// Dependencies: yaml, ../utils/fs, ./versioning, ../consts
// Lines replaced across files:
//   update.tsx: 29-197 (169 lines of duplicated functions)
//   outdated.ts: 15-197 (183 lines of duplicated functions)
//   diff.ts: 14-55 (42 lines of readForkedFromMetadata)
```

---

### 6. `src/cli/lib/plugin-manifest-finder.ts` (NEW)

**Purpose:** Find plugin.json by traversing up from a starting directory.

**Replaces duplicate code in:** `version/bump.ts:16-33`, `version/set.ts:14-31`, `version/show.ts:11-28`, `version/index.ts:12-29`

```typescript
// src/cli/lib/plugin-manifest-finder.ts
import path from "path";
import { fileExists } from "../utils/fs";
import { PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE } from "../consts";

/**
 * Find plugin.json by traversing up from startDir to filesystem root.
 * Returns the manifest file path if found, null otherwise.
 */
export async function findPluginManifest(startDir: string): Promise<string | null>;

// Dependencies: path, ../utils/fs, ../consts
// Lines replaced per file: ~18 lines x 4 files = 72 lines total
```

---

### 7. `src/cli/lib/versioning.ts` (EXISTING -- use existing `getCurrentDate` export)

**No new code needed.** The function already exists and is exported.

**Files that should switch to importing from here:**

- `import/skill.ts:85-87` -- delete local `getCurrentDate`, import from `../lib/versioning.js`
- `update.tsx:125-127` -- delete local `getCurrentDate`, import from `../lib/versioning.js`
- `skill-copier.ts:47-49` -- delete local `getCurrentDate`, import from `./versioning.js`

---

## Per-Command Impact Analysis

| Command File       | Current Lines | Extractions Applied                                                                                                                | After Lines (est.) | Savings          |
| ------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------- |
| **`init.tsx`**     | 591           | config-saver, config-merger, local-installer                                                                                       | ~120               | **-471 (-80%)**  |
| `update.tsx`       | 604           | skill-metadata (readForkedFromMetadata, getLocalSkillsWithMetadata, compareSkills, computeSourceHash), versioning (getCurrentDate) | ~380               | -224 (-37%)      |
| `outdated.ts`      | 346           | skill-metadata (readForkedFromMetadata, getLocalSkillsWithMetadata, compareSkills, computeSourceHash)                              | ~170               | -176 (-51%)      |
| `diff.ts`          | 332           | skill-metadata (readForkedFromMetadata)                                                                                            | ~295               | -37 (-11%)       |
| `eject.ts`         | 374           | config-saver (saveSourceToProjectConfig)                                                                                           | ~355               | -19 (-5%)        |
| `import/skill.ts`  | 441           | versioning (getCurrentDate)                                                                                                        | ~438               | -3 (-1%)         |
| `version/bump.ts`  | 96            | plugin-manifest-finder                                                                                                             | ~78                | -18 (-19%)       |
| `version/set.ts`   | 105           | plugin-manifest-finder                                                                                                             | ~87                | -18 (-17%)       |
| `version/show.ts`  | ~90           | plugin-manifest-finder                                                                                                             | ~72                | -18 (-20%)       |
| `version/index.ts` | ~55           | plugin-manifest-finder                                                                                                             | ~37                | -18 (-33%)       |
| **Total**          | **~3034**     |                                                                                                                                    | **~2032**          | **~-1002 lines** |

**Note:** Remaining command files (`compile.ts`, `search.tsx`, `edit.tsx`, `uninstall.tsx`, `new/agent.tsx`, `new/skill.ts`, `build/stack.tsx`, `build/plugins.ts`, `build/marketplace.ts`, `doctor.ts`, `validate.ts`, `list.ts`, `info.ts`) have no significant duplication with init.tsx and are already well-factored.

---

## The "After" Pseudocode for init.tsx

```typescript
/**
 * Initialize Claude Collective in this project.
 */
import { BaseCommand } from '../base-command.js'
import { Wizard, type WizardResultV2 } from '../components/wizard/wizard.js'
import { loadSkillsMatrixFromSource } from '../lib/source-loader.js'
import { formatSourceOrigin } from '../lib/config.js'
import { getCollectivePluginDir } from '../lib/plugin-finder.js'
import { installLocal } from '../lib/local-installer.js'
import { installStackAsPlugin } from '../lib/stack-installer.js'
import { saveSourceToProjectConfig } from '../lib/config-saver.js'
import { checkPermissions } from '../lib/permission-checker.js'
import { claudePluginMarketplaceExists, claudePluginMarketplaceAdd } from '../utils/exec.js'
import { directoryExists } from '../utils/fs.js'
import { EXIT_CODES } from '../lib/exit-codes.js'
// ... remaining imports

export default class Init extends BaseCommand {
  static summary = '...'
  static flags = { ...BaseCommand.baseFlags, refresh: ... }

  async run(): Promise<void> {
    const { flags } = await this.parse(Init)
    const projectDir = process.cwd()

    // 1. Banner
    this.log(BANNER)

    // 2. Guard: already initialized?
    if (await directoryExists(getCollectivePluginDir())) {
      this.warn('Already initialized. Use cc edit.')
      return
    }

    // 3. Load skills matrix
    const sourceResult = await loadSkillsMatrixFromSource({ ... })

    // 4. Run wizard
    const wizardResult = await this.runWizard(sourceResult.matrix)
    if (!wizardResult || wizardResult.cancelled) return this.exit(EXIT_CODES.CANCELLED)
    if (wizardResult.selectedSkills.length === 0) return this.error('No skills selected', ...)

    // 5. Show summary
    this.logInstallSummary(wizardResult)

    // 6. Dry-run check
    if (flags['dry-run']) { this.logDryRunPreview(wizardResult, sourceResult); return }

    // 7. Route to install mode
    if (wizardResult.installMode === 'plugin' && wizardResult.selectedStackId) {
      await this.installPluginMode(wizardResult, sourceResult, flags)
    } else {
      if (wizardResult.installMode === 'plugin') {
        this.warn('Individual plugin install not supported. Falling back to Local Mode.')
      }
      await this.installLocalMode(wizardResult, sourceResult, flags)
    }
  }

  private async runWizard(matrix): Promise<WizardResultV2 | null> {
    let result: WizardResultV2 | null = null
    const { waitUntilExit } = render(<Wizard matrix={matrix} onComplete={r => result = r} onCancel={() => {}} />)
    await waitUntilExit()
    return result
  }

  private async installPluginMode(result, sourceResult, flags): Promise<void> {
    // Register marketplace if needed (~5 lines)
    // Call installStackAsPlugin (~3 lines)
    // Log result (~10 lines)
    // Save source if --source flag (~2 lines)
    // Check permissions (~3 lines)
  }

  private async installLocalMode(result, sourceResult, flags): Promise<void> {
    const installResult = await installLocal({
      wizardResult: result,
      sourceResult,
      projectDir: process.cwd(),
      sourceFlag: flags.source,
    })
    this.logLocalInstallResult(installResult)
    // Check permissions (~3 lines)
  }

  private logInstallSummary(result: WizardResultV2): void { /* ~5 lines */ }
  private logDryRunPreview(result, sourceResult): void { /* ~15 lines */ }
  private logLocalInstallResult(result: LocalInstallResult): void { /* ~20 lines */ }
}
```

**Estimated line count: ~110-120 lines** (down from 591).

The command file is now a clear, sequential narrative:

1. Show banner
2. Check if already initialized
3. Load skills
4. Run wizard
5. Route to install mode
6. Log results

All business logic lives in lib files.

---

## Detailed Breakdown of `local-installer.ts` Internals

This is the largest extraction, so here's what goes inside it:

### Functions to Extract from init.tsx lines 295-590

| Function                  | Lines        | Purpose                                                             | Inputs                                                                                             | Outputs                            |
| ------------------------- | ------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `installLocal()`          | orchestrator | Main entry point                                                    | `LocalInstallOptions`                                                                              | `LocalInstallResult`               |
| `buildLocalConfig()`      | 351-397      | Build ProjectConfig from wizard result (stack vs individual skills) | wizardResult, sourceResult                                                                         | ProjectConfig                      |
| `setConfigMetadata()`     | 384-397      | Add installMode, source, marketplace to config                      | config, flags, sourceResult                                                                        | mutated config                     |
| `buildCompileAgents()`    | 507-528      | Build CompileAgentConfig map for agent compilation                  | config, agents, loadedStack, skillAliases, localSkills                                             | Record<string, CompileAgentConfig> |
| `compileAndWriteAgents()` | 537-553      | Resolve agents, compile via Liquid, write .md files                 | compileConfig, agents, localSkills, sourceResult, loadedStack, skillAliases, projectDir, agentsDir | string[] (compiled names)          |
| `buildLocalSkillsMap()`   | 323-346      | Convert copied skills to resolution format                          | copiedSkills, matrix                                                                               | Record<string, {...}>              |

The `mergeWithExistingConfig()` function (init.tsx lines 399-495) is extracted to its own `config-merger.ts` because it's a significant standalone piece of logic.

---

## Implementation Order

The order matters because later extractions depend on earlier ones.

### Phase 1: Shared Utilities (no init.tsx changes yet)

These are standalone extractions that eliminate cross-command duplication. They can be done independently and don't touch init.tsx yet.

| Step | File                                 | What                                       | Risk                                                    |
| ---- | ------------------------------------ | ------------------------------------------ | ------------------------------------------------------- |
| 1a   | `lib/skill-metadata.ts`              | Extract shared forked_from/comparison code | Low -- pure functions, well-tested in existing commands |
| 1b   | `lib/plugin-manifest-finder.ts`      | Extract `findPluginManifest`               | Low -- trivial function                                 |
| 1c   | Consolidate `getCurrentDate` imports | Point all files to `lib/versioning.ts`     | Low -- delete/replace                                   |
| 1d   | `lib/config-saver.ts`                | Extract `saveSourceToProjectConfig`        | Low -- identical in both files                          |

After Phase 1: update `update.tsx`, `outdated.ts`, `diff.ts`, `eject.ts`, `import/skill.ts`, `version/*.ts` to use new shared utilities. Run tests.

### Phase 2: Init-specific Extractions

| Step | File                     | What                                          | Risk                                            |
| ---- | ------------------------ | --------------------------------------------- | ----------------------------------------------- |
| 2a   | `lib/config-merger.ts`   | Extract config merge logic                    | Medium -- complex merge rules                   |
| 2b   | `lib/local-installer.ts` | Extract local mode installation               | Medium -- largest extraction, many dependencies |
| 2c   | Refactor `init.tsx`      | Wire up new lib files, reduce to orchestrator | Medium -- full rewrite of structure             |

After Phase 2: init.tsx should be ~120 lines. Run full test suite.

### Phase 3: Cleanup

| Step | What                                    |
| ---- | --------------------------------------- |
| 3a   | Remove dead code from init.tsx          |
| 3b   | Verify no orphaned imports              |
| 3c   | Run `bun tsc --noEmit` to verify types  |
| 3d   | Run `bun test` to verify all tests pass |

---

## Files Modified (Complete List)

### New Files Created

1. `src/cli/lib/config-saver.ts`
2. `src/cli/lib/config-merger.ts`
3. `src/cli/lib/local-installer.ts`
4. `src/cli/lib/skill-metadata.ts`
5. `src/cli/lib/plugin-manifest-finder.ts`

### Existing Files Modified

1. `src/cli/commands/init.tsx` -- Major refactor (591 -> ~120 lines)
2. `src/cli/commands/update.tsx` -- Replace duplicated functions with imports (604 -> ~380)
3. `src/cli/commands/outdated.ts` -- Replace duplicated functions with imports (346 -> ~170)
4. `src/cli/commands/diff.ts` -- Replace `readForkedFromMetadata` with import (332 -> ~295)
5. `src/cli/commands/eject.ts` -- Replace `saveSourceToProjectConfig` with import (374 -> ~355)
6. `src/cli/commands/import/skill.ts` -- Replace `getCurrentDate` with import
7. `src/cli/commands/version/bump.ts` -- Replace `findPluginManifest` with import
8. `src/cli/commands/version/set.ts` -- Replace `findPluginManifest` with import
9. `src/cli/commands/version/show.ts` -- Replace `findPluginManifest` with import
10. `src/cli/commands/version/index.ts` -- Replace `findPluginManifest` with import
11. `src/cli/lib/skill-copier.ts` -- Replace `getCurrentDate` with import from `versioning.ts`

### Files NOT Modified (Confirmed No Changes Needed)

- `compile.ts` (544 lines -- already well-factored, delegates to `recompileAgents`)
- `search.tsx` (399 lines -- self-contained search logic)
- `edit.tsx` (247 lines -- already lean)
- `uninstall.tsx` (330 lines -- self-contained with inline UI component)
- `new/agent.tsx` (303 lines -- self-contained with inline UI component)
- `new/skill.ts` (231 lines -- already has exported helpers)
- `build/stack.tsx` (173 lines -- already lean)
- `build/plugins.ts` (96 lines -- already lean)
- `build/marketplace.ts` (141 lines -- already lean)
- `doctor.ts` (543 lines -- large but all check functions are domain-specific)
- `validate.ts` (176 lines -- delegates to validators)
- `list.ts` (32 lines -- already minimal)
- `info.ts` (281 lines -- self-contained formatting)

---

## Testing Strategy

### Existing Tests to Verify

Each extraction must pass existing tests. Key test files:

- `src/cli/lib/config-generator.test.ts`
- `src/cli/lib/skill-copier.test.ts`
- `src/cli/lib/project-config.test.ts`
- `src/cli/lib/resolver.test.ts`
- `src/cli/lib/source-loader.test.ts`

### New Tests to Create

| New Test File                                | What to Test                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/cli/lib/config-merger.test.ts`          | Merge precedence rules, union of skills/agents, deep merge of stack                  |
| `src/cli/lib/config-saver.test.ts`           | Create new config, merge with existing config                                        |
| `src/cli/lib/skill-metadata.test.ts`         | readForkedFromMetadata, compareSkills (existing tests in update/outdated cover this) |
| `src/cli/lib/local-installer.test.ts`        | Full installation flow with mocked FS                                                |
| `src/cli/lib/plugin-manifest-finder.test.ts` | Directory traversal, not found case                                                  |

---

## Risk Assessment

| Risk                                                 | Mitigation                                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Config merge logic is subtle and has many edge cases | Extract exactly as-is first, add tests before any refactoring of the merge logic itself       |
| `local-installer.ts` has many dependencies           | Keep the same dependency set as init.tsx, just move the code                                  |
| Breaking existing tests                              | Run full test suite after each phase                                                          |
| Init command behavior changes                        | This is a pure refactor -- no behavior changes. All logging happens in init.tsx command layer |

---

## Non-Goals (Explicitly Out of Scope)

- **No behavior changes** -- init.tsx should produce identical output before and after
- **No new features** -- just extraction
- **No refactoring of the extracted logic itself** -- move code as-is, clean up later
- **No changes to doctor.ts or compile.ts** -- they're large but not duplicated
- **No changes to the Wizard component** -- UI layer stays as-is
- **No changes to types** -- use existing `ProjectConfig`, `CompileConfig`, etc.
