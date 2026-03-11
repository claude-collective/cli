import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import fs from "fs";
import { mkdir, writeFile, readFile } from "fs/promises";
import {
  runCliCommand,
  directoryExists,
  fileExists,
  createTempDir,
  cleanupTempDir,
  writeTestSkill,
  createMockMatrix,
  createMockSkill,
  SKILLS,
} from "../helpers";
import { useMatrixStore } from "../../../stores/matrix-store";
import { DEFAULT_BRANDING, STANDARD_FILES, STANDARD_DIRS, CLAUDE_DIR, CLAUDE_SRC_DIR, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE } from "../../../consts";
import type { SkillId } from "../../../types";
import { renderConfigTs } from "../content-generators";

vi.mock("../../../utils/exec.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../utils/exec.js")>()),
  claudePluginUninstall: vi.fn(),
  isClaudeCLIAvailable: vi.fn().mockResolvedValue(true),
}));
const TEST_PLUGIN_NAME = "test-plugin@marketplace";
const PLUGIN_SUBPATH = path.join(CLAUDE_DIR, "plugins", TEST_PLUGIN_NAME);
const TEST_SOURCE = "github:agents-inc/skills";
const TEST_EXTRA_SOURCE = "github:acme-corp/skills";

/**
 * Creates a .claude-src/config.ts with source configuration.
 */
async function createProjectConfig(
  projectDir: string,
  options?: {
    source?: string;
    extraSources?: Array<{ name: string; url: string }>;
    agents?: Array<{ name: string; scope: string }>;
  },
): Promise<string> {
  const configDir = path.join(projectDir, CLAUDE_SRC_DIR);
  await mkdir(configDir, { recursive: true });

  const config: Record<string, unknown> = {
    source: options?.source ?? TEST_SOURCE,
  };

  if (options?.extraSources) {
    config.sources = options.extraSources;
  }

  if (options?.agents) {
    config.agents = options.agents;
  }

  const configPath = path.join(configDir, STANDARD_FILES.CONFIG_TS);
  await writeFile(configPath, renderConfigTs(config));
  return configPath;
}

/**
 * Creates a plugin directory with the full settings.json-based discovery chain:
 * 1. Project .claude/settings.json with enabledPlugins
 * 2. Fake home ~/.claude/plugins/installed_plugins.json registry
 * 3. Plugin manifest at the install path (.claude-plugin/plugin.json)
 */
async function createPluginDir(projectDir: string, fakeHome: string): Promise<string> {
  const pluginDir = path.join(projectDir, PLUGIN_SUBPATH);
  await mkdir(pluginDir, { recursive: true });

  // Create plugin manifest so getVerifiedPluginInstallPaths can verify the path
  const manifestDir = path.join(pluginDir, PLUGIN_MANIFEST_DIR);
  await mkdir(manifestDir, { recursive: true });
  await writeFile(
    path.join(manifestDir, PLUGIN_MANIFEST_FILE),
    JSON.stringify({ name: TEST_PLUGIN_NAME, version: "1.0.0" }),
  );

  // Create .claude/settings.json with enabled plugin
  const settingsPath = path.join(projectDir, CLAUDE_DIR, "settings.json");
  await writeFile(settingsPath, JSON.stringify({ enabledPlugins: { [TEST_PLUGIN_NAME]: true } }));

  // Use resolved (real) paths for registry entries because process.cwd()
  // resolves symlinks (e.g., /var -> /private/var on macOS) and the
  // uninstall command compares projectPath against process.cwd().
  const realProjectDir = fs.realpathSync(projectDir);
  const realPluginDir = path.join(realProjectDir, PLUGIN_SUBPATH);

  // Create global registry at fake home
  const registryDir = path.join(fakeHome, CLAUDE_DIR, "plugins");
  await mkdir(registryDir, { recursive: true });
  await writeFile(
    path.join(registryDir, "installed_plugins.json"),
    JSON.stringify({
      version: 1,
      plugins: {
        [TEST_PLUGIN_NAME]: [
          {
            scope: "project",
            projectPath: realProjectDir,
            installPath: realPluginDir,
            version: "1.0.0",
            installedAt: new Date().toISOString(),
          },
        ],
      },
    }),
  );

  return pluginDir;
}

/** Creates a skill with forkedFrom.source matching a configured source (CLI-installed) */
async function createCLISkill(
  skillsDir: string,
  skillId: SkillId,
  source = TEST_SOURCE,
): Promise<string> {
  return writeTestSkill(skillsDir, skillId, {
    extraMetadata: {
      displayName: skillId,
      forkedFrom: {
        skillId,
        contentHash: "abc1234",
        date: "2026-01-01",
        source,
      },
    },
  });
}

/** Creates a skill directory WITHOUT forkedFrom (user-created skill) */
async function createUserSkill(skillsDir: string, skillId: SkillId): Promise<string> {
  return writeTestSkill(skillsDir, skillId, {
    extraMetadata: { displayName: skillId },
  });
}

/** Creates a skill directory with no metadata.yaml at all */
async function createSkillWithoutMetadata(skillsDir: string, skillId: SkillId): Promise<string> {
  return writeTestSkill(skillsDir, skillId, {
    skipMetadata: true,
  });
}

/** Creates a user MCP server config in .claude/mcp.json */
async function createUserMcpConfig(claudeDir: string): Promise<string> {
  const mcpPath = path.join(claudeDir, "mcp.json");
  await writeFile(
    mcpPath,
    JSON.stringify({
      mcpServers: {
        "user-server": { command: "node", args: ["server.js"] },
      },
    }),
  );
  return mcpPath;
}

/** Creates a user settings.json in .claude/settings.json (without plugin references) */
async function createUserSettings(claudeDir: string): Promise<string> {
  const settingsPath = path.join(claudeDir, "settings.json");
  await writeFile(settingsPath, JSON.stringify({ userPreference: "dark-mode" }));
  return settingsPath;
}

/** Creates a user CLAUDE.md in .claude/CLAUDE.md */
async function createUserClaudeMd(claudeDir: string): Promise<string> {
  const claudeMdPath = path.join(claudeDir, STANDARD_FILES.CLAUDE_MD);
  await writeFile(claudeMdPath, "# Project Instructions\n\nUser project rules.");
  return claudeMdPath;
}

describe("uninstall command", () => {
  let tempDir: string;
  let projectDir: string;
  let fakeHome: string;
  let originalCwd: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    originalCwd = process.cwd();
    originalHome = process.env.HOME;
    tempDir = await createTempDir("cc-uninstall-test-");
    projectDir = path.join(tempDir, "project");
    fakeHome = path.join(tempDir, "fakehome");
    await mkdir(projectDir, { recursive: true });
    await mkdir(fakeHome, { recursive: true });
    process.chdir(projectDir);
    process.env.HOME = fakeHome;

    useMatrixStore.getState().setMatrix(createMockMatrix(
      SKILLS.react,
      SKILLS.vue,
      SKILLS.zustand,
      SKILLS.hono,
      createMockSkill("web-tooling-acme"),
      createMockSkill("web-tooling-custom"),
      createMockSkill("web-tooling-personal"),
      createMockSkill("web-tooling-nometadata"),
    ));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.env.HOME = originalHome;
    await cleanupTempDir(tempDir);
  });

  describe("flag validation", () => {
    it("should run without arguments", async () => {
      const { error } = await runCliCommand(["uninstall"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --yes flag", async () => {
      const { error } = await runCliCommand(["uninstall", "--yes"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -y shorthand for yes", async () => {
      const { error } = await runCliCommand(["uninstall", "-y"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --all flag", async () => {
      const { error } = await runCliCommand(["uninstall", "--all"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("nothing to uninstall", () => {
    it("should show nothing to uninstall when project is empty", async () => {
      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes"]);

      const output = stdout + stderr;
      expect(output).toContain("Nothing to uninstall");
    });

    it("should show not installed message", async () => {
      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes"]);

      const output = stdout + stderr;
      expect(output).toContain("not installed");
    });
  });

  describe("config-based skill removal", () => {
    it("should remove skills with forkedFrom.source matching configured source", async () => {
      await createProjectConfig(projectDir);
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });
      const skillsDir = path.join(claudeDir, STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });

      const cliSkillDir = await createCLISkill(skillsDir, "web-framework-react");

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(await directoryExists(cliSkillDir)).toBe(false);
      expect(stdout).toContain("Removed 1 CLI-installed skill");
    });

    it("should preserve skills without forkedFrom (user-created)", async () => {
      await createProjectConfig(projectDir);
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });
      const skillsDir = path.join(claudeDir, STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });

      const userSkillDir = await createUserSkill(skillsDir, "web-tooling-custom");

      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes"]);

      const output = stdout + stderr;
      expect(await directoryExists(userSkillDir)).toBe(true);
      expect(output).toContain("Skipping 'web-tooling-custom'");
      expect(output).toContain("not created by");
    });

    it("should preserve skills without metadata.yaml", async () => {
      await createProjectConfig(projectDir);
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });
      const skillsDir = path.join(claudeDir, STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });

      const noMetaSkillDir = await createSkillWithoutMetadata(skillsDir, "web-tooling-nometadata");

      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes"]);

      const output = stdout + stderr;
      expect(await directoryExists(noMetaSkillDir)).toBe(true);
      expect(output).toContain("Skipping 'web-tooling-nometadata'");
    });

    it("should remove CLI skills and skip user skills in mixed scenario", async () => {
      await createProjectConfig(projectDir);
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });
      const skillsDir = path.join(claudeDir, STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });

      const cliSkillDir = await createCLISkill(skillsDir, "web-framework-react");
      const userSkillDir = await createUserSkill(skillsDir, "web-tooling-custom");

      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes"]);

      const output = stdout + stderr;

      // CLI skill should be removed
      expect(await directoryExists(cliSkillDir)).toBe(false);
      expect(output).toContain("Removed 1 CLI-installed skill");

      // User skill should remain
      expect(await directoryExists(userSkillDir)).toBe(true);
      expect(output).toContain("Skipping 'web-tooling-custom'");
    });

    it("should remove multiple CLI skills", async () => {
      await createProjectConfig(projectDir);
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });
      const skillsDir = path.join(claudeDir, STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });

      await createCLISkill(skillsDir, "web-framework-react");
      await createCLISkill(skillsDir, "web-state-zustand");
      await createCLISkill(skillsDir, "api-framework-hono");

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(stdout).toContain("Removed 3 CLI-installed skills");
    });

    it("should match skills against extra sources", async () => {
      await createProjectConfig(projectDir, {
        extraSources: [{ name: "acme", url: TEST_EXTRA_SOURCE }],
      });
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });
      const skillsDir = path.join(claudeDir, STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });

      // Skill from primary source
      const primarySkillDir = await createCLISkill(skillsDir, "web-framework-react", TEST_SOURCE);
      // Skill from extra source
      const extraSkillDir = await createCLISkill(skillsDir, "web-tooling-acme", TEST_EXTRA_SOURCE);
      // User skill
      const userSkillDir = await createUserSkill(skillsDir, "web-tooling-personal");

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      // Both source-matched skills removed
      expect(await directoryExists(primarySkillDir)).toBe(false);
      expect(await directoryExists(extraSkillDir)).toBe(false);
      // User skill preserved
      expect(await directoryExists(userSkillDir)).toBe(true);
      expect(stdout).toContain("Removed 2 CLI-installed skills");
    });

    it("should handle legacy skills without source field in forkedFrom when config exists", async () => {
      // Legacy skill: has forkedFrom but no source field
      await createProjectConfig(projectDir);
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });
      const skillsDir = path.join(claudeDir, STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });

      // Create a legacy skill with forkedFrom but no source
      const legacySkillDir = await writeTestSkill(skillsDir, "web-framework-vue", {
        extraMetadata: {
          displayName: "web-framework-vue",
          forkedFrom: {
            skillId: "web-framework-vue",
            contentHash: "def5678",
            date: "2026-01-01",
            // Note: no source field (legacy)
          },
        },
      });

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      // Legacy skill with forkedFrom but no source should still be removed when config exists
      expect(await directoryExists(legacySkillDir)).toBe(false);
      expect(stdout).toContain("Removed 1 CLI-installed skill");
    });
  });

  describe("agent removal", () => {
    it("should remove compiled agents listed in config", async () => {
      await createProjectConfig(projectDir, {
        agents: [{ name: "web-developer", scope: "project" }],
      });
      const claudeDir = path.join(projectDir, CLAUDE_DIR);

      const agentsDir = path.join(claudeDir, "agents");
      await mkdir(agentsDir, { recursive: true });
      await writeFile(path.join(agentsDir, "web-developer.md"), "# Web Developer Agent");

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(await directoryExists(agentsDir)).toBe(false);
      expect(stdout).toContain("Removed 1 compiled agent");
    });

    it("should not remove agents directory when no config exists", async () => {
      const claudeDir = path.join(projectDir, CLAUDE_DIR);

      const agentsDir = path.join(claudeDir, "agents");
      await mkdir(agentsDir, { recursive: true });
      await writeFile(path.join(agentsDir, "my-custom-agent.md"), "# Custom Agent");

      await runCliCommand(["uninstall", "--yes"]);

      expect(await directoryExists(agentsDir)).toBe(true);
    });

    it("should only remove agents listed in config and preserve others", async () => {
      await createProjectConfig(projectDir, {
        agents: [{ name: "web-developer", scope: "project" }],
      });
      const claudeDir = path.join(projectDir, CLAUDE_DIR);

      const agentsDir = path.join(claudeDir, "agents");
      await mkdir(agentsDir, { recursive: true });
      await writeFile(path.join(agentsDir, "web-developer.md"), "# Web Developer Agent");
      await writeFile(path.join(agentsDir, "my-custom-agent.md"), "# Custom Agent");

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(stdout).toContain("Removed 1 compiled agent");
      expect(await directoryExists(agentsDir)).toBe(true);
      expect(await fileExists(path.join(agentsDir, "web-developer.md"))).toBe(false);
      expect(await fileExists(path.join(agentsDir, "my-custom-agent.md"))).toBe(true);
    });
  });

  describe("--all flag and .claude-src/ handling", () => {
    it("should preserve .claude-src/ by default", async () => {
      await createProjectConfig(projectDir);
      const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(await directoryExists(claudeSrcDir)).toBe(true);
      // Should NOT mention removing .claude-src/
      expect(stdout).not.toContain(`Removed ${CLAUDE_SRC_DIR}/`);
    });

    it("should remove .claude-src/ with --all flag", async () => {
      await createProjectConfig(projectDir);
      const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);

      const { stdout } = await runCliCommand(["uninstall", "--yes", "--all"]);

      expect(await directoryExists(claudeSrcDir)).toBe(false);
      expect(stdout).toContain(`Removed ${CLAUDE_SRC_DIR}/`);
    });
  });

  describe("empty .claude/ cleanup", () => {
    it("should remove .claude/ if empty after cleanup", async () => {
      await createProjectConfig(projectDir);
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });

      const skillsDir = path.join(claudeDir, STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });
      await createCLISkill(skillsDir, "web-framework-react");

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(await directoryExists(claudeDir)).toBe(false);
      expect(stdout).toContain(`Removed ${CLAUDE_DIR}/`);
    });

    it("should not remove .claude/ if user content remains", async () => {
      await createProjectConfig(projectDir);
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });

      const skillsDir = path.join(claudeDir, STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });
      await createUserSkill(skillsDir, "web-tooling-custom");

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(await directoryExists(claudeDir)).toBe(true);
      expect(stdout).toContain("Kept .claude/ (contains user content)");
    });
  });

  describe("plugin removal", () => {
    it("should remove plugin directory", async () => {
      const pluginDir = await createPluginDir(projectDir, fakeHome);

      expect(await directoryExists(pluginDir)).toBe(true);

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(await directoryExists(pluginDir)).toBe(false);
      expect(stdout).toContain("Uninstalled 1 plugin");
    });

    it("should show what will be removed", async () => {
      await createPluginDir(projectDir, fakeHome);

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(stdout).toContain("The following will be removed");
      expect(stdout).toContain("Plugins:");
    });

    it("should show uninstall complete message", async () => {
      await createPluginDir(projectDir, fakeHome);

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(stdout).toContain(`${DEFAULT_BRANDING.NAME} has been uninstalled`);
      expect(stdout).toContain("Uninstall complete");
    });
  });

  describe("user content preservation", () => {
    it("should preserve .claude/mcp.json during uninstall", async () => {
      await createProjectConfig(projectDir);
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });
      const mcpPath = await createUserMcpConfig(claudeDir);

      const skillsDir = path.join(claudeDir, STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });
      await createCLISkill(skillsDir, "web-framework-react");

      await runCliCommand(["uninstall", "--yes"]);

      expect(await fileExists(mcpPath)).toBe(true);
      const content = JSON.parse(await readFile(mcpPath, "utf-8"));
      expect(content.mcpServers["user-server"]).toBeDefined();
    });

    it("should preserve .claude/settings.json during uninstall", async () => {
      await createProjectConfig(projectDir);
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });
      const settingsPath = await createUserSettings(claudeDir);

      await runCliCommand(["uninstall", "--yes"]);

      expect(await fileExists(settingsPath)).toBe(true);
      const content = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(content.userPreference).toBe("dark-mode");
    });

    it("should preserve .claude/CLAUDE.md during uninstall", async () => {
      await createProjectConfig(projectDir);
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });
      const claudeMdPath = await createUserClaudeMd(claudeDir);

      await runCliCommand(["uninstall", "--yes"]);

      expect(await fileExists(claudeMdPath)).toBe(true);
      const content = await readFile(claudeMdPath, "utf-8");
      expect(content).toContain("User project rules");
    });

    it("should preserve user-created skills and user files together", async () => {
      await createProjectConfig(projectDir);
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });

      const skillsDir = path.join(claudeDir, STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });
      const cliSkillDir = await createCLISkill(skillsDir, "web-framework-react");
      const userSkillDir = await createUserSkill(skillsDir, "web-tooling-personal");
      const mcpPath = await createUserMcpConfig(claudeDir);
      const settingsPath = await createUserSettings(claudeDir);
      const claudeMdPath = await createUserClaudeMd(claudeDir);

      await runCliCommand(["uninstall", "--yes"]);

      // CLI artifact removed
      expect(await directoryExists(cliSkillDir)).toBe(false);

      // All user content preserved
      expect(await directoryExists(userSkillDir)).toBe(true);
      expect(await fileExists(mcpPath)).toBe(true);
      expect(await fileExists(settingsPath)).toBe(true);
      expect(await fileExists(claudeMdPath)).toBe(true);

      // .claude/ preserved because user content remains
      expect(await directoryExists(claudeDir)).toBe(true);
    });
  });

  describe("combined plugin and local removal", () => {
    it("should remove both plugins and CLI-managed local artifacts", async () => {
      await createProjectConfig(projectDir);
      const pluginDir = await createPluginDir(projectDir, fakeHome);
      const claudeDir = path.join(projectDir, CLAUDE_DIR);

      const skillsDir = path.join(claudeDir, STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });
      const cliSkillDir = await createCLISkill(skillsDir, "web-framework-react");

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(await directoryExists(pluginDir)).toBe(false);
      expect(await directoryExists(cliSkillDir)).toBe(false);
      expect(stdout).toContain("Uninstalled 1 plugin");
      expect(stdout).toContain("Removed 1 CLI-installed skill");
    });

    it("should remove everything with --all flag", async () => {
      await createProjectConfig(projectDir, {
        agents: [{ name: "web-developer", scope: "project" }],
      });
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);

      const skillsDir = path.join(claudeDir, STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });
      await createCLISkill(skillsDir, "web-framework-react");

      const agentsDir = path.join(claudeDir, "agents");
      await mkdir(agentsDir, { recursive: true });
      await writeFile(path.join(agentsDir, "web-developer.md"), "# Agent");

      const { stdout } = await runCliCommand(["uninstall", "--yes", "--all"]);

      expect(await directoryExists(claudeDir)).toBe(false);
      expect(await directoryExists(claudeSrcDir)).toBe(false);
      expect(stdout).toContain("Removed 1 CLI-installed skill");
      expect(stdout).toContain("Removed 1 compiled agent");
      expect(stdout).toContain(`Removed ${CLAUDE_SRC_DIR}/`);
      expect(stdout).toContain(`Removed ${CLAUDE_DIR}/`);
    });
  });

  describe("uninstall -- global", () => {
    // The uninstall command does not currently support a --global flag.
    // Global uninstall mechanism is not implemented. These tests are
    // placeholders for when/if global uninstall is added.
    it.todo("should remove CLI global artifacts with --global --yes");
    it.todo("should preserve user global MCP servers");
    it.todo("should preserve user global agents");
  });
});
