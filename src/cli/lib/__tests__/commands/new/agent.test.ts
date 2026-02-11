/**
 * Tests for new:agent command.
 *
 * Tests: cc new:agent <name>, flags (--purpose, --refresh, --source, --non-interactive)
 *
 * The new:agent command creates a new custom agent using AI generation via
 * the agent-summoner meta-agent. It checks for Claude CLI availability,
 * resolves the source config, gets the purpose, fetches the meta-agent,
 * and invokes the claude CLI.
 *
 * Note: The full agent creation flow spawns a real claude CLI process and
 * may render Ink components for interactive purpose input. Additionally,
 * oclif's dynamic module loading bypasses vitest's vi.mock for utils imported
 * by command modules. Tests focus on:
 * - Argument/flag validation and exit codes
 * - Missing required name argument (oclif validation)
 * - Command execution error paths that don't require mocking
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { runCliCommand } from "../../helpers";

// =============================================================================
// Constants
// =============================================================================

// =============================================================================
// Command Tests
// =============================================================================

describe("new:agent command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-new-agent-test-"));
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
    it("should reject missing name argument", async () => {
      const { error } = await runCliCommand(["new:agent"]);

      // oclif should report missing required arg
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should accept name argument without parsing error", async () => {
      // Command will proceed past arg parsing (may fail later at source/fetch)
      const { error } = await runCliCommand(["new:agent", "my-agent", "--purpose", "test"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });

  // ===========================================================================
  // Flag Acceptance
  // ===========================================================================

  describe("flag acceptance", () => {
    it("should accept --purpose flag without parsing error", async () => {
      const { error } = await runCliCommand([
        "new:agent",
        "my-agent",
        "--purpose",
        "Manages database migrations",
      ]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --refresh flag without parsing error", async () => {
      const { error } = await runCliCommand(["new:agent", "my-agent", "--refresh"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --source flag without parsing error", async () => {
      const { error } = await runCliCommand(["new:agent", "my-agent", "--source", "/some/path"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --non-interactive flag without parsing error", async () => {
      const { error } = await runCliCommand(["new:agent", "my-agent", "--non-interactive"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -p shorthand for purpose flag", async () => {
      const { error } = await runCliCommand(["new:agent", "my-agent", "-p", "test purpose"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -r shorthand for refresh flag", async () => {
      const { error } = await runCliCommand(["new:agent", "my-agent", "-r"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -n shorthand for non-interactive flag", async () => {
      const { error } = await runCliCommand(["new:agent", "my-agent", "-n"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -s shorthand for source flag (from base command)", async () => {
      const { error } = await runCliCommand(["new:agent", "my-agent", "-s", "/some/source"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("error handling", () => {
    it("should error when source path does not exist", async () => {
      const { error } = await runCliCommand([
        "new:agent",
        "my-agent",
        "--purpose",
        "test agent",
        "--source",
        "/nonexistent/path/that/does/not/exist",
      ]);

      // Should fail with a non-zero exit code
      expect(error?.oclif?.exit).toBeDefined();
      expect(error?.oclif?.exit).not.toBe(0);
    });

    it("should pass arg and flag parsing with all flags combined", async () => {
      // Providing valid args/flags should not trigger parsing errors.
      // The command may still fail at runtime (source resolution, meta-agent fetch)
      // but should not fail with "unknown flag" or "missing required arg".
      const { error } = await runCliCommand([
        "new:agent",
        "test-agent",
        "--purpose",
        "testing",
        "--refresh",
        "--non-interactive",
      ]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });
});
