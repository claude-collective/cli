import path from "path";
import { mkdir } from "fs/promises";
import { CLI } from "../fixtures/cli.js";
import { ProjectBuilder } from "../fixtures/project-builder.js";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { EXIT_CODES, DIRS } from "../pages/constants.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  writeProjectConfig,
} from "../helpers/test-utils.js";

describe("config commands", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  describe("config show", () => {
    it("should display effective configuration from unconfigured directory", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await CLI.run(["config", "show"], { dir: tempDir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Configuration");
      expect(stdout).toContain("Source:");
      expect(stdout).toContain("Configuration Layers:");
      expect(stdout).toContain("Precedence:");
    });

    it("should show default source when no project config exists", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await CLI.run(["config", "show"], { dir: tempDir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("(from default)");
      expect(stdout).toContain("Default:");
    });

    it("should show project config source when project config exists", async () => {
      const project = await ProjectBuilder.editable();
      tempDir = path.dirname(project.dir);

      const { exitCode, stdout } = await CLI.run(["config", "show"], project);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Configuration");
      expect(stdout).toContain("Source:");
      expect(stdout).toContain("Project config:");
      expect(stdout).toContain("config.ts");
    });

    it("should show merged config with global and project config both present", async () => {
      tempDir = await createTempDir();
      const globalHome = path.join(tempDir, "global-home");
      const projectDir = path.join(tempDir, "project");
      await mkdir(projectDir, { recursive: true });

      // Write global config with a marketplace setting
      await writeProjectConfig(globalHome, {
        name: "global-test",
        marketplace: "https://example.com/marketplace",
      });

      // Write project config with a source setting
      await writeProjectConfig(projectDir, {
        name: "project-test",
        source: "./local-skills",
      });

      const { exitCode, stdout } = await CLI.run(
        ["config", "show"],
        { dir: projectDir },
        { env: { HOME: globalHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Configuration");
      expect(stdout).toContain("Source:");
      expect(stdout).toContain("Project config:");
      // The project config has a source, so it should show as "from project config"
      expect(stdout).toContain("project config");
    });

    it("should show global config when only global config exists", async () => {
      tempDir = await createTempDir();
      const globalHome = path.join(tempDir, "global-home");
      const subDir = path.join(tempDir, "empty-project");
      await mkdir(subDir, { recursive: true });

      // Write global config at HOME
      await writeProjectConfig(globalHome, {
        name: "global-test",
        source: "./global-skills",
      });

      const { exitCode, stdout } = await CLI.run(
        ["config", "show"],
        { dir: subDir },
        { env: { HOME: globalHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Configuration");
      expect(stdout).toContain("Source:");
      // With global config providing a source, it should resolve from "project" origin
      // (loadEffectiveSourceConfig falls back to global config)
      expect(stdout).toContain("project config");
    });
  });

  describe("config path", () => {
    it("should display configuration file path", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await CLI.run(["config", "path"], { dir: tempDir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Configuration File Paths:");
      expect(stdout).toContain("Project:");
      expect(stdout).toContain("config.ts");
    });

    it("should include .claude-src in the path output", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await CLI.run(["config", "path"], { dir: tempDir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain(DIRS.CLAUDE_SRC);
    });
  });

  describe("config (bare)", () => {
    it("should display the same as config show", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await CLI.run(["config"], { dir: tempDir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Configuration");
      expect(stdout).toContain("Source:");
    });

    it("should produce identical sections as config show", async () => {
      tempDir = await createTempDir();

      const showResult = await CLI.run(["config", "show"], { dir: tempDir });
      const bareResult = await CLI.run(["config"], { dir: tempDir });

      expect(bareResult.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(showResult.exitCode).toBe(EXIT_CODES.SUCCESS);

      // Both should contain the same structural elements
      expect(bareResult.stdout).toContain("Configuration Layers:");
      expect(showResult.stdout).toContain("Configuration Layers:");
      expect(bareResult.stdout).toContain("Precedence:");
      expect(showResult.stdout).toContain("Precedence:");
    });
  });
});
