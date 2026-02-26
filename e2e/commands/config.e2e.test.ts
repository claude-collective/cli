import path from "path";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
  readTestFile,
  runCLI,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";

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

      const { exitCode, stdout } = await runCLI(["config", "show"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Configuration");
      expect(stdout).toContain("Source:");
      expect(stdout).toContain("Configuration Layers:");
      expect(stdout).toContain("Precedence:");
    });

    it("should show default source when no project config exists", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await runCLI(["config", "show"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("(from default)");
      expect(stdout).toContain("Default:");
    });
  });

  describe("config path", () => {
    it("should display configuration file path", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await runCLI(["config", "path"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Configuration File Paths:");
      expect(stdout).toContain("Project:");
      expect(stdout).toContain("config.yaml");
    });
  });

  describe("config get", () => {
    it("should return default source value", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await runCLI(["config", "get", "source"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("github:");
    });

    it("should fail with invalid key", async () => {
      tempDir = await createTempDir();

      const { exitCode, combined } = await runCLI(["config", "get", "invalid-key"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
      expect(combined).toContain("Unknown configuration key");
      expect(combined).toContain("Valid keys:");
    });

    it("should return empty for unconfigured author", async () => {
      tempDir = await createTempDir();

      const { exitCode } = await runCLI(["config", "get", "author"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it("should return empty for unconfigured marketplace", async () => {
      tempDir = await createTempDir();

      const { exitCode } = await runCLI(["config", "get", "marketplace"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it("should return empty for unconfigured agentsSource", async () => {
      tempDir = await createTempDir();

      const { exitCode } = await runCLI(["config", "get", "agentsSource"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    });
  });

  describe("config set-project", () => {
    it("should display help text", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await runCLI(["config", "set-project", "--help"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Set a project-level configuration value");
    });

    it("should set the source configuration value", async () => {
      tempDir = await createTempDir();
      const testSource = "/tmp/test-skills-source";

      const { exitCode, stdout } = await runCLI(
        ["config", "set-project", "source", testSource],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Set source");
      expect(stdout).toContain(testSource);

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);
      expect(await fileExists(configPath)).toBe(true);

      const configContent = await readTestFile(configPath);
      expect(configContent).toContain("source:");
      expect(configContent).toContain(testSource);
    });

    it("should fail with no arguments", async () => {
      tempDir = await createTempDir();

      const { exitCode, combined } = await runCLI(["config", "set-project"], tempDir);

      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
      expect(combined).toContain("Missing");
    });

    it("should fail with invalid key", async () => {
      tempDir = await createTempDir();

      const { exitCode, combined } = await runCLI(
        ["config", "set-project", "badkey", "somevalue"],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
      expect(combined).toContain("Unknown configuration key");
      expect(combined).toContain("Valid keys:");
    });
  });

  describe("config unset-project", () => {
    it("should display help text", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await runCLI(["config", "unset-project", "--help"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Remove a project-level configuration value");
    });

    it("should remove a previously set source value", async () => {
      tempDir = await createTempDir();

      const { exitCode: setupExitCode } = await runCLI(
        ["config", "set-project", "source", "/tmp/src"],
        tempDir,
      );
      expect(setupExitCode).toBe(EXIT_CODES.SUCCESS);

      const { exitCode, stdout } = await runCLI(["config", "unset-project", "source"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Removed source");
    });

    it("should handle unset when no project config exists", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await runCLI(["config", "unset-project", "source"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("No project configuration exists");
    });

    it("should fail with invalid key", async () => {
      tempDir = await createTempDir();

      const { exitCode, combined } = await runCLI(
        ["config", "unset-project", "badkey"],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
      expect(combined).toContain("Unknown configuration key");
      expect(combined).toContain("Valid keys:");
    });
  });

  describe("config (bare)", () => {
    it("should display the same as config show", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await runCLI(["config"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Configuration");
      expect(stdout).toContain("Source:");
    });
  });
});
