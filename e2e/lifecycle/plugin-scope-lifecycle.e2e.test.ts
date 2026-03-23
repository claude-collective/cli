import { CLI } from "../fixtures/cli.js";
import { mkdir } from "fs/promises";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import { TIMEOUTS, DIRS, EXIT_CODES, FILES } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import {
  isClaudeCLIAvailable,
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  ensureBinaryExists,
  fileExists,
  readTestFile,
} from "../helpers/test-utils.js";

/**
 * Plugin scope lifecycle E2E test: Init with mixed scopes -> Verify agent content -> Edit -> Verify preservation.
 *
 * Requires Claude CLI (plugin mode). Skipped when not available.
 */

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)(
  "plugin scope lifecycle: init with mixed scopes -> verify agent content -> edit -> verify preservation",
  () => {
    let fixture: E2EPluginSource;
    let tempDir: string;
    let fakeHome: string;
    let projectDir: string;

    beforeAll(async () => {
      await ensureBinaryExists();
      fixture = await createE2EPluginSource();

      tempDir = await createTempDir();
      fakeHome = path.join(tempDir, "fake-home");
      projectDir = path.join(fakeHome, "project");

      await mkdir(fakeHome, { recursive: true });
      await mkdir(projectDir, { recursive: true });
    }, TIMEOUTS.SETUP * 2);

    afterAll(async () => {
      if (tempDir) await cleanupTempDir(tempDir);
      if (fixture) await cleanupTempDir(fixture.tempDir);
    });

    it.fails(
      "should init with mixed scopes, verify agent content, and verify preservation (expected fail -- scope routing bugs)",
      { timeout: TIMEOUTS.EXTENDED_LIFECYCLE },
      async () => {
        // ================================================================
        // Phase 1: Init wizard with scope toggling
        // ================================================================

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

          // Web domain -- toggle web-framework-react to global scope
          await build.toggleScopeOnFocusedSkill();
          await build.advanceDomain();

          // API domain (pass through)
          await build.advanceDomain();

          // Shared domain (pass through)
          const sources = await build.advanceToSources();

          // Sources -- accept recommended
          await sources.waitForReady();
          const agents = await sources.advance();

          // Agents step -- toggle web-developer to global scope
          await agents.toggleScopeOnFocusedAgent();
          const confirm = await agents.advance("init");

          // Confirm
          const initResultObj = await confirm.confirm();
          const initExitCode = await initResultObj.exitCode;

          const initOutput = initResultObj.output;
          const initRaw = initResultObj.rawOutput;

          // P1-A: Init exited successfully
          expect(initExitCode).toBe(EXIT_CODES.SUCCESS);

          // P1-B: No errors in output
          expect(initRaw).not.toContain("ENOENT");
          expect(initOutput).not.toContain("Failed to");

          await initResultObj.destroy();
        } catch (e) {
          await wizard.destroy();
          throw e;
        }

        // ================================================================
        // Phase 2: Verify initial state
        // ================================================================

        // P2-A: Project config exists
        const projectConfigPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
        expect(await fileExists(projectConfigPath), "Project config must exist").toBe(true);

        // P2-B: Global config exists
        const globalConfigPath = path.join(fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
        expect(await fileExists(globalConfigPath), "Global config must exist (scope split)").toBe(
          true,
        );

        const globalConfigContent = await readTestFile(globalConfigPath);
        const projectConfigContent = await readTestFile(projectConfigPath);

        // P2-D: Config scope split
        expect(globalConfigContent).toContain("web-developer");
        expect(projectConfigContent).toContain("api-developer");

        // --- Scope routing ---
        const globalWebDevPath = path.join(fakeHome, DIRS.CLAUDE, "agents", "web-developer.md");
        const projectWebDevPath = path.join(projectDir, DIRS.CLAUDE, "agents", "web-developer.md");
        const globalApiDevPath = path.join(fakeHome, DIRS.CLAUDE, "agents", "api-developer.md");
        const projectApiDevPath = path.join(projectDir, DIRS.CLAUDE, "agents", "api-developer.md");

        expect(
          await fileExists(globalWebDevPath),
          "web-developer.md must exist in global agents dir",
        ).toBe(true);
        expect(
          await fileExists(projectWebDevPath),
          "web-developer.md must NOT exist in project agents dir",
        ).toBe(false);

        expect(
          await fileExists(projectApiDevPath),
          "api-developer.md must exist in project agents dir",
        ).toBe(true);
        expect(
          await fileExists(globalApiDevPath),
          "api-developer.md must NOT exist in global agents dir",
        ).toBe(false);

        // --- Agent content assertions ---
        const webDevContent = await readTestFile(globalWebDevPath);
        expect(webDevContent).toMatch(/^---/);
        expect(webDevContent).toMatch(/name:\s*web-developer/);
        expect(webDevContent).toContain("web-framework-react");
        expect(webDevContent).toContain("web-testing-vitest");
        expect(webDevContent).toContain("web-state-zustand");
        expect(webDevContent).not.toContain("api-framework-hono");

        const apiDevContent = await readTestFile(projectApiDevPath);
        expect(apiDevContent).toMatch(/^---/);
        expect(apiDevContent).toMatch(/name:\s*api-developer/);
        expect(apiDevContent).toContain("api-framework-hono");
        expect(apiDevContent).toContain("meta-reviewing");
        expect(apiDevContent).not.toContain("web-framework-react");

        // ================================================================
        // Phase 3: Run compile and verify scope preserved
        // ================================================================

        const compileResult = await CLI.run(
          ["compile", "--source", fixture.sourceDir],
          { dir: projectDir },
          { env: { HOME: fakeHome } },
        );
        expect(compileResult.exitCode, `compile failed: ${compileResult.output}`).toBe(
          EXIT_CODES.SUCCESS,
        );

        // Re-verify scope routing
        expect(await fileExists(globalWebDevPath)).toBe(true);
        expect(await fileExists(projectWebDevPath)).toBe(false);
        expect(await fileExists(projectApiDevPath)).toBe(true);
        expect(await fileExists(globalApiDevPath)).toBe(false);

        // Re-verify content after recompilation
        const webDevRecompiled = await readTestFile(globalWebDevPath);
        expect(webDevRecompiled).toContain("web-framework-react");
        expect(webDevRecompiled).not.toContain("api-framework-hono");

        const apiDevRecompiled = await readTestFile(projectApiDevPath);
        expect(apiDevRecompiled).toContain("api-framework-hono");
        expect(apiDevRecompiled).not.toContain("web-framework-react");
      },
    );
  },
);
