import path from "path";
import { stat } from "fs/promises";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { InitWizard } from "../pages/wizards/init-wizard.js";
import { EditWizard } from "../pages/wizards/edit-wizard.js";
import { TIMEOUTS, EXIT_CODES, DIRS } from "../pages/constants.js";
import { CLI } from "../fixtures/cli.js";
import "../matchers/setup.js";
import {
  CLI_ROOT,
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
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

const REAL_INSTALL_TIMEOUT = TIMEOUTS.PLUGIN_INSTALL;

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
  let wizard: InitWizard | undefined;
  let initOutput: string;

  beforeAll(async () => {
    await ensureBinaryExists();

    projectDir = await createTempDir();

    wizard = await InitWizard.launch({
      source: { sourceDir: SKILLS_SOURCE, tempDir: "" },
      projectDir,
      loadTimeout: TIMEOUTS.INSTALL,
    });
    // Real source has variable domains (Web, API, CLI, Shared), use generic path
    const domain = await wizard.stack.selectFirstStack();
    const build = await domain.acceptDefaults();
    const sources = await build.passThroughAllDomainsGeneric();
    const agents = await sources.acceptDefaults();
    const confirm = await agents.acceptDefaults("init");
    const result = await confirm.confirm();
    const exitCode = await result.exitCode;
    initOutput = result.output;
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    await result.destroy();
  }, REAL_INSTALL_TIMEOUT);

  afterAll(async () => {
    await wizard?.destroy();
    wizard = undefined;

    if (projectDir) {
      await cleanupTempDir(projectDir);
    }
  });

  describe("init with real marketplace", () => {
    it("should have rendered real stacks during stack selection", () => {
      // The CLI's built-in stacks include "Next.js Full-Stack" as the first stack
      expect(initOutput).toContain("Next.js Full-Stack");
    });

    it("should have used the real marketplace for plugin installation", () => {
      expect(initOutput).toContain("agents-inc");
    });

    it("should have created config.ts", async () => {
      await expect({ dir: projectDir }).toHaveConfig();
    });

    it("should have compiled agents with real content", async () => {
      await expect({ dir: projectDir }).toHaveCompiledAgents();
    });

    it("should have displayed completion details", () => {
      expect(initOutput).toContain("Agents compiled to:");
      expect(initOutput).toContain("Configuration:");
    });
  });

  describe("compile with real installed project", () => {
    it("should compile agents to project output directory", async () => {
      const { exitCode } = await CLI.run(
        ["compile"],
        { dir: projectDir },
        {
          env: { AGENTSINC_SOURCE: undefined },
        },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      await expect({ dir: projectDir }).toHaveCompiledAgents();
    });
  });

  describe("edit with real marketplace", () => {
    let editWizard: EditWizard | undefined;

    afterEach(async () => {
      if (editWizard) {
        editWizard.abort();
        await editWizard.waitForExit(TIMEOUTS.EXIT);
        await editWizard.destroy();
        editWizard = undefined;
      }
    });

    it("should show the build step with pre-selected skills", async () => {
      editWizard = await EditWizard.launch({
        projectDir,
        cols: 120,
        rows: 40,
      });

      const output = editWizard.build.getOutput();
      expect(output).toMatch(/Framework \*/);
    });
  });

  describe("list after real install", () => {
    it("should show installed skills and agents", async () => {
      const { exitCode, stdout } = await CLI.run(["list"], { dir: projectDir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).not.toContain("No installation found");
      expect(stdout).toMatch(/skills/i);
      expect(stdout).toMatch(/agents/i);
    });
  });
});
