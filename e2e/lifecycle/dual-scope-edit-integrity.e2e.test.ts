import path from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, DIRS, FILES, EXIT_CODES } from "../pages/constants.js";
import { cleanupTempDir, ensureBinaryExists, readTestFile } from "../helpers/test-utils.js";
import {
  createTestEnvironment,
  initGlobal,
  initProject,
  setupDualScope,
  setupDualScopeWithEject,
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

  it(
    "Compiled agents contain only their assigned skills",
    { timeout: TIMEOUTS.LIFECYCLE, retry: 0 },
    async () => {
      // Global config has web skills and web-developer agent
      await expect({ dir: fakeHome }).toHaveConfig({
        skillIds: ["web-framework-react", "web-testing-vitest", "web-state-zustand"],
        agents: ["web-developer"],
      });

      // Project config has api skill and api-developer agent
      await expect({ dir: projectDir }).toHaveConfig({
        skillIds: ["api-framework-hono"],
        agents: ["api-developer"],
      });

      // web-developer (global) contains its assigned skills, not API skills
      await expect({ dir: fakeHome }).toHaveCompiledAgent("web-developer");
      await expect({ dir: fakeHome }).toHaveCompiledAgentContent("web-developer", {
        contains: ["web-framework-react", "web-testing-vitest"],
        notContains: ["api-framework-hono"],
      });

      // api-developer (project) contains its assigned skill, not web skills
      await expect({ dir: projectDir }).toHaveCompiledAgent("api-developer");
      await expect({ dir: projectDir }).toHaveCompiledAgentContent("api-developer", {
        contains: ["api-framework-hono"],
        notContains: ["web-framework-react"],
      });
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

      // Assert: global config has expected content after Phase A
      await expect({ dir: fakeHome }).toHaveConfig({
        skillIds: [
          "web-framework-react",
          "web-testing-vitest",
          "web-state-zustand",
          "api-framework-hono",
        ],
        agents: ["web-developer", "api-developer"],
        source: "agents-inc",
      });
      const globalConfigPath = path.join(fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const globalConfigAfterA = await readTestFile(globalConfigPath);

      // Phase B: Init project with scope toggling (eject for project-scoped skills)
      const phaseB = await initProject(sourceDir, sourceTempDir, fakeHome, projectDir);
      expect(phaseB.exitCode).toBe(EXIT_CODES.SUCCESS);

      // Assert: global config data is preserved (project init must never modify global config)
      // Strip "projects" tracking line and sort to ignore property reordering from re-serialization
      const globalConfigAfterB = await readTestFile(globalConfigPath);
      expect(globalConfigAfterB).toContain("agents-inc");
      const normalize = (s: string) =>
        s
          .split("\n")
          .filter((line) => !line.includes('"projects"'))
          .sort()
          .join("\n");
      expect(normalize(globalConfigAfterB)).toStrictEqual(normalize(globalConfigAfterA));

      // Assert: project config has api-framework-hono with eject source and api-developer agent
      await expect({ dir: projectDir }).toHaveConfig({
        skillIds: ["api-framework-hono"],
        agents: ["api-developer"],
        source: "eject",
      });
    },
  );
});

// =====================================================================
// Test Suite -- Eject Scope Toggle Copies Skill Files
// =====================================================================

describe("dual-scope edit lifecycle -- eject scope toggle copies skill to project", () => {
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
    "Globally-ejected skill toggled to project scope exists at both paths",
    { timeout: TIMEOUTS.LIFECYCLE, retry: 0 },
    async () => {
      await setupDualScopeWithEject(sourceDir, sourceTempDir, fakeHome, projectDir);

      // Assert: api-framework-hono exists at project path (copied during scope toggle)
      await expect({ dir: projectDir }).toHaveSkillCopied("api-framework-hono");

      // Assert: api-framework-hono still exists at global path (init copies, does not move)
      await expect({ dir: fakeHome }).toHaveSkillCopied("api-framework-hono");

      // Assert: global config has web skills, web-developer agent, and eject source
      await expect({ dir: fakeHome }).toHaveConfig({
        skillIds: ["web-framework-react", "web-testing-vitest", "web-state-zustand"],
        agents: ["web-developer"],
        source: "eject",
      });

      // Assert: project config has api skill and api-developer agent
      await expect({ dir: projectDir }).toHaveConfig({
        skillIds: ["api-framework-hono"],
        agents: ["api-developer"],
        source: "eject",
      });

      // Assert: compiled agents exist at correct scopes
      await expect({ dir: fakeHome }).toHaveCompiledAgent("web-developer");
      await expect({ dir: projectDir }).toHaveCompiledAgent("api-developer");
    },
  );
});
