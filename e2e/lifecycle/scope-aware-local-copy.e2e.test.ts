import { mkdir } from "fs/promises";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, EXIT_CODES, DIRS, FILES } from "../pages/constants.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import {
  isClaudeCLIAvailable,
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  ensureBinaryExists,
  fileExists,
  injectMarketplaceIntoConfig,
} from "../helpers/test-utils.js";

/**
 * Scope-aware local skill copying E2E tests.
 *
 * These tests verify that local skill copies respect per-skill scope:
 *   - Project-scoped local skills -> <project>/.claude/skills/
 *   - Global-scoped local skills  -> ~/.claude/skills/
 *
 * All tests require the Claude CLI for plugin install/uninstall operations.
 */

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)("scope-aware local skill copying", () => {
  let fixture: E2EPluginSource;

  let tempDir: string | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    fixture = await createE2EPluginSource();
  }, TIMEOUTS.SETUP * 2);

  afterAll(async () => {
    if (fixture) await cleanupTempDir(fixture.tempDir);
  });

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined;
    }
  });

  describe("init mixed mode -- scope-aware local copy", () => {
    it(
      "should copy project-scoped local skills to project dir and global-scoped local skills to HOME dir",
      { timeout: TIMEOUTS.EXTENDED_LIFECYCLE },
      async () => {
        tempDir = await createTempDir();
        const fakeHome = path.join(tempDir, "fake-home");
        const projectDir = path.join(fakeHome, "project");

        await mkdir(fakeHome, { recursive: true });
        await mkdir(projectDir, { recursive: true });
        await createPermissionsFile(fakeHome);
        await createPermissionsFile(projectDir);

        const wizard = await InitWizard.launch({
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
          projectDir,
          env: { HOME: fakeHome },
          rows: 60,
          cols: 120,
        });

        try {
          // Stack -> Domain -> Build
          const domain = await wizard.stack.selectFirstStack();
          const build = await domain.acceptDefaults();

          // Web domain -- toggle first skill to project scope, leave second at global
          await build.toggleScopeOnFocusedSkill();
          await build.advanceDomain();

          // API domain (pass through)
          await build.advanceDomain();

          // Shared domain (pass through)
          const sources = await build.advanceToSources();

          // Sources -- set first TWO skills to local (mixed mode)
          await sources.waitForReady();
          await sources.toggleFocusedSource(); // Set web-framework-react to local
          await sources.navigateDown();
          await sources.toggleFocusedSource(); // Set web-testing-vitest to local
          const agents = await sources.advance();

          // Agents -- accept defaults
          const confirm = await agents.acceptDefaults("init");

          // Confirm
          const result = await confirm.confirm();
          const exitCode = await result.exitCode;
          expect(exitCode).toBe(EXIT_CODES.SUCCESS);

          const rawOutput = result.rawOutput;

          // Should be mixed mode (some local, some plugin)
          expect(rawOutput).toContain("Mixed");

          // --- Scope-aware copy assertions ---
          await expect({ dir: projectDir }).toHaveSkillCopied("web-framework-react");
          await expect({ dir: fakeHome }).toHaveSkillCopied("web-testing-vitest");
          await expect({ dir: fakeHome }).not.toHaveSkillCopied("web-framework-react");
          await expect({ dir: projectDir }).not.toHaveSkillCopied("web-testing-vitest");
          await expect({ dir: fakeHome }).toHaveCompiledAgent("web-developer");

          await result.destroy();
        } catch (e) {
          await wizard.destroy();
          throw e;
        }
      },
    );
  });

  describe("edit source switch -- scope-aware migration", () => {
    it(
      "should copy to HOME when switching global-scope skill from plugin to local",
      { timeout: TIMEOUTS.EXTENDED_LIFECYCLE },
      async () => {
        tempDir = await createTempDir();
        const fakeHome = path.join(tempDir, "fake-home");
        const projectDir = path.join(fakeHome, "project");

        await mkdir(fakeHome, { recursive: true });
        await mkdir(projectDir, { recursive: true });
        await createPermissionsFile(fakeHome);
        await createPermissionsFile(projectDir);

        // Phase 1: Init in plugin mode -- all skills global scope, plugin source
        const initWizard = await InitWizard.launch({
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
          projectDir,
          env: { HOME: fakeHome },
        });

        try {
          const initResult = await initWizard.completeWithDefaults();
          expect(await initResult.exitCode).toBe(EXIT_CODES.SUCCESS);
          await initResult.destroy();
        } catch (e) {
          await initWizard.destroy();
          throw e;
        }

        // Phase 2: Edit -- switch ALL to local via "l" hotkey
        const editWizard = await EditWizard.launch({
          projectDir,
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
          env: { HOME: fakeHome },
          rows: 60,
          cols: 120,
        });

        try {
          const sources = await editWizard.build.passThroughAllDomains();

          await sources.waitForReady();
          await sources.setAllLocal();
          const agents = await sources.advance();

          const confirm = await agents.acceptDefaults("edit");
          const result = await confirm.confirm();

          const editExitCode = await result.exitCode;
          expect(editExitCode).toBe(EXIT_CODES.SUCCESS);

          // --- Assertions ---
          await expect({ dir: fakeHome }).toHaveSkillCopied("web-framework-react");
          await expect({ dir: projectDir }).not.toHaveSkillCopied("web-framework-react");
          await expect({ dir: fakeHome }).toHaveCompiledAgent("web-developer");

          await result.destroy();
        } catch (e) {
          await editWizard.destroy();
          throw e;
        }
      },
    );

    it(
      "should delete from HOME when switching global-scope skill from local to plugin",
      { timeout: TIMEOUTS.EXTENDED_LIFECYCLE },
      async () => {
        tempDir = await createTempDir();
        const fakeHome = path.join(tempDir, "fake-home");
        const projectDir = path.join(fakeHome, "project");

        await mkdir(fakeHome, { recursive: true });
        await mkdir(projectDir, { recursive: true });
        await createPermissionsFile(fakeHome);
        await createPermissionsFile(projectDir);

        // Phase 1: Init in eject mode -- all skills global scope
        const initWizard = await InitWizard.launch({
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
          projectDir,
          env: { HOME: fakeHome },
          rows: 60,
          cols: 120,
        });

        try {
          const domain = await initWizard.stack.selectFirstStack();
          const build = await domain.acceptDefaults();
          const sources = await build.passThroughAllDomains();

          // Sources -- set ALL to local
          await sources.waitForReady();
          await sources.setAllLocal();
          const agents = await sources.advance();

          const confirm = await agents.acceptDefaults("init");
          const initResult = await confirm.confirm();
          expect(await initResult.exitCode).toBe(EXIT_CODES.SUCCESS);
          await initResult.destroy();
        } catch (e) {
          await initWizard.destroy();
          throw e;
        }

        // Verify Phase 1: Skills were copied to HOME
        await expect({ dir: fakeHome }).toHaveSkillCopied("web-framework-react");

        // Inject marketplace so mode-migrator can install plugins
        const globalConfigPath = path.join(fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
        const globalConfigExists = await fileExists(globalConfigPath);
        const projectConfigPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
        const projectConfigExists = await fileExists(projectConfigPath);

        if (globalConfigExists) {
          await injectMarketplaceIntoConfig(fakeHome, fixture.marketplaceName);
        }
        if (projectConfigExists) {
          await injectMarketplaceIntoConfig(projectDir, fixture.marketplaceName);
        }

        // Phase 2: Edit -- switch ALL to plugin via "p" hotkey
        const editWizard = await EditWizard.launch({
          projectDir,
          source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
          env: { HOME: fakeHome },
          rows: 60,
          cols: 120,
        });

        try {
          const sources = await editWizard.build.passThroughAllDomains();

          await sources.waitForReady();
          await sources.setAllPlugin();
          const agents = await sources.advance();

          const confirm = await agents.acceptDefaults("edit");
          const result = await confirm.confirm();

          const editExitCode = await result.exitCode;
          expect(editExitCode).toBe(EXIT_CODES.SUCCESS);

          const rawOutput = result.rawOutput;
          expect(rawOutput).toContain("Switching");
          expect(rawOutput).toContain("to plugin");

          // --- Assertions ---
          await expect({ dir: fakeHome }).not.toHaveSkillCopied("web-framework-react");
          await expect({ dir: projectDir }).not.toHaveSkillCopied("web-framework-react");
          await expect({ dir: fakeHome }).toHaveCompiledAgent("web-developer");

          await result.destroy();
        } catch (e) {
          await editWizard.destroy();
          throw e;
        }
      },
    );
  });
});
