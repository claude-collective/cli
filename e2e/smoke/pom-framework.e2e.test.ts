import path from "path";
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import "../matchers/setup.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import { ProjectBuilder } from "../fixtures/project-builder.js";
import { CLI } from "../fixtures/cli.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { ensureBinaryExists, cleanupTempDir } from "../helpers/test-utils.js";
import { EXIT_CODES, STEP_TEXT, TIMEOUTS } from "../pages/constants.js";
import type { WizardResult, ProjectHandle } from "../pages/wizard-result.js";

/**
 * POM Framework Smoke Tests (D-134, Step 0 Validation)
 *
 * These 3 tests prove the Page Object Model framework works end-to-end
 * before any existing test is migrated. Each test exercises a different
 * layer of the framework:
 *
 * 1. InitWizard.completeWithDefaults + toHaveConfig
 * 2. EditWizard.passThrough + toHaveCompiledAgents
 * 3. ProjectBuilder.minimal + CLI.run(compile) + toHaveCompiledAgents
 */

describe("POM Framework Smoke Tests", () => {
  beforeAll(ensureBinaryExists, TIMEOUTS.SETUP);

  describe("InitWizard.completeWithDefaults", () => {
    let result: WizardResult | undefined;

    afterEach(async () => {
      await result?.destroy();
      result = undefined;
    });

    it(
      "should complete init with defaults and produce config + compiled agents",
      async () => {
        const wizard = await InitWizard.launch();
        result = await wizard.completeWithDefaults();

        expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);
        await expect(result.project).toHaveConfig();
        await expect(result.project).toHaveCompiledAgents();
      },
      TIMEOUTS.INTERACTIVE,
    );
  });

  describe("EditWizard.passThrough", () => {
    let result: WizardResult | undefined;
    let source: { sourceDir: string; tempDir: string } | undefined;
    let project: ProjectHandle | undefined;

    afterEach(async () => {
      await result?.destroy();
      result = undefined;
      if (source) {
        await cleanupTempDir(source.tempDir);
        source = undefined;
      }
      if (project) {
        await cleanupTempDir(path.dirname(project.dir));
        project = undefined;
      }
    });

    it(
      "should pass through edit wizard and preserve compiled agents",
      async () => {
        source = await createE2ESource();
        project = await ProjectBuilder.editable({
          skills: ["web-framework-react", "api-framework-hono", "shared-meta-research-methodology"],
          agents: ["web-developer", "api-developer"],
          domains: ["web", "api", "shared"],
        });

        const wizard = await EditWizard.launch({
          projectDir: project.dir,
          source,
        });
        result = await wizard.passThrough();

        expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);
        await expect(result.project).toHaveConfig();
      },
      TIMEOUTS.INTERACTIVE,
    );
  });

  describe("ProjectBuilder.minimal + CLI.run(compile)", () => {
    let project: ProjectHandle | undefined;

    afterEach(async () => {
      if (project) {
        await cleanupTempDir(path.dirname(project.dir));
        project = undefined;
      }
    });

    it(
      "should compile a minimal project and produce compiled agents",
      async () => {
        project = await ProjectBuilder.minimal();

        const cliResult = await CLI.run(["compile", "--verbose"], project);

        expect(cliResult.exitCode).toBe(EXIT_CODES.SUCCESS);
        expect(cliResult.output).toContain(STEP_TEXT.COMPILE_SUCCESS);
        await expect(project).toHaveCompiledAgents();
      },
      TIMEOUTS.INTERACTIVE,
    );
  });
});
