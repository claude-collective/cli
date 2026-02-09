/**
 * Integration tests for the info command.
 *
 * Tests: cc info <skill>, cc info --preview, cc info --no-preview
 *
 * The info command displays detailed information about a skill including:
 * - Skill metadata (id, alias, author, category)
 * - Description and tags
 * - Requirements and relationships
 * - Installation status
 * - Content preview from SKILL.md
 *
 * Note: The info command requires a skill argument and loads from skills source.
 * Tests focus on:
 * - Argument validation (skill required)
 * - Flag handling (--preview, --no-preview)
 * - Error handling for non-existent skills
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { runCliCommand } from "../helpers";

// =============================================================================
// Tests
// =============================================================================

describe("info command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-info-test-"));
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
    it("should require skill argument", async () => {
      const { error } = await runCliCommand(["info"]);

      // Should error because skill is required
      expect(error).toBeDefined();
      expect(error?.message?.toLowerCase()).toContain("missing");
    });

    it("should accept skill as first argument", async () => {
      const { stdout, error } = await runCliCommand(["info", "react"]);

      // Should start processing (may fail due to source issues, but should accept the arg)
      // Either shows "Loading skills..." or errors on source, not on missing argument
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("missing required arg");
    });
  });

  // ===========================================================================
  // Flag Validation
  // ===========================================================================

  describe("flag validation", () => {
    it("should accept --preview flag", async () => {
      const { error } = await runCliCommand(["info", "react", "--preview"]);

      // Should not error on --preview flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --no-preview flag", async () => {
      const { error } = await runCliCommand(["info", "react", "--no-preview"]);

      // Should not error on --no-preview flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --source flag", async () => {
      const { error } = await runCliCommand(["info", "react", "--source", "/nonexistent/path"]);

      // Should not error on --source flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -s shorthand for source", async () => {
      const { error } = await runCliCommand(["info", "react", "-s", "/nonexistent/path"]);

      // Should not error on shorthand flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });

  // ===========================================================================
  // Output Behavior
  // ===========================================================================

  // Skip: stdout capture limited in oclif/bun test environment
  describe("output behavior", () => {
    it.skip("should process skill lookup and produce output or error", async () => {
      const { stdout, error } = await runCliCommand(["info", "react"]);

      // Command should execute and produce either output or skill-not-found error
      // Note: stdout capture is limited in oclif test environment
      const output = stdout + (error?.message || "");
      // Should either find the skill or report not found (both valid outcomes)
      expect(output.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("error handling", () => {
    it("should exit with error for non-existent skill", async () => {
      const { error } = await runCliCommand(["info", "nonexistent-skill-xyz"]);

      // Should exit with error when skill not found (after loading)
      // Either exits with error or shows "not found" message
      expect(error).toBeDefined();
    });

    it("should handle invalid source path gracefully", async () => {
      const { error } = await runCliCommand([
        "info",
        "react",
        "--source",
        "/definitely/not/a/real/path/12345",
      ]);

      // Should error but not crash
      expect(error).toBeDefined();
    });
  });

  // ===========================================================================
  // Combined Flags
  // ===========================================================================

  describe("combined flags", () => {
    it("should accept --no-preview with --source", async () => {
      const { error } = await runCliCommand([
        "info",
        "react",
        "--no-preview",
        "--source",
        "/some/path",
      ]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -s with --preview", async () => {
      const { error } = await runCliCommand(["info", "react", "--preview", "-s", "/some/path"]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });
});
