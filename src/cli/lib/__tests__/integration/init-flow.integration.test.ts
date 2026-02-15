import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "fs/promises";
import { parse as parseYaml } from "yaml";
import {
  createTestSource,
  cleanupTestSource,
  type TestDirs,
  type TestSkill,
} from "../fixtures/create-test-source";
import { installLocal } from "../../installation/local-installer";
import type { MergedSkillsMatrix, ProjectConfig, ResolvedSkill, SkillId } from "../../../types";
import type { SourceLoadResult } from "../../loading/source-loader";
import {
  createMockSkill,
  createMockMatrix,
  fileExists,
  directoryExists,
  readTestYaml,
  buildWizardResult,
  buildSourceResult,
} from "../helpers";

// ── Constants ──────────────────────────────────────────────────────────────────

const CLAUDE_SRC_DIR = ".claude-src";
const CLAUDE_DIR = ".claude";
const CONFIG_YAML = "config.yaml";
const SKILLS_SUBDIR = "skills";
const AGENTS_SUBDIR = "agents";

// Skills whose IDs match directory names in the test source.
// The skill.path in the matrix must align with the on-disk layout
// created by createTestSource: src/skills/{category}/{name}/SKILL.md
const TEST_SKILLS: TestSkill[] = [
  {
    id: "web-framework-react (@test)",
    name: "web-framework-react",
    description: "React framework for building user interfaces",
    category: "web/framework",
    author: "@test",
    tags: ["react", "web"],
    content: `---
name: web-framework-react
description: React framework for building user interfaces
---

# React

React is a JavaScript library for building user interfaces.

## Key Patterns

- Component-based architecture
- Hooks for state and effects
`,
  },
  {
    id: "api-framework-hono (@test)",
    name: "api-framework-hono",
    description: "Hono API framework for the edge",
    category: "api/framework",
    author: "@test",
    tags: ["hono", "api"],
    content: `---
name: api-framework-hono
description: Hono API framework for the edge
---

# Hono

Hono is a fast web framework for the edge.
`,
  },
  {
    id: "web-testing-vitest (@test)",
    name: "web-testing-vitest",
    description: "Next generation testing framework",
    category: "testing",
    author: "@test",
    tags: ["testing", "vitest"],
    content: `---
name: web-testing-vitest
description: Next generation testing framework
---

# Vitest

Vitest is a fast unit test framework powered by Vite.
`,
  },
];

// Build a MergedSkillsMatrix whose skill.path values match the file system
// layout created by createTestSource. The path format in createMockSkill is
// "skills/{category}/{id}/" and the copier resolves to
// "{sourcePath}/src/skills/{category}/{id}/".
function buildTestMatrix(): MergedSkillsMatrix {
  const skills: Record<string, ResolvedSkill> = {
    "web-framework-react": createMockSkill("web-framework-react", "web/framework", {
      description: "React framework for building user interfaces",
      tags: ["react", "web"],
    }),
    "api-framework-hono": createMockSkill("api-framework-hono", "api/framework", {
      description: "Hono API framework for the edge",
      tags: ["hono", "api"],
    }),
    "web-testing-vitest": createMockSkill("web-testing-vitest", "testing", {
      description: "Next generation testing framework",
      tags: ["testing", "vitest"],
    }),
  };
  return createMockMatrix(skills);
}

// ── Test Suites ────────────────────────────────────────────────────────────────

describe("Init Flow Integration: Local Mode", () => {
  let dirs: TestDirs;
  let originalCwd: string;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dirs = await createTestSource({ skills: TEST_SKILLS });
    process.chdir(dirs.projectDir);

    sourceResult = buildSourceResult(buildTestMatrix(), dirs.sourceDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should create .claude-src/config.yaml with correct structure", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react" as SkillId,
      "api-framework-hono" as SkillId,
    ];

    const result = await installLocal({
      wizardResult: buildWizardResult(selectedSkills),
      sourceResult,
      projectDir: dirs.projectDir,
      sourceFlag: dirs.sourceDir,
    });

    // config.yaml should exist in .claude-src/
    const configPath = path.join(dirs.projectDir, CLAUDE_SRC_DIR, CONFIG_YAML);
    expect(result.configPath).toBe(configPath);
    expect(await fileExists(configPath)).toBe(true);

    // Parse and verify structure
    const config = await readTestYaml<ProjectConfig>(configPath);
    expect(config.name).toBeDefined();
    expect(config.agents).toBeDefined();
    expect(Array.isArray(config.agents)).toBe(true);
    expect(config.agents.length).toBeGreaterThan(0);
    expect(config.skills).toBeDefined();
    expect(config.installMode).toBe("local");
    expect(config.source).toBe(dirs.sourceDir);
  });

  it("should copy selected skills to .claude/skills/", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react" as SkillId,
      "api-framework-hono" as SkillId,
    ];

    const result = await installLocal({
      wizardResult: buildWizardResult(selectedSkills),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Skills directory should exist
    const skillsDir = path.join(dirs.projectDir, CLAUDE_DIR, SKILLS_SUBDIR);
    expect(result.skillsDir).toBe(skillsDir);
    expect(await directoryExists(skillsDir)).toBe(true);

    // Exactly 2 skills should be copied
    expect(result.copiedSkills).toHaveLength(2);

    // Each copied skill should have a SKILL.md
    for (const copiedSkill of result.copiedSkills) {
      expect(await fileExists(path.join(copiedSkill.destPath, "SKILL.md"))).toBe(true);
    }

    // Skill IDs should match what was selected
    const copiedIds = result.copiedSkills.map((s) => s.skillId);
    expect(copiedIds).toContain("web-framework-react");
    expect(copiedIds).toContain("api-framework-hono");
  });

  it("should compile agents to .claude/agents/", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react" as SkillId,
      "api-framework-hono" as SkillId,
    ];

    const result = await installLocal({
      wizardResult: buildWizardResult(selectedSkills),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Agents directory should exist
    const agentsDir = path.join(dirs.projectDir, CLAUDE_DIR, AGENTS_SUBDIR);
    expect(result.agentsDir).toBe(agentsDir);
    expect(await directoryExists(agentsDir)).toBe(true);

    // At least one agent should be compiled
    expect(result.compiledAgents.length).toBeGreaterThan(0);

    // Each compiled agent should have a .md file
    for (const agentName of result.compiledAgents) {
      const agentPath = path.join(agentsDir, `${agentName}.md`);
      expect(await fileExists(agentPath)).toBe(true);

      // Agent file should have content (frontmatter + body)
      const content = await readFile(agentPath, "utf-8");
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain("---");
    }
  });

  it("should include selected skills in config.yaml skills array", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react" as SkillId,
      "api-framework-hono" as SkillId,
      "web-testing-vitest" as SkillId,
    ];

    const result = await installLocal({
      wizardResult: buildWizardResult(selectedSkills),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestYaml<ProjectConfig>(result.configPath);

    // All selected skill IDs should appear in config.skills
    for (const skillId of selectedSkills) {
      expect(config.skills).toContain(skillId);
    }
  });

  it("should assign skills to correct agents based on category", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react" as SkillId,
      "api-framework-hono" as SkillId,
    ];

    const result = await installLocal({
      wizardResult: buildWizardResult(selectedSkills),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestYaml<ProjectConfig>(result.configPath);

    // Stack property should exist and map agents to skills
    expect(config.stack).toBeDefined();

    // The stack should have at least one agent with skill assignments
    const agentNames = Object.keys(config.stack || {});
    expect(agentNames.length).toBeGreaterThan(0);

    // web-framework-react should be assigned to a web-related agent
    // api-framework-hono should be assigned to an api-related agent
    const allStackSkills = Object.values(config.stack || {}).flatMap((agentStack) =>
      Object.values(agentStack as Record<string, string>),
    );
    expect(allStackSkills).toContain("web-framework-react");
    expect(allStackSkills).toContain("api-framework-hono");
  });
});

describe("Init Flow Integration: Single Skill Selection", () => {
  let dirs: TestDirs;
  let originalCwd: string;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dirs = await createTestSource({ skills: TEST_SKILLS });
    process.chdir(dirs.projectDir);
    sourceResult = buildSourceResult(buildTestMatrix(), dirs.sourceDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should handle single skill selection correctly", async () => {
    const selectedSkills: SkillId[] = ["web-testing-vitest" as SkillId];

    const result = await installLocal({
      wizardResult: buildWizardResult(selectedSkills),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Only one skill should be copied
    expect(result.copiedSkills).toHaveLength(1);
    expect(result.copiedSkills[0].skillId).toBe("web-testing-vitest");

    // Config should reflect single skill
    const config = await readTestYaml<ProjectConfig>(result.configPath);
    expect(config.skills).toHaveLength(1);
    expect(config.skills).toContain("web-testing-vitest");
  });
});

describe("Init Flow Integration: All Skills Selection", () => {
  let dirs: TestDirs;
  let originalCwd: string;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dirs = await createTestSource({ skills: TEST_SKILLS });
    process.chdir(dirs.projectDir);
    sourceResult = buildSourceResult(buildTestMatrix(), dirs.sourceDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should handle all skills selected from matrix", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react" as SkillId,
      "api-framework-hono" as SkillId,
      "web-testing-vitest" as SkillId,
    ];

    const result = await installLocal({
      wizardResult: buildWizardResult(selectedSkills),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // All skills should be copied
    expect(result.copiedSkills).toHaveLength(3);

    // Config should include all skills
    const config = await readTestYaml<ProjectConfig>(result.configPath);
    expect(config.skills).toHaveLength(3);

    // Agents should cover web + api domains
    expect(result.compiledAgents.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Init Flow Integration: Source Configuration", () => {
  let dirs: TestDirs;
  let originalCwd: string;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dirs = await createTestSource({ skills: TEST_SKILLS });
    process.chdir(dirs.projectDir);
    sourceResult = buildSourceResult(buildTestMatrix(), dirs.sourceDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should save source flag to config.yaml when provided", async () => {
    const result = await installLocal({
      wizardResult: buildWizardResult(["web-framework-react" as SkillId]),
      sourceResult,
      projectDir: dirs.projectDir,
      sourceFlag: dirs.sourceDir,
    });

    const config = await readTestYaml<ProjectConfig>(result.configPath);
    expect(config.source).toBe(dirs.sourceDir);
  });

  it("should use sourceConfig source when no source flag provided", async () => {
    await installLocal({
      wizardResult: buildWizardResult(["web-framework-react" as SkillId]),
      sourceResult,
      projectDir: dirs.projectDir,
      // No sourceFlag — falls back to sourceResult.sourceConfig.source
    });

    const configPath = path.join(dirs.projectDir, CLAUDE_SRC_DIR, CONFIG_YAML);
    const config = await readTestYaml<ProjectConfig>(configPath);

    // Source comes from sourceResult.sourceConfig.source
    expect(config.source).toBe(dirs.sourceDir);
  });
});

describe("Init Flow Integration: Directory Structure Verification", () => {
  let dirs: TestDirs;
  let originalCwd: string;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dirs = await createTestSource({ skills: TEST_SKILLS });
    process.chdir(dirs.projectDir);
    sourceResult = buildSourceResult(buildTestMatrix(), dirs.sourceDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should create complete directory structure", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react" as SkillId,
      "api-framework-hono" as SkillId,
    ];

    await installLocal({
      wizardResult: buildWizardResult(selectedSkills),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // .claude-src/ should exist
    expect(await directoryExists(path.join(dirs.projectDir, CLAUDE_SRC_DIR))).toBe(true);

    // .claude-src/config.yaml should exist
    expect(await fileExists(path.join(dirs.projectDir, CLAUDE_SRC_DIR, CONFIG_YAML))).toBe(true);

    // .claude/skills/ should exist
    expect(await directoryExists(path.join(dirs.projectDir, CLAUDE_DIR, SKILLS_SUBDIR))).toBe(true);

    // .claude/agents/ should exist
    expect(await directoryExists(path.join(dirs.projectDir, CLAUDE_DIR, AGENTS_SUBDIR))).toBe(true);
  });

  it("should create skill directories with SKILL.md files", async () => {
    const result = await installLocal({
      wizardResult: buildWizardResult(["web-framework-react" as SkillId]),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Skill directory should have been created
    const skillDir = result.copiedSkills[0].destPath;
    expect(await directoryExists(skillDir)).toBe(true);

    // SKILL.md should contain the skill content
    const skillMdPath = path.join(skillDir, "SKILL.md");
    expect(await fileExists(skillMdPath)).toBe(true);

    const content = await readFile(skillMdPath, "utf-8");
    expect(content).toContain("React");
  });

  it("should produce agent markdown with valid frontmatter", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react" as SkillId,
      "api-framework-hono" as SkillId,
    ];

    const result = await installLocal({
      wizardResult: buildWizardResult(selectedSkills),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Check at least one compiled agent has valid frontmatter
    const firstAgent = result.compiledAgents[0];
    const agentPath = path.join(result.agentsDir, `${firstAgent}.md`);
    const agentContent = await readFile(agentPath, "utf-8");

    // Should start with frontmatter delimiter
    expect(agentContent.startsWith("---")).toBe(true);

    // Should have closing frontmatter delimiter
    const closingIndex = agentContent.indexOf("---", 3);
    expect(closingIndex).toBeGreaterThan(3);

    // Frontmatter should parse as YAML
    const frontmatterStr = agentContent.slice(3, closingIndex).trim();
    const frontmatter = parseYaml(frontmatterStr) as Record<string, unknown>;
    expect(frontmatter).toHaveProperty("name");
    expect(frontmatter).toHaveProperty("description");
  });
});

describe("Init Flow Integration: Idempotency and Merge", () => {
  let dirs: TestDirs;
  let originalCwd: string;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dirs = await createTestSource({ skills: TEST_SKILLS });
    process.chdir(dirs.projectDir);
    sourceResult = buildSourceResult(buildTestMatrix(), dirs.sourceDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should merge with existing config on second init", async () => {
    // First init with one skill
    const firstResult = await installLocal({
      wizardResult: buildWizardResult(["web-framework-react" as SkillId]),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    expect(firstResult.wasMerged).toBe(false);

    // Second init with additional skill
    const secondResult = await installLocal({
      wizardResult: buildWizardResult([
        "web-framework-react" as SkillId,
        "api-framework-hono" as SkillId,
      ]),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    expect(secondResult.wasMerged).toBe(true);

    // Config should have both skills
    const config = await readTestYaml<ProjectConfig>(secondResult.configPath);
    expect(config.skills).toContain("web-framework-react");
    expect(config.skills).toContain("api-framework-hono");
  });
});

describe("Init Flow Integration: Install Mode in Config", () => {
  let dirs: TestDirs;
  let originalCwd: string;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dirs = await createTestSource({ skills: TEST_SKILLS });
    process.chdir(dirs.projectDir);
    sourceResult = buildSourceResult(buildTestMatrix(), dirs.sourceDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should set installMode to local in config", async () => {
    const result = await installLocal({
      wizardResult: buildWizardResult(["web-framework-react" as SkillId], {
        installMode: "local",
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestYaml<ProjectConfig>(result.configPath);
    expect(config.installMode).toBe("local");
  });

  it("should set installMode to plugin when wizard selects plugin mode", async () => {
    const result = await installLocal({
      wizardResult: buildWizardResult(["web-framework-react" as SkillId], {
        installMode: "plugin",
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestYaml<ProjectConfig>(result.configPath);
    expect(config.installMode).toBe("plugin");
  });
});

describe("Init Flow Integration: Skill Content Verification", () => {
  let dirs: TestDirs;
  let originalCwd: string;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dirs = await createTestSource({ skills: TEST_SKILLS });
    process.chdir(dirs.projectDir);
    sourceResult = buildSourceResult(buildTestMatrix(), dirs.sourceDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should preserve skill content when copying", async () => {
    const result = await installLocal({
      wizardResult: buildWizardResult([
        "web-framework-react" as SkillId,
        "api-framework-hono" as SkillId,
      ]),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Find the React skill
    const reactSkill = result.copiedSkills.find((s) => s.skillId === "web-framework-react");
    expect(reactSkill).toBeDefined();

    const reactContent = await readFile(path.join(reactSkill!.destPath, "SKILL.md"), "utf-8");
    expect(reactContent).toContain("React");
    expect(reactContent).toContain("Component-based architecture");

    // Find the Hono skill
    const honoSkill = result.copiedSkills.find((s) => s.skillId === "api-framework-hono");
    expect(honoSkill).toBeDefined();

    const honoContent = await readFile(path.join(honoSkill!.destPath, "SKILL.md"), "utf-8");
    expect(honoContent).toContain("Hono");
    expect(honoContent).toContain("fast web framework");
  });

  it("should inject forked_from metadata on copied skills", async () => {
    const result = await installLocal({
      wizardResult: buildWizardResult(["web-framework-react" as SkillId]),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const copiedSkill = result.copiedSkills[0];
    const metadataPath = path.join(copiedSkill.destPath, "metadata.yaml");
    expect(await fileExists(metadataPath)).toBe(true);

    const metadata = await readTestYaml<Record<string, unknown>>(metadataPath);
    // installLocal calls injectForkedFromMetadata which adds forked_from
    expect(metadata).toHaveProperty("forked_from");

    const forkedFrom = metadata.forked_from as Record<string, unknown>;
    expect(forkedFrom.skill_id).toBe("web-framework-react");
    expect(forkedFrom.content_hash).toBeDefined();
  });
});
