import path from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, EXIT_CODES, DIRS, FILES } from "../pages/constants.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import {
  cleanupTempDir,
  directoryExists,
  ensureBinaryExists,
  readTestFile,
} from "../helpers/test-utils.js";
import { createTestEnvironment, setupDualScopeWithEject } from "../fixtures/dual-scope-helpers.js";
import { expectDualScopeInstallation } from "../assertions/scope-assertions.js";

/**
 * Dual-scope edit lifecycle E2E test -- combined scope toggles.
 *
 * Tests toggling BOTH a skill and an agent scope within a single edit session,
 * and mixed-direction toggles (P->G skill + G->P agent simultaneously).
 */

describe("dual-scope edit lifecycle -- combined scope toggles", () => {
  let sourceDir: string;
  let sourceTempDir: string;
  let testTempDir: string;
  let fakeHome: string;
  let projectDir: string;
  let testWizard: EditWizard | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, TIMEOUTS.SETUP * 2);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  beforeEach(async () => {
    const { tempDir, fakeHome: fh, projectDir: pd } = await createTestEnvironment();
    testTempDir = tempDir;
    fakeHome = fh;
    projectDir = pd;
    await setupDualScopeWithEject(sourceDir, sourceTempDir, fakeHome, projectDir);
  });

  afterEach(async () => {
    await testWizard?.destroy();
    testWizard = undefined;
    await cleanupTempDir(testTempDir);
  });

  it(
    "Toggle both a skill and an agent scope in single edit session",
    { timeout: TIMEOUTS.LIFECYCLE, retry: 1 },
    async () => {
      // Phase C: Edit -- toggle web-framework-react G->P and web-developer G->P
      const wizard = await EditWizard.launch({
        projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        env: { HOME: fakeHome },
        rows: 60,
        cols: 120,
      });
      testWizard = wizard;

      // Build step -- Web domain: toggle web-framework-react scope (G->P)
      await wizard.build.toggleScopeOnFocusedSkill();
      await wizard.build.advanceDomain();

      // Build step -- API domain (pass through)
      await wizard.build.advanceDomain();

      // Build step -- Shared domain (pass through) -> Sources
      const sources = await wizard.build.advanceToSources();

      // Sources step (pass through)
      await sources.waitForReady();
      const agents = await sources.advance();

      // Agents step -- navigate to Web Developer and toggle scope (G->P)
      await agents.navigateCursorToAgent("Web Developer");
      await agents.toggleScopeOnFocusedAgent();
      const confirm = await agents.advance("edit");

      // Confirm step
      const result = await confirm.confirm();
      const exitCode = await result.exitCode;
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Phase D: Assertions

      // D-1: web-framework-react directory exists at project scope (G->P additive)
      const projectSkillDir = path.join(
        projectDir,
        DIRS.CLAUDE,
        DIRS.SKILLS,
        "web-framework-react",
      );
      expect(
        await directoryExists(projectSkillDir),
        "web-framework-react directory must exist at project scope after G->P toggle",
      ).toBe(true);

      // D-2: web-framework-react directory STILL exists at global scope (G->P is additive)
      const globalSkillDir = path.join(fakeHome, DIRS.CLAUDE, DIRS.SKILLS, "web-framework-react");
      expect(
        await directoryExists(globalSkillDir),
        "web-framework-react directory must still exist at global scope (G->P is additive)",
      ).toBe(true);

      // D-3: web-developer compiled agent exists at project scope (G->P additive)
      await expect({ dir: projectDir }).toHaveCompiledAgent("web-developer");

      // D-4: web-developer compiled agent STILL exists at global scope (G->P is additive)
      await expect({ dir: fakeHome }).toHaveCompiledAgent("web-developer");

      // D-5: Project config contains both web-framework-react and web-developer at project scope
      await expect({ dir: projectDir }).toHaveConfig({
        skillIds: ["api-framework-hono", "web-framework-react"],
        agents: ["api-developer", "web-developer"],
      });
      const projectConfig = await readTestFile(
        path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS),
      );
      expect(projectConfig).toContain('"scope":"project"');

      // D-6: Global config still has both (unchanged)
      await expect({ dir: fakeHome }).toHaveConfig({
        skillIds: ["web-framework-react", "web-testing-vitest", "web-state-zustand"],
        agents: ["web-developer"],
      });

      // D-7: Full dual-scope assertion with updated expectations
      await expectDualScopeInstallation(fakeHome, projectDir, {
        global: {
          skillIds: ["web-framework-react", "web-testing-vitest", "web-state-zustand"],
          agents: ["web-developer"],
        },
        project: {
          skillIds: ["api-framework-hono", "web-framework-react"],
          agents: ["api-developer", "web-developer"],
        },
      });

      await result.destroy();
    },
  );

  it(
    "Toggle skill P->G and agent G->P simultaneously",
    { timeout: TIMEOUTS.LIFECYCLE, retry: 0 },
    async () => {
      // Phase C: Edit -- toggle api-framework-hono P->G and web-developer G->P
      const wizard = await EditWizard.launch({
        projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        env: { HOME: fakeHome },
        rows: 60,
        cols: 120,
      });
      testWizard = wizard;

      // Build step -- Web domain (pass through)
      await wizard.build.advanceDomain();

      // Build step -- API domain: toggle api-framework-hono scope (P->G)
      await wizard.build.toggleScopeOnFocusedSkill();
      await wizard.build.advanceDomain();

      // Build step -- Shared domain (pass through) -> Sources
      const sources = await wizard.build.advanceToSources();

      // Sources step (pass through)
      await sources.waitForReady();
      const agents = await sources.advance();

      // Agents step -- navigate to Web Developer and toggle scope (G->P)
      await agents.navigateCursorToAgent("Web Developer");
      await agents.toggleScopeOnFocusedAgent();
      const confirm = await agents.advance("edit");

      // Confirm step
      const result = await confirm.confirm();
      const exitCode = await result.exitCode;
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Phase D: Assertions

      // D-1: api-framework-hono directory does NOT exist at project scope (P->G is a move)
      const projectSkillDir = path.join(projectDir, DIRS.CLAUDE, DIRS.SKILLS, "api-framework-hono");
      expect(
        await directoryExists(projectSkillDir),
        "api-framework-hono directory must NOT exist at project scope after P->G toggle",
      ).toBe(false);

      // D-2: api-framework-hono directory exists at global scope
      const globalSkillDir = path.join(fakeHome, DIRS.CLAUDE, DIRS.SKILLS, "api-framework-hono");
      expect(
        await directoryExists(globalSkillDir),
        "api-framework-hono directory must exist at global scope after P->G toggle",
      ).toBe(true);

      // D-3: web-developer compiled agent exists at project scope (G->P additive)
      await expect({ dir: projectDir }).toHaveCompiledAgent("web-developer");

      // D-4: web-developer compiled agent STILL exists at global scope (G->P is additive)
      await expect({ dir: fakeHome }).toHaveCompiledAgent("web-developer");

      // D-5: Project config does NOT contain api-framework-hono as project-scoped
      const projectConfig = await readTestFile(
        path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS),
      );
      const honoProjectLines = projectConfig
        .split("\n")
        .filter((l: string) => l.includes("api-framework-hono") && l.includes('"scope":"project"'));
      expect(honoProjectLines).toStrictEqual([]);

      // D-6: Global config has api-framework-hono with scope: "global"
      await expect({ dir: fakeHome }).toHaveConfig({
        skillIds: [
          "web-framework-react",
          "web-testing-vitest",
          "web-state-zustand",
          "api-framework-hono",
        ],
        agents: ["web-developer"],
      });
      const globalConfig = await readTestFile(
        path.join(fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS),
      );
      expect(globalConfig).toContain('"scope":"global"');

      // D-7: Project config has web-developer
      await expect({ dir: projectDir }).toHaveConfig({
        agents: ["api-developer", "web-developer"],
      });

      // D-8: api-developer still exists at project scope (unchanged)
      await expect({ dir: projectDir }).toHaveCompiledAgent("api-developer");

      await result.destroy();
    },
  );
});
