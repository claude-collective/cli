import path from "path";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  directoryExists,
  fileExists,
  listFiles,
  runCLI,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_DIRS, STANDARD_FILES } from "../../src/cli/consts.js";

describe("eject command", () => {
  let tempDir: string;
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
    }
  });

  it("should error when no eject type is specified", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(["eject"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(combined).toContain("specify what to eject");
  });

  it("should error with invalid eject type", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(["eject", "invalid-type"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(combined).toContain("Expected");
  });

  it("should eject agent-partials to project directory", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["eject", "agent-partials"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Eject");
    expect(stdout).toContain("Eject complete!");
  });

  it("should eject templates to project directory", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["eject", "templates"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Eject complete!");
  });

  it("should eject agent-partials to custom output directory", async () => {
    tempDir = await createTempDir();
    const outputDir = path.join(tempDir, "custom-output");

    const { exitCode, stdout } = await runCLI(
      ["eject", "agent-partials", "-o", outputDir],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Eject complete!");
    expect(await directoryExists(outputDir)).toBe(true);
  });

  it("should warn when ejecting agent-partials twice without --force", async () => {
    tempDir = await createTempDir();

    const { exitCode: setupExitCode } = await runCLI(["eject", "agent-partials"], tempDir);
    expect(setupExitCode).toBe(EXIT_CODES.SUCCESS);

    const { exitCode, combined } = await runCLI(["eject", "agent-partials"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(combined).toContain("already exist");
  });

  it("should allow re-eject with --force", async () => {
    tempDir = await createTempDir();

    const { exitCode: setupExitCode } = await runCLI(["eject", "agent-partials"], tempDir);
    expect(setupExitCode).toBe(EXIT_CODES.SUCCESS);

    const { exitCode, stdout } = await runCLI(["eject", "agent-partials", "--force"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Eject complete!");
  });

  it("should eject skills from a local source", async () => {
    tempDir = await createTempDir();
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceTempDir = srcTempDir;

    const { exitCode, stdout } = await runCLI(
      ["eject", "skills", "--source", sourceDir],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("skills ejected");

    const skillsDir = path.join(tempDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
    expect(await directoryExists(skillsDir)).toBe(true);
    const files = await listFiles(skillsDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it("should eject all phases from a local source", async () => {
    tempDir = await createTempDir();
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceTempDir = srcTempDir;

    const { exitCode, stdout } = await runCLI(
      ["eject", "all", "--source", sourceDir],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("ejected");
    expect(stdout).toContain("Eject complete!");
  });

  it("should save source to config when --source flag is provided", async () => {
    tempDir = await createTempDir();
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceTempDir = srcTempDir;

    const { exitCode, stdout } = await runCLI(
      ["eject", "skills", "--source", sourceDir],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Source saved to .claude-src/config.yaml");
  });

  it("should create config.yaml in a fresh directory after eject", async () => {
    tempDir = await createTempDir();

    const { exitCode } = await runCLI(["eject", "agent-partials"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);
    expect(await fileExists(configPath)).toBe(true);
  });
});
