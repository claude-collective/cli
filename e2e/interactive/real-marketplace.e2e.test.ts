import path from "path";
import { stat } from "fs/promises";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  CLI_ROOT,
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  createPermissionsFile,
  fileExists,
  directoryExists,
  listFiles,
  readTestFile,
  runCLI,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  INSTALL_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  EXIT_TIMEOUT_MS,
  EXIT_CODES,
} from "../helpers/test-utils.js";

/**
 * E2E tests using the REAL local skills repository.
 *
 * These tests verify the full end-to-end flow with actual marketplace data
 * instead of the synthetic E2E test source. They use --source pointed at the
 * local clone to avoid network calls while still exercising real skill content.
 *
 * Set SKILLS_SOURCE env var to override the default location. The suite is
 * automatically skipped when the directory is absent (e.g. on CI or other
 * machines).
 *
 * A single beforeAll runs the full init flow once; subsequent tests verify
 * different aspects of the installed project.
 */

// Resolve the skills repo: env override, or sibling to the git toplevel
const SKILLS_SOURCE = process.env.SKILLS_SOURCE ?? path.resolve(CLI_ROOT, "../skills");

const REAL_INSTALL_TIMEOUT_MS = 60_000;

async function skillsSourceExists(): Promise<boolean> {
  try {
    const s = await stat(path.join(SKILLS_SOURCE, "src", "skills"));
    return s.isDirectory();
  } catch {
    return false;
  }
}

const hasSkillsSource = await skillsSourceExists();

describe.skipIf(!hasSkillsSource)("real marketplace", () => {
  let projectDir: string;
  let initSession: TerminalSession | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();

    projectDir = await createTempDir();
    await createPermissionsFile(projectDir);

    initSession = new TerminalSession(
      ["init", "--source", SKILLS_SOURCE],
      projectDir,
      { env: { AGENTSINC_SOURCE: undefined } },
    );

    // Step 1: Stack selection
    await initSession.waitForText("Choose a stack", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    initSession.enter();

    // Step 2: Domain selection (pre-populated from stack)
    await initSession.waitForText("Select domains to configure", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    initSession.enter();

    // Step 3: Build step -- accept stack defaults
    await initSession.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    initSession.write("a");

    // Step 4: Confirmation
    await initSession.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
    await delay(STEP_TRANSITION_DELAY_MS);
    initSession.enter();

    // Wait for installation to complete
    await initSession.waitForText("initialized successfully", REAL_INSTALL_TIMEOUT_MS);
    await initSession.waitForExit(REAL_INSTALL_TIMEOUT_MS);
  }, REAL_INSTALL_TIMEOUT_MS);

  afterAll(async () => {
    await initSession?.destroy();
    initSession = undefined;

    if (projectDir) {
      await cleanupTempDir(projectDir);
    }
  });

  describe("init with real marketplace", () => {
    it("should have rendered real stacks during stack selection", () => {
      const fullOutput = initSession!.getFullOutput();

      // The CLI's built-in stacks include "Next.js Fullstack" as the first stack
      expect(fullOutput).toContain("Next.js Fullstack");
    });

    it("should have shown the marketplace label", () => {
      const fullOutput = initSession!.getFullOutput();

      // The marketplace label comes from .claude-plugin/marketplace.json
      // or falls back to source name display
      expect(fullOutput).toContain("Marketplace:");
    });

    it("should have created config.yaml", async () => {
      const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);
      expect(await fileExists(configPath)).toBe(true);

      const content = await readTestFile(configPath);
      expect(content).toContain("installMode:");
    });

    it("should have compiled agents with real content", async () => {
      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      expect(await directoryExists(agentsDir)).toBe(true);

      const agentFiles = await listFiles(agentsDir);
      const mdFiles = agentFiles.filter((f) => f.endsWith(".md"));
      expect(mdFiles.length).toBeGreaterThan(0);

      // At least one agent should have substantial content (real skills compiled in)
      const MIN_REAL_AGENT_LENGTH = 500;
      let hasSubstantialAgent = false;
      for (const mdFile of mdFiles) {
        const content = await readTestFile(path.join(agentsDir, mdFile));
        if (content.length > MIN_REAL_AGENT_LENGTH) {
          hasSubstantialAgent = true;
          break;
        }
      }
      expect(hasSubstantialAgent).toBe(true);
    });

    it("should have displayed completion details", () => {
      const fullOutput = initSession!.getFullOutput();
      expect(fullOutput).toContain("Agents compiled to:");
      expect(fullOutput).toContain("Configuration:");
    });
  });

  describe("compile with real installed project", () => {
    it("should compile agents to a custom output directory", async () => {
      const outputDir = path.join(projectDir, "compile-output");

      const { exitCode, stdout } = await runCLI(
        ["compile", "--output", outputDir],
        projectDir,
        { env: { AGENTSINC_SOURCE: undefined } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Custom output compile complete!");

      const outputFiles = await listFiles(outputDir);
      const mdFiles = outputFiles.filter((f) => f.endsWith(".md"));
      expect(mdFiles.length).toBeGreaterThan(0);
    });

    it("should produce agents with real skill content", async () => {
      const outputDir = path.join(projectDir, "compile-verify");

      const { exitCode } = await runCLI(
        ["compile", "--output", outputDir],
        projectDir,
        { env: { AGENTSINC_SOURCE: undefined } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const outputFiles = await listFiles(outputDir);
      const mdFiles = outputFiles.filter((f) => f.endsWith(".md"));

      // Read a compiled agent and verify it has real skill text
      // The first stack is "Next.js Fullstack" which includes web-framework-react
      const MIN_REAL_CONTENT_LENGTH = 1000;
      let foundRealContent = false;
      for (const mdFile of mdFiles) {
        const content = await readTestFile(path.join(outputDir, mdFile));

        // Real agents should have YAML frontmatter + substantial body
        if (content.startsWith("---") && content.length > MIN_REAL_CONTENT_LENGTH) {
          foundRealContent = true;
          break;
        }
      }
      expect(foundRealContent).toBe(true);
    });
  });

  describe("edit with real marketplace", () => {
    it("should show the build step with pre-selected skills", async () => {
      const session = new TerminalSession(["edit"], projectDir, {
        rows: 40,
        cols: 120,
      });

      try {
        await session.waitForText("Customize your", WIZARD_LOAD_TIMEOUT_MS);

        const screen = session.getScreen();
        // The build step should show pre-selected skill categories with asterisk indicator
        // e.g. "Framework *" means the category has pre-selected skills
        expect(screen).toMatch(/Framework \*/);
      } finally {
        session.ctrlC();
        await session.waitForExit(EXIT_TIMEOUT_MS);
        await session.destroy();
      }
    });
  });

  describe("list after real install", () => {
    it("should show installed skills and agents", async () => {
      const { exitCode, stdout } = await runCLI(["list"], projectDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // Should NOT show "No installation found"
      expect(stdout).not.toContain("No installation found");
      // Should show installation details with both skills and agents
      expect(stdout).toMatch(/skills/i);
      expect(stdout).toMatch(/agents/i);
    });
  });
});
