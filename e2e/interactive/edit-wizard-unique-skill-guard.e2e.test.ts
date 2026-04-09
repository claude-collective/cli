import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { cleanupTempDir, ensureBinaryExists } from "../helpers/test-utils.js";
import { ProjectBuilder } from "../fixtures/project-builder.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import { expectPhaseSuccess } from "../assertions/phase-assertions.js";
import { TIMEOUTS } from "../pages/constants.js";
import "../matchers/setup.js";

/**
 * Unique-skill-in-category guard E2E test.
 *
 * Verifies that a skill cannot be deselected when it is the only skill
 * available in its category. The guard shows a toast message and leaves
 * the selection unchanged. Multi-skill categories allow normal toggling.
 */

describe("unique skill in category guard", () => {
  let sourceDir: string;
  let sourceTempDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, TIMEOUTS.SETUP);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  let wizard: EditWizard | undefined;

  afterEach(async () => {
    await wizard?.destroy();
    wizard = undefined;
  });

  it(
    "should block deselecting the only skill in a single-skill category",
    { timeout: TIMEOUTS.INTERACTIVE },
    async () => {
      const project = await ProjectBuilder.editable({
        skills: ["web-framework-react", "web-testing-vitest"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      wizard = await EditWizard.launch({
        projectDir: project.dir,
        source: { sourceDir, tempDir: sourceTempDir },
        cols: 120,
        rows: 40,
      });

      // Attempt to deselect vitest — the only skill in web-testing category
      await wizard.build.selectSkill("web-testing-vitest");

      // Verify the toast message appeared
      const output = wizard.build.getOutput();
      expect(output).toContain("Cannot deselect the only skill in this category");

      // Verify the wizard can still advance (skill remained selected)
      const sources = await wizard.build.advanceToSources();
      const agents = await sources.acceptDefaults();
      const confirm = await agents.acceptDefaults("edit");
      const result = await confirm.confirm();

      // Verify the skill is still in the config after save (guard preserved it)
      await expectPhaseSuccess(result, {
        skillIds: ["web-framework-react", "web-testing-vitest"],
        agents: ["web-developer"],
        compiledAgents: [],
      });

      await result.destroy();
    },
  );

  it(
    "should allow deselecting in a category with multiple skills",
    { timeout: TIMEOUTS.INTERACTIVE },
    async () => {
      const project = await ProjectBuilder.editable({
        skills: ["web-framework-react"],
        agents: ["web-developer"],
        domains: ["web"],
      });

      wizard = await EditWizard.launch({
        projectDir: project.dir,
        source: { sourceDir, tempDir: sourceTempDir },
        cols: 120,
        rows: 40,
      });

      // Attempt to deselect react — web-framework has 2 skills (react + vue)
      await wizard.build.selectSkill("web-framework-react");

      // Verify no toast message appeared
      const output = wizard.build.getOutput();
      expect(output).not.toContain("Cannot deselect the only skill in this category");

      // Complete the wizard and verify it exits successfully
      const sources = await wizard.build.advanceToSources();
      const agents = await sources.acceptDefaults();
      const confirm = await agents.acceptDefaults("edit");
      const result = await confirm.confirm();

      // Config should reflect the deselection (react removed from multi-skill category)
      await expectPhaseSuccess(result, {
        agents: ["web-developer"],
        compiledAgents: ["web-developer"],
      });

      await result.destroy();
    },
  );
});
