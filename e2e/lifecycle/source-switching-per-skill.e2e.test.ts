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
  fileExists,
  KEYSTROKE_DELAY_MS,
  PLUGIN_INSTALL_TIMEOUT_MS,
  readTestFile,
  SETUP_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  waitForRawText,
  WIZARD_LOAD_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * Source switching lifecycle E2E tests — per-skill switching.
 *
 * Tests the full flow of switching ONE skill source mid-lifecycle:
 *   9c: Init local -> edit switch ONE skill to plugin -> verify mixed state
 *
 * These tests require the Claude CLI for plugin install/uninstall operations.
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

describe.skipIf(!claudeAvailable)("source switching mid-lifecycle — per-skill switching", () => {
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

  describe("per-skill source switching — mixed local and plugin", () => {
    it(
      "should support mixed source modes with per-skill switching via customize view",
      { timeout: EXTENDED_LIFECYCLE_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();
        const projectDir = path.join(tempDir, "project");

        // Phase 1: Init in local mode
        const phase1 = await initLocal(fixture.sourceDir, projectDir);
        expect(phase1.exitCode, `Init failed: ${phase1.output.slice(-500)}`).toBe(
          EXIT_CODES.SUCCESS,
        );

        expect(await verifySkillCopiedLocally(projectDir, "web-framework-react")).toBe(true);
        await verifyConfig(projectDir, {
          skillIds: ["web-framework-react"],
          source: "local",
        });

        // Inject marketplace into config
        await injectMarketplaceIntoConfig(projectDir, fixture.marketplaceName);

        // Phase 2: Edit — switch ONLY the first skill to plugin mode
        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
          rows: 60,
          cols: 120,
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

        // Navigate within SourceGrid: focus starts at row 0, col 0 (local).
        // Arrow right to move to the marketplace source column for the first skill.
        session.arrowRight();
        await delay(KEYSTROKE_DELAY_MS);
        // Space to select the marketplace source for this skill only
        session.space();
        await delay(KEYSTROKE_DELAY_MS);

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

        expect(rawOutput).toMatch(/[Ss]witch|[Ii]nstall/);

        const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        expect(await fileExists(configPath)).toBe(true);
        const configContent = await readTestFile(configPath);
        expect(configContent).toContain(fixture.marketplaceName);

        expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);
      },
    );
  });
});
