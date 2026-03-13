import path from "path";
import { mkdir } from "fs/promises";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import {
  verifyConfig,
  verifyAgentCompiled,
  verifySkillCopiedLocally,
} from "../helpers/plugin-assertions.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
  directoryExists,
  readTestFile,
  createPermissionsFile,
  navigateInitWizardToCompletion,
  passThroughAllBuildDomains,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  SETUP_TIMEOUT_MS,
  LIFECYCLE_TEST_TIMEOUT_MS,
  EXIT_WAIT_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";

/**
 * Cross-scope lifecycle E2E test: Init Global -> Init from Project (edit global).
 *
 * This test exercises the cross-scope scenario where a user:
 *
 * Phase 1: Runs `cc init` from HOME to create a global installation
 *          (~/.claude-src/config.ts, ~/.claude/agents/)
 *
 * Phase 2: Runs `cc init` from a project subdirectory. The CLI detects
 *          the global installation and shows GlobalConfigPrompt with choices:
 *            - "Edit global installation"
 *            - "Create new project installation"
 *          User selects "Edit global installation", which delegates to `cc edit`.
 *
 * Phase 3: Verify that:
 *          - Global config and agents still exist and are valid
 *          - Project directory does NOT have .claude-src/config.ts
 *          - Project directory does NOT have .claude/agents/
 *
 * This is a local-mode test (no Claude CLI / marketplace needed).
 *
 * Architecture:
 *   tempDir/
 *     fake-home/                    <- HOME env var points here
 *       .claude-src/config.ts       <- global config (created by Phase 1 init)
 *       .claude/agents/             <- global agents (compiled by Phase 1 init)
 *       .claude/skills/             <- global skills (copied by Phase 1 init)
 *       .claude/settings.json       <- permissions file (pre-created)
 *       project/                    <- project directory (CWD for Phase 2)
 *         (should remain EMPTY after Phase 2 — no project config created)
 */

describe("cross-scope lifecycle: init global -> edit global from project", () => {
  let tempDir: string;
  let sourceDir: string;
  let sourceTempDir: string;
  let fakeHome: string;
  let projectDir: string;
  let session: TerminalSession | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;

    tempDir = await createTempDir();
    fakeHome = path.join(tempDir, "fake-home");
    projectDir = path.join(fakeHome, "project");

    // Create both directories
    await mkdir(fakeHome, { recursive: true });
    await mkdir(projectDir, { recursive: true });
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await session?.destroy();
    if (tempDir) await cleanupTempDir(tempDir);
    if (sourceTempDir) await cleanupTempDir(sourceTempDir);
  });

  it(
    "should init globally, then edit global from project directory",
    { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
    async () => {
      // ================================================================
      // Phase 1: Init from HOME — create global installation
      // ================================================================

      // Create permissions file at fake HOME to prevent permission prompt hang
      await createPermissionsFile(fakeHome);

      session = new TerminalSession(
        ["init", "--source", sourceDir],
        fakeHome,
        {
          env: {
            HOME: fakeHome,
            AGENTSINC_SOURCE: undefined,
          },
        },
      );

      await navigateInitWizardToCompletion(session);
      const initExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
      expect(initExitCode).toBe(EXIT_CODES.SUCCESS);

      // --- Phase 1 Verification ---

      // P1-A: Global config exists at fakeHome/.claude-src/config.ts
      const globalConfigPath = path.join(fakeHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      expect(await fileExists(globalConfigPath)).toBe(true);

      // P1-B: Global config has expected skill
      await verifyConfig(fakeHome, {
        skillIds: ["web-framework-react"],
      });

      // P1-C: Global agents directory exists with compiled agents
      const globalAgentsDir = path.join(fakeHome, CLAUDE_DIR, "agents");
      expect(await directoryExists(globalAgentsDir)).toBe(true);

      // P1-D: At least web-developer agent compiled with valid frontmatter
      expect(await verifyAgentCompiled(fakeHome, "web-developer")).toBe(true);

      // P1-E: Skills were copied locally
      expect(await verifySkillCopiedLocally(fakeHome, "web-framework-react")).toBe(true);

      // P1-F: No errors in output
      const initOutput = session.getFullOutput();
      expect(initOutput).not.toContain("Failed to");
      expect(initOutput).not.toContain("ENOENT");

      // Clean up Phase 1 session
      await session.destroy();
      session = undefined;

      // ================================================================
      // Phase 2: Init from project dir — should show GlobalConfigPrompt
      //
      // When running init from <fakeHome>/project/:
      //   - detectProjectInstallation(projectDir) returns null (no project config)
      //   - detectGlobalInstallation() finds <fakeHome>/.claude-src/config.ts
      //   - GlobalConfigPrompt renders with two choices:
      //     1. "Edit global installation" (first item, already focused)
      //     2. "Create new project installation"
      //   - We press Enter to select "Edit global installation"
      //   - This delegates to `cc edit` which detects the global config
      //   - The edit wizard shows the build step for the existing global skills
      //   - We navigate through the edit wizard without changes and confirm
      // ================================================================

      // Create permissions file at project dir too (for potential permission checks)
      await createPermissionsFile(projectDir);

      session = new TerminalSession(
        ["init", "--source", sourceDir],
        projectDir,
        {
          env: {
            HOME: fakeHome,
            AGENTSINC_SOURCE: undefined,
          },
        },
      );

      // GlobalConfigPrompt should appear with text about global installation
      // init.tsx:125 renders: "A global installation was found at {globalConfigDir}"
      await session.waitForText("global installation was found", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);

      // The first option is "Edit global installation" — press Enter to select it
      session.enter();

      // After selecting "edit global", the edit command runs.
      // edit.tsx detects the global installation (no project config at CWD,
      // falls back to HOME) and launches the edit wizard.
      //
      // The edit wizard starts at the build step with existing skills pre-selected.
      // The E2E stack has 3 domains (Web, API, Shared), so we need to press Enter
      // 3 times to advance through all domains before reaching Sources.
      //
      // Build (Web) -> Build (API) -> Build (Shared) -> Sources -> Agents -> Confirm -> Complete

      await passThroughAllBuildDomains(session);

      // Sources step — accept defaults (first option: "Use all recommended skills")
      await session.waitForText("technologies", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Agents step — accept defaults
      await session.waitForText("Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Confirm step — confirm installation
      await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
      await delay(STEP_TRANSITION_DELAY_MS);
      session.enter();

      // Wait for the edit to complete — may show "unchanged" or "Plugin updated"
      // depending on whether the edit wizard detects any changes.
      // Either way, wait for the process to exit.
      const editExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);

      // Capture output for debugging
      const phase2Raw = session.getRawOutput();

      // ================================================================
      // Phase 3: Verification — global preserved, no project leakage
      // ================================================================

      // P3-A: Edit exited successfully
      expect(editExitCode).toBe(EXIT_CODES.SUCCESS);

      // P3-B: Global config still exists and is valid
      expect(await fileExists(globalConfigPath)).toBe(true);
      const globalConfigContent = await readTestFile(globalConfigPath);
      expect(globalConfigContent).toContain("web-framework-react");

      // P3-C: Global agents still exist
      expect(await directoryExists(globalAgentsDir)).toBe(true);
      expect(await verifyAgentCompiled(fakeHome, "web-developer")).toBe(true);

      // P3-D: Project directory does NOT have .claude-src/config.ts
      // (We chose "edit global", not "create project")
      const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const projectConfigExists = await fileExists(projectConfigPath);
      expect(projectConfigExists).toBe(false);

      // P3-E: Project directory does NOT have .claude/agents/
      // (Agents should only exist at the global scope)
      const projectAgentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      const projectAgentsExist = await directoryExists(projectAgentsDir);
      expect(projectAgentsExist).toBe(false);

      // P3-F: Global skills still exist after edit
      expect(await verifySkillCopiedLocally(fakeHome, "web-framework-react")).toBe(true);

      // P3-G: No errors in Phase 2 output
      expect(phase2Raw).not.toContain("ENOENT");

      // Clean up Phase 2 session
      await session.destroy();
      session = undefined;
    },
  );
});
