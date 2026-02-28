import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { runCliCommand, createTempDir, cleanupTempDir } from "../../helpers";
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
      expect(stdout).toContain(".claude-src/config.ts");
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
      const projectConfigDir = path.join(projectDir, ".claude-src");
      await mkdir(projectConfigDir, { recursive: true });
      await writeFile(
        path.join(projectConfigDir, "config.ts"),
        `export default ${JSON.stringify({ source: "/project/source" })};`,
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

  describe("config (index)", () => {
    it("should display configuration overview", async () => {
      const { stdout } = await runCliCommand(["config"]);

      expect(stdout).toContain(`${DEFAULT_BRANDING.NAME} Configuration`);
      expect(stdout).toContain("Source:");
    });
  });
});
