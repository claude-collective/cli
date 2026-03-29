import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { STEP_TEXT, TIMEOUTS, EXIT_CODES } from "../pages/constants.js";
import { cleanupTempDir, ensureBinaryExists, isClaudeCLIAvailable } from "../helpers/test-utils.js";
import "../matchers/setup.js";

/**
 * E2E tests for the init wizard in plugin mode.
 *
 * The entire suite is skipped when the Claude CLI is not available.
 */

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)("init wizard — plugin mode", () => {
  let fixture: E2EPluginSource;
  let wizard: InitWizard | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    fixture = await createE2EPluginSource();
  }, TIMEOUTS.SETUP);

  afterAll(async () => {
    if (fixture) await cleanupTempDir(fixture.tempDir);
  });

  afterEach(async () => {
    await wizard?.destroy();
    wizard = undefined;
  });

  describe("plugin installation happy path", () => {
    it("should complete plugin-mode init and install plugins", async () => {
      wizard = await InitWizard.launch({
        source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
      });
      const result = await wizard.completeWithDefaults();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      const output = result.output;
      expect(output).toContain("Installing skill plugins...");
      expect(output).toContain("skill plugins");
      expect(output).toContain("Plugin (native install)");
      expect(output).toContain(`Installed web-framework-react@${fixture.marketplaceName}`);
      expect(output).not.toContain("Skills copied to:");
    });

    it("should generate config.ts with marketplace source", async () => {
      wizard = await InitWizard.launch({
        source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
      });
      const result = await wizard.completeWithDefaults();
      await result.exitCode;

      await expect(result.project).toHaveConfig({
        skillIds: ["web-framework-react"],
        source: fixture.marketplaceName,
      });
    });

    it("should compile agents", async () => {
      wizard = await InitWizard.launch({
        source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
      });
      const result = await wizard.completeWithDefaults();
      await result.exitCode;

      await expect(result.project).toHaveCompiledAgent("web-developer");
    });

    it("should display completion details after install", async () => {
      wizard = await InitWizard.launch({
        source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
      });
      const result = await wizard.completeWithDefaults();
      await result.exitCode;

      const output = result.output;
      expect(output).toContain("Agents compiled to:");
      expect(output).toContain("Configuration:");
    });
  });

  describe("marketplace registration", () => {
    it("should register or skip marketplace without error", async () => {
      wizard = await InitWizard.launch({
        source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
      });
      const result = await wizard.completeWithDefaults();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      const output = result.output;
      expect(output).toContain(STEP_TEXT.INIT_SUCCESS);
      expect(output).not.toContain("Failed to");
    });
  });

  describe("eject mode fallback", () => {
    it("should install locally when source has no marketplace", async () => {
      const localSource = await createE2ESource();

      wizard = await InitWizard.launch({
        source: { sourceDir: localSource.sourceDir, tempDir: localSource.tempDir },
      });
      const result = await wizard.completeWithDefaults();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      const output = result.output;
      expect(output).not.toContain("Installing skill plugins");
      expect(output).toContain("Skills copied to:");

      await expect(result.project).toHaveSkillCopied("web-framework-react");
    });
  });

  /** Gap 3: Plugin scope routing */
  describe("plugin scope routing", () => {
    it("should install plugin skills with correct scope routing", async () => {
      wizard = await InitWizard.launch({
        source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
      });
      const result = await wizard.completeWithDefaults();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      const output = result.output;
      expect(output).toContain(`Installed web-framework-react@${fixture.marketplaceName}`);
      expect(output).toContain(`Installed web-testing-vitest@${fixture.marketplaceName}`);
      expect(output).toContain("skill plugins");
      expect(output).not.toContain("Failed to install plugin");
    });

    it("should install project-scoped plugins correctly in mixed scope mode", async () => {
      wizard = await InitWizard.launch({
        source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
      });

      // Navigate through wizard, toggling first skill to project scope
      const domain = await wizard.stack.selectFirstStack();
      const build = await domain.acceptDefaults();

      // Toggle first skill (web-framework-react) to project scope
      await build.toggleScopeOnFocusedSkill();
      const sources = await build.passThroughAllDomains();
      const agents = await sources.acceptDefaults();
      const confirm = await agents.acceptDefaults("init");
      const result = await confirm.confirm();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      const output = result.output;
      expect(output).toContain("Installing skill plugins...");
      expect(output).toContain(`Installed web-framework-react@${fixture.marketplaceName}`);
      expect(output).not.toContain("Failed to install plugin");
    });
  });

  describe("mixed install mode", () => {
    it("should install plugin skills as plugins and local skills locally in mixed mode", async () => {
      wizard = await InitWizard.launch({
        source: { sourceDir: fixture.sourceDir, tempDir: fixture.tempDir },
      });

      // Navigate through wizard, set one skill to local in sources step
      const domain = await wizard.stack.selectFirstStack();
      const build = await domain.acceptDefaults();
      const sources = await build.passThroughAllDomains();

      // Toggle one skill to local source
      await sources.toggleFocusedSource();
      const agents = await sources.advance();
      const confirm = await agents.acceptDefaults("init");
      const result = await confirm.confirm();

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      const output = result.output;
      expect(output).toContain("Installing skill plugins...");

      // The local-sourced skill should be copied locally
      await expect(result.project).toHaveSkillCopied("web-framework-react");

      // Agents should still be compiled
      await expect(result.project).toHaveCompiledAgent("web-developer");
    });
  });
});
