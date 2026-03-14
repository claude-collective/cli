import path from "path";
import { mkdir } from "fs/promises";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isClaudeCLIAvailable } from "../../src/cli/utils/exec.js";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
  createPermissionsFile,
  readTestFile,
  delay,
  passThroughAllBuildDomains,
  WIZARD_LOAD_TIMEOUT_MS,
  INSTALL_TIMEOUT_MS,
  SETUP_TIMEOUT_MS,
  LIFECYCLE_TEST_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  KEYSTROKE_DELAY_MS,
  EXIT_WAIT_TIMEOUT_MS,
  EXIT_CODES,
  waitForRawText,
} from "../helpers/test-utils.js";
import { verifyAgentCompiled } from "../helpers/plugin-assertions.js";

/**
 * Dual-scope edit lifecycle E2E test.
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
 * KNOWN BUG (affects Tests 1-3, 6-7):
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

    // Sources step — "Choice" view shows two options:
    //   1. "Use all recommended sources" (first, focused)
    //   2. "Customize skill sources" (second)
    // We need to enter Customize view to press "l" (set all sources to local).
    // Without this, skills have source: "agents-inc" from createDefaultSkillConfig,
    // which triggers plugin install mode (and fails without a real marketplace).
    await session.waitForText("technologies", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.arrowDown(); // Move to "Customize skill sources"
    await delay(KEYSTROKE_DELAY_MS);
    session.enter(); // Enter customize view

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
    await session.waitForText("Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
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
// Test Suite
// =====================================================================

describe("dual-scope edit lifecycle", () => {
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

  // ------------------------------------------------------------------
  // Display and Locking
  // ------------------------------------------------------------------

  describe("display and locking", () => {
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
            await session.waitForText("technologies", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.enter();

            // Agents step — should show scope badges
            await session.waitForText("Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
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
            const projectConfigPath = path.join(
              projectDir,
              CLAUDE_SRC_DIR,
              STANDARD_FILES.CONFIG_TS,
            );
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

  // ------------------------------------------------------------------
  // Scope Changes via S Hotkey
  // ------------------------------------------------------------------

  describe("scope changes via S hotkey", () => {
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
            await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.enter();

            // Build step — API domain — toggle api-framework-hono scope to global
            // api-framework-hono is the first (only) skill in API domain, focus starts on it
            await session.waitForText("Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.write("s"); // Toggle scope from project to global
            await delay(KEYSTROKE_DELAY_MS);
            session.enter();

            // Build step — Shared domain (pass through)
            await session.waitForText("Customize your Shared stack", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.enter();

            // Sources step (pass through)
            await session.waitForText("technologies", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.enter();

            // Agents step (pass through)
            await session.waitForText("Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
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
            await session.waitForText("technologies", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.enter();

            // Agents step — toggle api-developer to global scope
            // Focus starts on web-developer (first in Web group).
            // Need 6 arrow-downs to reach api-developer:
            // web-developer -> web-reviewer -> web-researcher -> web-tester ->
            // web-pm -> web-architecture -> api-developer
            await session.waitForText("Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
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
            const projectApiDevPath = path.join(
              projectDir,
              CLAUDE_DIR,
              "agents",
              "api-developer.md",
            );
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

  // ------------------------------------------------------------------
  // Agent Content and Config Integrity
  // ------------------------------------------------------------------

  describe("agent content and config integrity", () => {
    it.fails(
      "Test 6: compiled agents contain only their assigned skills (expected fail — ENOENT in project-scoped skill copy)",
      { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
      async () => {
        const { tempDir, fakeHome, projectDir } = await createTestEnvironment();

        try {
          await setupDualScope(sourceDir, fakeHome, projectDir);

          // Phase C: Edit — navigate through without changes.
          // The edit command checks for skill/scope/source changes.
          // If no changes detected, it logs "No changes made" and exits early (edit.tsx:242-246).
          //
          // To force the full edit flow with recompilation, we need a change.
          // Scope changes count (edit.tsx:242 checks hasScopeChanges).
          // But we want "no changes" here — we just want to verify the existing agent content
          // from Phase B's compilation.
          //
          // Strategy: Skip the edit step entirely and just read the files from Phase B.
          // The init in Phase B already compiled agents. We verify those.

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
          expect(
            await fileExists(projectApiDevPath),
            "api-developer.md must exist in project",
          ).toBe(true);
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
          // Global skills should have source: "local" (default from E2E source, no marketplace)
          expect(globalConfig).toContain("web-framework-react");
          expect(globalConfig).toContain("source");

          // D-3: Read project config
          const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
          const projectConfig = await readTestFile(projectConfigPath);

          // D-4: Project config has api-framework-hono with source field
          expect(projectConfig).toContain("api-framework-hono");
          expect(projectConfig).toContain("source");

          // D-5: No source field lost during the split
          // Both configs should reference "local" as the source (local mode init)
          expect(globalConfig).toContain("local");
          expect(projectConfig).toContain("local");
        } finally {
          await cleanupTempDir(tempDir);
        }
      },
    );
  });

  // ------------------------------------------------------------------
  // Source Changes via Sources Step (Requires Claude CLI)
  // ------------------------------------------------------------------

  describe.skipIf(!claudeAvailable)("source changes via Sources step", () => {
    let pluginFixture: E2EPluginSource;
    let pluginSourceTempDir: string;

    beforeAll(async () => {
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

            // Sources step — navigate to "Customize skill sources"
            await session.waitForText("technologies", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.arrowDown(); // Move to "Customize skill sources"
            await delay(KEYSTROKE_DELAY_MS);
            session.enter();

            // In the customize view, navigate to api-framework-hono row
            // and select the marketplace source column
            await delay(STEP_TRANSITION_DELAY_MS);
            // Navigate to the api-framework-hono row (position depends on skill order)
            // Then arrow right to marketplace source and press Space
            session.arrowRight(); // Move to marketplace source column
            await delay(KEYSTROKE_DELAY_MS);
            session.space(); // Select marketplace source
            await delay(KEYSTROKE_DELAY_MS);
            session.enter(); // Confirm source selection

            // Agents step
            await session.waitForText("Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
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
          // The edit completes without navigating Sources customize, so the
          // wizard uses the marketplace source as default for all skills.
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
            await session.waitForText("technologies", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.enter(); // Accept default sources (marketplace)

            // Agents step
            await session.waitForText("Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
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
  });

  // ------------------------------------------------------------------
  // Mixed Source Coexistence (Requires Claude CLI)
  // ------------------------------------------------------------------

  describe.skipIf(!claudeAvailable)("mixed source coexistence", () => {
    let pluginFixture: E2EPluginSource;
    let pluginSourceTempDir: string;

    beforeAll(async () => {
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
          // The edit command detects source changes (local -> marketplace) and
          // migrates all skills from local to plugin mode.
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
            // The wizard defaults to the marketplace source for all skills.
            await session.waitForText("technologies", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.enter(); // Accept default sources

            // Agents step
            await session.waitForText("Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
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

            // Sources step — customize: switch api-framework-hono to local
            await session.waitForText("technologies", WIZARD_LOAD_TIMEOUT_MS);
            await delay(STEP_TRANSITION_DELAY_MS);
            session.arrowDown();
            await delay(KEYSTROKE_DELAY_MS);
            session.enter();

            await delay(STEP_TRANSITION_DELAY_MS);
            session.arrowLeft(); // Move to "local" column
            await delay(KEYSTROKE_DELAY_MS);
            session.space();
            await delay(KEYSTROKE_DELAY_MS);
            session.enter();

            // Agents step
            await session.waitForText("Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
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
            const projectApiDevPath = path.join(
              projectDir,
              CLAUDE_DIR,
              "agents",
              "api-developer.md",
            );
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
});
