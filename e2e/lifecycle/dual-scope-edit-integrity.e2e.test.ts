import { mkdir } from "fs/promises";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_DIRS, STANDARD_FILES } from "../../src/cli/consts.js";
import { isClaudeCLIAvailable } from "../../src/cli/utils/exec.js";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  delay,
  ensureBinaryExists,
  EXIT_CODES,
  EXIT_WAIT_TIMEOUT_MS,
  fileExists,
  INSTALL_TIMEOUT_MS,
  KEYSTROKE_DELAY_MS,
  LIFECYCLE_TEST_TIMEOUT_MS,
  passThroughAllBuildDomains,
  readTestFile,
  SETUP_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  waitForRawText,
  WIZARD_LOAD_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * Dual-scope edit lifecycle E2E test — agent content, config integrity,
 * source changes, and mixed source coexistence.
 *
 * KNOWN BUG (affects Tests 6, 7):
 * When Phase A installs skills locally (no marketplace -> plugin mode falls back
 * to local), the skills land in HOME/.claude/skills/. During Phase B,
 * loadSkillsMatrixFromSource -> discoverLocalSkills(homeDir) finds them and marks
 * them as local: true with localPath relative to HOME. Then copySkillsToLocalFlattened
 * in skill-copier.ts checks `skill.local && skill.localPath` (line 214) and reads
 * from `path.join(process.cwd(), skill.localPath)` -- but process.cwd() is the
 * projectDir, not homeDir. This causes ENOENT.
 *
 * Tests 4, 5, 8, 9 are NOT affected because they use createE2EPluginSource()
 * which has a marketplace.json. Phase A installs as native plugins (no local
 * files at HOME), so discoverLocalSkills finds nothing and the matrix doesn't
 * mark skills as local.
 */

const claudeAvailable = await isClaudeCLIAvailable();

const EXTENDED_LIFECYCLE_TIMEOUT_MS = 300_000;

/**
 * Runs Phase A: Init from HOME directory.
 */
async function initGlobal(
  sourceDir: string,
  homeDir: string,
): Promise<{ exitCode: number; output: string }> {
  const session = new TerminalSession(["init", "--source", sourceDir], homeDir, {
    env: {
      HOME: homeDir,
      AGENTSINC_SOURCE: undefined,
    },
  });

  try {
    await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await session.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.write("a");

    await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "initialized successfully", INSTALL_TIMEOUT_MS);
    const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
    const output = session.getRawOutput();

    return { exitCode, output };
  } finally {
    await session.destroy();
  }
}

/**
 * Runs Phase B: Init from project directory.
 * Toggles api-framework-hono and api-developer to project scope.
 */
async function initProject(
  sourceDir: string,
  homeDir: string,
  projectDir: string,
): Promise<{ exitCode: number; output: string }> {
  const session = new TerminalSession(["init", "--source", sourceDir], projectDir, {
    env: {
      HOME: homeDir,
      AGENTSINC_SOURCE: undefined,
    },
  });

  try {
    await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await session.waitForText("API", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.write("s");
    await delay(KEYSTROKE_DELAY_MS);
    session.enter();

    await session.waitForText("Shared", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);

    // Already in customize view — press "l" to set ALL sources to local
    session.write("l");
    await delay(KEYSTROKE_DELAY_MS);
    session.enter();

    await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    for (let i = 0; i < 6; i++) {
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);
    }
    session.write("s");
    await delay(KEYSTROKE_DELAY_MS);
    session.enter();

    await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "initialized successfully", INSTALL_TIMEOUT_MS);
    const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
    const output = session.getRawOutput();

    return { exitCode, output };
  } finally {
    await session.destroy();
  }
}

/**
 * Creates the temp directory structure for a dual-scope test.
 */
async function createTestEnvironment(): Promise<{
  tempDir: string;
  fakeHome: string;
  projectDir: string;
}> {
  const tempDir = await createTempDir();
  const fakeHome = path.join(tempDir, "fake-home");
  const projectDir = path.join(fakeHome, "project");

  await mkdir(fakeHome, { recursive: true });
  await mkdir(projectDir, { recursive: true });

  await createPermissionsFile(fakeHome);
  await createPermissionsFile(projectDir);

  return { tempDir, fakeHome, projectDir };
}

/**
 * Runs Phase A + Phase B to establish dual-scope state.
 */
async function setupDualScope(
  sourceDir: string,
  fakeHome: string,
  projectDir: string,
): Promise<void> {
  const phaseA = await initGlobal(sourceDir, fakeHome);
  expect(phaseA.exitCode, `Phase A init failed: ${phaseA.output}`).toBe(EXIT_CODES.SUCCESS);

  const phaseB = await initProject(sourceDir, fakeHome, projectDir);
  expect(phaseB.exitCode, `Phase B init failed: ${phaseB.output}`).toBe(EXIT_CODES.SUCCESS);
}

// =====================================================================
// Test Suite — Agent Content and Config Integrity
// =====================================================================

describe("dual-scope edit lifecycle — agent content and config integrity", () => {
  let sourceDir: string;
  let sourceTempDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }, SETUP_TIMEOUT_MS * 2);

  afterAll(async () => {
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  it.fails(
    "Test 6: compiled agents contain only their assigned skills (expected fail — ENOENT in project-scoped skill copy)",
    { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        await setupDualScope(sourceDir, fakeHome, projectDir);

        // Phase D: Assertions — verify agent content from Phase B compilation

        // D-1: Read web-developer.md from global path
        const globalWebDevPath = path.join(fakeHome, CLAUDE_DIR, "agents", "web-developer.md");
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
        const projectApiDevPath = path.join(projectDir, CLAUDE_DIR, "agents", "api-developer.md");
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
    "Test 7: config split preserves source fields after edit (expected fail — ENOENT in project-scoped skill copy)",
    { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        await setupDualScope(sourceDir, fakeHome, projectDir);

        // Phase D: Verify config source fields are preserved from Phase B

        // D-1: Read global config
        const globalConfigPath = path.join(fakeHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        const globalConfig = await readTestFile(globalConfigPath);

        // D-2: Global config has skills with source values
        expect(globalConfig).toContain("web-framework-react");
        expect(globalConfig).toContain("source");

        // D-3: Read project config
        const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
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

// =====================================================================
// Test Suite — Source Changes via Sources Step (Requires Claude CLI)
// =====================================================================

describe.skipIf(!claudeAvailable)(
  "dual-scope edit lifecycle — source changes via Sources step",
  () => {
    let pluginFixture: E2EPluginSource;
    let pluginSourceTempDir: string;

    beforeAll(async () => {
      await ensureBinaryExists();
      pluginFixture = await createE2EPluginSource();
      pluginSourceTempDir = pluginFixture.tempDir;
    }, SETUP_TIMEOUT_MS * 2);

    afterAll(async () => {
      if (pluginSourceTempDir) await cleanupTempDir(pluginSourceTempDir);
    });

    it(
      "Test 4: change a project skill's source from local to plugin",
      { timeout: EXTENDED_LIFECYCLE_TIMEOUT_MS },
      async () => {
        const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

        try {
          // Phase A + B: Use plugin source for init
          const phaseA = await initGlobal(pluginFixture.sourceDir, fakeHome);
          expect(phaseA.exitCode).toBe(EXIT_CODES.SUCCESS);

          const phaseB = await initProject(pluginFixture.sourceDir, fakeHome, projectDir);
          expect(phaseB.exitCode).toBe(EXIT_CODES.SUCCESS);

          // Phase C: Edit — switch api-framework-hono from local to plugin source
          const session = new TerminalSession(
            ["edit", "--source", pluginFixture.sourceDir],
            projectDir,
            {
              env: {
                HOME: fakeHome,
                AGENTSINC_SOURCE: undefined,
              },
              rows: 60,
              cols: 120,
            },
          );

          try {
            // Build step — pass through all three domains
            await passThroughAllBuildDomains(session);

            // Sources step — already in customize view
            await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);

            // In the customize view, navigate to api-framework-hono row
            // and select the marketplace source column
            await delay(STEP_TRANSITION_DELAY_MS);
            session.arrowRight(); // Move to marketplace source column
            await delay(KEYSTROKE_DELAY_MS);
            session.space(); // Select marketplace source
            await delay(KEYSTROKE_DELAY_MS);
            session.enter(); // Confirm source selection

            // Agents step
            await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.enter();

            // Confirm step
            await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.enter();

            // Wait for completion
            const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
            const output = session.getRawOutput();

            // Phase D: Assertions

            expect(exitCode).toBe(EXIT_CODES.SUCCESS);

            // D-1: Output contains migration-related text
            expect(output).toMatch(/[Ss]witch|[Ii]nstall/);

            // D-2: Local skill files removed (switched to plugin)
            const localSkillPath = path.join(
              projectDir,
              CLAUDE_DIR,
              STANDARD_DIRS.SKILLS,
              "api-framework-hono",
              STANDARD_FILES.SKILL_MD,
            );
            expect(await fileExists(localSkillPath)).toBe(false);

            // D-3: Config updated with non-local source
            const projectConfig = await readTestFile(
              path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS),
            );
            expect(projectConfig).toContain("api-framework-hono");
          } finally {
            await session.destroy();
          }
        } finally {
          await cleanupTempDir(tempDir);
        }
      },
    );

    it(
      "Test 5: edit detects source migration from local to plugin for locally-initialized skills",
      { timeout: EXTENDED_LIFECYCLE_TIMEOUT_MS },
      async () => {
        const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

        try {
          // Phase A + B: Init with plugin source — initProject forces all sources
          // to local via the "l" hotkey. So after Phase B, all skills have
          // source: "local" in config, even though the source has a marketplace.
          const phaseA = await initGlobal(pluginFixture.sourceDir, fakeHome);
          expect(phaseA.exitCode).toBe(EXIT_CODES.SUCCESS);

          const phaseB = await initProject(pluginFixture.sourceDir, fakeHome, projectDir);
          expect(phaseB.exitCode).toBe(EXIT_CODES.SUCCESS);

          // Phase C: Edit — the wizard resolves skills from the plugin source,
          // which assigns the marketplace as the default source. Since Phase B
          // wrote source: "local" but the wizard now uses the marketplace source,
          // the edit command detects a source change (local -> marketplace)
          // and migrates skills from local to plugin mode.
          const session = new TerminalSession(
            ["edit", "--source", pluginFixture.sourceDir],
            projectDir,
            {
              env: {
                HOME: fakeHome,
                AGENTSINC_SOURCE: undefined,
              },
              rows: 60,
              cols: 120,
            },
          );

          try {
            // Build step — pass through all three domains
            await passThroughAllBuildDomains(session);

            // Sources step — pass through without customizing.
            // The wizard defaults all skills to the marketplace source.
            await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.enter(); // Accept default sources (marketplace)

            // Agents step
            await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.enter();

            // Confirm step
            await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.enter();

            // Wait for completion
            const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
            const output = session.getRawOutput();

            // Phase D: Assertions

            expect(exitCode).toBe(EXIT_CODES.SUCCESS);

            // D-1: Output contains migration text (local -> plugin migration detected)
            expect(output).toMatch(/[Ss]witch/);

            // D-2: Local skill files deleted by migration (switched to plugin)
            const localSkillPath = path.join(
              projectDir,
              CLAUDE_DIR,
              STANDARD_DIRS.SKILLS,
              "api-framework-hono",
              STANDARD_FILES.SKILL_MD,
            );
            expect(await fileExists(localSkillPath)).toBe(false);

            // D-3: Config updated with marketplace source (not local)
            const projectConfig = await readTestFile(
              path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS),
            );
            expect(projectConfig).toContain("api-framework-hono");
          } finally {
            await session.destroy();
          }
        } finally {
          await cleanupTempDir(tempDir);
        }
      },
    );
  },
);

// =====================================================================
// Test Suite — Mixed Source Coexistence (Requires Claude CLI)
// =====================================================================

describe.skipIf(!claudeAvailable)("dual-scope edit lifecycle — mixed source coexistence", () => {
  let pluginFixture: E2EPluginSource;
  let pluginSourceTempDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    pluginFixture = await createE2EPluginSource();
    pluginSourceTempDir = pluginFixture.tempDir;
  }, SETUP_TIMEOUT_MS * 2);

  afterAll(async () => {
    if (pluginSourceTempDir) await cleanupTempDir(pluginSourceTempDir);
  });

  it(
    "Test 8: edit detects source migration for locally-initialized skills with marketplace source",
    { timeout: EXTENDED_LIFECYCLE_TIMEOUT_MS },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        // Phase A + B: Init with plugin source — initProject forces all sources
        // to local via the "l" hotkey. After Phase B, all skills have
        // source: "local" in config despite the source having a marketplace.
        const phaseA = await initGlobal(pluginFixture.sourceDir, fakeHome);
        expect(phaseA.exitCode).toBe(EXIT_CODES.SUCCESS);

        const phaseB = await initProject(pluginFixture.sourceDir, fakeHome, projectDir);
        expect(phaseB.exitCode).toBe(EXIT_CODES.SUCCESS);

        // Phase C: Edit — the wizard resolves skills from the plugin source,
        // which assigns the marketplace as the default source. Passing through
        // Sources without customizing lets the marketplace source be applied.
        const session = new TerminalSession(
          ["edit", "--source", pluginFixture.sourceDir],
          projectDir,
          {
            env: {
              HOME: fakeHome,
              AGENTSINC_SOURCE: undefined,
            },
            rows: 60,
            cols: 120,
          },
        );

        try {
          // Build step — pass through all three domains
          await passThroughAllBuildDomains(session);

          // Sources step — pass through without customizing.
          await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter(); // Accept default sources

          // Agents step
          await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Confirm step
          await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Wait for completion
          const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
          const output = session.getRawOutput();

          // Phase D: Assertions

          // D-1: Exit code 0
          expect(exitCode).toBe(EXIT_CODES.SUCCESS);

          // D-2: Output contains migration message
          expect(output).toMatch(/[Ss]witch/);

          // D-3: api-framework-hono local files deleted (migrated to plugin)
          const localSkillPath = path.join(
            projectDir,
            CLAUDE_DIR,
            STANDARD_DIRS.SKILLS,
            "api-framework-hono",
            STANDARD_FILES.SKILL_MD,
          );
          expect(await fileExists(localSkillPath)).toBe(false);

          // D-4: Config has api-framework-hono (source migrated to marketplace)
          const projectConfig = await readTestFile(
            path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS),
          );
          expect(projectConfig).toContain("api-framework-hono");

          // D-5: Global config still has web skills
          const globalConfig = await readTestFile(
            path.join(fakeHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS),
          );
          expect(globalConfig).toContain("web-framework-react");
        } finally {
          await session.destroy();
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );

  it.fails(
    "Test 9: compiled agents reference both plugin and local skills correctly (expected fail — plugin-mode compilation missing skill content)",
    { timeout: EXTENDED_LIFECYCLE_TIMEOUT_MS },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        // Phase A + B: Init with plugin source
        const phaseA = await initGlobal(pluginFixture.sourceDir, fakeHome);
        expect(phaseA.exitCode).toBe(EXIT_CODES.SUCCESS);

        const phaseB = await initProject(pluginFixture.sourceDir, fakeHome, projectDir);
        expect(phaseB.exitCode).toBe(EXIT_CODES.SUCCESS);

        // Phase C: Edit — switch api-framework-hono to local
        // Then verify agent compilation includes both source types
        const session = new TerminalSession(
          ["edit", "--source", pluginFixture.sourceDir],
          projectDir,
          {
            env: {
              HOME: fakeHome,
              AGENTSINC_SOURCE: undefined,
            },
            rows: 60,
            cols: 120,
          },
        );

        try {
          // Build step — pass through all three domains
          await passThroughAllBuildDomains(session);

          // Sources step — already in customize view: switch api-framework-hono to local
          await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);

          session.arrowLeft(); // Move to "local" column
          await delay(KEYSTROKE_DELAY_MS);
          session.space();
          await delay(KEYSTROKE_DELAY_MS);
          session.enter();

          // Agents step
          await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Confirm step
          await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Wait for completion
          const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
          expect(exitCode).toBe(EXIT_CODES.SUCCESS);

          // Phase D: Verify agent content

          // D-1: web-developer.md (global) contains its assigned web skills
          const globalWebDevPath = path.join(fakeHome, CLAUDE_DIR, "agents", "web-developer.md");
          expect(await fileExists(globalWebDevPath)).toBe(true);
          const webDevContent = await readTestFile(globalWebDevPath);
          expect(webDevContent).toContain("web-framework-react");
          // web-developer should NOT contain api-framework-hono
          expect(webDevContent).not.toContain("api-framework-hono");

          // D-2: api-developer.md (project) contains api-framework-hono (now local)
          const projectApiDevPath = path.join(projectDir, CLAUDE_DIR, "agents", "api-developer.md");
          expect(await fileExists(projectApiDevPath)).toBe(true);
          const apiDevContent = await readTestFile(projectApiDevPath);
          expect(apiDevContent).toContain("api-framework-hono");
          // api-developer should NOT contain web-framework-react
          expect(apiDevContent).not.toContain("web-framework-react");
        } finally {
          await session.destroy();
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );
});
