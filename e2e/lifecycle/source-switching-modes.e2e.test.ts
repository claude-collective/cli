import { readFile, writeFile } from "fs/promises";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import { isClaudeCLIAvailable } from "../../src/cli/utils/exec.js";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import {
  verifyAgentCompiled,
  verifyConfig,
  verifySkillCopiedLocally,
} from "../helpers/plugin-assertions.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  delay,
  ensureBinaryExists,
  EXIT_CODES,
  EXIT_WAIT_TIMEOUT_MS,
  KEYSTROKE_DELAY_MS,
  PLUGIN_INSTALL_TIMEOUT_MS,
  SETUP_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  waitForRawText,
  WIZARD_LOAD_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * Source switching lifecycle E2E tests — bulk mode switching.
 *
 * Tests the full flow of switching ALL skill sources mid-lifecycle:
 *   9a: Init local -> edit switch ALL to plugin -> verify plugin state
 *   9b: Init plugin -> edit switch ALL to local -> verify local state
 *
 * These tests require the Claude CLI for plugin install/uninstall operations.
 *
 * NOTE: All text detection uses waitForRawText() instead of session.waitForText()
 * because the xterm buffer (1000 lines) gets exceeded by relationship resolution
 * warnings during matrix loading.
 */

const claudeAvailable = await isClaudeCLIAvailable();

const EXTENDED_LIFECYCLE_TIMEOUT_MS = 300_000;

/**
 * Injects the marketplace field into an existing config.ts.
 */
async function injectMarketplaceIntoConfig(
  projectDir: string,
  marketplaceName: string,
): Promise<void> {
  const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
  const content = await readFile(configPath, "utf-8");

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
    await waitForRawText(session, "Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "Customize your Shared stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);

    // Already in customize view
    await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.write("l");
    await delay(KEYSTROKE_DELAY_MS);
    session.enter();

    await waitForRawText(session, "Select agents", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

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
    await waitForRawText(session, "Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "Customize your", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.write("a");

    await waitForRawText(session, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    session.enter();

    await waitForRawText(session, "initialized successfully", PLUGIN_INSTALL_TIMEOUT_MS);
    const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
    const output = session.getRawOutput();

    return { exitCode, output };
  } finally {
    await session.destroy();
  }
}

describe.skipIf(!claudeAvailable)("source switching mid-lifecycle — bulk mode switching", () => {
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

  describe("init local, edit switch all to plugin", () => {
    it(
      "should switch all skills from local to plugin mode via edit wizard",
      { timeout: EXTENDED_LIFECYCLE_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();
        const projectDir = path.join(tempDir, "project");

        // Phase 1: Init in local mode
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
        await injectMarketplaceIntoConfig(projectDir, fixture.marketplaceName);

        // Phase 2: Edit — switch ALL to plugin via "p" hotkey
        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        await waitForRawText(session, "Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Customize your Shared stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Already in customize view
        await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        session.write("p");
        await delay(STEP_TRANSITION_DELAY_MS);

        session.enter();
        await waitForRawText(session, "Select agents", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        session.enter();
        await waitForRawText(session, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        session.enter();

        await waitForRawText(session, "Plugin updated", PLUGIN_INSTALL_TIMEOUT_MS);

        const editExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(editExitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = session.getRawOutput();

        expect(rawOutput).toContain("Switching");
        expect(rawOutput).toContain("to plugin");

        await verifyConfig(projectDir, {
          skillIds: ["web-framework-react"],
          source: fixture.marketplaceName,
        });

        expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);
      },
    );
  });

  describe("init plugin, edit switch all to local", () => {
    it(
      "should switch all skills from plugin to local mode via edit wizard",
      { timeout: EXTENDED_LIFECYCLE_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();
        const projectDir = path.join(tempDir, "project");

        // Phase 1: Init in plugin mode
        const phase1 = await initPlugin(fixture.sourceDir, projectDir);
        expect(phase1.exitCode, `Init failed: ${phase1.output.slice(-500)}`).toBe(
          EXIT_CODES.SUCCESS,
        );

        await verifyConfig(projectDir, {
          skillIds: ["web-framework-react"],
          source: fixture.marketplaceName,
        });
        expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);

        // Phase 2: Edit — switch ALL to local via "l" hotkey
        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        await waitForRawText(session, "Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Customize your API stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Customize your Shared stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Already in customize view
        await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        session.write("l");
        await delay(STEP_TRANSITION_DELAY_MS);

        session.enter();
        await waitForRawText(session, "Select agents", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        session.enter();
        await waitForRawText(session, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        session.enter();

        await waitForRawText(session, "Plugin updated", PLUGIN_INSTALL_TIMEOUT_MS);

        const editExitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(editExitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = session.getRawOutput();

        expect(rawOutput).toContain("Switching");
        expect(rawOutput).toContain("to local");

        expect(await verifySkillCopiedLocally(projectDir, "web-framework-react")).toBe(true);

        await verifyConfig(projectDir, {
          skillIds: ["web-framework-react"],
          source: "local",
        });

        expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);
      },
    );
  });
});
