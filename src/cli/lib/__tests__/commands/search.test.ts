/**
 * Integration tests for the search command.
 *
 * Tests: cc search <query> [--category <category>]
 *
 * Note: The search command requires a valid skills-matrix.yaml with specific schema.
 * Creating a minimal test fixture is complex, so these tests focus on:
 * - Command argument validation
 * - Output format validation
 * - Error handling
 *
 * Full search tests would require either:
 * - Network access to the default source
 * - A complete test fixture matching the skills-matrix schema
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { runCliCommand } from "../helpers";

// =============================================================================
// Tests
// =============================================================================

describe("search command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalCwd = process.cwd();
    originalEnv = { ...process.env };

    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-search-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.env = originalEnv;
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("argument validation", () => {
    it.skip("should require query argument", async () => {
      const { error } = await runCliCommand(["search"]);

      // Should error because query is required
      expect(error).toBeDefined();
    });

    it("should accept query as first argument", async () => {
      const { stdout, error } = await runCliCommand(["search", "test"]);

      // Should start processing (may fail due to source issues, but should accept the arg)
      // Either shows "Loading skills..." or errors on source, not on missing argument
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("missing required arg");
    });

    it("should accept --category flag", async () => {
      const { stdout, error } = await runCliCommand(["search", "test", "--category", "web"]);

      // Should not error on invalid flag
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -c shorthand for category", async () => {
      const { stdout, error } = await runCliCommand(["search", "test", "-c", "web"]);

      // Should not error on invalid flag
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });

  // Skip: stdout capture limited in oclif/bun test environment
  describe("output format", () => {
    it.skip("should show loading message when starting", async () => {
      const { stdout } = await runCliCommand(["search", "anything"]);

      // Should show loading message as first output
      expect(stdout.toLowerCase()).toContain("loading");
    });
  });

  describe("with --source flag", () => {
    it("should accept --source flag", async () => {
      const { stdout, error } = await runCliCommand([
        "search",
        "test",
        "--source",
        "/nonexistent/path",
      ]);

      // Should not error on invalid flag - may error on path not existing
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -s shorthand for source", async () => {
      const { stdout, error } = await runCliCommand(["search", "test", "-s", "/nonexistent/path"]);

      // Should not error on invalid flag
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });
});
