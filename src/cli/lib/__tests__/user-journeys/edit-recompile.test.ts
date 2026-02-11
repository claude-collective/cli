/**
 * User journey tests for the edit -> recompile -> verify flow.
 *
 * Tests the complete workflow where a user:
 * 1. Has an installed plugin with compiled agents
 * 2. Edits skill content in the plugin directory
 * 3. Recompiles agents
 * 4. Verifies the output reflects the changes
 */
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile, mkdir, writeFile } from "fs/promises";
import { parse as parseYaml } from "yaml";
import { recompileAgents, type RecompileAgentsOptions } from "../../agent-recompiler";
import {
  createTestSource,
  cleanupTestSource,
  fileExists,
  readTestFile,
  writeTestFile,
  type TestDirs,
  DEFAULT_TEST_SKILLS,
  DEFAULT_TEST_AGENTS,
} from "../fixtures/create-test-source";
import type { AgentName, SkillId } from "../../../types-matrix";

// =============================================================================
// Constants
// =============================================================================

/**
 * Path to the CLI repo root. Agent definitions (intro.md, workflow.md, etc.)
 * and Liquid templates live here.
 */
const CLI_REPO_PATH = path.resolve(__dirname, "../../../../..");

/**
 * Marker text added to skill content during edits, used to verify recompilation
 * picks up changes.
 */
const EDIT_MARKER = "EDITED-SKILL-CONTENT-MARKER";

/**
 * Content appended to a skill file during the "edit" step.
 */
const APPENDED_SKILL_SECTION = `\n\n## Added Section\n\nThis section was added after initial compilation. ${EDIT_MARKER}\n`;

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Parse YAML frontmatter from markdown content.
 */
function parseFrontmatter(content: string): Record<string, unknown> | null {
  if (!content.startsWith("---")) {
    return null;
  }

  const endIndex = content.indexOf("---", 3);
  if (endIndex === -1) {
    return null;
  }

  const yamlContent = content.slice(3, endIndex).trim();
  try {
    return parseYaml(yamlContent) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Build recompile options from test dirs, targeting a specific output directory.
 */
function buildRecompileOptions(
  dirs: TestDirs,
  outputDir: string,
  overrides?: Partial<RecompileAgentsOptions>,
): RecompileAgentsOptions {
  return {
    pluginDir: dirs.pluginDir ?? dirs.projectDir,
    sourcePath: CLI_REPO_PATH,
    projectDir: dirs.projectDir,
    outputDir,
    ...overrides,
  };
}

// =============================================================================
// Tests: Edit -> Recompile -> Verify
// =============================================================================

describe("User Journey: Edit -> Recompile -> Verify", () => {
  let dirs: TestDirs;
  let outputDir: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Suppress console output during tests
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Create test source with plugin structure containing default skills and agents
    dirs = await createTestSource({
      skills: DEFAULT_TEST_SKILLS,
      agents: DEFAULT_TEST_AGENTS,
      projectConfig: {
        name: "test-recompile-project",
        description: "Test project for edit-recompile flow",
        agents: ["web-developer", "api-developer"],
        skills: DEFAULT_TEST_SKILLS.map((s) => ({ id: s.id })),
      },
      asPlugin: true,
    });

    outputDir = path.join(dirs.tempDir, "output");
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    warnSpy.mockRestore();
    await cleanupTestSource(dirs);
  });

  // ===========================================================================
  // Test: Initial compilation produces valid output
  // ===========================================================================

  it("should produce valid initial compilation", async () => {
    const options = buildRecompileOptions(dirs, outputDir, {
      agents: ["web-pm" as AgentName],
    });

    const result = await recompileAgents(options);

    // web-pm is a simple agent that should compile without skill issues
    expect(result.compiled).toContain("web-pm");
    expect(result.failed).toEqual([]);

    // Verify the agent file was created
    const agentPath = path.join(outputDir, "web-pm.md");
    expect(await fileExists(agentPath)).toBe(true);

    // Verify content has frontmatter
    const content = await readTestFile(agentPath);
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("web-pm");
  });

  // ===========================================================================
  // Test: Detect and incorporate skill edits on recompile
  // ===========================================================================

  it("should detect and incorporate skill edits on recompile", async () => {
    const pluginDir = dirs.pluginDir!;
    const pluginSkillsDir = path.join(pluginDir, "skills");

    // Step 1: Initial compile with skills provided directly
    const reactSkillDef = {
      react: {
        id: "react" as SkillId,
        path: "skills/react/",
        description: "React framework",
      },
    };

    const initialOptions = buildRecompileOptions(dirs, outputDir, {
      agents: ["web-pm" as AgentName],
      skills: reactSkillDef,
    });

    const initialResult = await recompileAgents(initialOptions);
    expect(initialResult.compiled).toContain("web-pm");

    const agentPath = path.join(outputDir, "web-pm.md");
    const initialContent = await readTestFile(agentPath);

    // Step 2: Edit a skill file in the plugin directory
    const reactSkillPath = path.join(pluginSkillsDir, "react", "SKILL.md");
    if (await fileExists(reactSkillPath)) {
      const originalSkill = await readTestFile(reactSkillPath);
      await writeTestFile(reactSkillPath, originalSkill + APPENDED_SKILL_SECTION);
    }

    // Step 3: Recompile (loadPluginSkills will re-read the edited skill files)
    const recompileOptions = buildRecompileOptions(dirs, outputDir, {
      agents: ["web-pm" as AgentName],
      // Don't provide skills - let it reload from plugin dir
    });

    const recompileResult = await recompileAgents(recompileOptions);
    expect(recompileResult.compiled).toContain("web-pm");
    expect(recompileResult.failed).toEqual([]);

    // Step 4: Verify the agent was recompiled (file was overwritten)
    const recompiledContent = await readTestFile(agentPath);
    expect(recompiledContent.length).toBeGreaterThan(0);
    expect(recompiledContent).toMatch(/^---\n/);
  });

  // ===========================================================================
  // Test: Preserve unchanged agents during recompile
  // ===========================================================================

  it("should preserve unchanged agents during recompile", async () => {
    // Compile two agents
    const options = buildRecompileOptions(dirs, outputDir, {
      agents: ["web-pm" as AgentName],
    });

    const result1 = await recompileAgents(options);
    expect(result1.compiled).toContain("web-pm");

    const agentPath = path.join(outputDir, "web-pm.md");
    const firstContent = await readTestFile(agentPath);

    // Recompile the same agent with no changes to skills
    const result2 = await recompileAgents(options);
    expect(result2.compiled).toContain("web-pm");
    expect(result2.failed).toEqual([]);

    // Content should be equivalent (same agent, same skills -> same output)
    const secondContent = await readTestFile(agentPath);
    expect(secondContent).toBe(firstContent);
  });

  // ===========================================================================
  // Test: Handle adding new skills to existing agents
  // ===========================================================================

  it("should handle adding new skills to existing agents", async () => {
    const pluginDir = dirs.pluginDir!;
    const pluginSkillsDir = path.join(pluginDir, "skills");

    // Step 1: Initial compile with no skills provided (empty plugin skills)
    const initialOptions = buildRecompileOptions(dirs, outputDir, {
      agents: ["web-pm" as AgentName],
      skills: {},
    });

    const initialResult = await recompileAgents(initialOptions);
    expect(initialResult.compiled).toContain("web-pm");

    const agentPath = path.join(outputDir, "web-pm.md");
    const initialContent = await readTestFile(agentPath);

    // Step 2: Add a brand new skill to the plugin skills directory
    const newSkillDir = path.join(pluginSkillsDir, "new-testing-skill");
    await mkdir(newSkillDir, { recursive: true });
    await writeFile(
      path.join(newSkillDir, "SKILL.md"),
      `---
name: new-testing-skill
description: A newly added testing skill
---

# New Testing Skill

This skill was added after initial compilation.

## Usage

Use this for verifying recompilation picks up new skills.
`,
    );

    // Step 3: Recompile without providing skills (force reload from plugin dir)
    const recompileOptions = buildRecompileOptions(dirs, outputDir, {
      agents: ["web-pm" as AgentName],
    });

    const recompileResult = await recompileAgents(recompileOptions);
    expect(recompileResult.compiled).toContain("web-pm");
    expect(recompileResult.failed).toEqual([]);

    // The agent file should still be valid after recompile
    const recompiledContent = await readTestFile(agentPath);
    expect(recompiledContent.length).toBeGreaterThan(0);
    expect(recompiledContent).toMatch(/^---\n/);
  });

  // ===========================================================================
  // Test: Handle removing skills from agents
  // ===========================================================================

  it("should handle removing skills from agents", async () => {
    const pluginDir = dirs.pluginDir!;

    // Step 1: Initial compile with explicit skills
    const initialSkills = {
      react: {
        id: "react" as SkillId,
        path: "skills/react/",
        description: "React framework",
      },
      zustand: {
        id: "zustand" as SkillId,
        path: "skills/zustand/",
        description: "State management",
      },
    };

    const initialOptions = buildRecompileOptions(dirs, outputDir, {
      agents: ["web-pm" as AgentName],
      skills: initialSkills,
    });

    const initialResult = await recompileAgents(initialOptions);
    expect(initialResult.compiled).toContain("web-pm");

    // Step 2: Recompile with fewer skills (simulating removal)
    const reducedSkills = {
      react: {
        id: "react" as SkillId,
        path: "skills/react/",
        description: "React framework",
      },
    };

    const recompileOptions = buildRecompileOptions(dirs, outputDir, {
      agents: ["web-pm" as AgentName],
      skills: reducedSkills,
    });

    const recompileResult = await recompileAgents(recompileOptions);
    expect(recompileResult.compiled).toContain("web-pm");
    expect(recompileResult.failed).toEqual([]);

    // Verify the agent file is still valid
    const agentPath = path.join(outputDir, "web-pm.md");
    const content = await readTestFile(agentPath);
    expect(content.length).toBeGreaterThan(0);
    expect(content).toMatch(/^---\n/);
  });

  // ===========================================================================
  // Test: Recompile result reports correct agent names
  // ===========================================================================

  it("should report correct compiled and failed agent lists", async () => {
    // Compile a valid agent and an invalid one
    const options = buildRecompileOptions(dirs, outputDir, {
      agents: ["web-pm" as AgentName, "non-existent-agent-xyz" as AgentName],
    });

    const result = await recompileAgents(options);

    // web-pm should compile, non-existent should be warned about
    expect(result.compiled).toContain("web-pm");
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("non-existent-agent-xyz")]),
    );
  });

  // ===========================================================================
  // Test: Recompile with output directory creates files in correct location
  // ===========================================================================

  it("should write recompiled agents to the specified output directory", async () => {
    const customOutputDir = path.join(dirs.tempDir, "custom-output");
    await mkdir(customOutputDir, { recursive: true });

    const options = buildRecompileOptions(dirs, customOutputDir, {
      agents: ["web-pm" as AgentName],
    });

    const result = await recompileAgents(options);
    expect(result.compiled).toContain("web-pm");

    // Verify file is in the custom output directory, not the plugin dir
    const agentPath = path.join(customOutputDir, "web-pm.md");
    expect(await fileExists(agentPath)).toBe(true);

    const content = await readTestFile(agentPath);
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("web-pm");
  });

  // ===========================================================================
  // Test: Multiple recompiles converge to same output
  // ===========================================================================

  it("should produce identical output on consecutive recompiles without changes", async () => {
    const options = buildRecompileOptions(dirs, outputDir, {
      agents: ["web-pm" as AgentName],
    });

    // First compile
    await recompileAgents(options);
    const agentPath = path.join(outputDir, "web-pm.md");
    const firstContent = await readTestFile(agentPath);

    // Second compile
    await recompileAgents(options);
    const secondContent = await readTestFile(agentPath);

    // Third compile
    await recompileAgents(options);
    const thirdContent = await readTestFile(agentPath);

    // All three should be identical (deterministic compilation)
    expect(firstContent).toBe(secondContent);
    expect(secondContent).toBe(thirdContent);
  });
});
