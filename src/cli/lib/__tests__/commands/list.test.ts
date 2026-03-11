import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import {
  runCliCommand,
  createTempDir,
  cleanupTempDir,
  writeTestSkill,
  buildAgentConfigs,
} from "../helpers";
import { useMatrixStore } from "../../../stores/matrix-store";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES } from "../../../consts";
import { renderConfigTs } from "../content-generators";
import { VITEST_MATRIX } from "../mock-data/mock-matrices";

describe("list command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    tempDir = await createTempDir("cc-list-test-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);

    useMatrixStore.getState().setMatrix(VITEST_MATRIX);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  describe("command behavior", () => {
    it("should run without error when no installation exists", async () => {
      const { error } = await runCliCommand(["list"]);

      // Should not throw an unhandled error
      // The command should handle "no installation" gracefully
      if (error?.message) {
        expect(error.message).not.toContain("EEXIT");
      }
    });

    it("should work with ls alias", async () => {
      const { error } = await runCliCommand(["ls"]);

      // Alias should work the same as the full command
      if (error?.message) {
        expect(error.message).not.toContain("EEXIT");
      }
    });

    it("should show installation info when local installation exists", async () => {
      // Create a minimal local installation
      const claudeDir = path.join(projectDir, CLAUDE_DIR);
      const agentsDir = path.join(claudeDir, "agents");
      const skillsDir = path.join(claudeDir, "skills");

      await mkdir(agentsDir, { recursive: true });
      await mkdir(skillsDir, { recursive: true });

      // Write minimal config
      const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);
      await mkdir(claudeSrcDir, { recursive: true });
      await writeFile(
        path.join(claudeSrcDir, STANDARD_FILES.CONFIG_TS),
        renderConfigTs({
          name: "test-project",
          agents: buildAgentConfigs(["web-developer"]),
        }),
      );

      // Write a test agent
      await writeFile(
        path.join(agentsDir, "web-developer.md"),
        "# Web Developer\n\nTest agent content.",
      );

      // Write a test skill
      await writeTestSkill(skillsDir, "web-testing-vitest");

      const { error } = await runCliCommand(["list"]);

      // Should run successfully with a local installation
      expect(error).toBeUndefined();
    });
  });

  describe("flags", () => {
    it("should accept --help flag", async () => {
      const { error } = await runCliCommand(["list", "--help"]);

      // Help should always work
      expect(error).toBeUndefined();
    });
  });
});
