import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  runCLI,
  EXIT_CODES,
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
      expect(stdout).toContain("config.ts");
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
