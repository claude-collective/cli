import path from "path";
import os from "os";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import "../matchers/setup.js";
import {
  isClaudeCLIAvailable,
  claudePluginMarketplaceAdd,
  claudePluginInstall,
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  directoryExists,
  listFiles,
  renderSkillMd,
  writeProjectConfig,
  agentsPath,
  skillsPath,
  FORKED_FROM_METADATA,
} from "../helpers/test-utils.js";
import { EXIT_CODES, DIRS, FILES } from "../pages/constants.js";
import { CLI } from "../fixtures/cli.js";

/**
 * Plugin-mode uninstall E2E tests — core cleanup with Claude CLI.
 *
 * P-UNINSTALL-1: Full plugin chain uninstall with Claude CLI
 *   - Builds a plugin source, registers marketplace, installs a plugin,
 *     sets up config, then runs `uninstall --yes` and verifies cleanup.
 *
 * Reference: e2e-framework-design.md, Section 4.3
 */

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)("uninstall with plugins calls Claude CLI", () => {
  let fixture: E2EPluginSource;
  let projectDir: string;
  let projectTempDir: string;
  // Real HOME is needed so the CLI can find the plugin registry at
  // ~/.claude/plugins/installed_plugins.json (written by claudePluginInstall).
  const realHome = process.env.HOME || os.homedir();

  beforeAll(async () => {
    await ensureBinaryExists();

    // Step 1: Build plugin source (source -> build plugins -> build marketplace)
    fixture = await createE2EPluginSource();

    // Step 2: Create an isolated project directory
    projectTempDir = await createTempDir();
    projectDir = path.join(projectTempDir, "project");
    await mkdir(projectDir, { recursive: true });

    // Step 3: Register marketplace with Claude CLI
    await claudePluginMarketplaceAdd(fixture.sourceDir);

    // Step 4: Install a plugin via Claude CLI
    const pluginRef = `web-framework-react@${fixture.marketplaceName}`;
    await claudePluginInstall(pluginRef, "project", projectDir);

    // Step 5: Create config.ts referencing the installed plugin
    await writeProjectConfig(projectDir, {
      name: "plugin-uninstall-test",
      skills: [
        {
          id: "web-framework-react",
          scope: "project",
          source: fixture.marketplaceName,
        },
      ],
      agents: [{ name: "web-developer", scope: "project" }],
      domains: ["web"],
    });

    // Step 6: Create local skill with forkedFrom metadata (so skill uninstall works)
    const skillDir = path.join(projectDir, DIRS.CLAUDE, DIRS.SKILLS, "web-framework-react");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React\n\nTest content."),
    );
    await writeFile(path.join(skillDir, FILES.METADATA_YAML), FORKED_FROM_METADATA);

    // Step 7: Create agents directory
    const agentsDir = agentsPath(projectDir);
    await mkdir(agentsDir, { recursive: true });
    await writeFile(path.join(agentsDir, "web-developer.md"), "---\nname: web-developer\n---\n");

    // Note: No createPermissionsFile() here. The claudePluginInstall() call
    // in Step 4 creates .claude/settings.json with enabledPlugins. We must
    // not overwrite it with a permissions-only file.
  }, 120_000);

  afterAll(async () => {
    if (fixture) await cleanupTempDir(fixture.tempDir);
    if (projectTempDir) await cleanupTempDir(projectTempDir);
  });

  describe("pre-conditions", () => {
    it("should have the plugin registered in settings before uninstall", async () => {
      const pluginKey = `web-framework-react@${fixture.marketplaceName}`;
      await expect({ dir: projectDir }).toHavePlugin(pluginKey);
    });
  });

  describe("after uninstall --yes", () => {
    let uninstallResult: Awaited<ReturnType<typeof CLI.run>>;

    beforeAll(async () => {
      // Use real HOME so the CLI finds the plugin registry and can call
      // `claude plugin uninstall` to deregister the plugin.
      uninstallResult = await CLI.run(
        ["uninstall", "--yes"],
        { dir: projectDir },
        {
          env: { HOME: realHome },
        },
      );
    }, 60_000);

    it("should exit with code 0", () => {
      expect(uninstallResult.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it("should report uninstall complete in output", () => {
      expect(uninstallResult.stdout).toContain("Uninstall complete!");
    });

    it("should report per-plugin uninstall messages", () => {
      // The uninstall command logs "  Uninstalled plugin '<name>'" per plugin
      expect(uninstallResult.stdout).toContain("Uninstalled plugin");
    });

    it("should clean up plugin from settings", async () => {
      await expect({ dir: projectDir }).toHaveNoPlugins();
    });

    it("should remove CLI-managed skill directories", async () => {
      const skillsDir = skillsPath(projectDir);
      // Skills directory should be removed or empty (all skills were CLI-managed)
      if (await directoryExists(skillsDir)) {
        const entries = await listFiles(skillsDir);
        expect(entries.length).toBe(0);
      }
    });

    it("should remove CLI-compiled agent files", async () => {
      const agentsDir = agentsPath(projectDir);
      // Agents directory should be removed (all agents were CLI-compiled)
      expect(await directoryExists(agentsDir)).toBe(false);
    });

    it("should preserve config directory (without --all)", async () => {
      expect(await directoryExists(path.join(projectDir, DIRS.CLAUDE_SRC))).toBe(true);
    });
  });
});
