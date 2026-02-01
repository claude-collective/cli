import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "fs/promises";
import {
  compileStackPlugin,
  printStackCompilationSummary,
  type CompiledStackPlugin,
} from "./stack-plugin-compiler";

describe("stack-plugin-compiler", () => {
  let tempDir: string;
  let projectRoot: string;
  let outputDir: string;
  let testCounter = 0;

  // Generate unique stack ID to avoid cache collisions between tests
  // The loader caches stacks by mode:stackId, so we need unique IDs per test
  function uniqueStackId(base = "test-stack"): string {
    testCounter++;
    return `${base}-${testCounter}-${Date.now()}`;
  }

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "stack-compiler-test-"));
    projectRoot = path.join(tempDir, "project");
    outputDir = path.join(tempDir, "output");

    await mkdir(outputDir, { recursive: true });
    await mkdir(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // =============================================================================
  // Helper Functions
  // =============================================================================

  async function createProjectStructure() {
    // Create directories
    const agentsDir = path.join(projectRoot, "src/agents");
    const templatesDir = path.join(projectRoot, "src/agents/_templates");
    const configDir = path.join(projectRoot, "config");

    await mkdir(agentsDir, { recursive: true });
    await mkdir(templatesDir, { recursive: true });
    await mkdir(configDir, { recursive: true });

    // Create agent template
    await writeFile(
      path.join(templatesDir, "agent.liquid"),
      `---
name: {{ agent.name }}
description: {{ agent.description }}
tools: {{ agent.tools | join: ", " }}
{%- if preloadedSkillIds.size > 0 %}
skills: {{ preloadedSkillIds | join: ", " }}
{%- endif %}
---

{{ intro }}

<core_principles>
Core principles are embedded directly in the template.
</core_principles>

{{ workflow }}
`,
    );

    return { agentsDir, templatesDir, configDir };
  }

  async function createAgent(
    agentsDir: string,
    agentId: string,
    config: {
      title: string;
      description: string;
      tools: string[];
      intro?: string;
      workflow?: string;
      skills?: Array<{ category: string; id: string; preloaded?: boolean }>;
    },
  ) {
    const agentDir = path.join(agentsDir, agentId);
    await mkdir(agentDir, { recursive: true });

    // Build skills YAML if provided
    let skillsYaml = "";
    if (config.skills && config.skills.length > 0) {
      skillsYaml = "skills:\n";
      for (const skill of config.skills) {
        skillsYaml += `  ${skill.category}:\n`;
        skillsYaml += `    id: "${skill.id}"\n`;
        skillsYaml += `    preloaded: ${skill.preloaded ?? false}\n`;
      }
    }

    // Create agent.yaml
    await writeFile(
      path.join(agentDir, "agent.yaml"),
      `id: ${agentId}
title: ${config.title}
description: ${config.description}
tools:
${config.tools.map((t) => `  - ${t}`).join("\n")}
${skillsYaml}`,
    );

    // Create intro.md
    await writeFile(
      path.join(agentDir, "intro.md"),
      config.intro || `# ${config.title}\n\nThis is the ${agentId} agent.`,
    );

    // Create workflow.md
    await writeFile(
      path.join(agentDir, "workflow.md"),
      config.workflow || `## Workflow\n\n1. Analyze\n2. Implement\n3. Test`,
    );
  }

  interface TestStack {
    id: string;
    name: string;
    description: string;
    agents: string[];
    philosophy?: string;
  }

  function createStack(
    stackId: string,
    config: {
      name: string;
      description?: string;
      agents: string[];
      philosophy?: string;
    },
  ): TestStack {
    // Return a Stack object for passing to compileStackPlugin
    return {
      id: stackId,
      name: config.name,
      description: config.description || "",
      agents: config.agents,
      philosophy: config.philosophy,
    };
  }

  async function createSkillInStack(
    stackDir: string,
    skillId: string,
    config: { name: string; description: string; content?: string },
  ) {
    const skillDir = path.join(stackDir, "skills", skillId);
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: ${config.name}
description: ${config.description}
---

${config.content || `# ${config.name}\n\nSkill content here.`}
`,
    );
  }

  /**
   * Create a skill in src/skills/ (new architecture)
   * @param directoryPath - filesystem path like "frontend/framework/react (@vince)"
   * @param config.name - frontmatter name (canonical ID) like "frontend/react (@vince)"
   */
  async function createSkillInSource(
    directoryPath: string,
    config: { name: string; description: string; content?: string },
  ) {
    const skillDir = path.join(projectRoot, "src", "skills", directoryPath);
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, "SKILL.md"),
      `---
name: ${config.name}
description: ${config.description}
---

${config.content || `# ${config.name}\n\nSkill content here.`}
`,
    );
  }

  // =============================================================================
  // compileStackPlugin - Main Function Tests
  // =============================================================================

  describe("compileStackPlugin", () => {
    it("should create plugin directory structure", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write", "Glob"],
      });

      // Create skill in src/skills/ (new architecture)
      // Directory path is where the files live, frontmatter name is the canonical ID
      const directoryPath = "frontend/framework/react (@vince)";
      const frontmatterName = "react (@vince)";
      await createSkillInSource(directoryPath, {
        name: frontmatterName,
        description: "React development skills",
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        description: "A test stack",
        agents: ["web-developer"],
        // Reference by canonical ID (frontmatter name)
        skills: [{ id: frontmatterName, preloaded: true }],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      // Verify directory exists
      const stats = await stat(result.pluginPath);
      expect(stats.isDirectory()).toBe(true);

      // Verify agents subdirectory
      const agentsDirOutput = path.join(result.pluginPath, "agents");
      const agentStats = await stat(agentsDirOutput);
      expect(agentStats.isDirectory()).toBe(true);
    });

    it("should generate valid plugin.json in .claude-plugin directory", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
      });

      const stackId = uniqueStackId("my-stack");
      const stack = createStack(stackId, {
        name: "My Stack",
        description: "My custom stack",
        agents: ["web-developer"],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const manifestPath = path.join(
        result.pluginPath,
        ".claude-plugin",
        "plugin.json",
      );
      const manifestContent = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestContent);

      expect(manifest.name).toBe(stackId);
      expect(manifest.description).toBe("My custom stack");
      expect(manifest.version).toBe("1.0.0"); // Semver versioning
      // content_hash and updated are no longer in manifest - stored internally
      expect(manifest.content_hash).toBeUndefined();
      expect(manifest.updated).toBeUndefined();
      // Claude Code discovers agents automatically from ./agents/ directory
      expect(manifest.agents).toBeUndefined();
    });

    it("should compile agent markdown files to agents directory", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
        intro: "# Frontend Developer\n\nThis is the intro.",
        workflow: "## Workflow\n\n1. Build components",
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        agents: ["web-developer"],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const agentMdPath = path.join(
        result.pluginPath,
        "agents",
        "web-developer.md",
      );
      const agentContent = await readFile(agentMdPath, "utf-8");

      expect(agentContent).toContain("name: web-developer");
      expect(agentContent).toContain("Frontend Developer");
      expect(agentContent).toContain("Build components");
    });

    it("should generate README.md with stack information", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        description: "A comprehensive test stack",
        agents: ["web-developer"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");

      expect(readmeContent).toContain("# Test Stack");
      expect(readmeContent).toContain("A comprehensive test stack");
      expect(readmeContent).toContain("## Installation");
      expect(readmeContent).toContain(stackId);
    });

    // Skip: tags removed from new stack format (config/stacks.yaml)
    it.skip("should include tags in README when stack has tags", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        tags: ["frontend", "react", "typescript"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");

      expect(readmeContent).toContain("## Tags");
      expect(readmeContent).toContain("`frontend`");
      expect(readmeContent).toContain("`react`");
      expect(readmeContent).toContain("`typescript`");
    });

    it("should include philosophy in README when stack has philosophy", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        philosophy: "Keep things simple and testable",
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");

      expect(readmeContent).toContain("## Philosophy");
      expect(readmeContent).toContain("Keep things simple and testable");
    });

    // Skip: principles removed from new stack format (config/stacks.yaml)
    it.skip("should include principles in README when stack has principles", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        principles: ["Test first", "Ship fast", "Keep it simple"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");

      expect(readmeContent).toContain("## Principles");
      expect(readmeContent).toContain("- Test first");
      expect(readmeContent).toContain("- Ship fast");
      expect(readmeContent).toContain("- Keep it simple");
    });

    it("should list agents in README", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
      });

      await createAgent(agentsDir, "api-developer", {
        title: "Backend Developer",
        description: "A backend developer agent",
        tools: ["Read", "Write", "Bash"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer", "api-developer"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");

      expect(readmeContent).toContain("## Agents");
      expect(readmeContent).toContain("`web-developer`");
      expect(readmeContent).toContain("`api-developer`");
    });

    // Skip: CLAUDE.md copying requires legacy stack directory structure
    // which has been removed in favor of agent-centric config
    it.skip("should copy CLAUDE.md to plugin root when present", async () => {
      // Test skipped - stack-specific directories no longer exist
    });

    it("should return compiled agents list", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      await createAgent(agentsDir, "web-tester", {
        title: "Tester",
        description: "A testing agent",
        tools: ["Read", "Bash"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer", "web-tester"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      expect(result.agents).toContain("web-developer");
      expect(result.agents).toContain("web-tester");
      expect(result.agents).toHaveLength(2);
    });

    it("should return skill plugin references", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      // Create skills in src/skills/ (new architecture)
      const reactDirPath = "frontend/framework/react (@vince)";
      const reactCanonicalId = "react (@vince)";
      const tsDirPath = "frontend/language/typescript (@vince)";
      const tsCanonicalId = "typescript (@vince)";

      await createSkillInSource(reactDirPath, {
        name: reactCanonicalId,
        description: "React development",
      });

      await createSkillInSource(tsDirPath, {
        name: tsCanonicalId,
        description: "TypeScript development",
      });

      // Agent with skills defined (Phase 6: skills in agent YAML)
      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
        skills: [
          { category: "framework", id: reactCanonicalId, preloaded: true },
          { category: "language", id: tsCanonicalId, preloaded: false },
        ],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        agents: ["web-developer"],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      // Skill plugins now use canonical frontmatter names (simplified ID format)
      expect(result.skillPlugins).toContain("react (@vince)");
      expect(result.skillPlugins).toContain("typescript (@vince)");
    });

    it("should return correct manifest structure", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        description: "A versioned stack",
        agents: ["web-developer"],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      expect(result.manifest.name).toBe(stackId);
      expect(result.manifest.description).toBe("A versioned stack");
      expect(result.manifest.version).toBe("1.0.0"); // Semver versioning
      // Author comes from stack.author which is empty in new format
    });

    it("should return stack name from config", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Modern React Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      expect(result.stackName).toBe("Modern React Stack");
    });
  });

  // =============================================================================
  // compileStackPlugin - Error Handling Tests
  // =============================================================================

  describe("compileStackPlugin - error handling", () => {
    it("should throw error when stack config is missing", async () => {
      await createProjectStructure();

      await expect(
        compileStackPlugin({
          stackId: "nonexistent-stack",
          outputDir,
          projectRoot,
        }),
      ).rejects.toThrow();
    });

    it("should throw error when agent is missing", async () => {
      await createProjectStructure();

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        agents: ["missing-agent"],
      });

      await expect(
        compileStackPlugin({
          stackId,
          outputDir,
          projectRoot,
          stack,
        }),
      ).rejects.toThrow();
    });

    // Skip: In new agent-centric model, skills come from agents not stacks.
    // Missing skill errors are handled differently (warning instead of throw).
    it.skip("should throw error when skill is missing", async () => {
      // Test skipped - skill references now in agent YAMLs
    });
  });

  // =============================================================================
  // compileStackPlugin - Edge Cases
  // =============================================================================

  describe("compileStackPlugin - edge cases", () => {
    it("should handle stack with no skills", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      expect(result.skillPlugins).toHaveLength(0);

      // README should not have "Required Skill Plugins" section
      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");
      expect(readmeContent).not.toContain("## Required Skill Plugins");
    });

    it("should handle stack with no tags", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [],
        // No tags
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");
      expect(readmeContent).not.toContain("## Tags");
    });

    it("should handle stack with no philosophy", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [],
        // No philosophy
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");
      expect(readmeContent).not.toContain("## Philosophy");
    });

    it("should handle stack with no principles", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [],
        // No principles
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");
      expect(readmeContent).not.toContain("## Principles");
    });

    it("should handle stack with no description", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [],
        // No description
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");
      // Should use default description
      expect(readmeContent).toContain("A Claude Code stack plugin.");
    });

    it("should handle stack without CLAUDE.md", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [],
      });

      // Don't create CLAUDE.md

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      // Plugin should still be created successfully
      expect(result.pluginPath).toBeDefined();

      // CLAUDE.md should not exist in output
      let claudeExists = false;
      try {
        await stat(path.join(result.pluginPath, "CLAUDE.md"));
        claudeExists = true;
      } catch {
        claudeExists = false;
      }
      expect(claudeExists).toBe(false);
    });

    it("should handle multiple agents in a single stack", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
      });

      await createAgent(agentsDir, "api-developer", {
        title: "Backend Developer",
        description: "A backend developer agent",
        tools: ["Read", "Write", "Bash"],
      });

      await createAgent(agentsDir, "web-tester", {
        title: "Tester",
        description: "A web-tester agent",
        tools: ["Read", "Bash"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Full Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer", "api-developer", "web-tester"],
        skills: [],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      // All agents should be compiled
      expect(result.agents).toHaveLength(3);
      expect(result.agents).toContain("web-developer");
      expect(result.agents).toContain("api-developer");
      expect(result.agents).toContain("web-tester");

      // All agent files should exist
      for (const agent of result.agents) {
        const agentPath = path.join(result.pluginPath, "agents", `${agent}.md`);
        const agentStats = await stat(agentPath);
        expect(agentStats.isFile()).toBe(true);
      }
    });

    it("should include skill plugins in README when skills are present", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      // Create skills in src/skills/ (new architecture)
      const reactDirPath = "frontend/framework/react (@vince)";
      const reactCanonicalId = "react (@vince)";
      const zustandDirPath =
        "frontend/client-state-management/zustand (@vince)";
      const zustandCanonicalId = "zustand (@vince)";

      await createSkillInSource(reactDirPath, {
        name: reactCanonicalId,
        description: "React development",
      });

      await createSkillInSource(zustandDirPath, {
        name: zustandCanonicalId,
        description: "State management",
      });

      // Agent with skills (Phase 6: skills in agent YAML)
      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
        skills: [
          { category: "framework", id: reactCanonicalId, preloaded: true },
          { category: "state", id: zustandCanonicalId, preloaded: false },
        ],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        agents: ["web-developer"],
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");

      // README now uses "Included Skills" with canonical IDs
      expect(readmeContent).toContain("## Included Skills");
      expect(readmeContent).toContain("`react (@vince)`");
      expect(readmeContent).toContain("`zustand (@vince)`");
    });
  });

  // =============================================================================
  // printStackCompilationSummary Tests
  // =============================================================================

  describe("printStackCompilationSummary", () => {
    it("should print stack name and path", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: CompiledStackPlugin = {
        pluginPath: "/output/test-stack",
        manifest: { name: "test-stack", version: "1.0.0" },
        stackName: "Test Stack",
        agents: ["web-developer"],
        skillPlugins: ["react (@vince)"],
        hasHooks: false,
      };

      printStackCompilationSummary(result);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Test Stack"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("/output/test-stack"),
      );

      consoleSpy.mockRestore();
    });

    it("should print agent count and list", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: CompiledStackPlugin = {
        pluginPath: "/output/test-stack",
        manifest: { name: "test-stack" },
        stackName: "Test Stack",
        agents: ["web-developer", "api-developer", "web-tester"],
        skillPlugins: [],
        hasHooks: false,
      };

      printStackCompilationSummary(result);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Agents: 3"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("web-developer"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("api-developer"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("web-tester"),
      );

      consoleSpy.mockRestore();
    });

    it("should print skill plugins when present", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: CompiledStackPlugin = {
        pluginPath: "/output/test-stack",
        manifest: { name: "test-stack" },
        stackName: "Test Stack",
        agents: ["web-developer"],
        skillPlugins: [
          "react (@vince)",
          "zustand (@vince)",
          "typescript (@vince)",
        ],
        hasHooks: false,
      };

      printStackCompilationSummary(result);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skills included: 3"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("react (@vince)"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("zustand (@vince)"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("typescript (@vince)"),
      );

      consoleSpy.mockRestore();
    });

    it("should not print skill plugins section when empty", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: CompiledStackPlugin = {
        pluginPath: "/output/test-stack",
        manifest: { name: "test-stack" },
        stackName: "Test Stack",
        agents: ["web-developer"],
        skillPlugins: [],
        hasHooks: false,
      };

      printStackCompilationSummary(result);

      // Check that "Skills included" was never called
      const calls = consoleSpy.mock.calls.flat().join("\n");
      expect(calls).not.toContain("Skills included");

      consoleSpy.mockRestore();
    });

    it("should print hooks status when enabled", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: CompiledStackPlugin = {
        pluginPath: "/output/test-stack",
        manifest: { name: "test-stack" },
        stackName: "Test Stack",
        agents: ["web-developer"],
        skillPlugins: [],
        hasHooks: true,
      };

      printStackCompilationSummary(result);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Hooks: enabled"),
      );

      consoleSpy.mockRestore();
    });

    it("should not print hooks status when disabled", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: CompiledStackPlugin = {
        pluginPath: "/output/test-stack",
        manifest: { name: "test-stack" },
        stackName: "Test Stack",
        agents: ["web-developer"],
        skillPlugins: [],
        hasHooks: false,
      };

      printStackCompilationSummary(result);

      const calls = consoleSpy.mock.calls.flat().join("\n");
      expect(calls).not.toContain("Hooks:");

      consoleSpy.mockRestore();
    });
  });

  // =============================================================================
  // compileStackPlugin - Hooks Tests
  // Skip: hooks removed from new stack format (config/stacks.yaml)
  // =============================================================================

  describe.skip("compileStackPlugin - hooks", () => {
    it("should generate hooks/hooks.json when stack has hooks", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [],
        hooks: {
          PostToolUse: [
            {
              matcher: "Write|Edit",
              hooks: [
                {
                  type: "command",
                  command: "${CLAUDE_PLUGIN_ROOT}/scripts/format.sh",
                  timeout: 30,
                },
              ],
            },
          ],
        },
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      // Verify hasHooks is true
      expect(result.hasHooks).toBe(true);

      // Verify hooks.json was created
      const hooksJsonPath = path.join(result.pluginPath, "hooks", "hooks.json");
      const hooksContent = await readFile(hooksJsonPath, "utf-8");
      const hooksJson = JSON.parse(hooksContent);

      expect(hooksJson.hooks).toBeDefined();
      expect(hooksJson.hooks.PostToolUse).toBeDefined();
      expect(hooksJson.hooks.PostToolUse).toHaveLength(1);
      expect(hooksJson.hooks.PostToolUse[0].matcher).toBe("Write|Edit");
      expect(hooksJson.hooks.PostToolUse[0].hooks).toHaveLength(1);
      expect(hooksJson.hooks.PostToolUse[0].hooks[0].type).toBe("command");
    });

    it("should include hooks path in manifest when hooks exist", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [],
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: "command",
                  command: "echo 'Session started'",
                },
              ],
            },
          ],
        },
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      // Verify manifest includes hooks path
      expect(result.manifest.hooks).toBe("./hooks/hooks.json");
    });

    it("should not generate hooks.json when stack has no hooks", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [],
        // No hooks
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      // Verify hasHooks is false
      expect(result.hasHooks).toBe(false);

      // Verify hooks directory does not exist
      let hooksExists = false;
      try {
        await stat(path.join(result.pluginPath, "hooks"));
        hooksExists = true;
      } catch {
        hooksExists = false;
      }
      expect(hooksExists).toBe(false);

      // Verify manifest does not include hooks
      expect(result.manifest.hooks).toBeUndefined();
    });

    it("should handle multiple hook events", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [],
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: "command",
                  command: "echo 'Starting'",
                },
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: "Write",
              hooks: [
                {
                  type: "command",
                  command: "npm run format",
                },
              ],
            },
          ],
          SessionEnd: [
            {
              hooks: [
                {
                  type: "command",
                  command: "echo 'Ending'",
                },
              ],
            },
          ],
        },
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const hooksJsonPath = path.join(result.pluginPath, "hooks", "hooks.json");
      const hooksContent = await readFile(hooksJsonPath, "utf-8");
      const hooksJson = JSON.parse(hooksContent);

      expect(Object.keys(hooksJson.hooks)).toHaveLength(3);
      expect(hooksJson.hooks.SessionStart).toBeDefined();
      expect(hooksJson.hooks.PostToolUse).toBeDefined();
      expect(hooksJson.hooks.SessionEnd).toBeDefined();
    });

    it("should handle hooks without matcher", async () => {
      const { agentsDir, configDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        version: "1.0.0",
        author: "@test",
        agents: ["web-developer"],
        skills: [],
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: "command",
                  command: "echo 'No matcher'",
                },
              ],
            },
          ],
        },
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const hooksJsonPath = path.join(result.pluginPath, "hooks", "hooks.json");
      const hooksContent = await readFile(hooksJsonPath, "utf-8");
      const hooksJson = JSON.parse(hooksContent);

      expect(hooksJson.hooks.SessionStart[0].matcher).toBeUndefined();
      expect(hooksJson.hooks.SessionStart[0].hooks).toBeDefined();
    });
  });
});
