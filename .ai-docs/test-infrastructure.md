# Test Infrastructure

**Last Updated:** 2026-02-25

## Test Framework

**Runner:** Vitest
**Config:** `vitest.config.ts` (project root)
**Test Count:** 2309+ tests

## Test Projects

Vitest is configured with 3 test projects:

| Project       | Include Pattern                                           | Purpose           |
| ------------- | --------------------------------------------------------- | ----------------- |
| `unit`        | `src/**/*.test.{ts,tsx}` (excluding integration/commands) | Unit + component  |
| `integration` | `__tests__/integration/**`, `__tests__/user-journeys/**`  | Integration tests |
| `commands`    | `__tests__/commands/**/*.test.ts`                         | CLI command tests |

## Configuration

```typescript
// vitest.config.ts
{
  globals: true,
  environment: "node",
  disableConsoleIntercept: true,    // Required for oclif + ink
  clearMocks: true,
  testTimeout: 10000,
  hookTimeout: 10000,
}
```

## Test Directory Structure

```
src/cli/lib/__tests__/
  helpers.ts                         # Shared test utilities (MANDATORY: use for all test data)
  helpers.test.ts                    # Tests for helpers themselves
  test-constants.ts                  # Keyboard constants, timing delays
  test-fixtures.ts                   # Named skill fixtures (getTestSkill)
  commands/                          # Command-level tests
    build/
      marketplace.test.ts
      plugins.test.ts
      stack.test.ts
    compile.test.ts
    config/index.test.ts
    diff.test.ts
    doctor.test.ts
    edit.test.ts
    eject.test.ts
    import/skill.test.ts
    info.test.ts
    init.test.ts
    list.test.ts
    new/agent.test.ts
    new/marketplace.test.ts
    new/skill.test.ts
    outdated.test.ts
    search.test.ts
    uninstall.test.ts
    update.test.ts
    validate.test.ts
  fixtures/
    create-test-source.ts            # Integration test source factory
    agents/                          # Agent fixture files
    commands/                        # Command fixture files
    configs/                         # Config fixture files
    matrix/                          # Matrix fixture files
    plugins/                         # Plugin fixture directories
    skills/                          # Skill fixture files
    stacks/                          # Stack fixture files
  integration/
    compilation-pipeline.test.ts
    consumer-stacks-matrix.integration.test.ts
    import-skill.integration.test.ts
    init-end-to-end.integration.test.ts
    init-flow.integration.test.ts
    installation.test.ts
    source-switching.integration.test.ts
    wizard-flow.integration.test.tsx
    wizard-init-compile-pipeline.test.ts
  user-journeys/
    compile-flow.test.ts
    config-precedence.test.ts
    edit-recompile.test.ts
    install-compile.test.ts
    user-journeys.integration.test.ts
```

Note: There is NO `test/fixtures/` directory at the project root. All fixtures are in `src/cli/lib/__tests__/fixtures/`.

Co-located unit tests (next to source files):

```
src/cli/lib/agents/agent-fetcher.test.ts
src/cli/lib/agents/agent-plugin-compiler.test.ts
src/cli/lib/agents/agent-recompiler.test.ts
src/cli/lib/compiler.test.ts
src/cli/lib/configuration/config.test.ts
src/cli/lib/configuration/config-generator.test.ts
src/cli/lib/configuration/config-merger.test.ts
src/cli/lib/configuration/config-saver.test.ts
src/cli/lib/configuration/project-config.test.ts
src/cli/lib/configuration/source-manager.test.ts
src/cli/lib/installation/local-installer.test.ts
src/cli/lib/installation/installation.test.ts
src/cli/lib/loading/loader.test.ts
src/cli/lib/loading/multi-source-loader.test.ts
src/cli/lib/loading/source-fetcher.test.ts
src/cli/lib/loading/source-fetcher-refresh.test.ts
src/cli/lib/loading/source-loader.test.ts
src/cli/lib/matrix/matrix-health-check.test.ts
src/cli/lib/matrix/matrix-loader.test.ts
src/cli/lib/matrix/matrix-resolver.test.ts
src/cli/lib/matrix/skill-resolution.integration.test.ts
src/cli/lib/plugins/plugin-discovery.test.ts
src/cli/lib/plugins/plugin-finder.test.ts
src/cli/lib/plugins/plugin-info.test.ts
src/cli/lib/plugins/plugin-manifest.test.ts
src/cli/lib/plugins/plugin-settings.test.ts
src/cli/lib/plugins/plugin-validator.test.ts
src/cli/lib/skills/local-skill-loader.test.ts
src/cli/lib/skills/skill-copier.test.ts
src/cli/lib/skills/skill-fetcher.test.ts
src/cli/lib/skills/skill-metadata.test.ts
src/cli/lib/skills/skill-plugin-compiler.test.ts
src/cli/lib/skills/source-switcher.test.ts
src/cli/lib/stacks/stack-installer.test.ts
src/cli/lib/stacks/stack-plugin-compiler.test.ts
src/cli/lib/stacks/stacks-loader.test.ts
src/cli/lib/wizard/build-step-logic.test.ts
src/cli/stores/wizard-store.test.ts
src/cli/utils/errors.test.ts
src/cli/utils/exec.test.ts
src/cli/utils/frontmatter.test.ts
src/cli/utils/fs.test.ts
src/cli/utils/logger.test.ts
src/cli/utils/messages.test.ts
src/cli/utils/typed-object.test.ts
src/cli/utils/yaml.test.ts
src/cli/lib/output-validator.test.ts
src/cli/lib/resolver.test.ts
src/cli/lib/schema-validator.test.ts
src/cli/lib/schemas.test.ts
src/cli/lib/versioning.test.ts
src/cli/lib/marketplace-generator.test.ts
```

Component tests:

```
src/cli/components/common/confirm.test.tsx
src/cli/components/hooks/use-terminal-dimensions.test.ts
src/cli/components/hooks/use-virtual-scroll.test.ts
src/cli/components/wizard/category-grid.test.tsx
src/cli/components/wizard/checkbox-grid.test.tsx
src/cli/components/wizard/search-modal.test.tsx
src/cli/components/wizard/section-progress.test.tsx
src/cli/components/wizard/source-grid.test.tsx
src/cli/components/wizard/step-agents.test.tsx
src/cli/components/wizard/step-build.test.tsx
src/cli/components/wizard/step-confirm.test.tsx
src/cli/components/wizard/step-refine.test.tsx
src/cli/components/wizard/step-settings.test.tsx
src/cli/components/wizard/step-sources.test.tsx
src/cli/components/wizard/step-stack.test.tsx
src/cli/components/wizard/wizard-tabs.test.tsx
```

## Test Helpers (`src/cli/lib/__tests__/helpers.ts`)

### Factory Functions

**MANDATORY: All test data must use these factories. Never construct inline.**

| Factory                | Purpose                          | Signature                                     |
| ---------------------- | -------------------------------- | --------------------------------------------- |
| `createMockSkill()`    | Create a ResolvedSkill mock      | `(id, category, overrides?) => ResolvedSkill` |
| `createMockMatrix()`   | Create a MergedSkillsMatrix mock | `(skills, overrides?) => MergedSkillsMatrix`  |
| `createMockCategory()` | Create a CategoryDefinition mock | `(id, overrides?) => CategoryDefinition`      |
| `createMockAgent()`    | Create an AgentYamlConfig mock   | `(name, overrides?) => AgentYamlConfig`       |
| `buildWizardResult()`  | Create a WizardResultV2 mock     | `(overrides?) => WizardResultV2`              |
| `buildSourceResult()`  | Create a SourceLoadResult mock   | `(overrides?) => SourceLoadResult`            |

### Skill File Creators

| Helper               | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `createCLISkill()`   | Create skill files in CLI source format   |
| `createUserSkill()`  | Create skill files in user/local format   |
| `writeTestSkill()`   | Write SKILL.md + metadata.yaml to dir     |
| `writeSourceSkill()` | Write skill to source directory structure |

### Temp Directory Management

```typescript
import { createTempDir, cleanupTempDir } from "../__tests__/helpers.js";

let tempDir: string;
beforeEach(async () => {
  tempDir = await createTempDir();
});
afterEach(async () => {
  await cleanupTempDir(tempDir);
});
```

### CLI Command Runner

```typescript
import { runCliCommand } from "../__tests__/helpers.js";

const result = await runCliCommand(["compile", "--verbose"]);
// result.stdout, result.stderr, result.error, result.exitCode
```

Intercepts both `process.stdout.write` (Node.js) and `console.log` (Bun) for cross-runtime compatibility.

## Test Source Factory (`src/cli/lib/__tests__/fixtures/create-test-source.ts`)

Creates complete project directory structures for integration tests:

```typescript
import { createTestSource } from "../fixtures/create-test-source.js";

const dirs = await createTestSource({
  skills: [...],       // TestSkill[]
  agents: [...],       // TestAgent[]
  stacks: [...],       // TestStack[]
  matrix: {...},       // TestMatrix
  config: {...},       // TestProjectConfig
  pluginManifest: {...},
});
// dirs.root, dirs.skills, dirs.agents, dirs.config, etc.
```

## Test Constants (`src/cli/lib/__tests__/test-constants.ts`)

### Keyboard Escape Sequences

| Constant      | Value    | Purpose         |
| ------------- | -------- | --------------- |
| `ARROW_UP`    | `\x1B[A` | Up arrow key    |
| `ARROW_DOWN`  | `\x1B[B` | Down arrow key  |
| `ARROW_LEFT`  | `\x1B[D` | Left arrow key  |
| `ARROW_RIGHT` | `\x1B[C` | Right arrow key |
| `ENTER`       | `\r`     | Enter key       |
| `ESCAPE`      | `\x1B`   | Escape key      |
| `CTRL_C`      | `\x03`   | Ctrl+C          |
| `TAB`         | `\t`     | Tab key         |
| `SPACE`       | `" "`    | Space key       |
| `BACKSPACE`   | `\x7F`   | Backspace key   |
| `KEY_Y`       | `"y"`    | Y key (confirm) |
| `KEY_N`       | `"n"`    | N key (reject)  |

### Timing Constants

| Constant                   | Value (ms) | Purpose               |
| -------------------------- | ---------- | --------------------- |
| `INPUT_DELAY_MS`           | 50         | Between keystrokes    |
| `RENDER_DELAY_MS`          | 100        | After render          |
| `SELECT_NAV_DELAY_MS`      | 100        | After navigation      |
| `CONFIRM_INPUT_DELAY_MS`   | 100        | After confirm input   |
| `OPERATION_DELAY_MS`       | 150        | After async operation |
| `STEP_TRANSITION_DELAY_MS` | 150        | Between wizard steps  |

### Utility

| Export      | Purpose                                    |
| ----------- | ------------------------------------------ |
| `delay(ms)` | Promise-based delay helper for test timing |

### Test Available Skills Pool

`TEST_AVAILABLE_SKILLS` - 21 skill IDs covering all domains, for agent-skill mapping tests.

## Test Anti-Patterns (From CLAUDE.md)

- NEVER construct test data inline (configs, matrices, skills, stacks, agents)
- NEVER use raw `writeFile` for skill/agent test data
- NEVER inline `SkillsMatrixConfig` or `MergedSkillsMatrix` construction
- NEVER create alias/mapping hacks to paper over wrong test data
- NEVER put TODO/task IDs in test describe blocks
- NEVER use raw `mkdtemp`/`rm` -- use `createTempDir()`/`cleanupTempDir()`

## Output Strings (`helpers.ts`)

`OUTPUT_STRINGS` constant contains expected CLI output strings for assertions:

- Config headers, labels, success/error messages
- Used for `expect(stdout).toContain(OUTPUT_STRINGS.INIT_SUCCESS)`
