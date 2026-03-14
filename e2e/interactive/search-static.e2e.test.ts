import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  runCLI,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

/**
 * E2E tests for the `search` command — static (non-interactive) mode.
 *
 * Static mode is triggered by providing a query argument without -i flag.
 * It prints a table of matching skills and exits.
 */
describe("search command — static mode", () => {
  let tempDir: string;
  let sourceDir: string | undefined;
  let sourceTempDir: string | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
    if (sourceTempDir) {
      await cleanupTempDir(sourceTempDir);
      sourceTempDir = undefined;
    }
  });

  async function createSourceFixture(): Promise<void> {
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    sourceTempDir = source.tempDir;
  }

  describe("search --help", () => {
    it("should display help text with command description", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await runCLI(["search", "--help"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Search available skills");
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("query");
    });
  });

  describe("static search with query argument", () => {
    it("should display a table of matching skills", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      const { exitCode, stdout } = await runCLI(
        ["search", "react", "--source", sourceDir!],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("react");
      expect(stdout).toContain("Category");
      expect(stdout).toContain("Description");
    });

    it("should show no results message for unmatched query", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      const { exitCode, combined } = await runCLI(
        ["search", "zzz-nonexistent-skill-xyz", "--source", sourceDir!],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(combined).toContain("No skills found");
    });

    it("should filter results by category flag", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      const { exitCode, stdout } = await runCLI(
        ["search", "framework", "-c", "web-framework", "--source", sourceDir!],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("react");
      expect(stdout).toContain("Category filter");
    });

    it("should only show skills matching the category filter", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      const { exitCode, stdout } = await runCLI(
        ["search", "framework", "-c", "api-api", "--source", sourceDir!],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // api-api category should show hono, not react
      expect(stdout).toContain("hono");
      expect(stdout).toContain("Category filter");
      // React is in web-framework, not api-api, so it should not appear
      expect(stdout).not.toContain("react");
    });
  });

  describe("--source flag in non-interactive mode", () => {
    it("should load skills from the custom source path", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      const { exitCode, stdout, combined } = await runCLI(
        ["search", "methodology", "--source", sourceDir!],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Verify the source was loaded from the local path
      expect(combined).toContain("Loaded from local:");
      expect(combined).toContain(sourceDir!);

      // The E2E source contains methodology skills
      expect(stdout).toContain("methodology");
    });
  });
});
