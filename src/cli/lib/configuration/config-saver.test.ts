import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveSourceToProjectConfig } from "./config-saver";
import { createTempDir, cleanupTempDir, readTestTsConfig } from "../__tests__/helpers";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../consts";

describe("config-saver", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("cc-config-saver-test-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("saveSourceToProjectConfig", () => {
    it("creates config file with source when no config exists", async () => {
      await saveSourceToProjectConfig(tempDir, "github:my-org/skills");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const config = await readTestTsConfig<Record<string, unknown>>(configPath);

      expect(config.source).toBe("github:my-org/skills");
    });

    it("creates .claude-src directory if it does not exist", async () => {
      await saveSourceToProjectConfig(tempDir, "github:test/repo");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const content = await readFile(configPath, "utf-8");

      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain("export default");
    });

    it("preserves existing config fields when adding source", async () => {
      // Write existing config as TS
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      const existingContent = `export default ${JSON.stringify({
        name: "my-project",
        agents: ["web-developer"],
        author: "@vince",
      })};`;
      await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_TS), existingContent);

      await saveSourceToProjectConfig(tempDir, "github:new/source");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const config = await readTestTsConfig<Record<string, unknown>>(configPath);

      expect(config.source).toBe("github:new/source");
      expect(config.name).toBe("my-project");
      expect(config.agents).toEqual(["web-developer"]);
      expect(config.author).toBe("@vince");
    });

    it("overwrites existing source value", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      const existingContent = `export default ${JSON.stringify({
        source: "github:old/source",
        name: "project",
      })};`;
      await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_TS), existingContent);

      await saveSourceToProjectConfig(tempDir, "github:new/source");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const config = await readTestTsConfig<Record<string, unknown>>(configPath);

      expect(config.source).toBe("github:new/source");
      expect(config.name).toBe("project");
    });

    it("handles invalid config gracefully by starting with empty config", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_TS),
        "invalid typescript content {{",
      );

      await saveSourceToProjectConfig(tempDir, "github:my-org/skills");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const config = await readTestTsConfig<Record<string, unknown>>(configPath);

      expect(config.source).toBe("github:my-org/skills");
    });

    it("handles empty config file gracefully", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_TS), "");

      await saveSourceToProjectConfig(tempDir, "github:my-org/skills");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const config = await readTestTsConfig<Record<string, unknown>>(configPath);

      expect(config.source).toBe("github:my-org/skills");
    });

    it("writes valid config output", async () => {
      await saveSourceToProjectConfig(tempDir, "github:my-org/skills");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const content = await readFile(configPath, "utf-8");

      // Should be valid config format
      expect(content).toContain("export default");
      const config = await readTestTsConfig<Record<string, unknown>>(configPath);
      expect(config).toBeDefined();
      expect(typeof config).toBe("object");
    });
  });
});
