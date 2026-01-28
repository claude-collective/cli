import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile, readFile, readdir } from "fs/promises";
import { recompileAgents } from "./agent-recompiler";
import {
  createTestDirs,
  cleanupTestDirs,
  writeTestSkill,
  fileExists,
} from "./__tests__/helpers";
import type { TestDirs } from "./__tests__/helpers";

// Path to skills repo (agents, skills, templates)
// The CLI repo lives at /home/vince/dev/cli, skills repo at /home/vince/dev/claude-subagents
const SKILLS_REPO_PATH = path.resolve("/home/vince/dev/claude-subagents");

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
        sourcePath: SKILLS_REPO_PATH,
      });

      expect(result.compiled).toEqual([]);
      expect(result.warnings).toContain("No agents found to recompile");
    });

    it("recompiles a single agent specified in options", async () => {
      // Write a test skill
      await writeTestSkill(testDirs.skillsDir, "test-skill");

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: SKILLS_REPO_PATH,
        agents: ["pm"], // PM is a simple agent likely to succeed
      });

      expect(result.compiled).toContain("pm");
      expect(result.failed).toEqual([]);

      // Verify the agent file was created
      const agentPath = path.join(testDirs.agentsDir, "pm.md");
      expect(await fileExists(agentPath)).toBe(true);
    });

    it("handles missing agent definitions gracefully", async () => {
      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: SKILLS_REPO_PATH,
        agents: ["non-existent-agent-xyz"],
      });

      expect(result.compiled).toEqual([]);
      expect(result.warnings).toContain(
        'Agent "non-existent-agent-xyz" not found in source definitions',
      );
    });

    it("uses config.yaml agent list when present", async () => {
      // Create a config.yaml with specific agents (no agent_skills to avoid skill resolution)
      const configContent = `
name: test-plugin
version: 1.0.0
description: Test plugin
agents:
  - pm
`;
      await writeFile(
        path.join(testDirs.pluginDir, "config.yaml"),
        configContent,
      );
      await writeTestSkill(testDirs.skillsDir, "test-skill");

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: SKILLS_REPO_PATH,
      });

      expect(result.compiled).toContain("pm");
    });

    it("uses existing compiled agents when no config exists", async () => {
      // Create an existing agent file
      await writeFile(
        path.join(testDirs.agentsDir, "pm.md"),
        "# Existing PM Agent\n",
      );

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: SKILLS_REPO_PATH,
      });

      // Should detect and recompile the existing agent
      expect(result.compiled).toContain("pm");
    });

    it("compiles multiple agents", async () => {
      await writeTestSkill(testDirs.skillsDir, "react");
      await writeTestSkill(testDirs.skillsDir, "hono");

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: SKILLS_REPO_PATH,
        agents: ["frontend-developer", "backend-developer", "pm"],
      });

      expect(result.compiled.length).toBeGreaterThanOrEqual(3);
      expect(result.compiled).toContain("frontend-developer");
      expect(result.compiled).toContain("backend-developer");
      expect(result.compiled).toContain("pm");
    });

    it("uses provided skills instead of loading from plugin", async () => {
      const providedSkills = {
        "custom-skill": {
          name: "custom-skill",
          description: "Custom skill",
          path: "custom-skill/",
          content: "# Custom Skill\n\nCustom content.",
          frontmatter: {
            name: "custom-skill",
            description: "Custom skill",
          },
          examples: {},
          hasReference: false,
        },
      };

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: SKILLS_REPO_PATH,
        agents: ["pm"],
        skills: providedSkills,
      });

      expect(result.compiled).toContain("pm");
    });

    it("generates valid agent markdown with frontmatter", async () => {
      await writeTestSkill(testDirs.skillsDir, "test-skill");

      await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: SKILLS_REPO_PATH,
        agents: ["frontend-developer"],
      });

      const agentPath = path.join(testDirs.agentsDir, "frontend-developer.md");
      const content = await readFile(agentPath, "utf-8");

      // Should have YAML frontmatter
      expect(content).toMatch(/^---\n/);
      expect(content).toContain("name: frontend-developer");
      expect(content).toContain("description:");

      // Should have core principles section
      expect(content).toContain("<core_principles>");
    });

    it("respects projectDir for local template resolution", async () => {
      // Create a local templates directory (but don't add templates)
      // This just tests the option is passed through correctly
      const localTemplatesDir = path.join(
        testDirs.projectDir,
        ".claude",
        "templates",
      );
      await mkdir(localTemplatesDir, { recursive: true });

      const result = await recompileAgents({
        pluginDir: testDirs.pluginDir,
        sourcePath: SKILLS_REPO_PATH,
        agents: ["pm"],
        projectDir: testDirs.projectDir,
      });

      // Should still compile (falls back to bundled templates)
      expect(result.compiled).toContain("pm");
    });
  });
});
