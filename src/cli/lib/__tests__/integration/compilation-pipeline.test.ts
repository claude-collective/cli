import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, readFile, stat } from "fs/promises";
import { compileAllSkillPlugins } from "../../skills";
import { compileStackPlugin, loadStacks } from "../../stacks";
import {
  generateMarketplace,
  writeMarketplace,
  getMarketplaceStats,
} from "../../marketplace-generator";
import { validateAllPlugins, validatePlugin } from "../../plugins";
import type { Marketplace, PluginManifest, Stack } from "../../../types";
import {
  createTestSource,
  cleanupTestSource,
  type TestDirs,
  type TestSkill,
} from "../fixtures/create-test-source";

const TEST_AUTHOR = "@test";
const DEFAULT_SKILL_COUNT = 4;

// Frontmatter names match the skill IDs used in the stack definition
const STACK_TEST_SKILLS: TestSkill[] = [
  {
    id: "web-framework-react (@test)",
    name: "web-framework-react",
    description: "React framework skill for stack testing",
    category: "web/framework",
    author: TEST_AUTHOR,
    tags: ["react", "web"],
    content: `---
name: web-framework-react
description: React framework skill for stack testing
---

# React

React is a JavaScript library for building user interfaces.
`,
  },
  {
    id: "api-framework-hono (@test)",
    name: "api-framework-hono",
    description: "Hono API framework skill for stack testing",
    category: "api/framework",
    author: TEST_AUTHOR,
    tags: ["hono", "api"],
    content: `---
name: api-framework-hono
description: Hono API framework skill for stack testing
---

# Hono

Hono is a fast web framework for the edge.
`,
  },
];

const TEST_STACK: Stack = {
  id: "test-stack",
  name: "Test Stack",
  description: "A test stack for integration testing",
  agents: {
    "web-developer": {
      framework: [{ id: "web-framework-react", preloaded: true }],
    },
    "api-developer": {
      api: [{ id: "api-framework-hono", preloaded: true }],
    },
  },
};

async function readPluginManifest(pluginDir: string): Promise<PluginManifest | null> {
  const manifestPath = path.join(pluginDir, ".claude-plugin", "plugin.json");
  try {
    const content = await readFile(manifestPath, "utf-8");
    return JSON.parse(content) as PluginManifest;
  } catch {
    return null;
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

describe("Integration: Full Skill Pipeline", () => {
  let dirs: TestDirs;
  let tempDir: string;
  let outputDir: string;

  beforeEach(async () => {
    dirs = await createTestSource();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "skill-pipeline-test-"));
    outputDir = path.join(tempDir, "plugins");
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should compile all skills to plugins without errors", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const results = await compileAllSkillPlugins(dirs.skillsDir, outputDir);

    // All 4 default test skills should compile successfully
    expect(results).toHaveLength(DEFAULT_SKILL_COUNT);

    // Each result should have valid structure
    for (const result of results) {
      expect(result.pluginPath).toBeTruthy();
      expect(result.manifest.name).toBe(result.skillName);
      expect(result.skillName).toBeTruthy();
    }

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should validate all compiled skill plugins", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await compileAllSkillPlugins(dirs.skillsDir, outputDir);

    const validationResult = await validateAllPlugins(outputDir);

    expect(validationResult.summary.total).toBe(DEFAULT_SKILL_COUNT);
    expect(validationResult.summary.invalid).toBe(0);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should generate marketplace with correct plugin count", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const compileResults = await compileAllSkillPlugins(dirs.skillsDir, outputDir);

    const marketplace = await generateMarketplace(outputDir, {
      name: "test-marketplace",
      ownerName: "Test Owner",
      pluginRoot: "./plugins",
    });

    expect(marketplace.plugins.length).toBe(compileResults.length);

    for (const plugin of marketplace.plugins) {
      expect(plugin.name).toBeTruthy();
      expect(plugin.source).toBeTruthy();
    }

    const stats = getMarketplaceStats(marketplace);
    expect(stats.total).toBe(compileResults.length);
    expect(Object.keys(stats.byCategory).length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should produce plugins with unique names", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const results = await compileAllSkillPlugins(dirs.skillsDir, outputDir);

    const names = results.map((r) => r.manifest.name);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe("Integration: Full Stack Pipeline", () => {
  let dirs: TestDirs;
  let tempDir: string;
  let outputDir: string;

  beforeEach(async () => {
    // Create source with skills whose frontmatter names match real skill_aliases resolutions
    dirs = await createTestSource({ skills: STACK_TEST_SKILLS });
    tempDir = await mkdtemp(path.join(os.tmpdir(), "stack-pipeline-test-"));
    outputDir = path.join(tempDir, "stacks");
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should list available stacks from fixture", async () => {
    // Create a source with stacks defined in config/stacks.yaml
    const stackDirs = await createTestSource({
      skills: STACK_TEST_SKILLS,
      stacks: [
        {
          id: TEST_STACK.id,
          name: TEST_STACK.name,
          description: TEST_STACK.description,
          agents: TEST_STACK.agents as Record<string, Record<string, string>>,
        },
      ],
    });

    const stacks = await loadStacks(stackDirs.sourceDir);

    expect(stacks.length).toBeGreaterThan(0);
    expect(stacks.map((s) => s.id)).toContain("test-stack");

    await cleanupTestSource(stackDirs);
  });

  it("should compile test stack successfully", async () => {
    const result = await compileStackPlugin({
      stackId: TEST_STACK.id,
      outputDir,
      projectRoot: dirs.sourceDir,
      agentSourcePath: dirs.sourceDir,
      stack: TEST_STACK,
    });

    // Verify result structure
    expect(result.pluginPath).toBe(path.join(outputDir, TEST_STACK.id));
    expect(result.stackName).toBeTruthy();
    expect(result.agents.length).toBeGreaterThan(0);

    // Verify plugin directory structure
    expect(await pathExists(result.pluginPath)).toBe(true);
    expect(await pathExists(path.join(result.pluginPath, "agents"))).toBe(true);
    expect(await pathExists(path.join(result.pluginPath, ".claude-plugin", "plugin.json"))).toBe(
      true,
    );
    expect(await pathExists(path.join(result.pluginPath, "README.md"))).toBe(true);

    // Verify manifest
    const manifest = await readPluginManifest(result.pluginPath);
    expect(manifest).not.toBeNull();
    expect(manifest!.name).toBe(TEST_STACK.id);
    // Claude Code discovers agents automatically from ./agents/ directory
    expect(manifest!.agents).toBeUndefined();
  });

  it("should generate README with agent list", async () => {
    const result = await compileStackPlugin({
      stackId: TEST_STACK.id,
      outputDir,
      projectRoot: dirs.sourceDir,
      agentSourcePath: dirs.sourceDir,
      stack: TEST_STACK,
    });

    const readmePath = path.join(result.pluginPath, "README.md");
    const readme = await readFile(readmePath, "utf-8");

    // README should contain section headers
    expect(readme).toContain("# ");
    expect(readme).toContain("## Agents");
    expect(readme).toContain("## Installation");

    // README should list agents
    for (const agent of result.agents) {
      expect(readme).toContain(agent);
    }
  });

  it("should include skill plugin references in manifest", async () => {
    const result = await compileStackPlugin({
      stackId: TEST_STACK.id,
      outputDir,
      projectRoot: dirs.sourceDir,
      agentSourcePath: dirs.sourceDir,
      stack: TEST_STACK,
    });

    // Should reference skill plugins
    expect(result.skillPlugins.length).toBeGreaterThan(0);

    // Skill references should be in normalized kebab-case format
    for (const skillPlugin of result.skillPlugins) {
      expect(skillPlugin).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("should validate compiled stack plugins", async () => {
    await compileStackPlugin({
      stackId: TEST_STACK.id,
      outputDir,
      projectRoot: dirs.sourceDir,
      agentSourcePath: dirs.sourceDir,
      stack: TEST_STACK,
    });

    const pluginPath = path.join(outputDir, TEST_STACK.id);
    const validationResult = await validatePlugin(pluginPath);

    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toHaveLength(0);
  });
});

describe("Integration: Marketplace Integrity", () => {
  let dirs: TestDirs;
  let tempDir: string;
  let pluginsDir: string;
  let marketplacePath: string;

  beforeEach(async () => {
    // Use STACK_TEST_SKILLS so plugin names match category patterns (e.g., skill-web-framework-react -> "web")
    dirs = await createTestSource({ skills: STACK_TEST_SKILLS });
    tempDir = await mkdtemp(path.join(os.tmpdir(), "marketplace-test-"));
    pluginsDir = path.join(tempDir, "plugins");
    marketplacePath = path.join(tempDir, "marketplace.json");
    await mkdir(pluginsDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should generate valid marketplace.json", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await compileAllSkillPlugins(dirs.skillsDir, pluginsDir);

    const marketplace = await generateMarketplace(pluginsDir, {
      name: "claude-collective",
      version: "1.0.0",
      description: "Claude Collective Skills Marketplace",
      ownerName: "Claude Collective",
      ownerEmail: "hello@example.com",
      pluginRoot: "./plugins",
    });

    await writeMarketplace(marketplacePath, marketplace);

    const content = await readFile(marketplacePath, "utf-8");
    const parsed = JSON.parse(content) as Marketplace;

    expect(parsed.$schema).toBe("https://anthropic.com/claude-code/marketplace.schema.json");
    expect(parsed.name).toBe("claude-collective");
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.owner.name).toBe("Claude Collective");
    expect(parsed.owner.email).toBe("hello@example.com");
    expect(parsed.metadata?.pluginRoot).toBe("./plugins");
    expect(parsed.plugins.length).toBe(STACK_TEST_SKILLS.length);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should have no duplicate plugin names", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await compileAllSkillPlugins(dirs.skillsDir, pluginsDir);

    const marketplace = await generateMarketplace(pluginsDir, {
      name: "test-marketplace",
      ownerName: "Test Owner",
      pluginRoot: "./plugins",
    });

    const names = marketplace.plugins.map((p) => p.name);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should have all plugin source paths resolvable", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await compileAllSkillPlugins(dirs.skillsDir, pluginsDir);

    const marketplace = await generateMarketplace(pluginsDir, {
      name: "test-marketplace",
      ownerName: "Test Owner",
      pluginRoot: "./plugins",
    });

    for (const plugin of marketplace.plugins) {
      if (typeof plugin.source === "string") {
        const relativePath = plugin.source.replace("./plugins/", "");
        const absolutePath = path.join(pluginsDir, relativePath);

        const exists = await pathExists(absolutePath);
        expect(exists).toBe(true);
      }
    }

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should have plugins sorted alphabetically", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await compileAllSkillPlugins(dirs.skillsDir, pluginsDir);

    const marketplace = await generateMarketplace(pluginsDir, {
      name: "test-marketplace",
      ownerName: "Test Owner",
      pluginRoot: "./plugins",
    });

    const names = marketplace.plugins.map((p) => p.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));

    expect(names).toEqual(sortedNames);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should categorize plugins correctly", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await compileAllSkillPlugins(dirs.skillsDir, pluginsDir);

    const marketplace = await generateMarketplace(pluginsDir, {
      name: "test-marketplace",
      ownerName: "Test Owner",
      pluginRoot: "./plugins",
    });

    const stats = getMarketplaceStats(marketplace);

    // Should have multiple categories (web from web-framework-react, api from api-framework-hono)
    expect(Object.keys(stats.byCategory).length).toBeGreaterThan(1);

    // Categories from our test skills
    const expectedCategories = ["web", "api"];
    for (const category of expectedCategories) {
      expect(stats.byCategory[category]).toBeGreaterThan(0);
    }

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe("Integration: End-to-End Pipeline", () => {
  let dirs: TestDirs;
  let tempDir: string;
  let pluginsDir: string;
  let stacksDir: string;

  beforeEach(async () => {
    // Use stack test skills so both skill and stack pipelines work with same source
    dirs = await createTestSource({ skills: STACK_TEST_SKILLS });
    tempDir = await mkdtemp(path.join(os.tmpdir(), "e2e-pipeline-test-"));
    pluginsDir = path.join(tempDir, "plugins");
    stacksDir = path.join(tempDir, "stacks");
    await mkdir(pluginsDir, { recursive: true });
    await mkdir(stacksDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should compile skills then stacks in sequence", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Step 1: Compile all skills
    const skillResults = await compileAllSkillPlugins(dirs.skillsDir, pluginsDir);
    expect(skillResults.length).toBe(STACK_TEST_SKILLS.length);

    // Step 2: Validate skill plugins
    const skillValidation = await validateAllPlugins(pluginsDir);
    expect(skillValidation.summary.invalid).toBe(0);

    // Step 3: Compile a stack
    const stackResult = await compileStackPlugin({
      stackId: TEST_STACK.id,
      outputDir: stacksDir,
      projectRoot: dirs.sourceDir,
      agentSourcePath: dirs.sourceDir,
      stack: TEST_STACK,
    });
    expect(stackResult.agents.length).toBeGreaterThan(0);

    // Step 4: Validate stack plugin
    const stackValidation = await validatePlugin(stackResult.pluginPath);
    expect(stackValidation.valid).toBe(true);

    // Step 5: Generate marketplace for skills
    const marketplace = await generateMarketplace(pluginsDir, {
      name: "test-marketplace",
      ownerName: "Test Owner",
      pluginRoot: "./plugins",
    });
    expect(marketplace.plugins.length).toBe(skillResults.length);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should have valid skill plugin reference format", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const stackResult = await compileStackPlugin({
      stackId: TEST_STACK.id,
      outputDir: stacksDir,
      projectRoot: dirs.sourceDir,
      agentSourcePath: dirs.sourceDir,
      stack: TEST_STACK,
    });

    expect(stackResult.skillPlugins.length).toBeGreaterThan(0);

    for (const skillPlugin of stackResult.skillPlugins) {
      // Should be in normalized kebab-case format
      expect(skillPlugin).toMatch(/^[a-z0-9-]+$/);
    }

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should compile skills and stacks that share common patterns", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Compile skills
    const skillResults = await compileAllSkillPlugins(dirs.skillsDir, pluginsDir);

    // Compile stack
    const stackResult = await compileStackPlugin({
      stackId: TEST_STACK.id,
      outputDir: stacksDir,
      projectRoot: dirs.sourceDir,
      agentSourcePath: dirs.sourceDir,
      stack: TEST_STACK,
    });

    // Get skill base names from compiled plugins (plugin name = skill ID)
    const extractBaseName = (id: string) => id;

    const stackBaseNames = new Set(stackResult.skillPlugins.map(extractBaseName));
    const compiledBaseNames = new Set(skillResults.map((r) => extractBaseName(r.manifest.name)));

    // There should be overlap between stack skill references and compiled skills
    const commonSkills = [...stackBaseNames].filter((name) => compiledBaseNames.has(name));

    // Expect at least one common skill (e.g., web-framework-react)
    expect(commonSkills.length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
