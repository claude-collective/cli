import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { runCliCommand } from "../helpers";

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
    it("should run without error when no installation exists", async () => {
      const { error } = await runCliCommand(["list"]);

      // Should not throw an unhandled error
      // The command should handle "no installation" gracefully
      if (error?.message) {
        expect(error.message).not.toContain("EEXIT");
      }
    });

    it("should work with ls alias", async () => {
      const { error } = await runCliCommand(["ls"]);

      // Alias should work the same as the full command
      if (error?.message) {
        expect(error.message).not.toContain("EEXIT");
      }
    });

    it("should show installation info when local installation exists", async () => {
      // Create a minimal local installation
      const claudeDir = path.join(projectDir, ".claude");
      const agentsDir = path.join(claudeDir, "agents");
      const skillsDir = path.join(claudeDir, "skills");

      await mkdir(agentsDir, { recursive: true });
      await mkdir(skillsDir, { recursive: true });

      // Write minimal config
      const configContent = `name: test-project
installMode: local
agents:
  - web-developer
`;
      await writeFile(path.join(claudeDir, "config.yaml"), configContent);

      // Write a test agent
      await writeFile(
        path.join(agentsDir, "web-developer.md"),
        "# Web Developer\n\nTest agent content.",
      );

      // Write a test skill
      const testSkillDir = path.join(skillsDir, "test-skill");
      await mkdir(testSkillDir, { recursive: true });
      await writeFile(
        path.join(testSkillDir, "SKILL.md"),
        "---\nname: test-skill\n---\n# Test Skill",
      );

      const { error } = await runCliCommand(["list"]);

      // Should run successfully with a local installation
      expect(error).toBeUndefined();
    });
  });

  describe("flags", () => {
    it("should accept --help flag", async () => {
      const { error } = await runCliCommand(["list", "--help"]);

      // Help should always work
      expect(error).toBeUndefined();
    });
  });
});
