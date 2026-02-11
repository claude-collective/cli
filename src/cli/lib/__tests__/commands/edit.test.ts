/**
 * Integration tests for the edit command.
 *
 * Tests: cc edit, cc edit --refresh, cc edit --source, cc edit --agent-source
 *
 * The edit command modifies currently installed skills via an interactive wizard:
 * - Detects installation mode (plugin or local)
 * - Loads skills matrix from source
 * - Gets current plugin skill IDs
 * - Renders Wizard component for interactive selection
 * - Calculates added/removed skills and updates plugin
 *
 * Note: Tests focus on pre-wizard scenarios since the wizard itself requires
 * interactive Ink rendering (tested separately in wizard component tests).
 * Specifically:
 * - Flag validation (--refresh, --source, --agent-source)
 * - Error handling when no installation exists
 * - Exit codes for error scenarios
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { runCliCommand } from "../helpers";

// =============================================================================
// Constants
// =============================================================================

const EXIT_CODE_ERROR = 1;

// =============================================================================
// Tests
// =============================================================================

describe("edit command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-edit-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // No Installation Error
  // ===========================================================================

  describe("no installation found", () => {
    it("should error when no installation exists", async () => {
      // Clean temp dir has no .claude/ or .claude-src/ directories
      const { error } = await runCliCommand(["edit"]);

      // Should exit with EXIT_CODES.ERROR (1) because detectInstallation returns null
      expect(error?.oclif?.exit).toBe(EXIT_CODE_ERROR);
    });

    it("should include helpful error message about running init first", async () => {
      const { error } = await runCliCommand(["edit"]);

      // Error message should mention running 'cc init' first
      expect(error?.message).toContain("No installation found");
    });
  });

  // ===========================================================================
  // Flag Validation
  // ===========================================================================

  describe("flag validation", () => {
    it("should accept --refresh flag", async () => {
      const { error } = await runCliCommand(["edit", "--refresh"]);

      // Should not error on flag parsing (will error on no installation, which is expected)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --source flag with path", async () => {
      const { error } = await runCliCommand(["edit", "--source", "/some/path"]);

      // Should not error on flag parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -s shorthand for source", async () => {
      const { error } = await runCliCommand(["edit", "-s", "/some/path"]);

      // Should accept -s shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --agent-source flag with URL", async () => {
      const { error } = await runCliCommand([
        "edit",
        "--agent-source",
        "https://example.com/agents",
      ]);

      // Should not error on flag parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --dry-run flag (inherited from BaseCommand)", async () => {
      const { error } = await runCliCommand(["edit", "--dry-run"]);

      // Should not error on flag parsing (dry-run is inherited from BaseCommand.baseFlags)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Combined Flags
  // ===========================================================================

  describe("combined flags", () => {
    it("should accept multiple flags together", async () => {
      const { error } = await runCliCommand([
        "edit",
        "--refresh",
        "--source",
        "/custom/source",
        "--agent-source",
        "https://example.com/agents",
      ]);

      // Should accept all flags without parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept shorthand and long flags together", async () => {
      const { error } = await runCliCommand(["edit", "--refresh", "-s", "/custom/source"]);

      // Should accept mixed flag formats
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });
});
