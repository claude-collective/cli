import path from "path";
import { chmod, mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { EXIT_CODES, DIRS, FILES } from "../pages/constants.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  directoryExists,
  fileExists,
  listFiles,
  skillsPath,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { CLI } from "../fixtures/cli.js";

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

    const { exitCode, output } = await CLI.run(["eject"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(output).toContain("specify what to eject");
  });

  it("should error with invalid eject type", async () => {
    tempDir = await createTempDir();

    const { exitCode, output } = await CLI.run(["eject", "invalid-type"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(output).toContain("Expected");
  });

  it("should eject agent-partials to project directory", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await CLI.run(["eject", "agent-partials"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Eject");
    expect(stdout).toContain("Eject complete!");
  });

  it("should eject templates to project directory", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await CLI.run(["eject", "templates"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Eject complete!");
  });

  it("should eject agent-partials to custom output directory", async () => {
    tempDir = await createTempDir();
    const outputDir = path.join(tempDir, "custom-output");

    const { exitCode, stdout } = await CLI.run(["eject", "agent-partials", "-o", outputDir], {
      dir: tempDir,
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Eject complete!");
    expect(await directoryExists(outputDir)).toBe(true);
  });

  it("should warn when ejecting agent-partials twice without --force", async () => {
    tempDir = await createTempDir();

    const { exitCode: setupExitCode } = await CLI.run(["eject", "agent-partials"], {
      dir: tempDir,
    });
    expect(setupExitCode).toBe(EXIT_CODES.SUCCESS);

    const { exitCode, output } = await CLI.run(["eject", "agent-partials"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(output).toContain("already exist");
  });

  it("should allow re-eject with --force", async () => {
    tempDir = await createTempDir();

    const { exitCode: setupExitCode } = await CLI.run(["eject", "agent-partials"], {
      dir: tempDir,
    });
    expect(setupExitCode).toBe(EXIT_CODES.SUCCESS);

    const { exitCode, stdout } = await CLI.run(["eject", "agent-partials", "--force"], {
      dir: tempDir,
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Eject complete!");
  });

  it("should eject skills from a local source", async () => {
    tempDir = await createTempDir();
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceTempDir = srcTempDir;

    const { exitCode, stdout } = await CLI.run(["eject", "skills", "--source", sourceDir], {
      dir: tempDir,
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("skills ejected");

    const skillsDir = skillsPath(tempDir);
    expect(await directoryExists(skillsDir)).toBe(true);
    const files = await listFiles(skillsDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it("should eject all phases from a local source", async () => {
    tempDir = await createTempDir();
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceTempDir = srcTempDir;

    const { exitCode, stdout } = await CLI.run(["eject", "all", "--source", sourceDir], {
      dir: tempDir,
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("ejected");
    expect(stdout).toContain("Eject complete!");
  });

  it("should save source to config when --source flag is provided", async () => {
    tempDir = await createTempDir();
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceTempDir = srcTempDir;

    const { exitCode, stdout } = await CLI.run(["eject", "skills", "--source", sourceDir], {
      dir: tempDir,
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Source saved to .claude-src/config.ts");
  });

  it("should create config.ts in a fresh directory after eject", async () => {
    tempDir = await createTempDir();

    const { exitCode } = await CLI.run(["eject", "agent-partials"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const configPath = path.join(tempDir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
    expect(await fileExists(configPath)).toBe(true);
  });

  it("should display help text with --help flag", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await CLI.run(["eject", "--help"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("USAGE");
    expect(stdout).toContain("agent-partials");
    expect(stdout).toContain("templates");
    expect(stdout).toContain("skills");
    expect(stdout).toContain("all");
  });

  // BUG: CLI exits 0 with corrupt source — it falls back to default source
  // instead of reporting an error for the invalid --source directory.
  it.fails("should handle corrupt source without crashing", async () => {
    tempDir = await createTempDir();
    const corruptSourceDir = path.join(tempDir, "corrupt-source");
    await mkdir(corruptSourceDir, { recursive: true });
    await writeFile(path.join(corruptSourceDir, "garbage.txt"), "not a valid source");

    const { exitCode } = await CLI.run(["eject", "skills", "--source", corruptSourceDir], {
      dir: tempDir,
    });

    expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
  });

  it("should error when ejecting to a read-only directory", async () => {
    tempDir = await createTempDir();
    const readOnlyDir = path.join(tempDir, "read-only");
    await mkdir(readOnlyDir, { recursive: true });
    await chmod(readOnlyDir, 0o444);

    try {
      const { exitCode } = await CLI.run(["eject", "agent-partials", "-o", readOnlyDir], {
        dir: tempDir,
      });

      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    } finally {
      await chmod(readOnlyDir, 0o755);
    }
  });

  it("should eject templates and produce only the template file, not agent partials", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await CLI.run(["eject", "templates"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Agent templates ejected");
    expect(stdout).toContain("Eject complete!");

    // The agent.liquid template should exist
    const templatePath = path.join(
      tempDir,
      DIRS.CLAUDE_SRC,
      "agents",
      "_templates",
      "agent.liquid",
    );
    expect(await fileExists(templatePath)).toBe(true);

    // Agent partial directories (e.g., developer, reviewer) should NOT exist
    const agentsDir = path.join(tempDir, DIRS.CLAUDE_SRC, "agents");
    const contents = await listFiles(agentsDir);
    // Only _templates should be present, not individual agent dirs
    expect(contents).toContain("_templates");
    const nonTemplateEntries = contents.filter((entry) => entry !== "_templates");
    expect(nonTemplateEntries.length).toBe(0);
  });

  it("should eject skills without ejecting agent partials or templates", async () => {
    tempDir = await createTempDir();
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceTempDir = srcTempDir;

    const { exitCode, stdout } = await CLI.run(["eject", "skills", "--source", sourceDir], {
      dir: tempDir,
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("skills ejected");

    // Skills directory should exist with content
    const skillsDir = skillsPath(tempDir);
    expect(await directoryExists(skillsDir)).toBe(true);

    // The .claude-src/agents/ directory should NOT exist (no agent partials or templates ejected)
    const agentPartialsDir = path.join(tempDir, DIRS.CLAUDE_SRC, "agents");
    expect(await directoryExists(agentPartialsDir)).toBe(false);
  });

  it("should warn when ejecting templates twice without --force", async () => {
    tempDir = await createTempDir();

    const { exitCode: setupExitCode } = await CLI.run(["eject", "templates"], { dir: tempDir });
    expect(setupExitCode).toBe(EXIT_CODES.SUCCESS);

    const { exitCode, output } = await CLI.run(["eject", "templates"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(output).toContain("already exist");
  });

  it("should warn when ejecting skills twice without --force", async () => {
    tempDir = await createTempDir();
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceTempDir = srcTempDir;

    const { exitCode: setupExitCode } = await CLI.run(["eject", "skills", "--source", sourceDir], {
      dir: tempDir,
    });
    expect(setupExitCode).toBe(EXIT_CODES.SUCCESS);

    const { exitCode, output } = await CLI.run(["eject", "skills", "--source", sourceDir], {
      dir: tempDir,
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(output).toContain("already exist");
  });

  // BUG: The second eject with --force succeeds (exit 0) but reports
  // "0 skills ejected" or skips the ejected-count log entirely. The --force
  // flag bypasses the "already exist" guard but copySkillsToLocalFlattened
  // returns an empty result on re-eject, so "skills ejected" is missing.
  it.fails("should overwrite existing skills with --force", async () => {
    tempDir = await createTempDir();
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceTempDir = srcTempDir;

    const { exitCode: setupExitCode } = await CLI.run(["eject", "skills", "--source", sourceDir], {
      dir: tempDir,
    });
    expect(setupExitCode).toBe(EXIT_CODES.SUCCESS);

    const { exitCode, stdout } = await CLI.run(
      ["eject", "skills", "--source", sourceDir, "--force"],
      { dir: tempDir },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("skills ejected");
  });

  it("should eject templates to custom output directory", async () => {
    tempDir = await createTempDir();
    const outputDir = path.join(tempDir, "custom-templates");

    const { exitCode, stdout } = await CLI.run(["eject", "templates", "-o", outputDir], {
      dir: tempDir,
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Eject complete!");
    expect(stdout).toContain("Output directory:");
    expect(await directoryExists(outputDir)).toBe(true);
  });

  it("should eject skills to custom output directory", async () => {
    tempDir = await createTempDir();
    const outputDir = path.join(tempDir, "custom-skills");
    const { sourceDir, tempDir: srcTempDir } = await createE2ESource();
    e2eSourceTempDir = srcTempDir;

    const { exitCode, stdout } = await CLI.run(
      ["eject", "skills", "--source", sourceDir, "-o", outputDir],
      { dir: tempDir },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("skills ejected");
    expect(stdout).toContain("Eject complete!");
    expect(await directoryExists(outputDir)).toBe(true);
    const files = await listFiles(outputDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it("should error when --output points to an existing file", async () => {
    tempDir = await createTempDir();
    const filePath = path.join(tempDir, "not-a-dir");
    await writeFile(filePath, "I am a file, not a directory");

    const { exitCode, output } = await CLI.run(["eject", "agent-partials", "-o", filePath], {
      dir: tempDir,
    });

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(output).toContain("exists as a file");
  });
});
