import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile, readFile } from "fs/promises";
import { recompileAgents } from "./agent-recompiler";
import { createTestDirs, cleanupTestDirs, writeTestSkill, fileExists } from "../__tests__/helpers";
import type { TestDirs } from "../__tests__/helpers";
import type { AgentName } from "../../types";

const CLI_REPO_PATH = path.resolve(__dirname, "../../..");

describe("agent-recompiler", () => {
  let testDirs: TestDirs;

  beforeEach(async () => {
    testDirs = await createTestDirs("cc-recompiler-test-");
  });

  afterEach(async () => {
    await cleanupTestDirs(testDirs);
  });

  describe("recompileAgents", () => {
    // TODO: These tests need updating for Phase 6 agent-centric configuration.
    // Agents now have skills defined in their YAMLs. Tests need to either:
    // 1. Provide the skills that agents reference, OR
    // 2. Use test agents without skills, OR
    // 3. Use a mock/option to bypass skill resolution

    it("returns empty compiled list when no agents exist", async () => {
      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_REPO_PATH,
      });

      expect(result.compiled).toEqual([]);
      expect(result.warnings).toContain("No agents found to recompile");
    });

    it.skip("recompiles a single agent specified in options", async () => {
      await writeTestSkill(testDirs.skillsDir, "test-skill");

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_REPO_PATH,
        agents: ["web-pm"], // PM is a simple agent likely to succeed
      });

      expect(result.compiled).toContain("web-pm");
      expect(result.failed).toEqual([]);

      const agentPath = path.join(testDirs.agentsDir, "web-pm.md");
      expect(await fileExists(agentPath)).toBe(true);
    });

    it("handles missing agent definitions gracefully", async () => {
      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_REPO_PATH,
        agents: ["non-existent-agent-xyz" as AgentName],
      });

      expect(result.compiled).toEqual([]);
      expect(result.warnings).toContain(
        'Agent "non-existent-agent-xyz" not found in source definitions',
      );
    });

    it.skip("uses config.yaml agent list when present", async () => {
      const configContent = `
name: test-plugin
version: 1.0.0
description: Test plugin
agents:
  - web-pm
`;
      await writeFile(path.join(testDirs.pluginDir, "config.yaml"), configContent);
      await writeTestSkill(testDirs.skillsDir, "test-skill");

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_REPO_PATH,
      });

      expect(result.compiled).toContain("web-pm");
    });

    it.skip("uses existing compiled agents when no config exists", async () => {
      await writeFile(path.join(testDirs.agentsDir, "web-pm.md"), "# Existing PM Agent\n");

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_REPO_PATH,
      });

      expect(result.compiled).toContain("web-pm");
    });

    it.skip("compiles multiple agents", async () => {
      await writeTestSkill(testDirs.skillsDir, "react");
      await writeTestSkill(testDirs.skillsDir, "hono");

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_REPO_PATH,
        agents: ["web-developer", "api-developer", "web-pm"],
      });

      expect(result.compiled.length).toBeGreaterThanOrEqual(3);
      expect(result.compiled).toContain("web-developer");
      expect(result.compiled).toContain("api-developer");
      expect(result.compiled).toContain("web-pm");
    });

    it.skip("uses provided skills instead of loading from plugin", async () => {
      const providedSkills = {
        "custom-skill": {
          name: "custom-skill",
          description: "Custom skill",
          path: "custom-skill/",
          id: "web-custom-skill" as import("../../types").SkillId,
        },
      };

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_REPO_PATH,
        agents: ["web-pm"],
        skills: providedSkills,
      });

      expect(result.compiled).toContain("web-pm");
    });

    it.skip("generates valid agent markdown with frontmatter", async () => {
      await writeTestSkill(testDirs.skillsDir, "test-skill");

      await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_REPO_PATH,
        agents: ["web-developer"],
      });

      const agentPath = path.join(testDirs.agentsDir, "web-developer.md");
      const content = await readFile(agentPath, "utf-8");

      expect(content).toMatch(/^---\n/);
      expect(content).toContain("name: web-developer");
      expect(content).toContain("description:");
      expect(content).toContain("<core_principles>");
    });

    it.skip("respects projectDir for local template resolution", async () => {
      const localTemplatesDir = path.join(testDirs.projectDir, ".claude", "templates");
      await mkdir(localTemplatesDir, { recursive: true });

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_REPO_PATH,
        agents: ["web-pm"],
        projectDir: testDirs.projectDir,
      });

      expect(result.compiled).toContain("web-pm");
    });
  });
});
