/**
 * Integration tests for the update command.
 *
 * Tests: cc update, cc update <skill>, cc update --yes, cc update --no-recompile
 *
 * The update command updates local skills from their source repository:
 * - Checks if .claude/skills directory exists
 * - Loads the skills matrix from source
 * - Compares local skill hashes against source hashes
 * - Shows table of outdated skills
 * - Prompts for confirmation (bypassed with --yes)
 * - Updates outdated skills and recompiles agents
 *
 * Note: The update command uses Ink's render() for an interactive confirm prompt.
 * Since oclif's runCommand can't interact with Ink components, tests focus on:
 * - Flag/argument validation
 * - Early exit scenarios (no local skills, all up to date, skill not found)
 * - Behavior with --yes flag to skip the interactive prompt
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { runCliCommand } from "../helpers";

// =============================================================================
// Tests
// =============================================================================

describe("update command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-update-test-"));
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
      const { error } = await runCliCommand(["update"]);

      // Should not have argument parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept optional skill argument", async () => {
      const { error } = await runCliCommand(["update", "my-skill"]);

      // Should accept skill name without parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should complete when no local skills directory exists", async () => {
      // projectDir has no .claude/skills — command should warn and return
      const { error } = await runCliCommand(["update"]);

      // Command should complete (warns about missing local skills)
      // The command warns "No local skills found" and returns without error exit
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
      // Should NOT exit with error code — it's a graceful early return
      expect(error?.oclif?.exit).toBeUndefined();
    });
  });

  // ===========================================================================
  // Flag Validation
  // ===========================================================================

  describe("flag validation", () => {
    it("should accept --yes flag", async () => {
      const { error } = await runCliCommand(["update", "--yes"]);

      // Should not error on --yes flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -y shorthand for yes", async () => {
      const { error } = await runCliCommand(["update", "-y"]);

      // Should accept -y shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --no-recompile flag", async () => {
      const { error } = await runCliCommand(["update", "--no-recompile"]);

      // Should not error on --no-recompile flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --source flag", async () => {
      const { error } = await runCliCommand(["update", "--source", "/some/path"]);

      // Should accept --source flag (inherited from BaseCommand)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -s shorthand for source", async () => {
      const { error } = await runCliCommand(["update", "-s", "/some/path"]);

      // Should accept -s shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Combined Flags
  // ===========================================================================

  describe("combined flags", () => {
    it("should accept --yes with --no-recompile", async () => {
      const { error } = await runCliCommand(["update", "--yes", "--no-recompile"]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --yes with --source", async () => {
      const { error } = await runCliCommand(["update", "--yes", "--source", "/custom/path"]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept skill argument with all flags", async () => {
      const { error } = await runCliCommand([
        "update",
        "my-skill",
        "--yes",
        "--no-recompile",
        "--source",
        "/some/path",
      ]);

      // Should accept skill arg with all flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept shorthand flags together", async () => {
      const { error } = await runCliCommand(["update", "-y", "-s", "/custom/path"]);

      // Should accept shorthand flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // With Local Skills
  // ===========================================================================

  describe("with local skills", () => {
    beforeEach(async () => {
      // Create local skills directory with forked_from metadata
      const skillsDir = path.join(projectDir, ".claude", "skills", "my-skill");
      await mkdir(skillsDir, { recursive: true });

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
forked_from:
  skill_id: "web-framework-react"
  content_hash: "abc123"
  date: "2025-01-01"
`,
      );
    });

    it("should process local skills for update check", async () => {
      const { error } = await runCliCommand(["update", "--yes"]);

      // Command should complete (loads source and compares)
      // Note: stdout capture is limited in oclif test environment
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --yes flag with local skills", async () => {
      const { error } = await runCliCommand(["update", "--yes"]);

      // Should bypass interactive prompt with --yes
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --no-recompile with local skills", async () => {
      const { error } = await runCliCommand(["update", "--yes", "--no-recompile"]);

      // Should accept --no-recompile flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("error handling", () => {
    it("should handle source path flag gracefully", async () => {
      // Create local skills so command proceeds past the early exit check
      const skillsDir = path.join(projectDir, ".claude", "skills", "test");
      await mkdir(skillsDir, { recursive: true });
      await writeFile(path.join(skillsDir, "SKILL.md"), "---\nname: test\n---\n# Test");
      await writeFile(
        path.join(skillsDir, "metadata.yaml"),
        `forked_from:\n  skill_id: "web-framework-react"\n  content_hash: "abc"\n  date: "2025-01-01"`,
      );

      const { error } = await runCliCommand([
        "update",
        "--source",
        "/definitely/not/real/path/xyz",
      ]);

      // Should not have flag parsing errors
      // (may error on source not found, which is expected)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should handle --yes with invalid source path", async () => {
      // Create local skills so command proceeds past the early exit check
      const skillsDir = path.join(projectDir, ".claude", "skills", "test");
      await mkdir(skillsDir, { recursive: true });
      await writeFile(path.join(skillsDir, "SKILL.md"), "---\nname: test\n---\n# Test");
      await writeFile(
        path.join(skillsDir, "metadata.yaml"),
        `forked_from:\n  skill_id: "web-framework-react"\n  content_hash: "abc"\n  date: "2025-01-01"`,
      );

      const { error } = await runCliCommand([
        "update",
        "--yes",
        "--source",
        "/definitely/not/real/path/xyz",
      ]);

      // Should not have flag parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCliCommand(["update", "--nonexistent-flag"]);

      // Should error on unknown flag
      expect(error).toBeDefined();
    });
  });
});
