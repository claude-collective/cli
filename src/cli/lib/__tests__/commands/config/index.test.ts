import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile, readFile } from "fs/promises";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import { runCliCommand, createTempDir, cleanupTempDir } from "../../helpers";
import { EXIT_CODES } from "../../../exit-codes";
import { DEFAULT_BRANDING } from "../../../../consts";

describe("config commands", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalCwd = process.cwd();
    originalEnv = { ...process.env };
    tempDir = await createTempDir("cc-config-test-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
    delete process.env.CC_SOURCE;
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.env = originalEnv;
    await cleanupTempDir(tempDir);
  });

  describe("config:path", () => {
    it("should display project config path", async () => {
      const { stdout } = await runCliCommand(["config:path"]);

      expect(stdout).toContain("Configuration File Paths");
      expect(stdout).toContain("Project:");
    });

    it("should show project config path containing current directory", async () => {
      const { stdout } = await runCliCommand(["config:path"]);

      expect(stdout).toContain(projectDir);
      expect(stdout).toContain(".claude-src/config.yaml");
    });
  });

  describe("config:show", () => {
    it("should display configuration overview", async () => {
      const { stdout } = await runCliCommand(["config:show"]);

      expect(stdout).toContain(`${DEFAULT_BRANDING.NAME} Configuration`);
      expect(stdout).toContain("Source:");
      expect(stdout).toContain("Configuration Layers:");
    });

    it("should show source value and origin", async () => {
      const { stdout } = await runCliCommand(["config:show"]);

      expect(stdout).toContain("Source:");
      expect(stdout).toMatch(/\(from (default|project|--source|CC_SOURCE)/);
    });

    it("should show environment variable when CC_SOURCE is set", async () => {
      process.env.CC_SOURCE = "/custom/source/path";

      const { stdout } = await runCliCommand(["config:show"]);

      expect(stdout).toContain("/custom/source/path");
      expect(stdout).toContain("CC_SOURCE");
    });

    it("should show project config values when configured", async () => {
      const projectConfigDir = path.join(projectDir, ".claude");
      await mkdir(projectConfigDir, { recursive: true });
      await writeFile(
        path.join(projectConfigDir, "config.yaml"),
        stringifyYaml({ source: "/project/source" }),
      );

      const { stdout } = await runCliCommand(["config:show"]);

      expect(stdout).toContain("/project/source");
    });

    it("should show precedence order", async () => {
      const { stdout } = await runCliCommand(["config:show"]);

      expect(stdout).toContain("Precedence: flag > env > project > default");
    });

    it("should show marketplace section", async () => {
      const { stdout } = await runCliCommand(["config:show"]);

      expect(stdout).toContain("Marketplace:");
    });

    it("should show agents source section", async () => {
      const { stdout } = await runCliCommand(["config:show"]);

      expect(stdout).toContain("Agents Source:");
    });
  });

  describe("config:get", () => {
    it("should get source value", async () => {
      const { stdout } = await runCliCommand(["config:get", "source"]);
      expect(stdout.trim().length).toBeGreaterThan(0);
    });

    it("should get source from CC_SOURCE environment variable", async () => {
      process.env.CC_SOURCE = "/env/source/path";

      const { stdout } = await runCliCommand(["config:get", "source"]);

      expect(stdout.trim()).toBe("/env/source/path");
    });

    it("should return author value (may be empty or set from project config)", async () => {
      const { stdout, error } = await runCliCommand(["config:get", "author"]);

      expect(error?.oclif?.exit).toBeUndefined();
      expect(typeof stdout).toBe("string");
    });

    it("should error on invalid key", async () => {
      const { error } = await runCliCommand(["config:get", "invalid-key"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
    });

    it("should accept valid keys", async () => {
      const validKeys = ["source", "author", "marketplace", "agents_source"];

      for (const key of validKeys) {
        const { error } = await runCliCommand(["config:get", key]);
        expect(error?.oclif?.exit).toBeUndefined();
      }
    });
  });

  describe("config (index)", () => {
    it("should display configuration overview", async () => {
      const { stdout } = await runCliCommand(["config"]);

      expect(stdout).toContain(`${DEFAULT_BRANDING.NAME} Configuration`);
      expect(stdout).toContain("Source:");
    });
  });

  describe("config:set-project", () => {
    const PROJECT_CONFIG_DIR = ".claude-src";
    const PROJECT_CONFIG_FILE = "config.yaml";

    it("should set source value and create config file", async () => {
      const { error } = await runCliCommand([
        "config:set-project",
        "source",
        "github:my-org/my-skills",
      ]);

      expect(error?.oclif?.exit).toBeUndefined();

      const configPath = path.join(projectDir, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");
      const parsed = parseYaml(content);
      expect(parsed).toHaveProperty("source", "github:my-org/my-skills");
    });

    it("should set marketplace value", async () => {
      const { error } = await runCliCommand([
        "config:set-project",
        "marketplace",
        "https://marketplace.example.com",
      ]);

      expect(error?.oclif?.exit).toBeUndefined();

      const configPath = path.join(projectDir, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");
      const parsed = parseYaml(content);
      expect(parsed).toHaveProperty("marketplace", "https://marketplace.example.com");
    });

    it("should set agents_source value", async () => {
      const { error } = await runCliCommand([
        "config:set-project",
        "agents_source",
        "/custom/agents",
      ]);

      expect(error?.oclif?.exit).toBeUndefined();

      const configPath = path.join(projectDir, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");
      const parsed = parseYaml(content);
      expect(parsed).toHaveProperty("agents_source", "/custom/agents");
    });

    it("should overwrite existing value", async () => {
      const configDir = path.join(projectDir, PROJECT_CONFIG_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, PROJECT_CONFIG_FILE),
        stringifyYaml({ source: "old-source", marketplace: "keep-this" }),
      );

      const { error } = await runCliCommand(["config:set-project", "source", "new-source"]);

      expect(error?.oclif?.exit).toBeUndefined();

      const configPath = path.join(projectDir, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");
      const parsed = parseYaml(content);
      expect(parsed).toHaveProperty("source", "new-source");
      expect(parsed).toHaveProperty("marketplace", "keep-this");
    });

    it("should reject invalid key with exit code 2", async () => {
      const { error } = await runCliCommand(["config:set-project", "invalid_key", "some-value"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
    });

    it("should error when key argument is missing", async () => {
      const { error } = await runCliCommand(["config:set-project"]);

      expect(error).toBeDefined();
    });

    it("should error when value argument is missing", async () => {
      const { error } = await runCliCommand(["config:set-project", "source"]);

      expect(error).toBeDefined();
    });
  });

  describe("config:unset-project", () => {
    const PROJECT_CONFIG_DIR = ".claude-src";
    const PROJECT_CONFIG_FILE = "config.yaml";

    it("should remove key from project config", async () => {
      const configDir = path.join(projectDir, PROJECT_CONFIG_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, PROJECT_CONFIG_FILE),
        stringifyYaml({
          source: "github:my-org/skills",
          marketplace: "https://marketplace.example.com",
        }),
      );

      const { error } = await runCliCommand(["config:unset-project", "source"]);

      expect(error?.oclif?.exit).toBeUndefined();

      const configPath = path.join(projectDir, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");
      const parsed = parseYaml(content);
      expect(parsed).not.toHaveProperty("source");
      expect(parsed).toHaveProperty("marketplace", "https://marketplace.example.com");
    });

    it("should handle config file not existing without error", async () => {
      const { error } = await runCliCommand(["config:unset-project", "source"]);
      expect(error?.oclif?.exit).toBeUndefined();
    });

    it("should reject invalid key with exit code 2", async () => {
      const { error } = await runCliCommand(["config:unset-project", "invalid_key"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
    });

    it("should error when key argument is missing", async () => {
      const { error } = await runCliCommand(["config:unset-project"]);

      expect(error).toBeDefined();
    });
  });
});
