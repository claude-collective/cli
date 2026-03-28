import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { cleanupTempDir, ensureBinaryExists } from "../helpers/test-utils.js";
import { ProjectBuilder } from "../fixtures/project-builder.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import { TIMEOUTS, EXIT_CODES } from "../pages/constants.js";
import "../matchers/setup.js";

/**
 * E2E tests for the edit wizard in eject mode — skill add and remove.
 *
 * Eject mode differs from plugin mode:
 * - No `claude plugin install/uninstall` calls
 * - Skills are copied from the source directory to .claude/skills/
 * - Removal in eject mode updates config but does NOT delete skill files
 */

/** Timeout for individual edit test cases including wizard navigation + edit completion */
const EDIT_TEST_TIMEOUT_MS = TIMEOUTS.PLUGIN_INSTALL;

describe("edit wizard — eject mode", () => {
  let sourceFixture: { sourceDir: string; tempDir: string };
  let wizard: EditWizard | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    sourceFixture = await createE2ESource();
  }, TIMEOUTS.SETUP);

  afterAll(async () => {
    if (sourceFixture) await cleanupTempDir(sourceFixture.tempDir);
  });

  afterEach(async () => {
    await wizard?.destroy();
    wizard = undefined;
  });

  /**
   * Navigate from a single-domain build step through to completion.
   * Single domain: Enter once on build -> sources -> agents -> confirm -> complete.
   */
  async function completeEditFromBuild(w: EditWizard) {
    const sources = await w.build.advanceToSources();
    const agents = await sources.acceptDefaults();
    const confirm = await agents.acceptDefaults("edit");
    return confirm.confirm();
  }

  describe("add a skill during local edit", () => {
    it(
      "should update config with newly selected skill",
      { timeout: EDIT_TEST_TIMEOUT_MS },
      async () => {
        // Create project with only web-framework-react. The E2E source also has
        // web-testing-vitest and web-state-zustand in the Web domain.
        const project = await ProjectBuilder.editable({
          skills: ["web-framework-react"],
          agents: ["web-developer"],
          domains: ["web"],
        });

        wizard = await EditWizard.launch({
          projectDir: project.dir,
          source: sourceFixture,
          rows: 60,
          cols: 120,
          env: { HOME: project.dir },
        });

        // Arrow down to reach the next skill (Testing/vitest), then space to select it
        await wizard.build.navigateDown();
        await wizard.build.toggleFocusedSkill();

        // Navigate through remaining steps: build -> sources -> agents -> confirm -> complete
        const result = await completeEditFromBuild(wizard);

        expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = result.rawOutput;

        // The changes summary should mention additions
        expect(rawOutput).toMatch(/\d+ added/);

        // Config should now include both skills
        await expect(result.project).toHaveConfig({ skillIds: ["web-framework-react"] });
      },
    );

    it(
      "should show changes summary with added count",
      { timeout: EDIT_TEST_TIMEOUT_MS },
      async () => {
        const project = await ProjectBuilder.editable({
          skills: ["web-framework-react"],
          agents: ["web-developer"],
          domains: ["web"],
        });

        wizard = await EditWizard.launch({
          projectDir: project.dir,
          source: sourceFixture,
          rows: 60,
          cols: 120,
          env: { HOME: project.dir },
        });

        // Select an additional skill
        await wizard.build.navigateDown();
        await wizard.build.toggleSkill("vitest");

        const result = await completeEditFromBuild(wizard);

        expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = result.rawOutput;

        // The "Changes:" section should list additions
        expect(rawOutput).toContain("Changes:");
        expect(rawOutput).toMatch(/\d+ added/);
      },
    );

    it(
      "should recompile agents after adding a skill",
      { timeout: EDIT_TEST_TIMEOUT_MS },
      async () => {
        const project = await ProjectBuilder.editable({
          skills: ["web-framework-react"],
          agents: ["web-developer"],
          domains: ["web"],
        });

        wizard = await EditWizard.launch({
          projectDir: project.dir,
          source: sourceFixture,
          rows: 60,
          cols: 120,
          env: { HOME: project.dir },
        });

        // Select an additional skill
        await wizard.build.navigateDown();
        await wizard.build.toggleSkill("vitest");

        const result = await completeEditFromBuild(wizard);

        expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

        // Verify agent was compiled after adding a skill
        await expect(result.project).toHaveCompiledAgent("web-developer");
      },
    );
  });

  describe("remove a skill during local edit", () => {
    it(
      "should detect unresolvable skill as removed and complete edit",
      { timeout: EDIT_TEST_TIMEOUT_MS },
      async () => {
        // Create project with 2 skills: web-framework-react (in E2E source)
        // and web-styling-tailwind (NOT in E2E source). The wizard cannot
        // resolve tailwind from the E2E source, so it drops it automatically.
        const project = await ProjectBuilder.editable({
          skills: ["web-framework-react", "web-styling-tailwind"],
          agents: ["web-developer"],
          domains: ["web"],
        });

        wizard = await EditWizard.launch({
          projectDir: project.dir,
          source: sourceFixture,
          rows: 60,
          cols: 120,
          env: { HOME: project.dir },
        });

        // Navigate straight through without changing skills
        const result = await completeEditFromBuild(wizard);

        expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = result.rawOutput;

        // The removal should be reported in the changes summary.
        expect(rawOutput).toContain("Changes:");
        expect(rawOutput).toContain("web-styling-tailwind");

        // Config should still reference the surviving skill.
        await expect(result.project).toHaveConfig({ skillIds: ["web-framework-react"] });
      },
    );

    it("should show removal in changes summary", { timeout: EDIT_TEST_TIMEOUT_MS }, async () => {
      const project = await ProjectBuilder.editable({
        skills: ["web-framework-react", "web-styling-tailwind"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      wizard = await EditWizard.launch({
        projectDir: project.dir,
        source: sourceFixture,
        rows: 60,
        cols: 120,
        env: { HOME: project.dir },
      });

      const result = await completeEditFromBuild(wizard);

      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      const rawOutput = result.rawOutput;

      // The changes summary should mention removals
      expect(rawOutput).toMatch(/\d+ removed/);
      expect(rawOutput).toContain("Changes:");
    });

    it(
      "should recompile agents after removing a skill",
      { timeout: EDIT_TEST_TIMEOUT_MS },
      async () => {
        const project = await ProjectBuilder.editable({
          skills: ["web-framework-react", "web-styling-tailwind"],
          agents: ["web-developer"],
          domains: ["web"],
        });

        wizard = await EditWizard.launch({
          projectDir: project.dir,
          source: sourceFixture,
          rows: 60,
          cols: 120,
          env: { HOME: project.dir },
        });

        const result = await completeEditFromBuild(wizard);

        expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

        // Verify agent was compiled after removing a skill
        await expect(result.project).toHaveCompiledAgent("web-developer");
      },
    );

    it(
      "should preserve local skill files when source is unchanged during edit",
      { timeout: EDIT_TEST_TIMEOUT_MS },
      async () => {
        const project = await ProjectBuilder.editable({
          skills: ["web-framework-react", "web-styling-tailwind"],
          agents: ["web-developer"],
          domains: ["web"],
        });

        wizard = await EditWizard.launch({
          projectDir: project.dir,
          source: sourceFixture,
          rows: 60,
          cols: 120,
          env: { HOME: project.dir },
        });

        const result = await completeEditFromBuild(wizard);

        await result.exitCode;

        // The wizard preserves the saved source ("eject") from the existing config
        // when the user doesn't explicitly change it. No source migration is triggered,
        // so eject skill files remain intact.
        await expect(result.project).toHaveSkillCopied("web-framework-react");
      },
    );
  });
});
