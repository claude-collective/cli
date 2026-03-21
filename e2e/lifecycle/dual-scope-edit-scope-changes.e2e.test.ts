import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { TIMEOUTS, EXIT_CODES, DIRS, FILES } from "../pages/constants.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import {
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
  readTestFile,
} from "../helpers/test-utils.js";
import { createTestEnvironment, setupDualScope } from "../fixtures/dual-scope-helpers.js";

/**
 * Dual-scope edit lifecycle E2E test -- scope changes via S hotkey.
 *
 * Tests toggling project skills/agents to global scope via the "s" hotkey
 * in the edit wizard.
 *
 * KNOWN BUG (affects Tests 2, 3):
 * When Phase A installs skills locally (no marketplace -> plugin mode falls back
 * to local), the skills land in HOME/.claude/skills/. During Phase B,
 * loadSkillsMatrixFromSource -> discoverLocalSkills(homeDir) finds them and marks
 * them as local: true with localPath relative to HOME. Then copySkillsToLocalFlattened
 * in skill-copier.ts checks `skill.local && skill.localPath` (line 214) and reads
 * from `path.join(process.cwd(), skill.localPath)` -- but process.cwd() is the
 * projectDir, not homeDir. This causes ENOENT.
 */

// =====================================================================
// Test Suite -- Scope Changes via S Hotkey
// =====================================================================

describe("dual-scope edit lifecycle -- scope changes via S hotkey", () => {
  let sourceDir: string;
  let sourceTempDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, TIMEOUTS.SETUP * 2);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  it.fails(
    "Test 2: toggle a project skill's scope to global (expected fail -- ENOENT in project-scoped skill copy)",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        await setupDualScope(sourceDir, sourceTempDir, fakeHome, projectDir);

        // Phase C: Edit -- toggle api-framework-hono from project to global scope
        const wizard = await EditWizard.launch({
          projectDir,
          source: { sourceDir, tempDir: sourceTempDir },
          env: { HOME: fakeHome },
          rows: 60,
          cols: 120,
        });

        try {
          // Build step -- Web domain (pass through)
          await wizard.build.advanceDomain();

          // Build step -- API domain -- toggle api-framework-hono scope to global
          await wizard.build.toggleScopeOnFocusedSkill();
          await wizard.build.advanceDomain();

          // Build step -- Shared domain (pass through)
          const sources = await wizard.build.advanceToSources();

          // Sources step (pass through)
          await sources.waitForReady();
          const agents = await sources.advance();

          // Agents step (pass through)
          const confirm = await agents.acceptDefaults("edit");

          // Confirm step
          const result = await confirm.confirm();
          const exitCode = await result.exitCode;
          expect(exitCode).toBe(EXIT_CODES.SUCCESS);

          // Phase D: Assertions

          // D-1: Global config now contains api-framework-hono (it was toggled to global)
          const globalConfig = await readTestFile(
            path.join(fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS),
          );
          expect(globalConfig).toContain("api-framework-hono");

          // D-2: Project config does NOT contain api-framework-hono (it moved to global)
          const projectConfig = await readTestFile(
            path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS),
          );
          expect(projectConfig).not.toContain("api-framework-hono");

          await result.destroy();
        } catch (e) {
          await wizard.destroy();
          throw e;
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );

  it.fails(
    "Test 3: toggle a project agent's scope to global (expected fail -- ENOENT in project-scoped skill copy)",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        await setupDualScope(sourceDir, sourceTempDir, fakeHome, projectDir);

        // Phase C: Edit -- toggle api-developer from project to global scope
        const wizard = await EditWizard.launch({
          projectDir,
          source: { sourceDir, tempDir: sourceTempDir },
          env: { HOME: fakeHome },
          rows: 60,
          cols: 120,
        });

        try {
          // Build step -- pass through all three domains
          const sources = await wizard.build.passThroughAllDomains();

          // Sources step (pass through)
          await sources.waitForReady();
          const agents = await sources.advance();

          // Agents step -- toggle api-developer to global scope
          // Need 6 arrow-downs to reach api-developer
          for (let i = 0; i < 6; i++) {
            await agents.navigateDown();
          }
          await agents.toggleScopeOnFocusedAgent();
          const confirm = await agents.advance("edit");

          // Confirm step
          const result = await confirm.confirm();
          const exitCode = await result.exitCode;
          expect(exitCode).toBe(EXIT_CODES.SUCCESS);

          // Phase D: Assertions

          // D-1: api-developer.md exists at global scope (HOME)
          const globalApiDevPath = path.join(fakeHome, DIRS.CLAUDE, "agents", "api-developer.md");
          expect(
            await fileExists(globalApiDevPath),
            "api-developer.md must exist in global agents dir after scope toggle",
          ).toBe(true);

          // D-2: api-developer.md does NOT exist at project scope
          const projectApiDevPath = path.join(
            projectDir,
            DIRS.CLAUDE,
            "agents",
            "api-developer.md",
          );
          expect(
            await fileExists(projectApiDevPath),
            "api-developer.md must NOT exist in project agents dir after scope toggle to global",
          ).toBe(false);

          // D-3: web-developer.md still at global scope (unchanged)
          const globalWebDevPath = path.join(fakeHome, DIRS.CLAUDE, "agents", "web-developer.md");
          expect(
            await fileExists(globalWebDevPath),
            "web-developer.md must still exist in global agents dir",
          ).toBe(true);

          await result.destroy();
        } catch (e) {
          await wizard.destroy();
          throw e;
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );
});
