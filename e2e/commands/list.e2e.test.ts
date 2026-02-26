import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  createEditableProject,
  createLocalSkill,
  ensureBinaryExists,
  runCLI,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { CLAUDE_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";

describe("list command", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  it("should show no installation found in empty directory", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["list"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("No installation found");
  });

  it("should work with ls alias", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["ls"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("No installation found");
  });

  it("should suggest running init when no installation found", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["list"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("init");
  });

  it("should display help text with --help flag", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["list", "--help"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("USAGE");
    expect(stdout).toContain("Show installation information");
  });

  it("should display help text with ls --help alias", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["ls", "--help"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("USAGE");
  });

  describe("with local installation", () => {
    it("should show installation details for a local project", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir);

      const { exitCode, stdout } = await runCLI(["list"], projectDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Installation:");
      expect(stdout).toContain("Local");
      expect(stdout).toContain("Skills:");
      expect(stdout).toContain("Agents:");
    });

    it("should show correct skill count", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir, {
        skills: ["web-framework-react", "web-testing-vitest"],
      });

      const { exitCode, stdout } = await runCLI(["list"], projectDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Skills:");
      expect(stdout).toContain("2");
    });

    it("should show mode as Local for local installations", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir, {
        installMode: "local",
      });

      const { exitCode, stdout } = await runCLI(["list"], projectDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Mode:");
      expect(stdout).toContain("Local");
    });

    it("should show config path in output", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir);

      const { exitCode, stdout } = await runCLI(["list"], projectDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Config:");
      expect(stdout).toContain(STANDARD_FILES.CONFIG_YAML);
    });

    it("should show agent count when agents exist", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir, {
        agents: ["web-developer", "api-developer"],
      });

      // Create agent markdown files in the agents directory
      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      await writeFile(path.join(agentsDir, "web-developer.md"), "# Web Developer\n");
      await writeFile(path.join(agentsDir, "api-developer.md"), "# API Developer\n");

      const { exitCode, stdout } = await runCLI(["list"], projectDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Agents:");
      expect(stdout).toContain("2");
    });
  });

  describe("edge cases", () => {
    it("should handle project with skills directory but no config", async () => {
      tempDir = await createTempDir();

      // Create .claude/skills/ with a skill but no config.yaml
      const skillsDir = path.join(tempDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      await mkdir(skillsDir, { recursive: true });
      await createLocalSkill(tempDir, "web-testing-orphan-skill");

      const { exitCode, stdout } = await runCLI(["list"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // Without config.yaml, detectInstallation returns null
      expect(stdout).toContain("No installation found");
    });

    it("should work with ls alias on a local installation", async () => {
      tempDir = await createTempDir();
      const projectDir = await createEditableProject(tempDir);

      const { exitCode, stdout } = await runCLI(["ls"], projectDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Installation:");
      expect(stdout).toContain("Local");
    });
  });
});
