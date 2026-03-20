import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CLAUDE_DIR, STANDARD_DIRS, STANDARD_FILES } from "../../src/cli/consts.js";
import { renderSkillMd } from "../../src/cli/lib/__tests__/content-generators.js";
import type { AgentName, Domain, SkillId } from "../../src/cli/types/index.js";
import { isClaudeCLIAvailable } from "../../src/cli/utils/exec.js";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import { verifyConfig, verifySkillCopiedLocally } from "../helpers/plugin-assertions.js";
import { TerminalSession } from "../helpers/terminal-session.js";
import {
  cleanupTempDir,
  createPermissionsFile,
  createTempDir,
  delay,
  ensureBinaryExists,
  EXIT_CODES,
  EXIT_WAIT_TIMEOUT_MS,
  PLUGIN_INSTALL_TIMEOUT_MS,
  SETUP_TIMEOUT_MS,
  STEP_TRANSITION_DELAY_MS,
  WIZARD_LOAD_TIMEOUT_MS,
  writeProjectConfig,
} from "../helpers/test-utils.js";

/**
 * E2E tests for the edit wizard — mode migration between local and plugin.
 *
 * Test scenarios:
 *   P-EDIT-3: Mode migration local -> plugin
 *   P-EDIT-4: Mode migration plugin -> local
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

/**
 * Creates a project directory initialized in local mode but with a marketplace configured.
 */
async function createLocalProjectWithMarketplace(
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
    name: "local-edit-test",
    marketplace: options.marketplace,
    skills: skills.map((id) => ({
      id,
      scope: "project" as const,
      source: "local",
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

describe.skipIf(!claudeAvailable)("edit wizard — plugin mode migration", () => {
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

  describe("mode migration local -> plugin", () => {
    it(
      "should switch skills from local to plugin mode",
      { timeout: PLUGIN_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        const projectDir = await createLocalProjectWithMarketplace(tempDir, {
          skills: ["web-framework-react"],
          marketplace: fixture.marketplaceName,
          agents: ["web-developer"],
          domains: ["web"],
        });

        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        // Build step
        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);

        // Build -> Sources (customize view)
        session.enter();
        await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Already in customize view — press "p" hotkey to set ALL skills to plugin mode
        session.write("p");
        await delay(STEP_TRANSITION_DELAY_MS);

        // Enter to continue from customize view -> Agents step
        session.enter();
        await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Agents -> Confirm
        session.enter();
        await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Confirm -> Complete
        session.enter();

        // Wait for migration and plugin operations to complete
        await session.waitForText("Plugin updated", PLUGIN_INSTALL_TIMEOUT_MS);

        const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = session.getRawOutput();

        expect(rawOutput).toContain("Switching");
        expect(rawOutput).toContain("to plugin");

        await verifyConfig(projectDir, {
          skillIds: ["web-framework-react"],
          source: fixture.marketplaceName,
        });
      },
    );
  });

  describe("mode migration plugin -> local", () => {
    it(
      "should switch skills from plugin to local mode",
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

        // Build step
        await session.waitForText("Web", WIZARD_LOAD_TIMEOUT_MS);

        // Build -> Sources (customize view)
        session.enter();
        await session.waitForText("Customize skill sources", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Already in customize view — press "l" hotkey to set ALL skills to local mode
        session.write("l");
        await delay(STEP_TRANSITION_DELAY_MS);

        // Enter to continue from customize view -> Agents step
        session.enter();
        await session.waitForText("Select agents", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Agents -> Confirm
        session.enter();
        await session.waitForText("Ready to install", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Confirm -> Complete
        session.enter();

        // Wait for migration and operations to complete
        await session.waitForText("Plugin updated", PLUGIN_INSTALL_TIMEOUT_MS);

        const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = session.getRawOutput();

        expect(rawOutput).toContain("Switching");
        expect(rawOutput).toContain("to local");

        expect(await verifySkillCopiedLocally(projectDir, "web-framework-react")).toBe(true);

        await verifyConfig(projectDir, {
          skillIds: ["web-framework-react"],
          source: "local",
        });
      },
    );
  });
});
