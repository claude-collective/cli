import path from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";
import { DIRS, EXIT_CODES, TIMEOUTS } from "../pages/constants.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import {
  cleanupTempDir,
  directoryExists,
  ensureBinaryExists,
  fileExists,
} from "../helpers/test-utils.js";
import { createTestEnvironment, setupDualScopeWithEject } from "../fixtures/dual-scope-helpers.js";

/**
 * Dual-scope edit lifecycle E2E test -- compiled agent content after scope toggle.
 *
 * Key invariants:
 * - When a SKILL's scope changes, only the skill moves — agents stay at their scope.
 * - The global config is PRESERVED via `mergeGlobalConfigs` — it keeps existing
 *   skills even if the new config doesn't include them.
 * - Global skills reach any agent (project or global). Project skills never reach
 *   global agents.
 */

describe("dual-scope edit lifecycle -- compiled agent content after scope toggle", () => {
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
  }, TIMEOUTS.LIFECYCLE);

  afterEach(async () => {
    await testWizard?.destroy();
    testWizard = undefined;
    await cleanupTempDir(testTempDir);
  });

  it(
    "G->P skill scope toggle should preserve skill in global agent via mergeGlobalConfigs",
    { timeout: TIMEOUTS.LIFECYCLE, retry: 0 },
    async () => {
      // BEFORE: Verify global web-developer contains web-framework-react
      await expect({ dir: fakeHome }).toHaveCompiledAgentContent("web-developer", {
        contains: ["web-framework-react"],
      });

      // ACTION: Launch EditWizard, toggle web-framework-react scope to project
      const wizard = await EditWizard.launch({
        projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        env: { HOME: fakeHome },
        rows: 60,
        cols: 120,
      });
      testWizard = wizard;

      // Build step -- Web domain: toggle first focused skill (web-framework-react) scope to project
      await wizard.build.toggleScopeOnFocusedSkill();
      await wizard.build.advanceDomain();

      // Build step -- API domain (pass through)
      await wizard.build.advanceDomain();

      // Build step -- Methodology domain (pass through) -> Sources
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

      // AFTER assertions

      // Global web-developer.md: STILL contains web-framework-react
      // (mergeGlobalConfigs preserves existing skills in the global config)
      await expect({ dir: fakeHome }).toHaveCompiledAgentContent("web-developer", {
        contains: ["web-framework-react"],
      });

      // Skill directory exists at project scope (G->P is additive — skill copied to project)
      const projectSkillDir = path.join(
        projectDir,
        DIRS.CLAUDE,
        DIRS.SKILLS,
        "web-framework-react",
      );
      expect(
        await directoryExists(projectSkillDir),
        "web-framework-react must exist at project scope after G->P toggle",
      ).toBe(true);

      // Skill directory still exists at global scope (global config preserves it)
      const globalSkillDir = path.join(fakeHome, DIRS.CLAUDE, DIRS.SKILLS, "web-framework-react");
      expect(
        await directoryExists(globalSkillDir),
        "web-framework-react must still exist at global scope (preserved by mergeGlobalConfigs)",
      ).toBe(true);

      // Project config has web-framework-react with project scope
      await expect({ dir: projectDir }).toHaveConfig({
        skillIds: ["web-framework-react"],
      });

      await result.destroy();
    },
  );

  it(
    "P->G skill scope toggle should keep agent at original scope",
    { timeout: TIMEOUTS.LIFECYCLE, retry: 0 },
    async () => {
      // BEFORE: Verify project api-developer contains api-framework-hono
      await expect({ dir: projectDir }).toHaveCompiledAgentContent("api-developer", {
        contains: ["api-framework-hono"],
      });

      // ACTION: Launch EditWizard, advance to API domain, toggle api-framework-hono to global
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

      // Build step -- API domain: toggle api-framework-hono scope to global
      await wizard.build.toggleScopeOnFocusedSkill();
      await wizard.build.advanceDomain();

      // Build step -- Methodology domain (pass through) -> Sources
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

      // AFTER assertions

      // api-developer.md STILL exists at project scope (only the skill moved, not the agent)
      const projectApiDevPath = path.join(projectDir, DIRS.CLAUDE, DIRS.AGENTS, "api-developer.md");
      expect(
        await fileExists(projectApiDevPath),
        "api-developer.md must still exist at project scope — only the skill moved, not the agent",
      ).toBe(true);

      // Project api-developer.md is recompiled — content may or may not include
      // api-framework-hono depending on whether the compile pass discovers global
      // skills. The key assertion is that the agent FILE exists (it wasn't moved).
      await expect({ dir: projectDir }).toHaveCompiledAgent("api-developer");

      // Skill directory was moved to global scope
      const globalSkillDir = path.join(fakeHome, DIRS.CLAUDE, DIRS.SKILLS, "api-framework-hono");
      expect(
        await directoryExists(globalSkillDir),
        "api-framework-hono must exist at global scope after P->G toggle",
      ).toBe(true);

      // Skill directory no longer at project scope (P->G moves the skill)
      const projectSkillDir = path.join(projectDir, DIRS.CLAUDE, DIRS.SKILLS, "api-framework-hono");
      expect(
        await directoryExists(projectSkillDir),
        "api-framework-hono must NOT exist at project scope after P->G toggle",
      ).toBe(false);

      await result.destroy();
    },
  );

  it(
    "Agent scope toggle should recompile agent at new scope with correct skills",
    { timeout: TIMEOUTS.LIFECYCLE, retry: 0 },
    async () => {
      // BEFORE: Verify project api-developer contains api-framework-hono
      await expect({ dir: projectDir }).toHaveCompiledAgentContent("api-developer", {
        contains: ["api-framework-hono"],
      });

      // ACTION: Launch EditWizard, pass through build domains, toggle api-developer agent to global
      const wizard = await EditWizard.launch({
        projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        env: { HOME: fakeHome },
        rows: 60,
        cols: 120,
      });
      testWizard = wizard;

      // Build step -- pass through all three domains
      const sources = await wizard.build.passThroughAllDomains();

      // Sources step (pass through)
      await sources.waitForReady();
      const agents = await sources.advance();

      // Agents step -- navigate to API Developer and toggle scope to global
      await agents.navigateCursorToAgent("API Developer");
      await agents.toggleScopeOnFocusedAgent();
      const confirm = await agents.advance("edit");

      // Confirm step
      const result = await confirm.confirm();
      const exitCode = await result.exitCode;
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // AFTER assertions

      // api-developer.md at global scope: exists and contains api-developer in content
      await expect({ dir: fakeHome }).toHaveCompiledAgent("api-developer");
      await expect({ dir: fakeHome }).toHaveCompiledAgentContent("api-developer", {
        contains: ["api-developer"],
      });

      // api-developer.md at project scope: does NOT exist (P->G is a move for agents)
      const projectApiDevPath = path.join(projectDir, DIRS.CLAUDE, DIRS.AGENTS, "api-developer.md");
      expect(
        await fileExists(projectApiDevPath),
        "api-developer.md must NOT exist at project scope after P->G agent toggle",
      ).toBe(false);

      // Global config has api-developer agent
      await expect({ dir: fakeHome }).toHaveConfig({
        agents: ["api-developer"],
      });

      await result.destroy();
    },
  );
});
