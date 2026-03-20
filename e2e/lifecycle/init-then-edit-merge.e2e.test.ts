import os from "os";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import type { SkillId } from "../../src/cli/types/index.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { verifyAgentCompiled } from "../helpers/plugin-assertions.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  delay,
  ensureBinaryExists,
  EXIT_CODES,
  EXIT_WAIT_TIMEOUT_MS,
  fileExists,
  LIFECYCLE_TEST_TIMEOUT_MS,
  navigateInitWizardToCompletion,
  readTestFile,
  SETUP_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  WIZARD_LOAD_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * Init -> Edit merge lifecycle E2E test (Gap 5).
 *
 * Verifies that running `cc init` to completion, then running `cc edit`
 * with changes, produces a merged config (not an overwrite). The original
 * skills from init should be preserved alongside new skills added in edit.
 *
 * This is distinct from re-edit-cycles.e2e.test.ts which tests:
 *   - idempotent no-change edits (init -> edit -> edit)
 *   - edit with skill addition from a pre-existing project
 *
 * This test exercises the full init -> edit lifecycle with the actual
 * init wizard, not a pre-created project.
 */

/** Extracts skill IDs from config.ts content using regex. */
function extractSkillIds(configContent: string): SkillId[] {
  const ids: SkillId[] = [];
  const matches = configContent.matchAll(/"id"\s*:\s*"([^"]+)"/g);
  for (const m of matches) {
    // Boundary cast: regex-extracted skill ID from config file
    ids.push(m[1] as SkillId);
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
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  describe("full init then edit with changes", () => {
    let tempDir: string | undefined;
    let session: TerminalSession | undefined;

    afterEach(async () => {
      await session?.destroy();
      session = undefined;
      if (tempDir) {
        await cleanupTempDir(tempDir);
        tempDir = undefined;
      }
      // Brief pause to allow PTY resources to fully release between tests
      await delay(STEP_TRANSITION_DELAY_MS);
    });

    it(
      "should merge config after init -> edit with skill addition (no duplicates)",
      { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();
        const projectDir = tempDir;
        const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);

        // ================================================================
        // Phase 1: Init via wizard
        // ================================================================

        await createPermissionsFile(projectDir);

        session = new TerminalSession(["init", "--source", sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        // Navigate init wizard: Stack -> Domain -> Build("a") -> Confirm -> Success
        await navigateInitWizardToCompletion(session);
        const initExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(initExitCode).toBe(EXIT_CODES.SUCCESS);

        await session.destroy();
        session = undefined;

        // --- Phase 1 verification ---
        expect(await fileExists(configPath)).toBe(true);
        const configAfterInit = await readTestFile(configPath);
        const initSkillIds = extractSkillIds(configAfterInit);
        expect(initSkillIds.length).toBeGreaterThan(0);
        expectNoDuplicates(initSkillIds, "skills after init");

        // Record the original skills for comparison
        const originalSkillSet = new Set(initSkillIds);

        // ================================================================
        // Phase 2: Edit — add a skill by navigating to a new category
        //
        // The edit wizard starts at the build step with pre-selected skills.
        // We arrow down to reach an unselected skill and toggle it with space.
        // ================================================================

        session = new TerminalSession(["edit", "--source", sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
          rows: 60,
          cols: 120,
        });

        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
        await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);

        // Arrow down from the first category to reach another skill.
        // Then toggle it with space to add it.
        session.arrowDown();
        await delay(STEP_TRANSITION_DELAY_MS);
        session.space();
        await delay(STEP_TRANSITION_DELAY_MS);

        // Navigate through: Build -> Sources -> Agents -> Confirm -> Complete
        // Multiple Enters to get through remaining domains
        for (let attempt = 0; attempt < 5; attempt++) {
          session.enter();
          await delay(STEP_TRANSITION_DELAY_MS);
          if (session.getFullOutput().includes("Customize skill sources")) break;
        }

        // Sources step
        await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Agents step
        await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Confirm step
        await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Wait for completion
        const editExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(editExitCode).toBe(EXIT_CODES.SUCCESS);

        await session.destroy();
        session = undefined;

        // --- Phase 2 verification ---
        const configAfterEdit = await readTestFile(configPath);
        const editSkillIds = extractSkillIds(configAfterEdit);

        // No duplicate skills
        expectNoDuplicates(editSkillIds, "skills after edit");

        // All original skills should still be present (merge, not overwrite)
        for (const originalId of originalSkillSet) {
          expect(editSkillIds, `Original skill ${originalId} must be preserved`).toContain(
            originalId,
          );
        }

        // Skill count should be >= original (we may have added one)
        expect(editSkillIds.length).toBeGreaterThanOrEqual(initSkillIds.length);

        // Agent should still be compiled — agents default to global scope,
        // so check both project dir and home dir
        const agentInProject = await verifyAgentCompiled(projectDir, "web-developer");
        const agentInHome = await verifyAgentCompiled(os.homedir(), "web-developer");
        expect(agentInProject || agentInHome).toBe(true);
      },
    );

    // Note: init -> no-change edit idempotency is already thoroughly tested in
    // e2e/lifecycle/re-edit-cycles.e2e.test.ts. The test above covers the unique
    // scenario of init -> edit WITH changes and verifying merge.
  });
});
