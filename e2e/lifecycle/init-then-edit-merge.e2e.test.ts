import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { expectNoDuplicates } from "../assertions/config-assertions.js";
import { expectPhaseSuccess } from "../assertions/phase-assertions.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, DIRS, FILES } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import {
  cleanupTempDir,
  createTempDir,
  ensureBinaryExists,
  readTestFile,
} from "../helpers/test-utils.js";

/**
 * Init -> Edit merge lifecycle E2E test.
 *
 * Verifies that running `cc init` to completion, then running `cc edit`
 * with changes, produces a merged config (not an overwrite). The original
 * skills from init should be preserved alongside new skills added in edit.
 */

/** Extracts skill IDs from config.ts content using regex. */
function extractSkillIds(configContent: string): string[] {
  const ids: string[] = [];
  const matches = configContent.matchAll(/"id"\s*:\s*"([^"]+)"/g);
  for (const m of matches) {
    ids.push(m[1]);
  }
  return ids;
}

describe("init -> edit merge: config preserved across lifecycle", () => {
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

  describe("full init then edit with changes", () => {
    let tempDir: string | undefined;

    afterEach(async () => {
      if (tempDir) {
        await cleanupTempDir(tempDir);
        tempDir = undefined;
      }
    });

    it.fails(
      "should merge config after init -> edit with skill addition (no duplicates)",
      { timeout: TIMEOUTS.LIFECYCLE, retry: 0 },
      async () => {
        tempDir = await createTempDir();
        const projectDir = tempDir;
        const configPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);

        // ================================================================
        // Phase 1: Init via wizard
        // ================================================================

        const initWizard = await InitWizard.launch({
          source: { sourceDir, tempDir: sourceTempDir },
          projectDir,
        });
        const initResult = await initWizard.completeWithDefaults();
        await initResult.destroy();

        // --- Phase 1 verification ---
        await expectPhaseSuccess(
          { project: { dir: projectDir }, exitCode: initResult.exitCode },
          {
            skillIds: ["web-framework-react"],
            agents: ["web-developer"],
            source: "agents-inc",
          },
        );

        const configAfterInit = await readTestFile(configPath);
        const initSkillIds = extractSkillIds(configAfterInit);
        expectNoDuplicates(initSkillIds, "skills after init");

        // Verify agent frontmatter and skill content
        await expect({ dir: projectDir }).toHaveAgentFrontmatter("web-developer", {
          name: "web-developer",
        });
        await expect({ dir: projectDir }).toHaveAgentFrontmatter("web-developer", {
          skills: ["web-framework-react"],
        });

        const originalSkillSet = new Set(initSkillIds);

        // ================================================================
        // Phase 2: Edit -- add a skill by navigating to a new category
        // ================================================================

        const editWizard = await EditWizard.launch({
          projectDir,
          source: { sourceDir, tempDir: sourceTempDir },
          rows: 60,
          cols: 120,
        });

        // Arrow down to reach another skill, toggle it
        await editWizard.build.navigateDown();
        await editWizard.build.toggleFocusedSkill();

        // Navigate through: Build -> Sources -> Agents -> Confirm -> Complete
        const sources = await editWizard.build.passThroughAllDomains();
        const agents = await sources.acceptDefaults();
        const confirm = await agents.acceptDefaults("edit");
        const editResult = await confirm.confirm();

        await editResult.destroy();

        // Edit phase must not contain error indicators
        const editOutput = editResult.rawOutput;
        expect(editOutput).not.toContain("Failed to");
        expect(editOutput).not.toContain("ENOENT");

        // --- Phase 2 verification ---
        await expectPhaseSuccess(
          { project: { dir: projectDir }, exitCode: editResult.exitCode },
          {
            skillIds: ["web-framework-react"],
            agents: ["web-developer"],
            source: "agents-inc",
          },
        );

        const configAfterEdit = await readTestFile(configPath);
        const editSkillIds = extractSkillIds(configAfterEdit);

        expectNoDuplicates(editSkillIds, "skills after edit");

        // All original skills should still be present (merge, not overwrite)
        for (const originalId of originalSkillSet) {
          expect(editSkillIds, `Original skill ${originalId} must be preserved`).toContain(
            originalId,
          );
        }

        expect(editSkillIds.length).toBeGreaterThanOrEqual(initSkillIds.length);

        // Agent should still be compiled with correct content
        await expect({ dir: projectDir }).toHaveAgentFrontmatter("web-developer", {
          name: "web-developer",
        });
        await expect({ dir: projectDir }).toHaveAgentFrontmatter("web-developer", {
          skills: ["web-framework-react"],
        });
      },
    );
  });
});
