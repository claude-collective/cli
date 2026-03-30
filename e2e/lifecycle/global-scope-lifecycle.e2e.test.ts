import { CLI } from "../fixtures/cli.js";
import { mkdir } from "fs/promises";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import "../matchers/setup.js";
import { TIMEOUTS, EXIT_CODES } from "../pages/constants.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  ensureBinaryExists,
} from "../helpers/test-utils.js";
import {
  createDualScopeEnv,
  type DualScopeEnv,
} from "../fixtures/dual-scope-helpers.js";

/**
 * Global scope lifecycle E2E tests -- regression coverage for scope-blind bugs.
 */

// Shared E2E source across all suites in this file
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

// =====================================================================
// Test Suite 1 -- Source Loader: Global local skills always merged
// =====================================================================

describe("global scope lifecycle -- source loader merge", () => {
  let env: DualScopeEnv | undefined;

  afterEach(async () => {
    await env?.destroy();
    env = undefined;
  });

  it(
    "edit wizard should detect both global and project local skills after dual-scope init",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      env = await createDualScopeEnv(sourceDir, sourceTempDir);

      const wizard = await EditWizard.launch({
        projectDir: env.projectDir,
        source: { sourceDir, tempDir: sourceTempDir },
        env: { HOME: env.fakeHome },
        rows: 60,
        cols: 120,
      });

      const sources = await wizard.build.passThroughAllDomainsGeneric();
      await sources.waitForReady();

      const sourcesOutput = wizard.getOutput();
      expect(sourcesOutput).toContain("web-framework-react");
      expect(sourcesOutput).toContain("web-testing-vitest");
      expect(sourcesOutput).toContain("api-framework-hono");

      await wizard.destroy();
    },
  );
});

// =====================================================================
// Test Suite 2 -- Doctor: shared read-only dual-scope state
// =====================================================================

describe("global scope lifecycle -- doctor command", () => {
  let sharedEnv: DualScopeEnv;

  beforeAll(async () => {
    sharedEnv = await createDualScopeEnv(sourceDir, sourceTempDir);
  }, TIMEOUTS.LIFECYCLE);

  afterAll(async () => {
    await sharedEnv?.destroy();
  });

  it("should not report false 'missing' for global-scoped agents", async () => {
    const { fakeHome, projectDir } = sharedEnv;

    const { exitCode, stdout } = await CLI.run(
      ["doctor", "--source", sourceDir],
      { dir: projectDir },
      { env: { HOME: fakeHome } },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).not.toContain("web-developer (missing)");
    expect(stdout).toContain("agents compiled");
  });

  it("should not report false 'missing' for global-scoped skills", async () => {
    const { fakeHome, projectDir } = sharedEnv;

    const { exitCode, stdout } = await CLI.run(
      ["doctor", "--source", sourceDir],
      { dir: projectDir },
      { env: { HOME: fakeHome } },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).not.toContain("web-framework-react (not found)");
    expect(stdout).not.toContain("web-testing-vitest (not found)");
    expect(stdout).toContain("skills found");
  });
});

// =====================================================================
// Test Suite 5 -- Uninstall: per-skill scope from config
// =====================================================================

describe("global scope lifecycle -- uninstall with dual scope", () => {
  let env: DualScopeEnv | undefined;

  afterEach(async () => {
    await env?.destroy();
    env = undefined;
  });

  it(
    "should remove project-scoped skills from project dir via uninstall --yes",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      env = await createDualScopeEnv(sourceDir, sourceTempDir);
      const { fakeHome, projectDir } = env;

      const { exitCode, output } = await CLI.run(
        ["uninstall", "--yes"],
        { dir: projectDir },
        { env: { HOME: fakeHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("Uninstall complete!");

      await expect({ dir: projectDir }).not.toHaveSkillCopied("api-framework-hono");
      await expect({ dir: fakeHome }).toHaveSkillCopied("web-framework-react");
      await expect({ dir: fakeHome }).toHaveSkillCopied("web-testing-vitest");
      await expect({ dir: fakeHome }).toHaveCompiledAgent("web-developer");
    },
  );
});

// =====================================================================
// Test Suite 6 -- Full init wizard with mixed scope -> verify file placement
// =====================================================================

describe("global scope lifecycle -- init wizard with scope toggling", () => {
  let tempDir: string;
  let wizard: InitWizard | undefined;

  afterEach(async () => {
    await wizard?.destroy();
    wizard = undefined;
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  it(
    "should place global-scoped local skills at HOME and project-scoped at project dir",
    { timeout: TIMEOUTS.LIFECYCLE },
    async () => {
      tempDir = await createTempDir();
      const fakeHome = path.join(tempDir, "fake-home");
      const projectDir = path.join(fakeHome, "project");

      await mkdir(fakeHome, { recursive: true });
      await mkdir(projectDir, { recursive: true });
      await createPermissionsFile(fakeHome);
      await createPermissionsFile(projectDir);

      // Run init wizard from project dir with HOME pointing to fakeHome
      wizard = await InitWizard.launch({
        source: { sourceDir, tempDir: sourceTempDir },
        projectDir,
        env: { HOME: fakeHome },
        rows: 60,
        cols: 120,
      });

      // Stack -> Domain -> Build
      const domain = await wizard.stack.selectFirstStack();
      const build = await domain.acceptDefaults();

      // Web domain -- toggle first skill to project scope
      await build.toggleScopeOnFocusedSkill();
      await build.advanceDomain();

      // API domain (all skills stay global)
      await build.advanceDomain();

      // Shared domain (pass through)
      const sources = await build.advanceToSources();

      // Sources -- set ALL to local
      await sources.waitForReady();
      await sources.setAllLocal();
      const agents = await sources.advance();

      // Agents -- accept defaults
      const confirm = await agents.acceptDefaults("init");

      // Confirm
      const result = await confirm.confirm();
      expect(await result.exitCode).toBe(EXIT_CODES.SUCCESS);

      // --- Scope-aware copy assertions ---
      await expect({ dir: projectDir }).toHaveSkillCopied("web-framework-react");
      await expect({ dir: fakeHome }).toHaveSkillCopied("web-testing-vitest");
      await expect({ dir: fakeHome }).not.toHaveSkillCopied("web-framework-react");
      await expect({ dir: projectDir }).not.toHaveSkillCopied("web-testing-vitest");

      await result.destroy();
    },
  );
});
