import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { EXIT_CODES } from "../pages/constants.js";
import {
  createTempDir,
  cleanupTempDir,
  createE2ESource,
  ensureBinaryExists,
} from "../helpers/test-utils.js";
import { CLI } from "../fixtures/cli.js";

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

      const { exitCode, stdout } = await CLI.run(["search", "--help"], { dir: tempDir });

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

      const { exitCode, stdout } = await CLI.run(["search", "react", "--source", sourceDir!], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("react");
      expect(stdout).toContain("Category");
      expect(stdout).toContain("Description");
    });

    it("should show no results message for unmatched query", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      const { exitCode, output } = await CLI.run(
        ["search", "zzz-nonexistent-skill-xyz", "--source", sourceDir!],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("No skills found");
    });

    it("should filter results by category flag", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      const { exitCode, stdout } = await CLI.run(
        ["search", "framework", "-c", "web-framework", "--source", sourceDir!],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("react");
      expect(stdout).toContain("Category filter");
    });

    it("should only show skills matching the category filter", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      const { exitCode, stdout } = await CLI.run(
        ["search", "framework", "-c", "api-api", "--source", sourceDir!],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // api-api category should show hono, not react
      expect(stdout).toContain("hono");
      expect(stdout).toContain("Category filter");
      // React is in web-framework, not api-api, so it should not appear
      expect(stdout).not.toContain("react");
    });
  });

  describe("no matching results", () => {
    it("should show no results and include query in warning", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      const { exitCode, output } = await CLI.run(
        ["search", "zzz-absolutely-nothing-xyz", "--source", sourceDir!],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("No skills found");
      expect(output).toContain("zzz-absolutely-nothing-xyz");
    });

    it("should show no results when category filter excludes all matches", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      // Search for "react" but filter by api-api category — react is not in api-api
      const { exitCode, output } = await CLI.run(
        ["search", "react", "-c", "api-api", "--source", sourceDir!],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("No skills found");
    });
  });

  describe("--source flag in non-interactive mode", () => {
    it("should load skills from the custom source path", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      const { exitCode, stdout, output } = await CLI.run(
        ["search", "methodology", "--source", sourceDir!],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);

      // Verify the source was loaded from the local path
      expect(output).toContain("Loaded from local:");
      expect(output).toContain(sourceDir!);

      // The E2E source contains methodology skills
      expect(stdout).toContain("methodology");
    });

    it("should show source path in output when using --source", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      const { exitCode, output } = await CLI.run(["search", "hono", "--source", sourceDir!], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // Output should indicate the source was loaded from the local path
      expect(output).toContain("Loaded from local:");
      expect(output).toContain(sourceDir!);
    });

    it("should find skills across different categories with --source", async () => {
      tempDir = await createTempDir();
      await createSourceFixture();

      // Search for a term that spans multiple categories
      const { exitCode, stdout } = await CLI.run(["search", "framework", "--source", sourceDir!], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // E2E source has react (web-framework) and hono (api-api with "framework" in description)
      expect(stdout).toContain("react");
      expect(stdout).toContain("hono");
    });
  });
});
