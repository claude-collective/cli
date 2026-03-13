import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isClaudeCLIAvailable } from "../../src/cli/utils/exec.js";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import {
  verifyConfig,
  verifyAgentCompiled,
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
  runCLI,
  SETUP_TIMEOUT_MS,
  LIFECYCLE_TEST_TIMEOUT_MS,
  PLUGIN_INSTALL_TIMEOUT_MS,
  EXIT_WAIT_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";

/**
 * Full lifecycle E2E test for plugin mode: Init -> Uninstall.
 *
 * This test exercises the complete lifecycle in plugin mode (requires Claude CLI):
 *
 * Phase 1: Init wizard installs skills as Claude CLI plugins
 * Phase 2: Uninstall --yes removes agents and cleans up
 *
 * The entire suite is skipped when the Claude CLI is not available.
 *
 * Design reference: e2e-full-lifecycle-test-design.md Section 3.2
 *
 * Note: Cross-scope testing (Phase 3 from design doc: "Edit Global from Project")
 * is NOT included because:
 * 1. The UX for editing global scope from a project context is not clearly defined
 *    (open question from Section 8 of the lifecycle design)
 * 2. Bug A (agent scope routing in edit) needs to be fixed first
 * 3. This will be added as a separate test once the UX and fix are in place
 */

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)("plugin mode lifecycle: init -> uninstall", () => {
  let fixture: E2EPluginSource;
  let tempDir: string;
  let projectDir: string;
  let session: TerminalSession | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    fixture = await createE2EPluginSource();

    tempDir = await createTempDir();
    projectDir = tempDir;
  }, SETUP_TIMEOUT_MS * 2);

  afterAll(async () => {
    await session?.destroy();
    if (tempDir) await cleanupTempDir(tempDir);
    if (fixture) await cleanupTempDir(fixture.tempDir);
  });

  it(
    "should complete full plugin lifecycle: init -> uninstall",
    { timeout: LIFECYCLE_TEST_TIMEOUT_MS },
    async () => {
      // ================================================================
      // Phase 1: Plugin Init — install skills as Claude CLI plugins
      // ================================================================

      await createPermissionsFile(projectDir);

      session = new TerminalSession(
        ["init", "--source", fixture.sourceDir],
        projectDir,
        { env: { AGENTSINC_SOURCE: undefined } },
      );

      // Navigate through init wizard (slower timeout for plugin installation)
      await navigateInitWizardToCompletion(session, PLUGIN_INSTALL_TIMEOUT_MS);
      const initExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
      expect(initExitCode).toBe(EXIT_CODES.SUCCESS);

      // --- Phase 1 Verification ---

      // PP-1A: Plugin-specific output messages
      const initOutput = session.getFullOutput();
      expect(initOutput).toContain("Installing skill plugins...");
      expect(initOutput).toContain("Plugin (native install)");

      // PP-1B: Config exists with marketplace source
      await verifyConfig(projectDir, {
        skillIds: ["web-framework-react"],
        source: fixture.marketplaceName,
      });

      // PP-1C: At least web-developer agent compiled
      expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);

      // PP-1D: Settings file exists with permissions (pre-created + plugin may add enabledPlugins)
      const settingsPath = path.join(projectDir, CLAUDE_DIR, "settings.json");
      expect(await fileExists(settingsPath)).toBe(true);
      const settingsContent = await readTestFile(settingsPath);
      const settings = JSON.parse(settingsContent) as Record<string, unknown>;
      expect(settings).toHaveProperty("permissions");

      // PP-1E: No errors in output
      expect(initOutput).not.toContain("Failed to");

      // Clean up session before non-interactive commands
      await session.destroy();
      session = undefined;

      // ================================================================
      // Phase 2: Uninstall --yes — remove agents and clean up
      // ================================================================

      const uninstallResult = await runCLI(["uninstall", "--yes"], projectDir, {
        env: { AGENTSINC_SOURCE: undefined },
      });

      expect(uninstallResult.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(uninstallResult.stdout).toContain("Uninstall complete!");

      // --- Phase 2 Verification ---

      // PP-2A: Agents directory removed
      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      expect(await directoryExists(agentsDir)).toBe(false);

      // PP-2B: Config directory preserved (--yes without --all)
      expect(await directoryExists(path.join(projectDir, CLAUDE_SRC_DIR))).toBe(true);

      // PP-2C: Config file still readable
      const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      expect(await fileExists(configPath)).toBe(true);
    },
  );
});
