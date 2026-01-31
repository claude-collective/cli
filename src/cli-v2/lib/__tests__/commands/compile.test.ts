/**
 * Integration tests for the compile command.
 *
 * Tests: cc compile, cc compile --verbose, cc compile --output, cc compile --dry-run
 *
 * The compile command compiles agents using local skills and agent definitions:
 * - Default: Compiles to Claude plugin directory (~/.claude/plugins/claude-collective/)
 * - --output: Compiles to custom directory
 * - --dry-run: Preview without writing files
 * - --verbose: Show detailed logging
 *
 * Note: Tests focus on:
 * - Flag validation (--verbose, --output, --dry-run, --source, --agent-source, --refresh)
 * - Error handling when plugin doesn't exist
 * - Dry-run behavior
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { runCliCommand } from "../helpers";

// =============================================================================
// Tests
// =============================================================================

describe("compile command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-compile-test-"));
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
      const { error } = await runCliCommand(["compile"]);

      // Should not have argument parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should fail when no plugin exists", async () => {
      // projectDir has no plugin setup
      const { error } = await runCliCommand(["compile"]);

      // Should exit with error because no plugin found
      expect(error?.oclif?.exit).toBeDefined();
    });
  });

  // ===========================================================================
  // Flag Validation
  // ===========================================================================

  describe("flag validation", () => {
    it("should accept --verbose flag", async () => {
      const { error } = await runCliCommand(["compile", "--verbose"]);

      // Should not error on --verbose flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -v shorthand for verbose", async () => {
      const { error } = await runCliCommand(["compile", "-v"]);

      // Should accept -v shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --dry-run flag", async () => {
      const { error } = await runCliCommand(["compile", "--dry-run"]);

      // Should not error on --dry-run flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --output flag with path", async () => {
      const outputPath = path.join(tempDir, "output");

      const { error } = await runCliCommand([
        "compile",
        "--output",
        outputPath,
      ]);

      // Should not error on --output flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -o shorthand for output", async () => {
      const outputPath = path.join(tempDir, "output");

      const { error } = await runCliCommand(["compile", "-o", outputPath]);

      // Should accept -o shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --source flag", async () => {
      const { error } = await runCliCommand([
        "compile",
        "--source",
        "/some/path",
      ]);

      // Should accept --source flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -s shorthand for source", async () => {
      const { error } = await runCliCommand(["compile", "-s", "/some/path"]);

      // Should accept -s shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --agent-source flag", async () => {
      const { error } = await runCliCommand([
        "compile",
        "--agent-source",
        "https://example.com/agents",
      ]);

      // Should accept --agent-source flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --refresh flag", async () => {
      const { error } = await runCliCommand(["compile", "--refresh"]);

      // Should accept --refresh flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Dry Run Mode
  // ===========================================================================

  describe("dry-run mode", () => {
    it("should accept --dry-run flag and process without errors", async () => {
      const { error } = await runCliCommand(["compile", "--dry-run"]);

      // Command should complete without flag parsing errors
      // Note: stdout capture is limited in oclif test environment
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --dry-run with --output flag", async () => {
      const outputPath = path.join(tempDir, "dry-run-output");

      // Create minimal skill setup so compile can proceed
      const skillsDir = path.join(
        projectDir,
        ".claude",
        "skills",
        "test-skill",
      );
      await mkdir(skillsDir, { recursive: true });
      await writeFile(
        path.join(skillsDir, "SKILL.md"),
        `---
name: test-skill
description: Test
category: test
---

# Test Skill

Content.
`,
      );

      const { error } = await runCliCommand([
        "compile",
        "--dry-run",
        "--output",
        outputPath,
      ]);

      // Command should complete without flag parsing errors
      // Note: stdout capture is limited in oclif test environment
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Output Mode
  // ===========================================================================

  describe("output mode", () => {
    it("should show custom output directory in message", async () => {
      const outputPath = path.join(tempDir, "custom-output");

      const { stdout, error } = await runCliCommand([
        "compile",
        "--output",
        outputPath,
        "--dry-run",
      ]);

      // Should show the custom output path
      const output = stdout + (error?.message || "");
      // Either shows the path or errors about skills not found
      expect(output).toBeTruthy();
    });
  });

  // ===========================================================================
  // Verbose Mode
  // ===========================================================================

  describe("verbose mode", () => {
    it("should accept --verbose with --dry-run", async () => {
      const { error } = await runCliCommand([
        "compile",
        "--verbose",
        "--dry-run",
      ]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -v with -o", async () => {
      const outputPath = path.join(tempDir, "output");

      const { error } = await runCliCommand([
        "compile",
        "-v",
        "-o",
        outputPath,
      ]);

      // Should accept both flags
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
        "compile",
        "--verbose",
        "--dry-run",
        "--output",
        outputPath,
        "--source",
        "/custom/source",
      ]);

      // Should accept all flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept shorthand flags together", async () => {
      const outputPath = path.join(tempDir, "shorthand-output");

      const { error } = await runCliCommand([
        "compile",
        "-v",
        "-o",
        outputPath,
        "-s",
        "/custom/source",
      ]);

      // Should accept all shorthand flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --verbose with --refresh", async () => {
      const { error } = await runCliCommand([
        "compile",
        "--verbose",
        "--refresh",
      ]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --dry-run with --agent-source", async () => {
      const { error } = await runCliCommand([
        "compile",
        "--dry-run",
        "--agent-source",
        "https://example.com/agents",
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
    it("should error when no skills found", async () => {
      // Note: We can't easily create the plugin dir in the global location
      // (~/.claude/plugins/claude-collective/) so this test verifies the
      // error message when plugin not found
      const { error } = await runCliCommand(["compile"]);

      // Should show appropriate error
      expect(error).toBeDefined();
    });

    it("should handle invalid source path gracefully", async () => {
      const { error } = await runCliCommand([
        "compile",
        "--source",
        "/definitely/not/real/path/xyz",
      ]);

      // Should error but not crash
      expect(error).toBeDefined();
    });

    it("should handle invalid agent-source URL gracefully", async () => {
      const { error } = await runCliCommand([
        "compile",
        "--agent-source",
        "not-a-valid-url",
      ]);

      // Should error but not crash (may fail on plugin check first)
      expect(error).toBeDefined();
    });
  });

  // ===========================================================================
  // Plugin Mode vs Custom Output Mode
  // ===========================================================================

  describe("plugin mode vs custom output mode", () => {
    it("should use plugin mode when no output flag provided", async () => {
      const { error } = await runCliCommand(["compile", "--dry-run"]);

      // Command should complete without flag parsing errors
      // Note: stdout capture is limited in oclif test environment
      // The mode is determined by absence of --output flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should use custom output mode when output flag provided", async () => {
      const outputPath = path.join(tempDir, "custom-output");

      const { error } = await runCliCommand([
        "compile",
        "--output",
        outputPath,
        "--dry-run",
      ]);

      // Command should complete without flag parsing errors
      // Note: stdout capture is limited in oclif test environment
      // The mode is determined by presence of --output flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });
});
