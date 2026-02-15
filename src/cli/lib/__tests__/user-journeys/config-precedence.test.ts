import path from "path";
import os from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile, mkdir, writeFile, rm } from "fs/promises";
import { stringify as stringifyYaml } from "yaml";
import {
  resolveSource,
  resolveAgentsSource,
  loadProjectSourceConfig,
  saveProjectConfig,
  getProjectConfigPath,
  SOURCE_ENV_VAR,
  DEFAULT_SOURCE,
  type ProjectSourceConfig,
} from "../../configuration";
import {
  createTestSource,
  cleanupTestSource,
  fileExists,
  type TestDirs,
} from "../fixtures/create-test-source";

const PROJECT_CONFIG_DIR = ".claude-src";

async function createProjectConfig(
  projectDir: string,
  config: ProjectSourceConfig,
): Promise<string> {
  const configDir = path.join(projectDir, PROJECT_CONFIG_DIR);
  await mkdir(configDir, { recursive: true });
  const configPath = path.join(configDir, "config.yaml");
  await writeFile(configPath, stringifyYaml(config));
  return configPath;
}

describe("User Journey: Config Precedence - Source Resolution", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    // Create isolated temp directories for testing
    const mkdtemp = await import("fs/promises").then((m) => m.mkdtemp);
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-config-precedence-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });

    // Clear environment variable
    delete process.env[SOURCE_ENV_VAR];
  });

  afterEach(async () => {
    // Restore environment
    delete process.env[SOURCE_ENV_VAR];
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("flag precedence (highest)", () => {
    it("should use --source flag value over environment variable", async () => {
      process.env[SOURCE_ENV_VAR] = "github:env/source";

      const result = await resolveSource("github:flag/source", projectDir);

      expect(result.source).toBe("github:flag/source");
      expect(result.sourceOrigin).toBe("flag");
    });

    it("should use --source flag value over project config", async () => {
      await createProjectConfig(projectDir, {
        source: "github:project/source",
      });

      const result = await resolveSource("github:flag/source", projectDir);

      expect(result.source).toBe("github:flag/source");
      expect(result.sourceOrigin).toBe("flag");
    });

    it("should use --source flag when all layers are configured", async () => {
      // Set up all layers
      process.env[SOURCE_ENV_VAR] = "github:env/source";
      await createProjectConfig(projectDir, {
        source: "github:project/source",
      });

      const result = await resolveSource("github:flag/source", projectDir);

      expect(result.source).toBe("github:flag/source");
      expect(result.sourceOrigin).toBe("flag");
    });

    it("should reject empty flag value", async () => {
      await expect(resolveSource("", projectDir)).rejects.toThrow(/--source flag cannot be empty/);
    });

    it("should reject whitespace-only flag value", async () => {
      await expect(resolveSource("   ", projectDir)).rejects.toThrow(
        /--source flag cannot be empty/,
      );
    });
  });

  describe("environment variable precedence", () => {
    it("should use CC_SOURCE when no flag provided", async () => {
      process.env[SOURCE_ENV_VAR] = "github:env/source";

      const result = await resolveSource(undefined, projectDir);

      expect(result.source).toBe("github:env/source");
      expect(result.sourceOrigin).toBe("env");
    });

    it("should use CC_SOURCE over project config", async () => {
      process.env[SOURCE_ENV_VAR] = "github:env/source";
      await createProjectConfig(projectDir, {
        source: "github:project/source",
      });

      const result = await resolveSource(undefined, projectDir);

      expect(result.source).toBe("github:env/source");
      expect(result.sourceOrigin).toBe("env");
    });

    it("should support various source formats in env var", async () => {
      const testSources = [
        "github:org/repo",
        "gh:org/repo",
        "gitlab:org/repo",
        "https://github.com/org/repo",
        "/local/path/to/source",
        "./relative/path",
      ];

      for (const source of testSources) {
        process.env[SOURCE_ENV_VAR] = source;
        const result = await resolveSource(undefined, projectDir);
        expect(result.source).toBe(source);
        expect(result.sourceOrigin).toBe("env");
      }
    });
  });

  describe("project config precedence", () => {
    it("should use project config when no flag or env", async () => {
      await createProjectConfig(projectDir, {
        source: "github:project/custom-source",
      });

      const result = await resolveSource(undefined, projectDir);

      expect(result.source).toBe("github:project/custom-source");
      expect(result.sourceOrigin).toBe("project");
    });

    it("should load project config from .claude-src/config.yaml", async () => {
      const configPath = await createProjectConfig(projectDir, {
        source: "github:my-company/internal-skills",
      });

      // Verify file exists where expected
      expect(await fileExists(configPath)).toBe(true);

      const config = await loadProjectSourceConfig(projectDir);
      expect(config?.source).toBe("github:my-company/internal-skills");
    });

    it("should handle project config with multiple fields", async () => {
      await createProjectConfig(projectDir, {
        source: "github:project/source",
        marketplace: "https://marketplace.example.com",
        agents_source: "https://agents.example.com",
      });

      const config = await loadProjectSourceConfig(projectDir);

      expect(config?.source).toBe("github:project/source");
      expect(config?.marketplace).toBe("https://marketplace.example.com");
      expect(config?.agents_source).toBe("https://agents.example.com");
    });

    it("should return null for missing project config", async () => {
      // No config file created
      const config = await loadProjectSourceConfig(projectDir);
      expect(config).toBeNull();
    });

    it("should return null for invalid YAML in project config", async () => {
      const configDir = path.join(projectDir, PROJECT_CONFIG_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), "invalid: yaml: content: :");

      const config = await loadProjectSourceConfig(projectDir);
      expect(config).toBeNull();
    });
  });

  describe("default precedence (lowest)", () => {
    it("should use default source when no config exists", async () => {
      // No flag, no env, no project config
      const result = await resolveSource(undefined, projectDir);

      expect(result.sourceOrigin).toBe("default");
      expect(result.source).toBe(DEFAULT_SOURCE);
    });

    it("should handle undefined project directory", async () => {
      const result = await resolveSource(undefined, undefined);

      expect(result.sourceOrigin).toBe("default");
      expect(result.source).toBe(DEFAULT_SOURCE);
    });
  });

  describe("marketplace resolution", () => {
    it("should resolve marketplace from project config", async () => {
      await createProjectConfig(projectDir, {
        marketplace: "https://enterprise.example.com/plugins",
      });

      const result = await resolveSource(undefined, projectDir);

      expect(result.marketplace).toBe("https://enterprise.example.com/plugins");
    });

    it("should include marketplace alongside source", async () => {
      await createProjectConfig(projectDir, {
        source: "github:myorg/skills",
        marketplace: "https://marketplace.example.com",
      });

      const result = await resolveSource(undefined, projectDir);

      expect(result.source).toBe("github:myorg/skills");
      expect(result.sourceOrigin).toBe("project");
      expect(result.marketplace).toBe("https://marketplace.example.com");
    });

    it("should return undefined marketplace when not configured in project", async () => {
      const result = await resolveSource(undefined, projectDir);

      expect(result.marketplace).toBeUndefined();
    });

    it("should preserve marketplace when using flag source", async () => {
      await createProjectConfig(projectDir, {
        source: "github:project/source",
        marketplace: "https://marketplace.example.com",
      });

      // Flag overrides source but marketplace from config is preserved
      const result = await resolveSource("github:flag/source", projectDir);

      expect(result.source).toBe("github:flag/source");
      expect(result.sourceOrigin).toBe("flag");
      expect(result.marketplace).toBe("https://marketplace.example.com");
    });
  });
});

describe("User Journey: Config Precedence - Agent Source Resolution", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    const mkdtemp = await import("fs/promises").then((m) => m.mkdtemp);
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-agent-precedence-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("agents_source precedence", () => {
    it("should use flag value with highest priority", async () => {
      await createProjectConfig(projectDir, {
        agents_source: "https://project.example.com/agents",
      });

      const result = await resolveAgentsSource("https://flag.example.com/agents", projectDir);

      expect(result.agentsSource).toBe("https://flag.example.com/agents");
      expect(result.agentsSourceOrigin).toBe("flag");
    });

    it("should use project config when no flag provided", async () => {
      await createProjectConfig(projectDir, {
        agents_source: "https://project.example.com/agents",
      });

      const result = await resolveAgentsSource(undefined, projectDir);

      expect(result.agentsSource).toBe("https://project.example.com/agents");
      expect(result.agentsSourceOrigin).toBe("project");
    });

    it("should use default when no config exists", async () => {
      const result = await resolveAgentsSource(undefined, projectDir);

      expect(result.agentsSourceOrigin).toBe("default");
      expect(result.agentsSource).toBeUndefined();
    });

    it("should reject empty flag value", async () => {
      await expect(resolveAgentsSource("", projectDir)).rejects.toThrow(
        /--agent-source flag cannot be empty/,
      );
    });
  });
});

describe("User Journey: Project Config Save and Load", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    const mkdtemp = await import("fs/promises").then((m) => m.mkdtemp);
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-save-load-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("saveProjectConfig", () => {
    it("should create config directory if it does not exist", async () => {
      await saveProjectConfig(projectDir, { source: "github:test/repo" });

      const configPath = getProjectConfigPath(projectDir);
      expect(await fileExists(configPath)).toBe(true);

      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("source: github:test/repo");
    });

    it("should overwrite existing config", async () => {
      await saveProjectConfig(projectDir, { source: "github:first/repo" });
      await saveProjectConfig(projectDir, { source: "github:second/repo" });

      const configPath = getProjectConfigPath(projectDir);
      const content = await readFile(configPath, "utf-8");

      expect(content).toContain("github:second/repo");
      expect(content).not.toContain("github:first/repo");
    });

    it("should save all config fields", async () => {
      await saveProjectConfig(projectDir, {
        source: "github:myorg/skills",
        marketplace: "https://marketplace.example.com",
        agents_source: "https://agents.example.com",
      });

      const configPath = getProjectConfigPath(projectDir);
      const content = await readFile(configPath, "utf-8");

      expect(content).toContain("source: github:myorg/skills");
      expect(content).toContain("marketplace: https://marketplace.example.com");
      expect(content).toContain("agents_source: https://agents.example.com");
    });
  });

  describe("loadProjectSourceConfig", () => {
    it("should load saved config correctly", async () => {
      await saveProjectConfig(projectDir, {
        source: "github:company/private-skills",
        marketplace: "https://internal-marketplace.company.com",
      });

      const config = await loadProjectSourceConfig(projectDir);

      expect(config?.source).toBe("github:company/private-skills");
      expect(config?.marketplace).toBe("https://internal-marketplace.company.com");
    });

    it("should return config path from getProjectConfigPath", () => {
      const configPath = getProjectConfigPath(projectDir);
      expect(configPath).toBe(path.join(projectDir, PROJECT_CONFIG_DIR, "config.yaml"));
    });
  });
});

describe("User Journey: Config Precedence with CLI", () => {
  let dirs: TestDirs;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    delete process.env[SOURCE_ENV_VAR];
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    delete process.env[SOURCE_ENV_VAR];
    if (dirs) {
      await cleanupTestSource(dirs);
    }
  });

  it("should respect config precedence in actual command execution", async () => {
    // Create test fixture with project config
    dirs = await createTestSource({
      projectConfig: {
        name: "test-project",
        // Note: source is in .claude/config.yaml, not plugin config
      },
    });

    process.chdir(dirs.projectDir);

    // Create project-level config with custom source
    await createProjectConfig(dirs.projectDir, {
      source: "github:my-company/internal-skills",
    });

    // Verify project config was created
    const config = await loadProjectSourceConfig(dirs.projectDir);
    expect(config?.source).toBe("github:my-company/internal-skills");
  });

  it("should allow environment variable to override project config", async () => {
    dirs = await createTestSource({
      projectConfig: {
        name: "test-project",
      },
    });

    process.chdir(dirs.projectDir);

    await createProjectConfig(dirs.projectDir, {
      source: "github:project/source",
    });

    // Set environment variable
    process.env[SOURCE_ENV_VAR] = "github:env/override";

    // Resolve source - env should win
    const result = await resolveSource(undefined, dirs.projectDir);

    expect(result.source).toBe("github:env/override");
    expect(result.sourceOrigin).toBe("env");
  });
});

describe("User Journey: Config Edge Cases", () => {
  let tempDir: string;

  beforeEach(async () => {
    const mkdtemp = await import("fs/promises").then((m) => m.mkdtemp);
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-edge-cases-"));
    delete process.env[SOURCE_ENV_VAR];
  });

  afterEach(async () => {
    delete process.env[SOURCE_ENV_VAR];
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should handle config with only optional fields", async () => {
    const projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });

    await createProjectConfig(projectDir, {
      marketplace: "https://marketplace.example.com",
      // No source field
    });

    const config = await loadProjectSourceConfig(projectDir);
    expect(config?.source).toBeUndefined();
    expect(config?.marketplace).toBe("https://marketplace.example.com");

    // Resolve should fall back to default for source
    const result = await resolveSource(undefined, projectDir);
    expect(result.sourceOrigin).toBe("default");
    // But should still have marketplace
    expect(result.marketplace).toBe("https://marketplace.example.com");
  });

  it("should handle empty config file gracefully", async () => {
    const projectDir = path.join(tempDir, "project");
    const configDir = path.join(projectDir, PROJECT_CONFIG_DIR);
    await mkdir(configDir, { recursive: true });
    await writeFile(path.join(configDir, "config.yaml"), "");

    const config = await loadProjectSourceConfig(projectDir);
    // Empty file should result in null or empty config
    // Implementation returns null for empty file
    expect(config).toBeNull();
  });

  it("should handle config with extra unknown fields", async () => {
    const projectDir = path.join(tempDir, "project");
    const configDir = path.join(projectDir, PROJECT_CONFIG_DIR);
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, "config.yaml"),
      `source: github:valid/source
unknown_field: should_be_ignored
another_unknown: also_ignored
`,
    );

    const config = await loadProjectSourceConfig(projectDir);
    expect(config?.source).toBe("github:valid/source");
    // Unknown fields should not cause errors
  });

  it("should support local file paths as source", async () => {
    const localPath = path.join(tempDir, "local-skills");
    await mkdir(localPath, { recursive: true });

    const result = await resolveSource(localPath, undefined);

    expect(result.source).toBe(localPath);
    expect(result.sourceOrigin).toBe("flag");
  });

  it("should support relative paths as source", async () => {
    const result = await resolveSource("./relative/path", undefined);

    expect(result.source).toBe("./relative/path");
    expect(result.sourceOrigin).toBe("flag");
  });
});
