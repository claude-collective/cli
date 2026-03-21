import path from "path";
import { CLI } from "../fixtures/cli.js";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { EXIT_CODES } from "../pages/constants.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
} from "../helpers/test-utils.js";

describe("build commands", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  describe("build plugins", () => {
    it("should display help text", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await CLI.run(["build", "plugins", "--help"], { dir: tempDir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Build skills and agents into standalone plugins");
    });

    it("should complete with zero plugins when no source directory exists", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await CLI.run(["build", "plugins"], { dir: tempDir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Compiling skill plugins");
      expect(stdout).toContain("Compiled 0 skill plugins");
      expect(stdout).toContain("Plugin compilation complete!");
    });

    it("should error when --skill references a nonexistent path", async () => {
      tempDir = await createTempDir();

      const { exitCode, output } = await CLI.run(
        ["build", "plugins", "--skill", "nonexistent-skill"],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("Compilation failed");
    });

    it("should use a custom output directory with --output-dir", async () => {
      tempDir = await createTempDir();
      const customOutputDir = path.join(tempDir, "custom-plugins");

      const { exitCode, stdout } = await CLI.run(
        ["build", "plugins", "--output-dir", customOutputDir],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain(customOutputDir);
      expect(stdout).toContain("Plugin compilation complete!");
    });

    it("should accept --verbose flag", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await CLI.run(["build", "plugins", "--verbose"], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Compiling skill plugins");
    });
  });

  describe("build marketplace", () => {
    it("should display help text", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await CLI.run(["build", "marketplace", "--help"], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Generate marketplace.json from built plugins");
    });

    it("should complete with zero plugins when no plugins directory exists", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await CLI.run(["build", "marketplace"], { dir: tempDir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Generating marketplace.json");
      expect(stdout).toContain("Found 0 plugins");
      expect(stdout).toContain("Marketplace generated with 0 plugins!");
    });

    it("should write output to a custom path with --output", async () => {
      tempDir = await createTempDir();
      const customOutput = path.join(tempDir, "custom-marketplace.json");

      const { exitCode, stdout } = await CLI.run(
        ["build", "marketplace", "--output", customOutput],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain(customOutput);
      expect(stdout).toContain("Marketplace generated with 0 plugins!");
      expect(await fileExists(customOutput)).toBe(true);
    });

    it("should use a custom marketplace name with --name", async () => {
      tempDir = await createTempDir();
      const customName = "my-custom-marketplace";

      const { exitCode, stdout } = await CLI.run(["build", "marketplace", "--name", customName], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Marketplace generated with 0 plugins!");
    });
  });
});
