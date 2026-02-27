import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { runCliCommand, createTempDir, cleanupTempDir } from "../helpers";
import { getDashboardData, formatDashboardText } from "../../../commands/init";

describe("init command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-init-test-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  /**
   * Writes a minimal config so detectExistingInstallation() returns early,
   * avoiding the full loading + Wizard render. Use this for tests that only
   * need to verify flag parsing (no "unknown flag" error).
   */
  async function seedConfigForEarlyExit(): Promise<void> {
    const configDir = path.join(projectDir, ".claude-src");
    await mkdir(configDir, { recursive: true });
    await writeFile(path.join(configDir, "config.yaml"), "name: test-project\n");
  }

  describe("flag validation", () => {
    it("should accept --refresh flag", async () => {
      const { error } = await runCliCommand(["init", "--refresh"]);

      // Should not error on --refresh flag parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --source flag with path", async () => {
      const { error } = await runCliCommand(["init", "--source", "/some/path"]);

      // Should not error on --source flag parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -s shorthand for source", async () => {
      const { error } = await runCliCommand(["init", "-s", "/some/path"]);

      // Should accept -s shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --dry-run flag", async () => {
      // Seed config so init exits early (avoids Wizard render hang with --dry-run)
      await seedConfigForEarlyExit();

      const { error } = await runCliCommand(["init", "--dry-run"]);

      // Should not error on --dry-run flag parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });

  describe("combined flags", () => {
    it("should accept multiple flags together", async () => {
      // Seed config so init exits early (avoids Wizard render hang with --dry-run)
      await seedConfigForEarlyExit();

      const { error } = await runCliCommand([
        "init",
        "--refresh",
        "--dry-run",
        "--source",
        "/custom/source",
      ]);

      // Should accept all flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept shorthand flags together", async () => {
      const { error } = await runCliCommand(["init", "-s", "/custom/source"]);

      // Should accept shorthand flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("already initialized — dashboard", () => {
    it("should show dashboard when project is already initialized", async () => {
      const configDir = path.join(projectDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), "name: test-project\n");

      const { stdout, stderr, error } = await runCliCommand(["init"]);

      // Should NOT have an error exit code — dashboard exits with SUCCESS
      expect(error?.oclif?.exit).toBeUndefined();

      const combinedOutput = stdout + stderr + (error?.message || "");
      expect(combinedOutput).toContain("Agents Inc.");
      expect(combinedOutput).toContain("Skills:");
      expect(combinedOutput).toContain("Agents:");
      expect(combinedOutput).toContain("[Edit]");
      expect(combinedOutput).toContain("[Compile]");
      expect(combinedOutput).toContain("[Doctor]");
      expect(combinedOutput).toContain("[List]");
    });

    it("should show skill and agent counts in dashboard", async () => {
      const configDir = path.join(projectDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        "name: test-project\nskills:\n  - web-framework-react\n  - web-state-zustand\n",
      );

      // Create compiled agents
      const agentsDir = path.join(projectDir, ".claude", "agents");
      await mkdir(agentsDir, { recursive: true });
      await writeFile(path.join(agentsDir, "web-developer.md"), "# Web Developer");
      await writeFile(path.join(agentsDir, "api-developer.md"), "# API Developer");

      const data = await getDashboardData(projectDir);
      expect(data.skillCount).toBe(2);
      expect(data.agentCount).toBe(2);
      expect(data.mode).toBe("local");

      const text = formatDashboardText(data);
      expect(text).toContain("2 installed");
      expect(text).toContain("2 compiled");
    });

    it("should show source when configured", async () => {
      const configDir = path.join(projectDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        "name: test-project\nskills: []\nsource: github:agents-inc/skills\n",
      );

      const data = await getDashboardData(projectDir);
      expect(data.source).toBe("github:agents-inc/skills");

      const text = formatDashboardText(data);
      expect(text).toContain("github:agents-inc/skills");
    });

    it("should not modify existing config when already initialized", async () => {
      const configDir = path.join(projectDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      const configPath = path.join(configDir, "config.yaml");
      await writeFile(configPath, "name: test-project\n");

      await runCliCommand(["init"]);

      const { stat } = await import("fs/promises");
      const configStat = await stat(configPath);
      expect(configStat.isFile()).toBe(true);
    });

    it("should exit with SUCCESS when already initialized", async () => {
      const configDir = path.join(projectDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), "name: test-project\n");

      const { error } = await runCliCommand(["init"]);

      // No error exit code — dashboard exits cleanly
      expect(error?.oclif?.exit).toBeUndefined();
    });

    it("should show 0 counts when skills and agents are empty", async () => {
      const configDir = path.join(projectDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), "name: test-project\nskills: []\n");

      const data = await getDashboardData(projectDir);
      expect(data.skillCount).toBe(0);
      expect(data.agentCount).toBe(0);

      const text = formatDashboardText(data);
      expect(text).toContain("0 installed");
      expect(text).toContain("0 compiled");
    });
  });

  describe("formatDashboardText", () => {
    it("should format dashboard with all fields", () => {
      const text = formatDashboardText({
        skillCount: 12,
        agentCount: 3,
        mode: "plugin",
        source: "github:agents-inc/skills",
      });

      expect(text).toContain("Agents Inc.");
      expect(text).toContain("12 installed");
      expect(text).toContain("3 compiled");
      expect(text).toContain("Plugin");
      expect(text).toContain("github:agents-inc/skills");
      expect(text).toContain("[Edit]");
      expect(text).toContain("[Compile]");
      expect(text).toContain("[Doctor]");
      expect(text).toContain("[List]");
    });

    it("should omit source line when not configured", () => {
      const text = formatDashboardText({
        skillCount: 0,
        agentCount: 0,
        mode: "local",
      });

      expect(text).toContain("Local");
      expect(text).not.toContain("Source:");
    });

    it("should show Local for local mode", () => {
      const text = formatDashboardText({
        skillCount: 5,
        agentCount: 2,
        mode: "local",
      });

      expect(text).toContain("Local");
    });

    it("should show Plugin for plugin mode", () => {
      const text = formatDashboardText({
        skillCount: 5,
        agentCount: 2,
        mode: "plugin",
      });

      expect(text).toContain("Plugin");
    });
  });

  describe("error handling", () => {
    it("should handle invalid source path gracefully", async () => {
      const { error } = await runCliCommand(["init", "--source", "/definitely/not/real/path/xyz"]);

      // Should error but not crash
      expect(error).toBeDefined();
    });

    it("should reject unknown flags", async () => {
      const { error } = await runCliCommand(["init", "--nonexistent-flag"]);

      // Should error on unknown flag
      expect(error).toBeDefined();
    });
  });
});
