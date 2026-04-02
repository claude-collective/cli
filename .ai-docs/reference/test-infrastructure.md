# Test Infrastructure

**Last Updated:** 2026-04-02
**Last Validated:** 2026-04-02

## Test Framework

**Runner:** Vitest
**Config:** `vitest.config.ts` (project root)

## Test Projects

Vitest is configured with 3 test projects:

| Project       | Include Pattern                                                                                            | Purpose           | Retry |
| ------------- | ---------------------------------------------------------------------------------------------------------- | ----------------- | ----- |
| `unit`        | `src/**/*.test.{ts,tsx}`, `scripts/**/*.test.ts` (excluding integration/commands)                          | Unit + component  | 0     |
| `integration` | `src/cli/lib/__tests__/integration/**/*.test.{ts,tsx}`, `src/cli/lib/__tests__/user-journeys/**/*.test.ts` | Integration tests | 0     |
| `commands`    | `src/cli/lib/__tests__/commands/**/*.test.ts`                                                              | CLI command tests | 1     |

## Configuration

```typescript
// vitest.config.ts
{
  globals: true,
  environment: "node",
  disableConsoleIntercept: true,    // Required for oclif + ink
  clearMocks: true,
  setupFiles: ["./vitest.setup.ts"],
  testTimeout: 10000,
  hookTimeout: 10000,
}
```

## Test Directory Structure

```
src/cli/lib/__tests__/
  helpers.ts                         # Shared test utilities (MANDATORY: use for all test data)
  helpers.test.ts                    # Tests for helpers themselves
  content-generators.ts              # Pure content renderers: renderSkillMd, renderAgentYaml, renderConfigTs
  test-constants.ts                  # Keyboard constants, timing delays
  test-fixtures.ts                   # Canonical skill registry (SKILLS), test categories
  test-fs-utils.ts                   # createTempDir, cleanupTempDir, fileExists, directoryExists
  mock-data/                         # Extracted test fixtures (shared across test files)
    mock-agents.ts                   # AGENT_DEFS, agent config maps, DEFAULT_TEST_AGENTS
    mock-categories.ts               # Category definitions with domain overrides
    mock-matrices.ts                 # Pre-built matrix constants (EMPTY_MATRIX, SINGLE_REACT_MATRIX, etc.)
    mock-skills.ts                   # Skill entries, TestSkill arrays, ExtractedSkillMetadata constants
    mock-sources.ts                  # SkillSource objects (PUBLIC_SOURCE, ACME_SOURCE, INTERNAL_SOURCE)
    mock-stacks.ts                   # Stack templates, Stack objects, TestStack arrays
  commands/                          # Command-level tests
    build/
      marketplace.test.ts
      plugins.test.ts
      stack.test.ts
    compile.test.ts
    doctor.test.ts
    edit.test.ts
    eject.test.ts
    help.test.ts
    import/skill.test.ts
    info.test.ts
    init.test.ts
    list.test.ts
    new/agent.test.ts
    new/marketplace.test.ts
    new/skill.test.ts
    search.test.ts
    uninstall.test.ts
    update.test.ts
    validate.test.ts
  fixtures/
    create-test-source.ts            # Integration test source factory
    agents/                          # Agent fixture files (_templates, web-developer, api-developer)
    commands/                        # Command fixture files (deploy.md, test.md)
    plugins/                         # Plugin fixture directories (valid-plugin, invalid-plugin-*)
    skills/                          # Skill fixture files (web-framework-react, web-testing-vitest.md)
    stacks/                          # Stack fixture files (default/)
  integration/
    compilation-pipeline.test.ts
    consumer-stacks-matrix.integration.test.ts
    import-skill.integration.test.ts
    init-end-to-end.integration.test.ts
    init-flow.integration.test.ts
    install-mode.integration.test.ts
    installation.test.ts
    source-switching.integration.test.ts
    wizard-flow.integration.test.tsx
  user-journeys/
    compile-flow.test.ts
    config-precedence.test.ts
    edit-recompile.test.ts
    install-compile.test.ts
    user-journeys.integration.test.ts
```

Note: There is NO `test/fixtures/` directory at the project root. All fixtures are in `src/cli/lib/__tests__/fixtures/`. The `fixtures/` subdirectory does NOT contain `configs/` or `matrix/` subdirectories.

Script tests (included in `unit` project via `scripts/**/*.test.ts`):

```
scripts/generate-source-types.test.ts  # Tests for the union type code generator
```

Co-located unit tests (next to source files):

```
src/cli/lib/agents/agent-fetcher.test.ts
src/cli/lib/agents/agent-plugin-compiler.test.ts
src/cli/lib/agents/agent-recompiler.test.ts
src/cli/lib/compiler.test.ts
src/cli/lib/configuration/__tests__/config-loader.test.ts
src/cli/lib/configuration/__tests__/config-round-trip.test.ts
src/cli/lib/configuration/__tests__/config-types-writer.test.ts
src/cli/lib/configuration/__tests__/config-writer.test.ts
src/cli/lib/configuration/__tests__/default-categories.test.ts
src/cli/lib/configuration/__tests__/default-rules.test.ts
src/cli/lib/configuration/__tests__/default-stacks.test.ts
src/cli/lib/configuration/__tests__/define-config.test.ts
src/cli/lib/configuration/config.test.ts
src/cli/lib/configuration/config-generator.test.ts
src/cli/lib/configuration/config-merger.test.ts
src/cli/lib/configuration/config-saver.test.ts
src/cli/lib/configuration/project-config.test.ts
src/cli/lib/configuration/source-manager.test.ts
src/cli/lib/installation/installation.test.ts
src/cli/lib/installation/local-installer.test.ts
src/cli/lib/installation/mode-migrator.test.ts
src/cli/lib/loading/loader.test.ts
src/cli/lib/loading/multi-source-loader.test.ts
src/cli/lib/loading/source-fetcher.test.ts
src/cli/lib/loading/source-fetcher-refresh.test.ts
src/cli/lib/loading/source-loader.test.ts
src/cli/lib/marketplace-generator.test.ts
src/cli/lib/matrix/matrix-health-check.test.ts
src/cli/lib/matrix/matrix-loader.test.ts
src/cli/lib/matrix/matrix-provider.test.ts
src/cli/lib/matrix/matrix-resolver.test.ts
src/cli/lib/matrix/skill-resolution.integration.test.ts
src/cli/lib/matrix/skill-resolution.test.ts
src/cli/lib/operations/project/compile-agents.test.ts
src/cli/lib/operations/project/detect-project.test.ts
src/cli/lib/operations/project/load-agent-defs.test.ts
src/cli/lib/operations/project/write-project-config.test.ts
src/cli/lib/operations/skills/compare-skills.test.ts
src/cli/lib/operations/skills/copy-local-skills.test.ts
src/cli/lib/operations/skills/install-plugin-skills.test.ts
src/cli/lib/operations/skills/uninstall-plugin-skills.test.ts
src/cli/lib/operations/source/ensure-marketplace.test.ts
src/cli/lib/operations/source/load-source.test.ts
src/cli/lib/output-validator.test.ts
src/cli/lib/plugins/plugin-discovery.test.ts
src/cli/lib/plugins/plugin-finder.test.ts
src/cli/lib/plugins/plugin-info.test.ts
src/cli/lib/plugins/plugin-manifest.test.ts
src/cli/lib/plugins/plugin-manifest-finder.test.ts
src/cli/lib/plugins/plugin-settings.test.ts
src/cli/lib/plugins/plugin-validator.test.ts
src/cli/lib/resolver.test.ts
src/cli/lib/schema-validator.test.ts
src/cli/lib/schemas.test.ts
src/cli/lib/skills/local-skill-loader.test.ts
src/cli/lib/skills/skill-copier.test.ts
src/cli/lib/skills/skill-fetcher.test.ts
src/cli/lib/skills/skill-metadata.test.ts
src/cli/lib/skills/skill-plugin-compiler.test.ts
src/cli/lib/skills/source-switcher.test.ts
src/cli/lib/source-validator.test.ts
src/cli/lib/stacks/stack-installer.test.ts
src/cli/lib/stacks/stack-plugin-compiler.test.ts
src/cli/lib/stacks/stacks-loader.test.ts
src/cli/lib/versioning.test.ts
src/cli/lib/wizard/build-step-logic.test.ts
src/cli/stores/wizard-store.test.ts
src/cli/utils/errors.test.ts
src/cli/utils/exec.test.ts
src/cli/utils/frontmatter.test.ts
src/cli/utils/fs.test.ts
src/cli/utils/logger.test.ts
src/cli/utils/messages.test.ts
src/cli/utils/typed-object.test.ts
```

Component tests:

```
src/cli/components/common/confirm.test.tsx
src/cli/components/hooks/use-section-scroll.test.ts
src/cli/components/hooks/use-terminal-dimensions.test.ts
src/cli/components/hooks/use-virtual-scroll.test.ts
src/cli/components/wizard/category-grid.test.tsx
src/cli/components/wizard/checkbox-grid.test.tsx
src/cli/components/wizard/hotkeys.test.ts
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
src/cli/components/wizard/utils.test.ts
src/cli/components/wizard/wizard-tabs.test.tsx
```

## E2E Tests

**Config:** `e2e/vitest.config.ts` (separate Vitest config)
**Pattern:** `e2e/**/*.e2e.test.ts`
**Timeout:** 30s test, 60s hook
**Pool:** `forks` (process isolation)
**Retry:** 2 (automatic retry on failure)
**Global Setup:** `e2e/global-setup.ts` (cleans up stale E2E marketplace registrations on teardown)

Note: Smoke tests use `*.smoke.test.ts` pattern and are NOT matched by the E2E vitest config include pattern. They must be run separately.

### E2E Directory Structure

```
e2e/
  global-setup.ts                    # Teardown: removes stale e2e-test-* marketplaces
  FINDINGS.md                        # E2E investigation findings
  TODO-E2E.md                        # E2E task tracking
  helpers/
    create-e2e-plugin-source.ts      # Plugin source factory for E2E
    create-e2e-source.ts             # E2E source factory
    node-pty.d.ts                    # Type declarations for node-pty
    terminal-session.ts              # Terminal session management
    test-utils.ts                    # Shared E2E utilities (runCLI, createTempDir, createLocalSkill, etc.)
  pages/                             # Page Object Model (POM) infrastructure
    constants.ts                     # DIRS, FILES, STEP_TEXT, TIMEOUTS, EXIT_CODES, SOURCE_PATHS
    base-step.ts                     # Base class for wizard step page objects
    terminal-screen.ts               # Terminal output parsing
    dashboard-session.ts             # Dashboard interaction page object
    wizard-result.ts                 # ProjectHandle type, wizard completion result
    steps/                           # Individual wizard step page objects
      agents-step.ts
      build-step.ts
      confirm-step.ts
      domain-step.ts
      search-modal.ts
      sources-step.ts
      stack-step.ts
    wizards/                         # Composed wizard page objects
      edit-wizard.ts
      init-wizard.ts
  matchers/                          # Custom Vitest matchers for E2E assertions
    project-matchers.ts              # toHaveConfig, toHaveCompiledAgent, toHaveSkillCopied, etc.
    setup.ts                         # expect.extend(projectMatchers) + type augmentation
  fixtures/                          # E2E test fixtures and builders
    cli.ts                           # CLI class for running non-interactive commands
    dual-scope-helpers.ts            # createTestEnvironment, initGlobal, initProject, setupDualScope
    interactive-prompt.ts            # InteractivePrompt class for PTY-based tests
    project-builder.ts               # ProjectBuilder class (minimal, editable, plugin project factories)
  commands/                          # Command E2E tests (23 files)
    build.e2e.test.ts
    build-agent-plugins.e2e.test.ts
    compile.e2e.test.ts
    compile-edge-cases.e2e.test.ts
    compile-scope-filtering.e2e.test.ts
    doctor.e2e.test.ts
    doctor-diagnostics.e2e.test.ts
    dual-scope.e2e.test.ts
    eject.e2e.test.ts
    help.e2e.test.ts
    import-skill.e2e.test.ts
    info.e2e.test.ts
    list.e2e.test.ts
    new-agent.e2e.test.ts
    new-marketplace.e2e.test.ts
    new-skill.e2e.test.ts
    plugin-build.e2e.test.ts
    plugin-uninstall-core.e2e.test.ts
    plugin-uninstall-edge-cases.e2e.test.ts
    relationships.e2e.test.ts
    uninstall.e2e.test.ts
    uninstall-preservation.e2e.test.ts
    validate.e2e.test.ts
  interactive/                       # Interactive wizard E2E tests (29 files)
    build-stack.e2e.test.ts
    edit-agent-scope-routing.e2e.test.ts
    edit-skill-accumulation.e2e.test.ts
    edit-wizard-completion.e2e.test.ts
    edit-wizard-detection.e2e.test.ts
    edit-wizard-launch.e2e.test.ts
    edit-wizard-local.e2e.test.ts
    edit-wizard-navigation.e2e.test.ts
    edit-wizard-plugin-migration.e2e.test.ts
    edit-wizard-plugin-operations.e2e.test.ts
    init-wizard-default-source.e2e.test.ts
    init-wizard-exclusive-compat.e2e.test.ts
    init-wizard-existing.e2e.test.ts
    init-wizard-filter-incompatible.e2e.test.ts
    init-wizard-flags.e2e.test.ts
    init-wizard-interactions.e2e.test.ts
    init-wizard-navigation.e2e.test.ts
    init-wizard-plugin.e2e.test.ts
    init-wizard-scope-split.e2e.test.ts
    init-wizard-scratch.e2e.test.ts
    init-wizard-sources.e2e.test.ts
    init-wizard-stack.e2e.test.ts
    init-wizard-ui.e2e.test.ts
    real-marketplace.e2e.test.ts
    search-interactive.e2e.test.ts
    search-static.e2e.test.ts
    smoke.e2e.test.ts
    uninstall.e2e.test.ts
    update.e2e.test.ts
  lifecycle/                         # Lifecycle E2E tests (18 files)
    config-scope-integrity.e2e.test.ts
    cross-scope-lifecycle.e2e.test.ts
    dual-scope-edit-display.e2e.test.ts
    dual-scope-edit-integrity.e2e.test.ts
    dual-scope-edit-mixed-sources.e2e.test.ts
    dual-scope-edit-scope-changes.e2e.test.ts
    dual-scope-edit-source-changes.e2e.test.ts
    edit-add-local-skills.e2e.test.ts
    global-scope-lifecycle.e2e.test.ts
    init-then-edit-merge.e2e.test.ts
    local-lifecycle.e2e.test.ts
    plugin-lifecycle.e2e.test.ts
    plugin-scope-lifecycle.e2e.test.ts
    re-edit-cycles.e2e.test.ts
    scope-aware-local-copy.e2e.test.ts
    source-switching-modes.e2e.test.ts
    source-switching-per-skill.e2e.test.ts
    unified-config-view.e2e.test.ts
  integration/                       # E2E integration tests (3 files)
    custom-agents.e2e.test.ts
    eject-compile.e2e.test.ts
    eject-integration.e2e.test.ts
  smoke/                             # Smoke tests (3 smoke + 1 e2e pattern)
    home-isolation.smoke.test.ts
    plugin-chain-poc.smoke.test.ts
    plugin-install.smoke.test.ts
    pom-framework.e2e.test.ts
```

**Note on E2E splits:** Several large E2E files were split into smaller files for parallel execution (commit 84e68ef):

- `plugin-uninstall.e2e.test.ts` -> `plugin-uninstall-core.e2e.test.ts` + `plugin-uninstall-edge-cases.e2e.test.ts`
- `edit-wizard-plugin.e2e.test.ts` -> `edit-wizard-plugin-migration.e2e.test.ts` + `edit-wizard-plugin-operations.e2e.test.ts`
- `edit-wizard.e2e.test.ts` -> `edit-wizard-completion.e2e.test.ts` + `edit-wizard-launch.e2e.test.ts` + `edit-wizard-navigation.e2e.test.ts`
- `search.e2e.test.ts` -> `search-interactive.e2e.test.ts` + `search-static.e2e.test.ts`
- `dual-scope-edit.e2e.test.ts` -> `dual-scope-edit-display.e2e.test.ts` + `dual-scope-edit-integrity.e2e.test.ts` + `dual-scope-edit-mixed-sources.e2e.test.ts` + `dual-scope-edit-scope-changes.e2e.test.ts` + `dual-scope-edit-source-changes.e2e.test.ts`
- `source-switching.e2e.test.ts` -> `source-switching-modes.e2e.test.ts` + `source-switching-per-skill.e2e.test.ts`

### E2E Page Object Model (POM)

The E2E tests use a Page Object Model pattern in `e2e/pages/`. Constants are self-contained (no imports from `src/cli/`).

**Constants (`e2e/pages/constants.ts`):**

| Export            | Purpose                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DIRS`            | Directory names (`.claude`, `.claude-src`, `skills`, etc.)                                                                                                                       |
| `FILES`           | File names (`config.ts`, `metadata.yaml`, `SKILL.md`, etc.)                                                                                                                      |
| `STEP_TEXT`       | Text used to identify wizard steps and completion states                                                                                                                         |
| `TIMEOUTS`        | Test timeouts (WIZARD_LOAD=15s, INSTALL=30s, PLUGIN_INSTALL=60s, EXIT=10s, EXIT_WAIT=30s, SETUP=60s, LIFECYCLE=180s, EXTENDED_LIFECYCLE=300s, INTERACTIVE=120s, PLUGIN_TEST=90s) |
| `INTERNAL_DELAYS` | Framework-internal delays (STEP_TRANSITION=500ms, KEYSTROKE=150ms)                                                                                                               |
| `EXIT_CODES`      | Process exit codes (SUCCESS=0, ERROR=1, CANCELLED=4, etc.)                                                                                                                       |
| `SOURCE_PATHS`    | Paths within source directories (skills, config, stacks)                                                                                                                         |

**Page Objects:**

| Page Object        | File                           | Purpose                          |
| ------------------ | ------------------------------ | -------------------------------- |
| `BaseStep`         | `pages/base-step.ts`           | Base class for step page objects |
| `TerminalScreen`   | `pages/terminal-screen.ts`     | Terminal output parsing          |
| `DashboardSession` | `pages/dashboard-session.ts`   | Dashboard interaction            |
| `WizardResult`     | `pages/wizard-result.ts`       | ProjectHandle type, result type  |
| `AgentsStep`       | `pages/steps/agents-step.ts`   | Agents step interactions         |
| `BuildStep`        | `pages/steps/build-step.ts`    | Build step interactions          |
| `ConfirmStep`      | `pages/steps/confirm-step.ts`  | Confirm step interactions        |
| `DomainStep`       | `pages/steps/domain-step.ts`   | Domain selection interactions    |
| `SearchModal`      | `pages/steps/search-modal.ts`  | Search modal interactions        |
| `SourcesStep`      | `pages/steps/sources-step.ts`  | Sources step interactions        |
| `StackStep`        | `pages/steps/stack-step.ts`    | Stack selection interactions     |
| `EditWizard`       | `pages/wizards/edit-wizard.ts` | Composed edit wizard flows       |
| `InitWizard`       | `pages/wizards/init-wizard.ts` | Composed init wizard flows       |

**Custom Matchers (`e2e/matchers/`):**

Imported per-test via `import "../matchers/setup.js"`. Provides:

- `toHaveConfig()` - Verify project config exists with expected content
- `toHaveCompiledAgents()` / `toHaveCompiledAgent(name)` - Verify agent compilation
- `toHaveCompiledAgentContent(name, { contains, notContains })` - Verify agent content
- `toHaveSkillCopied(skillId)` - Verify skill was copied
- `toHaveLocalSkills(expectedIds?)` / `toHaveNoLocalSkills()` - Verify local skills
- `toHavePlugin(key)` / `toHaveNoPlugins()` - Verify plugin state
- `toHavePluginInRegistry(key, scope?)` - Verify plugin registry
- `toHaveEjectedTemplate()` - Verify ejected template exists
- `toHaveSettings(expectations?)` - Verify settings file

**E2E Fixtures (`e2e/fixtures/`):**

| File                    | Exports                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cli.ts`                | `CLI` class with `static run(args, project, options?)` for non-interactive commands                                                                                                                                                  |
| `dual-scope-helpers.ts` | `DualScopeEnv` type, `createTestEnvironment()`, `initGlobal()`, `initProject()`, `setupDualScope()`, `initGlobalWithEject()`, `setupDualScopeWithEject()`, `createDualScopeEnv()`, `initProjectAllGlobal()`, `createGlobalOnlyEnv()` |
| `interactive-prompt.ts` | `InteractivePrompt` class for PTY-based wizard tests                                                                                                                                                                                 |
| `project-builder.ts`    | `ProjectBuilder` class with `minimal()`, `editable()`, plugin project factories                                                                                                                                                      |

## Test Helpers (`src/cli/lib/__tests__/helpers.ts`)

### Factory Functions

**MANDATORY: All test data must use these factories. Never construct inline.**

| Factory                                  | Purpose                            | Signature                                              |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| `createMockSkill()`                      | Create a ResolvedSkill mock        | `(id, overrides?) => ResolvedSkill`                    |
| `createMockMatrix()`                     | Create a MergedSkillsMatrix mock   | `(...skills) => MergedSkillsMatrix`                    |
| `createMockCategory()`                   | Create a CategoryDefinition mock   | `(id, displayName, overrides?) => CategoryDefinition`  |
| `createMockAgent()`                      | Create an AgentDefinition mock     | `(name, overrides?) => AgentDefinition`                |
| `createMockAgentConfig()`                | Create an AgentConfig mock         | `(name, skills?, overrides?) => AgentConfig`           |
| `createMockSkillEntry()`                 | Create a Skill entry               | `(id, preloaded?, overrides?) => Skill`                |
| `createMockSkillSource()`                | Create a SkillSource mock          | `(type, overrides?) => SkillSource`                    |
| `createMockExtractedSkill()`             | Create ExtractedSkillMetadata      | `(id, overrides?) => ExtractedSkillMetadata`           |
| `createMockSkillDefinition()`            | Create a SkillDefinition mock      | `(id, overrides?) => SkillDefinition`                  |
| `createMockResolvedStack()`              | Create a ResolvedStack mock        | `(id, name, overrides?) => ResolvedStack`              |
| `createMockStack()`                      | Create a Stack mock                | `(id, config) => Stack`                                |
| `createMockMatrixConfig()`               | Create decomposed matrix config    | `(categories, overrides?) => MockMatrixConfig`         |
| `createMockCompileConfig()`              | Create a CompileConfig mock        | `(agents, overrides?) => CompileConfig`                |
| `createMockCompiledStackPlugin()`        | Create a CompiledStackPlugin mock  | `(overrides?) => CompiledStackPlugin`                  |
| `createMockSkillAssignment()`            | Create a SkillAssignment mock      | `(id, preloaded?) => SkillAssignment`                  |
| `createMockMultiSourceSkill()`           | Create multi-source ResolvedSkill  | `(id, sources, overrides?) => ResolvedSkill`           |
| `createMockCompiledAgentData()`          | Create CompiledAgentData mock      | `(overrides?) => CompiledAgentData`                    |
| `createMockMarketplace()`                | Create a Marketplace mock          | `(plugins?) => Marketplace`                            |
| `createMockMarketplacePlugin()`          | Create a MarketplacePlugin mock    | `(name, source?) => MarketplacePlugin`                 |
| `createMockRawStacksConfig()`            | Create raw stacks config (2-stack) | `() => RawStacksConfig`                                |
| `createMockRawStacksConfigWithArrays()`  | Raw stacks with array categories   | `() => RawStacksConfig`                                |
| `createMockRawStacksConfigWithObjects()` | Raw stacks with object assignments | `() => RawStacksConfig`                                |
| `buildWizardResult()`                    | Create a WizardResultV2 mock       | `(skills, overrides?) => WizardResultV2`               |
| `buildSourceResult()`                    | Create a SourceLoadResult mock     | `(matrix, sourcePath, overrides?) => SourceLoadResult` |
| `buildProjectConfig()`                   | Create a ProjectConfig mock        | `(overrides?) => ProjectConfig`                        |
| `buildSourceConfig()`                    | Create source config object        | `(overrides?) => Record<string, unknown>`              |
| `buildSkillConfigs()`                    | Create SkillConfig array           | `(skillIds, overrides?) => SkillConfig[]`              |
| `buildAgentConfigs()`                    | Create AgentScopeConfig array      | `(agentNames, overrides?) => AgentScopeConfig[]`       |
| `buildTestProjectConfig()`               | Create TestProjectConfig           | `(agents, skills, overrides?) => TestProjectConfig`    |
| `buildWizardResultFromStore()`           | Build WizardResultV2 from store    | `(matrix, overrides?) => WizardResultV2`               |
| `createTestSkill()`                      | Create a TestSkill for disk tests  | `(id, description, overrides?) => TestSkill`           |
| `createComprehensiveMatrix()`            | Full matrix with 8 skills + stacks | `(overrides?) => MergedSkillsMatrix`                   |
| `createBasicMatrix()`                    | Minimal matrix with 5 skills       | `(overrides?) => MergedSkillsMatrix`                   |
| `createCompileContext()`                 | Create a CompileContext mock       | `(overrides?) => CompileContext`                       |
| `simulateSkillSelections()`              | Simulate user skill selections     | `(skillIds, matrix, selectedDomains) => void`          |
| `testSkillToResolvedSkill()`             | Convert TestSkill to ResolvedSkill | `(skill, overrides?) => ResolvedSkill`                 |
| `extractSkillIdsFromAssignment()`        | Extract IDs from stack assignment  | `(assignment) => string[]`                             |
| `assertConfigIntegrity()`                | Assert config file integrity       | `(dir, expectations) => Promise<void>`                 |

### Skill File Creators

| Helper               | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `writeTestSkill()`   | Write SKILL.md + metadata.yaml to dir     |
| `writeSourceSkill()` | Write skill to source directory structure |
| `writeTestAgent()`   | Write agent metadata.yaml to dir          |

### Test Utilities

| Helper                   | Purpose                                                  |
| ------------------------ | -------------------------------------------------------- |
| `runCliCommand()`        | Run CLI command, capture stdout/stderr/error             |
| `readTestYaml<T>()`      | Read and parse YAML test file                            |
| `readTestTsConfig<T>()`  | Load TS config file via jiti                             |
| `writeTestTsConfig()`    | Write a config.ts file to a project directory            |
| `parseTestFrontmatter()` | Lightweight frontmatter parser for assertions            |
| `createTestDirs()`       | Create plugin test directory structure                   |
| `cleanupTestDirs()`      | Clean up plugin test directory structure                 |
| `createTempDir()`        | Create temp directory (re-export from test-fs-utils)     |
| `cleanupTempDir()`       | Remove temp directory (re-export from test-fs-utils)     |
| `fileExists()`           | Check if file exists (re-export from test-fs-utils)      |
| `directoryExists()`      | Check if directory exists (re-export from test-fs-utils) |

### Content Generators (`src/cli/lib/__tests__/content-generators.ts`)

Pure content renderers for test file generation:

| Function               | Purpose                            |
| ---------------------- | ---------------------------------- |
| `renderSkillMd()`      | Generate SKILL.md with frontmatter |
| `renderAgentYaml()`    | Generate agent metadata.yaml       |
| `renderConfigTs()`     | Generate config.ts with export     |
| `renderCategoriesTs()` | Generate categories config         |
| `renderRulesTs()`      | Generate rules config              |

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
// result.stdout, result.stderr, result.error
```

Intercepts both `process.stdout.write` (Node.js) and `console.log` (Bun) for cross-runtime compatibility.

## Canonical Test Fixtures (`src/cli/lib/__tests__/test-fixtures.ts`)

### SKILLS Registry

Single source of truth for all test ResolvedSkills. Use `SKILLS.react`, `SKILLS.hono` etc. directly.

| Key           | Skill ID                            | Domain |
| ------------- | ----------------------------------- | ------ |
| `react`       | `web-framework-react`               | web    |
| `vue`         | `web-framework-vue-composition-api` | web    |
| `zustand`     | `web-state-zustand`                 | web    |
| `pinia`       | `web-state-pinia`                   | web    |
| `scss`        | `web-styling-scss-modules`          | web    |
| `tailwind`    | `web-styling-tailwind`              | web    |
| `vitest`      | `web-testing-vitest`                | web    |
| `hono`        | `api-framework-hono`                | api    |
| `drizzle`     | `api-database-drizzle`              | api    |
| `antiOverEng` | `meta-reviewing-reviewing`          | meta   |

### TEST_CATEGORIES

Base category fixtures for spread-based customization:

| Key               | Category ID         | Display Name      |
| ----------------- | ------------------- | ----------------- |
| `framework`       | `web-framework`     | Framework         |
| `clientState`     | `web-client-state`  | Client State      |
| `styling`         | `web-styling`       | Styling           |
| `testing`         | `web-testing`       | Testing           |
| `serverState`     | `web-server-state`  | Server State      |
| `animation`       | `web-animation`     | Animation         |
| `accessibility`   | `web-accessibility` | Accessibility     |
| `api`             | `api-api`           | Backend Framework |
| `database`        | `api-database`      | Database          |
| `observability`   | `api-observability` | Observability     |
| `methodology`     | `meta-reviewing`    | Meta              |
| `tooling`         | `shared-tooling`    | Tooling           |
| `security`        | `shared-security`   | Security          |
| `cliFramework`    | `cli-framework`     | CLI Framework     |
| `mobileFramework` | `mobile-framework`  | Mobile Framework  |

## Mock Data Module (`src/cli/lib/__tests__/mock-data/`)

Pre-built test data constants extracted from individual test files. Use these instead of inline `createMock*()` calls.

### mock-agents.ts

- `AGENT_DEFS` - Canonical agent metadata (webDev, apiDev, webTester, webReviewer)
- `RESOLVE_AGENTS_DEFINITIONS` - Agent definitions for resolver tests
- `WEB_DEV_NO_SKILLS`, `API_DEV_NO_SKILLS`, `WEB_DEV_WITH_REACT`, `WEB_DEV_WITH_PRELOADED_REACT`, `WEB_DEV_WITH_VITEST`, `TWO_AGENTS_SHARED_SKILL` - Pre-built agent config maps
- `DEFAULT_TEST_AGENTS` - TestAgent array for `createTestSource()`

### mock-categories.ts

- `WEB_FRAMEWORK_CATEGORY`, `WEB_STYLING_CATEGORY`, `WEB_STATE_CATEGORY`, `API_FRAMEWORK_CATEGORY`, `API_DATABASE_CATEGORY`, `CLI_FRAMEWORK_CATEGORY` - Category defs with domain overrides
- `FRAMEWORK_CATEGORY` - Basic framework category
- `MULTI_SOURCE_CATEGORIES` - Categories for multi-source integration tests

### mock-matrices.ts

- `EMPTY_MATRIX`, `SINGLE_REACT_MATRIX`, `WEB_PAIR_MATRIX`, etc. - Pre-built matrix constants
- `ALL_SKILLS_*_MATRIX` - Full skills with various category configurations
- `HEALTH_*_MATRIX` - Matrix fixtures for health-check tests
- `buildMultiSourceMatrix()` - Factory for multi-source matrices
- `MERGE_BASIC_MATRIX`, `CONFLICT_MATRIX`, `ALTERNATIVES_MATRIX`, `REQUIRES_MATRIX` - MatrixConfig fixtures
- `PIPELINE_MATRIX` - Pipeline integration test matrix
- `LOCAL_SKILL_MATRIX`, `MIXED_LOCAL_REMOTE_MATRIX` - Local skill matrix fixtures
- `METHODOLOGY_MATRIX`, `VITEST_MATRIX` - Single-domain matrix fixtures
- `CATEGORY_GRID_MATRIX`, `REACT_HONO_FRAMEWORK_API_MATRIX` - Specialized matrix fixtures
- `BUILD_STEP_*_MATRIX` - Build step logic test matrices (17 constants)
- `WEB_AND_API_COMPILE_CONFIG`, `WEB_ONLY_COMPILE_CONFIG` - CompileConfig fixtures
- `TOOLING_AND_FRAMEWORK_CONFIG`, `CI_CD_CONFIG`, `FRAMEWORK_AND_STYLING_CONFIG`, `OBSERVABILITY_CONFIG`, `FRAMEWORK_AND_TESTING_CONFIG`, `EMPTY_MATRIX_CONFIG`, `UNRESOLVED_CONFLICT_MATRIX` - MatrixConfig fixtures

### mock-skills.ts

- `REACT_SKILL`, `REACT_SKILL_PRELOADED`, `VITEST_SKILL`, `VITEST_SINGLE_FILE_SKILL` - Skill entry constants
- `DEFAULT_TEST_SKILLS`, `PIPELINE_TEST_SKILLS`, `EXTRA_DOMAIN_TEST_SKILLS`, `ALL_TEST_SKILLS` - TestSkill arrays
- `INIT_SKILL_IDS`, `INIT_TEST_SKILLS` - Filtered skills for init tests
- `SWITCHABLE_SKILLS`, `LOCAL_SKILL_VARIANTS` - Source-switching test skills
- `HEALTH_*_SKILL` - Health-check skill variants (8 constants)
- `CATEGORY_GRID_SKILLS` - 31-entry array for category grid tests
- `IMPORT_*_SKILL` - Import source skill constants (3 constants)
- `*_EXTRACTED` - ExtractedSkillMetadata constants (`REACT_EXTRACTED`, `REACT_EXTRACTED_BASIC`, `VUE_EXTRACTED_BASIC`, `ZUSTAND_EXTRACTED`, `JOTAI_EXTRACTED`)
- `MULTI_SOURCE_*_SKILLS` - Multi-source skill entries (PUBLIC, ACME, INTERNAL)
- `COMPILE_LOCAL_SKILL`, `DOCKER_TOOLING_SKILL`, `DATADOG_OBSERVABILITY_SKILL` - Individual TestSkill constants
- `CI_CD_SKILLS`, `DISCOURAGES_RELATIONSHIP_SKILLS`, `REQUIRES_RELATIONSHIP_SKILLS`, `RESOLUTION_PIPELINE_SKILLS` - TestSkill arrays for relationship tests
- `VALID_LOCAL_SKILL`, `SKILL_WITHOUT_METADATA`, `SKILL_WITHOUT_METADATA_CUSTOM` - Edge case test skills
- `LOCAL_SKILL_BASIC`, `LOCAL_SKILL_FORKED`, `LOCAL_SKILL_FORKED_MINIMAL` - Local skill test variants
- `REACT_CONFLICTS_VUE`, `VUE_CONFLICTS_REACT`, `ZUSTAND_CONFLICTS_PINIA`, `PINIA_CONFLICTS_ZUSTAND` - Conflict relationship skills
- `REACT_REQUIRES_ZUSTAND`, `REACT_RECOMMENDED`, `VUE_DISCOURAGES_SCSS`, `ZUSTAND_UNIVERSAL`, `REACT_LOCAL` - Relationship and scope variant skills

### mock-sources.ts

- `PUBLIC_SOURCE`, `ACME_SOURCE`, `INTERNAL_SOURCE` - SkillSource objects

### mock-stacks.ts

- `SINGLE_AGENT_STACK_TEMPLATE`, `MULTI_AGENT_STACK_TEMPLATE` - Stack templates
- `FULLSTACK_STACK`, `WEB_REACT_AND_SCSS_STACK`, `WEB_REACT_ONLY_STACK`, `WEB_SCSS_ONLY_STACK`, `API_HONO_ONLY_STACK`, `WEB_EMPTY_AGENT_STACK`, `EMPTY_AGENTS_STACK`, `SHARED_CATEGORY_STACK`, `STACK_WITH_EMPTY_AGENTS`, `MULTI_METHODOLOGY_STACK`, `STACK_WITH_EMPTY_CATEGORY`, `MANY_CATEGORIES_STACK`, `LOCAL_SKILL_STACK`, `COMPILATION_TEST_STACK` - Stack objects
- `CUSTOM_TEST_STACKS`, `PHILOSOPHY_TEST_STACKS`, `OVERRIDING_TEST_STACKS`, `MARKETPLACE_TEST_STACKS`, `MARKETPLACE_FULLSTACK_TEST_STACKS`, `PIPELINE_TEST_STACKS`, `MULTI_TEST_STACKS` - TestStack arrays for `createTestSource()`

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

## Test Anti-Patterns (From CLAUDE.md)

- NEVER construct test data inline (configs, matrices, skills, stacks, agents)
- NEVER use raw `writeFile` for skill/agent test data
- NEVER inline `SkillsMatrixConfig` or `MergedSkillsMatrix` construction
- NEVER create alias/mapping hacks to paper over wrong test data
- NEVER put TODO/task IDs in test describe blocks
- NEVER use raw `mkdtemp`/`rm` -- use `createTempDir()`/`cleanupTempDir()`
