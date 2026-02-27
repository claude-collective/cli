# T-12: End-to-End Tests for Custom Marketplace Workflow

## Open Questions

### Q1: Internal functions vs CLI binary invocation?

The existing "integration" tests in `src/cli/lib/__tests__/integration/` all call internal functions directly (e.g., `installLocal()`, `loadStacks()`, `extractAllSkills()`). They never invoke the CLI binary. The `runCliCommand()` helper in `helpers.ts` does exist and can invoke oclif commands (it intercepts stdout/stderr and handles errors), but it is only used by command-level tests in `__tests__/commands/`.

**Recommendation: Use internal functions for the core workflow tests.** Reasons:

- The existing integration test patterns call internal functions, and we should follow the established convention.
- Internal function calls give us deterministic control over state (no wizard UI prompts to mock, no interactive confirmation prompts).
- The `outdated` command already has its own command-level test at `__tests__/commands/outdated.test.ts` that tests CLI flag parsing. We do not need to duplicate that.
- The `build marketplace` and `build plugins` commands are thin wrappers around `generateMarketplace()` and `compileAllSkillPlugins()` — testing those functions directly is sufficient.
- A separate `runCliCommand()` test could be added later if desired, but is not necessary for validating the workflow.

One exception: consider adding a single `runCliCommand(["outdated", "--source", dirs.sourceDir, "--json"])` test to verify the JSON output contract end-to-end. The `--json` flag makes assertion straightforward.

### Q2: How to handle versioning in fixtures?

The versioning system uses content hashes (SHA-256 of `SKILL.md` content) stored in `.content-hash` files and `plugin.json` manifests. The `determinePluginVersion()` function in `versioning.ts` bumps the major version when the content hash changes.

**Recommendation:** Use `computeSkillFolderHash()` from `versioning.ts` to compute real content hashes during fixture setup. This is what `createTestSource()` already does (line 630 of `create-test-source.ts`). For the outdated detection flow, we need:

1. Install skills (which writes `forkedFrom.contentHash` into each skill's `metadata.yaml`).
2. Modify the source skill content (overwrite `SKILL.md` in the source directory).
3. The hash will naturally change because the content changed.

No mock hashing needed — the real hashing functions are fast and deterministic.

### Q3: Does `createTestSource()` need extensions?

Current capabilities of `createTestSource()`:

- Creates source directory with `src/skills/`, `src/agents/`, `config/`
- Writes `skills-matrix.yaml`, `stacks.yaml`
- Writes SKILL.md + metadata.yaml for each skill with content hashes
- Creates project directory with optional `.claude/config.yaml` and `.claude/skills/`
- Creates plugin layout with `.claude-plugin/plugin.json`
- Creates local skills with optional `forkedFrom` metadata

**What we need that does NOT currently exist:**

1. **`marketplace.json` generation** — `createTestSource()` does not produce a `marketplace.json` file. The `build marketplace` flow reads from `dist/plugins/` (compiled plugin directories), not from `src/skills/`. We need to either:
   - (a) Call `compileAllSkillPlugins()` + `generateMarketplace()` as part of the test setup to produce real compiled plugins and marketplace.json, OR
   - (b) Add a helper to create a minimal `marketplace.json` fixture directly.

   Option (a) is preferred because it tests the actual build pipeline and ensures the marketplace.json is consistent with the skill content.

2. **Consuming project with installed skills** — For the outdated/update tests, we need a project that already has skills installed (with `forkedFrom` metadata). The current `createTestSource({ localSkills, asPlugin })` can create a plugin layout with skills, but for the local-mode outdated flow we need `installLocal()` to have run (which creates the proper `forkedFrom` metadata). We should call `installLocal()` as part of the test setup, following the pattern in `init-flow.integration.test.ts`.

**Recommendation: No changes to `createTestSource()` are needed.** The existing fixture plus calling `installLocal()`, `compileAllSkillPlugins()`, and `generateMarketplace()` in sequence covers the full lifecycle.

---

## Current State Analysis

### Existing Test Infrastructure

| Component                        | Status             | Key Files                                                              |
| -------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| `createTestSource()`             | Complete           | `fixtures/create-test-source.ts` — creates source + project dirs       |
| `installLocal()`                 | Tested             | `init-flow.integration.test.ts`, `init-end-to-end.integration.test.ts` |
| `compareLocalSkillsWithSource()` | Unit tested        | `skill-metadata.test.ts`                                               |
| `compileAllSkillPlugins()`       | Unit tested        | `skill-plugin-compiler.test.ts`                                        |
| `generateMarketplace()`          | Unit tested        | `__tests__/commands/build/marketplace.test.ts`                         |
| `recompileAgents()`              | Unit tested        | `agent-recompiler.test.ts`                                             |
| `loadSkillsMatrixFromSource()`   | Integration tested | Used across integration tests                                          |
| `buildWizardResult()`            | Helper             | `helpers.ts` — builds wizard result without UI                         |
| `buildSourceResult()`            | Helper             | `helpers.ts` — builds source result from matrix + path                 |
| `runCliCommand()`                | Helper             | `helpers.ts` — invokes oclif commands in-process                       |

### What Is NOT Tested

The following cross-cutting workflow has no integration test coverage:

1. **Source -> Build Plugins -> Build Marketplace -> Install -> Outdated -> Update cycle** — each step is tested in isolation, but the full chain is untested.
2. **`--source` flag with a local path through `loadSkillsMatrixFromSource()`** — tested in unit tests, but not in a full install-then-check-outdated flow.
3. **Version bumping after skill content changes** — tested at the `determinePluginVersion()` level, but not through `build plugins` -> `outdated`.
4. **`update` command with `--yes` flag** — the update command copies updated skill content and recompiles agents, but this full flow is not integration tested.

---

## Test Scenarios

### Scenario 1: `--source` flag loads skills from custom marketplace

**Goal:** Verify that `loadSkillsMatrixFromSource({ sourceFlag: localPath })` loads skills from a custom local source, and that `installLocal()` writes the correct config referencing that source.

**Setup:**

```
createTestSource() -> { sourceDir, projectDir, skillsDir }
```

**Actions:**

1. Call `loadSkillsMatrixFromSource({ sourceFlag: dirs.sourceDir, projectDir: dirs.projectDir })`.
2. Verify the returned `SourceLoadResult` has `isLocal: true` and `sourcePath` pointing to the fixture.
3. Verify `matrix.skills` contains the expected skills from `DEFAULT_TEST_SKILLS`.
4. Call `installLocal()` with the loaded matrix, selected skills, and `sourceFlag: dirs.sourceDir`.
5. Read the generated `.claude-src/config.yaml`.

**Assertions:**

- `sourceResult.isLocal === true`
- `sourceResult.sourcePath === dirs.sourceDir` (or resolved equivalent)
- `matrix.skills["web-framework-react"]` exists with correct path
- Generated `config.yaml` contains `source: <dirs.sourceDir>` (the source flag is recorded)
- Generated `config.yaml` lists the selected skills
- Skill files exist in `.claude/skills/` with `forkedFrom` metadata

**Complexity:** Low — follows existing pattern from `init-flow.integration.test.ts`.

---

### Scenario 2: `outdated` detects stale skills after source change

**Goal:** After installing from a custom marketplace, modify a skill in the source, then verify `compareLocalSkillsWithSource()` reports it as outdated.

**Setup:**

```
createTestSource() -> install skills via installLocal() -> modify source skill
```

**Actions:**

1. Create test source with `createTestSource()`.
2. Build matrix via `loadSkillsMatrixFromSource()` (or `createMockMatrix()` with matching paths).
3. Install skills via `installLocal()` with selected skills.
4. Read the installed skill's `metadata.yaml` to capture the `forkedFrom.contentHash`.
5. Modify the source skill's `SKILL.md` content (overwrite with different text).
6. Call `compareLocalSkillsWithSource(projectDir, sourcePath, sourceSkills)`.

**Assertions:**

- Before modification: all skills report `status: "current"`.
- After modification: the modified skill reports `status: "outdated"` with different `localHash` and `sourceHash`.
- Unmodified skills still report `status: "current"`.

**Complexity:** Medium — requires careful hash tracking. The `forkedFrom.contentHash` is set by `installLocal()` via `injectForkedFromMetadata()`.

---

### Scenario 3: Full build plugins pipeline produces versioned output

**Goal:** Verify that `compileAllSkillPlugins()` produces plugin directories with `plugin.json` manifests, and that rebuilding after a change bumps the version.

**Setup:**

```
createTestSource() -> compile skills to dist/plugins/
```

**Actions:**

1. Create test source with `createTestSource()`.
2. Call `compileAllSkillPlugins(dirs.skillsDir, outputDir)` to produce compiled plugins.
3. Verify each plugin has `.claude-plugin/plugin.json` with `version: "1.0.0"`.
4. Modify a skill's `SKILL.md` in the source.
5. Call `compileAllSkillPlugins()` again.
6. Verify the modified skill's plugin has `version: "2.0.0"` (version bumped).
7. Verify unmodified skills remain at `version: "1.0.0"`.

**Assertions:**

- Initial compile produces N plugins matching N skills.
- Each plugin has valid `plugin.json` with `name`, `version`, `description`.
- After content change, version is bumped for the changed skill only.
- Content hash file `.content-hash` exists in each plugin's `.claude-plugin/` directory.

**Complexity:** Medium — follows pattern from `install-compile.test.ts`.

---

### Scenario 4: Build marketplace from compiled plugins

**Goal:** Verify that `generateMarketplace()` produces a valid `marketplace.json` from compiled plugins.

**Setup:**

```
createTestSource() -> compileAllSkillPlugins() -> generateMarketplace()
```

**Actions:**

1. Create test source and compile plugins (from Scenario 3 setup).
2. Call `generateMarketplace(outputDir, marketplaceOptions)`.
3. Call `writeMarketplace(marketplacePath, marketplace)`.
4. Read and parse the written `marketplace.json`.

**Assertions:**

- `marketplace.json` exists.
- `marketplace.name` matches the provided name.
- `marketplace.plugins` array has entries matching compiled skills.
- Each plugin entry has `name`, `source`, `version`, `category`.
- `getMarketplaceStats()` returns correct counts.

**Complexity:** Low — straightforward function calls.

---

### Scenario 5: Full change-build-update cycle

**Goal:** Test the complete lifecycle: install from source, change source, rebuild, detect outdated, update, verify updated content.

**Setup:**

```
createTestSource() -> installLocal() -> modify source -> recompile -> outdated -> update
```

**Actions:**

1. Create test source with `createTestSource()`.
2. Load matrix via `loadSkillsMatrixFromSource({ sourceFlag: dirs.sourceDir })`.
3. Install skills via `installLocal()`.
4. Verify installed skills have `forkedFrom` metadata with content hashes.
5. Modify a source skill's `SKILL.md` (append or change content).
6. Reload matrix from source (simulate what `edit --refresh` does).
7. Call `compareLocalSkillsWithSource()` to detect outdated skills.
8. Verify the modified skill is reported as `"outdated"`.
9. Copy the updated skill content from source to the local project (simulate what `update` does — call the `updateSkill()` helper pattern from `update.tsx`).
10. Call `injectForkedFromMetadata()` with the new hash.
11. Call `recompileAgents()` to recompile with updated skill content.
12. Call `compareLocalSkillsWithSource()` again.
13. Verify all skills now report `status: "current"`.

**Assertions:**

- Step 4: `forkedFrom.contentHash` matches the source hash at install time.
- Step 8: Modified skill is `"outdated"`, others are `"current"`.
- Step 11: `recompileAgents()` succeeds, returns compiled agent names.
- Step 13: All skills now report `"current"` (the local hash matches the new source hash).
- The installed skill's `SKILL.md` content now contains the modified text.

**Complexity:** High — this is the most comprehensive scenario, touching install, compare, update, and recompile.

---

### Scenario 6: Outdated command JSON output (optional CLI binary test)

**Goal:** Verify the `outdated` command produces correct JSON output through the CLI binary.

**Setup:**

```
createTestSource() -> installLocal() -> modify source -> runCliCommand(["outdated", "--json", "--source", sourcePath])
```

**Actions:**

1. Set up a project with installed skills (same as Scenario 5 steps 1-5).
2. Change `process.cwd()` to the project directory.
3. Call `runCliCommand(["outdated", "--json", "--source", dirs.sourceDir])`.
4. Parse the JSON output.

**Assertions:**

- Command exits with `EXIT_CODES.ERROR` (because there are outdated skills).
- JSON output has `skills` array with the outdated skill's `status: "outdated"`.
- JSON output has `summary.outdated >= 1`.

**Complexity:** Medium — uses `runCliCommand()`, requires careful `process.cwd()` management.

**Note:** This is the only scenario that invokes the CLI binary. It is optional and could be deferred.

---

## Fixture Requirements

### No changes needed to `createTestSource()`

The existing `createTestSource()` is sufficient. The test setup will:

1. Call `createTestSource()` for the source directory with skills and agents.
2. Call `installLocal()` for the consuming project (creates `.claude/skills/` with `forkedFrom` metadata).
3. Call `compileAllSkillPlugins()` for the build pipeline scenarios.
4. Call `generateMarketplace()` for the marketplace generation scenario.

### Helper functions to add

The following small helper should be added to the test file (not to `helpers.ts`, since it is specific to this test):

```typescript
/** Modify a source skill's SKILL.md to produce a different content hash */
async function modifySourceSkill(
  skillsDir: string,
  category: string,
  skillName: string,
  appendedContent: string,
): Promise<void> {
  const skillMdPath = path.join(skillsDir, category, skillName, "SKILL.md");
  const existing = await readFile(skillMdPath, "utf-8");
  await writeFile(skillMdPath, existing + appendedContent);
}
```

---

## Test Architecture

### File Organization

```
src/cli/lib/__tests__/integration/
  custom-marketplace-workflow.integration.test.ts    # NEW — all T-12 scenarios
```

One file with multiple `describe` blocks:

```typescript
describe("Custom Marketplace Workflow", () => {
  describe("source flag loads custom marketplace skills", () => { ... });    // Scenario 1
  describe("outdated detection after source change", () => { ... });         // Scenario 2
  describe("build plugins version bumping", () => { ... });                  // Scenario 3
  describe("marketplace generation from plugins", () => { ... });            // Scenario 4
  describe("full change-build-update cycle", () => { ... });                 // Scenario 5
  describe("outdated command JSON output", () => { ... });                   // Scenario 6 (optional)
});
```

### Shared Setup

All scenarios share a similar setup pattern:

```typescript
let dirs: TestDirs;

beforeEach(async () => {
  dirs = await createTestSource();
});

afterEach(async () => {
  await cleanupTestSource(dirs);
});
```

Scenarios that need an installed project will call `installLocal()` in the test body (not `beforeEach`), because the install parameters vary per scenario.

### Cleanup

Use `cleanupTestSource(dirs)` which delegates to `cleanupTempDir()` with retry logic for transient `ENOTEMPTY` errors.

### Imports

```typescript
import {
  createTestSource,
  cleanupTestSource,
  DEFAULT_TEST_SKILLS,
  type TestDirs,
} from "../fixtures/create-test-source";
import { installLocal } from "../../installation/local-installer";
import { compileAllSkillPlugins } from "../../skills/skill-plugin-compiler";
import {
  generateMarketplace,
  writeMarketplace,
  getMarketplaceStats,
} from "../../marketplace-generator";
import { loadSkillsMatrixFromSource } from "../../loading/source-loader";
import {
  compareLocalSkillsWithSource,
  injectForkedFromMetadata,
} from "../../skills/skill-metadata";
import { recompileAgents } from "../../agents/agent-recompiler";
import { computeSkillFolderHash } from "../../versioning";
import {
  buildWizardResult,
  buildSourceResult,
  createMockMatrix,
  readTestYaml,
  fileExists,
} from "../helpers";
```

---

## Step-by-Step Implementation Plan

### Phase 1: Scaffold and Scenario 1 (source flag loading)

**Estimated effort:** Small

1. Create `custom-marketplace-workflow.integration.test.ts`.
2. Set up shared `beforeEach`/`afterEach` with `createTestSource()`/`cleanupTestSource()`.
3. Implement Scenario 1 — the simplest test that validates `--source` flag resolution.
4. Run tests, verify pass.

### Phase 2: Scenario 2 (outdated detection)

**Estimated effort:** Medium

1. Add the `modifySourceSkill()` local helper.
2. Implement Scenario 2 — install, modify source, compare.
3. This is the core of the outdated workflow. Verify that `forkedFrom` metadata is written correctly by `installLocal()`.
4. Run tests, verify pass.

### Phase 3: Scenario 3 (build plugins versioning)

**Estimated effort:** Medium

1. Implement Scenario 3 — compile plugins, verify versions, modify, recompile.
2. Requires a separate `outputDir` for compiled plugins (use `path.join(dirs.tempDir, "dist")`).
3. Run tests, verify pass.

### Phase 4: Scenario 4 (marketplace generation)

**Estimated effort:** Small

1. Implement Scenario 4 — generate marketplace from compiled plugins.
2. Builds on Phase 3's setup.
3. Run tests, verify pass.

### Phase 5: Scenario 5 (full lifecycle)

**Estimated effort:** Large

1. Implement Scenario 5 — the full install-modify-outdated-update-recompile cycle.
2. This is the most complex scenario and ties everything together.
3. Must handle: `installLocal()`, content modification, `compareLocalSkillsWithSource()`, skill copying, `injectForkedFromMetadata()`, `recompileAgents()`.
4. Run tests, verify pass.

### Phase 6 (Optional): Scenario 6 (CLI binary test)

**Estimated effort:** Medium

1. Implement Scenario 6 — uses `runCliCommand()`.
2. Requires managing `process.cwd()` (save/restore in beforeEach/afterEach).
3. Parses JSON output from the `outdated` command.
4. Can be deferred if the internal-function tests provide sufficient coverage.

---

## Edge Cases

### Content hash stability

**Risk:** `computeSkillFolderHash()` hashes `SKILL.md` and directories like `examples/`. If the test creates additional files in the skill directory, the hash will include them. Tests should only modify `SKILL.md` to produce predictable hash changes.

### `process.cwd()` dependency

**Risk:** Several functions (like `loadSkillsMatrixFromSource`, `resolveSource`) use `process.cwd()` internally. The `outdated` and `update` commands read `LOCAL_SKILLS_PATH` relative to `process.cwd()`.

**Mitigation:** For Scenario 6 (CLI binary), save and restore `process.cwd()`. For internal function tests, pass `projectDir` explicitly.

### `PROJECT_ROOT` constant

**Risk:** `loadAndMergeFromBasePath()` in `source-loader.ts` reads the CLI's own `config/skills-matrix.yaml` via `PROJECT_ROOT`. This means even tests using a custom source will merge the CLI's built-in categories with the source's categories.

**Mitigation:** This is expected behavior — the tests should verify that custom source skills are present in the merged matrix, not that CLI categories are absent. The integration tests in `consumer-stacks-matrix.integration.test.ts` already account for this.

### Schema extension side effects

**Risk:** `discoverAndExtendFromSource()` calls `extendSchemasWithCustomValues()` which mutates global Zod schema registries. This could affect subsequent tests.

**Mitigation:** The default test skills use standard skill IDs (like `web-framework-react`) that are already in the built-in schemas, so no custom values are needed and `extendSchemasWithCustomValues()` is not triggered. However, if future tests introduce truly custom skill IDs, domains, or categories, `resetSchemaExtensions()` from `schemas.ts` must be called in `afterEach` to clear the global `customExtensions` sets. This reset function exists and is already used in `schemas.test.ts`, `source-switcher.test.ts`, and `stacks-loader.test.ts` as the established cleanup pattern.

### Concurrent test execution

**Risk:** Vitest runs tests in the same file sequentially but may run different files in parallel. Since each test uses `createTempDir()` with unique prefixes, there is no risk of directory collision.

### Marketplace-less source

**Risk:** The `loadFromLocal()` path in `source-loader.ts` does not require a `marketplace.json`. The outdated/update flows work with local paths that have no marketplace. The marketplace generation scenario (Scenario 4) is about the build side, not the consumer side.

---

## Feasibility Assessment

### Straightforward (can implement immediately)

| Scenario                    | Reason                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1: Source flag loading      | Direct function calls, follows `init-flow.integration.test.ts` pattern exactly                             |
| 2: Outdated detection       | `compareLocalSkillsWithSource()` is well-tested; just need install + modify + compare                      |
| 3: Build plugins versioning | `compileAllSkillPlugins()` is well-tested; version bumping via `determinePluginVersion()` is deterministic |
| 4: Marketplace generation   | `generateMarketplace()` is a pure function reading plugin directories                                      |

### Needs careful implementation

| Scenario           | Challenge                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 5: Full lifecycle  | Longest setup chain, must coordinate install/modify/compare/update/recompile. Risk of test being fragile due to file system state dependencies. |
| 6: CLI binary test | `process.cwd()` management, stdout capture, exit code checking. `runCliCommand()` helper exists but this specific flow is untested.             |

### Potential blockers

None identified. All required internal functions are exported and well-documented. The fixture infrastructure (`createTestSource`, `installLocal`, `buildWizardResult`, `buildSourceResult`) provides everything needed.

---

## Files Changed/Created Summary

| File                                                                                | Action     | Purpose                         |
| ----------------------------------------------------------------------------------- | ---------- | ------------------------------- |
| `src/cli/lib/__tests__/integration/custom-marketplace-workflow.integration.test.ts` | **Create** | All 5-6 test scenarios for T-12 |

No changes to existing files are expected. The test file uses only existing exported functions and helpers.

### Dependencies (all existing, no new packages)

- `create-test-source.ts` — fixture creation
- `helpers.ts` — `buildWizardResult`, `buildSourceResult`, `createMockMatrix`, `readTestYaml`, `fileExists`, `runCliCommand` (for optional Scenario 6)
- `local-installer.ts` — `installLocal()`
- `skill-plugin-compiler.ts` — `compileAllSkillPlugins()`
- `marketplace-generator.ts` — `generateMarketplace()`, `writeMarketplace()`, `getMarketplaceStats()`
- `source-loader.ts` — `loadSkillsMatrixFromSource()`
- `skill-metadata.ts` — `compareLocalSkillsWithSource()`, `injectForkedFromMetadata()`
- `agent-recompiler.ts` — `recompileAgents()`
- `versioning.ts` — `computeSkillFolderHash()`

### Estimated Test Count

- Scenario 1: 2-3 tests (load matrix, install, verify config)
- Scenario 2: 2-3 tests (before/after modification, mixed status)
- Scenario 3: 3-4 tests (initial compile, version bump, no-change recompile)
- Scenario 4: 1-2 tests (generate marketplace, verify structure)
- Scenario 5: 1-2 tests (full cycle end-to-end)
- Scenario 6: 1 test (optional CLI binary test)

**Total: 10-15 tests**
