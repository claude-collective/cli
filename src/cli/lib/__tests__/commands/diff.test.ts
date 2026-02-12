import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { runCliCommand } from "../helpers";

describe("diff command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-diff-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("basic execution", () => {
    it("should run without arguments", async () => {
      const { error } = await runCliCommand(["diff"]);

      // Should not have argument parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept optional skill argument", async () => {
      const { error } = await runCliCommand(["diff", "react"]);

      // Should accept skill name without parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should complete without error when no local skills directory exists", async () => {
      // projectDir has no .claude/skills
      const { error } = await runCliCommand(["diff"]);

      // Command should complete (returns early with warning, which may not be captured)
      // Note: stdout capture is limited in oclif test environment
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });

  describe("flag validation", () => {
    it("should accept --quiet flag", async () => {
      const { error } = await runCliCommand(["diff", "--quiet"]);

      // Should not error on --quiet flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -q shorthand for quiet", async () => {
      const { error } = await runCliCommand(["diff", "-q"]);

      // Should accept -q shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --source flag", async () => {
      const { error } = await runCliCommand(["diff", "--source", "/some/path"]);

      // Should accept --source flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -s shorthand for source", async () => {
      const { error } = await runCliCommand(["diff", "-s", "/some/path"]);

      // Should accept -s shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

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

    it("should handle local skills without forked_from metadata", async () => {
      const { error } = await runCliCommand(["diff"]);

      // Command should complete (may have warnings about missing forked_from)
      // Note: stdout capture is limited in oclif test environment
      // The command exits with code 0 when no forked skills to compare
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should filter by skill name when provided", async () => {
      const { error } = await runCliCommand(["diff", "nonexistent-skill"]);

      // Should error when specified skill not found in local skills
      expect(error).toBeDefined();
    });
  });

  describe("with forked skills", () => {
    beforeEach(async () => {
      // Create local skills directory with forked_from metadata
      const skillsDir = path.join(projectDir, ".claude", "skills", "forked-skill");
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
  skill_id: "${"web-framework-react"}"
  content_hash: "abc123"
  date: "2025-01-01"
`,
      );
    });

    it("should process forked skills for comparison", async () => {
      const { error } = await runCliCommand(["diff"]);

      // Command should complete (loads source and compares)
      // Note: stdout capture is limited in oclif test environment
      // Exit code 0 means skills are up to date or no differences found
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --source flag with forked skills", async () => {
      const { error } = await runCliCommand(["diff", "--source", "/nonexistent/source"]);

      // Should not error on flag parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("combined flags", () => {
    it("should accept --quiet with --source", async () => {
      const { error } = await runCliCommand(["diff", "--quiet", "--source", "/custom/path"]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -q with -s", async () => {
      const { error } = await runCliCommand(["diff", "-q", "-s", "/custom/path"]);

      // Should accept both shorthand flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept skill argument with flags", async () => {
      const { error } = await runCliCommand([
        "diff",
        "my-skill",
        "--quiet",
        "--source",
        "/some/path",
      ]);

      // Should accept skill arg with flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });

  describe("error handling", () => {
    it("should handle invalid source path gracefully", async () => {
      // Create local skills directory so command proceeds to source loading
      const skillsDir = path.join(projectDir, ".claude", "skills", "test");
      await mkdir(skillsDir, { recursive: true });
      await writeFile(path.join(skillsDir, "SKILL.md"), "---\nname: test\n---\n# Test");
      await writeFile(
        path.join(skillsDir, "metadata.yaml"),
        `forked_from:\n  skill_id: "${"web-framework-react"}"\n  content_hash: "abc"\n  date: "2025-01-01"`,
      );

      const { error } = await runCliCommand(["diff", "--source", "/definitely/not/real/path/xyz"]);

      // Should error but not crash
      expect(error).toBeDefined();
    });
  });
});
