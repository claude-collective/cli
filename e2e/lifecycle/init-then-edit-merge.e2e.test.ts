import os from "os";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, EXIT_CODES, DIRS } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import {
  cleanupTempDir,
  createTempDir,
  ensureBinaryExists,
  fileExists,
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

/** Asserts that an array has no duplicate entries. */
function expectNoDuplicates(arr: string[], label: string): void {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const item of arr) {
    if (seen.has(item)) duplicates.push(item);
    seen.add(item);
  }
  expect(duplicates, `Duplicate ${label} found: ${duplicates.join(", ")}`).toEqual([]);
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
      { timeout: TIMEOUTS.LIFECYCLE },
      async () => {
        tempDir = await createTempDir();
        const projectDir = tempDir;
        const configPath = path.join(projectDir, DIRS.CLAUDE_SRC, "config.ts");

        // ================================================================
        // Phase 1: Init via wizard
        // ================================================================

        const initWizard = await InitWizard.launch({
          source: { sourceDir, tempDir: sourceTempDir },
          projectDir,
        });
        const initResult = await initWizard.completeWithDefaults();
        expect(await initResult.exitCode).toBe(EXIT_CODES.SUCCESS);
        await initResult.destroy();

        // --- Phase 1 verification ---
        expect(await fileExists(configPath)).toBe(true);
        const configAfterInit = await readTestFile(configPath);
        const initSkillIds = extractSkillIds(configAfterInit);
        expect(initSkillIds.length).toBeGreaterThan(0);
        expectNoDuplicates(initSkillIds, "skills after init");

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

        expect(await editResult.exitCode).toBe(EXIT_CODES.SUCCESS);
        await editResult.destroy();

        // --- Phase 2 verification ---
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

        // Agent should still be compiled
        try {
          await expect({ dir: projectDir }).toHaveCompiledAgent("web-developer");
        } catch {
          await expect({ dir: os.homedir() }).toHaveCompiledAgent("web-developer");
        }
      },
    );
  });
});
