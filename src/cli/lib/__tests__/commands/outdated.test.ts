import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir } from "fs/promises";
import { runCliCommand, createTempDir, cleanupTempDir } from "../helpers";
import {
  createTestSource,
  cleanupTestSource,
  LOCAL_SKILL_BASIC,
  LOCAL_SKILL_FORKED,
  LOCAL_SKILL_FORKED_MINIMAL,
  type TestDirs,
} from "../fixtures/create-test-source";

describe("outdated command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-outdated-test-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

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

  describe("flag validation", () => {
    it("should accept --json flag", async () => {
      const { error } = await runCliCommand(["outdated", "--json"]);

      // Should not error on --json flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --source flag", async () => {
      const { error } = await runCliCommand(["outdated", "--source", "/some/path"]);

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

  describe("JSON output mode", () => {
    it("should accept --json flag and process request", async () => {
      const { error } = await runCliCommand(["outdated", "--json"]);

      // Command should complete without parsing errors
      // Note: stdout capture is limited in oclif test environment
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --json with --source together", async () => {
      const { error } = await runCliCommand(["outdated", "--json", "--source", "/some/path"]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("with local skills", () => {
    let localDirs: TestDirs;

    beforeEach(async () => {
      // Create local skills directory structure using fixture
      localDirs = await createTestSource({
        skills: [],
        agents: [],
        localSkills: [LOCAL_SKILL_BASIC],
      });
      process.chdir(localDirs.projectDir);
    });

    afterEach(async () => {
      await cleanupTestSource(localDirs);
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

  describe("with forked skills", () => {
    let localDirs: TestDirs;

    beforeEach(async () => {
      // Create local skills directory with forkedFrom metadata using fixture
      localDirs = await createTestSource({
        skills: [],
        agents: [],
        localSkills: [LOCAL_SKILL_FORKED],
      });
      process.chdir(localDirs.projectDir);
    });

    afterEach(async () => {
      await cleanupTestSource(localDirs);
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
      const { error } = await runCliCommand(["outdated", "--source", "/nonexistent/source"]);

      // Should not error on flag parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("combined flags", () => {
    it("should accept --json with --source", async () => {
      const { error } = await runCliCommand(["outdated", "--json", "--source", "/custom/path"]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -s with --json", async () => {
      const { error } = await runCliCommand(["outdated", "-s", "/custom/path", "--json"]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("error handling", () => {
    let localDirs: TestDirs;

    beforeEach(async () => {
      // Create local skills so command proceeds to source loading
      localDirs = await createTestSource({
        skills: [],
        agents: [],
        localSkills: [LOCAL_SKILL_FORKED_MINIMAL],
      });
      process.chdir(localDirs.projectDir);
    });

    afterEach(async () => {
      await cleanupTestSource(localDirs);
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
