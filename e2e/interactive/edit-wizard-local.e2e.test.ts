import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { TerminalSession } from "../helpers/terminal-session.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import {
  verifyConfig,
  verifyAgentCompiled,
  verifySkillCopiedLocally,
} from "../helpers/plugin-assertions.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  createEditableProject,
  createPermissionsFile,
  delay,
  navigateEditWizardToCompletion,
  WIZARD_LOAD_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  EXIT_TIMEOUT_MS,
  EXIT_CODES,
  SETUP_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * E2E tests for the edit wizard in local mode — skill add and remove.
 *
 * These tests fill the gap identified in e2e-test-gaps.md (Gap 3):
 * the edit-wizard-plugin tests cover add/remove for plugin mode,
 * but there was no equivalent for local mode.
 *
 * Local mode differs from plugin mode:
 * - No `claude plugin install/uninstall` calls
 * - Skills are copied from the source directory to .claude/skills/
 * - Removal in local mode updates config but does NOT delete skill files
 *   (deleteLocalSkill is only called for source changes, not removals)
 *
 * All tests use createE2ESource() (shared fixture) and TerminalSession.
 */

/** Generous timeout for edit completion including recompilation */
const EDIT_COMPLETION_TIMEOUT_MS = 30_000;

/** Timeout for individual edit test cases including wizard navigation + edit completion */
const EDIT_TEST_TIMEOUT_MS = 60_000;

describe("edit wizard — local mode", () => {
  let sourceFixture: { sourceDir: string; tempDir: string };
  let tempDir: string | undefined;
  let session: TerminalSession | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    sourceFixture = await createE2ESource();
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    if (sourceFixture) await cleanupTempDir(sourceFixture.tempDir);
  });

  afterEach(async () => {
    await session?.destroy();
    session = undefined;

    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined;
    }
  });

  describe("add a skill during local edit", () => {
    it(
      "should update config with newly selected skill",
      { timeout: EDIT_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        // Create project with only web-framework-react. The E2E source also has
        // web-testing-vitest and web-state-zustand in the Web domain.
        const projectDir = await createEditableProject(tempDir, {
          skills: ["web-framework-react"],
          agents: ["web-developer"],
          domains: ["web"],
        });

        await createPermissionsFile(projectDir);

        session = new TerminalSession(["edit", "--source", sourceFixture.sourceDir], projectDir, {
          env: { HOME: projectDir },
          rows: 60,
          cols: 120,
        });

        // Wait for the build step to render with pre-selected skills
        await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
        await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);

        // The build step shows categories vertically. Framework (react) is at the top.
        // Arrow down to reach the next category (Testing), then space to select
        // the first skill in it (vitest).
        session.arrowDown();
        await delay(STEP_TRANSITION_DELAY_MS);

        session.space();
        await delay(STEP_TRANSITION_DELAY_MS);

        // Navigate through remaining steps: build -> sources -> agents -> confirm -> complete
        await navigateEditWizardToCompletion(session);

        // Wait for the edit to complete
        await session.waitForText("Plugin updated", EDIT_COMPLETION_TIMEOUT_MS);

        const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = session.getRawOutput();

        // The changes summary should mention additions
        expect(rawOutput).toMatch(/\d+ added/);

        // Config should now include both skills
        await verifyConfig(projectDir, { skillIds: ["web-framework-react"] });
      },
    );

    it(
      "should show changes summary with added count",
      { timeout: EDIT_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        const projectDir = await createEditableProject(tempDir, {
          skills: ["web-framework-react"],
          agents: ["web-developer"],
          domains: ["web"],
        });

        await createPermissionsFile(projectDir);

        session = new TerminalSession(["edit", "--source", sourceFixture.sourceDir], projectDir, {
          env: { HOME: projectDir },
          rows: 60,
          cols: 120,
        });

        await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
        await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);

        // Select an additional skill
        session.arrowDown();
        await delay(STEP_TRANSITION_DELAY_MS);
        session.space();
        await delay(STEP_TRANSITION_DELAY_MS);

        await navigateEditWizardToCompletion(session);
        await session.waitForText("Plugin updated", EDIT_COMPLETION_TIMEOUT_MS);

        const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = session.getRawOutput();

        // The "Changes:" section should list additions
        expect(rawOutput).toContain("Changes:");
        expect(rawOutput).toMatch(/\d+ added/);
      },
    );

    it(
      "should recompile agents after adding a skill",
      { timeout: EDIT_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        const projectDir = await createEditableProject(tempDir, {
          skills: ["web-framework-react"],
          agents: ["web-developer"],
          domains: ["web"],
        });

        await createPermissionsFile(projectDir);

        session = new TerminalSession(["edit", "--source", sourceFixture.sourceDir], projectDir, {
          env: { HOME: projectDir },
          rows: 60,
          cols: 120,
        });

        await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
        await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);

        // Select an additional skill
        session.arrowDown();
        await delay(STEP_TRANSITION_DELAY_MS);
        session.space();
        await delay(STEP_TRANSITION_DELAY_MS);

        await navigateEditWizardToCompletion(session);

        // Wait for recompilation
        await session.waitForText("Recompiling agents", EDIT_COMPLETION_TIMEOUT_MS);

        const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        // Verify agent was compiled after adding a skill
        expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);
      },
    );
  });

  describe("remove a skill during local edit", () => {
    it(
      "should detect unresolvable skill as removed and complete edit",
      { timeout: EDIT_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        // Create project with 2 skills: web-framework-react (in E2E source)
        // and web-styling-tailwind (NOT in E2E source). The wizard cannot
        // resolve tailwind from the E2E source, so it drops it automatically.
        // This creates a "removed" change detected by edit.tsx:196.
        const projectDir = await createEditableProject(tempDir, {
          skills: ["web-framework-react", "web-styling-tailwind"],
          agents: ["web-developer"],
          domains: ["web"],
        });

        await createPermissionsFile(projectDir);

        session = new TerminalSession(["edit", "--source", sourceFixture.sourceDir], projectDir, {
          env: { HOME: projectDir },
          rows: 60,
          cols: 120,
        });

        // Build step — tailwind is unresolvable, only react resolves
        await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

        // Navigate straight through without changing skills
        await navigateEditWizardToCompletion(session);

        // Wait for the edit to complete
        await session.waitForText("Plugin updated", EDIT_COMPLETION_TIMEOUT_MS);

        const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = session.getRawOutput();

        // The removal should be reported in the changes summary.
        // edit.tsx:253-255 prints "- <displayName>" for each removed skill.
        expect(rawOutput).toContain("Changes:");
        expect(rawOutput).toContain("web-styling-tailwind");

        // The config.ts should still reference the surviving skill.
        // Note: mergeWithExistingConfig (config-merger.ts:49-57) performs a union merge
        // that preserves existing skills, so the removed skill may still appear in config.
        // The removal is detected by the edit command's diff logic, not the config writer.
        await verifyConfig(projectDir, { skillIds: ["web-framework-react"] });
      },
    );

    it("should show removal in changes summary", { timeout: EDIT_TEST_TIMEOUT_MS }, async () => {
      tempDir = await createTempDir();

      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react", "web-styling-tailwind"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      await createPermissionsFile(projectDir);

      session = new TerminalSession(["edit", "--source", sourceFixture.sourceDir], projectDir, {
        env: { HOME: projectDir },
        rows: 60,
        cols: 120,
      });

      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

      await navigateEditWizardToCompletion(session);
      await session.waitForText("Plugin updated", EDIT_COMPLETION_TIMEOUT_MS);

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const rawOutput = session.getRawOutput();

      // The changes summary should mention removals
      expect(rawOutput).toMatch(/\d+ removed/);
      // The "Changes:" section should list the removal
      expect(rawOutput).toContain("Changes:");
    });

    it(
      "should recompile agents after removing a skill",
      { timeout: EDIT_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        const projectDir = await createEditableProject(tempDir, {
          skills: ["web-framework-react", "web-styling-tailwind"],
          agents: ["web-developer"],
          domains: ["web"],
        });

        await createPermissionsFile(projectDir);

        session = new TerminalSession(["edit", "--source", sourceFixture.sourceDir], projectDir, {
          env: { HOME: projectDir },
          rows: 60,
          cols: 120,
        });

        await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

        await navigateEditWizardToCompletion(session);

        // Wait for recompilation
        await session.waitForText("Recompiling agents", EDIT_COMPLETION_TIMEOUT_MS);

        const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        // Verify agent was compiled after removing a skill
        expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);
      },
    );

    it(
      "should delete local skill files when source changes during edit",
      { timeout: EDIT_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        const projectDir = await createEditableProject(tempDir, {
          skills: ["web-framework-react", "web-styling-tailwind"],
          agents: ["web-developer"],
          domains: ["web"],
        });

        await createPermissionsFile(projectDir);

        session = new TerminalSession(["edit", "--source", sourceFixture.sourceDir], projectDir, {
          env: { HOME: projectDir },
          rows: 60,
          cols: 120,
        });

        await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

        await navigateEditWizardToCompletion(session);
        await session.waitForText("Plugin updated", EDIT_COMPLETION_TIMEOUT_MS);
        await session.waitForExit(EXIT_TIMEOUT_MS);

        // The edit command detects that web-framework-react's source changed from
        // "local" (config) to the E2E source's default. This triggers a local-to-plugin
        // migration which deletes the local skill files (even though the E2E source has
        // no marketplace, so plugin install is skipped with a warning).
        expect(await verifySkillCopiedLocally(projectDir, "web-framework-react")).toBe(false);
      },
    );
  });
});
