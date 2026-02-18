import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import fs from "fs";
import { mkdir, writeFile, readdir } from "fs/promises";
import { runCliCommand, directoryExists, fileExists, createTempDir, cleanupTempDir } from "../helpers";
import { DEFAULT_BRANDING, STANDARD_FILES } from "../../../consts";

vi.mock("../../../utils/exec.js", () => ({
  claudePluginUninstall: vi.fn(),
  isClaudeCLIAvailable: vi.fn().mockResolvedValue(true),
}));

const CLAUDE_DIR = ".claude";
const CLAUDE_SRC_DIR = ".claude-src";
const TEST_PLUGIN_NAME = "test-plugin@marketplace";
const PLUGIN_SUBPATH = path.join(CLAUDE_DIR, "plugins", TEST_PLUGIN_NAME);

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
  const manifestDir = path.join(pluginDir, ".claude-plugin");
  await mkdir(manifestDir, { recursive: true });
  await writeFile(
    path.join(manifestDir, "plugin.json"),
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

async function createLocalDirs(
  projectDir: string,
): Promise<{ claudeDir: string; claudeSrcDir: string }> {
  const claudeDir = path.join(projectDir, CLAUDE_DIR);
  const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);
  await mkdir(claudeDir, { recursive: true });
  await mkdir(claudeSrcDir, { recursive: true });
  return { claudeDir, claudeSrcDir };
}

/** Creates a skill directory with metadata.yaml containing generatedByAgentsInc: true */
async function createCLISkill(skillsDir: string, skillName: string): Promise<string> {
  const skillDir = path.join(skillsDir, skillName);
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    `---\nname: ${skillName}\ndescription: Test skill\n---\nSkill content`,
  );
  await writeFile(
    path.join(skillDir, STANDARD_FILES.METADATA_YAML),
    `cli_name: ${skillName}\ngeneratedByAgentsInc: true\n`,
  );
  return skillDir;
}

/** Creates a skill directory WITHOUT generatedByAgentsInc (user-created skill) */
async function createUserSkill(skillsDir: string, skillName: string): Promise<string> {
  const skillDir = path.join(skillsDir, skillName);
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    `---\nname: ${skillName}\ndescription: User skill\n---\nUser skill content`,
  );
  await writeFile(
    path.join(skillDir, STANDARD_FILES.METADATA_YAML),
    `cli_name: ${skillName}\n`,
  );
  return skillDir;
}

/** Creates a skill directory with no metadata.yaml at all */
async function createSkillWithoutMetadata(skillsDir: string, skillName: string): Promise<string> {
  const skillDir = path.join(skillsDir, skillName);
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    `---\nname: ${skillName}\ndescription: No metadata skill\n---\nContent`,
  );
  return skillDir;
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

    it("should accept --plugin flag", async () => {
      const { error } = await runCliCommand(["uninstall", "--plugin"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --local flag", async () => {
      const { error } = await runCliCommand(["uninstall", "--local"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --dry-run flag", async () => {
      const { error } = await runCliCommand(["uninstall", "--dry-run"]);

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

    it("should show not installed message when no flags specified", async () => {
      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes"]);

      const output = stdout + stderr;
      expect(output).toContain("not installed");
    });

    it("should show no plugin found with --plugin flag", async () => {
      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes", "--plugin"]);

      const output = stdout + stderr;
      expect(output).toContain("No plugin installation found");
    });

    it("should show no local found with --local flag", async () => {
      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes", "--local"]);

      const output = stdout + stderr;
      expect(output).toContain("No local installation found");
    });
  });

  describe("dry-run mode", () => {
    it("should show preview header in dry-run", async () => {
      await createPluginDir(projectDir, fakeHome);

      const { stdout } = await runCliCommand(["uninstall", "--dry-run"]);

      expect(stdout).toContain("[dry-run]");
      expect(stdout).toContain("Preview mode");
    });

    it("should preview plugin removal in dry-run", async () => {
      await createPluginDir(projectDir, fakeHome);

      const { stdout } = await runCliCommand(["uninstall", "--dry-run"]);

      expect(stdout).toContain("[dry-run] Would uninstall");
      expect(stdout).toContain("[dry-run] Would remove");
      expect(stdout).toContain("Preview complete");
    });

    it("should preview local directory removal in dry-run", async () => {
      await createLocalDirs(projectDir);

      const { stdout } = await runCliCommand(["uninstall", "--dry-run"]);

      expect(stdout).toContain("[dry-run] Would remove");
      expect(stdout).toContain(CLAUDE_DIR);
      expect(stdout).toContain(CLAUDE_SRC_DIR);
    });

    it("should not remove files in dry-run", async () => {
      const pluginDir = await createPluginDir(projectDir, fakeHome);
      const { claudeDir, claudeSrcDir } = await createLocalDirs(projectDir);

      await runCliCommand(["uninstall", "--dry-run"]);

      expect(await directoryExists(pluginDir)).toBe(true);
      expect(await directoryExists(claudeDir)).toBe(true);
      expect(await directoryExists(claudeSrcDir)).toBe(true);
    });

    it("should show nothing to uninstall in dry-run when empty", async () => {
      const { stdout, stderr } = await runCliCommand(["uninstall", "--dry-run"]);

      const output = stdout + stderr;
      expect(output).toContain("Nothing to uninstall");
    });
  });

  describe("uninstall with --yes (plugin)", () => {
    it("should remove plugin directory", async () => {
      const pluginDir = await createPluginDir(projectDir, fakeHome);

      expect(await directoryExists(pluginDir)).toBe(true);

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(await directoryExists(pluginDir)).toBe(false);
      expect(stdout).toContain("Plugins uninstalled");
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

  describe("uninstall with --yes (local directories)", () => {
    it("should remove empty .claude and .claude-src directories", async () => {
      const { claudeDir, claudeSrcDir } = await createLocalDirs(projectDir);

      expect(await directoryExists(claudeDir)).toBe(true);
      expect(await directoryExists(claudeSrcDir)).toBe(true);

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(await directoryExists(claudeDir)).toBe(false);
      expect(await directoryExists(claudeSrcDir)).toBe(false);
      expect(stdout).toContain(`Removed ${CLAUDE_SRC_DIR}/`);
      expect(stdout).toContain(`Removed ${CLAUDE_DIR}/`);
    });

    it("should remove only .claude when .claude-src does not exist", async () => {
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      await mkdir(claudeDir, { recursive: true });

      const { stdout } = await runCliCommand(["uninstall", "--yes"]);

      expect(await directoryExists(claudeDir)).toBe(false);
      expect(stdout).toContain(`Removed ${CLAUDE_DIR}/`);
    });
  });

  describe("flag targeting", () => {
    it("should only remove plugin with --plugin flag", async () => {
      const pluginDir = await createPluginDir(projectDir, fakeHome);
      const { claudeSrcDir } = await createLocalDirs(projectDir);

      await runCliCommand(["uninstall", "--yes", "--plugin"]);

      expect(await directoryExists(pluginDir)).toBe(false);
      // .claude-src should remain since --plugin only targets plugins
      expect(await directoryExists(claudeSrcDir)).toBe(true);
    });

    it("should only remove local dirs with --local flag", async () => {
      const { claudeSrcDir } = await createLocalDirs(projectDir);

      await runCliCommand(["uninstall", "--yes", "--local"]);

      expect(await directoryExists(claudeSrcDir)).toBe(false);
    });

    it("should show nothing when --plugin but no plugin installed", async () => {
      await createLocalDirs(projectDir);

      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes", "--plugin"]);

      const output = stdout + stderr;
      expect(output).toContain("Nothing to uninstall");
      expect(output).toContain("No plugin installation found");
    });

    it("should show nothing when --local but no local dirs exist", async () => {
      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes", "--local"]);

      const output = stdout + stderr;
      expect(output).toContain("Nothing to uninstall");
      expect(output).toContain("No local installation found");
    });
  });

  describe("dry-run with flag targeting", () => {
    it("should preview only plugin removal with --dry-run --plugin", async () => {
      await createPluginDir(projectDir, fakeHome);
      await createLocalDirs(projectDir);

      const { stdout } = await runCliCommand(["uninstall", "--dry-run", "--plugin"]);

      expect(stdout).toContain("[dry-run] Would uninstall");
      expect(stdout).not.toContain(CLAUDE_SRC_DIR);
    });

    it("should preview only local removal with --dry-run --local", async () => {
      await createPluginDir(projectDir, fakeHome);
      await createLocalDirs(projectDir);

      const { stdout } = await runCliCommand(["uninstall", "--dry-run", "--local"]);

      expect(stdout).toContain("[dry-run] Would remove");
      expect(stdout).toContain(CLAUDE_SRC_DIR);
      expect(stdout).not.toContain("Would uninstall plugin");
    });
  });

  describe("selective skill removal (generatedByAgentsInc)", () => {
    it("should remove skills with generatedByAgentsInc flag", async () => {
      const { claudeDir } = await createLocalDirs(projectDir);
      const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);
      await mkdir(claudeSrcDir, { recursive: true });

      const skillsDir = path.join(claudeDir, "skills");
      await mkdir(skillsDir, { recursive: true });

      const cliSkillDir = await createCLISkill(skillsDir, "web-framework-react");

      const { stdout } = await runCliCommand(["uninstall", "--yes", "--local"]);

      expect(await directoryExists(cliSkillDir)).toBe(false);
      expect(stdout).toContain("Removed 1 CLI-installed skill");
    });

    it("should skip skills without generatedByAgentsInc flag", async () => {
      const { claudeDir } = await createLocalDirs(projectDir);

      const skillsDir = path.join(claudeDir, "skills");
      await mkdir(skillsDir, { recursive: true });

      const userSkillDir = await createUserSkill(skillsDir, "web-tooling-custom");

      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes", "--local"]);

      const output = stdout + stderr;
      expect(await directoryExists(userSkillDir)).toBe(true);
      expect(output).toContain("Skipping 'web-tooling-custom'");
      expect(output).toContain("not created by");
    });

    it("should skip skills without metadata.yaml", async () => {
      const { claudeDir } = await createLocalDirs(projectDir);

      const skillsDir = path.join(claudeDir, "skills");
      await mkdir(skillsDir, { recursive: true });

      const noMetaSkillDir = await createSkillWithoutMetadata(skillsDir, "web-tooling-nometadata");

      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes", "--local"]);

      const output = stdout + stderr;
      expect(await directoryExists(noMetaSkillDir)).toBe(true);
      expect(output).toContain("Skipping 'web-tooling-nometadata'");
    });

    it("should remove CLI skills and skip user skills in mixed scenario", async () => {
      const { claudeDir } = await createLocalDirs(projectDir);

      const skillsDir = path.join(claudeDir, "skills");
      await mkdir(skillsDir, { recursive: true });

      const cliSkillDir = await createCLISkill(skillsDir, "web-framework-react");
      const userSkillDir = await createUserSkill(skillsDir, "web-tooling-custom");

      const { stdout, stderr } = await runCliCommand(["uninstall", "--yes", "--local"]);

      const output = stdout + stderr;

      // CLI skill should be removed
      expect(await directoryExists(cliSkillDir)).toBe(false);
      expect(output).toContain("Removed 1 CLI-installed skill");

      // User skill should remain
      expect(await directoryExists(userSkillDir)).toBe(true);
      expect(output).toContain("Skipping 'web-tooling-custom'");
    });

    it("should not remove .claude/ if user content remains", async () => {
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);
      await mkdir(claudeDir, { recursive: true });
      await mkdir(claudeSrcDir, { recursive: true });

      const skillsDir = path.join(claudeDir, "skills");
      await mkdir(skillsDir, { recursive: true });

      // Create a user skill (will not be removed)
      await createUserSkill(skillsDir, "web-tooling-custom");

      const { stdout } = await runCliCommand(["uninstall", "--yes", "--local"]);

      // .claude/ should remain because it still has user content
      expect(await directoryExists(claudeDir)).toBe(true);
      expect(stdout).toContain("Kept .claude/ (contains user content)");
    });

    it("should remove .claude/ if empty after cleanup", async () => {
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);
      await mkdir(claudeDir, { recursive: true });
      await mkdir(claudeSrcDir, { recursive: true });

      const skillsDir = path.join(claudeDir, "skills");
      await mkdir(skillsDir, { recursive: true });

      // Create only CLI-installed skills (will all be removed)
      await createCLISkill(skillsDir, "web-framework-react");

      const { stdout } = await runCliCommand(["uninstall", "--yes", "--local"]);

      // .claude/ should be removed because it's empty after cleanup
      expect(await directoryExists(claudeDir)).toBe(false);
      expect(stdout).toContain(`Removed ${CLAUDE_DIR}/`);
    });

    it("should remove compiled agents directory entirely", async () => {
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);
      await mkdir(claudeSrcDir, { recursive: true });

      const agentsDir = path.join(claudeDir, "agents");
      await mkdir(agentsDir, { recursive: true });
      await writeFile(path.join(agentsDir, "web-developer.md"), "# Web Developer Agent");

      const { stdout } = await runCliCommand(["uninstall", "--yes", "--local"]);

      expect(await directoryExists(agentsDir)).toBe(false);
      expect(stdout).toContain("Removed compiled agents");
    });

    it("should remove multiple CLI skills", async () => {
      const { claudeDir } = await createLocalDirs(projectDir);

      const skillsDir = path.join(claudeDir, "skills");
      await mkdir(skillsDir, { recursive: true });

      await createCLISkill(skillsDir, "web-framework-react");
      await createCLISkill(skillsDir, "web-state-zustand");
      await createCLISkill(skillsDir, "api-framework-hono");

      const { stdout } = await runCliCommand(["uninstall", "--yes", "--local"]);

      expect(stdout).toContain("Removed 3 CLI-installed skills");
    });

    it("should preview selective skill removal in dry-run", async () => {
      const { claudeDir } = await createLocalDirs(projectDir);

      const skillsDir = path.join(claudeDir, "skills");
      await mkdir(skillsDir, { recursive: true });

      await createCLISkill(skillsDir, "web-framework-react");
      await createUserSkill(skillsDir, "web-tooling-custom");

      const { stdout } = await runCliCommand(["uninstall", "--dry-run", "--local"]);

      expect(stdout).toContain("[dry-run] Would remove skill 'web-framework-react'");
      expect(stdout).toContain("[dry-run] Would skip 'web-tooling-custom'");
    });
  });
});
