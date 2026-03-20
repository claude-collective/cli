import path from "path";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import { verifyAgentCompiled } from "../helpers/plugin-assertions.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
  readTestFile,
  createPermissionsFile,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  INSTALL_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  KEYSTROKE_DELAY_MS,
  EXIT_CODES,
  INTERACTIVE_TEST_TIMEOUT_MS,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

/**
 * E2E tests for mixed scope config split verification (Gap 2).
 *
 * When some skills are project-scoped and others are global-scoped,
 * writeScopedConfigs() should produce TWO config files:
 *   - ~/.claude-src/config.ts (global-scoped items)
 *   - <projectDir>/.claude-src/config.ts (project-scoped items)
 *
 * This test exercises the init wizard with scope toggling via the S hotkey,
 * then verifies the config split and agent compilation targets.
 *
 * Architecture:
 *   tempDir/
 *     fake-home/                          <- HOME env var
 *       .claude-src/config.ts             <- global config (after init)
 *     project/                            <- CWD for init
 *       .claude-src/config.ts             <- project config (after init)
 */

describe("init wizard — mixed scope config split", () => {
  let session: TerminalSession | undefined;
  let tempDir: string | undefined;
  let sourceDir: string | undefined;
  let sourceTempDir: string | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    await session?.destroy();
    session = undefined;

    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined;
    }
    if (sourceTempDir) {
      await cleanupTempDir(sourceTempDir);
      sourceTempDir = undefined;
    }
  });

  async function createFixtures(): Promise<{
    fakeHome: string;
    projectDir: string;
  }> {
    tempDir = await createTempDir();
    const { mkdir } = await import("fs/promises");

    const fakeHome = path.join(tempDir, "fake-home");
    const projectDir = path.join(fakeHome, "project");

    await mkdir(fakeHome, { recursive: true });
    await mkdir(projectDir, { recursive: true });

    await createPermissionsFile(fakeHome);
    await createPermissionsFile(projectDir);

    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;

    return { fakeHome, projectDir };
  }

  it(
    "should write TWO config files when skills have mixed scopes",
    { timeout: INTERACTIVE_TEST_TIMEOUT_MS },
    async () => {
      const { fakeHome, projectDir } = await createFixtures();

      session = new TerminalSession(["init", "--source", sourceDir!], projectDir, {
        env: {
          HOME: fakeHome,
          AGENTSINC_SOURCE: undefined,
        },
        rows: 60,
        cols: 120,
      });

      // Step 1: Stack selection — accept first stack
      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Step 2: Domain selection — accept defaults (Web, API, Shared)
      await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Step 3: Build step — Web domain
      // Focus starts on first skill (web-framework-react).
      // Default scope is "global". Press "s" to toggle to "project".
      await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
      await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // Toggle first skill (web-framework-react) to project scope
      session.write("s");
      await delay(KEYSTROKE_DELAY_MS);

      // After toggling, the scope indicator should show "P"
      await delay(STEP_TRANSITION_DELAY_MS);
      const buildOutput = session.getFullOutput();
      expect(buildOutput).toContain("P ");

      // Advance through remaining domains (Web -> API -> Shared)
      session.enter();
      await session.waitForText("API", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      await session.waitForText("Shared", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Sources step — set ALL sources to local (to avoid plugin install)
      await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.write("l");
      await delay(KEYSTROKE_DELAY_MS);
      session.enter();

      // Agents step — toggle api-developer to project scope
      // Focus starts on web-developer (index 0).
      // Navigate down to api-developer (after web agents).
      await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      for (let i = 0; i < 6; i++) {
        session.arrowDown();
        await delay(KEYSTROKE_DELAY_MS);
      }
      session.write("s"); // Toggle api-developer to "project"
      await delay(KEYSTROKE_DELAY_MS);
      session.enter();

      // Confirm step
      await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Wait for installation to complete
      await session.waitForText("initialized successfully", INSTALL_TIMEOUT_MS);
      const exitCode = await session.waitForExit(INSTALL_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // --- Assertions ---

      // 1. BOTH config files should exist
      const globalConfigPath = path.join(fakeHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);

      expect(await fileExists(globalConfigPath), "Global config must exist").toBe(true);
      expect(await fileExists(projectConfigPath), "Project config must exist").toBe(true);

      // 2. Global config skills array should contain only global-scoped skills.
      // Note: the stack section references ALL skill IDs for agent routing,
      // so we specifically check the skills array, not the entire file.
      const globalContent = await readTestFile(globalConfigPath);

      // Extract skills array from global config
      const globalSkillsMatch = globalContent.match(
        /const skills:\s*SkillConfig\[\]\s*=\s*\[([\s\S]*?)\];/,
      );
      expect(globalSkillsMatch, "Global config must have a skills array").not.toBeNull();
      const globalSkillsBlock = globalSkillsMatch![1];

      // web-framework-react was toggled to project scope — NOT in global skills array
      expect(globalSkillsBlock).not.toContain("web-framework-react");
      // web-testing-vitest remained global — IS in global skills array
      expect(globalSkillsBlock).toContain("web-testing-vitest");

      // 3. Project config should contain the project-scoped skill
      const projectContent = await readTestFile(projectConfigPath);
      // The project config should have web-framework-react in its skills
      expect(projectContent).toContain("web-framework-react");

      // 4. web-developer should be compiled (global agent)
      expect(await verifyAgentCompiled(fakeHome, "web-developer")).toBe(true);
    },
  );

  it(
    "should write each skill's scope correctly in split configs",
    { timeout: INTERACTIVE_TEST_TIMEOUT_MS },
    async () => {
      const { fakeHome, projectDir } = await createFixtures();

      session = new TerminalSession(["init", "--source", sourceDir!], projectDir, {
        env: {
          HOME: fakeHome,
          AGENTSINC_SOURCE: undefined,
        },
        rows: 60,
        cols: 120,
      });

      // Step 1: Stack
      await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Step 2: Domains
      await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Step 3: Build — Web domain. Toggle first skill to project.
      await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
      await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.write("s"); // Toggle web-framework-react to project
      await delay(KEYSTROKE_DELAY_MS);
      session.enter();

      // API domain — toggle api-framework-hono to project
      await session.waitForText("API", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.write("s");
      await delay(KEYSTROKE_DELAY_MS);
      session.enter();

      // Shared domain — pass through (stay global)
      await session.waitForText("Shared", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Sources — set all to local
      await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.write("l");
      await delay(KEYSTROKE_DELAY_MS);
      session.enter();

      // Agents — pass through
      await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Confirm
      await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      await session.waitForText("initialized successfully", INSTALL_TIMEOUT_MS);
      const exitCode = await session.waitForExit(INSTALL_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // --- Assertions ---
      const globalConfigPath = path.join(fakeHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);

      const globalContent = await readTestFile(globalConfigPath);
      const projectContent = await readTestFile(projectConfigPath);

      // Extract skills arrays (the stack section references all skill IDs for routing,
      // so we specifically check the skills array, not the entire file)
      const globalSkillsMatch = globalContent.match(
        /const skills:\s*SkillConfig\[\]\s*=\s*\[([\s\S]*?)\];/,
      );
      expect(globalSkillsMatch, "Global config must have a skills array").not.toBeNull();
      const globalSkillsBlock = globalSkillsMatch![1];

      // Global skills array: should NOT contain project-scoped skills
      expect(globalSkillsBlock).not.toContain("web-framework-react");
      expect(globalSkillsBlock).not.toContain("api-framework-hono");

      // Project config: web-framework-react and api-framework-hono (both toggled to project)
      expect(projectContent).toContain("web-framework-react");
      expect(projectContent).toContain("api-framework-hono");

      // Verify scope field values in the project config skills
      const projectSkillsMatch = projectContent.match(
        /const skills:\s*SkillConfig\[\]\s*=\s*\[([\s\S]*?)\];/,
      );
      // Project config may use inline skills or spread from global — check skill exists
      // in the project file regardless of format
      const projectSkillMatch = projectContent.match(
        /"id":\s*"web-framework-react"[^}]*"scope":\s*"(\w+)"/,
      );
      expect(projectSkillMatch).not.toBeNull();
      expect(projectSkillMatch?.[1]).toBe("project");
    },
  );
});
