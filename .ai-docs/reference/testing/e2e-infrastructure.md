---
scope: reference
area: testing
keywords:
  [
    e2e,
    page-object-model,
    POM,
    terminal-session,
    custom-matchers,
    fixtures,
    project-builder,
    dual-scope,
    timeout,
  ]
related:
  - reference/testing/infrastructure.md
  - reference/testing/factories.md
last_validated: 2026-04-13
---

# E2E Test Infrastructure

**Last Updated:** 2026-04-13
**Last Validated:** 2026-04-13

> **Split from:** `reference/test-infrastructure.md`. See also: [infrastructure.md](./infrastructure.md), [factories.md](./factories.md), [mock-data.md](./mock-data.md).

## E2E Tests

**Config:** `e2e/vitest.config.ts` (separate Vitest config)
**Pattern:** `e2e/**/*.e2e.test.ts`
**Timeout:** 30s test, 60s hook
**Pool:** `forks` (process isolation)
**Retry:** 2 (automatic retry on failure)
**Global Setup:** `e2e/global-setup.ts` (cleans up stale E2E marketplace registrations on teardown)

Note: Smoke tests use `*.smoke.test.ts` pattern and are NOT matched by the E2E vitest config include pattern. They must be run separately.

## E2E Directory Structure

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
  commands/                          # Command E2E tests (22 files)
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
  interactive/                       # Interactive wizard E2E tests (32 files)
    build-stack.e2e.test.ts
    edit-agent-scope-routing.e2e.test.ts
    edit-skill-accumulation.e2e.test.ts
    edit-wizard-completion.e2e.test.ts
    edit-wizard-detection.e2e.test.ts
    edit-wizard-excluded-skills.e2e.test.ts
    edit-wizard-launch.e2e.test.ts
    edit-wizard-local.e2e.test.ts
    edit-wizard-navigation.e2e.test.ts
    edit-wizard-plugin-migration.e2e.test.ts
    edit-wizard-plugin-operations.e2e.test.ts
    edit-wizard-unique-skill-guard.e2e.test.ts
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
    init-wizard-stack-agents.e2e.test.ts
    init-wizard-ui.e2e.test.ts
    real-marketplace.e2e.test.ts
    search-interactive.e2e.test.ts
    search-static.e2e.test.ts
    smoke.e2e.test.ts
    uninstall.e2e.test.ts
    update.e2e.test.ts
  lifecycle/                         # Lifecycle E2E tests (25 files)
    config-scope-integrity.e2e.test.ts
    cross-scope-lifecycle.e2e.test.ts
    dual-scope-edit-display.e2e.test.ts
    dual-scope-edit-integrity.e2e.test.ts
    dual-scope-edit-mixed-sources.e2e.test.ts
    dual-scope-edit-scope-changes.e2e.test.ts
    dual-scope-edit-source-changes.e2e.test.ts
    edit-add-local-skills.e2e.test.ts
    exclusion-lifecycle.e2e.test.ts
    global-agent-toggle-guard.e2e.test.ts
    global-scope-lifecycle.e2e.test.ts
    global-skill-toggle-guard.e2e.test.ts
    init-global-preselection-confirm.e2e.test.ts
    init-then-edit-merge.e2e.test.ts
    local-lifecycle.e2e.test.ts
    plugin-lifecycle.e2e.test.ts
    plugin-scope-lifecycle.e2e.test.ts
    project-tracking-propagation.e2e.test.ts
    re-edit-cycles.e2e.test.ts
    scope-aware-local-copy.e2e.test.ts
    scope-change-deselect-integrity.e2e.test.ts
    selected-agent-name-excluded.e2e.test.ts
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

## E2E Page Object Model (POM)

The E2E tests use a Page Object Model pattern in `e2e/pages/`. Constants are self-contained (no imports from `src/cli/`).

**Constants (`e2e/pages/constants.ts`):**

| Export            | Purpose                                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DIRS`            | Directory names (`.claude`, `.claude-src`, `skills`, etc.)                                                                                                                                                                    |
| `FILES`           | File names (`config.ts`, `metadata.yaml`, `SKILL.md`, etc.)                                                                                                                                                                   |
| `STEP_TEXT`       | Text used to identify wizard steps and completion states                                                                                                                                                                      |
| `TIMEOUTS`        | Test timeouts (WIZARD_LOAD=15s, INSTALL=30s, PLUGIN_INSTALL=60s, EXIT=10s, SESSION_DEFAULT=10s, SESSION_DEFAULT_CI=20s, EXIT_WAIT=30s, SETUP=60s, LIFECYCLE=180s, EXTENDED_LIFECYCLE=300s, INTERACTIVE=120s, PLUGIN_TEST=90s) |
| `INTERNAL_DELAYS` | Framework-internal delays (STEP_TRANSITION=500ms, KEYSTROKE=150ms)                                                                                                                                                            |
| `EXIT_CODES`      | Process exit codes (SUCCESS=0, ERROR=1, CANCELLED=4, etc.)                                                                                                                                                                    |
| `SOURCE_PATHS`    | Paths within source directories (skills, config, stacks)                                                                                                                                                                      |

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

## Timeout Infrastructure

`TerminalSession` has a `defaultTimeout` readonly property (set from `TerminalSessionOptions.defaultTimeout` or CI-aware defaults: `TIMEOUTS.SESSION_DEFAULT` (10s) locally, `TIMEOUTS.SESSION_DEFAULT_CI` (20s) in CI). Methods `waitForText()` and `waitForExit()` use this as their fallback timeout.

`BaseStep` sets its own `defaultTimeout` to `TIMEOUTS.WIZARD_LOAD` (15s) -- intentionally different from the session default -- used by `waitForStep()` and `waitForStableRender()`.

`InitWizardOptions` and `EditWizardOptions` both accept `defaultTimeout` which is passed through to `TerminalSession`. `InitWizardOptions` also accepts `loadTimeout` to override the initial `waitForReady()` timeout separately.

## Custom Matchers (`e2e/matchers/`)

Imported per-test via `import "../matchers/setup.js"`. The setup extends `expect` with matchers from both `project-matchers.ts` and `agent-matchers.ts`.

**Project matchers (`project-matchers.ts`):**

- `toHaveConfig()` - Verify project config exists with expected content
- `toHaveCompiledAgents()` / `toHaveCompiledAgent(name)` - Verify agent compilation
- `toHaveCompiledAgentContent(name, { contains, notContains })` - Verify agent content
- `toHaveSkillCopied(skillId)` - Verify skill was copied
- `toHaveLocalSkills(expectedIds?)` / `toHaveNoLocalSkills()` - Verify local skills
- `toHavePlugin(key)` / `toHaveNoPlugins()` - Verify plugin state
- `toHavePluginInRegistry(key, scope?)` - Verify plugin registry
- `toHaveEjectedTemplate()` - Verify ejected template exists
- `toHaveSettings(expectations?)` - Verify settings file

**Agent matchers (`agent-matchers.ts`):**

- `toHaveAgentFrontmatter(agentName, { name?, description?, model?, tools?, skills?, noSkills? })` - Verify agent frontmatter fields
- `toHaveAgentDynamicSkills(agentName, { skillIds?, noSkillIds?, hasActivationProtocol?, allPreloaded? })` - Verify agent dynamic skills section

## E2E Fixtures (`e2e/fixtures/`)

| File                    | Exports                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cli.ts`                | `CLI` class with `static run(args, project, options?)` for non-interactive commands                                                                                                                                                  |
| `dual-scope-helpers.ts` | `DualScopeEnv` type, `createTestEnvironment()`, `initGlobal()`, `initProject()`, `setupDualScope()`, `initGlobalWithEject()`, `setupDualScopeWithEject()`, `createDualScopeEnv()`, `initProjectAllGlobal()`, `createGlobalOnlyEnv()` |
| `expected-values.ts`    | `E2E_SKILL_IDS` (skill ID array), `E2E_AGENTS` (agent name constants) -- canonical expected values for E2E assertions                                                                                                                |
| `interactive-prompt.ts` | `InteractivePrompt` class for PTY-based wizard tests                                                                                                                                                                                 |
| `project-builder.ts`    | `ProjectBuilder` class with `minimal()`, `editable()`, plugin project factories                                                                                                                                                      |
