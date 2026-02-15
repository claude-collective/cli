import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "fs/promises";
import {
  compileAgentForPlugin,
  compileStackPlugin,
  printStackCompilationSummary,
  type CompiledStackPlugin,
} from "./stack-plugin-compiler";

import type {
  AgentConfig,
  Skill,
  SkillAssignment,
  SkillId,
  Stack,
  StackAgentConfig,
  Subcategory,
} from "../../types";

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
    },
  ) {
    const agentDir = path.join(agentsDir, agentId);
    await mkdir(agentDir, { recursive: true });

    // Create agent.yaml
    await writeFile(
      path.join(agentDir, "agent.yaml"),
      `id: ${agentId}
title: ${config.title}
description: ${config.description}
tools:
${config.tools.map((t) => `  - ${t}`).join("\n")}
`,
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

  describe("compileStackPlugin", () => {
    it("should create plugin directory structure", async () => {
      const { agentsDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
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
            framework: [{ id: frontmatterName, preloaded: true }],
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
      const { agentsDir } = await createProjectStructure();

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

      const manifestPath = path.join(result.pluginPath, ".claude-plugin", "plugin.json");
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
      const { agentsDir } = await createProjectStructure();

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

      const agentMdPath = path.join(result.pluginPath, "agents", "web-developer.md");
      const agentContent = await readFile(agentMdPath, "utf-8");

      expect(agentContent).toContain("name: web-developer");
      expect(agentContent).toContain("Frontend Developer");
      expect(agentContent).toContain("Build components");
    });

    it("should generate README.md with stack information", async () => {
      const { agentsDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
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
      const { agentsDir } = await createProjectStructure();

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
      const { agentsDir } = await createProjectStructure();

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
      const { agentsDir } = await createProjectStructure();

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

      await createAgent(agentsDir, "web-developer", {
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
            framework: [{ id: reactCanonicalId, preloaded: true }],
            language: [{ id: tsCanonicalId }],
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
      const { agentsDir } = await createProjectStructure();

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
      const { agentsDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
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
  });

  describe("compileStackPlugin - edge cases", () => {
    it("should handle stack with no skills", async () => {
      const { agentsDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
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
      const { agentsDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
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
      const { agentsDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
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
      const { agentsDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
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
      const { agentsDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
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
      const { agentsDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
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
      const { agentsDir } = await createProjectStructure();

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
      const { agentsDir } = await createProjectStructure();

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

      await createAgent(agentsDir, "web-developer", {
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
            framework: [{ id: reactCanonicalId, preloaded: true }],
            "client-state": [{ id: zustandCanonicalId }],
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
      const configDir = path.join(dir, "config");
      await mkdir(configDir, { recursive: true });
      const agentsYaml = agentIds.map((a) => `      ${a}: {}`).join("\n");
      await writeFile(
        path.join(configDir, "stacks.yaml"),
        `stacks:
  - id: ${stackId}
    name: Remote Source Stack
    description: A stack from a remote source
    agents:
${agentsYaml}
`,
      );
    }

    it("should load stack from projectRoot when not in CLI stacks.yaml", async () => {
      const { agentsDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
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
      const { agentsDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
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

      const result: CompiledStackPlugin = {
        pluginPath: "/output/test-stack",
        manifest: { name: "test-stack", version: "1.0.0" },
        stackName: "Test Stack",
        agents: ["web-developer"],
        skillPlugins: ["web-framework-react"],
        hasHooks: false,
      };

      printStackCompilationSummary(result);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Test Stack"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("/output/test-stack"));

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

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Agents: 3"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("web-developer"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("api-developer"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("web-tester"));

      consoleSpy.mockRestore();
    });

    it("should print skill plugins when present", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result: CompiledStackPlugin = {
        pluginPath: "/output/test-stack",
        manifest: { name: "test-stack" },
        stackName: "Test Stack",
        agents: ["web-developer"],
        skillPlugins: ["web-framework-react", "web-state-zustand", "web-language-typescript"],
        hasHooks: false,
      };

      printStackCompilationSummary(result);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Skills included: 3"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("web-framework-react"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("web-state-zustand"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("web-language-typescript"));

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

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Hooks: enabled"));

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

  describe("compileAgentForPlugin - plugin-aware skill references", () => {
    // Use the real agent.liquid template (includes dynamic skills section)
    const realTemplateDir = path.resolve(__dirname, "../../../../src/agents/_templates");

    it("should emit pluginRef format in frontmatter when installMode is plugin", async () => {
      const { agentsDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
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

      const preloadedSkill: Skill = {
        id: "web-framework-react",
        path: "src/skills/web/framework/react",
        description: "React patterns",
        usage: "when working with framework",
        preloaded: true,
      };

      const dynamicSkill: Skill = {
        id: "web-testing-vitest",
        path: "src/skills/web/testing/vitest",
        description: "Vitest testing",
        usage: "when working with testing",
        preloaded: false,
      };

      const agent: AgentConfig = {
        name: "web-developer",
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
        skills: [preloadedSkill, dynamicSkill],
      };

      const output = await compileAgentForPlugin(
        "web-developer",
        agent,
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
      const { agentsDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
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

      const preloadedSkill: Skill = {
        id: "web-framework-react",
        path: "src/skills/web/framework/react",
        description: "React patterns",
        usage: "when working with framework",
        preloaded: true,
      };

      const dynamicSkill: Skill = {
        id: "web-testing-vitest",
        path: "src/skills/web/testing/vitest",
        description: "Vitest testing",
        usage: "when working with testing",
        preloaded: false,
      };

      const agent: AgentConfig = {
        name: "web-developer",
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
        skills: [preloadedSkill, dynamicSkill],
      };

      const output = await compileAgentForPlugin(
        "web-developer",
        agent,
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
      const { agentsDir } = await createProjectStructure();

      await createAgent(agentsDir, "web-developer", {
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

      const skill: Skill = {
        id: "web-framework-react",
        path: "src/skills/web/framework/react",
        description: "React patterns",
        usage: "when working with framework",
        preloaded: true,
      };

      const agent: AgentConfig = {
        name: "web-developer",
        title: "Frontend Developer",
        description: "A frontend developer agent",
        tools: ["Read", "Write"],
        skills: [skill],
      };

      // No installMode (default behavior)
      const output = await compileAgentForPlugin("web-developer", agent, projectRoot, engine);

      // Should use bare IDs when no installMode specified
      expect(output).toContain("web-framework-react");
      expect(output).not.toContain("web-framework-react:web-framework-react");
    });
  });
});
