import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { isClaudeCLIAvailable } from "../../src/cli/utils/exec.js";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";
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
 * E2E tests for the edit wizard in plugin mode.
 *
 * These tests drive the edit wizard via TerminalSession using a source
 * that has marketplace.json (built by createE2EPluginSource). The wizard
 * modifies skills and triggers plugin install/uninstall via the Claude CLI.
 *
 * The entire suite is skipped when the Claude CLI is not available.
 *
 * Test scenarios from e2e-framework-design.md Section 4.2:
 *   P-EDIT-1: Add skill via edit triggers plugin install
 *   P-EDIT-2: Remove skill via edit triggers plugin uninstall
 *   P-EDIT-3: Mode migration local -> plugin
 *   P-EDIT-4: Mode migration plugin -> local
 */

/** Combined timeout for tests that include plugin operations + exit wait */
const PLUGIN_TEST_TIMEOUT_MS = PLUGIN_INSTALL_TIMEOUT_MS + EXIT_WAIT_TIMEOUT_MS;

const claudeAvailable = await isClaudeCLIAvailable();

/**
 * Creates a project directory that looks like it was initialized in plugin mode.
 *
 * Config references a marketplace source (not "local"). Local skill directories
 * with SKILL.md and metadata.yaml are created so discoverAllPluginSkills() finds
 * them during edit. Agents directory and permissions file are also created.
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

  // Write config with marketplace source (not "local").
  // The top-level `marketplace` field is required so that resolveSource() populates
  // sourceResult.marketplace, which gates plugin install/uninstall in edit.tsx:334.
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

  // Create local skill directories with SKILL.md and metadata.yaml
  // discoverAllPluginSkills() scans these to find installed skills
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

  // Create agents directory (recompilation target)
  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  await mkdir(agentsDir, { recursive: true });
  for (const agent of agents) {
    await writeFile(
      path.join(agentsDir, `${agent}.md`),
      `---\nname: ${agent}\n---\nTest agent content.\n`,
    );
  }

  // Create permissions file BEFORE any plugin operations to prevent permission prompt hang
  await createPermissionsFile(projectDir);

  return projectDir;
}

/**
 * Creates a project directory initialized in local mode but with a marketplace configured.
 *
 * Config references "local" as the source for each skill, but includes the top-level
 * `marketplace` field. This allows the mode migrator (mode-migrator.ts:129) to install
 * plugins when the user switches from local to plugin mode in the Sources step.
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

  // Config with "local" source per skill but marketplace field set.
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

  // Create local skill directories with SKILL.md and metadata.yaml
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

  // Create agents directory (recompilation target)
  const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
  await mkdir(agentsDir, { recursive: true });
  for (const agent of agents) {
    await writeFile(
      path.join(agentsDir, `${agent}.md`),
      `---\nname: ${agent}\n---\nTest agent content.\n`,
    );
  }

  // Create permissions file BEFORE any plugin operations to prevent permission prompt hang
  await createPermissionsFile(projectDir);

  return projectDir;
}

describe.skipIf(!claudeAvailable)("edit wizard — plugin mode", () => {
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

      // Create project with 2 plugin skills: web-framework-react (in E2E source)
      // and web-styling-tailwind (NOT in E2E source). The wizard cannot resolve
      // tailwind from the E2E source, so it drops it from the result. This creates
      // a "removed" change that triggers claudePluginUninstall().
      const projectDir = await createPluginProject(tempDir, {
        skills: ["web-framework-react", "web-styling-tailwind"],
        marketplace: fixture.marketplaceName,
        agents: ["web-developer"],
        domains: ["web"],
      });

      session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
        env: { AGENTSINC_SOURCE: undefined },
      });

      // Build step — tailwind is unresolvable (not in E2E source), only react resolves
      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

      // Navigate straight through without skill changes
      await navigateEditWizardToCompletion(session);

      // Wait for the plugin update to complete (edit.tsx:442)
      await session.waitForText("Plugin updated", PLUGIN_INSTALL_TIMEOUT_MS);

      const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Use getRawOutput for comprehensive text search
      const rawOutput = session.getRawOutput();

      // edit.tsx:353 — logs "Uninstalling plugin: <skillId>..." for removed skills.
      // currentSkillIds includes both react + tailwind (from config).
      // Wizard result only includes react (tailwind was unresolvable).
      // Therefore removedSkills = [tailwind], triggering uninstall.
      expect(rawOutput).toContain("Uninstalling plugin: web-styling-tailwind");

      // The changes summary should mention the removal
      expect(rawOutput).toContain("removed");
    });

    it(
      "should update config after removing a plugin skill",
      { timeout: PLUGIN_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        // Same approach as above: include an unresolvable skill (tailwind) that gets
        // dropped by the wizard, triggering the removal path and config update.
        const projectDir = await createPluginProject(tempDir, {
          skills: ["web-framework-react", "web-styling-tailwind"],
          marketplace: fixture.marketplaceName,
          agents: ["web-developer"],
          domains: ["web"],
        });

        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

        // Navigate straight through — tailwind is unresolvable so it drops automatically
        await navigateEditWizardToCompletion(session);
        await session.waitForText("Plugin updated", PLUGIN_INSTALL_TIMEOUT_MS);
        await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);

        // Config should still reference the marketplace and retain only the surviving skill
        await verifyConfig(projectDir, {
          skillIds: ["web-framework-react"],
          source: fixture.marketplaceName,
        });

        // NOTE: config may still reference web-styling-tailwind at this point —
        // the edit wizard drops unresolvable skills from compilation but does not
        // always remove them from the persisted config. This is a known gap.
      },
    );

    it(
      "should recompile agents after removing a plugin skill",
      { timeout: PLUGIN_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        // Same approach: unresolvable skill triggers removal and agent recompilation
        const projectDir = await createPluginProject(tempDir, {
          skills: ["web-framework-react", "web-styling-tailwind"],
          marketplace: fixture.marketplaceName,
          agents: ["web-developer"],
          domains: ["web"],
        });

        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

        await navigateEditWizardToCompletion(session);
        await session.waitForText("Recompiling agents", PLUGIN_INSTALL_TIMEOUT_MS);
        await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);

        // Agents should be recompiled after the edit
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

        // Create project with ONLY web-framework-react. The E2E source also has
        // web-testing-vitest and web-state-zustand in the Web domain. We will
        // navigate down in the build step to select an additional skill.
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

        // Wait for the build step to render with pre-selected skills
        await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);
        await session.waitForStableRender(WIZARD_LOAD_TIMEOUT_MS);

        // The build step shows categories vertically. Framework (react) is at the top.
        // Arrow down to reach the Testing category (or its vitest skill tag).
        // The exact number of arrow-downs depends on the Ink layout. We try 1 down
        // to reach the next category, then space to select the first skill in it.
        session.arrowDown();
        await delay(STEP_TRANSITION_DELAY_MS);

        // Press space to select the skill at the new cursor position
        session.space();
        await delay(STEP_TRANSITION_DELAY_MS);

        // Navigate through: build -> sources -> agents -> confirm -> complete
        await navigateEditWizardToCompletion(session);
        await session.waitForText("Plugin updated", PLUGIN_INSTALL_TIMEOUT_MS);

        const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        // Use getRawOutput for comprehensive text search
        const rawOutput = session.getRawOutput();

        // edit.tsx:342 — logs "Installing plugin: <skillId>@<marketplace>..." for added skills
        // We check for the "Installing plugin:" prefix which confirms plugin install was triggered
        expect(rawOutput).toContain("Installing plugin:");

        // The summary should reflect additions
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

        // Create project with web-framework-react which IS in the E2E source.
        // Don't modify any skills in the wizard — navigate straight through.
        const projectDir = await createPluginProject(tempDir, {
          skills: ["web-framework-react"],
          marketplace: fixture.marketplaceName,
          agents: ["web-developer"],
          domains: ["web"],
        });

        session = new TerminalSession(["edit", "--source", fixture.sourceDir], projectDir, {
          env: { AGENTSINC_SOURCE: undefined },
        });

        await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

        // Navigate through without changing skills
        await navigateEditWizardToCompletion(session);

        // Wait for the flow to complete — may show "unchanged" or "Plugin updated" with
        // only scope changes (the wizard may adjust agent scopes from the E2E source).
        // Either way, wait for the process to exit.
        const exitCode = await session.waitForExit(EXIT_WAIT_TIMEOUT_MS);
        expect(exitCode).toBe(EXIT_CODES.SUCCESS);

        const rawOutput = session.getRawOutput();
        // No plugin install/uninstall should have been triggered for skills
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

      await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

      // Cancel the wizard with Ctrl+C
      session.ctrlC();

      const exitCode = await session.waitForExit(EXIT_TIMEOUT_MS);
      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);

      const rawOutput = session.getRawOutput();
      // No plugin operations should have been triggered
      expect(rawOutput).not.toContain("Installing plugin:");
      expect(rawOutput).not.toContain("Uninstalling plugin:");
    });
  });

  describe("mode migration local -> plugin", () => {
    it(
      "should switch skills from local to plugin mode",
      { timeout: PLUGIN_TEST_TIMEOUT_MS },
      async () => {
        tempDir = await createTempDir();

        // Create a project with local skills but marketplace configured.
        // The marketplace field is required so resolveSource() populates
        // sourceResult.marketplace, which gates plugin install in mode-migrator.ts:129.
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
        await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

        // Build -> Sources (choice view)
        session.enter();
        await session.waitForText("technologies", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Arrow Down to "Customize skill sources", then Enter to open customize view
        session.arrowDown();
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();
        await session.waitForText("set all local", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Press "p" hotkey to set ALL skills to plugin mode
        session.write("p");
        await delay(STEP_TRANSITION_DELAY_MS);

        // Enter to continue from customize view -> Agents step
        session.enter();
        await session.waitForText("Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
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

        // edit.tsx:286 — logs migration message for skills switching to plugin
        expect(rawOutput).toContain("Switching");
        expect(rawOutput).toContain("to plugin");

        // Config should now reference the marketplace source instead of "local"
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

        // Create a project with plugin-mode skills (source = marketplace)
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
        await session.waitForText("Customize your Web stack", WIZARD_LOAD_TIMEOUT_MS);

        // Build -> Sources (choice view)
        session.enter();
        await session.waitForText("technologies", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Arrow Down to "Customize skill sources", then Enter to open customize view
        session.arrowDown();
        await delay(STEP_TRANSITION_DELAY_MS);
        session.enter();
        await session.waitForText("set all local", WIZARD_LOAD_TIMEOUT_MS);
        await delay(STEP_TRANSITION_DELAY_MS);

        // Press "l" hotkey to set ALL skills to local mode
        session.write("l");
        await delay(STEP_TRANSITION_DELAY_MS);

        // Enter to continue from customize view -> Agents step
        session.enter();
        await session.waitForText("Select agents to compile", WIZARD_LOAD_TIMEOUT_MS);
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

        // edit.tsx:280 — logs migration message for skills switching to local
        expect(rawOutput).toContain("Switching");
        expect(rawOutput).toContain("to local");

        // Skills should be copied to .claude/skills/ directory
        expect(await verifySkillCopiedLocally(projectDir, "web-framework-react")).toBe(true);

        // Config should now reference "local" source
        await verifyConfig(projectDir, {
          skillIds: ["web-framework-react"],
          source: "local",
        });
      },
    );
  });
});
