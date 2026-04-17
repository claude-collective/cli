import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { ProjectBuilder } from "../fixtures/project-builder.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import {
  cleanupTempDir,
  ensureBinaryExists,
  isClaudeCLIAvailable,
  readTestFile,
} from "../helpers/test-utils.js";
import { DIRS, EXIT_CODES, FILES, TIMEOUTS } from "../pages/constants.js";
import "../matchers/setup.js";

/**
 * Hard-error coverage for plugin-install intent when marketplace resolution
 * fails. Enforces the "never silently substitute eject for plugin" rule from
 * feedback_no_plugin_to_eject_fallback.md.
 *
 * Finding: .ai-docs/agent-findings/2026-04-16-silent-plugin-install-skip-on-missing-marketplace.md
 *
 * Scenarios:
 *   - `cc edit` against a project whose config lacks `marketplace` AND whose
 *     --source points at a local directory with no marketplace.json. Adding a
 *     plugin-sourced skill MUST hard-error, not silently skip.
 *   - `cc init` against a local source with no marketplace.json. With plugin
 *     mode implied by the default `primarySource`, the old behavior copied the
 *     skills as eject. The fix converts this into a hard error.
 *
 * Both paths require the Claude CLI at some point in the stack (marketplace
 * resolution calls `fetchMarketplace`, which is pure I/O, but `ensureMarketplace`
 * invokes `claudePluginMarketplaceExists` — skip when unavailable).
 */

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)("plugin install intent: hard-error paths", () => {
  /**
   * Edit scenario: project was built with plugin-sourced skills but config.ts
   * was saved without the `marketplace` field (legacy state). Source flag
   * points at a plain local source with no `.claude-plugin/marketplace.json`.
   *
   * Adding a new plugin-sourced skill triggers `applyPluginChanges`, which
   * calls `requireMarketplace`. The helper resolves marketplace via
   * `ensureMarketplace` -> `fetchMarketplace`. Both fail because the source
   * has no marketplace manifest, so the helper must hard-error with
   * EXIT_CODES.ERROR and a clear message mentioning "marketplace could not
   * be resolved". The project state must remain untouched.
   */
  describe("cc edit with local source (no marketplace) + plugin skill addition", () => {
    let fixture: E2EPluginSource;
    let localSource: Awaited<ReturnType<typeof createE2ESource>>;
    let wizard: EditWizard | undefined;

    beforeAll(async () => {
      await ensureBinaryExists();
      // fixture provides plugin-sourced skill IDs used in the seeded config.
      fixture = await createE2EPluginSource();
      // localSource is a plain directory with NO marketplace.json — the
      // resolution path we expect to fail.
      localSource = await createE2ESource();
    }, TIMEOUTS.SETUP * 2);

    afterAll(async () => {
      if (fixture) await cleanupTempDir(fixture.tempDir);
      if (localSource) await cleanupTempDir(localSource.tempDir);
    });

    afterEach(async () => {
      await wizard?.destroy();
      wizard = undefined;
    });

    it(
      "should hard-error and leave config/settings untouched",
      { timeout: TIMEOUTS.PLUGIN_TEST },
      async () => {
        const project = await ProjectBuilder.pluginProject({
          skills: ["web-framework-react"],
          marketplace: fixture.marketplaceName,
          agents: ["web-developer"],
          domains: ["web"],
          omitMarketplaceField: true,
        });

        // Snapshot state that must NOT change on hard-error.
        const configPath = path.join(project.dir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
        const settingsPath = path.join(project.dir, DIRS.CLAUDE, FILES.SETTINGS_JSON);
        const configBefore = await readTestFile(configPath);
        const settingsBefore = await readTestFile(settingsPath);

        wizard = await EditWizard.launch({
          projectDir: project.dir,
          // local source without marketplace.json — the resolution failure point
          source: { sourceDir: localSource.sourceDir, tempDir: localSource.tempDir },
          rows: 60,
          cols: 120,
        });

        // Add a new skill — newly added skills default to a plugin-intent
        // source (DEFAULT_PUBLIC_SOURCE_NAME / primarySource), never "eject".
        await wizard.build.navigateDown();
        await wizard.build.toggleFocusedSkill();

        const sources = await wizard.build.passThroughAllDomainsGeneric();
        const agents = await sources.acceptDefaults();
        const confirm = await agents.acceptDefaults("edit");
        const result = await confirm.confirmExpectingExit();

        expect(await result.exitCode).toBe(EXIT_CODES.ERROR);

        const output = result.output;
        expect(output).toContain("marketplace could not be resolved");
        expect(output).not.toContain("Installed");

        // State integrity: neither config nor settings may mutate on hard-error.
        const configAfter = await readTestFile(configPath);
        const settingsAfter = await readTestFile(settingsPath);
        expect(configAfter).toStrictEqual(configBefore);
        expect(settingsAfter).toStrictEqual(settingsBefore);
      },
    );
  });

  /**
   * Init scenario: user runs `cc init --source <localDir>` where <localDir>
   * has no marketplace.json. Default skill sources carry plugin intent
   * (primarySource / DEFAULT_PUBLIC_SOURCE_NAME). Previously the CLI silently
   * copied the plugin-intended skills as eject copies. After the fix,
   * `installPluginsStep` hard-errors via `EXIT_CODES.ERROR`.
   *
   * This documents the removal of the old "eject mode fallback" in init.tsx.
   */
  describe("cc init with local source (no marketplace) + default plugin intent", () => {
    let localSource: Awaited<ReturnType<typeof createE2ESource>>;
    let wizard: InitWizard | undefined;

    beforeAll(async () => {
      await ensureBinaryExists();
      localSource = await createE2ESource();
    }, TIMEOUTS.SETUP);

    afterAll(async () => {
      if (localSource) await cleanupTempDir(localSource.tempDir);
    });

    afterEach(async () => {
      await wizard?.destroy();
      wizard = undefined;
    });

    it(
      "should hard-error instead of silently copying plugin skills as eject",
      { timeout: TIMEOUTS.PLUGIN_TEST },
      async () => {
        wizard = await InitWizard.launch({
          source: { sourceDir: localSource.sourceDir, tempDir: localSource.tempDir },
        });
        // Step through the wizard manually so we can confirm without waiting
        // for a success banner that will never arrive.
        const domain = await wizard.stack.selectFirstStack();
        const build = await domain.acceptDefaults();
        const sources = await build.passThroughAllDomains();
        const agents = await sources.acceptDefaults();
        const confirm = await agents.acceptDefaults("init");
        const result = await confirm.confirmExpectingExit();

        expect(await result.exitCode).toBe(EXIT_CODES.ERROR);

        const output = result.output;
        expect(output).toContain("marketplace could not be resolved");
        // The old silent fallback emitted "Skills copied to:" — it must be absent.
        expect(output).not.toContain("Skills copied to:");
      },
    );
  });
});
