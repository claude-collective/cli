import path from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { expectPhaseSuccess } from "../assertions/phase-assertions.js";
import { expectDualScopeInstallation } from "../assertions/scope-assertions.js";
import { E2E_AGENTS } from "../fixtures/expected-values.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, DIRS, FILES } from "../pages/constants.js";
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
      // Verify both scopes have correct config and compiled agents
      await expectDualScopeInstallation(fakeHome, projectDir, {
        global: {
          skillIds: ["web-framework-react", "web-testing-vitest", "web-state-zustand"],
          agents: [...E2E_AGENTS.WEB],
        },
        project: {
          skillIds: ["api-framework-hono"],
          agents: [...E2E_AGENTS.API],
        },
      });

      // web-developer (global) contains its preloaded skills, not API skills
      await expect({ dir: fakeHome }).toHaveAgentFrontmatter("web-developer", {
        skills: ["web-framework-react"],
      });
      await expect({ dir: fakeHome }).toHaveCompiledAgentContent("web-developer", {
        notContains: ["api-framework-hono"],
      });

      // api-developer (project) contains its assigned skill, not web skills
      await expect({ dir: projectDir }).toHaveAgentFrontmatter("api-developer", {
        skills: ["api-framework-hono"],
      });
      await expect({ dir: projectDir }).toHaveCompiledAgentContent("api-developer", {
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
      await expectPhaseSuccess(
        { project: { dir: fakeHome }, exitCode: phaseA.exitCode },
        {
          skillIds: [
            "web-framework-react",
            "web-testing-vitest",
            "web-state-zustand",
            "api-framework-hono",
          ],
          agents: E2E_AGENTS.WEB_AND_API,
          source: "agents-inc",
        },
      );
      const globalConfigPath = path.join(fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const globalConfigAfterA = await readTestFile(globalConfigPath);

      // Phase B: Init project with scope toggling (eject for project-scoped skills)
      const phaseB = await initProject(sourceDir, sourceTempDir, fakeHome, projectDir);
      await expectPhaseSuccess(
        { project: { dir: projectDir }, exitCode: phaseB.exitCode },
        {
          skillIds: ["api-framework-hono"],
          agents: [...E2E_AGENTS.API],
          source: "eject",
        },
      );

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

      // Assert: api-framework-hono exists at both project and global paths
      await expect({ dir: projectDir }).toHaveSkillCopied("api-framework-hono");
      await expect({ dir: fakeHome }).toHaveSkillCopied("api-framework-hono");

      // Assert: dual-scope config and compiled agents are correct
      await expectDualScopeInstallation(fakeHome, projectDir, {
        global: {
          skillIds: ["web-framework-react", "web-testing-vitest", "web-state-zustand"],
          agents: [...E2E_AGENTS.WEB],
        },
        project: {
          skillIds: ["api-framework-hono"],
          agents: [...E2E_AGENTS.API],
        },
      });
    },
  );
});
