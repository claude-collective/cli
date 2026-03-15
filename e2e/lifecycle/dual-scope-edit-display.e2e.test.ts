import { mkdir } from "fs/promises";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { verifyAgentCompiled } from "../helpers/plugin-assertions.js";
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
  SETUP_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  waitForRawText,
  WIZARD_LOAD_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * Dual-scope edit lifecycle E2E test — display and locking.
 *
 * Tests the full lifecycle: init global -> init project -> edit from project.
 * Verifies that the CLI correctly handles dual-scope state with mixed sources
 * throughout the real user flow.
 *
 * Architecture per test:
 *   tempDir/
 *     fake-home/                          <- HOME env var
 *       .claude-src/config.ts             <- global config
 *       .claude/agents/web-developer.md   <- global agent
 *       .claude/skills/web-framework-react/ <- global local skill
 *       .claude/settings.json             <- permissions
 *       project/                          <- project dir (CWD for Phase B/C)
 *         .claude-src/config.ts           <- project config
 *         .claude/agents/api-developer.md <- project agent
 *         .claude/skills/api-framework-hono/ <- project local skill
 *         .claude/settings.json           <- permissions
 *
 * Phase A: Init from HOME — all domains, web-developer/api-developer agents,
 *          all skills global-scoped (default). On build step for API domain,
 *          no scope toggle — everything stays global.
 *
 * Phase B: Init from project dir — "Create new project installation".
 *          Same stack, but on API build step press "s" to toggle api-framework-hono
 *          to project scope, and on agents step press "s" to toggle api-developer
 *          to project scope. writeScopedConfigs splits: global items to HOME,
 *          project items to project dir.
 *
 * Note on scope defaults: createDefaultSkillConfig() in wizard-store.ts sets
 * scope: "global" for ALL new skills. The "s" hotkey during Phase B init is
 * required to assign project scope to the API items.
 *
 * KNOWN BUG (affects Test 1):
 * When Phase A installs skills locally (no marketplace → plugin mode falls back
 * to local), the skills land in HOME/.claude/skills/. During Phase B,
 * loadSkillsMatrixFromSource → discoverLocalSkills(homeDir) finds them and marks
 * them as local: true with localPath relative to HOME. Then copySkillsToLocalFlattened
 * in skill-copier.ts checks `skill.local && skill.localPath` (line 214) and reads
 * from `path.join(process.cwd(), skill.localPath)` — but process.cwd() is the
 * projectDir, not homeDir. This causes ENOENT because the skill files are at HOME,
 * not at the project directory.
 *
 * Bug location: src/cli/lib/skills/skill-copier.ts line 215
 * Fix: When skill.local is true, resolve localPath against the discovery base
 * directory (from discoverLocalSkills), not process.cwd().
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
    // Stack selection — accept first stack (E2E Test Stack)
    await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Domain selection — accept all pre-selected domains (Web, API, Shared)
    await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Build step — press "a" to accept all stack defaults.
    // This skips individual domain pages and jumps to confirmation.
    // Critically, the "a" path creates skillConfigs with source: "local"
    // (wizard.tsx:190 fallback), avoiding the plugin install path.
    await session.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.write("a");

    // Confirm step — confirm installation
    await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Wait for installation to complete.
    // Use raw output polling because xterm scrollback (1000 lines) gets exceeded
    // by relationship resolution warnings during matrix loading.
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
 * Navigates GlobalConfigPrompt -> "Create new project installation".
 * Same stack, but toggles api-framework-hono and api-developer to project scope.
 *
 * The wizard defaults all skills to scope: "global" and source: "agents-inc"
 * (via createDefaultSkillConfig in wizard-store.ts). We navigate through individual
 * domain build steps so the store's skillConfigs are populated (not the "a" shortcut
 * which bypasses the store). On the API build step, we press "s" to toggle
 * api-framework-hono scope to "project".
 *
 * Then on the Sources step, we enter the "Customize" view and press "l" to set
 * ALL skill sources to "local". This overrides the "agents-inc" default that would
 * otherwise trigger plugin mode. The "l" hotkey calls setAllSourcesLocal() which
 * sets source: "local" on every skillConfig in the store.
 *
 * On the Agents step, focus starts on web-developer (first in Web group).
 * We arrow down 6 times (web-developer -> web-reviewer -> web-researcher ->
 * web-tester -> web-pm -> web-architecture -> api-developer) to reach api-developer,
 * then press "s" to toggle it to project scope.
 *
 * Result: api-framework-hono (scope: project, source: local) and
 *         api-developer (scope: project) — all others stay global.
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
    // Stack selection — accept first stack (E2E Test Stack)
    await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Domain selection — accept all pre-selected domains (Web, API, Shared)
    await session.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Build step — Web domain (pass through, all skills stay global)
    await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Build step — API domain
    // Focus starts on api-framework-hono (only skill in API domain).
    // Press "s" to toggle scope from global to project.
    await session.waitForText("Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.write("s"); // Toggle api-framework-hono scope to "project"
    await delay(KEYSTROKE_DELAY_MS);
    session.enter();

    // Build step — Shared domain (pass through, all methodology skills stay global)
    await session.waitForText("Customize your Shared stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Sources step — already in customize view (SOURCE_CHOICE is false).
    // We need to press "l" to set ALL sources to local.
    // Without this, skills have source: "agents-inc" from createDefaultSkillConfig,
    // which triggers plugin install mode (and fails without a real marketplace).
    await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);

    // In customize view, press "l" to set ALL sources to local
    await delay(STEP_TRANSITION_DELAY_MS);
    session.write("l");
    await delay(KEYSTROKE_DELAY_MS);
    session.enter(); // Continue past Sources step

    // Agents step — toggle api-developer to project scope
    // Focus starts on web-developer (first in Web group).
    // Agent focus order: web-developer, web-reviewer, web-researcher,
    // web-tester, web-pm, web-architecture, api-developer, ...
    // Need 6 arrow-downs to reach api-developer.
    await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    for (let i = 0; i < 6; i++) {
      session.arrowDown();
      await delay(KEYSTROKE_DELAY_MS);
    }
    session.write("s"); // Toggle api-developer scope to "project"
    await delay(KEYSTROKE_DELAY_MS);
    session.enter(); // Continue past Agents step

    // Confirm step — confirm installation
    await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Wait for installation to complete.
    // Use raw output polling because xterm scrollback (1000 lines) gets exceeded
    // by relationship resolution warnings during matrix loading.
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
 * Returns paths needed for Phases A, B, and C.
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

  // Create permissions files to prevent permission prompt hang
  await createPermissionsFile(fakeHome);
  await createPermissionsFile(projectDir);

  return { tempDir, fakeHome, projectDir };
}

/**
 * Runs Phase A + Phase B to establish dual-scope state.
 * All tests share this common setup, then diverge at Phase C (edit).
 */
async function setupDualScope(
  sourceDir: string,
  fakeHome: string,
  projectDir: string,
): Promise<void> {
  // Phase A: Init global
  const phaseA = await initGlobal(sourceDir, fakeHome);
  expect(phaseA.exitCode, `Phase A init failed: ${phaseA.output}`).toBe(EXIT_CODES.SUCCESS);

  // Phase B: Init project with scope toggling
  const phaseB = await initProject(sourceDir, fakeHome, projectDir);
  expect(phaseB.exitCode, `Phase B init failed: ${phaseB.output}`).toBe(EXIT_CODES.SUCCESS);
}

// =====================================================================
// Test Suite — Display and Locking
// =====================================================================

describe("dual-scope edit lifecycle — display and locking", () => {
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
    "Test 1: edit shows global items as locked, project items as editable (expected fail — ENOENT in project-scoped skill copy)",
    { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
    async () => {
      const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

      try {
        await setupDualScope(sourceDir, fakeHome, projectDir);

        // Phase C: Edit from project dir — navigate through without changes
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

          // Sources step
          await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Agents step — should show scope badges
          await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Confirm step
          await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          session.enter();

          // Wait for completion — edit should detect no changes
          const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);

          // Phase D: Assertions

          // D-1: Exit code 0
          expect(exitCode).toBe(EXIT_CODES.SUCCESS);

          // D-2: Scope indicators visible in output
          // Global skills show "G " prefix, project skills show "P " prefix
          const rawOutput = session.getRawOutput();
          expect(rawOutput).toContain("G ");
          expect(rawOutput).toContain("P ");

          // D-3: Agent scope badges
          expect(rawOutput).toContain("[G]");
          expect(rawOutput).toContain("[P]");

          // D-4: Config files unchanged — both still exist
          const globalConfigPath = path.join(fakeHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
          const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
          expect(await fileExists(globalConfigPath)).toBe(true);
          expect(await fileExists(projectConfigPath)).toBe(true);

          // D-5: Agent files preserved
          expect(await verifyAgentCompiled(fakeHome, "web-developer")).toBe(true);
          expect(await verifyAgentCompiled(projectDir, "api-developer")).toBe(true);
        } finally {
          await session.destroy();
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    },
  );
});
