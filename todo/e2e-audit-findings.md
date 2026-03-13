# E2E Test Code Audit — 2026-03-13

Comprehensive audit of all uncommitted E2E test files (26 files across 6 directories).

**Audit criteria:** TypeScript strictness, assertion quality, DRY principles, fixture reusability, magic values, cleanup patterns, test structure.

---

## Table of Contents

1. [Cross-Cutting Issues (Systemic)](#cross-cutting-issues)
2. [Per-File Issues](#per-file-issues)
   - [blockers/](#blockers)
   - [bugs/](#bugs)
   - [commands/](#commands)
   - [interactive/](#interactive)
   - [lifecycle/](#lifecycle)
   - [integration/](#integration)
3. [Summary Table](#summary-table)

---

## Cross-Cutting Issues

These affect multiple files and should be fixed first for maximum impact.

### CC-1: Missing shared timeout constants in test-utils.ts

**Files affected:** 15+ files
**Severity:** Medium

The following timeout constants are duplicated across many files and should be added to `test-utils.ts`:

| Constant | Value | Defined In |
|----------|-------|------------|
| `EXIT_WAIT_TIMEOUT_MS` | `30_000` | dual-scope-edit, plugin-scope-lifecycle, re-edit-cycles, source-switching, cross-scope-lifecycle, plugin-lifecycle |
| `PLUGIN_INSTALL_TIMEOUT_MS` | `60_000` | edit-wizard-plugin, init-wizard-plugin, plugin-scope-lifecycle, source-switching |
| `POLL_INTERVAL_MS` | `50` | dual-scope-edit, source-switching (also in terminal-session.ts) |

**Fix:** Add these to `test-utils.ts` alongside existing `WIZARD_LOAD_TIMEOUT_MS`, `INSTALL_TIMEOUT_MS`, etc.

Additionally, inline magic numbers for `beforeAll` and `it()` timeouts (e.g., `60_000`, `120_000`, `180_000`) should be named constants.

---

### CC-2: `waitForRawText()` duplicated — should be shared helper

**Files affected:** dual-scope-edit.e2e.test.ts, source-switching.e2e.test.ts
**Severity:** Medium

Exact same function (including `POLL_INTERVAL_MS` constant) copied between two files. Should be either:
- Added to `test-utils.ts` as a standalone function
- Added as a method on `TerminalSession`

---

### CC-3: `FORKED_FROM_METADATA` constant duplicated across 3 files

**Files affected:** plugin-uninstall.e2e.test.ts, uninstall-preservation.e2e.test.ts, (and existing uninstall.e2e.test.ts)
**Severity:** Medium

Identical constant defined in 3 separate files. Extract to `e2e/helpers/test-utils.ts`.

---

### CC-4: `COMPILE_ENV` constant duplicated across 2 files

**Files affected:** custom-agents.e2e.test.ts, eject-compile.e2e.test.ts
**Severity:** Low

`{ AGENTSINC_SOURCE: undefined }` defined identically. Extract to `test-utils.ts`.

---

### CC-5: Init wizard navigation boilerplate not extracted

**Files affected:** local-lifecycle, cross-scope-lifecycle, plugin-lifecycle (3 files)
**Severity:** Medium

The Stack -> Domain -> Build("a") -> Confirm navigation is copy-pasted identically across all 3 lifecycle files. Extract `navigateInitWizardToCompletion(session)` to `test-utils.ts`.

---

### CC-6: Build step domain traversal not extracted

**Files affected:** dual-scope-edit (~9 occurrences), source-switching (~3), re-edit-cycles
**Severity:** Medium

The "pass through Web -> API -> Shared domain build steps" pattern (`waitForText("Customize your X stack") -> delay -> enter` x3) is repeated extensively. Extract `passThroughAllBuildDomains(session)`.

---

### CC-7: No `renderMetadataYaml()` helper exists

**Files affected:** edit-agent-scope-routing, edit-skill-accumulation, edit-wizard-plugin, edit-wizard-local, plus any file using `createLocalSkill` with metadata
**Severity:** Low

Inline metadata.yaml template strings are scattered across files. Per CLAUDE.md: "NEVER write inline SKILL.md frontmatter or agent YAML template strings." A `renderMetadataYaml({ author, displayName, category, slug, contentHash, domain? })` helper should be created in `content-generators.ts`.

---

### CC-8: `renderSkillMd` not re-exported from test-utils.ts

**Files affected:** edit-wizard-plugin.e2e.test.ts (imports directly from `src/cli/lib/__tests__/content-generators.js`)
**Severity:** Low

`test-utils.ts` already imports `renderSkillMd` and `renderConfigTs` but doesn't re-export them. E2E tests should import through the helper layer, not reach into `src/cli` internals.

**Fix:** Add explicit re-exports to `test-utils.ts`.

---

### CC-9: `tempDir = undefined!` non-null assertion pattern

**Files affected:** edit-wizard-plugin, edit-wizard-local, re-edit-cycles, eject-integration, custom-agents, eject-compile
**Severity:** Low

Uses `undefined!` to assign undefined to a `string` typed variable in `afterEach` cleanup. Should declare `tempDir` as `string | undefined` and drop the `!`.

---

### CC-10: `verifyAgentCompiled` from plugin-assertions underused

**Files affected:** edit-agent-scope-routing, edit-wizard-local, eject-integration, eject-compile, custom-agents, plugin-scope-lifecycle
**Severity:** Medium

Many tests manually check `fileExists(agentPath)` + `content.startsWith("---")` instead of using the shared `verifyAgentCompiled()` helper. Similarly, `verifyConfig()` is underused in files that manually read config.ts and use string assertions.

---

### CC-11: `readFile` imported from `fs/promises` instead of `readTestFile`

**Files affected:** plugin-lifecycle, plugin-scope-lifecycle, eject-compile, uninstall-preservation
**Severity:** Low

`readTestFile` exists in `test-utils.ts` and wraps `readFile(path, "utf-8")`. Tests should use the helper for consistency.

---

### CC-12: Task IDs in `describe()` blocks

**Files affected:** plugin-build (P-BUILD-1, P-BUILD-2), plugin-uninstall (P-UNINSTALL-1/2/3), edit-agent-scope-routing ("Bug A"), edit-skill-accumulation ("Bug B"), init-wizard-plugin (P-INIT-1/2/3/4/6)
**Severity:** High — explicitly prohibited by CLAUDE.md

Remove all task ID prefixes from `describe()` block names. They can remain in file-level JSDoc comments.

---

### CC-13: Dual-scope edit test setup duplicated

**Files affected:** edit-agent-scope-routing, edit-skill-accumulation
**Severity:** Medium

Both files create nearly identical global + project installations. `createDualScopeProject` in test-utils is close but uses different skill IDs. Either parameterize it or extract a new helper.

---

### CC-14: Unnecessary `as SkillId` casts on valid union members

**Files affected:** plugin-uninstall (8 occurrences), compile-edge-cases (1), uninstall-preservation (1), edit-wizard-plugin (many), edit-wizard-local (many)
**Severity:** High — explicitly prohibited by CLAUDE.md

Per CLAUDE.md: "NEVER use `as SkillId` casts on valid union members." Strings like `"web-framework-react"` are already valid `SkillId` union members and need no cast. Only test-only IDs (e.g., `"web-custom-e2e-widget"`) need casts at construction boundaries — and those should be extracted to file-level constants with a single cast.

---

### CC-15: Ejected template path construction repeated 10+ times

**Files affected:** eject-integration (4x), eject-compile (6x)
**Severity:** Medium

`path.join(dir, CLAUDE_SRC_DIR, "agents", "_templates", "agent.liquid")` is constructed 10+ times. Extract to a helper function.

---

## Per-File Issues

### blockers/

#### home-isolation.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | TypeScript | 36,45,63,81 | `as unknown as NodeJS.ProcessEnv` double cast — prohibited by CLAUDE.md. Use `runCLI` or spread `process.env`. |
| 2 | Assertions | 39 | `expect(result.stdout.trim()).toBeTruthy()` — weak. Use `toMatch(/\d+\.\d+/)` for version. |
| 3 | Assertions | 48,66,86 | `expect(typeof result.exitCode).toBe("number")` — extremely weak. Assert specific exit codes. |
| 4 | Helper reuse | 35,44,62,76 | Uses `execCommand` from production instead of `runCLI` from test-utils. |
| 5 | Magic values | 74 | Hardcoded `".claude"` instead of `CLAUDE_DIR` constant. |

#### plugin-chain-poc.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | Magic values | 54,74 | Hardcoded `".claude"` and `".claude-plugin"` instead of constants from consts.ts. |
| 2 | Magic values | 55 | `60_000` timeout — use named constant. |
| 3 | TypeScript | 68 | `pluginDirs[0]!` non-null assertion without justification comment. |
| 4 | Fixtures | 69 | Hardcoded `"plugin.json"` — use `PLUGIN_MANIFEST_FILE` from consts. |
| 5 | Data integrity | 99 | `process.env.HOME || os.homedir()` fallback — HOME must exist on Linux, don't fall back silently. |

---

### bugs/

#### edit-agent-scope-routing.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | DRY | 84-98,140-162 | Repeated skill directory creation — should use `createLocalSkill()` helper. |
| 2 | Fixtures | 97,160 | Inline metadata.yaml template strings. |
| 3 | DRY | 76-107 | Global setup duplicated with edit-skill-accumulation (see CC-13). |
| 4 | Fixtures | 104-106,168 | Inline agent stub content. |
| 5 | Assertions | 207-230 | `verifyAgentCompiled` helper not used — manual `fileExists` + content check. |
| 6 | Structure | 42 | "Bug A" prefix in `describe()` — task ID pattern (see CC-12). |

#### edit-skill-accumulation.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | DRY | 74-104 | Nearly identical setup to edit-agent-scope-routing (see CC-13). |
| 2 | DRY | 122-136 | Repeated skill creation — should use `createLocalSkill()`. |
| 3 | Fixtures | 95,134 | Inline metadata.yaml template strings. |
| 4 | Assertions | 188-191 | Brittle JSON format check: `'"id":"web-framework-react"'` depends on exact whitespace. |
| 5 | Structure | 40 | "Bug B" prefix in `describe()` — task ID pattern (see CC-12). |

---

### commands/

#### plugin-build.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | Structure | 58,110 | `P-BUILD-1:` and `P-BUILD-2:` task IDs in `describe()` (see CC-12). |
| 2 | DRY | 77,90-91,127 | Hardcoded `".claude-plugin/plugin.json"` path — extract constant. |
| 3 | Assertions | 138 | `Array.isArray` + `.toBe(true)` — use `toBeInstanceOf(Array)`. |
| 4 | Assertions | 87,139 | `toBeGreaterThanOrEqual(1)` — `EXPECTED_SKILL_COUNT` is known (10), assert exact count. |
| 5 | Magic values | 74,84 | Hardcoded `"dist/plugins"` path — extract constant. |

#### plugin-uninstall.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | Structure | 56,188,411,575 | Task IDs in 4 `describe()` blocks (see CC-12). |
| 2 | TypeScript | 88,212,258,310,372,432,509,596 | 8x unnecessary `as SkillId` casts on valid union member (see CC-14). |
| 3 | DRY | 45-53 | `FORKED_FROM_METADATA` duplicated (see CC-3). |
| 4 | Code quality | 169 | Dynamic `import("fs/promises")` for `readdir` — should be static import. |
| 5 | DRY | 200-572 | Massive repeated project setup (7+ instances of same mkdir/writeFile pattern). Extract `createProjectWithPluginSkill()` helper. |
| 6 | Magic values | 322,447,521,628 | Hardcoded `"settings.json"` string. |

#### build-agent-plugins.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | DRY | 176-327 | Edge case tests use per-test `try/finally` instead of `beforeEach`/`afterEach` pattern. |
| 2 | Magic values | 79,111,127,146,240-244 | `"dist/plugins"` hardcoded 5+ times — extract constant. |
| 3 | Magic values | 116-117,131-134,247,316-319 | `".claude-plugin/plugin.json"` hardcoded 4+ times. |
| 4 | Magic values | 84,179,203,259,289 | `"src/skills"` path repeated 5 times — extract constant. |

#### compile-edge-cases.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | TypeScript | 42 | Unnecessary `as SkillId` on `"web-framework-react"` (valid union member). |
| 2 | Fixtures | 70-73 | Manual `renderConfigTs` + `writeFile` instead of `writeProjectConfig()` helper. |
| 3 | Assertions | 143 | `toBeGreaterThan(0)` when exact count (1 skill) is known. |
| 4 | Code quality | 19 | `renderConfigTs` import could be removed if using `writeProjectConfig()`. |

#### uninstall-preservation.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | TypeScript | 150 | Unnecessary `as SkillId` on `"web-framework-react"`. |
| 2 | DRY | 33-41 | `FORKED_FROM_METADATA` duplicated (see CC-3). |
| 3 | DRY | 44-53 | `addForkedFromMetadata` is file-local — useful across multiple test files. Extract to helpers. |
| 4 | Helper reuse | 239 | Uses raw `readFile` instead of `readTestFile` (see CC-11). |

---

### interactive/

#### edit-wizard-plugin.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | TypeScript | 77-78,147-148,231-236+ | Extensive unnecessary `as SkillId`, `as AgentName`, `as Domain` casts on valid union members. |
| 2 | TypeScript | 217 | `tempDir = undefined!` non-null assertion (see CC-9). |
| 3 | DRY | 66-127 vs 136-194 | `createPluginProject` and `createLocalProjectWithMarketplace` are nearly identical — extract shared helper. |
| 4 | Fixtures | 107-110,173-177 | Inline metadata.yaml template strings (see CC-7). |
| 5 | Fixtures | 117-120,183-187 | Inline agent .md content — extract helper or constant. |
| 6 | Magic values | 205 | `120_000` beforeAll timeout — use named constant. |
| 7 | Assertions | ~302 | Missing negative assertion (tailwind NOT in config after removal). |

#### init-wizard-plugin.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | Magic values | 43,46,59 | Duplicated timeout constants (see CC-1). |
| 2 | DRY | 120-169 | 4 separate tests each run `runFullPluginInitFlow` from scratch with identical args. Consolidate to 1-2 tests with multiple assertions. |
| 3 | Assertions | 185-186 | Marketplace registration test is extremely weak — only checks "not Failed to". |
| 4 | Cleanup | 219,259 | `sourceTempDir` created in test body but only cleaned up if test succeeds. Leak on failure. |
| 5 | Structure | 119,172,190,263 | Task IDs (P-INIT-1/2/3/4/6) in `describe()` blocks (see CC-12). |

#### edit-wizard-local.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | TypeScript | 77,139,186,240+ | Unnecessary `as SkillId` casts on valid union members. |
| 2 | TypeScript | 63 | `tempDir = undefined!` non-null assertion (see CC-9). |
| 3 | Magic values | 70,133,181,231+ | `{ timeout: 60_000 }` inline magic number on every `it()` call. |
| 4 | DRY | 67-131,132-177,179-224 | 3 "add a skill" tests share identical setup — extract helper. |
| 5 | DRY | 229-423 | 4 "remove a skill" tests share identical setup — extract helper. |
| 6 | Helper reuse | 122-128,282-288 | Manually reads config instead of using `verifyConfig()`. |
| 7 | Helper reuse | 221-223,375-376 | `directoryExists(agentsDir)` instead of `verifyAgentCompiled()`. |
| 8 | Assertions | 175 | `expect(rawOutput).toContain("+")` — `+` appears in skill IDs. Extremely weak. |
| 9 | Assertions | 333 | `expect(rawOutput).toContain("-")` — `-` appears in virtually every string. |

#### init-wizard-interactions.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | Cleanup | 60-65 | Creates new E2E source per-test (expensive) — move to `beforeAll`. |
| 2 | TypeScript | 79,81,184+ | Extensive `!` non-null assertions on `projectDir!` and `sourceDir!`. |
| 3 | Magic values | 77,181,274 | `{ timeout: 120_000 }` inline magic number on every `it()`. |
| 4 | Fragility | 207-211,318-322 | Hardcoded arrow counts (e.g., `for i < 7`) for navigation — brittle if layout changes. |
| 5 | TypeScript | 357-358 | `skillMatch![1]` non-null assertion — add type guard instead. |
| 6 | Cleanup | 44 | No `afterAll` for source fixture cleanup. |

---

### lifecycle/

#### cross-scope-lifecycle.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | Magic values | 60 | `EXIT_WAIT_TIMEOUT_MS = 30_000` defined locally (see CC-1). |
| 2 | Magic values | 83,93 | `60_000` and `180_000` inline timeout magic numbers. |
| 3 | DRY | 216-243 | Multi-domain wizard navigation repeated (see CC-6). |
| 4 | Code quality | 251 | `phase2Output` assigned but never used in any assertion. |
| 5 | Assertions | 286 | Phase 2 error detection inconsistent with Phase 1 (missing "Failed to" check). |

#### local-lifecycle.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | Magic values | 59,69 | `60_000` and `120_000` inline timeout magic numbers. |
| 2 | Assertions | 131 | `expect(mdFiles.length).toBe(2)` — better to assert specific agent names, not just count. |
| 3 | DRY | 83-101 | Init wizard navigation identical to other lifecycle files (see CC-5). |

#### plugin-lifecycle.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | Helper reuse | 2,137 | Raw `readFile` instead of `readTestFile` (see CC-11). |
| 2 | TypeScript | 138 | `JSON.parse(settingsContent)` has no type annotation — result is `any`. |
| 3 | Magic values | 50-53,69,79 | Multiple local timeout constants duplicated (see CC-1). |
| 4 | DRY | 93-111 | Init wizard navigation identical to other lifecycle files (see CC-5). |
| 5 | Assertions | 118-143 | Missing `verifyNoLocalSkills()` — should verify plugin mode doesn't copy skills locally. |
| 6 | Assertions | 134-139 | No `verifyPluginInSettings()` call — only checks `permissions` exist, not plugin registration. |
| 7 | Helper reuse | 26-27 | `INSTALL_TIMEOUT_MS` not imported — defines own `PLUGIN_INSTALL_TIMEOUT_MS` without reference. |

#### dual-scope-edit.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | DRY | 93-109 | `waitForRawText` duplicated with source-switching (see CC-2). |
| 2 | Magic values | 85 | `POLL_INTERVAL_MS = 50` defined locally (see CC-1). |
| 3 | Magic values | 83 | `EXIT_WAIT_TIMEOUT_MS = 30_000` defined locally (see CC-1). |
| 4 | DRY | 388-416,484-514+ | Wizard domain traversal repeated ~9 times (see CC-6). |
| 5 | Assertions | 428-433 | `expect(rawOutput).toContain("G ")` — single letter + space is fragile. |
| 6 | Cleanup | 367-450+ | Nested try/finally instead of afterEach — inconsistent with other files. |
| 7 | DRY | 800-815,906-918+ | Source switching navigation repeated 4 times — extract helper. |

#### plugin-scope-lifecycle.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | Magic values | 61,64 | `PLUGIN_INSTALL_TIMEOUT_MS` and `EXIT_WAIT_TIMEOUT_MS` defined locally (see CC-1). |
| 2 | Helper reuse | 251,270 | Uses raw `readFile` instead of `readTestFile` (see CC-11). |
| 3 | Helper reuse | — | `verifyAgentCompiled` not imported — manual file+frontmatter checks. |
| 4 | Unused import | 18 | `readTestFile` imported but never used (uses raw `readFile` instead). |

#### re-edit-cycles.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | Magic values | 33 | `EXIT_WAIT_TIMEOUT_MS = 30_000` defined locally (see CC-1). |
| 2 | Structure | 30 | "Gap 5" reference in JSDoc — couples to tracking document. |
| 3 | DRY | 152-183 | `navigateMultiDomainEditToCompletion` partially overlaps with shared helper. |
| 4 | TypeScript | 209,357 | `tempDir = undefined!` non-null assertion (see CC-9). |
| 5 | Semantics | 255 | `INSTALL_TIMEOUT_MS` used for `waitForExit()` — wrong semantic constant. |
| 6 | Untested | 57-131 | `parseConfigArrays` (131 lines of regex parsing) has no unit tests and is file-local. |

#### source-switching.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | DRY | 68-84 | `waitForRawText` duplicated (see CC-2). |
| 2 | Magic values | 53,56,58 | `PLUGIN_INSTALL_TIMEOUT_MS`, `EXIT_WAIT_TIMEOUT_MS`, `POLL_INTERVAL_MS` all defined locally. |
| 3 | DRY | 132-201,210-252 | `initLocal` and `initPlugin` share common prefix (Stack + Domain selection). |
| 4 | DRY | 318-329,416-427,530-541 | Build step domain traversal repeated 3 times (see CC-6). |
| 5 | DRY | 332-344,429-441,543-562 | Sources customize navigation repeated 3 times. |
| 6 | Assertions | 583 | `expect(rawOutput).toMatch(/[Ss]witch|[Ii]nstall/)` — extremely broad regex. |
| 7 | Helper reuse | 585-589 | Manual config read instead of `verifyConfig()` (inconsistent with tests 9a/9b which DO use it). |
| 8 | Fragility | 98-122 | `injectMarketplaceIntoConfig` does string manipulation — fragile if config format changes. |

---

### integration/

#### eject-integration.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | TypeScript | 37 | `tempDir = undefined!` non-null assertion (see CC-9). |
| 2 | DRY | 50-56,131-137,169-175,197-203 | Template path construction repeated 4 times (see CC-15). |
| 3 | Assertions | 85-119 | `expect(foundAgent).toBe(true)` — failure message gives no context. Use descriptive error. |
| 4 | Magic values | 53-54 | `"agents"`, `"_templates"`, `"agent.liquid"` hardcoded. |
| 5 | Structure | 26 | "Gap 7" reference in comment — couples to tracking document. |

#### custom-agents.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | TypeScript | 68 | `tempDir = undefined!` non-null assertion (see CC-9). |
| 2 | TypeScript | 88,158,213+ | 6x `as SkillId` casts on test-only ID — extract file-level constant with single cast. |
| 3 | DRY | 86-93,156-163,211-223,239-243 | 4x nearly identical `writeProjectConfig` calls — extract helper. |
| 4 | DRY | 20-22 | `COMPILE_ENV` duplicated (see CC-4). |
| 5 | Assertions | 224,251 | `expect(combined).toMatch(/failed|error|workflow/i)` — extremely loose regex. |
| 6 | Assertions | 245 | Missing `exitCode` assertion — unclear if compile should succeed or fail. |

#### eject-compile.e2e.test.ts

| # | Category | Lines | Description |
|---|----------|-------|-------------|
| 1 | TypeScript | 36 | `tempDir = undefined!` non-null assertion (see CC-9). |
| 2 | TypeScript | 216,225,229 | 3x `as SkillId` casts — extract file-level constants. |
| 3 | DRY | 52-58,96-102,241-247,288-294,318-324,352-358 | Template path constructed 6 times (see CC-15). |
| 4 | DRY | 41-84,86-121,207-269 | Eject+modify+compile pattern repeated 3 times — extract helper. |
| 5 | DRY | 21-23 | `COMPILE_ENV` duplicated (see CC-4). |
| 6 | Helper reuse | 62,103,248,325,362 | Uses raw `readFile` in some places, `readTestFile` in others. Inconsistent. |
| 7 | TypeScript | 179 | `foundIntroPath!` non-null assertion — add type guard. |
| 8 | Assertions | 193-202 | `foundMarker` boolean flag — "expected false to be true" gives no context. |
| 9 | Helper reuse | throughout | `verifyAgentCompiled` not used — manual file existence + frontmatter check. |

---

## Summary Table

| Directory | File | Issues | Critical | Medium | Low |
|-----------|------|--------|----------|--------|-----|
| blockers | home-isolation | 5 | 1 | 2 | 2 |
| blockers | plugin-chain-poc | 5 | 0 | 3 | 2 |
| bugs | edit-agent-scope-routing | 6 | 1 | 3 | 2 |
| bugs | edit-skill-accumulation | 5 | 1 | 2 | 2 |
| commands | plugin-build | 5 | 1 | 2 | 2 |
| commands | plugin-uninstall | 6 | 2 | 2 | 2 |
| commands | build-agent-plugins | 4 | 0 | 2 | 2 |
| commands | compile-edge-cases | 4 | 1 | 1 | 2 |
| commands | uninstall-preservation | 4 | 1 | 2 | 1 |
| interactive | edit-wizard-plugin | 7 | 1 | 4 | 2 |
| interactive | init-wizard-plugin | 5 | 1 | 3 | 1 |
| interactive | edit-wizard-local | 9 | 1 | 5 | 3 |
| interactive | init-wizard-interactions | 6 | 0 | 4 | 2 |
| lifecycle | cross-scope-lifecycle | 5 | 0 | 3 | 2 |
| lifecycle | local-lifecycle | 3 | 0 | 2 | 1 |
| lifecycle | plugin-lifecycle | 7 | 1 | 4 | 2 |
| lifecycle | dual-scope-edit | 7 | 0 | 5 | 2 |
| lifecycle | plugin-scope-lifecycle | 4 | 0 | 3 | 1 |
| lifecycle | re-edit-cycles | 6 | 0 | 3 | 3 |
| lifecycle | source-switching | 8 | 0 | 5 | 3 |
| integration | eject-integration | 5 | 0 | 2 | 3 |
| integration | custom-agents | 6 | 0 | 4 | 2 |
| integration | eject-compile | 9 | 0 | 5 | 4 |
| **Cross-cutting** | **CC-1 through CC-15** | **15** | **3** | **8** | **4** |
| **TOTAL** | **26 files** | **~149** | **12** | **69** | **47** |

---

## Fix Status

**All fixes applied 2026-03-13. Verified: tsc --noEmit (0 new errors), npm test (3298 passed), E2E (485 passed across 56 files).**

### Phase 1: Shared infrastructure — DONE
1. [x] **CC-1:** Add shared timeout constants to `test-utils.ts`
2. [x] **CC-2:** Extract `waitForRawText()` to shared helper
3. [x] **CC-3:** Extract `FORKED_FROM_METADATA` to shared helper
4. [x] **CC-4:** Extract `COMPILE_ENV` to shared helper
5. [x] **CC-5:** Extract `navigateInitWizardToCompletion()` to `test-utils.ts`
6. [x] **CC-6:** Extract `passThroughAllBuildDomains()` helper
7. [x] **CC-8:** Re-export `renderSkillMd`, `renderConfigTs` from `test-utils.ts`
8. [x] **CC-15:** Extract `getEjectedTemplatePath()` helper

### Phase 2: CLAUDE.md violations — DONE
9. [x] **CC-12:** Remove all task IDs from `describe()` blocks (plugin-build, plugin-uninstall, edit-agent-scope-routing, edit-skill-accumulation, edit-wizard-plugin, init-wizard-plugin)
10. [x] **CC-14:** Remove unnecessary `as SkillId`/`as AgentName`/`as Domain` casts on valid union members (plugin-uninstall, compile-edge-cases, uninstall-preservation, edit-wizard-plugin, edit-wizard-local)
11. [x] **CC-9:** Fix `tempDir = undefined!` non-null assertions (edit-wizard-plugin, edit-wizard-local, re-edit-cycles, eject-integration, custom-agents, eject-compile)

### Phase 3: Helper usage — DONE
12. [x] **CC-11:** Replace raw `readFile` with `readTestFile` (uninstall-preservation, plugin-lifecycle, plugin-scope-lifecycle, eject-compile)
13. [x] **CC-15:** Replace template path constructions with `getEjectedTemplatePath` (eject-integration 4x, eject-compile 6x)
14. [x] **CC-4:** Replace local `COMPILE_ENV` with import (custom-agents, eject-compile)
15. [x] **CC-3:** Replace local `FORKED_FROM_METADATA` with import (plugin-uninstall, uninstall-preservation)
16. [x] **CC-2:** Replace local `waitForRawText` with import (dual-scope-edit, source-switching)
17. [x] **CC-1:** Replace local timeout constants with imports (12+ files)
18. [x] **CC-5:** Replace init wizard navigation with `navigateInitWizardToCompletion` (local-lifecycle, cross-scope-lifecycle, plugin-lifecycle)
19. [x] **CC-6:** Replace 3-domain build traversal with `passThroughAllBuildDomains` (cross-scope-lifecycle)
20. [x] Consolidate `as SkillId` casts into file-level constants for test-only IDs (custom-agents, eject-compile)
21. [x] Replace `createLocalSkill` for manual skill creation (edit-agent-scope-routing, edit-skill-accumulation)

### Round 2 fixes — DONE

**Verified: tsc --noEmit (0 new errors), npm test (3298 passed), E2E (485 passed across 56 files).**

22. [x] Replace remaining raw `readFile`/`readdir` with `readTestFile`/`listFiles` (plugin-build, plugin-uninstall, build-agent-plugins, dual-scope-edit, source-switching)
23. [x] Replace remaining magic timeouts with named constants (plugin-build, build-agent-plugins, plugin-chain-poc, edit-agent-scope-routing, edit-skill-accumulation, dual-scope-edit, plugin-scope-lifecycle, re-edit-cycles, source-switching)
24. [x] Fix `renderSkillMd` import path — use test-utils re-export (plugin-uninstall, compile-edge-cases)
25. [x] Fix hardcoded `".claude-plugin"` in home-isolation with `PLUGIN_MANIFEST_DIR`
26. [x] Fix `pluginDirs[0]!` non-null assertion in plugin-chain-poc with type guard
27. [x] Fix weak assertions `toContain("+")` / `toContain("-")` in edit-wizard-local → `toMatch(/\d+ added/)` / `toMatch(/\d+ removed/)`
28. [x] Use `verifyConfig` in edit-wizard-local (replaced 2 manual config reads)
29. [x] Use `verifyAgentCompiled` in edit-wizard-local (replaced 2 directoryExists checks), custom-agents, eject-compile
30. [x] Use `verifySkillCopiedLocally` in edit-wizard-local (replaced manual fileExists check)
31. [x] Fix regex match `skillMatch![1]` non-null assertion in init-wizard-interactions with optional chaining
32. [x] Use `passThroughAllBuildDomains` in dual-scope-edit (6 replacements in it blocks)
33. [x] Use `navigateInitWizardToCompletion` in re-edit-cycles
34. [x] Fix `tempDir = undefined!` in source-switching
35. [x] Fix unused destructured `combined` in custom-agents
36. [x] Fix `foundIntroPath!` non-null assertion in eject-compile with type guard

### Phase 4: Remaining (low priority — diminishing returns)
- [ ] **CC-7:** Create `renderMetadataYaml()` helper in content-generators.ts
- [ ] **CC-13:** Extract shared dual-scope edit setup helper for bugs/ files
- [ ] Consolidate `createPluginProject`/`createLocalProjectWithMarketplace` in edit-wizard-plugin
- [ ] Extract `navigateToSourceCustomize()` helper for dual-scope-edit/source-switching
- [ ] Extract per-test source creation to beforeAll in init-wizard-interactions
- [ ] Fix sourceTempDir cleanup leak in init-wizard-plugin local-mode-fallback test
- [ ] Add cast justification comments for test-only SkillId casts in compile-edge-cases
- [ ] Unit test `parseConfigArrays` in re-edit-cycles or extract to shared helper
- [ ] Reduce non-null assertions on `projectDir!`/`sourceDir!` in init-wizard-interactions
