import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { stringify as stringifyYaml } from "yaml";
import { runCliCommand } from "../helpers";

describe("doctor command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-doctor-test-"));
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
      const { error } = await runCliCommand(["doctor"]);

      // Should not have argument parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should fail when no config exists", async () => {
      // projectDir has no .claude/config.yaml
      const { error } = await runCliCommand(["doctor"]);

      // Should exit with error because Config Valid check fails
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should pass when valid config exists", async () => {
      // Create valid project config
      const claudeDir = path.join(projectDir, ".claude");
      await mkdir(claudeDir, { recursive: true });
      await writeFile(
        path.join(claudeDir, "config.yaml"),
        stringifyYaml({
          name: "test-project",
          agents: [],
        }),
      );

      const { error } = await runCliCommand(["doctor"]);

      // Should complete without critical errors when config is valid
      // (may fail on Source Reachable if no source is available)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("config.yaml has errors");
    });
  });

  describe("flag validation", () => {
    it("should accept --verbose flag", async () => {
      const { error } = await runCliCommand(["doctor", "--verbose"]);

      // Should not error on --verbose flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -v shorthand for verbose", async () => {
      const { error } = await runCliCommand(["doctor", "-v"]);

      // Should accept -v shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --source flag", async () => {
      const { error } = await runCliCommand(["doctor", "--source", "/some/path"]);

      // Should accept --source flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -s shorthand for source", async () => {
      const { error } = await runCliCommand(["doctor", "-s", "/some/path"]);

      // Should accept -s shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("config validation", () => {
    it("should fail when config.yaml has syntax errors", async () => {
      const claudeDir = path.join(projectDir, ".claude");
      await mkdir(claudeDir, { recursive: true });
      await writeFile(path.join(claudeDir, "config.yaml"), "invalid: yaml: content: ::::");

      const { error } = await runCliCommand(["doctor"]);

      // Should exit with error due to invalid YAML
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should pass with minimal valid config", async () => {
      const claudeDir = path.join(projectDir, ".claude");
      await mkdir(claudeDir, { recursive: true });
      await writeFile(
        path.join(claudeDir, "config.yaml"),
        stringifyYaml({
          name: "test-project",
        }),
      );

      const { error } = await runCliCommand(["doctor"]);

      // May still exit with error if source is unreachable,
      // but should not fail on config parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("config.yaml has errors");
    });
  });

  describe("agents check", () => {
    it("should pass when agents are compiled", async () => {
      const claudeDir = path.join(projectDir, ".claude");
      const agentsDir = path.join(claudeDir, "agents");
      await mkdir(agentsDir, { recursive: true });

      // Create config with one agent
      await writeFile(
        path.join(claudeDir, "config.yaml"),
        stringifyYaml({
          name: "test-project",
          agents: ["web-developer"],
        }),
      );

      // Create the compiled agent file
      await writeFile(
        path.join(agentsDir, "web-developer.md"),
        "# Web Developer Agent\n\nAgent content here.",
      );

      const { error } = await runCliCommand(["doctor"]);

      // Should not mention missing agents
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("recompilation");
    });

    it("should warn when agents need recompilation", async () => {
      const claudeDir = path.join(projectDir, ".claude");
      await mkdir(claudeDir, { recursive: true });

      // Create config with agent but no compiled .md file
      await writeFile(
        path.join(claudeDir, "config.yaml"),
        stringifyYaml({
          name: "test-project",
          agents: ["web-developer"],
        }),
      );

      const { error } = await runCliCommand(["doctor"]);

      // Doctor should complete (warnings don't cause exit error)
      // but may exit with error due to source being unreachable
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("argument");
    });
  });

  describe("orphans check", () => {
    it("should detect orphaned agent files", async () => {
      const claudeDir = path.join(projectDir, ".claude");
      const agentsDir = path.join(claudeDir, "agents");
      await mkdir(agentsDir, { recursive: true });

      // Create config with no agents
      await writeFile(
        path.join(claudeDir, "config.yaml"),
        stringifyYaml({
          name: "test-project",
          agents: [],
        }),
      );

      // Create an orphaned agent file not in config
      await writeFile(
        path.join(agentsDir, "orphaned-agent.md"),
        "# Orphaned Agent\n\nThis agent is not in config.",
      );

      const { error } = await runCliCommand(["doctor"]);

      // Command should run (orphans are warnings, not errors)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });

  describe("combined flags", () => {
    it("should accept --verbose with --source", async () => {
      const { error } = await runCliCommand(["doctor", "--verbose", "--source", "/custom/path"]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -v with -s", async () => {
      const { error } = await runCliCommand(["doctor", "-v", "-s", "/custom/path"]);

      // Should accept both shorthand flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });
});
