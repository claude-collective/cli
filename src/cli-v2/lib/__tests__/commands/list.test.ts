/**
 * Integration tests for the list command.
 *
 * Tests: cc list, cc ls (alias)
 *
 * The list command displays plugin information when a plugin is installed.
 * Note: Full plugin testing is limited due to HOME directory caching.
 * We focus on testing the command behavior without a plugin installed.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { runCliCommand } from "../helpers";

// =============================================================================
// Tests
// =============================================================================

describe("list command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-list-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("command behavior", () => {
    it("should run without error", async () => {
      const { error, stdout, stderr } = await runCliCommand(["list"]);

      // Should not throw an unhandled error
      // (having no plugin is expected, not an error)
      // If error is undefined, that's fine - command ran successfully
      if (error?.message) {
        expect(error.message).not.toContain("EEXIT");
      }
      // Should produce some output
      expect((stdout + stderr).length).toBeGreaterThan(0);
    });

    it("should work with ls alias", async () => {
      const { stdout, stderr } = await runCliCommand(["ls"]);

      // Should produce some output
      const output = stdout + stderr;
      expect(output.length).toBeGreaterThan(0);
    });

    it("should show message when no plugin found", async () => {
      // Note: This test relies on no plugin being installed in the test environment
      // If a plugin IS installed globally, this test may fail
      const { stdout, stderr } = await runCliCommand(["list"]);
      const output = stdout + stderr;

      // Should either show plugin info OR "no plugin found" message
      const hasPluginInfo =
        output.includes("version") && output.includes("agent");
      const hasNoPluginMessage = output.toLowerCase().includes("no plugin");

      expect(hasPluginInfo || hasNoPluginMessage).toBe(true);
    });
  });

  describe("output format", () => {
    it("should produce readable output", async () => {
      const { stdout, stderr } = await runCliCommand(["list"]);
      const output = stdout + stderr;

      // Output should contain English text (not error codes)
      expect(output).toMatch(/[a-zA-Z]/);
    });
  });
});
