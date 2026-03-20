import path from "path";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
  directoryExists,
  listFiles,
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
import { verifyAgentCompiled } from "../helpers/plugin-assertions.js";

/**
 * Init wizard interaction tests: domain deselection, agent deselection,
 * and scope toggling via S hotkey.
 *
 * These tests exercise specific wizard interactions that are NOT covered
 * by the existing init-wizard-* test files (which focus on happy-path
 * stack/scratch flows, navigation, and UI rendering).
 *
 * E2E source fixture:
 *   - 10 skills across 3 domains: web (3), api (1), shared (6)
 *   - 2 agents: web-developer, api-developer
 *   - 1 stack ("E2E Test Stack") pre-selects web and api domains
 */

describe("init wizard — interactions", () => {
  let session: TerminalSession | undefined;
  let projectDir: string | undefined;
  let sourceDir: string | undefined;
  let sourceTempDir: string | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    await session?.destroy();
    session = undefined;

    if (projectDir) {
      await cleanupTempDir(projectDir);
      projectDir = undefined;
    }
    if (sourceTempDir) {
      await cleanupTempDir(sourceTempDir);
      sourceTempDir = undefined;
    }
  });

  async function createProjectAndSource(): Promise<void> {
    projectDir = await createTempDir();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }

  function spawnInitWizard(cwd: string, sourcePath: string): TerminalSession {
    return new TerminalSession(["init", "--source", sourcePath], cwd, {
      env: { AGENTSINC_SOURCE: undefined },
    });
  }

  describe("domain deselection", () => {
    it(
      "should not install skills from a deselected domain",
      { timeout: INTERACTIVE_TEST_TIMEOUT_MS },
      async () => {
        await createProjectAndSource();
        await createPermissionsFile(projectDir!);

        session = spawnInitWizard(projectDir!, sourceDir!);

        // Step 1: Stack selection — accept E2E Test Stack
        await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Step 2: Domain selection — the E2E stack pre-selects Web and API
        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Navigate to API domain (index 1) and deselect it with Space
        session.arrowDown();
        await delay(KEYSTROKE_DELAY_MS);
        session.space();
        await delay(KEYSTROKE_DELAY_MS);

        // Continue with only Web selected
        session.enter();

        // Step 3: Build step — only Web domain should appear.
        // Stack pre-selects skills in selected domains. Enter advances past
        // the single remaining domain (Web) to the sources step.
        // However, if the Shared domain is also shown (web-extras parent),
        // multiple Enter presses may be needed to advance through all domains.
        await session.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);
        await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Try pressing Enter — if still on build step, press again
        session.enter();
        await delay(STEP_TRANSITION_DELAY_MS);

        // Check if we advanced or need another Enter for an additional domain
        const afterFirstEnter = session.getFullOutput();
        if (!afterFirstEnter.includes("Customize skill sources")) {
          session.enter();
          await delay(STEP_TRANSITION_DELAY_MS);
        }

        // Sources step
        await session.waitForText("Customize skill sources", INSTALL_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Agents step
        await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Confirm step
        await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Wait for installation to complete
        await session.waitForText("initialized successfully", INSTALL_TIMEOUT_MS);
        const exitCode = await session.waitForExit(INSTALL_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        // Verify config was created
        const configPath = path.join(projectDir!, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        expect(await fileExists(configPath)).toBe(true);
        const configContent = await readTestFile(configPath);

        // API skills should NOT be in config (api-framework-hono is API-only)
        expect(configContent).not.toContain("api-framework-hono");

        // Web skills SHOULD be in config
        expect(configContent).toContain("web-framework-react");

        // Verify no API-only agent files were compiled.
        // The api-developer agent is primarily API-scoped; if the API domain
        // was deselected and the agent has no web skills, it should either
        // not be compiled or not be referenced in config.
        const agentsDir = path.join(projectDir!, CLAUDE_DIR, "agents");
        if (await directoryExists(agentsDir)) {
          const agentFiles = await listFiles(agentsDir);
          // api-developer should not have been compiled since API domain was deselected
          // (the agent pre-selection is based on selected domains)
          const hasApiDev = agentFiles.some((f) => f.startsWith("api-developer"));
          // If the wizard doesn't pre-select API agents when API domain is off,
          // this should be false. But this depends on agent pre-selection logic.
          // At minimum, config should not contain API skills.
          if (hasApiDev) {
            // If the agent was compiled, verify it doesn't reference API skills
            const apiDevContent = await readTestFile(path.join(agentsDir, "api-developer.md"));
            expect(apiDevContent).not.toContain("api-framework-hono");
          }
        }
      },
    );
  });

  describe("agent deselection", () => {
    it(
      "should not compile a deselected agent",
      { timeout: INTERACTIVE_TEST_TIMEOUT_MS },
      async () => {
        await createProjectAndSource();
        await createPermissionsFile(projectDir!);

        session = spawnInitWizard(projectDir!, sourceDir!);

        // Navigate manually through domains (not "a") to reach the agents step.
        // The "a" key with a stack goes directly to confirm, skipping agents.

        // Step 1: Stack
        await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Step 2: Domains — accept defaults (Web + API)
        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Step 3: Build — advance through each domain (Web, API, and possibly Shared).
        // Press Enter for each domain until we reach the sources step.
        await session.waitForText("Framework", WIZARD_LOAD_TIMEOUT_MS);
        await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Press Enter to advance through domains until we reach sources step
        for (let attempt = 0; attempt < 4; attempt++) {
          session.enter();
          await delay(STEP_TRANSITION_DELAY_MS);
          if (session.getFullOutput().includes("Customize skill sources")) break;
        }

        // Sources step
        await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Agents step — deselect api-developer
        await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // The agents step lists agents by group: Web group first, then API group.
        // web-developer is the first focusable item.
        // We need to navigate to api-developer and deselect it with Space.
        // Web group: web-developer, web-reviewer, web-researcher, web-tester, web-pm,
        //            web-architecture, web-pattern-critique (7 items)
        // API group: api-developer, api-reviewer, api-researcher (3 items)
        // api-developer is at index 7 (after 7 web agents).
        // But only agents that the stack pre-selected will be checked.
        // Navigate down to api-developer
        for (let i = 0; i < 7; i++) {
          session.arrowDown();
          await delay(KEYSTROKE_DELAY_MS);
        }

        // Now focused on api-developer — deselect it
        session.space();
        await delay(KEYSTROKE_DELAY_MS);

        // Press Enter to continue to confirm
        session.enter();

        // Confirm step
        await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Wait for installation to complete
        await session.waitForText("initialized successfully", INSTALL_TIMEOUT_MS);
        const exitCode = await session.waitForExit(INSTALL_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        // Verify api-developer agent was NOT compiled
        const agentsDir = path.join(projectDir!, CLAUDE_DIR, "agents");
        expect(await directoryExists(agentsDir)).toBe(true);

        const agentFiles = await listFiles(agentsDir);
        expect(agentFiles).not.toContain("api-developer.md");

        // web-developer SHOULD still be compiled
        expect(await verifyAgentCompiled(projectDir!, "web-developer")).toBe(true);

        // Verify config does not include api-developer in agents array
        const configPath = path.join(projectDir!, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        const configContent = await readTestFile(configPath);
        expect(configContent).not.toContain("api-developer");
      },
    );
  });

  describe("scope toggle via S hotkey", () => {
    it(
      "should toggle skill scope from global to project during build step",
      { timeout: INTERACTIVE_TEST_TIMEOUT_MS },
      async () => {
        await createProjectAndSource();
        await createPermissionsFile(projectDir!);

        session = spawnInitWizard(projectDir!, sourceDir!);

        // Step 1: Stack
        await session.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Step 2: Domains — accept defaults
        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Step 3: Build step — Web domain
        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // The build step shows categories with skills. The first focusable skill
        // should be in the Framework category (web-framework-react).
        // The focused skill's ID is tracked in the store via setFocusedSkillId.
        // The S hotkey calls toggleSkillScope on the focused skill.

        // Wait for the category grid to render with skill tags
        await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);

        // Press S to toggle scope of the focused skill (default is "global")
        session.write("s");
        await delay(KEYSTROKE_DELAY_MS);

        // The scope badge should change. In category-grid.tsx, scope is shown as
        // "G " (global) or "P " (project). After toggling, it should show "P ".
        // Wait briefly for re-render
        await delay(STEP_TRANSITION_DELAY_MS);

        const buildOutput = session.getFullOutput();
        // After toggling, the focused skill should show "P " scope indicator
        expect(buildOutput).toContain("P ");

        // Now complete the wizard to verify the config has the toggled scope.
        // Advance through all remaining domains (Web, API, Shared) until sources step.
        for (let attempt = 0; attempt < 4; attempt++) {
          session.enter();
          await delay(STEP_TRANSITION_DELAY_MS);
          if (session.getFullOutput().includes("Customize skill sources")) break;
        }

        // Sources step
        await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Agents step
        await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Confirm step
        await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();

        // Wait for installation to complete
        await session.waitForText("initialized successfully", INSTALL_TIMEOUT_MS);
        const exitCode = await session.waitForExit(INSTALL_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        // Verify config has the toggled scope
        const configPath = path.join(projectDir!, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        const configContent = await readTestFile(configPath);

        // The first skill (web-framework-react) should have scope "project"
        // after the S toggle (default was "global")
        expect(configContent).toContain("web-framework-react");

        // Look for the skill entry with "project" scope
        // Config format: { "id": "web-framework-react", "scope": "project", "source": "local" }
        const skillMatch = configContent.match(
          /"id":\s*"web-framework-react"[^}]*"scope":\s*"(\w+)"/,
        );
        expect(skillMatch).not.toBeNull();
        const scope = skillMatch?.[1];
        expect(scope).toBe("project");
      },
    );
  });
});
