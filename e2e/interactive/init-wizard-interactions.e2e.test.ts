import path from "path";
import { mkdir } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { STEP_TEXT, TIMEOUTS, EXIT_CODES } from "../pages/constants.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  createPermissionsFile,
} from "../helpers/test-utils.js";
import "../matchers/setup.js";

/**
 * Init wizard interaction tests: domain deselection, agent deselection,
 * and scope toggling via S hotkey.
 */

describe("init wizard — interactions", () => {
  let wizard: InitWizard | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    await wizard?.destroy();
    wizard = undefined;
  });

  describe("domain deselection", () => {
    it(
      "should not install skills from a deselected domain",
      { timeout: TIMEOUTS.INTERACTIVE },
      async () => {
        wizard = await InitWizard.launch();

        // Select E2E Test Stack
        const domain = await wizard.stack.selectFirstStack();

        // Deselect API domain
        await domain.toggleDomain(STEP_TEXT.DOMAIN_API);

        // Continue with only Web selected
        const build = await domain.advance();

        // Advance through remaining domains (Web + Methodology, no API) to sources
        const sources = await build.passThroughWebAndMethodologyDomains();
        const agents = await sources.acceptDefaults();
        const confirm = await agents.acceptDefaults("init");
        const result = await confirm.confirm();

        expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

        // API skills should NOT be in config
        await expect(result.project).toHaveConfig({
          skillIds: ["web-framework-react"],
        });

        // The output should NOT contain API-only skills
        const output = result.output;
        expect(output).not.toContain("api-framework-hono");
      },
    );
  });

  describe("agent deselection", () => {
    it("should not compile a deselected agent", { timeout: TIMEOUTS.INTERACTIVE }, async () => {
      wizard = await InitWizard.launch();

      // Select stack, accept domains, advance through build step
      const domain = await wizard.stack.selectFirstStack();
      const build = await domain.acceptDefaults();
      const sources = await build.passThroughAllDomains();
      const agents = await sources.acceptDefaults();

      // Deselect API Developer agent
      await agents.toggleAgent("API Developer");

      const confirm = await agents.advance("init");
      const result = await confirm.confirm();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      // web-developer SHOULD be compiled
      await expect(result.project).toHaveCompiledAgent("web-developer");
    });
  });

  describe("scope toggle via S hotkey", () => {
    let tempDir: string | undefined;

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
        tempDir = undefined;
      }
    });

    it(
      "should toggle skill scope from global to project during build step",
      { timeout: TIMEOUTS.INTERACTIVE },
      async () => {
        tempDir = await createTempDir();
        const fakeHome = path.join(tempDir, "fake-home");
        const projectDir = path.join(fakeHome, "project");
        await mkdir(fakeHome, { recursive: true });
        await mkdir(projectDir, { recursive: true });
        await createPermissionsFile(fakeHome);
        await createPermissionsFile(projectDir);

        wizard = await InitWizard.launch({
          projectDir,
          env: { HOME: fakeHome },
        });

        const domain = await wizard.stack.selectFirstStack();
        const build = await domain.acceptDefaults();

        // Press S to toggle scope of the focused skill (default is "global")
        await build.toggleScopeOnFocusedSkill();

        // The scope badge should show "P" for project
        const buildOutput = build.getOutput();
        expect(buildOutput).toContain("P ");

        // Complete the wizard
        const sources = await build.passThroughAllDomains();
        const agents = await sources.acceptDefaults();
        const confirm = await agents.acceptDefaults("init");
        const result = await confirm.confirm();

        expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

        // Config should contain the skill with project scope
        await expect(result.project).toHaveConfig({
          skillIds: ["web-framework-react"],
        });
      },
    );
  });
});
