import { mkdir, mkdtemp, rm, writeFile, readFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { saveSourceToProjectConfig } from "./config-saver";

const CLAUDE_SRC_DIR = ".claude-src";
const CONFIG_FILE = "config.yaml";

describe("config-saver", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-config-saver-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("saveSourceToProjectConfig", () => {
    it("creates config file with source when no config exists", async () => {
      await saveSourceToProjectConfig(tempDir, "github:my-org/skills");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");
      const config = parseYaml(content) as Record<string, unknown>;

      expect(config.source).toBe("github:my-org/skills");
    });

    it("creates .claude-src directory if it does not exist", async () => {
      await saveSourceToProjectConfig(tempDir, "github:test/repo");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");

      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
    });

    it("preserves existing config fields when adding source", async () => {
      // Write existing config with other fields
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, CONFIG_FILE),
        stringifyYaml({
          name: "my-project",
          agents: ["web-developer"],
          author: "@vince",
        }),
      );

      await saveSourceToProjectConfig(tempDir, "github:new/source");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");
      const config = parseYaml(content) as Record<string, unknown>;

      expect(config.source).toBe("github:new/source");
      expect(config.name).toBe("my-project");
      expect(config.agents).toEqual(["web-developer"]);
      expect(config.author).toBe("@vince");
    });

    it("overwrites existing source value", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, CONFIG_FILE),
        stringifyYaml({
          source: "github:old/source",
          name: "project",
        }),
      );

      await saveSourceToProjectConfig(tempDir, "github:new/source");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");
      const config = parseYaml(content) as Record<string, unknown>;

      expect(config.source).toBe("github:new/source");
      expect(config.name).toBe("project");
    });

    it("handles malformed YAML gracefully by starting with empty config", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, CONFIG_FILE), "not: [valid: yaml: {broken");

      await saveSourceToProjectConfig(tempDir, "github:my-org/skills");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");
      const config = parseYaml(content) as Record<string, unknown>;

      expect(config.source).toBe("github:my-org/skills");
    });

    it("handles YAML that parses to null (empty file)", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, CONFIG_FILE), "");

      await saveSourceToProjectConfig(tempDir, "github:my-org/skills");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");
      const config = parseYaml(content) as Record<string, unknown>;

      expect(config.source).toBe("github:my-org/skills");
    });

    it("handles YAML that parses to an array (not object)", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, CONFIG_FILE), "- item1\n- item2\n");

      await saveSourceToProjectConfig(tempDir, "github:my-org/skills");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");
      const config = parseYaml(content) as Record<string, unknown>;

      // Should discard the array and start fresh
      expect(config.source).toBe("github:my-org/skills");
    });

    it("handles YAML that parses to a scalar (string)", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, CONFIG_FILE), "just a string\n");

      await saveSourceToProjectConfig(tempDir, "github:my-org/skills");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");
      const config = parseYaml(content) as Record<string, unknown>;

      expect(config.source).toBe("github:my-org/skills");
    });

    it("writes valid YAML output", async () => {
      await saveSourceToProjectConfig(tempDir, "github:my-org/skills");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");

      // Should not throw when re-parsing
      const config = parseYaml(content);
      expect(config).toBeDefined();
      expect(typeof config).toBe("object");
    });
  });
});
