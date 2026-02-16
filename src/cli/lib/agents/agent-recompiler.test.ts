import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile, readFile } from "fs/promises";
import { recompileAgents } from "./agent-recompiler";
import {
  CLI_ROOT,
  createTestDirs,
  cleanupTestDirs,
  writeTestSkill,
  fileExists,
} from "../__tests__/helpers";
import type { TestDirs } from "../__tests__/helpers";
import type { AgentName, SkillId } from "../../types";

describe("agent-recompiler", () => {
  let testDirs: TestDirs;

  beforeEach(async () => {
    testDirs = await createTestDirs("cc-recompiler-test-");
  });

  afterEach(async () => {
    await cleanupTestDirs(testDirs);
  });

  describe("recompileAgents", () => {
    it("returns empty compiled list when no agents exist", async () => {
      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_ROOT,
      });

      expect(result.compiled).toEqual([]);
      expect(result.warnings).toContain("No agents found to recompile");
    });

    it("recompiles a single agent specified in options", async () => {
      await writeTestSkill(testDirs.skillsDir, "test-skill");

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_ROOT,
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
        sourcePath: CLI_ROOT,
        agents: ["non-existent-agent-xyz" as AgentName],
      });

      expect(result.compiled).toEqual([]);
      expect(result.warnings).toContain(
        'Agent "non-existent-agent-xyz" not found in source definitions',
      );
    });

    it("uses config.yaml agent list when present", async () => {
      const configContent = `
name: test-plugin
description: Test plugin
agents:
  - web-pm
`;
      const configDir = path.join(testDirs.projectDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, "config.yaml"), configContent);

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_ROOT,
        projectDir: testDirs.projectDir,
      });

      expect(result.compiled).toContain("web-pm");
    });

    it("uses existing compiled agents when no config exists", async () => {
      await writeFile(path.join(testDirs.agentsDir, "web-pm.md"), "# Existing PM Agent\n");

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_ROOT,
      });

      expect(result.compiled).toContain("web-pm");
    });

    it("compiles multiple agents", async () => {
      await writeTestSkill(testDirs.skillsDir, "react");
      await writeTestSkill(testDirs.skillsDir, "hono");

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_ROOT,
        agents: ["web-developer", "api-developer", "web-pm"],
      });

      expect(result.compiled.length).toBeGreaterThanOrEqual(3);
      expect(result.compiled).toContain("web-developer");
      expect(result.compiled).toContain("api-developer");
      expect(result.compiled).toContain("web-pm");
    });

    it("uses provided skills instead of loading from plugin", async () => {
      const skillId = "web-custom-skill" as SkillId;
      const providedSkills = {
        [skillId]: {
          id: skillId,
          description: "Custom skill",
          path: "custom-skill/",
        },
      };

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_ROOT,
        agents: ["web-pm"],
        skills: providedSkills,
      });

      expect(result.compiled).toContain("web-pm");
    });

    it("generates valid agent markdown with frontmatter", async () => {
      await writeTestSkill(testDirs.skillsDir, "test-skill");

      await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_ROOT,
        agents: ["web-developer"],
      });

      const agentPath = path.join(testDirs.agentsDir, "web-developer.md");
      const content = await readFile(agentPath, "utf-8");

      expect(content).toMatch(/^---\n/);
      expect(content).toContain("name: web-developer");
      expect(content).toContain("description:");
      expect(content).toContain("<core_principles>");
    });

    it("respects projectDir for local template resolution", async () => {
      const localTemplatesDir = path.join(testDirs.projectDir, ".claude", "templates");
      await mkdir(localTemplatesDir, { recursive: true });

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: CLI_ROOT,
        agents: ["web-pm"],
        projectDir: testDirs.projectDir,
      });

      expect(result.compiled).toContain("web-pm");
    });
  });
});
