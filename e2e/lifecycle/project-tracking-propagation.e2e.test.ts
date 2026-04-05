import { realpathSync } from "fs";
import { mkdir, rm } from "fs/promises";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLI } from "../fixtures/cli.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, EXIT_CODES, DIRS, FILES, STEP_TEXT } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  ensureBinaryExists,
  fileExists,
  readTestFile,
} from "../helpers/test-utils.js";

/**
 * Project tracking and propagation E2E tests.
 *
 * Verifies:
 * 1. Project paths are registered in global config's `projects` field after init
 * 2. Global config changes propagate config-types.ts to registered projects
 * 3. `uninstall --all` deregisters the project from global config
 * 4. Stale project paths are filtered during registration
 */

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

describe("project tracking -- registration", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await cleanupTempDir(tempDir);
    tempDir = undefined!;
  });

  it(
    "should register project paths in global config after init",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      tempDir = await createTempDir();
      const fakeHome = path.join(tempDir, "fake-home");
      const project1Dir = path.join(fakeHome, "project-1");
      const project2Dir = path.join(fakeHome, "project-2");

      await mkdir(fakeHome, { recursive: true });
      await mkdir(project1Dir, { recursive: true });
      await mkdir(project2Dir, { recursive: true });

      await createPermissionsFile(fakeHome);
      await createPermissionsFile(project1Dir);
      await createPermissionsFile(project2Dir);

      // Phase A: Init from HOME (global)
      const globalWizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir: fakeHome,
        env: { HOME: fakeHome },
      });
      const globalResult = await globalWizard.completeWithDefaults();
      const globalExitCode = await globalResult.exitCode;
      expect(globalExitCode, "Global init should succeed").toBe(EXIT_CODES.SUCCESS);
      await globalResult.destroy();

      // Phase B: Init project-1
      const p1Wizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir: project1Dir,
        env: { HOME: fakeHome },
      });
      const p1Result = await p1Wizard.completeWithDefaults();
      const p1ExitCode = await p1Result.exitCode;
      expect(p1ExitCode, "Project-1 init should succeed").toBe(EXIT_CODES.SUCCESS);
      await p1Result.destroy();

      // Phase C: Init project-2
      const p2Wizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir: project2Dir,
        env: { HOME: fakeHome },
      });
      const p2Result = await p2Wizard.completeWithDefaults();
      const p2ExitCode = await p2Result.exitCode;
      expect(p2ExitCode, "Project-2 init should succeed").toBe(EXIT_CODES.SUCCESS);
      await p2Result.destroy();

      // Verification: Global config should contain projects field with both paths
      const globalConfigPath = path.join(fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      expect(await fileExists(globalConfigPath), "Global config must exist").toBe(true);

      const globalConfig = await readTestFile(globalConfigPath);
      expect(globalConfig, "Global config must contain projects field").toContain('"projects"');

      // Both project paths should be registered (realpath-normalized)
      const realProject1 = realpathSync(project1Dir);
      const realProject2 = realpathSync(project2Dir);
      expect(globalConfig, "Global config must contain project-1 path").toContain(realProject1);
      expect(globalConfig, "Global config must contain project-2 path").toContain(realProject2);
    },
  );
});

describe("project tracking -- config-types propagation", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await cleanupTempDir(tempDir);
    tempDir = undefined!;
  });

  it(
    "should propagate config-types.ts to registered projects containing global skill IDs",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      tempDir = await createTempDir();
      const fakeHome = path.join(tempDir, "fake-home");
      const projectDir = path.join(fakeHome, "project");

      await mkdir(fakeHome, { recursive: true });
      await mkdir(projectDir, { recursive: true });

      await createPermissionsFile(fakeHome);
      await createPermissionsFile(projectDir);

      // Phase A: Init from HOME (global)
      const globalWizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir: fakeHome,
        env: { HOME: fakeHome },
      });
      const globalResult = await globalWizard.completeWithDefaults();
      expect(await globalResult.exitCode, "Global init should succeed").toBe(EXIT_CODES.SUCCESS);
      await globalResult.destroy();

      // Phase B: Init project (registers it in global config)
      const projWizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir,
        env: { HOME: fakeHome },
      });
      const projResult = await projWizard.completeWithDefaults();
      expect(await projResult.exitCode, "Project init should succeed").toBe(EXIT_CODES.SUCCESS);
      await projResult.destroy();

      // Verification: Project's config-types.ts should contain global skill IDs
      const projectConfigTypesPath = path.join(projectDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TYPES_TS);
      expect(await fileExists(projectConfigTypesPath), "Project config-types.ts must exist").toBe(
        true,
      );

      const configTypesContent = await readTestFile(projectConfigTypesPath);
      expect(configTypesContent, "config-types.ts must be auto-generated").toContain(
        "AUTO-GENERATED",
      );
      expect(
        configTypesContent,
        "config-types.ts must contain web-framework-react skill ID",
      ).toContain("web-framework-react");

      // Global config should have project registered
      const globalConfigPath = path.join(fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const globalConfig = await readTestFile(globalConfigPath);
      const realProjectDir = realpathSync(projectDir);
      expect(globalConfig, "Global config must contain project path").toContain(realProjectDir);
    },
  );
});

describe("project tracking -- deregistration on uninstall", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await cleanupTempDir(tempDir);
    tempDir = undefined!;
  });

  it("should deregister project on uninstall --all", { timeout: TIMEOUTS.LIFECYCLE }, async () => {
    tempDir = await createTempDir();
    const fakeHome = path.join(tempDir, "fake-home");
    const project1Dir = path.join(fakeHome, "project-1");
    const project2Dir = path.join(fakeHome, "project-2");

    await mkdir(fakeHome, { recursive: true });
    await mkdir(project1Dir, { recursive: true });
    await mkdir(project2Dir, { recursive: true });

    await createPermissionsFile(fakeHome);
    await createPermissionsFile(project1Dir);
    await createPermissionsFile(project2Dir);

    // Phase A: Init from HOME (global)
    const globalWizard = await InitWizard.launch({
      source: { sourceDir, tempDir: sourceTempDir },
      projectDir: fakeHome,
      env: { HOME: fakeHome },
    });
    const globalResult = await globalWizard.completeWithDefaults();
    expect(await globalResult.exitCode, "Global init should succeed").toBe(EXIT_CODES.SUCCESS);
    await globalResult.destroy();

    // Phase B: Init project-1
    const p1Wizard = await InitWizard.launch({
      source: { sourceDir, tempDir: sourceTempDir },
      projectDir: project1Dir,
      env: { HOME: fakeHome },
    });
    const p1Result = await p1Wizard.completeWithDefaults();
    expect(await p1Result.exitCode, "Project-1 init should succeed").toBe(EXIT_CODES.SUCCESS);
    await p1Result.destroy();

    // Phase C: Init project-2
    const p2Wizard = await InitWizard.launch({
      source: { sourceDir, tempDir: sourceTempDir },
      projectDir: project2Dir,
      env: { HOME: fakeHome },
    });
    const p2Result = await p2Wizard.completeWithDefaults();
    expect(await p2Result.exitCode, "Project-2 init should succeed").toBe(EXIT_CODES.SUCCESS);
    await p2Result.destroy();

    // Pre-check: Both projects should be registered
    const globalConfigPath = path.join(fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
    const configBefore = await readTestFile(globalConfigPath);
    const realProject1 = realpathSync(project1Dir);
    const realProject2 = realpathSync(project2Dir);
    expect(configBefore, "Both projects should be registered before uninstall").toContain(
      realProject1,
    );
    expect(configBefore, "Both projects should be registered before uninstall").toContain(
      realProject2,
    );

    // Phase D: Uninstall --all from project-2
    const { exitCode, output } = await CLI.run(
      ["uninstall", "--all", "--yes"],
      { dir: project2Dir },
      { env: { HOME: fakeHome } },
    );

    expect(exitCode, "Uninstall should succeed").toBe(EXIT_CODES.SUCCESS);
    expect(output).toContain(STEP_TEXT.UNINSTALL_SUCCESS);

    // Verification: Global config should no longer contain project-2
    const configAfter = await readTestFile(globalConfigPath);
    expect(configAfter, "Global config should still contain project-1").toContain(realProject1);
    expect(configAfter, "Global config should not contain project-2 after uninstall").not.toContain(
      realProject2,
    );
  });
});

describe("project tracking -- stale path filtering", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await cleanupTempDir(tempDir);
    tempDir = undefined!;
  });

  it(
    "should filter stale project paths during registration",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      tempDir = await createTempDir();
      const fakeHome = path.join(tempDir, "fake-home");
      const project1Dir = path.join(fakeHome, "project-1");
      const project2Dir = path.join(fakeHome, "project-2");

      await mkdir(fakeHome, { recursive: true });
      await mkdir(project1Dir, { recursive: true });
      await mkdir(project2Dir, { recursive: true });

      await createPermissionsFile(fakeHome);
      await createPermissionsFile(project1Dir);
      await createPermissionsFile(project2Dir);

      // Phase A: Init from HOME (global)
      const globalWizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir: fakeHome,
        env: { HOME: fakeHome },
      });
      const globalResult = await globalWizard.completeWithDefaults();
      expect(await globalResult.exitCode, "Global init should succeed").toBe(EXIT_CODES.SUCCESS);
      await globalResult.destroy();

      // Phase B: Init project-1 (registers it)
      const p1Wizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir: project1Dir,
        env: { HOME: fakeHome },
      });
      const p1Result = await p1Wizard.completeWithDefaults();
      expect(await p1Result.exitCode, "Project-1 init should succeed").toBe(EXIT_CODES.SUCCESS);
      await p1Result.destroy();

      // Phase C: Delete project-1's .claude-src/ directory to make it stale
      const project1ConfigDir = path.join(project1Dir, DIRS.CLAUDE_SRC);
      await rm(project1ConfigDir, { recursive: true, force: true });

      // Phase D: Init project-2 (triggers registration, which filters stale entries)
      const p2Wizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir: project2Dir,
        env: { HOME: fakeHome },
      });
      const p2Result = await p2Wizard.completeWithDefaults();
      expect(await p2Result.exitCode, "Project-2 init should succeed").toBe(EXIT_CODES.SUCCESS);
      await p2Result.destroy();

      // Verification: Global config should only contain project-2, not stale project-1
      const globalConfigPath = path.join(fakeHome, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
      const globalConfig = await readTestFile(globalConfigPath);

      const realProject2 = realpathSync(project2Dir);
      expect(globalConfig, "Global config must contain project-2 path").toContain(realProject2);

      // Project-1 should have been filtered out as stale (its config.ts no longer exists)
      const realProject1 = realpathSync(project1Dir);
      expect(globalConfig, "Global config should not contain stale project-1 path").not.toContain(
        realProject1,
      );
    },
  );
});
