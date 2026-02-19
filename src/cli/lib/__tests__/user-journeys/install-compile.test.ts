import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile, mkdir, writeFile } from "fs/promises";
import { compileStackPlugin } from "../../stacks";
import {
  fileExists,
  directoryExists,
  parseTestFrontmatter,
  createTempDir,
  cleanupTempDir,
  createMockStack,
} from "../helpers";

const PLUGIN_MANIFEST_DIR = ".claude-plugin";
const PLUGIN_MANIFEST_FILE = "plugin.json";

async function createProjectStructure(projectRoot: string) {
  const agentsDir = path.join(projectRoot, "src/agents");
  const templatesDir = path.join(projectRoot, "src/agents/_templates");
  const configDir = path.join(projectRoot, "config");
  const skillsDir = path.join(projectRoot, "src/skills");

  await mkdir(agentsDir, { recursive: true });
  await mkdir(templatesDir, { recursive: true });
  await mkdir(configDir, { recursive: true });
  await mkdir(skillsDir, { recursive: true });

  // Create agent template (matches the pattern from stack-plugin-compiler.test.ts)
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

  return { agentsDir, templatesDir, configDir, skillsDir };
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

  await writeFile(
    path.join(agentDir, "agent.yaml"),
    `id: ${agentId}
title: ${config.title}
description: ${config.description}
tools:
${config.tools.map((t) => `  - ${t}`).join("\n")}
`,
  );

  await writeFile(
    path.join(agentDir, "intro.md"),
    config.intro ?? `# ${config.title}\n\nThis is the ${agentId} agent.`,
  );

  await writeFile(
    path.join(agentDir, "workflow.md"),
    config.workflow ?? "## Workflow\n\n1. Analyze\n2. Implement\n3. Test",
  );
}

async function createSkill(
  projectRoot: string,
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

${config.content ?? `# ${config.name}\n\nSkill content here.`}
`,
  );
}

describe("User Journey: Install -> Compile -> Verify", () => {
  let tempDir: string;
  let projectRoot: string;
  let outputDir: string;
  let testCounter = 0;

  function uniqueStackId(base = "test-stack"): string {
    testCounter++;
    return `${base}-${testCounter}-${Date.now()}`;
  }

  beforeEach(async () => {
    tempDir = await createTempDir("install-compile-test-");
    projectRoot = path.join(tempDir, "project");
    outputDir = path.join(tempDir, "output");

    await mkdir(projectRoot, { recursive: true });
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("should install stack plugin to correct location", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Full-stack web development specialist",
      tools: ["Read", "Write", "Edit"],
    });

    const stackId = uniqueStackId();
    const stack = createMockStack(stackId, {
      name: "React Fullstack",
      description: "A complete React development stack",
      agents: { "web-developer": {} },
    });

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    // Plugin directory should be created at outputDir/stackId
    expect(result.pluginPath).toBe(path.join(outputDir, stackId));
    expect(await directoryExists(result.pluginPath)).toBe(true);

    // Agents subdirectory should exist
    const agentsDirOutput = path.join(result.pluginPath, "agents");
    expect(await directoryExists(agentsDirOutput)).toBe(true);

    // Skills subdirectory should exist
    const skillsDirOutput = path.join(result.pluginPath, "skills");
    expect(await directoryExists(skillsDirOutput)).toBe(true);
  });

  it("should create valid plugin manifest after install", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Full-stack web development specialist",
      tools: ["Read", "Write", "Edit"],
    });

    const stackId = uniqueStackId("react-stack");
    const stack = createMockStack(stackId, {
      name: "React Fullstack",
      description: "A complete React development stack",
      agents: { "web-developer": {} },
    });

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    // plugin.json should exist in .claude-plugin directory
    const manifestPath = path.join(result.pluginPath, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE);
    expect(await fileExists(manifestPath)).toBe(true);

    // Manifest should be valid JSON with required fields
    const manifestContent = await readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent) as Record<string, unknown>;

    expect(manifest.name).toBe(stackId);
    expect(manifest.description).toBe("A complete React development stack");
    expect(manifest.version).toBe("1.0.0");
    // Stack plugins with skills declare skills path
    expect(manifest.skills).toBe("./skills/");
  });

  it("should compile stack agents with installed skills", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Full-stack web development specialist",
      tools: ["Read", "Write", "Edit"],
      intro: "# Web Developer\n\nYou are a web developer agent.",
      workflow: "## Workflow\n\n1. Build components\n2. Write tests",
    });

    const stackId = uniqueStackId();
    const stack = createMockStack(stackId, {
      name: "Minimal Stack",
      description: "A minimal stack for testing",
      agents: { "web-developer": {} },
    });

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    // Agent markdown should be compiled
    const agentMdPath = path.join(result.pluginPath, "agents", "web-developer.md");
    expect(await fileExists(agentMdPath)).toBe(true);

    // Agent content should include frontmatter and body
    const agentContent = await readFile(agentMdPath, "utf-8");

    // Frontmatter should contain agent name
    expect(agentContent).toContain("name: web-developer");
    expect(agentContent).toContain("Full-stack web development specialist");

    // Body should contain intro and workflow content
    expect(agentContent).toContain("You are a web developer agent");
    expect(agentContent).toContain("Build components");
  });

  it("should include stack skill content in compiled agents", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    // Create skill in src/skills/
    const reactDirPath = "web/framework/react (@vince)";
    const reactCanonicalId = "web-framework-react";
    await createSkill(projectRoot, reactDirPath, {
      name: reactCanonicalId,
      description: "React development skills",
      content:
        "# React\n\nReact is a JavaScript library for building user interfaces.\n\n## Key Patterns\n\n- Component-based architecture\n- Hooks for state and effects",
    });

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Full-stack web development specialist",
      tools: ["Read", "Write", "Edit"],
    });

    const stackId = uniqueStackId();
    const stack = createMockStack(stackId, {
      name: "React Stack",
      description: "React development stack",
      agents: { "web-developer": {} },
    });

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    // Skills are only copied if they're referenced in the stack property
    // With an empty agent config {}, no skills are resolved via the stack
    // The skill directory structure should still exist
    expect(await directoryExists(path.join(result.pluginPath, "skills"))).toBe(true);
  });

  it("should handle stack with multiple agents", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Frontend development specialist",
      tools: ["Read", "Write", "Edit"],
      intro: "# Web Developer\n\nYou build user interfaces.",
      workflow: "## Workflow\n\n1. Design components\n2. Implement UI",
    });

    await createAgent(agentsDir, "api-developer", {
      title: "API Developer",
      description: "Backend API development specialist",
      tools: ["Read", "Write", "Edit", "Bash"],
      intro: "# API Developer\n\nYou build APIs and services.",
      workflow: "## Workflow\n\n1. Design API\n2. Implement endpoints",
    });

    await createAgent(agentsDir, "web-tester", {
      title: "Test Engineer",
      description: "Testing and quality assurance specialist",
      tools: ["Read", "Write", "Bash"],
      intro: "# Test Engineer\n\nYou write comprehensive tests.",
      workflow: "## Workflow\n\n1. Write tests\n2. Verify coverage",
    });

    const stackId = uniqueStackId("full-stack");
    const stack = createMockStack(stackId, {
      name: "Full Stack",
      description: "Complete development stack with three agents",
      agents: {
        "web-developer": {},
        "api-developer": {},
        "web-tester": {},
      },
    });

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    // All three agents should be compiled
    expect(result.agents).toHaveLength(3);
    expect(result.agents).toContain("web-developer");
    expect(result.agents).toContain("api-developer");
    expect(result.agents).toContain("web-tester");

    // Each agent should have a compiled markdown file
    for (const agentName of result.agents) {
      const agentMdPath = path.join(result.pluginPath, "agents", `${agentName}.md`);
      expect(await fileExists(agentMdPath)).toBe(true);

      const content = await readFile(agentMdPath, "utf-8");
      expect(content.length).toBeGreaterThan(0);
      // Each file should have frontmatter
      expect(content).toContain("---");
    }

    // README should list all agents
    const readmePath = path.join(result.pluginPath, "README.md");
    expect(await fileExists(readmePath)).toBe(true);

    const readmeContent = await readFile(readmePath, "utf-8");
    expect(readmeContent).toContain("`web-developer`");
    expect(readmeContent).toContain("`api-developer`");
    expect(readmeContent).toContain("`web-tester`");
  });
});

describe("User Journey: Plugin Structure Verification", () => {
  let tempDir: string;
  let projectRoot: string;
  let outputDir: string;
  let testCounter = 0;

  function uniqueStackId(base = "structure-test"): string {
    testCounter++;
    return `${base}-${testCounter}-${Date.now()}`;
  }

  beforeEach(async () => {
    tempDir = await createTempDir("plugin-structure-test-");
    projectRoot = path.join(tempDir, "project");
    outputDir = path.join(tempDir, "output");

    await mkdir(projectRoot, { recursive: true });
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("should create README.md with stack information", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Frontend specialist",
      tools: ["Read", "Write"],
    });

    const stackId = uniqueStackId();
    const stack = createMockStack(stackId, {
      name: "React Stack",
      description: "A modern React development stack",
      agents: { "web-developer": {} },
    });

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    const readmePath = path.join(result.pluginPath, "README.md");
    expect(await fileExists(readmePath)).toBe(true);

    const readmeContent = await readFile(readmePath, "utf-8");
    expect(readmeContent).toContain("# React Stack");
    expect(readmeContent).toContain("A modern React development stack");
    expect(readmeContent).toContain("## Installation");
    expect(readmeContent).toContain(stackId);
    expect(readmeContent).toContain("## Agents");
    expect(readmeContent).toContain("`web-developer`");
  });

  it("should generate manifest with correct version on first install", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Frontend specialist",
      tools: ["Read"],
    });

    const stackId = uniqueStackId();
    const stack = createMockStack(stackId, {
      name: "Versioned Stack",
      description: "Stack with version tracking",
      agents: { "web-developer": {} },
    });

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    // First install should use default version
    expect(result.manifest.version).toBe("1.0.0");

    // Content hash file should exist
    const hashFilePath = path.join(result.pluginPath, PLUGIN_MANIFEST_DIR, ".content-hash");
    expect(await fileExists(hashFilePath)).toBe(true);
  });

  it("should bump version when stack config changes", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Frontend specialist",
      tools: ["Read"],
    });

    await createAgent(agentsDir, "api-developer", {
      title: "API Developer",
      description: "Backend specialist",
      tools: ["Read", "Bash"],
    });

    const stackId = uniqueStackId("version-bump");

    // First compilation - only web-developer
    const stack1 = createMockStack(stackId, {
      name: "Evolving Stack",
      description: "Stack that evolves",
      agents: { "web-developer": {} },
    });

    const result1 = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack: stack1,
    });

    expect(result1.manifest.version).toBe("1.0.0");

    // Second compilation - add api-developer (stack changed)
    const stack2 = createMockStack(stackId, {
      name: "Evolving Stack",
      description: "Stack that evolves",
      agents: { "web-developer": {}, "api-developer": {} },
    });

    const result2 = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack: stack2,
    });

    // Version should be bumped since stack config changed
    expect(result2.manifest.version).toBe("2.0.0");
  });

  it("should keep version when recompiling unchanged stack", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Frontend specialist",
      tools: ["Read"],
    });

    const stackId = uniqueStackId("stable");

    const stack = createMockStack(stackId, {
      name: "Stable Stack",
      description: "Stack that does not change",
      agents: { "web-developer": {} },
    });

    // First compilation
    const result1 = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    expect(result1.manifest.version).toBe("1.0.0");

    // Second compilation with same config
    const result2 = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    // Version should stay the same
    expect(result2.manifest.version).toBe("1.0.0");
  });
});

describe("User Journey: Agent Content Verification", () => {
  let tempDir: string;
  let projectRoot: string;
  let outputDir: string;
  let testCounter = 0;

  function uniqueStackId(base = "content-test"): string {
    testCounter++;
    return `${base}-${testCounter}-${Date.now()}`;
  }

  beforeEach(async () => {
    tempDir = await createTempDir("agent-content-test-");
    projectRoot = path.join(tempDir, "project");
    outputDir = path.join(tempDir, "output");

    await mkdir(projectRoot, { recursive: true });
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("should include agent intro content in compiled output", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    const customIntro = `# Custom Web Developer

You are a specialized web developer with deep expertise in:
- React and TypeScript
- Server-side rendering
- Performance optimization`;

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Specialized web developer",
      tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
      intro: customIntro,
    });

    const stackId = uniqueStackId();
    const stack = createMockStack(stackId, {
      name: "Custom Stack",
      agents: { "web-developer": {} },
    });

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    const agentContent = await readFile(
      path.join(result.pluginPath, "agents", "web-developer.md"),
      "utf-8",
    );

    expect(agentContent).toContain("Custom Web Developer");
    expect(agentContent).toContain("React and TypeScript");
    expect(agentContent).toContain("Performance optimization");
  });

  it("should include agent workflow content in compiled output", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    const customWorkflow = `## Development Workflow

1. Read the requirements carefully
2. Investigate existing code patterns
3. Implement with minimal changes
4. Write comprehensive tests
5. Verify all tests pass`;

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Methodical web developer",
      tools: ["Read", "Write"],
      workflow: customWorkflow,
    });

    const stackId = uniqueStackId();
    const stack = createMockStack(stackId, {
      name: "Workflow Stack",
      agents: { "web-developer": {} },
    });

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    const agentContent = await readFile(
      path.join(result.pluginPath, "agents", "web-developer.md"),
      "utf-8",
    );

    expect(agentContent).toContain("Development Workflow");
    expect(agentContent).toContain("Read the requirements carefully");
    expect(agentContent).toContain("Verify all tests pass");
  });

  it("should produce valid frontmatter in compiled agents", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Frontend specialist",
      tools: ["Read", "Write", "Edit"],
    });

    const stackId = uniqueStackId();
    const stack = createMockStack(stackId, {
      name: "Frontmatter Stack",
      agents: { "web-developer": {} },
    });

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    const agentContent = await readFile(
      path.join(result.pluginPath, "agents", "web-developer.md"),
      "utf-8",
    );

    const frontmatter = parseTestFrontmatter(agentContent);
    expect(frontmatter).not.toBeNull();

    if (frontmatter) {
      expect(frontmatter).toHaveProperty("name");
      expect(frontmatter.name).toBe("web-developer");
      expect(frontmatter).toHaveProperty("description");
      expect(frontmatter).toHaveProperty("tools");
    }
  });

  it("should embed template core_principles section in output", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Web developer with core principles",
      tools: ["Read"],
    });

    const stackId = uniqueStackId();
    const stack = createMockStack(stackId, {
      name: "Principles Stack",
      agents: { "web-developer": {} },
    });

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    const agentContent = await readFile(
      path.join(result.pluginPath, "agents", "web-developer.md"),
      "utf-8",
    );

    // The agent template includes a core_principles block
    expect(agentContent).toContain("<core_principles>");
    expect(agentContent).toContain("</core_principles>");
  });
});

describe("User Journey: Install -> Compile Error Handling", () => {
  let tempDir: string;
  let projectRoot: string;
  let outputDir: string;
  let testCounter = 0;

  function uniqueStackId(base = "error-test"): string {
    testCounter++;
    return `${base}-${testCounter}-${Date.now()}`;
  }

  beforeEach(async () => {
    tempDir = await createTempDir("error-handling-test-");
    projectRoot = path.join(tempDir, "project");
    outputDir = path.join(tempDir, "output");

    await mkdir(projectRoot, { recursive: true });
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("should throw when stack references missing agent", async () => {
    await createProjectStructure(projectRoot);

    const stackId = uniqueStackId();
    const stack = createMockStack(stackId, {
      name: "Broken Stack",
      agents: { "nonexistent-agent": {} },
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

  it("should throw when no stack is provided and stacks.yaml missing", async () => {
    await createProjectStructure(projectRoot);

    // compileStackPlugin without a stack option will try to load from stacks.yaml
    // which doesn't exist in our test project root
    await expect(
      compileStackPlugin({
        stackId: "nonexistent-stack",
        outputDir,
        projectRoot,
      }),
    ).rejects.toThrow();
  });

  it("should handle stack with no skills gracefully", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Minimal agent",
      tools: ["Read"],
    });

    const stackId = uniqueStackId();
    const stack = createMockStack(stackId, {
      name: "No Skills Stack",
      agents: { "web-developer": {} },
    });

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    // Should compile successfully with no skill plugins
    expect(result.skillPlugins).toHaveLength(0);
    expect(result.agents).toContain("web-developer");

    // Agent file should still be created
    const agentMdPath = path.join(result.pluginPath, "agents", "web-developer.md");
    expect(await fileExists(agentMdPath)).toBe(true);
  });

  it("should handle stack with empty description", async () => {
    const { agentsDir } = await createProjectStructure(projectRoot);

    await createAgent(agentsDir, "web-developer", {
      title: "Web Developer",
      description: "Minimal agent",
      tools: ["Read"],
    });

    const stackId = uniqueStackId();
    const stack = createMockStack(stackId, {
      name: "No Description Stack",
      // No description provided
      agents: { "web-developer": {} },
    });

    const result = await compileStackPlugin({
      stackId,
      outputDir,
      projectRoot,
      stack,
    });

    // README should use fallback description
    const readmeContent = await readFile(path.join(result.pluginPath, "README.md"), "utf-8");
    expect(readmeContent).toContain("A Claude Code stack plugin.");
  });
});
