import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  createEditableProject,
  runCLI,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../src/cli/consts.js";

describe("doctor command", () => {
  let tempDir: string;
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

  it("should report config missing in unconfigured directory", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["doctor"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.ERROR);
    expect(stdout).toContain("Doctor");
    expect(stdout).toContain("Checking configuration health");
    expect(stdout).toContain("Config Valid");
    expect(stdout).toContain("config.yaml not found");
    expect(stdout).toContain("Summary:");
    expect(stdout).toContain("error");
  });

  it("should show skipped checks when config is missing", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["doctor"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.ERROR);
    expect(stdout).toContain("Skills Resolved");
    expect(stdout).toContain("Skipped");
    expect(stdout).toContain("Agents Compiled");
    expect(stdout).toContain("No Orphans");
  });

  it("should show source reachable check", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["doctor"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.ERROR);
    expect(stdout).toContain("Source Reachable");
  });

  it("should show tip to run init when config is missing", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["doctor"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.ERROR);
    expect(stdout).toContain("Tip:");
    expect(stdout).toContain("init");
  });

  it("should accept --source flag", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["doctor", "--source", "/nonexistent"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.ERROR);
    expect(stdout).toContain("Doctor");
    expect(stdout).toContain("Summary:");
  });

  it("should pass config check with valid config file", async () => {
    tempDir = await createTempDir();
    const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, STANDARD_FILES.CONFIG_YAML),
      "name: test-project\ninstallMode: local\nagents:\n  - web-developer\n",
    );

    const { exitCode, stdout } = await runCLI(["doctor"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Config Valid");
    expect(stdout).toContain("is valid");
  });

  describe("--verbose flag", () => {
    it("should show additional details with --verbose", async () => {
      tempDir = await createTempDir();
      const source = await createE2ESource();
      sourceTempDir = source.tempDir;

      const { exitCode, stdout } = await runCLI(
        ["doctor", "--verbose", "--source", source.sourceDir],
        tempDir,
      );

      // --verbose causes formatCheckLine to show details even for "pass" results.
      // The Source Reachable check passes and includes "N skills available" in details.
      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(stdout).toContain("skills available");
    });
  });

  describe("valid config with local E2E source", () => {
    it("should show Source Reachable with local source info and skill count", async () => {
      tempDir = await createTempDir();
      const source = await createE2ESource();
      sourceTempDir = source.tempDir;

      const projectDir = await createEditableProject(tempDir);

      const { exitCode, stdout } = await runCLI(
        ["doctor", "--verbose", "--source", source.sourceDir],
        projectDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // Source Reachable check: "Connected to local: <path>"
      expect(stdout).toContain("Connected to local:");
      // Details line shows skill count
      expect(stdout).toContain("skills available");
      // Config Valid should pass
      expect(stdout).toContain("Config Valid");
      expect(stdout).toContain("is valid");
    });
  });

  describe("agents compiled check", () => {
    it("should pass when agent .md files exist for configured agents", async () => {
      tempDir = await createTempDir();
      const source = await createE2ESource();
      sourceTempDir = source.tempDir;

      const projectDir = await createEditableProject(tempDir, {
        agents: ["web-developer"],
      });

      // Create the compiled agent .md file so checkAgentsCompiled passes
      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      await writeFile(path.join(agentsDir, "web-developer.md"), "# Web Developer\n");

      const { exitCode, stdout } = await runCLI(
        ["doctor", "--source", source.sourceDir],
        projectDir,
      );

      // checkAgentsCompiled returns pass with "N/N agents compiled"
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Agents Compiled");
      expect(stdout).toContain("agents compiled");
    });

    it("should warn when agent .md files are missing for configured agents", async () => {
      tempDir = await createTempDir();
      const source = await createE2ESource();
      sourceTempDir = source.tempDir;

      const projectDir = await createEditableProject(tempDir, {
        agents: ["web-developer"],
      });
      // Do NOT create web-developer.md -- it's missing

      const { exitCode, stdout } = await runCLI(
        ["doctor", "--source", source.sourceDir],
        projectDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // checkAgentsCompiled returns warn with "N agent(s) need recompilation"
      expect(stdout).toContain("Agents Compiled");
      expect(stdout).toContain("recompilation");
      // The tip suggests running compile
      expect(stdout).toContain("compile");
    });
  });

  describe("orphaned agent files check", () => {
    it("should warn when orphaned .md files exist in agents dir", async () => {
      tempDir = await createTempDir();
      const source = await createE2ESource();
      sourceTempDir = source.tempDir;

      const projectDir = await createEditableProject(tempDir, {
        agents: ["web-developer"],
      });

      // Create the configured agent file AND an orphan
      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      await writeFile(path.join(agentsDir, "web-developer.md"), "# Web Developer\n");
      await writeFile(path.join(agentsDir, "orphan-agent.md"), "# Orphan\n");

      const { exitCode, stdout } = await runCLI(
        ["doctor", "--source", source.sourceDir],
        projectDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // checkNoOrphans returns warn with "N orphaned agent file(s)"
      expect(stdout).toContain("No Orphans");
      expect(stdout).toContain("orphan");
      expect(stdout).toContain("not in config");
    });
  });
});
