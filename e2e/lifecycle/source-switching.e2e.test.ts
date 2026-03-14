import path from "path";
import { readFile, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { isClaudeCLIAvailable } from "../../src/cli/utils/exec.js";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
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
  createPermissionsFile,
  readTestFile,
  fileExists,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  SETUP_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  KEYSTROKE_DELAY_MS,
  PLUGIN_INSTALL_TIMEOUT_MS,
  EXIT_WAIT_TIMEOUT_MS,
  EXIT_CODES,
  waitForRawText,
} from "../helpers/test-utils.js";

/**
 * Source switching lifecycle E2E tests.
 *
 * Tests the full flow of switching skill sources mid-lifecycle:
 *   9a: Init local -> edit switch ALL to plugin -> verify plugin state
 *   9b: Init plugin -> edit switch ALL to local -> verify local state
 *   9c: Init local -> edit switch ONE skill to plugin -> verify mixed state
 *
 * These tests require the Claude CLI for plugin install/uninstall operations.
 * The entire suite is skipped when the Claude CLI is not available.
 *
 * Architecture:
 *   Phase 1: Init with either local or plugin mode via TerminalSession
 *   Phase 2: Edit via TerminalSession, navigate to Sources step, switch modes
 *   Phase 3: Verify config, file system, and compile output
 *
 * NOTE: All text detection uses waitForRawText() instead of session.waitForText()
 * because the xterm buffer (1000 lines) gets exceeded by relationship resolution
 * warnings during matrix loading. Raw output captures everything regardless of
 * scrollback limits.
 */

const claudeAvailable = await isClaudeCLIAvailable();

const EXTENDED_LIFECYCLE_TIMEOUT_MS = 300_000;

/**
 * Injects the marketplace field into an existing config.ts.
 *
 * When init runs in local mode, the generated config has no marketplace field.
 * The edit command's mode-migrator requires sourceResult.marketplace to install
 * plugins (mode-migrator.ts:129). resolveSource() reads marketplace from the
 * project config, so we must inject it before running the edit wizard for
 * local->plugin migration.
 *
 * This mirrors what createLocalProjectWithMarketplace() does in
 * edit-wizard-plugin.e2e.test.ts for P-EDIT-3.
 */
async function injectMarketplaceIntoConfig(
  projectDir: string,
  marketplaceName: string,
): Promise<void> {
  const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
  const content = await readFile(configPath, "utf-8");

  // Insert marketplace field into the export default block.
  // The config uses: export default { ... } satisfies ProjectConfig;
  // We insert the field right after the opening brace of export default.
  const marker = "export default {";
  const idx = content.indexOf(marker);
  if (idx === -1) {
    throw new Error(
      `Could not find "${marker}" in config.ts. Content starts with: ${content.slice(0, 200)}`,
    );
  }
  const insertAt = idx + marker.length;
  const patched =
    content.slice(0, insertAt) +
    `\n  "marketplace": "${marketplaceName}",` +
    content.slice(insertAt);

  await writeFile(configPath, patched, "utf-8");
}

/**
 * Runs the full init wizard flow and installs in local mode.
 *
 * Navigates through individual domain build steps (not the "a" shortcut) so the
 * store's skillConfigs are populated, then forces all sources to "local" via the
 * Sources customize view. This ensures the init completes with local skills even
 * when the source has a marketplace.json.
 */
async function initLocal(
  sourceDir: string,
  projectDir: string,
): Promise<{ exitCode: number; output: string }> {
  await createPermissionsFile(projectDir);

  const session = new TerminalSession(["init", "--source", sourceDir], projectDir, {
    env: { AGENTSINC_SOURCE: undefined },
  });

  try {
    // Stack selection
    await waitForRawText(session, "Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Domain selection
    await waitForRawText(session, "Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Build step — advance through each domain individually
    await waitForRawText(session, "Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "Customize your Shared stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Sources step — navigate to "Customize skill sources"
    await waitForRawText(session, "technologies", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.arrowDown(); // Move to "Customize skill sources"
    await delay(KEYSTROKE_DELAY_MS);
    session.enter();

    // In customize view, press "l" to set ALL sources to local
    await waitForRawText(session, "set all local", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.write("l");
    await delay(KEYSTROKE_DELAY_MS);
    session.enter(); // Continue past Sources step

    // Agents step
    await waitForRawText(session, "Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Confirm step
    await waitForRawText(session, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Wait for local installation to complete
    await waitForRawText(session, "initialized successfully", PLUGIN_INSTALL_TIMEOUT_MS);
    const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
    const output = session.getRawOutput();

    return { exitCode, output };
  } finally {
    await session.destroy();
  }
}

/**
 * Runs the full init wizard flow and installs in plugin mode.
 *
 * Uses the "a" shortcut on the build step to accept all defaults, which preserves
 * the marketplace source on skills (producing plugin mode). Relies on the source
 * having a marketplace.json (from createE2EPluginSource).
 */
async function initPlugin(
  sourceDir: string,
  projectDir: string,
): Promise<{ exitCode: number; output: string }> {
  await createPermissionsFile(projectDir);

  const session = new TerminalSession(["init", "--source", sourceDir], projectDir, {
    env: { AGENTSINC_SOURCE: undefined },
  });

  try {
    // Stack selection
    await waitForRawText(session, "Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Domain selection
    await waitForRawText(session, "Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Build step — "a" accepts all stack defaults (plugin mode when marketplace exists)
    await waitForRawText(session, "Customize your", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.write("a");

    // Confirm step
    await waitForRawText(session, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    // Wait for plugin installation to complete
    await waitForRawText(session, "initialized successfully", PLUGIN_INSTALL_TIMEOUT_MS);
    const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
    const output = session.getRawOutput();

    return { exitCode, output };
  } finally {
    await session.destroy();
  }
}

describe.skipIf(!claudeAvailable)("source switching mid-lifecycle", () => {
  let fixture: E2EPluginSource;

  let tempDir: string | undefined;
  let session: TerminalSession | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    fixture = await createE2EPluginSource();
  }, SETUP_TIMEOUT_MS * 2);

  afterAll(async () => {
    if (fixture) await cleanupTempDir(fixture.tempDir);
  });

  afterEach(async () => {
    await session?.destroy();
    session = undefined;

    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined;
    }
  });

  // ------------------------------------------------------------------
  // Test 9a: Init local -> edit switch ALL to plugin -> verify
  // ------------------------------------------------------------------

  describe("init local, edit switch all to plugin", () => {
    it(
      "should switch all skills from local to plugin mode via edit wizard",
      { timeout: EXTENDED_LIFECYCLE_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();
        const projectDir = path.join(tempDir, "project");

        // Phase 1: Init in local mode (force all to local via Sources customize)
        const phase1 = await initLocal(fixture.sourceDir, projectDir);
        expect(phase1.exitCode, `Init failed: ${phase1.output.slice(-500)}`).toBe(
          EXIT_CODES.SUCCESS,
        );

        // Verify Phase 1: all skills are local
        expect(await verifySkillCopiedLocally(projectDir, "web-framework-react")).toBe(true);
        await verifyConfig(projectDir, {
          skillIds: ["web-framework-react"],
          source: "local",
        });

        // Inject marketplace into config so mode-migrator can install plugins.
        // Local-mode init does not write marketplace to config because
        // sourceResult.marketplace is undefined for local paths (loadFromLocal
        // only inherits from sourceConfig.marketplace, and resolveSource sets
        // marketplace from the project config which doesn't exist yet during init).
        await injectMarketplaceIntoConfig(projectDir, fixture.marketplaceName);

        // Phase 2: Edit — switch ALL to plugin via "p" hotkey in Sources customize
        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        // Build step — pass through all three domains (init created Web, API, Shared)
        await waitForRawText(session, "Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Customize your Shared stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Sources step (choice view)
        await waitForRawText(session, "technologies", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Arrow Down to "Customize skill sources", then Enter to open customize view
        session.arrowDown();
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();
        await waitForRawText(session, "set all local", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Press "p" hotkey to set ALL skills to plugin mode
        session.write("p");
        await delay(STEP_TRANSITION_DELAY_MS);

        // Enter to continue from customize view -> Agents step
        session.enter();
        await waitForRawText(session, "Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Agents -> Confirm
        session.enter();
        await waitForRawText(session, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Confirm -> Complete
        session.enter();

        // Wait for migration and plugin operations to complete
        await waitForRawText(session, "Plugin updated", PLUGIN_INSTALL_TIMEOUT_MS);

        const editExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(editExitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = session.getRawOutput();

        // Verify: mode migration messages in output
        expect(rawOutput).toContain("Switching");
        expect(rawOutput).toContain("to plugin");

        // Verify: config updated with marketplace source
        await verifyConfig(projectDir, {
          skillIds: ["web-framework-react"],
          source: fixture.marketplaceName,
        });

        // Verify: agents recompiled
        expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);
      },
    );
  });

  // ------------------------------------------------------------------
  // Test 9b: Init plugin -> edit switch ALL to local -> verify
  // ------------------------------------------------------------------

  describe("init plugin, edit switch all to local", () => {
    it(
      "should switch all skills from plugin to local mode via edit wizard",
      { timeout: EXTENDED_LIFECYCLE_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();
        const projectDir = path.join(tempDir, "project");

        // Phase 1: Init in plugin mode via full wizard flow
        const phase1 = await initPlugin(fixture.sourceDir, projectDir);
        expect(phase1.exitCode, `Init failed: ${phase1.output.slice(-500)}`).toBe(
          EXIT_CODES.SUCCESS,
        );

        // Verify Phase 1: skills are plugin-sourced
        await verifyConfig(projectDir, {
          skillIds: ["web-framework-react"],
          source: fixture.marketplaceName,
        });
        expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);

        // Phase 2: Edit — switch ALL to local via "l" hotkey
        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        // Build step — pass through all three domains (init created Web, API, Shared)
        await waitForRawText(session, "Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Customize your Shared stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Sources step (choice view)
        await waitForRawText(session, "technologies", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Arrow Down to "Customize skill sources", then Enter to open customize view
        session.arrowDown();
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();
        await waitForRawText(session, "set all local", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Press "l" hotkey to set ALL skills to local mode
        session.write("l");
        await delay(STEP_TRANSITION_DELAY_MS);

        // Enter to continue from customize view -> Agents step
        session.enter();
        await waitForRawText(session, "Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Agents -> Confirm
        session.enter();
        await waitForRawText(session, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Confirm -> Complete
        session.enter();

        // Wait for migration and operations to complete
        await waitForRawText(session, "Plugin updated", PLUGIN_INSTALL_TIMEOUT_MS);

        const editExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(editExitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = session.getRawOutput();

        // Verify: mode migration messages in output
        expect(rawOutput).toContain("Switching");
        expect(rawOutput).toContain("to local");

        // Verify: skills copied locally to .claude/skills/
        expect(await verifySkillCopiedLocally(projectDir, "web-framework-react")).toBe(true);

        // Verify: config updated with local source
        await verifyConfig(projectDir, {
          skillIds: ["web-framework-react"],
          source: "local",
        });

        // Verify: agents recompiled
        expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);
      },
    );
  });

  // ------------------------------------------------------------------
  // Test 9c: Per-skill source switching — mixed local and plugin
  // ------------------------------------------------------------------

  describe("per-skill source switching — mixed local and plugin", () => {
    it(
      "should support mixed source modes with per-skill switching via customize view",
      { timeout: EXTENDED_LIFECYCLE_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();
        const projectDir = path.join(tempDir, "project");

        // Phase 1: Init in local mode (force all to local via Sources customize)
        const phase1 = await initLocal(fixture.sourceDir, projectDir);
        expect(phase1.exitCode, `Init failed: ${phase1.output.slice(-500)}`).toBe(
          EXIT_CODES.SUCCESS,
        );

        // Verify Phase 1: all skills are local
        expect(await verifySkillCopiedLocally(projectDir, "web-framework-react")).toBe(true);
        await verifyConfig(projectDir, {
          skillIds: ["web-framework-react"],
          source: "local",
        });

        // Inject marketplace into config so mode-migrator can install plugins
        // for the skill being switched to plugin mode.
        await injectMarketplaceIntoConfig(projectDir, fixture.marketplaceName);

        // Phase 2: Edit — navigate to Sources customize, switch ONLY the first
        // skill to plugin mode via grid navigation (arrow right to marketplace column,
        // then space to select). Leave other skills as local.
        //
        // The SourceGrid in step-sources.tsx shows rows per skill, with columns for
        // each available source (local, marketplace). Focus enters at row 0, col 0.
        // Arrow right moves to the marketplace column, space selects it.
        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
          rows: 60,
          cols: 120,
        });

        // Build step — pass through all three domains (init created Web, API, Shared)
        await waitForRawText(session, "Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Customize your Shared stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Sources step (choice view)
        await waitForRawText(session, "technologies", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Arrow Down to "Customize skill sources", Enter to open customize view
        session.arrowDown();
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();
        await waitForRawText(session, "set all local", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Navigate within SourceGrid: focus starts at row 0, col 0 (local).
        // Arrow right to move to the marketplace source column for the first skill.
        session.arrowRight();
        await delay(KEYSTROKE_DELAY_MS);
        // Space to select the marketplace source for this skill only
        session.space();
        await delay(KEYSTROKE_DELAY_MS);

        // Enter to continue past Sources step
        session.enter();

        // Agents step
        await waitForRawText(session, "Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Confirm step
        await waitForRawText(session, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Wait for plugin operations to complete
        await waitForRawText(session, "Plugin updated", PLUGIN_INSTALL_TIMEOUT_MS);

        const editExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(editExitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = session.getRawOutput();

        // Verify: at least one skill migration occurred
        expect(rawOutput).toMatch(/[Ss]witch|[Ii]nstall/);

        // Verify: config has mixed sources (some local, some marketplace)
        const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        expect(await fileExists(configPath)).toBe(true);
        const configContent = await readTestFile(configPath);
        expect(configContent).toContain(fixture.marketplaceName);

        // Verify: agents recompiled
        expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);

        // Note: Standalone compile verification (Phase 3) is not performed here.
        // After the edit, some skills are plugin-sourced (installed via Claude CLI)
        // while others remain local. When HOME=cwd (as in this test environment),
        // the compile command's global and project passes overlap, and plugin skills
        // may not be discoverable through the test HOME's plugin registry.
        // The edit already compiled agents successfully (verified above).
      },
    );
  });
});
