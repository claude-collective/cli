import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir } from "fs/promises";
import { runCliCommand, createTempDir, cleanupTempDir } from "../helpers";
import { createTestSource, cleanupTestSource, type TestDirs } from "../fixtures/create-test-source";
import { DEFAULT_TEST_SKILLS } from "../mock-data/mock-skills";

const COMMAND_TIMEOUT = 30_000;

describe("search command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalCwd = process.cwd();
    originalEnv = { ...process.env };

    tempDir = await createTempDir("cc-search-test-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.env = originalEnv;
    await cleanupTempDir(tempDir);
  });

  describe("argument validation", () => {
    it("should accept query as first argument", { timeout: COMMAND_TIMEOUT }, async () => {
      const { stdout, error } = await runCliCommand(["search", "test"]);

      // Should start processing (may fail due to source issues, but should accept the arg)
      // Either shows "Loading skills..." or errors on source, not on missing argument
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("missing required arg");
    });

    it("should accept --category flag", { timeout: COMMAND_TIMEOUT }, async () => {
      const { stdout, error } = await runCliCommand(["search", "test", "--category", "web"]);

      // Should not error on invalid flag
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -c shorthand for category", { timeout: COMMAND_TIMEOUT }, async () => {
      const { stdout, error } = await runCliCommand(["search", "test", "-c", "web"]);

      // Should not error on invalid flag
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --json flag", { timeout: COMMAND_TIMEOUT }, async () => {
      const { error } = await runCliCommand(["search", "test", "--json"]);

      // Should not error on flag parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });

  // Skip: stdout capture limited in oclif/bun test environment
  describe("output format", () => {
    it("should show loading message when starting", { timeout: COMMAND_TIMEOUT }, async () => {
      const { stdout } = await runCliCommand(["search", "anything"]);

      // Should show loading message as first output
      expect(stdout.toLowerCase()).toContain("loading");
    });
  });

  describe("with --source flag", () => {
    it("should accept --source flag", { timeout: COMMAND_TIMEOUT }, async () => {
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

    it("should accept -s shorthand for source", { timeout: COMMAND_TIMEOUT }, async () => {
      const { stdout, error } = await runCliCommand(["search", "test", "-s", "/nonexistent/path"]);

      // Should not error on invalid flag
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });

  describe("with test source", () => {
    let sourceDirs: TestDirs;

    beforeEach(async () => {
      sourceDirs = await createTestSource({ skills: DEFAULT_TEST_SKILLS });
      process.chdir(sourceDirs.projectDir);
    });

    afterEach(async () => {
      await cleanupTestSource(sourceDirs);
    });

    it("should return results matching query", { timeout: COMMAND_TIMEOUT }, async () => {
      const { stdout, error } = await runCliCommand([
        "search",
        "react",
        "--source",
        sourceDirs.sourceDir,
      ]);

      expect(error).toBeUndefined();
      expect(stdout.toLowerCase()).toContain("react");
    });

    it(
      "should return no results for unlikely query without crashing",
      { timeout: COMMAND_TIMEOUT },
      async () => {
        const { stdout, stderr, error } = await runCliCommand([
          "search",
          "zzz-unlikely-query-xyz",
          "--source",
          sourceDirs.sourceDir,
        ]);

        // Should complete without crashing — warns about no results
        expect(error).toBeUndefined();
        // this.warn() writes to stderr in oclif
        const output = stdout + stderr;
        expect(output.toLowerCase()).toContain("no skills found");
      },
    );

    it(
      "should return no results for invalid category filter without crashing",
      { timeout: COMMAND_TIMEOUT },
      async () => {
        const { stdout, stderr, error } = await runCliCommand([
          "search",
          "react",
          "--category",
          "nonexistent-category-xyz",
          "--source",
          sourceDirs.sourceDir,
        ]);

        // Category filter narrows to 0 results — should not crash
        expect(error).toBeUndefined();
        // this.warn() writes to stderr in oclif
        const output = stdout + stderr;
        expect(output.toLowerCase()).toContain("no skills found");
      },
    );

    describe("--json output", () => {
      it(
        "should output valid JSON structure with results",
        { timeout: COMMAND_TIMEOUT },
        async () => {
          const { stdout, error } = await runCliCommand([
            "search",
            "react",
            "--json",
            "--source",
            sourceDirs.sourceDir,
          ]);

          expect(error).toBeUndefined();

          const parsed = JSON.parse(stdout.trim());
          expect(parsed).toHaveProperty("query", "react");
          expect(parsed).toHaveProperty("results");
          expect(parsed).toHaveProperty("total");
          expect(Array.isArray(parsed.results)).toBe(true);
          expect(parsed.total).toBe(1);

          // Each result should have expected fields
          const result = parsed.results[0];
          expect(result).toHaveProperty("id");
          expect(result).toHaveProperty("displayName");
          expect(result).toHaveProperty("category");
          expect(result).toHaveProperty("description");
        },
      );

      it(
        "should output empty results array for no matches",
        { timeout: COMMAND_TIMEOUT },
        async () => {
          const { stdout, error } = await runCliCommand([
            "search",
            "zzz-unlikely-query-xyz",
            "--json",
            "--source",
            sourceDirs.sourceDir,
          ]);

          expect(error).toBeUndefined();

          const parsed = JSON.parse(stdout.trim());
          expect(parsed.query).toBe("zzz-unlikely-query-xyz");
          expect(parsed.results).toStrictEqual([]);
          expect(parsed.total).toBe(0);
        },
      );

      it(
        "should include category filter in JSON output",
        { timeout: COMMAND_TIMEOUT },
        async () => {
          const { stdout, error } = await runCliCommand([
            "search",
            "react",
            "--json",
            "--category",
            "web",
            "--source",
            sourceDirs.sourceDir,
          ]);

          expect(error).toBeUndefined();

          const parsed = JSON.parse(stdout.trim());
          expect(parsed.category).toBe("web");
          expect(parsed.total).toBe(1);
        },
      );

      it(
        "should suppress non-JSON output when --json is used",
        { timeout: COMMAND_TIMEOUT },
        async () => {
          const { stdout, error } = await runCliCommand([
            "search",
            "react",
            "--json",
            "--source",
            sourceDirs.sourceDir,
          ]);

          expect(error).toBeUndefined();

          // Should not contain human-readable loading messages
          expect(stdout).not.toContain("Loading skills");
          expect(stdout).not.toContain("Loaded from");

          // Should be valid JSON
          expect(() => JSON.parse(stdout.trim())).not.toThrow();
        },
      );
    });
  });
});
