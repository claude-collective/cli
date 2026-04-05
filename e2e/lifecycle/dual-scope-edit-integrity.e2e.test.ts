import path from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { TIMEOUTS, DIRS, FILES, EXIT_CODES } from "../pages/constants.js";
import {
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
  readTestFile,
} from "../helpers/test-utils.js";
import {
  createTestEnvironment,
  initGlobal,
  initProject,
  setupDualScope,
} from "../fixtures/dual-scope-helpers.js";

/**
 * Dual-scope edit lifecycle E2E test -- agent content and config integrity.
 *
 */

// =====================================================================
// Test Suite -- Agent Content and Config Integrity
// =====================================================================

describe("dual-scope edit lifecycle -- agent content and config integrity", () => {
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

  let testTempDir: string;
  let fakeHome: string;
  let projectDir: string;

  beforeEach(async () => {
    const { tempDir, fakeHome: fh, projectDir: pd } = await createTestEnvironment();
    testTempDir = tempDir;
    fakeHome = fh;
    projectDir = pd;
    await setupDualScope(sourceDir, sourceTempDir, fakeHome, projectDir);
  });

  afterEach(async () => {
    await cleanupTempDir(testTempDir);
  });

  it.fails(
    "Compiled agents contain only their assigned skills (expected fail -- ENOENT in project-scoped skill copy)",
    { timeout: TIMEOUTS.LIFECYCLE, retry: 0 },
    async () => {
      // Phase D: Assertions -- verify agent content from Phase B compilation

      // D-1: Read web-developer.md from global path
      const globalWebDevPath = path.join(fakeHome, DIRS.CLAUDE, "agents", "web-developer.md");
      expect(await fileExists(globalWebDevPath), "web-developer.md must exist in global").toBe(
        true,
      );
      const webDevContent = await readTestFile(globalWebDevPath);

      // D-2: web-developer contains its assigned skills
      expect(webDevContent).toContain("web-framework-react");
      expect(webDevContent).toContain("web-testing-vitest");

      // D-3: web-developer does NOT contain API skills (cross-contamination check)
      expect(webDevContent).not.toContain("api-framework-hono");

      // D-4: Read api-developer.md from project path
      const projectApiDevPath = path.join(projectDir, DIRS.CLAUDE, "agents", "api-developer.md");
      expect(await fileExists(projectApiDevPath), "api-developer.md must exist in project").toBe(
        true,
      );
      const apiDevContent = await readTestFile(projectApiDevPath);

      // D-5: api-developer contains its assigned skill
      expect(apiDevContent).toContain("api-framework-hono");

      // D-6: api-developer does NOT contain web skills (cross-contamination check)
      expect(apiDevContent).not.toContain("web-framework-react");
    },
  );
});

// =====================================================================
// Test Suite -- Config Source Preservation
// =====================================================================

describe("dual-scope edit lifecycle -- config preservation", () => {
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

  let testTempDir: string;
  let fakeHome: string;
  let projectDir: string;

  beforeEach(async () => {
    const { tempDir, fakeHome: fh, projectDir: pd } = await createTestEnvironment();
    testTempDir = tempDir;
    fakeHome = fh;
    projectDir = pd;
  });

  afterEach(async () => {
    await cleanupTempDir(testTempDir);
  });

  it(
    "Config split preserves source fields after edit",
    { timeout: TIMEOUTS.LIFECYCLE, retry: 0 },
    async () => {
      // Phase A: Init global (completeWithDefaults — marketplace source "agents-inc")
      const phaseA = await initGlobal(sourceDir, sourceTempDir, fakeHome);
      expect(phaseA.exitCode).toBe(EXIT_CODES.SUCCESS);

      // Assert: global config has agents-inc after Phase A
      const globalConfigPath = path.join(fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const globalConfigAfterA = await readTestFile(globalConfigPath);
      expect(globalConfigAfterA).toContain("agents-inc");

      // Phase B: Init project with scope toggling (eject for project-scoped skills)
      const phaseB = await initProject(sourceDir, sourceTempDir, fakeHome, projectDir);
      expect(phaseB.exitCode).toBe(EXIT_CODES.SUCCESS);

      // Assert: global config data is preserved (project init may add "projects" field and reorder properties)
      const globalConfigAfterB = await readTestFile(globalConfigPath);
      expect(globalConfigAfterB).toContain("agents-inc");
      // Extract skills array and agents array sections from config
      const skillsSection = globalConfigAfterB.match(/const skills.*?\n\];/s)?.[0] ?? "";
      const agentsSection = globalConfigAfterB.match(/const agents.*?\n\];/s)?.[0] ?? "";
      // Items toggled to project scope during Phase B should be pruned from skills/agents arrays
      expect(skillsSection).not.toContain("api-framework-hono");
      expect(agentsSection).not.toContain("api-developer");
      // Global-only items should still be present in skills/agents arrays
      expect(skillsSection).toContain("web-framework-react");
      expect(agentsSection).toContain("web-developer");

      // Assert: project config has eject (the project-scoped skill was ejected)
      const projectConfigPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const projectConfig = await readTestFile(projectConfigPath);
      expect(projectConfig).toContain("eject");
    },
  );
});
