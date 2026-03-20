import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { isClaudeCLIAvailable } from "../../src/cli/utils/exec.js";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import { verifyConfig, verifyAgentCompiled } from "../helpers/plugin-assertions.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  createPermissionsFile,
  writeProjectConfig,
  navigateEditWizardToCompletion,
  delay,
  WIZARD_LOAD_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  EXIT_TIMEOUT_MS,
  EXIT_CODES,
  PLUGIN_INSTALL_TIMEOUT_MS,
  EXIT_WAIT_TIMEOUT_MS,
  SETUP_TIMEOUT_MS,
} from "../helpers/test-utils.js";
import { renderSkillMd } from "../../src/cli/lib/__tests__/content-generators.js";
import type { AgentName, Domain, SkillId } from "../../src/cli/types/index.js";

/**
 * E2E tests for the edit wizard in plugin mode — skill install/uninstall
 * and cancellation.
 *
 * Test scenarios:
 *   P-EDIT-1: Add skill via edit triggers plugin install
 *   P-EDIT-2: Remove skill via edit triggers plugin uninstall
 *   + No-change completion
 *   + Cancellation safety
 *
 * The entire suite is skipped when the Claude CLI is not available.
 */

/** Combined timeout for tests that include plugin operations + exit wait */
const PLUGIN_TEST_TIMEOUT_MS = PLUGIN_INSTALL_TIMEOUT_MS + EXIT_WAIT_TIMEOUT_MS;

const claudeAvailable = await isClaudeCLIAvailable();

/**
 * Creates a project directory that looks like it was initialized in plugin mode.
 */
async function createPluginProject(
  tempDir: string,
  options: {
    skills: SkillId[];
    marketplace: string;
    agents?: AgentName[];
    domains?: Domain[];
  },
): Promise<string> {
  const projectDir = path.join(tempDir, "project");
  const skills = options.skills;
  const agents = options.agents ?? ["web-developer"];
  const domains = options.domains ?? ["web"];

  await writeProjectConfig(projectDir, {
    name: "plugin-edit-test",
    marketplace: options.marketplace,
    skills: skills.map((id) => ({
      id,
      scope: "project" as const,
      source: options.marketplace,
    })),
    agents: agents.map((name) => ({ name, scope: "project" as const })),
    domains,
  });

  for (const skillId of skills) {
    const skillDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, skillId);
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd(skillId, "Test skill", `# ${skillId}`),
    );
    const parts = skillId.split("-");
    const category = parts.slice(0, 2).join("-");
    const slug = parts.slice(2).join("-") || skillId;
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      `author: "@test"\ndisplayName: ${skillId}\ncategory: ${category}\nslug: ${slug}\ncontentHash: "e2e-hash-${skillId}"\n`,
    );
  }

  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  await mkdir(agentsDir, { recursive: true });
  for (const agent of agents) {
    await writeFile(
      path.join(agentsDir, `${agent}.md`),
      `---\nname: ${agent}\n---\nTest agent content.\n`,
    );
  }

  await createPermissionsFile(projectDir);

  return projectDir;
}

describe.skipIf(!claudeAvailable)("edit wizard — plugin mode operations", () => {
  let fixture: E2EPluginSource;

  let tempDir: string | undefined;
  let session: TerminalSession | undefined;

  beforeAll(async () => {
    await ensureBinaryExists();
    fixture = await createE2EPluginSource();
  }, SETUP_TIMEOUT_MS);

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

  describe("remove skill triggers plugin uninstall", () => {
    it("should uninstall removed plugin skills", { timeout: PLUGIN_TEST_TIMEOUT_MS }, async () => {
      tempDir = await createTempDir();

      const projectDir = await createPluginProject(tempDir, {
        skills: ["web-framework-react", "web-styling-tailwind"],
        marketplace: fixture.marketplaceName,
        agents: ["web-developer"],
        domains: ["web"],
      });

      session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
        env: { AGENTSINC_SOURCE: undefined },
      });

      await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);

      await navigateEditWizardToCompletion(session);

      await session.waitForText("Plugin updated", PLUGIN_INSTALL_TIMEOUT_MS);

      const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      const rawOutput = session.getRawOutput();

      expect(rawOutput).toContain("Uninstalling plugin: web-styling-tailwind");

      expect(rawOutput).toContain("removed");
    });

    it(
      "should update config after removing a plugin skill",
      { timeout: PLUGIN_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        const projectDir = await createPluginProject(tempDir, {
          skills: ["web-framework-react", "web-styling-tailwind"],
          marketplace: fixture.marketplaceName,
          agents: ["web-developer"],
          domains: ["web"],
        });

        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);

        await navigateEditWizardToCompletion(session);
        await session.waitForText("Plugin updated", PLUGIN_INSTALL_TIMEOUT_MS);
        await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);

        await verifyConfig(projectDir, {
          skillIds: ["web-framework-react"],
          source: fixture.marketplaceName,
        });
      },
    );

    it(
      "should recompile agents after removing a plugin skill",
      { timeout: PLUGIN_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        const projectDir = await createPluginProject(tempDir, {
          skills: ["web-framework-react", "web-styling-tailwind"],
          marketplace: fixture.marketplaceName,
          agents: ["web-developer"],
          domains: ["web"],
        });

        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);

        await navigateEditWizardToCompletion(session);
        await session.waitForText("Recompiling agents", PLUGIN_INSTALL_TIMEOUT_MS);
        await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);

        expect(await verifyAgentCompiled(projectDir, "web-developer")).toBe(true);
      },
    );
  });

  describe("add skill triggers plugin install", () => {
    it(
      "should install added plugin skills when navigating to a new skill",
      { timeout: PLUGIN_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        const projectDir = await createPluginProject(tempDir, {
          skills: ["web-framework-react"],
          marketplace: fixture.marketplaceName,
          agents: ["web-developer"],
          domains: ["web"],
        });

        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
          rows: 60,
          cols: 120,
        });

        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);
        await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);

        session.arrowDown();
        await delay(STEP_TRANSITION_DELAY_MS);

        session.space();
        await delay(STEP_TRANSITION_DELAY_MS);

        await navigateEditWizardToCompletion(session);
        await session.waitForText("Plugin updated", PLUGIN_INSTALL_TIMEOUT_MS);

        const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = session.getRawOutput();

        expect(rawOutput).toContain("Installing plugin:");

        expect(rawOutput).toMatch(/\d+ added/);
      },
    );
  });

  describe("plugin mode completion without skill changes", () => {
    it(
      "should complete edit without triggering plugin install/uninstall when skills are unchanged",
      { timeout: PLUGIN_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        const projectDir = await createPluginProject(tempDir, {
          skills: ["web-framework-react"],
          marketplace: fixture.marketplaceName,
          agents: ["web-developer"],
          domains: ["web"],
        });

        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);

        await navigateEditWizardToCompletion(session);

        const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = session.getRawOutput();
        expect(rawOutput).not.toContain("Installing plugin:");
        expect(rawOutput).not.toContain("Uninstalling plugin:");
      },
    );
  });

  describe("cancellation in plugin mode", () => {
    it("should not trigger plugin install/uninstall when cancelled", async () => {
      tempDir = await createTempDir();

      const projectDir = await createPluginProject(tempDir, {
        skills: ["web-framework-react", "web-testing-vitest"],
        marketplace: fixture.marketplaceName,
        agents: ["web-developer"],
        domains: ["web"],
      });

      session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
        env: { AGENTSINC_SOURCE: undefined },
      });

      await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);

      session.ctrlC();

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);

      const rawOutput = session.getRawOutput();
      expect(rawOutput).not.toContain("Installing plugin:");
      expect(rawOutput).not.toContain("Uninstalling plugin:");
    });
  });
});
