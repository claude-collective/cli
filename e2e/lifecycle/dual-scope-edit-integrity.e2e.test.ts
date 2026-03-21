import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { TIMEOUTS, DIRS, FILES } from "../pages/constants.js";
import {
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
  readTestFile,
} from "../helpers/test-utils.js";
import { createTestEnvironment, setupDualScope } from "../fixtures/dual-scope-helpers.js";

/**
 * Dual-scope edit lifecycle E2E test -- agent content and config integrity.
 *
 * KNOWN BUG (affects Tests 6, 7):
 * When Phase A installs skills locally (no marketplace -> plugin mode falls back
 * to local), the skills land in HOME/.claude/skills/. During Phase B,
 * loadSkillsMatrixFromSource -> discoverLocalSkills(homeDir) finds them and marks
 * them as local: true with localPath relative to HOME. Then copySkillsToLocalFlattened
 * in skill-copier.ts checks `skill.local && skill.localPath` (line 214) and reads
 * from `path.join(process.cwd(), skill.localPath)` -- but process.cwd() is the
 * projectDir, not homeDir. This causes ENOENT.
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

  it.fails(
    "Test 6: compiled agents contain only their assigned skills (expected fail -- ENOENT in project-scoped skill copy)",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        await setupDualScope(sourceDir, sourceTempDir, fakeHome, projectDir);

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
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );

  it.fails(
    "Test 7: config split preserves source fields after edit (expected fail -- ENOENT in project-scoped skill copy)",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        await setupDualScope(sourceDir, sourceTempDir, fakeHome, projectDir);

        // Phase D: Verify config source fields are preserved from Phase B

        // D-1: Read global config
        const globalConfigPath = path.join(fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
        const globalConfig = await readTestFile(globalConfigPath);

        // D-2: Global config has skills with source values
        expect(globalConfig).toContain("web-framework-react");
        expect(globalConfig).toContain("source");

        // D-3: Read project config
        const projectConfigPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
        const projectConfig = await readTestFile(projectConfigPath);

        // D-4: Project config has api-framework-hono with source field
        expect(projectConfig).toContain("api-framework-hono");
        expect(projectConfig).toContain("source");

        // D-5: No source field lost during the split
        expect(globalConfig).toContain("local");
        expect(projectConfig).toContain("local");
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );
});
