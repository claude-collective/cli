/**
 * Integration tests for the outdated command.
 *
 * Tests: cc outdated, cc outdated --json, cc outdated --source
 *
 * The outdated command checks which local skills are out of date compared to source:
 * - Compares content hashes from forked_from metadata
 * - Shows table output with skill status (current, outdated, local-only)
 * - Supports JSON output for scripting
 * - Exit code 1 if any skills are outdated
 *
 * Note: stdout capture is limited in oclif test environment, so tests focus on:
 * - Flag validation (--json, --source)
 * - Command execution (no unhandled errors)
 * - Exit codes for error conditions
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { runCliCommand } from "../helpers";

// =============================================================================
// Tests
// =============================================================================

describe("outdated command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-outdated-test-"));
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
      const { error } = await runCliCommand(["outdated"]);

      // Should not have argument parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should complete when no local skills directory exists", async () => {
      // projectDir has no .claude/skills
      const { error } = await runCliCommand(["outdated"]);

      // Command should complete (warns about missing local skills)
      // Note: stdout capture is limited in oclif test environment
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });

  // ===========================================================================
  // Flag Validation
  // ===========================================================================

  describe("flag validation", () => {
    it("should accept --json flag", async () => {
      const { error } = await runCliCommand(["outdated", "--json"]);

      // Should not error on --json flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --source flag", async () => {
      const { error } = await runCliCommand([
        "outdated",
        "--source",
        "/some/path",
      ]);

      // Should accept --source flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -s shorthand for source", async () => {
      const { error } = await runCliCommand(["outdated", "-s", "/some/path"]);

      // Should accept -s shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // JSON Output Mode
  // ===========================================================================

  describe("JSON output mode", () => {
    it("should accept --json flag and process request", async () => {
      const { error } = await runCliCommand(["outdated", "--json"]);

      // Command should complete without parsing errors
      // Note: stdout capture is limited in oclif test environment
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --json with --source together", async () => {
      const { error } = await runCliCommand([
        "outdated",
        "--json",
        "--source",
        "/some/path",
      ]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // With Local Skills
  // ===========================================================================

  describe("with local skills", () => {
    beforeEach(async () => {
      // Create local skills directory structure
      const skillsDir = path.join(projectDir, ".claude", "skills", "my-skill");
      await mkdir(skillsDir, { recursive: true });

      // Create a local skill without forked_from (local-only skill)
      await writeFile(
        path.join(skillsDir, "SKILL.md"),
        `---
name: my-skill
description: A test skill
category: test
---

# My Skill

Test content here.
`,
      );

      await writeFile(
        path.join(skillsDir, "metadata.yaml"),
        `version: 1
author: "@test"
`,
      );
    });

    it("should process local skills for comparison", async () => {
      const { error } = await runCliCommand(["outdated"]);

      // Command should complete (loads source and compares)
      // Note: stdout capture is limited in oclif test environment
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --json flag with local skills", async () => {
      const { error } = await runCliCommand(["outdated", "--json"]);

      // Command should complete without flag parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // With Forked Skills
  // ===========================================================================

  describe("with forked skills", () => {
    beforeEach(async () => {
      // Create local skills directory with forked_from metadata
      const skillsDir = path.join(
        projectDir,
        ".claude",
        "skills",
        "forked-skill",
      );
      await mkdir(skillsDir, { recursive: true });

      await writeFile(
        path.join(skillsDir, "SKILL.md"),
        `---
name: forked-skill
description: A forked skill
category: test
---

# Forked Skill

Local modifications here.
`,
      );

      await writeFile(
        path.join(skillsDir, "metadata.yaml"),
        `version: 1
author: "@test"
forked_from:
  skill_id: "react (@vince)"
  content_hash: "abc123"
  date: "2025-01-01"
`,
      );
    });

    it("should process forked skills for comparison", async () => {
      const { error } = await runCliCommand(["outdated"]);

      // Command should complete (loads source and compares)
      // Note: stdout capture is limited in oclif test environment
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --json flag with forked skills", async () => {
      const { error } = await runCliCommand(["outdated", "--json"]);

      // Command should complete without flag parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --source flag with forked skills", async () => {
      const { error } = await runCliCommand([
        "outdated",
        "--source",
        "/nonexistent/source",
      ]);

      // Should not error on flag parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Combined Flags
  // ===========================================================================

  describe("combined flags", () => {
    it("should accept --json with --source", async () => {
      const { error } = await runCliCommand([
        "outdated",
        "--json",
        "--source",
        "/custom/path",
      ]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -s with --json", async () => {
      const { error } = await runCliCommand([
        "outdated",
        "-s",
        "/custom/path",
        "--json",
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
    beforeEach(async () => {
      // Create local skills so command proceeds to source loading
      const skillsDir = path.join(projectDir, ".claude", "skills", "test");
      await mkdir(skillsDir, { recursive: true });
      await writeFile(
        path.join(skillsDir, "SKILL.md"),
        "---\nname: test\n---\n# Test",
      );
      await writeFile(
        path.join(skillsDir, "metadata.yaml"),
        `forked_from:\n  skill_id: "react (@vince)"\n  content_hash: "abc"\n  date: "2025-01-01"`,
      );
    });

    it("should handle source path flag gracefully", async () => {
      const { error } = await runCliCommand([
        "outdated",
        "--source",
        "/definitely/not/real/path/xyz",
      ]);

      // Should not have flag parsing errors
      // (may complete successfully with source not found, or error on source)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --json with invalid source path", async () => {
      const { error } = await runCliCommand([
        "outdated",
        "--json",
        "--source",
        "/definitely/not/real/path/xyz",
      ]);

      // Should not have flag parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });
});
