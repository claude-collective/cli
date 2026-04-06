import { mkdir } from "fs/promises";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, EXIT_CODES } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { cleanupTempDir, createTempDir, ensureBinaryExists } from "../helpers/test-utils.js";

/**
 * D-182: Deselected global skills should NOT show as removed on the confirm
 * step during init. Global skills that the user simply chose not to add to
 * the project are "not selected", not "removed".
 *
 * Phase 1: Init from HOME to create a global installation with React.
 * Phase 2: Init from a project subdirectory -- React is pre-selected from global.
 *          Deselect React, navigate to confirm step, verify no removal marker.
 */
describe("init global preselection confirm step", () => {
  let tempDir: string;
  let sourceDir: string;
  let sourceTempDir: string;
  let fakeHome: string;
  let projectDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;

    tempDir = await createTempDir();
    fakeHome = path.join(tempDir, "fake-home");
    projectDir = path.join(fakeHome, "project");

    await mkdir(fakeHome, { recursive: true });
    await mkdir(projectDir, { recursive: true });
  }, TIMEOUTS.SETUP);

  afterAll(async () => {
    if (tempDir) await cleanupTempDir(tempDir);
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  it(
    "should not show deselected global skills as removed on confirm step during project init",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      // Phase 1: Init from HOME -- create global installation with React
      const globalWizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir: fakeHome,
        env: { HOME: fakeHome },
      });
      const globalResult = await globalWizard.completeWithDefaults();
      expect(await globalResult.exitCode).toBe(EXIT_CODES.SUCCESS);
      await expect({ dir: fakeHome }).toHaveConfig({
        skillIds: ["web-framework-react"],
      });
      await globalResult.destroy();

      // Phase 2: Init from project dir -- global React pre-selected
      const projectWizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir,
        env: { HOME: fakeHome },
        cols: 120,
        rows: 40,
      });

      const domain = await projectWizard.stack.selectScratch();
      const build = await domain.acceptDefaults();

      // Deselect React (pre-selected from global) on the Web domain
      await build.selectSkill("react");

      // Advance through all scratch domains (Web -> API -> Mobile -> Sources)
      const sources = await build.passThroughAllDomainsGeneric();
      const agents = await sources.acceptDefaults();
      const confirm = await agents.acceptDefaults("init");

      await confirm.waitForReady();
      const output = confirm.getOutput();

      // Deselected global React should NOT appear with a removal marker.
      // In init mode, deselecting a global pre-selection means "don't add to project"
      // -- not "remove from global installation". No "- " prefix should appear for React.
      const lines = output.split("\n");
      const removalLines = lines.filter(
        (l) => l.includes("- ") && (l.includes("react") || l.includes("React")),
      );
      expect(removalLines).toStrictEqual([]);

      // React should not appear at all on the confirm step (neither as added nor removed)
      expect(output).not.toContain("web-framework-react");

      await projectWizard.destroy();
    },
  );
});
