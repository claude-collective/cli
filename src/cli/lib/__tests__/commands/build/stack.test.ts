/**
 * Integration tests for the build:stack command.
 *
 * Tests: cc build:stack, cc build:stack --stack, cc build:stack --output-dir, etc.
 *
 * The build:stack command compiles a stack into a standalone plugin:
 * - Default: Interactive selection if no stack specified
 * - --stack: Compile specific stack
 * - --output-dir: Custom output directory
 * - --agent-source: Remote agent partials source
 * - --refresh: Force refresh remote source
 * - --verbose: Enable verbose logging
 *
 * Note: Tests focus on:
 * - Flag validation (--stack, --output-dir, --agent-source, --refresh, --verbose)
 * - Error handling when no stacks found
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { runCliCommand } from "../../helpers";

// =============================================================================
// Tests
// =============================================================================

describe("build:stack command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-build-stack-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // Argument Validation
  // ===========================================================================

  describe("argument validation", () => {
    it("should require --stack flag when no stacks directory exists", async () => {
      // No stacks directory means command should error
      const { error } = await runCliCommand(["build:stack", "--stack", "test"]);

      // Should error because stacks directory doesn't exist or stack not found
      expect(error).toBeDefined();
    });
  });

  // ===========================================================================
  // Flag Validation
  // ===========================================================================

  describe("flag validation", () => {
    it("should accept --stack flag", async () => {
      const { error } = await runCliCommand(["build:stack", "--stack", "nonexistent-stack"]);

      // Should not error on --stack flag itself
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --output-dir flag with path", async () => {
      const outputPath = path.join(tempDir, "output");

      const { error } = await runCliCommand([
        "build:stack",
        "--stack",
        "test",
        "--output-dir",
        outputPath,
      ]);

      // Should not error on --output-dir flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -o shorthand for output-dir", async () => {
      const outputPath = path.join(tempDir, "output");

      const { error } = await runCliCommand(["build:stack", "--stack", "test", "-o", outputPath]);

      // Should accept -o shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --agent-source flag", async () => {
      const { error } = await runCliCommand([
        "build:stack",
        "--stack",
        "test",
        "--agent-source",
        "/path/to/agents",
      ]);

      // Should accept --agent-source flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --refresh flag", async () => {
      const { error } = await runCliCommand(["build:stack", "--stack", "test", "--refresh"]);

      // Should accept --refresh flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --verbose flag", async () => {
      const { error } = await runCliCommand(["build:stack", "--stack", "test", "--verbose"]);

      // Should not error on --verbose flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -v shorthand for verbose", async () => {
      const { error } = await runCliCommand(["build:stack", "--stack", "test", "-v"]);

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
      const outputPath = path.join(tempDir, "combined-output");

      const { error } = await runCliCommand([
        "build:stack",
        "--stack",
        "test-stack",
        "--output-dir",
        outputPath,
        "--verbose",
      ]);

      // Should accept all flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept shorthand flags together", async () => {
      const outputPath = path.join(tempDir, "shorthand-output");

      const { error } = await runCliCommand([
        "build:stack",
        "--stack",
        "test-stack",
        "-o",
        outputPath,
        "-v",
      ]);

      // Should accept all shorthand flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --verbose with --refresh", async () => {
      const { error } = await runCliCommand([
        "build:stack",
        "--stack",
        "test",
        "--verbose",
        "--refresh",
      ]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --agent-source with --refresh", async () => {
      const { error } = await runCliCommand([
        "build:stack",
        "--stack",
        "test",
        "--agent-source",
        "https://example.com/agents",
        "--refresh",
      ]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("error handling", () => {
    it("should error when stack not found", async () => {
      const { error } = await runCliCommand(["build:stack", "--stack", "nonexistent-stack-xyz"]);

      // Should exit with error when stack not found
      expect(error).toBeDefined();
    });

    it("should handle invalid agent-source path gracefully", async () => {
      const { error } = await runCliCommand([
        "build:stack",
        "--stack",
        "test",
        "--agent-source",
        "/definitely/not/real/path/xyz",
      ]);

      // Should error but not crash
      expect(error).toBeDefined();
    });
  });
});
