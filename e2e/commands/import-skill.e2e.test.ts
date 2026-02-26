import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  runCLI,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

describe("import skill command", () => {
  let tempDir: string;
  let e2eSourceDir: string | undefined;
  let e2eSourceTempDir: string | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
    if (e2eSourceTempDir) {
      await cleanupTempDir(e2eSourceTempDir);
      e2eSourceTempDir = undefined;
      e2eSourceDir = undefined;
    }
  });

  it("should display help text", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["import", "skill", "--help"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Import a skill from a third-party GitHub repository");
    expect(stdout).toContain("--skill");
    expect(stdout).toContain("--all");
    expect(stdout).toContain("--list");
  });

  it("should error when no source argument is provided", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(["import", "skill"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(combined).toContain("Missing 1 required arg");
  });

  it("should error when no action flag is specified", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(
      ["import", "skill", "github:nonexistent/repo"],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(combined).toContain("--skill");
  });

  it("should error gracefully with a nonexistent source", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(
      ["import", "skill", "github:totally-nonexistent-user-abc123/no-repo", "--list"],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.NETWORK_ERROR);
    expect(combined).toContain("Fetching repository");
  });

  it("should error when --skill and --all are used together", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(
      ["import", "skill", "github:some/repo", "--skill", "foo", "--all"],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(combined).toContain("Cannot use --skill and --all together");
  });

  // BUG: The --subdir validation for absolute paths (line 213 in import/skill.ts) runs
  // AFTER fetchFromSource(). parseGitHubSource() corrupts local paths by prepending
  // "github:", so we cannot reach the subdir check without a real GitHub source.
  // The import command should support local sources or validate --subdir before fetching.
  it.fails("should error when --subdir is an absolute path", async () => {
    tempDir = await createTempDir();
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceDir = sourceDir;
    e2eSourceTempDir = srcTempDir;

    const { exitCode, combined } = await runCLI(
      ["import", "skill", sourceDir, "--list", "--subdir", "/absolute/path"],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(combined).toContain("--subdir must be a relative path");
  });

  // BUG: parseGitHubSource() in import/skill.ts prepends "github:" to any source path
  // containing "/" without ":", which corrupts local filesystem paths. The import command
  // does not support local source directories as its positional argument.
  it.fails("should list available skills from a local source", async () => {
    tempDir = await createTempDir();
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceDir = sourceDir;
    e2eSourceTempDir = srcTempDir;

    const { exitCode, stdout } = await runCLI(
      ["import", "skill", sourceDir, "--list"],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Available skills");
    expect(stdout).toMatch(/\(\d+\)/);
    expect(stdout).toContain("Use --skill <name>");
  });

  // BUG: Same parseGitHubSource() issue as --list test above. Local paths are not
  // supported as the positional source argument.
  it.fails("should import a specific skill from a local source", async () => {
    tempDir = await createTempDir();
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceDir = sourceDir;
    e2eSourceTempDir = srcTempDir;

    const { exitCode, stdout } = await runCLI(
      ["import", "skill", sourceDir, "--skill", "web-framework-react", "--subdir", "src/skills/web-framework"],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Imported:");
    expect(stdout).toContain("Import complete:");
    expect(stdout).toContain("compile");
  });

  // BUG: Same parseGitHubSource() issue. Cannot reach the duplicate-detection logic
  // without a working local source.
  it.fails("should warn when importing the same skill twice without --force", async () => {
    tempDir = await createTempDir();
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceDir = sourceDir;
    e2eSourceTempDir = srcTempDir;

    // First import
    await runCLI(
      ["import", "skill", sourceDir, "--skill", "web-framework-react", "--subdir", "src/skills/web-framework"],
      tempDir,
    );

    // Second import should warn about skipping
    const { combined } = await runCLI(
      ["import", "skill", sourceDir, "--skill", "web-framework-react", "--subdir", "src/skills/web-framework"],
      tempDir,
    );

    expect(combined).toContain("Skipping");
  });

  // BUG: Same parseGitHubSource() issue. Cannot test --force without a working local source.
  it.fails("should overwrite existing skill with --force", async () => {
    tempDir = await createTempDir();
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceDir = sourceDir;
    e2eSourceTempDir = srcTempDir;

    // First import
    await runCLI(
      ["import", "skill", sourceDir, "--skill", "web-framework-react", "--subdir", "src/skills/web-framework"],
      tempDir,
    );

    // Second import with --force should succeed
    const { exitCode, stdout } = await runCLI(
      ["import", "skill", sourceDir, "--skill", "web-framework-react", "--subdir", "src/skills/web-framework", "--force"],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Imported:");
    expect(stdout).toContain("Import complete:");
  });
});
