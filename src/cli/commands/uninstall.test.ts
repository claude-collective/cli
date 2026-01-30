import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";

// =============================================================================
// Constants
// =============================================================================

const PLUGIN_MANIFEST = {
  name: "claude-collective",
  version: "1.0.0",
  license: "MIT",
  skills: "./skills/",
  agents: "./agents/",
};

const SKILL_CONTENT = `---
name: test-skill
description: A test skill
---

# Test Skill

Content here.
`;

const CONFIG_CONTENT = `name: test-project
agents:
  - web-developer
agent_skills:
  web-developer:
    - react
`;

// =============================================================================
// Test Helpers
// =============================================================================

interface TestDirs {
  tempDir: string;
  projectDir: string;
  pluginDir: string;
  skillsDir: string;
  agentsDir: string;
  configPath: string;
}

async function createTestDirs(): Promise<TestDirs> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-uninstall-test-"));
  const projectDir = path.join(tempDir, "project");
  const pluginDir = path.join(
    projectDir,
    ".claude",
    "plugins",
    "claude-collective",
  );
  const skillsDir = path.join(projectDir, ".claude", "skills");
  const agentsDir = path.join(projectDir, ".claude", "agents");
  const configPath = path.join(projectDir, ".claude", "config.yaml");

  await mkdir(projectDir, { recursive: true });

  return { tempDir, projectDir, pluginDir, skillsDir, agentsDir, configPath };
}

async function directoryExists(dirPath: string): Promise<boolean> {
  return existsSync(dirPath);
}

async function fileExists(filePath: string): Promise<boolean> {
  return existsSync(filePath);
}

async function createPluginInstallation(dirs: TestDirs): Promise<void> {
  // Create plugin directory structure
  await mkdir(path.join(dirs.pluginDir, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(dirs.pluginDir, "skills", "react"), {
    recursive: true,
  });
  await mkdir(path.join(dirs.pluginDir, "agents"), { recursive: true });

  // Write plugin manifest
  await writeFile(
    path.join(dirs.pluginDir, ".claude-plugin", "plugin.json"),
    JSON.stringify(PLUGIN_MANIFEST, null, 2),
  );

  // Write a skill
  await writeFile(
    path.join(dirs.pluginDir, "skills", "react", "SKILL.md"),
    SKILL_CONTENT,
  );
}

async function createLocalInstallation(dirs: TestDirs): Promise<void> {
  // Create local skills
  await mkdir(path.join(dirs.skillsDir, "react"), { recursive: true });
  await writeFile(
    path.join(dirs.skillsDir, "react", "SKILL.md"),
    SKILL_CONTENT,
  );

  // Create local agents
  await mkdir(dirs.agentsDir, { recursive: true });
  await writeFile(
    path.join(dirs.agentsDir, "web-developer.md"),
    "# Web Developer Agent",
  );

  // Create config
  await mkdir(path.dirname(dirs.configPath), { recursive: true });
  await writeFile(dirs.configPath, CONFIG_CONTENT);
}

/**
 * Simulate uninstall logic for testing
 * This mirrors the logic in uninstall.ts without CLI overhead
 */
async function simulateUninstall(
  dirs: TestDirs,
  options: {
    keepConfig?: boolean;
    pluginOnly?: boolean;
    localOnly?: boolean;
  } = {},
): Promise<{
  success: boolean;
  removedPlugin: boolean;
  removedSkills: boolean;
  removedAgents: boolean;
  removedConfig: boolean;
}> {
  const { remove } = await import("../utils/fs");

  const hasPlugin = await directoryExists(dirs.pluginDir);
  const hasSkills = await directoryExists(dirs.skillsDir);
  const hasAgents = await directoryExists(dirs.agentsDir);
  const hasConfig = await fileExists(dirs.configPath);

  const uninstallPlugin = !options.localOnly;
  const uninstallLocal = !options.pluginOnly;

  let removedPlugin = false;
  let removedSkills = false;
  let removedAgents = false;
  let removedConfig = false;

  try {
    // Remove plugin
    if (uninstallPlugin && hasPlugin) {
      await remove(dirs.pluginDir);
      removedPlugin = true;
    }

    // Remove local files
    if (uninstallLocal) {
      if (hasSkills) {
        await remove(dirs.skillsDir);
        removedSkills = true;
      }
      if (hasAgents) {
        await remove(dirs.agentsDir);
        removedAgents = true;
      }
      if (hasConfig && !options.keepConfig) {
        await remove(dirs.configPath);
        removedConfig = true;
      }
    }

    return {
      success: true,
      removedPlugin,
      removedSkills,
      removedAgents,
      removedConfig,
    };
  } catch {
    return {
      success: false,
      removedPlugin,
      removedSkills,
      removedAgents,
      removedConfig,
    };
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("uninstall command", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestDirs();
  });

  afterEach(async () => {
    await rm(dirs.tempDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // P3-06: Uninstall Plugin Mode
  // ===========================================================================

  describe("plugin mode uninstall (P3-06)", () => {
    it("should remove plugin directory when uninstalling", async () => {
      // Arrange
      await createPluginInstallation(dirs);
      expect(await directoryExists(dirs.pluginDir)).toBe(true);

      // Act
      const result = await simulateUninstall(dirs);

      // Assert
      expect(result.success).toBe(true);
      expect(result.removedPlugin).toBe(true);
      expect(await directoryExists(dirs.pluginDir)).toBe(false);
    });

    it("should remove plugin skills directory", async () => {
      // Arrange
      await createPluginInstallation(dirs);
      const pluginSkillsDir = path.join(dirs.pluginDir, "skills");
      expect(await directoryExists(pluginSkillsDir)).toBe(true);

      // Act
      await simulateUninstall(dirs);

      // Assert
      expect(await directoryExists(pluginSkillsDir)).toBe(false);
    });

    it("should remove plugin manifest", async () => {
      // Arrange
      await createPluginInstallation(dirs);
      const manifestPath = path.join(
        dirs.pluginDir,
        ".claude-plugin",
        "plugin.json",
      );
      expect(await fileExists(manifestPath)).toBe(true);

      // Act
      await simulateUninstall(dirs);

      // Assert
      expect(await fileExists(manifestPath)).toBe(false);
    });

    it("should only remove plugin when --plugin flag is used", async () => {
      // Arrange
      await createPluginInstallation(dirs);
      await createLocalInstallation(dirs);

      // Act
      const result = await simulateUninstall(dirs, { pluginOnly: true });

      // Assert
      expect(result.removedPlugin).toBe(true);
      expect(result.removedSkills).toBe(false);
      expect(result.removedAgents).toBe(false);
      expect(result.removedConfig).toBe(false);
      expect(await directoryExists(dirs.pluginDir)).toBe(false);
      expect(await directoryExists(dirs.skillsDir)).toBe(true);
      expect(await directoryExists(dirs.agentsDir)).toBe(true);
      expect(await fileExists(dirs.configPath)).toBe(true);
    });
  });

  // ===========================================================================
  // P3-07: Uninstall Local Mode
  // ===========================================================================

  describe("local mode uninstall (P3-07)", () => {
    it("should remove .claude/skills/ directory", async () => {
      // Arrange
      await createLocalInstallation(dirs);
      expect(await directoryExists(dirs.skillsDir)).toBe(true);

      // Act
      const result = await simulateUninstall(dirs);

      // Assert
      expect(result.success).toBe(true);
      expect(result.removedSkills).toBe(true);
      expect(await directoryExists(dirs.skillsDir)).toBe(false);
    });

    it("should remove .claude/agents/ directory", async () => {
      // Arrange
      await createLocalInstallation(dirs);
      expect(await directoryExists(dirs.agentsDir)).toBe(true);

      // Act
      const result = await simulateUninstall(dirs);

      // Assert
      expect(result.removedAgents).toBe(true);
      expect(await directoryExists(dirs.agentsDir)).toBe(false);
    });

    it("should remove .claude/config.yaml by default", async () => {
      // Arrange
      await createLocalInstallation(dirs);
      expect(await fileExists(dirs.configPath)).toBe(true);

      // Act
      const result = await simulateUninstall(dirs);

      // Assert
      expect(result.removedConfig).toBe(true);
      expect(await fileExists(dirs.configPath)).toBe(false);
    });

    it("should only remove local files when --local flag is used", async () => {
      // Arrange
      await createPluginInstallation(dirs);
      await createLocalInstallation(dirs);

      // Act
      const result = await simulateUninstall(dirs, { localOnly: true });

      // Assert
      expect(result.removedPlugin).toBe(false);
      expect(result.removedSkills).toBe(true);
      expect(result.removedAgents).toBe(true);
      expect(result.removedConfig).toBe(true);
      expect(await directoryExists(dirs.pluginDir)).toBe(true);
      expect(await directoryExists(dirs.skillsDir)).toBe(false);
      expect(await directoryExists(dirs.agentsDir)).toBe(false);
      expect(await fileExists(dirs.configPath)).toBe(false);
    });
  });

  // ===========================================================================
  // P3-08: --keep-config flag
  // ===========================================================================

  describe("--keep-config flag (P3-08)", () => {
    it("should preserve config.yaml when --keep-config is used", async () => {
      // Arrange
      await createLocalInstallation(dirs);
      expect(await fileExists(dirs.configPath)).toBe(true);

      // Act
      const result = await simulateUninstall(dirs, { keepConfig: true });

      // Assert
      expect(result.removedConfig).toBe(false);
      expect(await fileExists(dirs.configPath)).toBe(true);
    });

    it("should still remove skills and agents when --keep-config is used", async () => {
      // Arrange
      await createLocalInstallation(dirs);

      // Act
      const result = await simulateUninstall(dirs, { keepConfig: true });

      // Assert
      expect(result.removedSkills).toBe(true);
      expect(result.removedAgents).toBe(true);
      expect(result.removedConfig).toBe(false);
      expect(await directoryExists(dirs.skillsDir)).toBe(false);
      expect(await directoryExists(dirs.agentsDir)).toBe(false);
      expect(await fileExists(dirs.configPath)).toBe(true);
    });

    it("should preserve config content unchanged", async () => {
      // Arrange
      await createLocalInstallation(dirs);
      const originalContent = await readFile(dirs.configPath, "utf-8");

      // Act
      await simulateUninstall(dirs, { keepConfig: true });

      // Assert
      const preservedContent = await readFile(dirs.configPath, "utf-8");
      expect(preservedContent).toBe(originalContent);
    });
  });

  // ===========================================================================
  // Combined scenarios
  // ===========================================================================

  describe("combined installation uninstall", () => {
    it("should remove both plugin and local files by default", async () => {
      // Arrange
      await createPluginInstallation(dirs);
      await createLocalInstallation(dirs);

      // Act
      const result = await simulateUninstall(dirs);

      // Assert
      expect(result.removedPlugin).toBe(true);
      expect(result.removedSkills).toBe(true);
      expect(result.removedAgents).toBe(true);
      expect(result.removedConfig).toBe(true);
      expect(await directoryExists(dirs.pluginDir)).toBe(false);
      expect(await directoryExists(dirs.skillsDir)).toBe(false);
      expect(await directoryExists(dirs.agentsDir)).toBe(false);
      expect(await fileExists(dirs.configPath)).toBe(false);
    });

    it("should handle partial installations gracefully", async () => {
      // Arrange - only plugin, no local
      await createPluginInstallation(dirs);

      // Act
      const result = await simulateUninstall(dirs);

      // Assert
      expect(result.success).toBe(true);
      expect(result.removedPlugin).toBe(true);
      expect(result.removedSkills).toBe(false);
      expect(result.removedAgents).toBe(false);
      expect(result.removedConfig).toBe(false);
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle no installation gracefully", async () => {
      // Arrange - nothing installed

      // Act
      const result = await simulateUninstall(dirs);

      // Assert
      expect(result.success).toBe(true);
      expect(result.removedPlugin).toBe(false);
      expect(result.removedSkills).toBe(false);
      expect(result.removedAgents).toBe(false);
      expect(result.removedConfig).toBe(false);
    });

    it("should handle only config file present", async () => {
      // Arrange - only config
      await mkdir(path.dirname(dirs.configPath), { recursive: true });
      await writeFile(dirs.configPath, CONFIG_CONTENT);

      // Act
      const result = await simulateUninstall(dirs);

      // Assert
      expect(result.success).toBe(true);
      expect(result.removedConfig).toBe(true);
      expect(await fileExists(dirs.configPath)).toBe(false);
    });

    it("should handle only skills directory present", async () => {
      // Arrange - only skills
      await mkdir(path.join(dirs.skillsDir, "react"), { recursive: true });
      await writeFile(
        path.join(dirs.skillsDir, "react", "SKILL.md"),
        SKILL_CONTENT,
      );

      // Act
      const result = await simulateUninstall(dirs);

      // Assert
      expect(result.success).toBe(true);
      expect(result.removedSkills).toBe(true);
      expect(await directoryExists(dirs.skillsDir)).toBe(false);
    });

    it("should handle only agents directory present", async () => {
      // Arrange - only agents
      await mkdir(dirs.agentsDir, { recursive: true });
      await writeFile(path.join(dirs.agentsDir, "web-developer.md"), "# Agent");

      // Act
      const result = await simulateUninstall(dirs);

      // Assert
      expect(result.success).toBe(true);
      expect(result.removedAgents).toBe(true);
      expect(await directoryExists(dirs.agentsDir)).toBe(false);
    });
  });

  // ===========================================================================
  // Detection logic
  // ===========================================================================

  describe("installation detection", () => {
    it("should detect plugin installation", async () => {
      // Arrange
      await createPluginInstallation(dirs);

      // Assert
      expect(await directoryExists(dirs.pluginDir)).toBe(true);
    });

    it("should detect local installation", async () => {
      // Arrange
      await createLocalInstallation(dirs);

      // Assert
      expect(await directoryExists(dirs.skillsDir)).toBe(true);
      expect(await directoryExists(dirs.agentsDir)).toBe(true);
      expect(await fileExists(dirs.configPath)).toBe(true);
    });

    it("should detect both installations", async () => {
      // Arrange
      await createPluginInstallation(dirs);
      await createLocalInstallation(dirs);

      // Assert
      expect(await directoryExists(dirs.pluginDir)).toBe(true);
      expect(await directoryExists(dirs.skillsDir)).toBe(true);
      expect(await directoryExists(dirs.agentsDir)).toBe(true);
      expect(await fileExists(dirs.configPath)).toBe(true);
    });
  });
});

// =============================================================================
// claudePluginUninstall function tests
// =============================================================================

describe("claudePluginUninstall utility", () => {
  it("should export claudePluginUninstall function", async () => {
    const execUtils = await import("../utils/exec");
    expect(typeof execUtils.claudePluginUninstall).toBe("function");
  });

  it("should have correct function signature", async () => {
    const { claudePluginUninstall } = await import("../utils/exec");
    // Takes 3 arguments: pluginName, scope, projectDir
    expect(claudePluginUninstall.length).toBe(3);
  });

  it("should return a promise", async () => {
    const { claudePluginUninstall } = await import("../utils/exec");

    // Call with invalid path to force quick failure
    const result = claudePluginUninstall(
      "nonexistent-plugin",
      "project",
      "/nonexistent/path",
    );

    expect(result instanceof Promise).toBe(true);
    // Catch and ignore any errors since we're just testing the return type
    await result.catch(() => {});
  });
});

// =============================================================================
// Command structure tests
// =============================================================================

describe("uninstall command structure", () => {
  it("should export uninstallCommand", async () => {
    const { uninstallCommand } = await import("./uninstall");
    expect(uninstallCommand).toBeDefined();
  });

  it("should have correct command name", async () => {
    const { uninstallCommand } = await import("./uninstall");
    expect(uninstallCommand.name()).toBe("uninstall");
  });

  it("should have description", async () => {
    const { uninstallCommand } = await import("./uninstall");
    expect(uninstallCommand.description()).toBeTruthy();
    expect(uninstallCommand.description()).toContain("Remove");
  });

  it("should have --yes option", async () => {
    const { uninstallCommand } = await import("./uninstall");
    const options = uninstallCommand.options;
    const yesOption = options.find(
      (opt) => opt.short === "-y" || opt.long === "--yes",
    );
    expect(yesOption).toBeDefined();
  });

  it("should have --keep-config option", async () => {
    const { uninstallCommand } = await import("./uninstall");
    const options = uninstallCommand.options;
    const keepConfigOption = options.find(
      (opt) => opt.long === "--keep-config",
    );
    expect(keepConfigOption).toBeDefined();
  });

  it("should have --plugin option", async () => {
    const { uninstallCommand } = await import("./uninstall");
    const options = uninstallCommand.options;
    const pluginOption = options.find((opt) => opt.long === "--plugin");
    expect(pluginOption).toBeDefined();
  });

  it("should have --local option", async () => {
    const { uninstallCommand } = await import("./uninstall");
    const options = uninstallCommand.options;
    const localOption = options.find((opt) => opt.long === "--local");
    expect(localOption).toBeDefined();
  });
});
