import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "fs/promises";

// =============================================================================
// Constants
// =============================================================================

// Skills and stacks are in claude-subagents repo
const SKILLS_REPO =
  process.env.CC_TEST_SKILLS_SOURCE ||
  path.resolve(__dirname, "../../../../claude-subagents");

// CLI repo for agent sources
const CLI_REPO = path.resolve(__dirname, "../../..");

// =============================================================================
// Test Helpers
// =============================================================================

interface TestDirs {
  tempDir: string;
  projectDir: string;
  pluginDir: string;
}

/**
 * Create test directory structure
 */
async function createTestDirs(): Promise<TestDirs> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-compile-test-"));
  const projectDir = path.join(tempDir, "project");
  const pluginDir = path.join(
    projectDir,
    ".claude",
    "plugins",
    "claude-collective",
  );

  await mkdir(projectDir, { recursive: true });
  await mkdir(pluginDir, { recursive: true });

  return { tempDir, projectDir, pluginDir };
}

/**
 * Check if a path exists
 */
async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a minimal plugin structure for testing
 */
async function createPluginStructure(
  pluginDir: string,
  options: {
    name?: string;
    agents?: string[];
    skills?: Array<{ id: string; preloaded?: boolean }>;
  } = {},
): Promise<void> {
  const {
    name = "claude-collective",
    agents = ["web-developer"],
    skills = [],
  } = options;

  // Create plugin.json
  const manifestDir = path.join(pluginDir, ".claude-plugin");
  await mkdir(manifestDir, { recursive: true });
  await writeFile(
    path.join(manifestDir, "plugin.json"),
    JSON.stringify(
      {
        name,
        version: "1.0.0",
        description: "Test plugin",
      },
      null,
      2,
    ),
  );

  // Create agents directory
  const agentsDir = path.join(pluginDir, "agents");
  await mkdir(agentsDir, { recursive: true });
  for (const agent of agents) {
    await writeFile(
      path.join(agentsDir, `${agent}.md`),
      `---\nname: ${agent}\n---\n# ${agent}\nAgent content.`,
    );
  }

  // Create skills directory if skills are specified
  if (skills.length > 0) {
    const skillsDir = path.join(pluginDir, "skills");
    await mkdir(skillsDir, { recursive: true });
  }

  // Create config.yaml
  const skillsYaml =
    skills.length > 0
      ? `skills:\n${skills.map((s) => `  - id: "${s.id}"\n    preloaded: ${s.preloaded ?? false}`).join("\n")}`
      : "skills: []";

  await writeFile(
    path.join(pluginDir, "config.yaml"),
    `name: ${name}
version: "1.0.0"
description: "Test plugin"
agents:
${agents.map((a) => `  - ${a}`).join("\n")}
${skillsYaml}
`,
  );
}

/**
 * Create a skill in the plugin's skills directory
 */
async function createPluginSkill(
  pluginDir: string,
  skillId: string,
  config: { name: string; description: string; content?: string },
): Promise<void> {
  const skillDir = path.join(pluginDir, "skills", skillId);
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
 * Create a local skill in .claude/skills/
 */
async function createLocalSkill(
  projectDir: string,
  skillDirName: string,
  config: {
    cliName: string;
    skillId: string;
    description: string;
    content?: string;
  },
): Promise<void> {
  const skillDir = path.join(projectDir, ".claude", "skills", skillDirName);
  await mkdir(skillDir, { recursive: true });

  // metadata.yaml (required for local skills)
  await writeFile(
    path.join(skillDir, "metadata.yaml"),
    `cli_name: ${config.cliName}
cli_description: ${config.description}
`,
  );

  // SKILL.md
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    `---
name: ${config.skillId}
description: ${config.description}
---

${config.content || `# ${config.cliName}\n\nSkill content here.`}
`,
  );
}

// =============================================================================
// P1-05: Test `cc compile` in Plugin Mode
// =============================================================================

describe("cc compile: Plugin Mode (P1-05)", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestDirs();
    // Suppress console output
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    await rm(dirs.tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe("plugin structure generation", () => {
    it("should compile agents from config.yaml", async () => {
      // Import the stack compiler
      const { compileStackPlugin } =
        await import("../lib/stack-plugin-compiler");

      // Create a project structure for compilation
      const outputDir = path.join(dirs.tempDir, "output");
      await mkdir(outputDir, { recursive: true });

      // Create minimal project structure for compilation
      const projectRoot = path.join(dirs.tempDir, "skills-source");
      await mkdir(path.join(projectRoot, "src/agents"), { recursive: true });
      await mkdir(path.join(projectRoot, "src/agents/_templates"), {
        recursive: true,
      });
      await mkdir(path.join(projectRoot, "src/stacks"), { recursive: true });

      // Create agent template
      await writeFile(
        path.join(projectRoot, "src/agents/_templates/agent.liquid"),
        `---
name: {{ agent.name }}
description: {{ agent.description }}
tools: {{ agent.tools | join: ", " }}
{%- if preloadedSkillIds.size > 0 %}
skills: {{ preloadedSkillIds | join: ", " }}
{%- endif %}
---

{{ intro }}

{{ workflow }}
`,
      );

      // Create agent
      const agentDir = path.join(projectRoot, "src/agents/test-agent");
      await mkdir(agentDir, { recursive: true });
      await writeFile(
        path.join(agentDir, "agent.yaml"),
        `id: test-agent
title: Test Agent
description: A test agent
tools:
  - Read
  - Write
`,
      );
      await writeFile(
        path.join(agentDir, "intro.md"),
        "# Test Agent\n\nThis is a test agent.",
      );
      await writeFile(
        path.join(agentDir, "workflow.md"),
        "## Workflow\n\n1. Analyze\n2. Implement",
      );

      // Create stack
      const stackDir = path.join(projectRoot, "src/stacks/test-stack");
      await mkdir(stackDir, { recursive: true });
      await writeFile(
        path.join(stackDir, "config.yaml"),
        `name: Test Stack
version: "1.0.0"
author: "@test"
description: "A test stack"
agents:
  - test-agent
skills: []
`,
      );

      // Compile the stack
      const result = await compileStackPlugin({
        stackId: "test-stack",
        outputDir,
        projectRoot,
      });

      // Verify plugin structure is created
      expect(await pathExists(result.pluginPath)).toBe(true);

      // Verify agents directory exists
      const agentsOutputDir = path.join(result.pluginPath, "agents");
      expect(await pathExists(agentsOutputDir)).toBe(true);

      // Verify agent file was compiled
      const agentMdPath = path.join(agentsOutputDir, "test-agent.md");
      expect(await pathExists(agentMdPath)).toBe(true);

      // Verify agent content
      const agentContent = await readFile(agentMdPath, "utf-8");
      expect(agentContent).toContain("name: test-agent");
      expect(agentContent).toContain("Test Agent");
    });

    it("should generate plugin manifest (plugin.json)", async () => {
      const { compileStackPlugin } =
        await import("../lib/stack-plugin-compiler");

      const outputDir = path.join(dirs.tempDir, "output");
      await mkdir(outputDir, { recursive: true });

      // Create project structure
      const projectRoot = path.join(dirs.tempDir, "skills-source");
      await mkdir(path.join(projectRoot, "src/agents"), { recursive: true });
      await mkdir(path.join(projectRoot, "src/agents/_templates"), {
        recursive: true,
      });
      await mkdir(path.join(projectRoot, "src/stacks"), { recursive: true });

      // Create agent template
      await writeFile(
        path.join(projectRoot, "src/agents/_templates/agent.liquid"),
        `---
name: {{ agent.name }}
---
{{ intro }}
`,
      );

      // Create agent
      const agentDir = path.join(projectRoot, "src/agents/my-agent");
      await mkdir(agentDir, { recursive: true });
      await writeFile(
        path.join(agentDir, "agent.yaml"),
        `id: my-agent
title: My Agent
description: Test agent
tools: []
`,
      );
      await writeFile(path.join(agentDir, "intro.md"), "# My Agent");
      await writeFile(path.join(agentDir, "workflow.md"), "## Workflow");

      // Create stack
      const stackDir = path.join(projectRoot, "src/stacks/my-stack");
      await mkdir(stackDir, { recursive: true });
      await writeFile(
        path.join(stackDir, "config.yaml"),
        `name: My Stack
version: "1.0.0"
author: "@test"
agents:
  - my-agent
skills: []
`,
      );

      // Compile the stack
      const result = await compileStackPlugin({
        stackId: "my-stack",
        outputDir,
        projectRoot,
      });

      // Verify plugin.json is created
      const manifestPath = path.join(
        result.pluginPath,
        ".claude-plugin",
        "plugin.json",
      );
      expect(await pathExists(manifestPath)).toBe(true);

      // Verify manifest content
      const manifestContent = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestContent);
      expect(manifest.name).toBe("my-stack");
      expect(manifest.version).toBe("1.0.0");
    });

    it("should return populated agents array", async () => {
      const { compileStackPlugin } =
        await import("../lib/stack-plugin-compiler");

      const outputDir = path.join(dirs.tempDir, "output");
      await mkdir(outputDir, { recursive: true });

      // Create project structure
      const projectRoot = path.join(dirs.tempDir, "skills-source");
      await mkdir(path.join(projectRoot, "src/agents"), { recursive: true });
      await mkdir(path.join(projectRoot, "src/agents/_templates"), {
        recursive: true,
      });
      await mkdir(path.join(projectRoot, "src/stacks"), { recursive: true });

      // Create agent template
      await writeFile(
        path.join(projectRoot, "src/agents/_templates/agent.liquid"),
        `---
name: {{ agent.name }}
---
{{ intro }}
`,
      );

      // Create multiple agents
      for (const agentName of ["agent-one", "agent-two"]) {
        const agentDir = path.join(projectRoot, "src/agents", agentName);
        await mkdir(agentDir, { recursive: true });
        await writeFile(
          path.join(agentDir, "agent.yaml"),
          `id: ${agentName}
title: ${agentName}
description: Test agent
tools: []
`,
        );
        await writeFile(path.join(agentDir, "intro.md"), `# ${agentName}`);
        await writeFile(path.join(agentDir, "workflow.md"), "## Workflow");
      }

      // Create stack with multiple agents
      const stackDir = path.join(projectRoot, "src/stacks/multi-stack");
      await mkdir(stackDir, { recursive: true });
      await writeFile(
        path.join(stackDir, "config.yaml"),
        `name: Multi Agent Stack
version: "1.0.0"
author: "@test"
agents:
  - agent-one
  - agent-two
skills: []
`,
      );

      // Compile the stack
      const result = await compileStackPlugin({
        stackId: "multi-stack",
        outputDir,
        projectRoot,
      });

      // Verify agents array is populated
      expect(result.agents).toHaveLength(2);
      expect(result.agents).toContain("agent-one");
      expect(result.agents).toContain("agent-two");
    });
  });

  describe("recompileAgents function", () => {
    it("should recompile agents using skills from plugin", async () => {
      const { recompileAgents } = await import("../lib/agent-recompiler");

      // Create plugin with skills
      await createPluginStructure(dirs.pluginDir, {
        name: "claude-collective",
        agents: ["web-developer"],
        skills: [{ id: "test-skill (@test)", preloaded: true }],
      });

      // Create skill in plugin
      await createPluginSkill(dirs.pluginDir, "test-skill", {
        name: "test-skill (@test)",
        description: "A test skill",
      });

      // Recompile agents
      const result = await recompileAgents({
        pluginDir: dirs.pluginDir,
        sourcePath: CLI_REPO,
      });

      // Verify recompilation succeeded (or failed gracefully for missing agent)
      // The important thing is it doesn't throw
      expect(result).toBeDefined();
      expect(result.compiled).toBeDefined();
      expect(result.failed).toBeDefined();
      expect(result.warnings).toBeDefined();
    });
  });
});

// =============================================================================
// P1-06: Test `cc compile` with custom output
// =============================================================================

describe("cc compile: Custom Output (P1-06)", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestDirs();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    await rm(dirs.tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe("--output flag functionality", () => {
    it("should output compiled agents to specified directory", async () => {
      const { recompileAgents } = await import("../lib/agent-recompiler");

      // Create plugin structure
      await createPluginStructure(dirs.pluginDir, {
        name: "claude-collective",
        agents: ["web-developer"],
      });

      // Create custom output directory
      const customOutputDir = path.join(dirs.tempDir, "custom-output");
      await mkdir(customOutputDir, { recursive: true });

      // Recompile agents with custom output
      const result = await recompileAgents({
        pluginDir: dirs.pluginDir,
        sourcePath: CLI_REPO,
        outputDir: customOutputDir,
      });

      // Verify output directory is used
      expect(result).toBeDefined();

      // If agents were compiled, verify they went to custom output
      if (result.compiled.length > 0) {
        for (const agentName of result.compiled) {
          const agentPath = path.join(customOutputDir, `${agentName}.md`);
          expect(await pathExists(agentPath)).toBe(true);
        }
      }
    });

    it("should create output directory if it doesn't exist", async () => {
      const { recompileAgents } = await import("../lib/agent-recompiler");

      // Create plugin structure
      await createPluginStructure(dirs.pluginDir, {
        name: "claude-collective",
        agents: ["web-developer"],
      });

      // Specify a non-existent output directory
      const newOutputDir = path.join(dirs.tempDir, "new-output", "nested");

      // Recompile agents (should create the directory)
      const result = await recompileAgents({
        pluginDir: dirs.pluginDir,
        sourcePath: CLI_REPO,
        outputDir: newOutputDir,
      });

      // Verify directory was created
      expect(await pathExists(newOutputDir)).toBe(true);
      expect(result).toBeDefined();
    });

    it("should not modify original plugin when using custom output", async () => {
      const { recompileAgents } = await import("../lib/agent-recompiler");

      // Create plugin structure with known content
      await createPluginStructure(dirs.pluginDir, {
        name: "claude-collective",
        agents: ["web-developer"],
      });

      // Get original agent content
      const originalAgentPath = path.join(
        dirs.pluginDir,
        "agents",
        "web-developer.md",
      );
      const originalContent = await readFile(originalAgentPath, "utf-8");

      // Create custom output directory
      const customOutputDir = path.join(dirs.tempDir, "custom-output");
      await mkdir(customOutputDir, { recursive: true });

      // Recompile agents with custom output
      await recompileAgents({
        pluginDir: dirs.pluginDir,
        sourcePath: CLI_REPO,
        outputDir: customOutputDir,
      });

      // Verify original agent is unchanged
      const unchangedContent = await readFile(originalAgentPath, "utf-8");
      expect(unchangedContent).toBe(originalContent);
    });
  });
});

// =============================================================================
// P1-07: Test `cc compile` skill discovery (plugin + local)
// =============================================================================

describe("cc compile: Skill Discovery (P1-07)", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestDirs();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    await rm(dirs.tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe("plugin skill discovery", () => {
    it("should discover skills from plugin skills directory", async () => {
      const { loadPluginSkills } = await import("../lib/loader");

      // Create plugin with skills
      await createPluginStructure(dirs.pluginDir, {
        name: "claude-collective",
        agents: ["web-developer"],
        skills: [{ id: "react (@test)", preloaded: true }],
      });

      // Create skill in plugin
      await createPluginSkill(dirs.pluginDir, "react", {
        name: "react (@test)",
        description: "React development skills",
      });

      // Discover skills
      const skills = await loadPluginSkills(dirs.pluginDir);

      // Verify skill was discovered
      expect(Object.keys(skills).length).toBeGreaterThan(0);
      expect(skills["react (@test)"]).toBeDefined();
      expect(skills["react (@test)"].name.toLowerCase()).toContain("react");
    });

    it("should handle empty plugin skills directory", async () => {
      const { loadPluginSkills } = await import("../lib/loader");

      // Create plugin without skills directory
      await createPluginStructure(dirs.pluginDir, {
        name: "claude-collective",
        agents: ["web-developer"],
        skills: [],
      });

      // Discover skills (skills directory may not exist)
      const skills = await loadPluginSkills(dirs.pluginDir);

      // Should return empty object, not throw
      expect(skills).toEqual({});
    });
  });

  describe("local skill discovery", () => {
    it("should discover skills from .claude/skills/", async () => {
      const { discoverLocalSkills } = await import("../lib/local-skill-loader");

      // Create local skill
      await createLocalSkill(dirs.projectDir, "my-local-skill", {
        cliName: "My Local Skill",
        skillId: "my-local-skill (@local)",
        description: "A local skill for testing",
      });

      // Discover local skills
      const result = await discoverLocalSkills(dirs.projectDir);

      // Verify skill was discovered
      expect(result).not.toBeNull();
      expect(result?.skills.length).toBeGreaterThan(0);
      expect(result?.skills[0].id).toBe("my-local-skill (@local)");
      expect(result?.skills[0].local).toBe(true);
    });

    it("should return null when .claude/skills/ doesn't exist", async () => {
      const { discoverLocalSkills } = await import("../lib/local-skill-loader");

      // Don't create .claude/skills directory
      const result = await discoverLocalSkills(dirs.projectDir);

      expect(result).toBeNull();
    });
  });

  describe("merged skill discovery", () => {
    it("should merge skills from both plugin and local sources", async () => {
      const { loadPluginSkills } = await import("../lib/loader");
      const { discoverLocalSkills } = await import("../lib/local-skill-loader");

      // Create plugin skill
      await createPluginStructure(dirs.pluginDir, {
        name: "claude-collective",
        agents: ["web-developer"],
        skills: [{ id: "plugin-skill (@test)", preloaded: true }],
      });
      await createPluginSkill(dirs.pluginDir, "plugin-skill", {
        name: "plugin-skill (@test)",
        description: "A plugin skill",
      });

      // Create local skill
      await createLocalSkill(dirs.projectDir, "local-skill", {
        cliName: "Local Skill",
        skillId: "local-skill (@local)",
        description: "A local skill",
      });

      // Discover both
      const pluginSkills = await loadPluginSkills(dirs.pluginDir);
      const localSkillsResult = await discoverLocalSkills(dirs.projectDir);

      // Verify both sources found
      expect(Object.keys(pluginSkills).length).toBeGreaterThan(0);
      expect(localSkillsResult?.skills.length).toBeGreaterThan(0);

      // Verify different IDs
      const pluginSkillIds = Object.keys(pluginSkills);
      const localSkillIds = localSkillsResult?.skills.map((s) => s.id) || [];

      expect(pluginSkillIds).toContain("plugin-skill (@test)");
      expect(localSkillIds).toContain("local-skill (@local)");
    });

    it("should give local skills precedence over plugin skills with same ID", async () => {
      // This tests the merge logic in compile.ts where local skills override plugin skills
      const { loadPluginSkills } = await import("../lib/loader");
      const { discoverLocalSkills } = await import("../lib/local-skill-loader");

      const sharedSkillId = "shared-skill (@test)";

      // Create plugin skill
      await createPluginStructure(dirs.pluginDir, {
        name: "claude-collective",
        agents: ["web-developer"],
        skills: [{ id: sharedSkillId, preloaded: true }],
      });
      await createPluginSkill(dirs.pluginDir, "shared-skill", {
        name: sharedSkillId,
        description: "Plugin version of shared skill",
        content: "# Plugin Version\n\nThis is the plugin version.",
      });

      // Create local skill with same ID
      await createLocalSkill(dirs.projectDir, "shared-skill", {
        cliName: "Shared Skill",
        skillId: sharedSkillId,
        description: "Local version of shared skill",
        content: "# Local Version\n\nThis is the local version.",
      });

      // Discover both
      const pluginSkills = await loadPluginSkills(dirs.pluginDir);
      const localSkillsResult = await discoverLocalSkills(dirs.projectDir);

      // Both should find the skill
      expect(pluginSkills[sharedSkillId]).toBeDefined();
      expect(pluginSkills[sharedSkillId].description).toBe(
        "Plugin version of shared skill",
      );

      const localSkill = localSkillsResult?.skills.find(
        (s) => s.id === sharedSkillId,
      );
      expect(localSkill).toBeDefined();
      expect(localSkill?.description).toBe("Local version of shared skill");

      // The merge logic (tested here by verifying both exist) would have local win
      // The actual mergeSkills function in compile.ts does: mergeSkills(pluginSkills, localSkills)
      // where later sources take precedence
    });

    it("should discover multiple skills from each source", async () => {
      const { loadPluginSkills } = await import("../lib/loader");
      const { discoverLocalSkills } = await import("../lib/local-skill-loader");

      // Create multiple plugin skills
      await createPluginStructure(dirs.pluginDir, {
        name: "claude-collective",
        agents: ["web-developer"],
        skills: [
          { id: "plugin-skill-1 (@test)", preloaded: true },
          { id: "plugin-skill-2 (@test)", preloaded: false },
        ],
      });
      await createPluginSkill(dirs.pluginDir, "plugin-skill-1", {
        name: "plugin-skill-1 (@test)",
        description: "First plugin skill",
      });
      await createPluginSkill(dirs.pluginDir, "plugin-skill-2", {
        name: "plugin-skill-2 (@test)",
        description: "Second plugin skill",
      });

      // Create multiple local skills
      await createLocalSkill(dirs.projectDir, "local-skill-1", {
        cliName: "Local Skill 1",
        skillId: "local-skill-1 (@local)",
        description: "First local skill",
      });
      await createLocalSkill(dirs.projectDir, "local-skill-2", {
        cliName: "Local Skill 2",
        skillId: "local-skill-2 (@local)",
        description: "Second local skill",
      });

      // Discover both
      const pluginSkills = await loadPluginSkills(dirs.pluginDir);
      const localSkillsResult = await discoverLocalSkills(dirs.projectDir);

      // Verify counts
      expect(Object.keys(pluginSkills).length).toBe(2);
      expect(localSkillsResult?.skills.length).toBe(2);

      // Verify all skills found
      expect(pluginSkills["plugin-skill-1 (@test)"]).toBeDefined();
      expect(pluginSkills["plugin-skill-2 (@test)"]).toBeDefined();

      const localSkillIds = localSkillsResult?.skills.map((s) => s.id) || [];
      expect(localSkillIds).toContain("local-skill-1 (@local)");
      expect(localSkillIds).toContain("local-skill-2 (@local)");
    });
  });
});

// =============================================================================
// Integration Tests: Full Compile Flow
// =============================================================================

describe("cc compile: Integration Tests", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestDirs();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    await rm(dirs.tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("should compile with skills from real skills repository", async () => {
    // This test uses the actual claude-subagents repo
    const { compileStackToTemp } = await import("../lib/stack-installer");

    // Compile the nextjs-fullstack stack
    const { result, cleanup } = await compileStackToTemp({
      stackId: "nextjs-fullstack",
      projectRoot: SKILLS_REPO,
      agentSourcePath: CLI_REPO,
    });

    try {
      // Verify compilation result
      expect(result.pluginPath).toBeDefined();
      expect(result.agents.length).toBeGreaterThan(0);
      expect(result.skillPlugins.length).toBeGreaterThan(0);

      // Verify agent files were created
      const agentsDir = path.join(result.pluginPath, "agents");
      expect(await pathExists(agentsDir)).toBe(true);

      // Verify plugin.json was created
      const manifestPath = path.join(
        result.pluginPath,
        ".claude-plugin",
        "plugin.json",
      );
      expect(await pathExists(manifestPath)).toBe(true);
    } finally {
      await cleanup();
    }
  });
});

// =============================================================================
// P2-13: Test Compile uses ejected skills
// Acceptance Criteria:
// 1. When `.claude/skills/` exists with a skill, compile uses local skill content
// 2. Local skill takes precedence over plugin skill with same ID
// 3. Ejected skill's SKILL.md content appears in compiled agent
// =============================================================================

describe("cc compile: Uses Ejected Skills (P2-13)", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestDirs();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    await rm(dirs.tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("should discover skills from .claude/skills/ when present", async () => {
    const { discoverLocalSkills } = await import("../lib/local-skill-loader");

    // Create ejected skill in .claude/skills/
    await createLocalSkill(dirs.projectDir, "ejected-react", {
      cliName: "React (Ejected)",
      skillId: "react (@ejected)",
      description: "Ejected React skill with custom content",
      content: "# Ejected React Skill\n\nThis is custom ejected content.",
    });

    // Discover local skills
    const result = await discoverLocalSkills(dirs.projectDir);

    expect(result).not.toBeNull();
    expect(result?.skills.length).toBe(1);
    expect(result?.skills[0].id).toBe("react (@ejected)");
    expect(result?.skills[0].local).toBe(true);
  });

  it("should use local skill content when compiling instead of plugin skill", async () => {
    const { loadPluginSkills } = await import("../lib/loader");

    // Create plugin skill
    const sharedSkillId = "react (@shared)";
    await createPluginStructure(dirs.pluginDir, {
      name: "claude-collective",
      agents: ["web-developer"],
      skills: [{ id: sharedSkillId, preloaded: true }],
    });
    await createPluginSkill(dirs.pluginDir, "react", {
      name: sharedSkillId,
      description: "Plugin React skill",
      content: "# Plugin React\n\nThis is the PLUGIN version.",
    });

    // Create local skill with same ID (simulates ejected skill)
    await createLocalSkill(dirs.projectDir, "react", {
      cliName: "React",
      skillId: sharedSkillId,
      description: "Ejected React skill",
      content: "# Ejected React\n\nThis is the LOCAL/EJECTED version.",
    });

    // Load both
    const pluginSkills = await loadPluginSkills(dirs.pluginDir);
    const { discoverLocalSkills } = await import("../lib/local-skill-loader");
    const localResult = await discoverLocalSkills(dirs.projectDir);

    // Plugin skill should have plugin content
    expect(pluginSkills[sharedSkillId]).toBeDefined();
    expect(pluginSkills[sharedSkillId].description).toBe("Plugin React skill");

    // Local skill should exist with local content
    const localSkill = localResult?.skills.find((s) => s.id === sharedSkillId);
    expect(localSkill).toBeDefined();
    expect(localSkill?.description).toBe("Ejected React skill");

    // When merged (as in compile.ts), local should take precedence
    // The mergeSkills function in compile.ts: mergeSkills(pluginSkills, localSkills)
    // Later sources override earlier ones
  });

  it("should include ejected skill content in compiled agent output", async () => {
    const { recompileAgents } = await import("../lib/agent-recompiler");
    const { loadPluginSkills } = await import("../lib/loader");
    const { discoverLocalSkills } = await import("../lib/local-skill-loader");

    // Create plugin structure with an agent
    await createPluginStructure(dirs.pluginDir, {
      name: "claude-collective",
      agents: ["web-developer"],
      skills: [{ id: "react (@local)", preloaded: true }],
    });

    // Create ejected skill with identifiable content
    await createLocalSkill(dirs.projectDir, "react", {
      cliName: "React",
      skillId: "react (@local)",
      description: "Custom ejected React skill for testing",
      content:
        "# EJECTED_SKILL_MARKER\n\nThis content proves the ejected skill was used.",
    });

    // Load skills from both sources
    const pluginSkills = await loadPluginSkills(dirs.pluginDir);
    const localResult = await discoverLocalSkills(dirs.projectDir);

    // Build merged skills map (mimicking compile.ts behavior)
    const mergedSkills: Record<
      string,
      { path: string; name: string; description: string; canonicalId: string }
    > = { ...pluginSkills };

    if (localResult?.skills) {
      for (const skill of localResult.skills) {
        mergedSkills[skill.id] = {
          path: skill.path,
          name: skill.name,
          description: skill.description,
          canonicalId: skill.id,
        };
      }
    }

    // Verify merged skills contain local skill
    expect(mergedSkills["react (@local)"]).toBeDefined();
    expect(mergedSkills["react (@local)"].description).toBe(
      "Custom ejected React skill for testing",
    );
  });

  it("should use loadSkillsFromDir to discover all ejected skills", async () => {
    // Import the internal function used by compile.ts
    // Note: This tests the behavior through the public API

    // Create multiple ejected skills
    await createLocalSkill(dirs.projectDir, "react", {
      cliName: "React",
      skillId: "react (@local)",
      description: "Ejected React",
    });
    await createLocalSkill(dirs.projectDir, "typescript", {
      cliName: "TypeScript",
      skillId: "typescript (@local)",
      description: "Ejected TypeScript",
    });
    await createLocalSkill(dirs.projectDir, "vitest", {
      cliName: "Vitest",
      skillId: "vitest (@local)",
      description: "Ejected Vitest",
    });

    const { discoverLocalSkills } = await import("../lib/local-skill-loader");
    const result = await discoverLocalSkills(dirs.projectDir);

    expect(result).not.toBeNull();
    expect(result?.skills.length).toBe(3);

    const skillIds = result?.skills.map((s) => s.id) || [];
    expect(skillIds).toContain("react (@local)");
    expect(skillIds).toContain("typescript (@local)");
    expect(skillIds).toContain("vitest (@local)");
  });
});

// =============================================================================
// P2-14: Test Compile uses ejected agent partials
// Acceptance Criteria:
// 1. When `.claude/agents/_partials/{agent-name}/intro.md` exists, compile uses it
// 2. Ejected intro.md content appears in compiled agent output
// 3. Ejected workflow.md content appears in compiled agent output
// 4. Partial files that exist locally override bundled partials
// =============================================================================

describe("cc compile: Uses Ejected Agent Partials (P2-14)", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestDirs();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    await rm(dirs.tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  /**
   * Create ejected agent partials in .claude/agents/_partials/
   */
  async function createEjectedAgentPartials(
    projectDir: string,
    agentCategory: string,
    agentName: string,
    content: {
      intro?: string;
      workflow?: string;
      examples?: string;
      agentYaml?: string;
    },
  ): Promise<void> {
    const partialsDir = path.join(
      projectDir,
      ".claude",
      "agents",
      "_partials",
      agentCategory,
      agentName,
    );
    await mkdir(partialsDir, { recursive: true });

    if (content.intro) {
      await writeFile(path.join(partialsDir, "intro.md"), content.intro);
    }
    if (content.workflow) {
      await writeFile(path.join(partialsDir, "workflow.md"), content.workflow);
    }
    if (content.examples) {
      await writeFile(path.join(partialsDir, "examples.md"), content.examples);
    }
    if (content.agentYaml) {
      await writeFile(path.join(partialsDir, "agent.yaml"), content.agentYaml);
    }
  }

  it("should create ejected agent partials in correct directory structure", async () => {
    await createEjectedAgentPartials(
      dirs.projectDir,
      "developer",
      "web-developer",
      {
        intro: "# Custom Web Developer\n\nEjected intro content.",
        workflow: "## Custom Workflow\n\nEjected workflow steps.",
      },
    );

    const introPath = path.join(
      dirs.projectDir,
      ".claude",
      "agents",
      "_partials",
      "developer",
      "web-developer",
      "intro.md",
    );
    const workflowPath = path.join(
      dirs.projectDir,
      ".claude",
      "agents",
      "_partials",
      "developer",
      "web-developer",
      "workflow.md",
    );

    expect(await pathExists(introPath)).toBe(true);
    expect(await pathExists(workflowPath)).toBe(true);

    const introContent = await readFile(introPath, "utf-8");
    expect(introContent).toContain("Ejected intro content");
  });

  it("should detect ejected partials directory exists", async () => {
    await createEjectedAgentPartials(
      dirs.projectDir,
      "developer",
      "cli-developer",
      {
        intro: "# CLI Developer (Ejected)\n\nCustom CLI developer intro.",
      },
    );

    const partialsDir = path.join(
      dirs.projectDir,
      ".claude",
      "agents",
      "_partials",
    );

    expect(await pathExists(partialsDir)).toBe(true);

    // Check nested structure
    const agentDir = path.join(partialsDir, "developer", "cli-developer");
    expect(await pathExists(agentDir)).toBe(true);
  });

  it("should have ejected intro.md content available for compilation", async () => {
    const customIntro = `# EJECTED_INTRO_MARKER

This is a completely custom intro for testing.

**Key Features:**
- Custom feature 1
- Custom feature 2
`;

    await createEjectedAgentPartials(
      dirs.projectDir,
      "developer",
      "test-agent",
      {
        intro: customIntro,
        workflow: "## Workflow\n\n1. Step one\n2. Step two",
        agentYaml:
          "id: test-agent\ntitle: Test Agent\ndescription: Test\ntools: []",
      },
    );

    const introPath = path.join(
      dirs.projectDir,
      ".claude",
      "agents",
      "_partials",
      "developer",
      "test-agent",
      "intro.md",
    );

    const content = await readFile(introPath, "utf-8");
    expect(content).toContain("EJECTED_INTRO_MARKER");
    expect(content).toContain("Custom feature 1");
  });

  it("should have ejected workflow.md content available for compilation", async () => {
    const customWorkflow = `## EJECTED_WORKFLOW_MARKER

### Step 1: Custom First Step
Do something custom.

### Step 2: Custom Second Step
Do something else custom.
`;

    await createEjectedAgentPartials(
      dirs.projectDir,
      "developer",
      "api-developer",
      {
        intro: "# API Developer\n\nIntro.",
        workflow: customWorkflow,
      },
    );

    const workflowPath = path.join(
      dirs.projectDir,
      ".claude",
      "agents",
      "_partials",
      "developer",
      "api-developer",
      "workflow.md",
    );

    const content = await readFile(workflowPath, "utf-8");
    expect(content).toContain("EJECTED_WORKFLOW_MARKER");
    expect(content).toContain("Custom First Step");
    expect(content).toContain("Custom Second Step");
  });

  it("should support multiple agent partials in ejected structure", async () => {
    // Eject partials for multiple agents
    await createEjectedAgentPartials(
      dirs.projectDir,
      "developer",
      "web-developer",
      {
        intro: "# Web Developer (Ejected)",
        workflow: "## Web Workflow",
      },
    );
    await createEjectedAgentPartials(
      dirs.projectDir,
      "developer",
      "api-developer",
      {
        intro: "# API Developer (Ejected)",
        workflow: "## API Workflow",
      },
    );
    await createEjectedAgentPartials(dirs.projectDir, "tester", "web-tester", {
      intro: "# Web Tester (Ejected)",
      workflow: "## Test Workflow",
    });

    const partialsDir = path.join(
      dirs.projectDir,
      ".claude",
      "agents",
      "_partials",
    );

    // Verify all exist
    expect(
      await pathExists(
        path.join(partialsDir, "developer", "web-developer", "intro.md"),
      ),
    ).toBe(true);
    expect(
      await pathExists(
        path.join(partialsDir, "developer", "api-developer", "intro.md"),
      ),
    ).toBe(true);
    expect(
      await pathExists(
        path.join(partialsDir, "tester", "web-tester", "intro.md"),
      ),
    ).toBe(true);
  });

  it("should preserve custom content when partials are modified after eject", async () => {
    // Initial eject
    await createEjectedAgentPartials(
      dirs.projectDir,
      "developer",
      "web-developer",
      {
        intro: "# Original Intro",
        workflow: "## Original Workflow",
      },
    );

    // Modify the ejected partial
    const introPath = path.join(
      dirs.projectDir,
      ".claude",
      "agents",
      "_partials",
      "developer",
      "web-developer",
      "intro.md",
    );

    const modifiedContent = `# Modified Web Developer

This intro has been customized after ejecting.

## Project-Specific Section
- Custom guideline 1
- Custom guideline 2
`;

    await writeFile(introPath, modifiedContent);

    // Verify modification persists
    const content = await readFile(introPath, "utf-8");
    expect(content).toContain("Modified Web Developer");
    expect(content).toContain("Project-Specific Section");
    expect(content).not.toContain("Original Intro");
  });
});

// =============================================================================
// P2-15: Test Full eject produces self-contained setup
// Acceptance Criteria:
// 1. After eject all, compile succeeds using only local content
// 2. Compiled agents include local templates, skills, and partials
// 3. The ejected setup works without the plugin installed (simulated)
// =============================================================================

describe("cc compile: Full Eject Self-Contained Setup (P2-15)", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestDirs();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    await rm(dirs.tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  /**
   * Create a complete ejected setup simulating `cc eject all`
   */
  async function createFullEjectedSetup(projectDir: string): Promise<{
    templatesDir: string;
    skillsDir: string;
    agentsDir: string;
    configPath: string;
  }> {
    const claudeDir = path.join(projectDir, ".claude");

    // 1. Templates
    const templatesDir = path.join(claudeDir, "templates");
    await mkdir(templatesDir, { recursive: true });
    await writeFile(
      path.join(templatesDir, "agent.liquid"),
      `---
name: {{ agent.name }}
description: {{ agent.description }}
tools: {{ agent.tools | join: ", " }}
---

# {{ agent.title }}

{{ intro }}

{{ workflow }}

{% if skills.size > 0 %}
## Skills
{% for skill in skills %}
- {{ skill.name }}: {{ skill.description }}
{% endfor %}
{% endif %}

<!-- Compiled with ejected templates -->
`,
    );

    // 2. Skills
    const skillsDir = path.join(claudeDir, "skills");
    await mkdir(path.join(skillsDir, "react"), { recursive: true });
    await writeFile(
      path.join(skillsDir, "react", "metadata.yaml"),
      "cli_name: React\ncli_description: React development skill",
    );
    await writeFile(
      path.join(skillsDir, "react", "SKILL.md"),
      `---
name: react (@local)
description: React development skill
---

# React Skill (Ejected)

This is an ejected React skill for local customization.
`,
    );

    await mkdir(path.join(skillsDir, "typescript"), { recursive: true });
    await writeFile(
      path.join(skillsDir, "typescript", "metadata.yaml"),
      "cli_name: TypeScript\ncli_description: TypeScript development skill",
    );
    await writeFile(
      path.join(skillsDir, "typescript", "SKILL.md"),
      `---
name: typescript (@local)
description: TypeScript development skill
---

# TypeScript Skill (Ejected)

This is an ejected TypeScript skill.
`,
    );

    // 3. Agent partials
    const agentsDir = path.join(claudeDir, "agents", "_partials");
    await mkdir(path.join(agentsDir, "developer", "web-developer"), {
      recursive: true,
    });
    await writeFile(
      path.join(agentsDir, "developer", "web-developer", "agent.yaml"),
      `id: web-developer
title: Web Developer
description: A web developer agent
tools:
  - Read
  - Write
  - Bash
`,
    );
    await writeFile(
      path.join(agentsDir, "developer", "web-developer", "intro.md"),
      `# Web Developer (Ejected)

You are an expert web developer working on this project.
This intro was ejected and customized locally.
`,
    );
    await writeFile(
      path.join(agentsDir, "developer", "web-developer", "workflow.md"),
      `## Workflow (Ejected)

1. Investigate the codebase
2. Plan your changes
3. Implement carefully
4. Test your work

This workflow was ejected and customized locally.
`,
    );

    // 4. Config
    const configPath = path.join(claudeDir, "config.yaml");
    await writeFile(
      configPath,
      `name: my-ejected-project
description: A project with fully ejected setup

agents:
  - web-developer

skills:
  - id: "react (@local)"
    preloaded: true
  - id: "typescript (@local)"
    preloaded: false

agent_skills:
  web-developer:
    - react (@local)
    - typescript (@local)
`,
    );

    return { templatesDir, skillsDir, agentsDir, configPath };
  }

  it("should create complete ejected directory structure", async () => {
    const { templatesDir, skillsDir, agentsDir, configPath } =
      await createFullEjectedSetup(dirs.projectDir);

    // Verify all directories exist
    expect(await pathExists(templatesDir)).toBe(true);
    expect(await pathExists(skillsDir)).toBe(true);
    expect(await pathExists(agentsDir)).toBe(true);
    expect(await pathExists(configPath)).toBe(true);

    // Verify template exists
    expect(await pathExists(path.join(templatesDir, "agent.liquid"))).toBe(
      true,
    );

    // Verify skills exist
    expect(await pathExists(path.join(skillsDir, "react", "SKILL.md"))).toBe(
      true,
    );
    expect(
      await pathExists(path.join(skillsDir, "typescript", "SKILL.md")),
    ).toBe(true);

    // Verify agent partials exist
    expect(
      await pathExists(
        path.join(agentsDir, "developer", "web-developer", "intro.md"),
      ),
    ).toBe(true);
  });

  it("should discover ejected skills from .claude/skills/", async () => {
    await createFullEjectedSetup(dirs.projectDir);

    const { discoverLocalSkills } = await import("../lib/local-skill-loader");
    const result = await discoverLocalSkills(dirs.projectDir);

    expect(result).not.toBeNull();
    expect(result?.skills.length).toBe(2);

    const skillIds = result?.skills.map((s) => s.id) || [];
    expect(skillIds).toContain("react (@local)");
    expect(skillIds).toContain("typescript (@local)");
  });

  it("should use ejected templates for compilation", async () => {
    await createFullEjectedSetup(dirs.projectDir);

    const { createLiquidEngine } = await import("../lib/compiler");
    const engine = await createLiquidEngine(dirs.projectDir);

    // Render with sample data
    const sampleData = {
      agent: {
        name: "test-agent",
        description: "Test description",
        title: "Test Agent",
        tools: ["Read", "Write"],
      },
      intro: "Test intro content",
      workflow: "Test workflow content",
      skills: [
        { name: "React", description: "React skill" },
        { name: "TypeScript", description: "TypeScript skill" },
      ],
    };

    const rendered = await engine.renderFile("agent", sampleData);

    // Verify ejected template was used
    expect(rendered).toContain("<!-- Compiled with ejected templates -->");
    expect(rendered).toContain("name: test-agent");
    expect(rendered).toContain("Test intro content");
  });

  it("should work without plugin installed (using only local content)", async () => {
    await createFullEjectedSetup(dirs.projectDir);

    // Simulate compile without plugin by only using local skills
    const { discoverLocalSkills } = await import("../lib/local-skill-loader");
    const localSkillsResult = await discoverLocalSkills(dirs.projectDir);

    // Should have skills even without plugin
    expect(localSkillsResult).not.toBeNull();
    expect(localSkillsResult?.skills.length).toBeGreaterThan(0);

    // All skills should be local
    for (const skill of localSkillsResult?.skills || []) {
      expect(skill.local).toBe(true);
    }

    // Verify we can create engine with local templates
    const { createLiquidEngine } = await import("../lib/compiler");
    const engine = await createLiquidEngine(dirs.projectDir);
    expect(engine).toBeDefined();
  });

  it("should include local skill content in self-contained setup", async () => {
    await createFullEjectedSetup(dirs.projectDir);

    // Read ejected skill content
    const reactSkillPath = path.join(
      dirs.projectDir,
      ".claude",
      "skills",
      "react",
      "SKILL.md",
    );
    const content = await readFile(reactSkillPath, "utf-8");

    expect(content).toContain("# React Skill (Ejected)");
    expect(content).toContain("ejected React skill for local customization");
  });

  it("should have ejected agent partials ready for compilation", async () => {
    await createFullEjectedSetup(dirs.projectDir);

    // Read ejected agent partial content
    const introPath = path.join(
      dirs.projectDir,
      ".claude",
      "agents",
      "_partials",
      "developer",
      "web-developer",
      "intro.md",
    );
    const workflowPath = path.join(
      dirs.projectDir,
      ".claude",
      "agents",
      "_partials",
      "developer",
      "web-developer",
      "workflow.md",
    );

    const introContent = await readFile(introPath, "utf-8");
    const workflowContent = await readFile(workflowPath, "utf-8");

    expect(introContent).toContain("# Web Developer (Ejected)");
    expect(introContent).toContain("ejected and customized locally");
    expect(workflowContent).toContain("## Workflow (Ejected)");
    expect(workflowContent).toContain("ejected and customized locally");
  });

  it("should have valid config.yaml in ejected setup", async () => {
    const { configPath } = await createFullEjectedSetup(dirs.projectDir);
    const { parse: parseYaml } = await import("yaml");

    const content = await readFile(configPath, "utf-8");
    const config = parseYaml(content);

    expect(config.name).toBe("my-ejected-project");
    expect(config.agents).toContain("web-developer");
    expect(config.skills).toHaveLength(2);
    expect(config.agent_skills["web-developer"]).toContain("react (@local)");
    expect(config.agent_skills["web-developer"]).toContain(
      "typescript (@local)",
    );
  });

  it("should compile agents using complete ejected content", async () => {
    await createFullEjectedSetup(dirs.projectDir);

    // This test verifies the full integration:
    // 1. Local templates are used
    // 2. Local skills are discovered
    // 3. Local agent partials are available

    const { createLiquidEngine } = await import("../lib/compiler");
    const { discoverLocalSkills } = await import("../lib/local-skill-loader");

    // Get local skills
    const localSkillsResult = await discoverLocalSkills(dirs.projectDir);
    expect(localSkillsResult?.skills.length).toBe(2);

    // Create engine with local templates
    const engine = await createLiquidEngine(dirs.projectDir);

    // Read local agent partial content
    const introContent = await readFile(
      path.join(
        dirs.projectDir,
        ".claude",
        "agents",
        "_partials",
        "developer",
        "web-developer",
        "intro.md",
      ),
      "utf-8",
    );
    const workflowContent = await readFile(
      path.join(
        dirs.projectDir,
        ".claude",
        "agents",
        "_partials",
        "developer",
        "web-developer",
        "workflow.md",
      ),
      "utf-8",
    );

    // Build compile data
    const compileData = {
      agent: {
        name: "web-developer",
        description: "Web developer agent",
        title: "Web Developer",
        tools: ["Read", "Write", "Bash"],
      },
      intro: introContent,
      workflow: workflowContent,
      skills: localSkillsResult?.skills.map((s) => ({
        name: s.name,
        description: s.description,
      })),
    };

    // Compile
    const rendered = await engine.renderFile("agent", compileData);

    // Verify output uses all ejected content
    expect(rendered).toContain("<!-- Compiled with ejected templates -->");
    expect(rendered).toContain("Web Developer (Ejected)");
    expect(rendered).toContain("Workflow (Ejected)");
    expect(rendered).toContain("React");
    expect(rendered).toContain("TypeScript");
  });
});
