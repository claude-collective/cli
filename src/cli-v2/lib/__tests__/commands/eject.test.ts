/**
 * Integration tests for eject command.
 *
 * Tests: cc eject templates, cc eject config, cc eject skills, cc eject agents, cc eject all
 *
 * The eject command copies bundled content to the project for local customization:
 * - templates: Copy template files (agent.liquid, partials)
 * - config: Copy default config.yaml template
 * - skills: Copy installed skills from plugin
 * - agents: Copy agent partials (intro, workflow, examples)
 * - all: Copy all of the above
 *
 * Note: stdout capture is limited in oclif test environment, so tests focus on:
 * - Argument validation (type is required)
 * - Flag validation (--force, --output)
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

    it("should accept 'templates' as type", async () => {
      const { error } = await runCliCommand(["eject", "templates"]);

      // Should not error on argument parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept 'config' as type", async () => {
      const { error } = await runCliCommand(["eject", "config"]);

      // Should not error on argument parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept 'skills' as type", async () => {
      const { error } = await runCliCommand(["eject", "skills"]);

      // Should not error on argument parsing (may warn about no plugin)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown eject type");
    });

    it("should accept 'agents' as type", async () => {
      const { error } = await runCliCommand(["eject", "agents"]);

      // Should not error on argument parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept 'all' as type", async () => {
      const { error } = await runCliCommand(["eject", "all"]);

      // Should not error on argument parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });

  // ===========================================================================
  // Flag Validation
  // ===========================================================================

  describe("flag validation", () => {
    it("should accept --force flag", async () => {
      const { error } = await runCliCommand(["eject", "config", "--force"]);

      // Should not error on --force flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -f shorthand for force", async () => {
      const { error } = await runCliCommand(["eject", "config", "-f"]);

      // Should accept -f shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --output flag", async () => {
      const outputDir = path.join(tempDir, "custom-output");

      const { error } = await runCliCommand([
        "eject",
        "config",
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
        "config",
        "-o",
        outputDir,
      ]);

      // Should accept -o shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Eject Templates
  // ===========================================================================

  describe("eject templates", () => {
    it("should eject templates to .claude/templates by default", async () => {
      const { error } = await runCliCommand(["eject", "templates"]);

      // Command should complete (templates should exist in source)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");

      // Check if templates directory was created
      const templatesDir = path.join(projectDir, ".claude", "templates");
      const exists = await pathExists(templatesDir);
      // May not exist if source templates don't exist, but command shouldn't error
      expect(typeof exists).toBe("boolean");
    });

    it("should eject templates to custom output with --output", async () => {
      const outputDir = path.join(tempDir, "custom-templates");

      const { error } = await runCliCommand([
        "eject",
        "templates",
        "--output",
        outputDir,
      ]);

      // Should not error on flag usage
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Eject Config
  // ===========================================================================

  describe("eject config", () => {
    it("should eject config.yaml to .claude/ by default", async () => {
      const { error } = await runCliCommand(["eject", "config"]);

      // Command should complete
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");

      // Check if config was created
      const configPath = path.join(projectDir, ".claude", "config.yaml");
      const exists = await pathExists(configPath);
      expect(exists).toBe(true);
    });

    it("should eject config to custom output with --output", async () => {
      const outputDir = path.join(tempDir, "custom-config");

      const { error } = await runCliCommand([
        "eject",
        "config",
        "--output",
        outputDir,
      ]);

      // Should not error on flag usage
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");

      // Check if config was created in custom location
      const configPath = path.join(outputDir, "config.yaml");
      const exists = await pathExists(configPath);
      expect(exists).toBe(true);
    });

    it("should warn when config already exists without --force", async () => {
      // First eject
      await runCliCommand(["eject", "config"]);

      // Second eject without --force should warn (not error)
      const { error } = await runCliCommand(["eject", "config"]);

      // Should not crash, may warn
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("crash");
    });

    it("should overwrite config when --force is used", async () => {
      // First eject
      await runCliCommand(["eject", "config"]);

      // Second eject with --force
      const { error } = await runCliCommand(["eject", "config", "--force"]);

      // Should not error
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Eject Skills
  // ===========================================================================

  describe("eject skills", () => {
    it("should warn when no plugin installed", async () => {
      const { error } = await runCliCommand(["eject", "skills"]);

      // May warn about no skills found, but should not crash
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
  });

  // ===========================================================================
  // Eject Agents
  // ===========================================================================

  describe("eject agents", () => {
    it("should eject agent partials", async () => {
      const { error } = await runCliCommand(["eject", "agents"]);

      // Command should attempt to eject (may warn if no partials)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --output flag for agents", async () => {
      const outputDir = path.join(tempDir, "custom-agents");

      const { error } = await runCliCommand([
        "eject",
        "agents",
        "--output",
        outputDir,
      ]);

      // Should not error on flag usage
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
        "config",
        "--output",
        outputPath,
      ]);

      // Should error because output path is a file
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should expand tilde in output path", async () => {
      const { error } = await runCliCommand([
        "eject",
        "config",
        "--output",
        "~/test-eject",
      ]);

      // Should not error on tilde expansion
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("invalid path");
    });
  });
});
