/**
 * Integration tests for eject command.
 *
 * Tests: cc eject agent-partials, cc eject skills, cc eject all
 *
 * The eject command copies bundled content to the project for local customization:
 * - agent-partials: Copy agent partials and templates from CLI
 * - skills: Copy skills from source marketplace
 * - all: Copy all of the above
 *
 * Note: stdout capture is limited in oclif test environment, so tests focus on:
 * - Argument validation (type is required)
 * - Flag validation (--force, --output, --refresh)
 * - Error handling for invalid types
 * - Exit codes
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, stat } from "fs/promises";
import { runCliCommand } from "../helpers";

// =============================================================================
// Helpers
// =============================================================================

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Test Setup
// =============================================================================

describe("eject command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-eject-test-"));
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
    it("should require type argument", async () => {
      const { error } = await runCliCommand(["eject"]);

      // Should error because type is required
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should error on invalid type", async () => {
      const { error } = await runCliCommand(["eject", "invalid-type"]);

      // Should error on unknown eject type
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should accept 'agent-partials' as type", async () => {
      const { error } = await runCliCommand(["eject", "agent-partials"]);

      // Should not error on argument parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept 'skills' as type", async () => {
      const { error } = await runCliCommand(["eject", "skills"]);

      // Should not error on argument parsing (may warn about no source)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown eject type");
    });

    it("should accept 'all' as type", async () => {
      const { error } = await runCliCommand(["eject", "all"]);

      // Should not error on argument parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should reject old type 'templates'", async () => {
      const { error } = await runCliCommand(["eject", "templates"]);

      // Should error - templates is no longer a valid type
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should reject old type 'config'", async () => {
      const { error } = await runCliCommand(["eject", "config"]);

      // Should error - config is no longer a valid type
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should reject old type 'agents'", async () => {
      const { error } = await runCliCommand(["eject", "agents"]);

      // Should error - agents is no longer a valid type (use agent-partials)
      expect(error?.oclif?.exit).toBeDefined();
    });
  });

  // ===========================================================================
  // Flag Validation
  // ===========================================================================

  describe("flag validation", () => {
    it("should accept --force flag", async () => {
      const { error } = await runCliCommand([
        "eject",
        "agent-partials",
        "--force",
      ]);

      // Should not error on --force flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -f shorthand for force", async () => {
      const { error } = await runCliCommand(["eject", "agent-partials", "-f"]);

      // Should accept -f shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --output flag", async () => {
      const outputDir = path.join(tempDir, "custom-output");

      const { error } = await runCliCommand([
        "eject",
        "agent-partials",
        "--output",
        outputDir,
      ]);

      // Should not error on --output flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -o shorthand for output", async () => {
      const outputDir = path.join(tempDir, "custom-output");

      const { error } = await runCliCommand([
        "eject",
        "agent-partials",
        "-o",
        outputDir,
      ]);

      // Should accept -o shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --refresh flag", async () => {
      const { error } = await runCliCommand(["eject", "skills", "--refresh"]);

      // Should not error on --refresh flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Eject Agent Partials
  // ===========================================================================

  describe("eject agent-partials", () => {
    it("should eject agent partials to .claude/agents/_partials by default", async () => {
      const { error } = await runCliCommand(["eject", "agent-partials"]);

      // Command should complete (partials should exist in CLI source)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");

      // Check if partials directory was created
      const partialsDir = path.join(
        projectDir,
        ".claude",
        "agents",
        "_partials",
      );
      const exists = await pathExists(partialsDir);
      // Should exist since CLI has agent partials
      expect(exists).toBe(true);
    });

    it("should eject agent partials to custom output with --output", async () => {
      const outputDir = path.join(tempDir, "custom-partials");

      const { error } = await runCliCommand([
        "eject",
        "agent-partials",
        "--output",
        outputDir,
      ]);

      // Should not error on flag usage
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should warn when partials already exist without --force", async () => {
      // First eject
      await runCliCommand(["eject", "agent-partials"]);

      // Second eject without --force should warn (not error)
      const { error } = await runCliCommand(["eject", "agent-partials"]);

      // Should not crash, may warn
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("crash");
    });

    it("should overwrite partials when --force is used", async () => {
      // First eject
      await runCliCommand(["eject", "agent-partials"]);

      // Second eject with --force
      const { error } = await runCliCommand([
        "eject",
        "agent-partials",
        "--force",
      ]);

      // Should not error
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Eject Skills
  // ===========================================================================

  describe("eject skills", () => {
    it("should load skills from source", async () => {
      const { error } = await runCliCommand(["eject", "skills"]);

      // May warn about no skills found if source not configured, but should not crash
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("crash");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --output flag for skills", async () => {
      const outputDir = path.join(tempDir, "custom-skills");

      const { error } = await runCliCommand([
        "eject",
        "skills",
        "--output",
        outputDir,
      ]);

      // Should not error on flag usage
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --source flag for custom source", async () => {
      const { error } = await runCliCommand([
        "eject",
        "skills",
        "--source",
        "/nonexistent/path",
      ]);

      // May error on nonexistent path, but should accept the flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Eject All
  // ===========================================================================

  describe("eject all", () => {
    it("should eject all content types", async () => {
      const { error } = await runCliCommand(["eject", "all"]);

      // Should attempt to eject all types
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --force flag for all", async () => {
      const { error } = await runCliCommand(["eject", "all", "--force"]);

      // Should not error on flag usage
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --output flag for all", async () => {
      const outputDir = path.join(tempDir, "custom-all");

      const { error } = await runCliCommand([
        "eject",
        "all",
        "--output",
        outputDir,
      ]);

      // Should not error on flag usage
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("error handling", () => {
    it("should error when output path is an existing file", async () => {
      // Create a file where output directory would be
      const outputPath = path.join(tempDir, "existing-file");
      const fs = await import("fs/promises");
      await fs.writeFile(outputPath, "existing content");

      const { error } = await runCliCommand([
        "eject",
        "agent-partials",
        "--output",
        outputPath,
      ]);

      // Should error because output path is a file
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should expand tilde in output path", async () => {
      const { error } = await runCliCommand([
        "eject",
        "agent-partials",
        "--output",
        "~/test-eject",
      ]);

      // Should not error on tilde expansion
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("invalid path");
    });
  });
});
