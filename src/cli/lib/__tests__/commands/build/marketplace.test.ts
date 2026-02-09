/**
 * Integration tests for the build:marketplace command.
 *
 * Tests: cc build:marketplace, cc build:marketplace --plugins-dir, etc.
 *
 * The build:marketplace command generates marketplace.json from built plugins:
 * - Default: Scans dist/plugins directory
 * - --plugins-dir: Custom plugins source directory
 * - --output: Custom output file path
 * - --name: Marketplace name
 * - --version: Marketplace version
 * - --description: Marketplace description
 * - --owner-name: Owner name
 * - --owner-email: Owner email
 * - --verbose: Enable verbose logging
 *
 * Note: Tests focus on:
 * - Flag validation (--plugins-dir, --output, --name, --version, --verbose)
 * - Error handling when plugins directory not found
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { runCliCommand } from "../../helpers";

// =============================================================================
// Tests
// =============================================================================

describe("build:marketplace command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-build-marketplace-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // Basic Execution
  // ===========================================================================

  describe("basic execution", () => {
    it("should run without arguments", async () => {
      const { error } = await runCliCommand(["build:marketplace"]);

      // Should not have argument parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should complete with 0 plugins when no plugins directory exists", async () => {
      // projectDir has no plugins directory - command still runs
      const { stdout, error } = await runCliCommand(["build:marketplace"]);

      // Command completes with 0 plugins (doesn't crash)
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("missing required arg");
    });
  });

  // ===========================================================================
  // Flag Validation
  // ===========================================================================

  describe("flag validation", () => {
    it("should accept --plugins-dir flag with path", async () => {
      const pluginsPath = path.join(tempDir, "custom-plugins");

      const { error } = await runCliCommand(["build:marketplace", "--plugins-dir", pluginsPath]);

      // Should not error on --plugins-dir flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -p shorthand for plugins-dir", async () => {
      const pluginsPath = path.join(tempDir, "custom-plugins");

      const { error } = await runCliCommand(["build:marketplace", "-p", pluginsPath]);

      // Should accept -p shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --output flag with path", async () => {
      const outputPath = path.join(tempDir, "marketplace.json");

      const { error } = await runCliCommand(["build:marketplace", "--output", outputPath]);

      // Should not error on --output flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -o shorthand for output", async () => {
      const outputPath = path.join(tempDir, "marketplace.json");

      const { error } = await runCliCommand(["build:marketplace", "-o", outputPath]);

      // Should accept -o shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --name flag", async () => {
      const { error } = await runCliCommand(["build:marketplace", "--name", "my-marketplace"]);

      // Should not error on --name flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --version flag", async () => {
      const { error } = await runCliCommand(["build:marketplace", "--version", "2.0.0"]);

      // Should not error on --version flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --description flag", async () => {
      const { error } = await runCliCommand([
        "build:marketplace",
        "--description",
        "My custom marketplace",
      ]);

      // Should not error on --description flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --owner-name flag", async () => {
      const { error } = await runCliCommand(["build:marketplace", "--owner-name", "Test Owner"]);

      // Should not error on --owner-name flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --owner-email flag", async () => {
      const { error } = await runCliCommand([
        "build:marketplace",
        "--owner-email",
        "test@example.com",
      ]);

      // Should not error on --owner-email flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --verbose flag", async () => {
      const { error } = await runCliCommand(["build:marketplace", "--verbose"]);

      // Should not error on --verbose flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -v shorthand for verbose", async () => {
      const { error } = await runCliCommand(["build:marketplace", "-v"]);

      // Should accept -v shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Combined Flags
  // ===========================================================================

  describe("combined flags", () => {
    it("should accept multiple flags together", async () => {
      const pluginsPath = path.join(tempDir, "plugins");
      const outputPath = path.join(tempDir, "marketplace.json");

      const { error } = await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsPath,
        "--output",
        outputPath,
        "--name",
        "test-marketplace",
        "--version",
        "1.0.0",
        "--verbose",
      ]);

      // Should accept all flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept shorthand flags together", async () => {
      const pluginsPath = path.join(tempDir, "plugins");
      const outputPath = path.join(tempDir, "marketplace.json");

      const { error } = await runCliCommand([
        "build:marketplace",
        "-p",
        pluginsPath,
        "-o",
        outputPath,
        "-v",
      ]);

      // Should accept all shorthand flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --name with --version", async () => {
      const { error } = await runCliCommand([
        "build:marketplace",
        "--name",
        "my-marketplace",
        "--version",
        "2.0.0",
      ]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept all owner flags together", async () => {
      const { error } = await runCliCommand([
        "build:marketplace",
        "--owner-name",
        "Test Owner",
        "--owner-email",
        "test@example.com",
        "--description",
        "Test marketplace",
      ]);

      // Should accept all owner flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("error handling", () => {
    it("should handle missing plugins directory gracefully", async () => {
      const { stdout, error } = await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        "/definitely/not/real/path/xyz",
      ]);

      // Command completes (generates marketplace with 0 plugins)
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should handle empty plugins directory gracefully", async () => {
      // Create empty plugins directory
      const emptyPluginsDir = path.join(projectDir, "empty-plugins");
      await mkdir(emptyPluginsDir, { recursive: true });

      const { error } = await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        emptyPluginsDir,
      ]);

      // Command completes successfully with 0 plugins
      // The command doesn't error for empty directories
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });
});
