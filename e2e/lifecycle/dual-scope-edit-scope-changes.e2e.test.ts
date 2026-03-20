import { mkdir } from "fs/promises";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
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
 * Dual-scope edit lifecycle E2E test — scope changes via S hotkey.
 *
 * Tests toggling project skills/agents to global scope via the "s" hotkey
 * in the edit wizard.
 *
 * KNOWN BUG (affects Tests 2, 3):
 * When Phase A installs skills locally (no marketplace -> plugin mode falls back
 * to local), the skills land in HOME/.claude/skills/. During Phase B,
 * loadSkillsMatrixFromSource -> discoverLocalSkills(homeDir) finds them and marks
 * them as local: true with localPath relative to HOME. Then copySkillsToLocalFlattened
 * in skill-copier.ts checks `skill.local && skill.localPath` (line 214) and reads
 * from `path.join(process.cwd(), skill.localPath)` -- but process.cwd() is the
 * projectDir, not homeDir. This causes ENOENT.
 */

/**
 * Runs Phase A: Init from HOME directory.
 * Selects the E2E Test Stack, accepts all domains, advances through build steps.
 * All skills remain global-scoped (default).
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
// Test Suite — Scope Changes via S Hotkey
// =====================================================================

describe("dual-scope edit lifecycle — scope changes via S hotkey", () => {
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
    "Test 2: toggle a project skill's scope to global (expected fail — ENOENT in project-scoped skill copy)",
    { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        await setupDualScope(sourceDir, fakeHome, projectDir);

        // Phase C: Edit — toggle api-framework-hono from project to global scope
        const session = new TerminalSession(["edit", "--source", sourceDir], projectDir, {
          env: {
            HOME: fakeHome,
            AGENTSINC_SOURCE: undefined,
          },
          rows: 60,
          cols: 120,
        });

        try {
          // Build step — Web domain (pass through)
          await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Build step — API domain — toggle api-framework-hono scope to global
          // api-framework-hono is the first (only) skill in API domain, focus starts on it
          await session.waitForText("API", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.write("s"); // Toggle scope from project to global
          await delay(KEYSTROKE_DELAY_MS);
          session.enter();

          // Build step — Shared domain (pass through)
          await session.waitForText("Shared", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Sources step (pass through)
          await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Agents step (pass through)
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

          // Phase D: Assertions

          // D-1: Global config now contains api-framework-hono (it was toggled to global)
          const globalConfig = await readTestFile(
            path.join(fakeHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS),
          );
          expect(globalConfig).toContain("api-framework-hono");

          // D-2: Project config does NOT contain api-framework-hono (it moved to global)
          const projectConfig = await readTestFile(
            path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS),
          );
          expect(projectConfig).not.toContain("api-framework-hono");
        } finally {
          await session.destroy();
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );

  it.fails(
    "Test 3: toggle a project agent's scope to global (expected fail — ENOENT in project-scoped skill copy)",
    { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        await setupDualScope(sourceDir, fakeHome, projectDir);

        // Phase C: Edit — toggle api-developer from project to global scope
        const session = new TerminalSession(["edit", "--source", sourceDir], projectDir, {
          env: {
            HOME: fakeHome,
            AGENTSINC_SOURCE: undefined,
          },
          rows: 60,
          cols: 120,
        });

        try {
          // Build step — pass through all three domains
          await passThroughAllBuildDomains(session);

          // Sources step (pass through)
          await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Agents step — toggle api-developer to global scope
          // Focus starts on web-developer (first in Web group).
          // Need 6 arrow-downs to reach api-developer:
          // web-developer -> web-reviewer -> web-researcher -> web-tester ->
          // web-pm -> web-architecture -> api-developer
          await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          for (let i = 0; i < 6; i++) {
            session.arrowDown();
            await delay(KEYSTROKE_DELAY_MS);
          }
          session.write("s"); // Toggle api-developer scope from project to global
          await delay(KEYSTROKE_DELAY_MS);
          session.enter();

          // Confirm step
          await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Wait for completion
          const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
          expect(exitCode).toBe(EXIT_CODES.SUCCESS);

          // Phase D: Assertions

          // D-1: api-developer.md exists at global scope (HOME)
          const globalApiDevPath = path.join(fakeHome, CLAUDE_DIR, "agents", "api-developer.md");
          expect(
            await fileExists(globalApiDevPath),
            "api-developer.md must exist in global agents dir after scope toggle",
          ).toBe(true);

          // D-2: api-developer.md does NOT exist at project scope
          const projectApiDevPath = path.join(projectDir, CLAUDE_DIR, "agents", "api-developer.md");
          expect(
            await fileExists(projectApiDevPath),
            "api-developer.md must NOT exist in project agents dir after scope toggle to global",
          ).toBe(false);

          // D-3: web-developer.md still at global scope (unchanged)
          const globalWebDevPath = path.join(fakeHome, CLAUDE_DIR, "agents", "web-developer.md");
          expect(
            await fileExists(globalWebDevPath),
            "web-developer.md must still exist in global agents dir",
          ).toBe(true);
        } finally {
          await session.destroy();
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );
});
