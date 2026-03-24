import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ensureBinaryExists, createTempDir, cleanupTempDir } from "../helpers/test-utils.js";
import { ProjectBuilder } from "../fixtures/project-builder.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import { STEP_TEXT, TIMEOUTS, EXIT_CODES } from "../pages/constants.js";
import "../matchers/setup.js";

/**
 * E2E tests for the `edit` command wizard — navigation, hotkeys, cancellation,
 * and build step validation.
 */
describe("edit wizard — navigation and hotkeys", () => {
  let wizard: EditWizard | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    await wizard?.destroy();
    wizard = undefined;
  });

  describe("cancellation", () => {
    it("should cancel when Ctrl+C is pressed during wizard", async () => {
      const project = await ProjectBuilder.editable();

      wizard = await EditWizard.launch({ projectDir: project.dir, cols: 120, rows: 40 });

      // Send Ctrl+C to abort
      wizard.abort();

      const exitCode = await wizard.waitForExit(TIMEOUTS.EXIT);

      // Ctrl+C in a PTY sends SIGINT, which usually results in non-zero exit
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    });

    it("should preserve original installation after cancellation", async () => {
      const project = await ProjectBuilder.editable({
        skills: ["web-framework-react"],
      });

      wizard = await EditWizard.launch({ projectDir: project.dir, cols: 120, rows: 40 });

      // Cancel the wizard
      wizard.abort();
      await wizard.waitForExit(TIMEOUTS.EXIT);

      // Config should be unchanged after cancellation
      await expect(project).toHaveConfig({ skillIds: ["web-framework-react"] });
      // Original skill files should still exist
      await expect(project).toHaveSkillCopied("web-framework-react");
    });
  });

  describe("keyboard navigation", () => {
    it("should navigate to sources step with ENTER", async () => {
      const project = await ProjectBuilder.editable({
        skills: ["web-framework-react", "web-styling-tailwind"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      wizard = await EditWizard.launch({ projectDir: project.dir, cols: 120, rows: 40 });

      // Press ENTER to continue from build step.
      const sources = await wizard.build.advanceToSources();

      const output = sources.getOutput();
      expect(output).toContain(STEP_TEXT.SOURCES);
    });

    it("should navigate to stack step when pressing ESC (known bug: should cancel in edit mode)", async () => {
      const project = await ProjectBuilder.editable();

      wizard = await EditWizard.launch({ projectDir: project.dir, cols: 120, rows: 40 });

      // ESC from build step triggers goBack() but history is empty because
      // initialStep="build" is set via setState() without pushing to history.
      // Falls back to "stack" step.
      await wizard.build.goBack();

      const screen = wizard.build.getScreen();
      expect(screen).toContain(STEP_TEXT.STACK);
    });

    // BUG: ESC from edit build step goes to stack step instead of cancelling
    it.fails(
      "should cancel wizard when pressing ESC on the initial build step in edit mode",
      async () => {
        const project = await ProjectBuilder.editable();

        wizard = await EditWizard.launch({ projectDir: project.dir, cols: 120, rows: 40 });

        await wizard.build.goBack();

        // Wait for the stack step to actually render before asserting
        await new Promise((r) => setTimeout(r, 500));
        const screen = wizard.build.getScreen();
        // ESC on the first step in edit mode should cancel the wizard, not go to stack.
        // The stack step shows "Choose a stack", so "Framework" should NOT be present.
        expect(screen).not.toContain(STEP_TEXT.STACK);
      },
    );
  });

  describe("wizard hotkeys", () => {
    let tempHOME: string | undefined;

    afterEach(async () => {
      if (tempHOME) {
        await cleanupTempDir(tempHOME);
        tempHOME = undefined;
      }
    });

    it("should show hotkey indicators in the footer", async () => {
      const project = await ProjectBuilder.editable();

      wizard = await EditWizard.launch({ projectDir: project.dir, cols: 120, rows: 40 });

      const output = wizard.build.getOutput();
      // The build step footer shows these hotkey indicators
      expect(output).toContain("Labels");
      expect(output).toContain("Help");
    });

    it("should toggle focused skill scope with S key", async () => {
      const project = await ProjectBuilder.editable({
        skills: ["web-framework-react", "web-styling-tailwind"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      // Create a separate HOME so the wizard does not treat projectDir as global scope.
      // TerminalSession sets HOME=cwd by default, which makes isGlobalDir=true and
      // hides the Scope hotkey. A distinct HOME ensures project-scope editing.
      tempHOME = await createTempDir();

      wizard = await EditWizard.launch({
        projectDir: project.dir,
        cols: 120,
        rows: 40,
        env: { HOME: tempHOME },
      });

      const buildOutput = wizard.build.getOutput();
      // The "S" badge with "Scope" label should be visible in the build step footer
      expect(buildOutput).toContain("Scope");

      // The first skill (web-framework-react) is focused and pre-selected.
      // Press "s" to toggle its scope from "project" (default) to "global".
      await wizard.build.toggleScopeOnFocusedSkill();

      // Navigate to the confirm step to verify the scope change is reflected.
      const sources = await wizard.build.advanceToSources();
      const agents = await sources.acceptDefaults();
      const confirm = await agents.acceptDefaults("edit");

      const confirmOutput = confirm.getOutput();
      // The confirm step shows "Scope:" with counts of project/global skills.
      expect(confirmOutput).toContain("Scope:");
      expect(confirmOutput).toContain("global");
    });
  });

  describe("build step advancement", () => {
    it("should advance past build step even when all skills in a category are deselected", async () => {
      const project = await ProjectBuilder.editable({
        skills: ["web-framework-react"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      wizard = await EditWizard.launch({ projectDir: project.dir, cols: 120, rows: 40 });

      // Framework category should show pre-selected react skill
      const output = wizard.build.getOutput();
      expect(output).toContain("(1 of 1)");

      // Deselect the react skill with SPACE (it is already focused as the first item)
      await wizard.build.toggleFocusedSkill();

      // Press ENTER — wizard should advance to the next step (sources)
      const sources = await wizard.build.advanceToSources();

      const sourcesOutput = sources.getOutput();
      // The wizard no longer blocks advancement — it advances to sources step
      expect(sourcesOutput).toContain("Sources");
    });
  });
});
