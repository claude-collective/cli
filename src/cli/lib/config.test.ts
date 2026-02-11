import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SOURCE,
  formatOrigin,
  getProjectConfigPath,
  isLocalSource,
  loadProjectSourceConfig,
  resolveSource,
  resolveAgentsSource,
  saveProjectConfig,
  SOURCE_ENV_VAR,
} from "./config";

describe("config", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-config-test-"));
    // Clear any environment variables
    delete process.env[SOURCE_ENV_VAR];
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
    // Restore environment
    delete process.env[SOURCE_ENV_VAR];
  });

  describe("DEFAULT_SOURCE", () => {
    it("should be set to the claude-collective skills repo", () => {
      expect(DEFAULT_SOURCE).toBe("github:claude-collective/skills");
    });
  });

  describe("SOURCE_ENV_VAR", () => {
    it("should be CC_SOURCE", () => {
      expect(SOURCE_ENV_VAR).toBe("CC_SOURCE");
    });
  });

  describe("getProjectConfigPath", () => {
    it("should return path in project .claude-src directory", () => {
      const configPath = getProjectConfigPath("/my/project");
      expect(configPath).toBe("/my/project/.claude-src/config.yaml");
    });
  });

  describe("isLocalSource", () => {
    it("should return true for absolute paths", () => {
      expect(isLocalSource("/home/user/skills")).toBe(true);
      expect(isLocalSource("/var/lib/skills")).toBe(true);
    });

    it("should return true for relative paths starting with .", () => {
      expect(isLocalSource("./skills")).toBe(true);
      expect(isLocalSource("../skills")).toBe(true);
      expect(isLocalSource(".")).toBe(true);
    });

    it("should return false for github: URLs", () => {
      expect(isLocalSource("github:org/repo")).toBe(false);
      expect(isLocalSource("gh:org/repo")).toBe(false);
    });

    it("should return false for gitlab: URLs", () => {
      expect(isLocalSource("gitlab:org/repo")).toBe(false);
    });

    it("should return false for https: URLs", () => {
      expect(isLocalSource("https://github.com/org/repo")).toBe(false);
      expect(isLocalSource("http://github.com/org/repo")).toBe(false);
    });

    it("should return true for paths without protocol prefix", () => {
      // Plain directory names without / or . prefix are ambiguous
      // but we treat them as local
      expect(isLocalSource("my-skills")).toBe(true);
    });

    it("should throw error for path traversal in bare names", () => {
      // Bare names (no / or . prefix) with traversal patterns are suspicious
      expect(() => isLocalSource("my-skills/../../../etc")).toThrow(
        /Path traversal patterns are not allowed/,
      );
    });

    it("should throw error for home directory expansion in bare names", () => {
      // Bare names with ~ are suspicious since shell expansion doesn't happen
      expect(() => isLocalSource("skills~backup")).toThrow(
        /Path traversal patterns are not allowed/,
      );
    });

    it("should allow legitimate relative paths with ..", () => {
      // Paths starting with . are recognized as relative and allowed
      expect(isLocalSource("../../../other-project/skills")).toBe(true);
      expect(isLocalSource("../skills")).toBe(true);
    });
  });

  describe("formatOrigin", () => {
    it("should format source flag origin", () => {
      expect(formatOrigin("source", "flag")).toBe("--source flag");
    });

    it("should format source env origin", () => {
      expect(formatOrigin("source", "env")).toContain(SOURCE_ENV_VAR);
    });

    it("should format source project origin", () => {
      expect(formatOrigin("source", "project")).toContain("project config");
    });

    it("should format source default origin", () => {
      expect(formatOrigin("source", "default")).toBe("default");
    });

    it("should format agents flag origin", () => {
      expect(formatOrigin("agents", "flag")).toBe("--agent-source flag");
    });

    it("should format agents project origin", () => {
      expect(formatOrigin("agents", "project")).toContain("project config");
    });

    it("should format agents default origin", () => {
      expect(formatOrigin("agents", "default")).toBe("default (local CLI)");
    });

    it("should return same project label for both source and agents", () => {
      expect(formatOrigin("source", "project")).toBe(formatOrigin("agents", "project"));
    });
  });

  describe("loadProjectSourceConfig", () => {
    it("should return null if config file does not exist", async () => {
      const config = await loadProjectSourceConfig(tempDir);
      expect(config).toBeNull();
    });

    it("should load config from .claude-src/config.yaml", async () => {
      // Create config file in new location
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), "source: github:mycompany/skills\n");

      const config = await loadProjectSourceConfig(tempDir);
      expect(config).toEqual({ source: "github:mycompany/skills" });
    });

    it("should fall back to .claude/config.yaml for legacy projects", async () => {
      // Create config file in legacy location
      const configDir = path.join(tempDir, ".claude");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), "source: github:legacy/skills\n");

      const config = await loadProjectSourceConfig(tempDir);
      expect(config).toEqual({ source: "github:legacy/skills" });
    });

    it("should return null for invalid YAML", async () => {
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), "invalid: yaml: content: :");

      const config = await loadProjectSourceConfig(tempDir);
      // Should return null or throw - implementation dependent
      // Current implementation catches errors and returns null
      expect(config).toBeNull();
    });

    it("should load marketplace from project config", async () => {
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        "marketplace: https://custom-marketplace.io\n",
      );

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.marketplace).toBe("https://custom-marketplace.io");
    });
  });

  describe("saveProjectConfig", () => {
    it("should create config directory if it does not exist", async () => {
      await saveProjectConfig(tempDir, { source: "github:test/repo" });

      const configPath = path.join(tempDir, ".claude-src", "config.yaml");
      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("source: github:test/repo");
    });

    it("should overwrite existing config", async () => {
      // Save initial config
      await saveProjectConfig(tempDir, { source: "github:first/repo" });

      // Save new config
      await saveProjectConfig(tempDir, { source: "github:second/repo" });

      const configPath = path.join(tempDir, ".claude-src", "config.yaml");
      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("github:second/repo");
      expect(content).not.toContain("github:first/repo");
    });

    it("should save marketplace to project config", async () => {
      await saveProjectConfig(tempDir, {
        marketplace: "https://my-marketplace.com/plugins",
      });

      const configPath = path.join(tempDir, ".claude-src", "config.yaml");
      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("marketplace: https://my-marketplace.com/plugins");
    });

    it("should save both source and marketplace", async () => {
      await saveProjectConfig(tempDir, {
        source: "github:myorg/skills",
        marketplace: "https://enterprise.example.com",
      });

      const configPath = path.join(tempDir, ".claude-src", "config.yaml");
      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("source: github:myorg/skills");
      expect(content).toContain("marketplace: https://enterprise.example.com");
    });
  });

  describe("resolveSource", () => {
    it("should return flag value with highest priority", async () => {
      // Set environment variable
      process.env[SOURCE_ENV_VAR] = "github:env/repo";

      const result = await resolveSource("github:flag/repo", tempDir);

      expect(result.source).toBe("github:flag/repo");
      expect(result.sourceOrigin).toBe("flag");
    });

    it("should return env value when no flag is provided", async () => {
      process.env[SOURCE_ENV_VAR] = "github:env/repo";

      const result = await resolveSource(undefined, tempDir);

      expect(result.source).toBe("github:env/repo");
      expect(result.sourceOrigin).toBe("env");
    });

    it("should return project config when no flag or env", async () => {
      // Create project config
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), "source: github:project/repo\n");

      const result = await resolveSource(undefined, tempDir);

      expect(result.source).toBe("github:project/repo");
      expect(result.sourceOrigin).toBe("project");
    });

    it("should return default when no config is set", async () => {
      const result = await resolveSource(undefined, tempDir);

      expect(result.sourceOrigin).toBe("default");
      expect(result.source).toBe(DEFAULT_SOURCE);
    });

    it("should handle undefined projectDir", async () => {
      const result = await resolveSource(undefined, undefined);

      expect(result.sourceOrigin).toBe("default");
      expect(result.source).toBe(DEFAULT_SOURCE);
    });

    it("should prioritize flag over all other sources", async () => {
      // Set everything
      process.env[SOURCE_ENV_VAR] = "github:env/repo";
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), "source: github:project/repo\n");

      const result = await resolveSource("github:flag/repo", tempDir);

      expect(result.source).toBe("github:flag/repo");
      expect(result.sourceOrigin).toBe("flag");
    });

    it("should prioritize env over project config", async () => {
      process.env[SOURCE_ENV_VAR] = "github:env/repo";
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), "source: github:project/repo\n");

      const result = await resolveSource(undefined, tempDir);

      expect(result.source).toBe("github:env/repo");
      expect(result.sourceOrigin).toBe("env");
    });

    it("should throw error for empty source flag", async () => {
      await expect(resolveSource("", tempDir)).rejects.toThrow(/--source flag cannot be empty/);
    });

    it("should throw error for whitespace-only source flag", async () => {
      await expect(resolveSource("   ", tempDir)).rejects.toThrow(/--source flag cannot be empty/);
    });

    describe("marketplace resolution", () => {
      it("should return marketplace from project config", async () => {
        const configDir = path.join(tempDir, ".claude-src");
        await mkdir(configDir, { recursive: true });
        await writeFile(
          path.join(configDir, "config.yaml"),
          "marketplace: https://my-company.com/plugins\n",
        );

        const result = await resolveSource(undefined, tempDir);

        expect(result.marketplace).toBe("https://my-company.com/plugins");
      });

      it("should return marketplace alongside source from project config", async () => {
        const configDir = path.join(tempDir, ".claude-src");
        await mkdir(configDir, { recursive: true });
        await writeFile(
          path.join(configDir, "config.yaml"),
          "source: github:mycompany/skills\nmarketplace: https://enterprise.example.com/plugins\n",
        );

        const result = await resolveSource(undefined, tempDir);

        expect(result.source).toBe("github:mycompany/skills");
        expect(result.sourceOrigin).toBe("project");
        expect(result.marketplace).toBe("https://enterprise.example.com/plugins");
      });

      it("should return undefined marketplace when not configured", async () => {
        const result = await resolveSource(undefined, tempDir);

        expect(result.marketplace).toBeUndefined();
      });
    });
  });

  describe("resolveAgentsSource", () => {
    it("should return flag value with highest priority", async () => {
      // Create project config with agents_source
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        "agents_source: https://project.example.com/agents\n",
      );

      const result = await resolveAgentsSource("https://flag.example.com/agents", tempDir);

      expect(result.agentsSource).toBe("https://flag.example.com/agents");
      expect(result.agentsSourceOrigin).toBe("flag");
    });

    it("should return project config when no flag is provided", async () => {
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        "agents_source: https://project.example.com/agents\n",
      );

      const result = await resolveAgentsSource(undefined, tempDir);

      expect(result.agentsSource).toBe("https://project.example.com/agents");
      expect(result.agentsSourceOrigin).toBe("project");
    });

    it("should return default when no config is set", async () => {
      const result = await resolveAgentsSource(undefined, tempDir);

      expect(result.agentsSourceOrigin).toBe("default");
      expect(result.agentsSource).toBeUndefined();
    });

    it("should handle undefined projectDir", async () => {
      const result = await resolveAgentsSource(undefined, undefined);

      expect(result.agentsSourceOrigin).toBe("default");
      expect(result.agentsSource).toBeUndefined();
    });

    it("should throw error for empty agent-source flag", async () => {
      await expect(resolveAgentsSource("", tempDir)).rejects.toThrow(
        /--agent-source flag cannot be empty/,
      );
    });

    it("should throw error for whitespace-only agent-source flag", async () => {
      await expect(resolveAgentsSource("   ", tempDir)).rejects.toThrow(
        /--agent-source flag cannot be empty/,
      );
    });
  });

  describe("loadProjectSourceConfig with agents_source", () => {
    it("should load agents_source from project config", async () => {
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        "agents_source: https://my-company.com/agents\n",
      );

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.agents_source).toBe("https://my-company.com/agents");
    });

    it("should load all config fields together", async () => {
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        "source: github:myorg/skills\nmarketplace: https://market.example.com\nagents_source: https://agents.example.com\n",
      );

      const config = await loadProjectSourceConfig(tempDir);
      expect(config?.source).toBe("github:myorg/skills");
      expect(config?.marketplace).toBe("https://market.example.com");
      expect(config?.agents_source).toBe("https://agents.example.com");
    });
  });

  describe("saveProjectConfig with agents_source", () => {
    it("should save agents_source to project config", async () => {
      await saveProjectConfig(tempDir, {
        agents_source: "https://my-agents.example.com",
      });

      const configPath = path.join(tempDir, ".claude-src", "config.yaml");
      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("agents_source: https://my-agents.example.com");
    });

    it("should save all config fields together", async () => {
      await saveProjectConfig(tempDir, {
        source: "github:myorg/skills",
        marketplace: "https://enterprise.example.com",
        agents_source: "https://agents.enterprise.example.com",
      });

      const configPath = path.join(tempDir, ".claude-src", "config.yaml");
      const content = await readFile(configPath, "utf-8");
      expect(content).toContain("source: github:myorg/skills");
      expect(content).toContain("marketplace: https://enterprise.example.com");
      expect(content).toContain("agents_source: https://agents.enterprise.example.com");
    });
  });
});
