import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import { mkdir, readFile, stat } from "fs/promises";
import {
  compileAgentForPlugin,
  compileStackPlugin,
  printStackCompilationSummary,
} from "./stack-plugin-compiler";
import {
  createTestSource,
  cleanupTestSource,
  writeTestFile,
  type TestDirs,
} from "../__tests__/fixtures/create-test-source";
import {
  createMockSkillEntry,
  createMockAgentConfig,
  createMockCompiledStackPlugin,
} from "../__tests__/helpers";

import type { SkillAssignment, SkillId, Stack, StackAgentConfig, Subcategory } from "../../types";

describe("stack-plugin-compiler", () => {
  let dirs: TestDirs;
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
    // createTestSource sets up source dir with agents/, skills/, config/, and templates
    dirs = await createTestSource({ skills: [], agents: [] });
    // The compiler uses sourceDir as projectRoot (contains src/agents/, src/skills/, config/)
    projectRoot = dirs.sourceDir;
    outputDir = path.join(dirs.tempDir, "output");
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  /** Write agent files (agent.yaml, intro.md, workflow.md) into the agents directory */
  async function createAgent(
    agentId: string,
    config: {
      title: string;
      description: string;
      tools: string[];
      intro?: string;
      workflow?: string;
    },
  ) {
    const agentDir = path.join(dirs.agentsDir, agentId);
    await mkdir(agentDir, { recursive: true });

    await writeTestFile(
      path.join(agentDir, "agent.yaml"),
      `id: ${agentId}\ntitle: ${config.title}\ndescription: ${config.description}\ntools:\n${config.tools.map((t) => `  - ${t}`).join("\n")}\n`,
    );
    await writeTestFile(
      path.join(agentDir, "intro.md"),
      config.intro || `# ${config.title}\n\nThis is the ${agentId} agent.`,
    );
    await writeTestFile(
      path.join(agentDir, "workflow.md"),
      config.workflow || `## Workflow\n\n1. Analyze\n2. Implement\n3. Test`,
    );
  }

  function createStack(
    stackId: string,
    config: {
      name: string;
      description?: string;
      agents: string[];
      philosophy?: string;
      /** Skill assignments per agent, keyed by subcategory */
      agentSkills?: Record<string, Partial<Record<Subcategory, SkillAssignment[]>>>;
    },
  ): Stack {
    // Convert agents array to Record<string, StackAgentConfig>
    const agentsRecord: Record<string, StackAgentConfig> = {};
    for (const agentId of config.agents) {
      agentsRecord[agentId] = config.agentSkills?.[agentId] ?? {};
    }

    return {
      id: stackId,
      name: config.name,
      description: config.description || "",
      agents: agentsRecord,
      philosophy: config.philosophy,
    };
  }

  /** Write a SKILL.md file at the given path under src/skills/ */
  async function createSkillInSource(
    directoryPath: string,
    config: { name: string; description: string; content?: string },
  ) {
    const skillDir = path.join(dirs.skillsDir, directoryPath);
    await mkdir(skillDir, { recursive: true });

    await writeTestFile(
      path.join(skillDir, "SKILL.md"),
      `---\nname: ${config.name}\ndescription: ${config.description}\n---\n\n${config.content || `# ${config.name}\n\nSkill content here.`}\n`,
    );
  }

  describe("compileStackPlugin", () => {
    it("should create plugin directory structure", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write", "Glob"],
      });

      // Create skill in src/skills/ (new architecture)
      // Directory path is where the files live, frontmatter name is the canonical ID
      const directoryPath = "web/framework/react (@vince)";
      const frontmatterName = "web-framework-react" as SkillId;
      await createSkillInSource(directoryPath, {
        name: frontmatterName,
        description: "React development skills",
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        description: "A test stack",
        agents: ["web-developer"],
        agentSkills: {
          "web-developer": {
            "web-framework": [{ id: frontmatterName, preloaded: true }],
          },
        },
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
      await createAgent("web-developer", {
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

      const manifestPath = path.join(result.pluginPath, ".claude-plugin", "plugin.json");
      const manifestContent = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestContent);

      expect(manifest.name).toBe(stackId);
      expect(manifest.description).toBe("My custom stack");
      expect(manifest.version).toBe("1.0.0"); // Semver versioning
      // contentHash and updated are no longer in manifest - stored internally
      expect(manifest.contentHash).toBeUndefined();
      expect(manifest.updated).toBeUndefined();
      // Claude Code discovers agents automatically from ./agents/ directory
      expect(manifest.agents).toBeUndefined();
    });

    it("should compile agent markdown files to agents directory", async () => {
      await createAgent("web-developer", {
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

      const agentMdPath = path.join(result.pluginPath, "agents", "web-developer.md");
      const agentContent = await readFile(agentMdPath, "utf-8");

      expect(agentContent).toContain("name: web-developer");
      expect(agentContent).toContain("Frontend Developer");
      expect(agentContent).toContain("Build components");
    });

    it("should generate README.md with stack information", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        description: "A comprehensive test stack",
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

      expect(readmeContent).toContain("# Test Stack");
      expect(readmeContent).toContain("A comprehensive test stack");
      expect(readmeContent).toContain("## Installation");
      expect(readmeContent).toContain(stackId);
    });

    it("should list agents in README", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
      });

      await createAgent("api-developer", {
        title: "Backend Developer",
        description: "A backend developer agent",
        tools: ["Read", "Write", "Bash"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        agents: ["web-developer", "api-developer"],
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

    it("should return compiled agents list", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      await createAgent("web-tester", {
        title: "Tester",
        description: "A testing agent",
        tools: ["Read", "Bash"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        agents: ["web-developer", "web-tester"],
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
      // Create skills in src/skills/ (new architecture)
      const reactDirPath = "web/framework/react (@vince)";
      const reactCanonicalId = "web-framework-react" as SkillId;
      const tsDirPath = "web/language/typescript (@vince)";
      const tsCanonicalId = "web-language-typescript" as SkillId;

      await createSkillInSource(reactDirPath, {
        name: reactCanonicalId,
        description: "React development",
      });

      await createSkillInSource(tsDirPath, {
        name: tsCanonicalId,
        description: "TypeScript development",
      });

      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      // Skills assigned via stack agent config (current architecture)
      const stack = createStack(stackId, {
        name: "Test Stack",
        agents: ["web-developer"],
        agentSkills: {
          "web-developer": {
            "web-framework": [{ id: reactCanonicalId, preloaded: true }],
            language: [{ id: tsCanonicalId }],
            // Boundary cast: string keys to branded Subcategory
          } as Partial<Record<Subcategory, SkillAssignment[]>>,
        },
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      // Skill plugins use canonical frontmatter names
      expect(result.skillPlugins).toContain("web-framework-react");
      expect(result.skillPlugins).toContain("web-language-typescript");
    });

    it("should return correct manifest structure", async () => {
      await createAgent("web-developer", {
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
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Modern React Stack",
        agents: ["web-developer"],
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

  describe("compileStackPlugin - error handling", () => {
    it("should throw error when stack config is missing", async () => {
      // Project structure already created in beforeEach via createTestSource

      await expect(
        compileStackPlugin({
          stackId: "nonexistent-stack",
          outputDir,
          projectRoot,
        }),
      ).rejects.toThrow();
    });

    it("should throw error when agent is missing", async () => {
      // Project structure already created in beforeEach via createTestSource

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
  });

  describe("compileStackPlugin - edge cases", () => {
    it("should handle stack with no skills", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
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

      expect(result.skillPlugins).toHaveLength(0);

      // README should not have "Required Skill Plugins" section
      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");
      expect(readmeContent).not.toContain("## Required Skill Plugins");
    });

    it("should handle stack with no tags", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
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
      expect(readmeContent).not.toContain("## Tags");
    });

    it("should handle stack with no philosophy", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
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
      expect(readmeContent).not.toContain("## Philosophy");
    });

    it("should handle stack with no principles", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
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
      expect(readmeContent).not.toContain("## Principles");
    });

    it("should handle stack with no description", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
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
      // Should use default description
      expect(readmeContent).toContain("A Claude Code stack plugin.");
    });

    it("should handle stack without CLAUDE.md", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Test Stack",
        agents: ["web-developer"],
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
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
      });

      await createAgent("api-developer", {
        title: "Backend Developer",
        description: "A backend developer agent",
        tools: ["Read", "Write", "Bash"],
      });

      await createAgent("web-tester", {
        title: "Tester",
        description: "A web-tester agent",
        tools: ["Read", "Bash"],
      });

      const stackId = uniqueStackId();
      const stack = createStack(stackId, {
        name: "Full Stack",
        agents: ["web-developer", "api-developer", "web-tester"],
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
      // Create skills in src/skills/ (new architecture)
      const reactDirPath = "web/framework/react (@vince)";
      const reactCanonicalId = "web-framework-react" as SkillId;
      const zustandDirPath = "web/client-state-management/zustand (@vince)";
      const zustandCanonicalId = "web-state-zustand" as SkillId;

      await createSkillInSource(reactDirPath, {
        name: reactCanonicalId,
        description: "React development",
      });

      await createSkillInSource(zustandDirPath, {
        name: zustandCanonicalId,
        description: "State management",
      });

      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId();
      // Skills assigned via stack agent config (current architecture)
      const stack = createStack(stackId, {
        name: "Test Stack",
        agents: ["web-developer"],
        agentSkills: {
          "web-developer": {
            "web-framework": [{ id: reactCanonicalId, preloaded: true }],
            "web-client-state": [{ id: zustandCanonicalId }],
          },
        },
      });

      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
        stack,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const readmeContent = await readFile(readmePath, "utf-8");

      // README uses "Included Skills" with canonical IDs
      expect(readmeContent).toContain("## Included Skills");
      expect(readmeContent).toContain("`web-framework-react`");
      expect(readmeContent).toContain("`web-state-zustand`");
    });
  });

  describe("compileStackPlugin - remote source (projectRoot differs from CLI)", () => {
    async function createStacksYaml(dir: string, stackId: string, agentIds: string[]) {
      const agentsYaml = agentIds.map((a) => `      ${a}: {}`).join("\n");
      await writeTestFile(
        path.join(dir, "config", "stacks.yaml"),
        `stacks:\n  - id: ${stackId}\n    name: Remote Source Stack\n    description: A stack from a remote source\n    agents:\n${agentsYaml}\n`,
      );
    }

    it("should load stack from projectRoot when not in CLI stacks.yaml", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
      });

      const stackId = uniqueStackId("remote-stack");

      // Create stacks.yaml in projectRoot (simulates a remote/private source)
      // No skills matrix in projectRoot — falls back to CLI matrix
      await createStacksYaml(projectRoot, stackId, ["web-developer"]);

      // No stack option passed — must load from projectRoot's stacks.yaml
      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      expect(result.stackName).toBe("Remote Source Stack");
      expect(result.agents).toContain("web-developer");
    });

    it("should fall back to CLI matrix when projectRoot has no skills matrix", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read"],
      });

      const stackId = uniqueStackId("matrix-fallback-stack");

      // Create stacks.yaml in projectRoot but no skills-matrix.yaml
      await createStacksYaml(projectRoot, stackId, ["web-developer"]);

      // Should succeed using CLI's skills matrix as fallback
      const result = await compileStackPlugin({
        stackId,
        outputDir,
        projectRoot,
      });

      expect(result.stackName).toBe("Remote Source Stack");
      expect(result.pluginPath).toBeDefined();
    });
  });

  describe("printStackCompilationSummary", () => {
    it("should print stack name and path", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      printStackCompilationSummary(
        createMockCompiledStackPlugin({
          pluginPath: "/output/test-stack",
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Test Stack"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("/output/test-stack"));

      consoleSpy.mockRestore();
    });

    it("should print agent count and list", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      printStackCompilationSummary(
        createMockCompiledStackPlugin({
          agents: ["web-developer", "api-developer", "web-tester"],
          skillPlugins: [],
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Agents: 3"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("web-developer"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("api-developer"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("web-tester"));

      consoleSpy.mockRestore();
    });

    it("should print skill plugins when present", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      printStackCompilationSummary(
        createMockCompiledStackPlugin({
          skillPlugins: ["web-framework-react", "web-state-zustand", "web-language-typescript"],
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Skills included: 3"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("web-framework-react"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("web-state-zustand"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("web-language-typescript"));

      consoleSpy.mockRestore();
    });

    it("should not print skill plugins section when empty", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      printStackCompilationSummary(
        createMockCompiledStackPlugin({
          skillPlugins: [],
        }),
      );

      // Check that "Skills included" was never called
      const calls = consoleSpy.mock.calls.flat().join("\n");
      expect(calls).not.toContain("Skills included");

      consoleSpy.mockRestore();
    });

    it("should print hooks status when enabled", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      printStackCompilationSummary(
        createMockCompiledStackPlugin({
          skillPlugins: [],
          hasHooks: true,
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Hooks: enabled"));

      consoleSpy.mockRestore();
    });

    it("should not print hooks status when disabled", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      printStackCompilationSummary(
        createMockCompiledStackPlugin({
          skillPlugins: [],
        }),
      );

      const calls = consoleSpy.mock.calls.flat().join("\n");
      expect(calls).not.toContain("Hooks:");

      consoleSpy.mockRestore();
    });
  });

  describe("compileAgentForPlugin - plugin-aware skill references", () => {
    // Use the real agent.liquid template (includes dynamic skills section)
    const realTemplateDir = path.resolve(__dirname, "../../../../src/agents/_templates");

    const PRELOADED_REACT_SKILL = createMockSkillEntry("web-framework-react", true, {
      path: "src/skills/web/framework/react",
      description: "React patterns",
      usage: "when working with framework",
    });

    const DYNAMIC_VITEST_SKILL = createMockSkillEntry("web-testing-vitest", false, {
      path: "src/skills/web/testing/vitest",
      description: "Vitest testing",
      usage: "when working with testing",
    });

    const AGENT_WITH_BOTH_SKILLS = createMockAgentConfig(
      "web-developer",
      [PRELOADED_REACT_SKILL, DYNAMIC_VITEST_SKILL],
      { title: "Frontend Developer", description: "A frontend developer agent" },
    );

    const AGENT_WITH_PRELOADED_ONLY = createMockAgentConfig(
      "web-developer",
      [PRELOADED_REACT_SKILL],
      { title: "Frontend Developer", description: "A frontend developer agent" },
    );

    it("should emit pluginRef format in frontmatter when installMode is plugin", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
        intro: "# Frontend Dev\n\nIntro.",
        workflow: "## Workflow\n\n1. Build",
      });

      const { Liquid } = await import("liquidjs");
      const engine = new Liquid({
        root: [realTemplateDir],
        extname: ".liquid",
        strictVariables: false,
        strictFilters: true,
      });

      const output = await compileAgentForPlugin(
        "web-developer",
        AGENT_WITH_BOTH_SKILLS,
        projectRoot,
        engine,
        "plugin",
      );

      // Frontmatter should contain pluginRef format
      expect(output).toContain("web-framework-react:web-framework-react");
      // Dynamic skill invocation should use pluginRef format
      expect(output).toContain('skill: "web-testing-vitest:web-testing-vitest"');
    });

    it("should emit bare skill IDs when installMode is local", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
        intro: "# Frontend Dev\n\nIntro.",
        workflow: "## Workflow\n\n1. Build",
      });

      const { Liquid } = await import("liquidjs");
      const engine = new Liquid({
        root: [realTemplateDir],
        extname: ".liquid",
        strictVariables: false,
        strictFilters: true,
      });

      const output = await compileAgentForPlugin(
        "web-developer",
        AGENT_WITH_BOTH_SKILLS,
        projectRoot,
        engine,
        "local",
      );

      // Frontmatter should contain bare skill IDs (no colon format)
      expect(output).toContain("web-framework-react");
      expect(output).not.toContain("web-framework-react:web-framework-react");
      // Dynamic skill invocation should use bare ID
      expect(output).toContain('skill: "web-testing-vitest"');
      expect(output).not.toContain('skill: "web-testing-vitest:web-testing-vitest"');
    });

    it("should emit bare skill IDs when installMode is undefined", async () => {
      await createAgent("web-developer", {
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
        intro: "# Frontend Dev\n\nIntro.",
        workflow: "## Workflow\n\n1. Build",
      });

      const { Liquid } = await import("liquidjs");
      const engine = new Liquid({
        root: [realTemplateDir],
        extname: ".liquid",
        strictVariables: false,
        strictFilters: true,
      });

      // No installMode (default behavior)
      const output = await compileAgentForPlugin(
        "web-developer",
        AGENT_WITH_PRELOADED_ONLY,
        projectRoot,
        engine,
      );

      // Should use bare IDs when no installMode specified
      expect(output).toContain("web-framework-react");
      expect(output).not.toContain("web-framework-react:web-framework-react");
    });
  });
});
