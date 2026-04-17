import { realpathSync } from "fs";
import { mkdir, rm } from "fs/promises";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLI } from "../fixtures/cli.js";
import { createTestEnvironment, initProjectAllGlobal } from "../fixtures/dual-scope-helpers.js";
import { createE2EPluginSource } from "../helpers/create-e2e-plugin-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, EXIT_CODES, DIRS, FILES, STEP_TEXT } from "../pages/constants.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  ensureBinaryExists,
  fileExists,
  isClaudeCLIAvailable,
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

const claudeAvailable = await isClaudeCLIAvailable();

beforeAll(async () => {
  if (!claudeAvailable) return;
  await ensureBinaryExists();
  const source = await createE2EPluginSource();
  sourceDir = source.sourceDir;
  sourceTempDir = source.tempDir;
}, TIMEOUTS.SETUP * 2);

afterAll(async () => {
  if (sourceTempDir) await cleanupTempDir(sourceTempDir);
});

describe.skipIf(!claudeAvailable)("project tracking -- registration", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await cleanupTempDir(tempDir);
    tempDir = undefined!;
  });

  it(
    "should register project paths in global config after init",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      const env = await createTestEnvironment();
      tempDir = env.tempDir;
      const { fakeHome } = env;
      const project1Dir = path.join(fakeHome, "project-1");
      const project2Dir = path.join(fakeHome, "project-2");

      await mkdir(project1Dir, { recursive: true });
      await mkdir(project2Dir, { recursive: true });
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

      // Phase B: Init project-1 via dashboard → Edit (global install already exists)
      const p1 = await initProjectAllGlobal(sourceDir, sourceTempDir, fakeHome, project1Dir);
      expect(p1.exitCode, "Project-1 init should succeed").toBe(EXIT_CODES.SUCCESS);

      // Phase C: Init project-2 via dashboard → Edit
      const p2 = await initProjectAllGlobal(sourceDir, sourceTempDir, fakeHome, project2Dir);
      expect(p2.exitCode, "Project-2 init should succeed").toBe(EXIT_CODES.SUCCESS);

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

describe.skipIf(!claudeAvailable)("project tracking -- config-types propagation", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await cleanupTempDir(tempDir);
    tempDir = undefined!;
  });

  it(
    "should propagate config-types.ts to registered projects containing global skill IDs",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      const env = await createTestEnvironment();
      tempDir = env.tempDir;
      const { fakeHome, projectDir } = env;

      // Phase A: Init from HOME (global)
      const globalWizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir: fakeHome,
        env: { HOME: fakeHome },
      });
      const globalResult = await globalWizard.completeWithDefaults();
      expect(await globalResult.exitCode, "Global init should succeed").toBe(EXIT_CODES.SUCCESS);
      await globalResult.destroy();

      // Phase B: Init project via dashboard → Edit (registers it in global config)
      const proj = await initProjectAllGlobal(sourceDir, sourceTempDir, fakeHome, projectDir);
      expect(proj.exitCode, "Project init should succeed").toBe(EXIT_CODES.SUCCESS);

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

describe.skipIf(!claudeAvailable)("project tracking -- deregistration on uninstall", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await cleanupTempDir(tempDir);
    tempDir = undefined!;
  });

  it(
    "should deregister project on uninstall --all",
    { timeout: TIMEOUTS.LIFECYCLE, retry: 1 },
    async () => {
      const env = await createTestEnvironment();
      tempDir = env.tempDir;
      const { fakeHome } = env;
      const project1Dir = path.join(fakeHome, "project-1");
      const project2Dir = path.join(fakeHome, "project-2");

      await mkdir(project1Dir, { recursive: true });
      await mkdir(project2Dir, { recursive: true });
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

      // Phase B: Init project-1 via dashboard → Edit
      const p1 = await initProjectAllGlobal(sourceDir, sourceTempDir, fakeHome, project1Dir);
      expect(p1.exitCode, "Project-1 init should succeed").toBe(EXIT_CODES.SUCCESS);

      // Phase C: Init project-2 via dashboard → Edit
      const p2 = await initProjectAllGlobal(sourceDir, sourceTempDir, fakeHome, project2Dir);
      expect(p2.exitCode, "Project-2 init should succeed").toBe(EXIT_CODES.SUCCESS);

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
      expect(
        configAfter,
        "Global config should not contain project-2 after uninstall",
      ).not.toContain(realProject2);
    },
  );
});

describe.skipIf(!claudeAvailable)("project tracking -- stale path filtering", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await cleanupTempDir(tempDir);
    tempDir = undefined!;
  });

  it(
    "should filter stale project paths during registration",
    { timeout: TIMEOUTS.LIFECYCLE, retry: 1 },
    async () => {
      const env = await createTestEnvironment();
      tempDir = env.tempDir;
      const { fakeHome } = env;
      const project1Dir = path.join(fakeHome, "project-1");
      const project2Dir = path.join(fakeHome, "project-2");

      await mkdir(project1Dir, { recursive: true });
      await mkdir(project2Dir, { recursive: true });
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

      // Phase B: Init project-1 via dashboard → Edit (registers it)
      const p1 = await initProjectAllGlobal(sourceDir, sourceTempDir, fakeHome, project1Dir);
      expect(p1.exitCode, "Project-1 init should succeed").toBe(EXIT_CODES.SUCCESS);

      // Phase C: Delete project-1's .claude-src/ directory to make it stale
      const project1ConfigDir = path.join(project1Dir, DIRS.CLAUDE_SRC);
      await rm(project1ConfigDir, { recursive: true, force: true });

      // Phase D: Init project-2 via dashboard → Edit (triggers registration + stale filtering)
      const p2 = await initProjectAllGlobal(sourceDir, sourceTempDir, fakeHome, project2Dir);
      expect(p2.exitCode, "Project-2 init should succeed").toBe(EXIT_CODES.SUCCESS);

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
