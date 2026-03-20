import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import { isClaudeCLIAvailable } from "../../src/cli/utils/exec.js";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import { verifyAgentCompiled, verifySkillCopiedLocally } from "../helpers/plugin-assertions.js";
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
  SETUP_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  waitForRawText,
  WIZARD_LOAD_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * Scope-aware local skill copying E2E tests.
 *
 * These tests verify that local skill copies respect per-skill scope:
 *   - Project-scoped local skills -> <project>/.claude/skills/
 *   - Global-scoped local skills  -> ~/.claude/skills/
 *
 * Bug 1: Init mixed mode ignored scope for local copies (all went to project dir)
 * Bug 2: executeMigration in mode-migrator.ts ignored scope for copy/delete
 *
 * All tests require the Claude CLI for plugin install/uninstall operations.
 *
 * Architecture:
 *   tempDir/
 *     fake-home/                          <- HOME env var
 *       .claude/skills/<skillId>/         <- global-scoped local skills
 *       .claude-src/config.ts             <- global config
 *       project/                          <- CWD for init/edit
 *         .claude/skills/<skillId>/       <- project-scoped local skills
 *         .claude-src/config.ts           <- project config
 */

const claudeAvailable = await isClaudeCLIAvailable();

const EXTENDED_LIFECYCLE_TIMEOUT_MS = 300_000;

/**
 * Injects the marketplace field into an existing config.ts.
 */
async function injectMarketplaceIntoConfig(
  configDir: string,
  marketplaceName: string,
): Promise<void> {
  const configPath = path.join(configDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
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

describe.skipIf(!claudeAvailable)("scope-aware local skill copying", () => {
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

  describe("init mixed mode — scope-aware local copy", () => {
    /**
     * Test 1: Init mixed mode with global-scoped and project-scoped local skills.
     *
     * When installMode is "mixed" (some local, some plugin):
     *   - Project-scoped local skills -> <project>/.claude/skills/
     *   - Global-scoped local skills  -> ~/.claude/skills/
     *
     * Navigation:
     *   Stack -> Domains -> Build (toggle first skill to project scope) ->
     *   Sources (set first skill to local — one local project-scoped, rest plugin) ->
     *   Agents -> Confirm -> Complete
     *
     * After the fix, the init.tsx mixed mode branch splits local skills by scope
     * and copies them to the correct directory.
     */
    it(
      "should copy project-scoped local skills to project dir and global-scoped local skills to HOME dir",
      { timeout: EXTENDED_LIFECYCLE_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();
        const fakeHome = path.join(tempDir, "fake-home");
        const projectDir = path.join(fakeHome, "project");

        await mkdir(fakeHome, { recursive: true });
        await mkdir(projectDir, { recursive: true });
        await createPermissionsFile(fakeHome);
        await createPermissionsFile(projectDir);

        session = new TerminalSession(["init", "--source", fixture.sourceDir], projectDir, {
          env: {
            HOME: fakeHome,
            AGENTSINC_SOURCE: undefined,
          },
          rows: 60,
          cols: 120,
        });

        // Step 1: Stack selection — accept first stack
        // Source loading may include fetching the public source (git clone) on first run,
        // so we use the plugin install timeout which is generous enough.
        await waitForRawText(session, "Choose a stack", PLUGIN_INSTALL_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Step 2: Domain selection — accept defaults
        await waitForRawText(session, "Web", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Step 3: Build — Web domain.
        // Focus starts on first skill (web-framework-react), default scope is "global".
        // Press "s" to toggle to "project" scope.
        await waitForRawText(session, "Web", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.write("s"); // Toggle web-framework-react to project scope
        await delay(KEYSTROKE_DELAY_MS);

        // Move to second skill (web-testing-vitest) — leave at global scope
        session.arrowDown();
        await delay(KEYSTROKE_DELAY_MS);

        // Advance through remaining domains
        session.enter();
        await waitForRawText(session, "API", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Shared", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Step 4: Sources customize view.
        // We need to create MIXED mode: some local, some plugin.
        // Set first TWO skills to local (one project-scoped, one global-scoped),
        // leave the rest as plugin.
        //
        // SourceGrid focus enters at row 0, col 0 (the "local" option of first skill).
        // Space to select "local" for first skill (web-framework-react, project-scoped).
        await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        session.space(); // Set web-framework-react to local
        await delay(KEYSTROKE_DELAY_MS);

        // Move down to second skill (web-testing-vitest, global-scoped) and set to local
        session.arrowDown();
        await delay(KEYSTROKE_DELAY_MS);
        session.space(); // Set web-testing-vitest to local
        await delay(KEYSTROKE_DELAY_MS);

        // Enter to proceed past Sources
        session.enter();

        // Step 5: Agents — accept defaults
        await waitForRawText(session, "Select agents", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Step 6: Confirm
        await waitForRawText(session, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Wait for installation to complete
        await waitForRawText(session, "initialized successfully", PLUGIN_INSTALL_TIMEOUT_MS);
        const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = session.getRawOutput();

        // Should be mixed mode (some local, some plugin)
        expect(rawOutput).toContain("Mixed");

        // --- Scope-aware copy assertions ---

        // Project-scoped local skill (web-framework-react) should be in PROJECT dir
        const projectSkillExists = await verifySkillCopiedLocally(
          projectDir,
          "web-framework-react",
        );
        expect(projectSkillExists, "Project-scoped skill must be in project .claude/skills/").toBe(
          true,
        );

        // Global-scoped local skill (web-testing-vitest) should be in HOME dir
        const globalSkillExists = await verifySkillCopiedLocally(fakeHome, "web-testing-vitest");
        expect(globalSkillExists, "Global-scoped skill must be in HOME .claude/skills/").toBe(true);

        // Cross-check: project skill should NOT be in HOME dir
        const projectSkillWrongLocation = await verifySkillCopiedLocally(
          fakeHome,
          "web-framework-react",
        );
        expect(
          projectSkillWrongLocation,
          "Project-scoped skill must NOT be in HOME .claude/skills/",
        ).toBe(false);

        // Cross-check: global skill should NOT be in project dir
        const globalSkillWrongLocation = await verifySkillCopiedLocally(
          projectDir,
          "web-testing-vitest",
        );
        expect(
          globalSkillWrongLocation,
          "Global-scoped skill must NOT be in project .claude/skills/",
        ).toBe(false);

        // Agents should be compiled
        expect(await verifyAgentCompiled(fakeHome, "web-developer")).toBe(true);
      },
    );
  });

  describe("edit source switch — scope-aware migration", () => {
    /**
     * Test 2: Edit source switch (plugin → local) with global scope.
     *
     * Phase 1: Init in plugin mode (default global scope for all skills).
     * Phase 2: Edit — switch ALL to local via "l" hotkey.
     *
     * After the fix, executeMigration() copies to ~/.claude/skills/ for
     * global-scope skills (not project dir).
     */
    it(
      "should copy to HOME when switching global-scope skill from plugin to local",
      { timeout: EXTENDED_LIFECYCLE_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();
        const fakeHome = path.join(tempDir, "fake-home");
        const projectDir = path.join(fakeHome, "project");

        await mkdir(fakeHome, { recursive: true });
        await mkdir(projectDir, { recursive: true });
        await createPermissionsFile(fakeHome);
        await createPermissionsFile(projectDir);

        // Phase 1: Init in plugin mode — all skills global scope, plugin source
        const initSession = new TerminalSession(
          ["init", "--source", fixture.sourceDir],
          projectDir,
          {
            env: {
              HOME: fakeHome,
              AGENTSINC_SOURCE: undefined,
            },
          },
        );

        try {
          await waitForRawText(initSession, "Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          initSession.enter();

          await waitForRawText(initSession, "Web", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          initSession.enter();

          // Build — accept all defaults (all skills global scope, default plugin source)
          await waitForRawText(initSession, "Framework", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          initSession.write("a");

          await waitForRawText(initSession, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          initSession.enter();

          await waitForRawText(initSession, "initialized successfully", PLUGIN_INSTALL_TIMEOUT_MS);
          const initExitCode = await initSession.waitForExit(EXIT_WAIT_TIMEOUT_MS);
          expect(initExitCode).toBe(EXIT_CODES.SUCCESS);
        } finally {
          await initSession.destroy();
        }

        // Phase 2: Edit — switch ALL to local via "l" hotkey
        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: {
            HOME: fakeHome,
            AGENTSINC_SOURCE: undefined,
          },
          rows: 60,
          cols: 120,
        });

        await waitForRawText(session, "Web", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "API", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Shared", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        session.write("l"); // Switch ALL to local
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

        // --- Assertions ---
        // All skills were global scope (default), so local copies should go to HOME
        const globalSkillExists = await verifySkillCopiedLocally(fakeHome, "web-framework-react");
        expect(
          globalSkillExists,
          "Global-scoped skill must be copied to HOME .claude/skills/ after plugin→local switch",
        ).toBe(true);

        // Skill should NOT be in the project dir (it's global-scoped)
        const projectSkillExists = await verifySkillCopiedLocally(
          projectDir,
          "web-framework-react",
        );
        expect(
          projectSkillExists,
          "Global-scoped skill must NOT be in project .claude/skills/",
        ).toBe(false);

        // Agents should still be compiled
        expect(await verifyAgentCompiled(fakeHome, "web-developer")).toBe(true);
      },
    );

    /**
     * Test 3: Edit source switch (local → plugin) with global scope.
     *
     * Phase 1: Init in local mode with all skills global scope.
     *          Skills go to ~/.claude/skills/.
     * Phase 2: Edit — switch ALL to plugin via "p" hotkey.
     *
     * After the fix, executeMigration() deletes from ~/.claude/skills/ for
     * global-scope skills (not project dir).
     */
    it(
      "should delete from HOME when switching global-scope skill from local to plugin",
      { timeout: EXTENDED_LIFECYCLE_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();
        const fakeHome = path.join(tempDir, "fake-home");
        const projectDir = path.join(fakeHome, "project");

        await mkdir(fakeHome, { recursive: true });
        await mkdir(projectDir, { recursive: true });
        await createPermissionsFile(fakeHome);
        await createPermissionsFile(projectDir);

        // Phase 1: Init in local mode — all skills global scope
        const initSession = new TerminalSession(
          ["init", "--source", fixture.sourceDir],
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
          await waitForRawText(initSession, "Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          initSession.enter();

          await waitForRawText(initSession, "Web", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          initSession.enter();

          // Build — advance through each domain
          await waitForRawText(initSession, "Web", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          initSession.enter();

          await waitForRawText(initSession, "API", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          initSession.enter();

          await waitForRawText(initSession, "Shared", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          initSession.enter();

          // Sources — set ALL to local
          await waitForRawText(initSession, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          await waitForRawText(initSession, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          initSession.write("l"); // Set ALL to local
          await delay(KEYSTROKE_DELAY_MS);
          initSession.enter();

          // Agents — accept defaults
          await waitForRawText(initSession, "Select agents", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          initSession.enter();

          // Confirm
          await waitForRawText(initSession, "Ready to install", WIZARD_LOAD_TIMEOUT_MS);
          await delay(STEP_TRANSITION_DELAY_MS);
          initSession.enter();

          await waitForRawText(initSession, "initialized successfully", PLUGIN_INSTALL_TIMEOUT_MS);
          const initExitCode = await initSession.waitForExit(EXIT_WAIT_TIMEOUT_MS);
          expect(initExitCode).toBe(EXIT_CODES.SUCCESS);
        } finally {
          await initSession.destroy();
        }

        // Verify Phase 1: Skills were copied to HOME (global scope default)
        const preEditSkillExists = await verifySkillCopiedLocally(fakeHome, "web-framework-react");
        expect(
          preEditSkillExists,
          "Pre-edit: global-scoped skill should be in HOME .claude/skills/",
        ).toBe(true);

        // Inject marketplace so mode-migrator can install plugins
        // The global config is at fakeHome/.claude-src/config.ts when all skills are global
        const globalConfigPath = path.join(fakeHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        const globalConfigExists = await fileExists(globalConfigPath);

        // Config may be at project or global level depending on writeScopedConfigs behavior
        // with all-global skills. Try both locations.
        const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        const projectConfigExists = await fileExists(projectConfigPath);

        if (globalConfigExists) {
          await injectMarketplaceIntoConfig(fakeHome, fixture.marketplaceName);
        }
        if (projectConfigExists) {
          await injectMarketplaceIntoConfig(projectDir, fixture.marketplaceName);
        }

        // Phase 2: Edit — switch ALL to plugin via "p" hotkey
        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: {
            HOME: fakeHome,
            AGENTSINC_SOURCE: undefined,
          },
          rows: 60,
          cols: 120,
        });

        await waitForRawText(session, "Web", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "API", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Shared", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        await waitForRawText(session, "Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        session.write("p"); // Switch ALL to plugin
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

        // --- Assertions ---
        // The local skill was global-scoped, so it should have been DELETED from HOME
        const postEditSkillExists = await verifySkillCopiedLocally(fakeHome, "web-framework-react");
        expect(
          postEditSkillExists,
          "Global-scoped skill must be DELETED from HOME .claude/skills/ after local→plugin switch",
        ).toBe(false);

        // Skill should also NOT be in the project dir
        const projectSkillExists = await verifySkillCopiedLocally(
          projectDir,
          "web-framework-react",
        );
        expect(
          projectSkillExists,
          "Skill must NOT be in project .claude/skills/ after local→plugin switch",
        ).toBe(false);

        // Agents should still be compiled
        expect(await verifyAgentCompiled(fakeHome, "web-developer")).toBe(true);
      },
    );
  });
});
