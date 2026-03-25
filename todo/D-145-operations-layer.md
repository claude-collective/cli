# D-145: Operations Layer — Centralize Repeated Command Sequences

**Priority:** High (architectural)
**Status:** Investigate
**Date:** 2026-03-25

## Problem

The CLI has 23 commands but no intermediate abstraction between commands and lib functions. Every command manually assembles the same multi-step sequences — loading sources, detecting installations, splitting by scope, copying skills, writing config, compiling agents. This leads to ~1,775 lines of duplicated imperative code across command files.

The E2E tests solved the equivalent problem with POMs — `InitWizard.launch()` hides PTY spawning, ANSI parsing, and timing behind named operations. The application itself has no equivalent.

## Industry Research

Evaluated 7 architectural patterns against this codebase:

| Pattern | Verdict | Why |
|---------|---------|-----|
| **Operations Module (functions)** | **Adopted** | Idiomatic TS, matches existing conventions, proven by Angular/Nx/Turborepo |
| Clean Architecture (full) | Selective | Good idea (use-case layer), skip ports/adapters formalism |
| Use-Case Interactor (classes) | Skip | Too Java-flavored for zero-class codebase |
| CQRS / Mediator | Skip | Massive overkill for 23 fixed commands |
| Effect-TS / Railway | Skip | Paradigm rewrite, not a refactor |
| Facade (god object) | Skip | 23-method class = maintenance liability |
| Service Layer (classes) | Skip | Redundant with existing `lib/` domain modules |

**Best precedent:** Angular CLI's Architect/Builder pattern — pure functions with shape `(options, context) => Promise<Result>`. Nx executors and Turborepo command handlers follow the same model.

**Codebase readiness:** 5 proto-operations already exist with clear I/O contracts (`installLocal`, `buildAndMergeConfig`, `installPluginConfig`, `recompileAgents`, `loadSkillsMatrixFromSource`). Logging uses global functions (no oclif dependency). Errors throw upward. No circular deps. The operations layer is largely a re-export + composition layer on top of existing lib functions.

## Design Principles

1. **Pure composable functions** — every operation is an async function with typed inputs and typed outputs. No side-channel state, no implicit dependencies. Each operation is independently testable via vi.mock at module boundaries.
2. **Granular composition** — operations compose from smaller operations. `executeInstallation()` is built from `copyLocalSkills()` + `writeProjectConfig()` + `compileAgents()`. Commands compose the same primitives differently — edit uses `copyLocalSkills()` + `migrateSkillScope()` + `writeProjectConfig()` + `compileAgents()` in its own sequence. No operation is "command-specific."
3. **Results carry forward** — each operation returns typed data the next one consumes. No shared mutable context object.
4. **Errors propagate** — operations throw typed errors; commands catch at top level via `this.handleError()`.
5. **Scope routing is internal** — operations handle project/global splitting; commands never do scope-splitting.
6. **Logging via global logger** — operations use existing `log()`, `warn()`, `verbose()` from `utils/logger.ts` (already oclif-agnostic). No callback threading needed.

## File Structure

One file per operation, co-located tests, centralized types:

```
src/cli/lib/operations/
├── index.ts                       # Barrel export (functions + types)
├── types.ts                       # All operation input/output types
├── load-source.ts                 + load-source.test.ts
├── detect-project.ts              + detect-project.test.ts
├── copy-local-skills.ts           + copy-local-skills.test.ts
├── install-plugin-skills.ts       + install-plugin-skills.test.ts
├── uninstall-plugin-skills.ts     + uninstall-plugin-skills.test.ts
├── compare-skills.ts              + compare-skills.test.ts
├── ensure-marketplace.ts          + ensure-marketplace.test.ts
├── write-project-config.ts        + write-project-config.test.ts
├── load-agent-defs.ts             + load-agent-defs.test.ts
├── compile-agents.ts              + compile-agents.test.ts
├── execute-installation.ts        + execute-installation.test.ts
└── recompile-project.ts           + recompile-project.test.ts
```

**Naming:** Imperative verbs, no "Operation" suffix — matches existing `loadAllAgents()`, `compileAgentPlugin()`, `detectGlobalInstallation()` conventions.

**Dependency direction:** Operations import DOWN the stack (`installation/`, `loading/`, `configuration/`, `skills/`, `agents/`, `plugins/`, `matrix/`). Never import from `commands/`, `components/`, or `stores/`.

## API Surface (Detailed Signatures)

### loadSource — 9 commands

```typescript
export type LoadSourceOptions = {
  sourceFlag?: string;
  projectDir: string;
  forceRefresh?: boolean;
  captureStartupMessages?: boolean;  // default false; init/edit set true
};

export type LoadedSource = {
  sourceResult: SourceLoadResult;
  startupMessages: StartupMessage[];  // empty if captureStartupMessages=false
};
```

**Encapsulates:** `enableBuffering()` → `loadSkillsMatrixFromSource()` → `drainBuffer()` → `disableBuffering()`. Error handling cleans up buffer state on failure.

**Commands:** init, edit, update, diff, outdated, doctor, info, search, eject. NOT compile (loads from filesystem).

**Variations found:**
- init + edit: use buffering + startup messages
- 7 others: no buffering, simple call-through
- All pass sourceFlag + projectDir; some pass forceRefresh

### detectProject — 5 commands

```typescript
export type DetectedProject = {
  installation: Installation & { scope: "project" | "global" };
  config: ProjectConfig | null;
  configPath: string | null;
};
```

**Encapsulates:** `detectInstallation()` → `loadProjectConfig()` → scope derivation (compare projectDir vs homedir).

**Commands:** edit, doctor, outdated, update, info. NOT compile (needs explicit dual-scope detection, handled separately). NOT init (only checks project, shows dashboard if found).

### copyLocalSkills — 4 commands

```typescript
export type SkillCopyResult = {
  projectCopied: CopiedSkill[];
  globalCopied: CopiedSkill[];
  totalCopied: number;
};
```

**Encapsulates:** scope-split filtering → `resolveInstallPaths()` per scope → `ensureDir()` → `copySkillsToLocalFlattened()`.

**Key:** Accepts `SkillConfig[]` (not `SkillId[]`) so scope field is available for internal routing.

**Commands:** init (mixed mode), edit (added local skills), eject, search.

### installPluginSkills — 2 commands

```typescript
export type PluginInstallResult = {
  installed: Array<{ id: SkillId; ref: string }>;
  failed: Array<{ id: SkillId; error: string }>;
};
```

**Encapsulates:** per-skill `claudePluginInstall()` with scope routing (`"user"` for global, `"project"` for project).

**Commands:** init (plugin/mixed mode), edit (added plugin skills).

### uninstallPluginSkills — 1 command (edit)

```typescript
export type PluginUninstallResult = {
  uninstalled: SkillId[];
  failed: Array<{ id: SkillId; error: string }>;
};
```

**Encapsulates:** per-skill `claudePluginUninstall()` with scope lookup from old config.

### compareSkillsWithSource — 3 commands (identical code)

```typescript
export type SkillComparisonResults = {
  projectResults: SkillComparisonResult[];
  globalResults: SkillComparisonResult[];
  merged: SkillComparisonResult[];  // project takes precedence
};
```

**Encapsulates:** `buildSourceSkillsMap()` (filters non-local skills from matrix) → `compareLocalSkillsWithSource()` for project + global → merge with project precedence.

**Key finding:** diff.ts reimplements comparison inline instead of using the extracted `compareLocalSkillsWithSource()`. This operation unifies all three.

**Commands:** diff, outdated, update — currently identical code blocks.

### ensureMarketplace — 2 commands

```typescript
// Returns marketplace name or null if no marketplace configured
ensureMarketplace(sourceResult: SourceLoadResult): Promise<string | null>
```

**Encapsulates:** `claudePluginMarketplaceExists()` → `claudePluginMarketplaceAdd()` / `claudePluginMarketplaceUpdate()`.

**Commands:** init, edit — duplicated marketplace registration blocks.

### writeProjectConfig — 2 commands

```typescript
export type ConfigWriteResult = {
  config: ProjectConfig;
  configPath: string;
  globalConfigPath?: string;
  wasMerged: boolean;
  filesWritten: number;
};
```

**Encapsulates:** `buildAndMergeConfig()` → `loadAllAgents()` (CLI + source) → `ensureBlankGlobalConfig()` → `splitConfigByScope()` → `generateConfigSource()` (×2) → `writeFile()` (×2) → `writeStandaloneConfigTypes()` (×2).

**Works for both init (no existing config) and edit (merge with existing)** — the merge function handles both cases.

**Commands:** init (via installLocal/installPluginConfig), edit (inline).

### loadAgentDefs — 4 commands

```typescript
export type AgentDefs = {
  agents: Record<AgentName, AgentDefinition>;
  sourcePath: string;
};
```

**Encapsulates:** `getAgentDefinitions()` → `loadAllAgents()` for both CLI root and source.

**Commands:** edit, compile, new/agent, build/stack.

### compileAgents — 4 commands

```typescript
export type CompileAgentsOptions = {
  projectDir: string;
  sourcePath: string;
  pluginDir?: string;                   // defaults to projectDir
  skills?: SkillDefinitionMap;          // if omitted, discovers automatically
  projectConfig?: ProjectConfig | null; // if omitted, loads from disk
  agentScopeMap?: Map<AgentName, "project" | "global">;  // if omitted, derived from config
  agents?: AgentName[];                 // optional filter
  scopeFilter?: "project" | "global";  // for dual-pass compilation
  outputDir?: string;                   // defaults to {projectDir}/.claude/agents/
  installMode?: InstallMode;            // if omitted, derived from config.skills
};

export type CompilationResult = {
  compiled: AgentName[];
  failed: AgentName[];
  warnings: string[];
};
```

**Key decisions from investigation:**
- **Dual-scope stays outside** — caller invokes once or twice with `scopeFilter`. Compile calls twice; edit/update call once.
- **Skill discovery is optional** — if `skills` omitted, discovers all plugins + local across both scopes internally. If provided, uses as-is.
- **Config loading is optional** — if `projectConfig` omitted, loads from disk.

**Commands:** compile (dual-pass), edit (single-pass with scope map), update (minimal), init (via installLocal).

### executeInstallation — composed pipeline

```typescript
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
```

**Composes:** `deriveInstallMode()` → branch on mode:
- **local:** `installLocal()` (existing proto-operation)
- **plugin:** `ensureMarketplace()` → `installPluginSkills()` → `installPluginConfig()` (existing)
- **mixed:** `copyLocalSkills()` → `ensureMarketplace()` → `installPluginSkills()` → `installPluginConfig()`

**Keeps** `installLocal()` and `installPluginConfig()` as lower-level composed functions. Does not replace them.

### recompileProject — composed pipeline

```typescript
export type RecompileProjectOptions = {
  projectDir: string;
  sourceFlag?: string;
  agentSource?: string;
  verbose?: boolean;
};
```

**Composes:** `loadAgentDefs()` → detect global/project installations → `compileAgents()` (×1 or ×2).

## Composability Model

Operations are **building blocks, not command wrappers**. Every command composes them differently:

```
init:     loadSource → wizard → executeInstallation
                                  ├→ copyLocalSkills + installPluginSkills
                                  ├→ writeProjectConfig
                                  └→ compileAgents

edit:     detectProject → loadSource → wizard
          → [diff: added/removed/scope changes]
          → [migrations: detectMigrations + executeMigration]  (lib, not operation)
          → uninstallPluginSkills (removed)
          → ensureMarketplace → installPluginSkills (added plugins)
          → copyLocalSkills (added local)
          → writeProjectConfig
          → compileAgents
          → [cleanup: delete old agent files]

compile:  detect global + project installations separately
          → loadAgentDefs
          → compileAgents (global pass, scopeFilter: "global")
          → compileAgents (project pass, scopeFilter: "project")

update:   loadSource → compareSkillsWithSource → [user confirm]
          → updateSkills (per-skill copy) → compileAgents

diff:     loadSource → compareSkillsWithSource → [format diffs]

outdated: detectProject → loadSource → compareSkillsWithSource → [format table]

doctor:   detectProject → [run health checks using config + installation data]
```

**Edit is not special.** The key insight from investigation: init's primitives are *hidden* inside `installLocal()` and `installPluginConfig()`, making them non-composable for edit. Once those are exposed as operations, both commands compose the same building blocks in different sequences.

Migration detection/execution stays in `lib/skills/` and `lib/installation/` — it's domain logic, not orchestration. Operations re-export but don't wrap `detectMigrations()` and `executeMigration()`.

## Impact

| Command | Before | After | Reduction |
|---------|--------|-------|-----------|
| init.tsx | ~525 lines | ~200 lines | ~60% |
| edit.tsx | ~555 lines | ~300 lines | ~45% |
| compile.ts | ~353 lines | ~80 lines | ~77% |
| update.tsx | ~373 lines | ~200 lines | ~45% |
| diff.ts | ~297 lines | ~150 lines | ~50% |
| outdated.ts | ~203 lines | ~100 lines | ~50% |
| doctor.ts | ~444 lines | ~300 lines | ~30% |

**Total estimated reduction:** ~1,775 lines across command files.

## Testability

**vi.mock is sufficient** — no dependency injection needed. The codebase already uses module-level `vi.mock()` at test boundaries for all side-effecting operations.

**Testing tiers:**
1. **Unit:** vi.mock all dependencies, test pure logic and decision-making (fast, focused)
2. **Integration:** Real temp dirs via `createTestDirs()`, mock only external boundaries (Claude CLI, network)
3. **E2E:** Full CLI invocation via `runCliCommand()` — the hard gate for every phase

**Key patterns from investigation:**
- Mock at module boundaries using `vi.mock("../skills/skill-copier", async (importOriginal) => ({...}))`
- Keep real implementations of non-side-effect helpers via spread
- Initialize `matrix` singleton per test with `initializeMatrix()`
- Use test factories from `__tests__/helpers.ts` — never inline test data

**One test file per operation**, co-located in `operations/`. Each test file mocks its operation's direct dependencies and tests all input/output paths.

## Execution Plan

**One session.** No backwards compatibility — internal APIs can break freely. E2E tests are the only hard gate (must pass after every phase). Unit/integration tests may be temporarily disabled.

### Phase 1: Foundation operations
- Create `src/cli/lib/operations/` with `index.ts` and `types.ts`
- Extract `loadSource()` — wrap buffered loading pattern
- Extract `detectProject()` — unified installation detection + config load
- Extract `loadAgentDefs()` — wrap agent definition loading + merge
- Wire into init.tsx, edit.tsx, compile.ts as proof of concept
- **Gate:** E2E tests pass

### Phase 2: Skill operations
- Extract `copyLocalSkills()` — scope-split skill copying
- Extract `installPluginSkills()` — plugin installation with scope routing
- Extract `uninstallPluginSkills()` — plugin uninstallation
- Extract `ensureMarketplace()` — marketplace registration
- Extract `compareSkillsWithSource()` — skill comparison with `buildSourceSkillsMap()` helper
- Wire into all consuming commands
- **Gate:** E2E tests pass

### Phase 3: Config + compilation operations
- Extract `writeProjectConfig()` — consolidate 6 functions from local-installer.ts
- Extract `compileAgents()` — discovery + compilation with optional skill/config params
- Wire into init.tsx, edit.tsx, compile.ts
- **Gate:** E2E tests pass

### Phase 4: Composed pipelines + full command refactor
- Compose `executeInstallation()` from Phase 1-3 operations (keeps installLocal/installPluginConfig as lower-level)
- Compose `recompileProject()` for compile command
- Refactor ALL commands to use operations layer
- **Gate:** E2E tests pass

### Phase 5: Cleanup + operation unit tests
- Remove dead code from local-installer.ts
- Update barrel exports in lib/
- Write unit tests for each operation (one .test.ts per operation)
- Clean up or remove obsolete unit/integration tests
- **Gate:** full test suite green (E2E + new unit tests)

## Existing Proto-Operations (Ready for Direct Promotion)

| Function | Location | Promote? | Notes |
|----------|----------|----------|-------|
| `installLocal()` | `local-installer.ts:584` | Keep as-is | Used internally by `executeInstallation()` |
| `buildAndMergeConfig()` | `local-installer.ts:282` | Keep as-is | Used internally by `writeProjectConfig()` |
| `recompileAgents()` | `agent-recompiler.ts:157` | Keep as-is | Used internally by `compileAgents()` |
| `loadSkillsMatrixFromSource()` | `source-loader.ts:69` | Keep as-is | Used internally by `loadSource()` |
| `installPluginConfig()` | `local-installer.ts:492` | Keep as-is | Used internally by `executeInstallation()` |
| `compareLocalSkillsWithSource()` | `skill-metadata.ts:215` | Keep as-is | Used internally by `compareSkillsWithSource()` |
| `writeScopedConfigs()` | `local-installer.ts:369` | Keep as-is | Used internally by `writeProjectConfig()` |
| `copySkillsToLocalFlattened()` | `skill-copier.ts:200` | Keep as-is | Used internally by `copyLocalSkills()` |

Operations wrap and compose these — they don't replace them.

## Resolved Questions

| Question | Answer | Evidence |
|----------|--------|----------|
| Raw vs formatted comparison data? | **Raw** — each command formats differently (diff: unified text, outdated: table, update: action list) | Agent 6 investigation |
| One file per operation or grouped? | **One file per operation** — matches existing `loading/loader.ts`, `loading/source-loader.ts` pattern | Agent 10 investigation |
| executeInstallation derive mode internally? | **Yes** — calls `deriveInstallMode(skills)` internally, branches on result | Agent 7 investigation |
| Where do types live? | **`operations/types.ts`** — operation-specific I/O pairs; shared types stay in `src/cli/types/` | Agent 10 investigation |
| vi.mock or dependency injection? | **vi.mock** — already the pattern across 200+ test files, sufficient for all operations | Agent 9 investigation |
| Edit-specific operations needed? | **No** — edit uses the same primitives as init; migration logic stays in `lib/skills/` and `lib/installation/` | Agent 8 investigation |
| Compile dual-scope inside or outside? | **Outside** — caller invokes `compileAgents()` twice with `scopeFilter`; only compile needs this | Agent 5 investigation |
