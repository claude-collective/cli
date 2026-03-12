import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveSourceToProjectConfig } from "./config-saver";
import { createTempDir, cleanupTempDir, readTestTsConfig } from "../__tests__/helpers";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../consts";
import { renderConfigTs } from "../__tests__/content-generators";

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
      await saveSourceToProjectConfig(tempDir, "github:my-org/skills", "my-project");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const config = await readTestTsConfig<Record<string, unknown>>(configPath);

      expect(config.source).toBe("github:my-org/skills");
      expect(config.name).toBe("my-project");
    });

    it("creates .claude-src directory if it does not exist", async () => {
      await saveSourceToProjectConfig(tempDir, "github:test/repo", "test-project");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const content = await readFile(configPath, "utf-8");

      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain("export default");
      expect(content).toContain('import type { ProjectConfig } from "./config-types"');
      expect(content).toContain("satisfies ProjectConfig");
    });

    it("preserves existing config fields when adding source", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_TS),
        renderConfigTs({
          name: "my-project",
          agents: ["web-developer"],
          author: "@vince",
        }),
      );

      await saveSourceToProjectConfig(tempDir, "github:new/source", "fallback-name");

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
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_TS),
        renderConfigTs({
          source: "github:old/source",
          name: "project",
        }),
      );

      await saveSourceToProjectConfig(tempDir, "github:new/source", "fallback-name");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const config = await readTestTsConfig<Record<string, unknown>>(configPath);

      expect(config.source).toBe("github:new/source");
      expect(config.name).toBe("project");
    });

    it("uses provided name when config file is invalid", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_TS),
        "invalid typescript content {{",
      );

      await saveSourceToProjectConfig(tempDir, "github:my-org/skills", "recovered-project");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const config = await readTestTsConfig<Record<string, unknown>>(configPath);

      expect(config.source).toBe("github:my-org/skills");
      expect(config.name).toBe("recovered-project");
    });

    it("uses provided name when config file is empty", async () => {
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, STANDARD_FILES.CONFIG_TS), "");

      await saveSourceToProjectConfig(tempDir, "github:my-org/skills", "empty-project");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const config = await readTestTsConfig<Record<string, unknown>>(configPath);

      expect(config.source).toBe("github:my-org/skills");
      expect(config.name).toBe("empty-project");
    });

    it("writes valid config output with type annotation and satisfies clause", async () => {
      await saveSourceToProjectConfig(tempDir, "github:my-org/skills", "test-project");

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const content = await readFile(configPath, "utf-8");

      expect(content).toContain("export default");
      expect(content).toContain('import type { ProjectConfig } from "./config-types"');
      expect(content).toContain("satisfies ProjectConfig");
    });
  });
});
