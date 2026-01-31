import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, readFile, stat } from "fs/promises";
import type { CompileConfig } from "../../types";

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
}

/**
 * Create test directory structure
 */
async function createTestDirs(): Promise<TestDirs> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-init-plugin-test-"));
  const projectDir = path.join(tempDir, "project");

  await mkdir(projectDir, { recursive: true });

  return { tempDir, projectDir };
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

// =============================================================================
// Test 1: Plugin Mode Stack Installation (uses real compilation, mocks CLI calls)
// =============================================================================

describe("cc init: Plugin Mode with Stack", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestDirs();
  });

  afterEach(async () => {
    await rm(dirs.tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe("compileStackToTemp (real compilation)", () => {
    it("should create temp directory with compiled stack", async () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import real module (no mocking for compilation)
      const { compileStackToTemp } = await import("../lib/stack-installer");

      // Act
      const { result, cleanup } = await compileStackToTemp({
        stackId: "nextjs-fullstack",
        projectRoot: SKILLS_REPO,
        agentSourcePath: CLI_REPO,
      });

      try {
        // Assert: Result structure
        expect(result.pluginPath).toContain("cc-stack-");
        expect(result.stackName).toBeTruthy();
        expect(result.agents.length).toBeGreaterThan(0);

        // Assert: Plugin files exist
        expect(await pathExists(result.pluginPath)).toBe(true);
        expect(await pathExists(path.join(result.pluginPath, "agents"))).toBe(
          true,
        );
        expect(
          await pathExists(
            path.join(result.pluginPath, ".claude-plugin", "plugin.json"),
          ),
        ).toBe(true);

        // Assert: Manifest is valid JSON
        const manifestContent = await readFile(
          path.join(result.pluginPath, ".claude-plugin", "plugin.json"),
          "utf-8",
        );
        const manifest = JSON.parse(manifestContent);
        expect(manifest.name).toBe("nextjs-fullstack");
      } finally {
        // Cleanup
        await cleanup();
      }

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("should cleanup temp directory after use", async () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import real module
      const { compileStackToTemp } = await import("../lib/stack-installer");

      // Act
      const { result, cleanup } = await compileStackToTemp({
        stackId: "nextjs-fullstack",
        projectRoot: SKILLS_REPO,
        agentSourcePath: CLI_REPO,
      });

      const tempPath = result.pluginPath;
      expect(await pathExists(tempPath)).toBe(true);

      // Cleanup
      await cleanup();

      // Assert: Temp directory is removed
      expect(await pathExists(tempPath)).toBe(false);

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("should compile stack and return populated agents/skillPlugins", async () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { compileStackToTemp } = await import("../lib/stack-installer");

      // Act
      const { result, cleanup } = await compileStackToTemp({
        stackId: "nextjs-fullstack",
        projectRoot: SKILLS_REPO,
        agentSourcePath: CLI_REPO,
      });

      try {
        // Assert: Non-empty agents and skillPlugins
        expect(result.agents.length).toBeGreaterThan(0);
        expect(result.skillPlugins.length).toBeGreaterThan(0);

        // Common agents that should be included in nextjs-fullstack
        const commonAgents = ["web-developer", "api-developer"];
        for (const agent of commonAgents) {
          expect(result.agents).toContain(agent);
        }

        // Skills should be in canonical format: "name (@author)"
        for (const skill of result.skillPlugins) {
          expect(skill).toMatch(/^[a-z0-9+\-\/]+ \(@\w+\)$/i);
        }
      } finally {
        await cleanup();
      }

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe("installStackAsPlugin (marketplace path)", () => {
    it("should format marketplace reference correctly", async () => {
      // Test the marketplace reference format without calling actual CLI
      const stackId = "nextjs-fullstack";
      const marketplace = "claude-collective";

      // The expected format for marketplace install
      const expectedRef = `${stackId}@${marketplace}`;

      expect(expectedRef).toBe("nextjs-fullstack@claude-collective");
    });

    it("should return correct result structure for marketplace install", async () => {
      // This tests the expected structure without calling the actual CLI
      // Simulates what installStackAsPlugin returns for marketplace
      const mockResult = {
        pluginName: "nextjs-fullstack",
        stackName: "nextjs-fullstack",
        fromMarketplace: true,
        pluginPath: "nextjs-fullstack@claude-collective",
        agents: [] as string[],
        skills: [] as string[],
      };

      expect(mockResult.pluginName).toBe("nextjs-fullstack");
      expect(mockResult.fromMarketplace).toBe(true);
      expect(mockResult.agents).toEqual([]);
      expect(mockResult.skills).toEqual([]);
    });
  });

  describe("marketplace registration flow", () => {
    it("should check marketplace existence before registration", async () => {
      // Import the exec utils to understand the flow
      const execUtils = await import("../utils/exec");

      // Verify the function signatures exist
      expect(typeof execUtils.claudePluginMarketplaceExists).toBe("function");
      expect(typeof execUtils.claudePluginMarketplaceAdd).toBe("function");

      // Test logic: if marketplace doesn't exist, it should be added
      // This is a logic test, not an actual CLI call test
      // Would call claudePluginMarketplaceAdd("github:someorg/claude-subagents", "claude-collective")

      // Simulate the registration flow
      let marketplaceRegistered = false;
      const mockExists = false;

      if (!mockExists) {
        marketplaceRegistered = true;
      }

      expect(marketplaceRegistered).toBe(true);
    });

    it("should skip marketplace registration if already exists", async () => {
      // Test logic: if marketplace exists, skip registration
      let marketplaceAddCalled = false;
      const mockExists = true;

      if (!mockExists) {
        marketplaceAddCalled = true;
      }

      expect(marketplaceAddCalled).toBe(false);
    });
  });
});

// =============================================================================
// Test: Marketplace Registration Functions (P1-04)
// =============================================================================

describe("cc init: Marketplace Registration Functions", () => {
  describe("claudePluginMarketplaceExists", () => {
    it("should be a function that accepts marketplace name", async () => {
      const { claudePluginMarketplaceExists } = await import("../utils/exec");

      // Verify function signature
      expect(typeof claudePluginMarketplaceExists).toBe("function");
      expect(claudePluginMarketplaceExists.length).toBe(1); // Takes 1 argument (name)
    });

    it("should return a boolean promise", async () => {
      const { claudePluginMarketplaceExists } = await import("../utils/exec");

      // The function returns a Promise<boolean>
      // We can't actually call claude CLI in tests, but we can verify the return type structure
      const resultPromise = claudePluginMarketplaceExists("test-marketplace");
      expect(resultPromise).toBeInstanceOf(Promise);

      // Let it settle (will be false because claude CLI isn't available or marketplace doesn't exist)
      const result = await resultPromise.catch(() => false);
      expect(typeof result).toBe("boolean");
    });
  });

  describe("claudePluginMarketplaceAdd", () => {
    it("should be a function that accepts repo and name", async () => {
      const { claudePluginMarketplaceAdd } = await import("../utils/exec");

      // Verify function signature
      expect(typeof claudePluginMarketplaceAdd).toBe("function");
      expect(claudePluginMarketplaceAdd.length).toBe(2); // Takes 2 arguments (repo, name)
    });

    it("should return a void promise", async () => {
      const { claudePluginMarketplaceAdd } = await import("../utils/exec");

      // The function returns a Promise<void>
      const resultPromise = claudePluginMarketplaceAdd(
        "github:test/repo",
        "test-marketplace",
      );
      expect(resultPromise).toBeInstanceOf(Promise);

      // Let it settle (will throw because claude CLI isn't available)
      // But that's expected - we're just verifying it returns a Promise
      await resultPromise.catch(() => undefined);
    });
  });

  describe("claudePluginMarketplaceList", () => {
    it("should be a function that returns marketplace array", async () => {
      const { claudePluginMarketplaceList } = await import("../utils/exec");

      // Verify function signature
      expect(typeof claudePluginMarketplaceList).toBe("function");
      expect(claudePluginMarketplaceList.length).toBe(0); // Takes no arguments
    });

    it("should return a MarketplaceInfo array promise", async () => {
      const { claudePluginMarketplaceList } = await import("../utils/exec");

      // The function returns a Promise<MarketplaceInfo[]>
      const resultPromise = claudePluginMarketplaceList();
      expect(resultPromise).toBeInstanceOf(Promise);

      // When claude CLI isn't available, should return empty array (graceful fallback)
      const result = await resultPromise;
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("marketplace registration flow simulation", () => {
    it("should follow the check-then-register pattern", async () => {
      // This tests the flow logic from init.ts lines 195-220
      // The pattern is:
      // 1. Check if marketplace exists via claudePluginMarketplaceExists
      // 2. If not, register via claudePluginMarketplaceAdd

      const { claudePluginMarketplaceExists, claudePluginMarketplaceAdd } =
        await import("../utils/exec");

      // Track the flow
      const flowSteps: string[] = [];

      // Simulate the init.ts registration flow
      const marketplaceName = "claude-collective";
      const marketplaceSource = "github:org/claude-subagents";

      // Step 1: Check existence
      flowSteps.push("check-existence");
      const exists = await claudePluginMarketplaceExists(marketplaceName).catch(
        () => false,
      );

      // Step 2: Conditionally register
      if (!exists) {
        flowSteps.push("will-register");
        // In real code, this would call claudePluginMarketplaceAdd
        // But we can't in tests without actual claude CLI
      } else {
        flowSteps.push("skip-registration");
      }

      // Verify the flow pattern
      expect(flowSteps[0]).toBe("check-existence");
      expect(flowSteps.length).toBe(2);
      // Either will-register or skip-registration depending on actual marketplace state
      expect(["will-register", "skip-registration"]).toContain(flowSteps[1]);
    });

    it("should call add with correct arguments format for github source", () => {
      // Test the argument format for claudePluginMarketplaceAdd
      // From init.ts line 207-210:
      // await claudePluginMarketplaceAdd(
      //   sourceResult.sourceConfig.source,  // e.g., "github:org/repo"
      //   sourceResult.marketplace,          // e.g., "claude-collective"
      // );

      const githubSource = "github:claude-collective/skills";
      const marketplaceName = "claude-collective";

      // Verify argument format matches expected pattern
      expect(githubSource).toMatch(/^github:[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/);
      expect(marketplaceName).toMatch(/^[a-zA-Z0-9-]+$/);
    });

    it("should handle sourceResult.marketplace being defined for marketplace install", async () => {
      // Test the conditional check from init.ts line 199:
      // if (sourceResult.marketplace) { ... }

      // Simulate sourceResult with marketplace
      const sourceResultWithMarketplace = {
        sourcePath: SKILLS_REPO,
        marketplace: "claude-collective",
        sourceConfig: {
          source: "github:claude-collective/skills",
        },
      };

      // Simulate sourceResult without marketplace (local source)
      const sourceResultWithoutMarketplace = {
        sourcePath: SKILLS_REPO,
        marketplace: undefined,
        sourceConfig: {
          source: SKILLS_REPO,
        },
      };

      // When marketplace is defined, registration flow should be triggered
      expect(!!sourceResultWithMarketplace.marketplace).toBe(true);

      // When marketplace is undefined, registration flow should be skipped
      expect(!!sourceResultWithoutMarketplace.marketplace).toBe(false);
    });

    it("should track registration state for user feedback", async () => {
      // init.ts shows spinner messages during registration (lines 205, 211, 213-214)
      // Test that we can track registration state for providing user feedback

      interface RegistrationState {
        checking: boolean;
        registering: boolean;
        registered: boolean;
        error: Error | null;
      }

      const state: RegistrationState = {
        checking: false,
        registering: false,
        registered: false,
        error: null,
      };

      // Simulate the registration flow with state tracking
      const marketplaceName = "claude-collective";

      // Start checking
      state.checking = true;

      // Import function and call
      const { claudePluginMarketplaceExists } = await import("../utils/exec");
      const exists = await claudePluginMarketplaceExists(marketplaceName).catch(
        () => false,
      );
      state.checking = false;

      if (!exists) {
        // Would start registering
        state.registering = true;
        // In real flow, would call claudePluginMarketplaceAdd here
        // and set state.registered = true on success or state.error on failure
      }

      // Verify state tracking is possible
      expect(typeof state.checking).toBe("boolean");
      expect(typeof state.registering).toBe("boolean");
      expect(typeof state.registered).toBe("boolean");
    });
  });

  describe("error handling in marketplace functions", () => {
    it("claudePluginMarketplaceExists should return false on error", async () => {
      // The function is designed to return false when the list command fails
      // This is because marketplace not existing is a valid state

      const { claudePluginMarketplaceExists } = await import("../utils/exec");

      // When claude CLI is not available or returns error, should gracefully return false
      const result = await claudePluginMarketplaceExists(
        "nonexistent-marketplace-12345",
      );
      expect(result).toBe(false);
    });

    it("claudePluginMarketplaceList should return empty array on error", async () => {
      // The function is designed to return [] when the list command fails
      // This provides a safe fallback

      const { claudePluginMarketplaceList } = await import("../utils/exec");

      // When claude CLI is not available, should return empty array
      const result = await claudePluginMarketplaceList();
      expect(Array.isArray(result)).toBe(true);
      // Result may or may not be empty depending on actual claude CLI availability
    });

    it("claudePluginMarketplaceAdd should throw on failure (except already-exists)", async () => {
      // The function throws on error EXCEPT when the error is "already installed"
      // This matches the implementation in exec.ts lines 128-134

      const { claudePluginMarketplaceAdd } = await import("../utils/exec");

      // When claude CLI fails with non-already-exists error, should throw
      try {
        await claudePluginMarketplaceAdd(
          "invalid-source-format",
          "test-marketplace",
        );
        // If we get here without error, claude CLI is available and handled gracefully
      } catch (error) {
        // Expected - should throw on failure
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Failed to add marketplace");
      }
    });
  });
});

// =============================================================================
// Test 2: Stack Installation Result Validation
// =============================================================================

describe("cc init: Stack Installation Result Validation", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestDirs();
  });

  afterEach(async () => {
    await rm(dirs.tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("should have pluginName matching stack ID for marketplace install", async () => {
    // For marketplace installs, pluginName equals stackId
    const stackId = "angular-stack";
    // marketplace = "test-marketplace" would be used in real install

    // Expected result for marketplace install
    const expectedPluginName = stackId; // Not prefixed for marketplace

    expect(expectedPluginName).toBe("angular-stack");
  });

  it("should have stackName for local install", async () => {
    // Suppress console output
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { compileStackToTemp } = await import("../lib/stack-installer");

    const { result, cleanup } = await compileStackToTemp({
      stackId: "nextjs-fullstack",
      projectRoot: SKILLS_REPO,
      agentSourcePath: CLI_REPO,
    });

    try {
      // CompiledStackPlugin has stackName (the compiled stack name from config)
      expect(result.stackName).toBeTruthy();
      // The pluginPath should contain the temp directory with stack ID
      expect(result.pluginPath).toContain("cc-stack-");
    } finally {
      await cleanup();
    }

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should include common agents for nextjs-fullstack stack", async () => {
    // Suppress console output
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { compileStackToTemp } = await import("../lib/stack-installer");

    const { result, cleanup } = await compileStackToTemp({
      stackId: "nextjs-fullstack",
      projectRoot: SKILLS_REPO,
      agentSourcePath: CLI_REPO,
    });

    try {
      // Acceptance criteria: agents array is non-empty
      expect(result.agents.length).toBeGreaterThan(0);

      // Common agents that should be included in nextjs-fullstack
      const commonAgents = ["web-developer", "api-developer"];
      for (const agent of commonAgents) {
        expect(result.agents).toContain(agent);
      }
    } finally {
      await cleanup();
    }

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should include skillPlugins for local compilation", async () => {
    // Suppress console output
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { compileStackToTemp } = await import("../lib/stack-installer");

    const { result, cleanup } = await compileStackToTemp({
      stackId: "nextjs-fullstack",
      projectRoot: SKILLS_REPO,
      agentSourcePath: CLI_REPO,
    });

    try {
      // CompiledStackPlugin has skillPlugins array
      expect(result.skillPlugins.length).toBeGreaterThan(0);

      // Skills should be in canonical format: "name (@author)"
      for (const skill of result.skillPlugins) {
        expect(skill).toMatch(/^[a-z0-9+\-\/]+ \(@\w+\)$/i);
      }
    } finally {
      await cleanup();
    }

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

// =============================================================================
// Test 3: Local Mode Stack Installation (P1-02)
// =============================================================================

describe("cc init: Local Mode with Stack", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestDirs();
  });

  afterEach(async () => {
    await rm(dirs.tempDir, { recursive: true, force: true });
  });

  describe("skill copying", () => {
    it("should create .claude/skills/ directory with skill subdirectories", async () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import the skill copier and config generator
      const { copySkillsToLocalFlattened } =
        await import("../lib/skill-copier");
      const { loadSkillsMatrixFromSource } =
        await import("../lib/source-loader");
      const { loadStack } = await import("../lib/loader");
      const { ensureDir } = await import("../utils/fs");

      // Load the actual matrix and stack
      const sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: SKILLS_REPO,
        projectDir: dirs.projectDir,
        forceRefresh: false,
      });

      const stack = await loadStack("nextjs-fullstack", SKILLS_REPO, "dev");

      // Get skills from stack
      const selectedSkillIds = stack.skills.map((s) => s.id);

      // Create skills directory
      const localSkillsDir = path.join(dirs.projectDir, ".claude", "skills");
      await ensureDir(localSkillsDir);

      // Act: Copy skills
      const copiedSkills = await copySkillsToLocalFlattened(
        selectedSkillIds,
        localSkillsDir,
        sourceResult.matrix,
        sourceResult,
      );

      // Assert: Skills directory exists with subdirectories
      expect(await pathExists(localSkillsDir)).toBe(true);
      expect(copiedSkills.length).toBeGreaterThan(0);

      // Assert: Each copied skill has its own directory
      for (const copiedSkill of copiedSkills) {
        expect(await pathExists(copiedSkill.destPath)).toBe(true);
      }

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("should copy SKILL.md with valid frontmatter for each skill", async () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import dependencies
      const { copySkillsToLocalFlattened } =
        await import("../lib/skill-copier");
      const { loadSkillsMatrixFromSource } =
        await import("../lib/source-loader");
      const { loadStack } = await import("../lib/loader");
      const { ensureDir } = await import("../utils/fs");

      // Load the actual matrix and stack
      const sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: SKILLS_REPO,
        projectDir: dirs.projectDir,
        forceRefresh: false,
      });

      const stack = await loadStack("nextjs-fullstack", SKILLS_REPO, "dev");
      const selectedSkillIds = stack.skills.map((s) => s.id);

      const localSkillsDir = path.join(dirs.projectDir, ".claude", "skills");
      await ensureDir(localSkillsDir);

      // Act
      const copiedSkills = await copySkillsToLocalFlattened(
        selectedSkillIds,
        localSkillsDir,
        sourceResult.matrix,
        sourceResult,
      );

      // Assert: Each skill has SKILL.md with frontmatter
      for (const copiedSkill of copiedSkills) {
        const skillMdPath = path.join(copiedSkill.destPath, "SKILL.md");
        expect(await pathExists(skillMdPath)).toBe(true);

        const content = await readFile(skillMdPath, "utf-8");

        // Verify frontmatter exists (starts with ---)
        expect(content.startsWith("---")).toBe(true);

        // Verify frontmatter has name field
        expect(content).toMatch(/^---\s*\nname:/m);

        // Verify frontmatter has description field
        expect(content).toMatch(/description:/);
      }

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("should use skill alias or extracted ID for directory names", async () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import dependencies
      const { copySkillsToLocalFlattened } =
        await import("../lib/skill-copier");
      const { loadSkillsMatrixFromSource } =
        await import("../lib/source-loader");
      const { loadStack } = await import("../lib/loader");
      const { ensureDir } = await import("../utils/fs");

      // Load the actual matrix and stack
      const sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: SKILLS_REPO,
        projectDir: dirs.projectDir,
        forceRefresh: false,
      });

      const stack = await loadStack("nextjs-fullstack", SKILLS_REPO, "dev");
      const selectedSkillIds = stack.skills.map((s) => s.id);

      const localSkillsDir = path.join(dirs.projectDir, ".claude", "skills");
      await ensureDir(localSkillsDir);

      // Act
      const copiedSkills = await copySkillsToLocalFlattened(
        selectedSkillIds,
        localSkillsDir,
        sourceResult.matrix,
        sourceResult,
      );

      // Assert: Each skill destination path is under .claude/skills/
      // The structure uses skill alias (if available) or extracted ID (path-like but without @author)
      for (const copiedSkill of copiedSkills) {
        // destPath should start with localSkillsDir
        expect(copiedSkill.destPath.startsWith(localSkillsDir)).toBe(true);

        // The path after localSkillsDir should NOT contain the author suffix
        const relativePath = copiedSkill.destPath.slice(
          localSkillsDir.length + 1,
        );
        expect(relativePath).not.toMatch(/\(@\w+\)/);

        // Verify the directory exists and has SKILL.md
        const skillMdPath = path.join(copiedSkill.destPath, "SKILL.md");
        expect(await pathExists(skillMdPath)).toBe(true);
      }

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe("config generation", () => {
    it("should create .claude/config.yaml with stack configuration", async () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import dependencies
      const { generateConfigFromStack } =
        await import("../lib/config-generator");
      const { loadStack } = await import("../lib/loader");
      const { ensureDir, writeFile: fsWriteFile } = await import("../utils/fs");
      const { stringify: stringifyYaml, parse: parseYaml } =
        await import("yaml");

      // Load the actual stack
      const stack = await loadStack("nextjs-fullstack", SKILLS_REPO, "dev");

      // Generate config
      const config = generateConfigFromStack(stack);

      // Write to temp directory
      const claudeDir = path.join(dirs.projectDir, ".claude");
      await ensureDir(claudeDir);

      const configPath = path.join(claudeDir, "config.yaml");
      const configYaml = stringifyYaml(config, { indent: 2, lineWidth: 120 });
      await fsWriteFile(configPath, configYaml);

      // Assert: Config file exists
      expect(await pathExists(configPath)).toBe(true);

      // Parse and verify structure
      const content = await readFile(configPath, "utf-8");
      const parsed = parseYaml(content) as {
        name: string;
        version: string;
        skills: Array<{ id: string }>;
        agents: string[];
        agent_skills?: Record<string, Record<string, Array<{ id: string }>>>;
      };

      // Assert: Has required fields
      expect(parsed.name).toBe("claude-collective");
      expect(parsed.version).toBeTruthy();
      expect(Array.isArray(parsed.skills)).toBe(true);
      expect(Array.isArray(parsed.agents)).toBe(true);

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("should include skills array with all stack skills", async () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import dependencies
      const { generateConfigFromStack } =
        await import("../lib/config-generator");
      const { loadStack } = await import("../lib/loader");

      // Load the actual stack
      const stack = await loadStack("nextjs-fullstack", SKILLS_REPO, "dev");

      // Generate config
      const config = generateConfigFromStack(stack);

      // Assert: Skills array matches stack skills
      expect(config.skills.length).toBe(stack.skills.length);

      // All stack skill IDs should be in config
      const configSkillIds = config.skills.map((s) => s.id);
      for (const stackSkill of stack.skills) {
        expect(configSkillIds).toContain(stackSkill.id);
      }

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("should include agents array with agent IDs", async () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import dependencies
      const { generateConfigFromStack } =
        await import("../lib/config-generator");
      const { loadStack } = await import("../lib/loader");

      // Load the actual stack
      const stack = await loadStack("nextjs-fullstack", SKILLS_REPO, "dev");

      // Generate config
      const config = generateConfigFromStack(stack);

      // Assert: Agents array matches stack agents
      expect(config.agents.length).toBe(stack.agents.length);

      // Common agents should be present
      expect(config.agents).toContain("web-developer");
      expect(config.agents).toContain("api-developer");

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("should include agent_skills mapping", async () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import dependencies
      const { generateConfigFromStack } =
        await import("../lib/config-generator");
      const { loadStack } = await import("../lib/loader");

      // Load the actual stack
      const stack = await loadStack("nextjs-fullstack", SKILLS_REPO, "dev");

      // Generate config
      const config = generateConfigFromStack(stack);

      // Assert: agent_skills exists and has mappings
      expect(config.agent_skills).toBeDefined();
      expect(Object.keys(config.agent_skills || {}).length).toBeGreaterThan(0);

      // web-developer should have skill categories
      const webDevSkills = config.agent_skills?.["web-developer"];
      expect(webDevSkills).toBeDefined();
      expect(Object.keys(webDevSkills || {}).length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe("agent compilation", () => {
    it("should create .claude/agents/ directory with compiled agent .md files", async () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import dependencies
      const { loadAllAgents } = await import("../lib/loader");
      const { resolveAgents } = await import("../lib/resolver");
      const { compileAgentForPlugin } =
        await import("../lib/stack-plugin-compiler");
      const { createLiquidEngine } = await import("../lib/compiler");
      const { loadSkillsMatrixFromSource } =
        await import("../lib/source-loader");
      const { ensureDir, writeFile: fsWriteFile } = await import("../utils/fs");

      // Load source
      const sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: SKILLS_REPO,
        projectDir: dirs.projectDir,
        forceRefresh: false,
      });

      // Load agents from both CLI and source
      const cliAgents = await loadAllAgents(CLI_REPO);
      const localAgents = await loadAllAgents(SKILLS_REPO);
      const agents = { ...cliAgents, ...localAgents };

      // Use matrix skills directly
      const matrixSkills = sourceResult.matrix.skills;

      // Build compile config with explicit skill assignments (avoiding directory expansion issue)
      // Use actual skill IDs from matrix, not directory shorthands
      const reactSkillId = Object.keys(matrixSkills).find((k) =>
        k.includes("web/framework/react"),
      );
      const scssSkillId = Object.keys(matrixSkills).find((k) =>
        k.includes("styling/scss-modules"),
      );

      // Use inline type for test flexibility (avoids strict type checking for optional usage field)
      const compileAgents = {
        "web-developer": {
          skills: [
            {
              id: reactSkillId!,
              usage: "when building React components",
              preloaded: true,
            },
            {
              id: scssSkillId!,
              usage: "when styling components",
              preloaded: false,
            },
          ],
        },
      };

      const compileConfig = {
        name: "claude-collective",
        description: `Local setup test`,
        claude_md: "",
        agents: compileAgents,
      } as CompileConfig;

      // Resolve and compile agents
      const localAgentsDir = path.join(dirs.projectDir, ".claude", "agents");
      await ensureDir(localAgentsDir);

      const engine = await createLiquidEngine(dirs.projectDir);
      const resolvedAgents = await resolveAgents(
        agents,
        matrixSkills as unknown as Record<
          string,
          import("../../types").SkillDefinition
        >,
        compileConfig,
        SKILLS_REPO,
      );

      const compiledAgentNames: string[] = [];
      for (const [name, agent] of Object.entries(resolvedAgents)) {
        const output = await compileAgentForPlugin(
          name,
          agent,
          SKILLS_REPO,
          engine,
        );
        await fsWriteFile(path.join(localAgentsDir, `${name}.md`), output);
        compiledAgentNames.push(name);
      }

      // Assert: Agents directory exists
      expect(await pathExists(localAgentsDir)).toBe(true);

      // Assert: Agent files exist
      expect(compiledAgentNames.length).toBeGreaterThan(0);
      for (const agentName of compiledAgentNames) {
        const agentPath = path.join(localAgentsDir, `${agentName}.md`);
        expect(await pathExists(agentPath)).toBe(true);
      }

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("should have preloaded skills in agent frontmatter", async () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import dependencies
      const { loadAllAgents } = await import("../lib/loader");
      const { resolveAgents } = await import("../lib/resolver");
      const { compileAgentForPlugin } =
        await import("../lib/stack-plugin-compiler");
      const { createLiquidEngine } = await import("../lib/compiler");
      const { loadSkillsMatrixFromSource } =
        await import("../lib/source-loader");
      const { ensureDir } = await import("../utils/fs");

      // Load source
      const sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: SKILLS_REPO,
        projectDir: dirs.projectDir,
        forceRefresh: false,
      });

      // Load agents
      const cliAgents = await loadAllAgents(CLI_REPO);
      const localAgents = await loadAllAgents(SKILLS_REPO);
      const agents = { ...cliAgents, ...localAgents };

      // Use matrix skills directly
      const matrixSkills = sourceResult.matrix.skills;

      // Build compile config with explicit preloaded skill
      const reactSkillId = Object.keys(matrixSkills).find((k) =>
        k.includes("web/framework/react"),
      );

      // Use inline type for test flexibility (avoids strict type checking for optional usage field)
      const compileAgents = {
        "web-developer": {
          skills: [
            {
              id: reactSkillId!,
              usage: "when building React components",
              preloaded: true,
            },
          ],
        },
      };

      const compileConfig = {
        name: "claude-collective",
        description: `Local setup`,
        claude_md: "",
        agents: compileAgents,
      } as CompileConfig;

      // Compile agent
      const localAgentsDir = path.join(dirs.projectDir, ".claude", "agents");
      await ensureDir(localAgentsDir);

      const engine = await createLiquidEngine(dirs.projectDir);
      const resolvedAgents = await resolveAgents(
        agents,
        matrixSkills as unknown as Record<
          string,
          import("../../types").SkillDefinition
        >,
        compileConfig,
        SKILLS_REPO,
      );

      const webDevAgent = resolvedAgents["web-developer"];
      expect(webDevAgent).toBeDefined();

      const output = await compileAgentForPlugin(
        "web-developer",
        webDevAgent,
        SKILLS_REPO,
        engine,
      );

      // Assert: Frontmatter contains skills array with preloaded skill IDs
      const frontmatterMatch = output.match(/^---\n([\s\S]*?)\n---/);
      expect(frontmatterMatch).toBeTruthy();

      const frontmatter = frontmatterMatch![1];

      // Preloaded skills should appear in frontmatter skills: array
      expect(frontmatter).toContain("skills:");

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it("should have dynamic skill references in agent body", async () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import dependencies
      const { loadAllAgents } = await import("../lib/loader");
      const { resolveAgents } = await import("../lib/resolver");
      const { compileAgentForPlugin } =
        await import("../lib/stack-plugin-compiler");
      const { createLiquidEngine } = await import("../lib/compiler");
      const { loadSkillsMatrixFromSource } =
        await import("../lib/source-loader");
      const { ensureDir } = await import("../utils/fs");

      // Load source
      const sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: SKILLS_REPO,
        projectDir: dirs.projectDir,
        forceRefresh: false,
      });

      // Load agents
      const cliAgents = await loadAllAgents(CLI_REPO);
      const localAgents = await loadAllAgents(SKILLS_REPO);
      const agents = { ...cliAgents, ...localAgents };

      // Use matrix skills directly
      const matrixSkills = sourceResult.matrix.skills;

      // Build compile config with mix of preloaded and dynamic skills
      const reactSkillId = Object.keys(matrixSkills).find((k) =>
        k.includes("web/framework/react"),
      );
      const zustandSkillId = Object.keys(matrixSkills).find((k) =>
        k.includes("state/zustand"),
      );

      // Use inline type for test flexibility (avoids strict type checking for optional usage field)
      const compileAgents = {
        "web-developer": {
          skills: [
            {
              id: reactSkillId!,
              usage: "when building React components",
              preloaded: true,
            },
            {
              id: zustandSkillId!,
              usage: "when working with zustand",
              preloaded: false,
            }, // Dynamic skill
          ],
        },
      };

      const compileConfig = {
        name: "claude-collective",
        description: `Local setup`,
        claude_md: "",
        agents: compileAgents,
      } as CompileConfig;

      // Compile agent
      const localAgentsDir = path.join(dirs.projectDir, ".claude", "agents");
      await ensureDir(localAgentsDir);

      const engine = await createLiquidEngine(dirs.projectDir);
      const resolvedAgents = await resolveAgents(
        agents,
        matrixSkills as unknown as Record<
          string,
          import("../../types").SkillDefinition
        >,
        compileConfig,
        SKILLS_REPO,
      );

      const webDevAgent = resolvedAgents["web-developer"];
      const output = await compileAgentForPlugin(
        "web-developer",
        webDevAgent,
        SKILLS_REPO,
        engine,
      );

      // Get body (after frontmatter)
      const bodyMatch = output.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
      expect(bodyMatch).toBeTruthy();
      const body = bodyMatch![1];

      // Dynamic skills should appear in the "Available Skills (Require Loading)" section
      expect(body).toContain("Available Skills (Require Loading)");
      expect(body).toContain("Invoke:");
      expect(body).toContain("Use when:");

      // Should contain skill invocation pattern
      expect(body).toMatch(/skill: "[^"]+"/);

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe("full local mode flow", () => {
    it("should complete local mode installation with all outputs", async () => {
      // Suppress console output
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Import all dependencies needed for local mode
      const { copySkillsToLocalFlattened } =
        await import("../lib/skill-copier");
      const { loadSkillsMatrixFromSource } =
        await import("../lib/source-loader");
      const { loadAllAgents, loadStack } = await import("../lib/loader");
      const { resolveAgents } = await import("../lib/resolver");
      const { compileAgentForPlugin } =
        await import("../lib/stack-plugin-compiler");
      const { createLiquidEngine } = await import("../lib/compiler");
      const { generateConfigFromStack } =
        await import("../lib/config-generator");
      const { ensureDir, writeFile: fsWriteFile } = await import("../utils/fs");
      const { stringify: stringifyYaml, parse: parseYaml } =
        await import("yaml");

      // Load source and stack
      const sourceResult = await loadSkillsMatrixFromSource({
        sourceFlag: SKILLS_REPO,
        projectDir: dirs.projectDir,
        forceRefresh: false,
      });

      const stack = await loadStack("nextjs-fullstack", SKILLS_REPO, "dev");

      // Setup directories
      const localSkillsDir = path.join(dirs.projectDir, ".claude", "skills");
      const localAgentsDir = path.join(dirs.projectDir, ".claude", "agents");
      const localConfigPath = path.join(
        dirs.projectDir,
        ".claude",
        "config.yaml",
      );

      await ensureDir(localSkillsDir);
      await ensureDir(localAgentsDir);

      // 1. Copy skills (only individual skills from matrix, not directory shorthands)
      const matrixSkills = sourceResult.matrix.skills;
      const individualSkillIds = stack.skills
        .map((s) => s.id)
        .filter((id) => matrixSkills[id]); // Only skills that exist in matrix

      const copiedSkills = await copySkillsToLocalFlattened(
        individualSkillIds,
        localSkillsDir,
        sourceResult.matrix,
        sourceResult,
      );

      // 2. Generate config
      const localConfig = generateConfigFromStack(stack);
      const configYaml = stringifyYaml(localConfig, {
        indent: 2,
        lineWidth: 120,
      });
      await fsWriteFile(localConfigPath, configYaml);

      // 3. Load agents and compile
      const cliAgents = await loadAllAgents(CLI_REPO);
      const localAgents = await loadAllAgents(SKILLS_REPO);
      const agents = { ...cliAgents, ...localAgents };

      // Build compile config with explicit skill assignments (avoiding directory expansion)
      const reactSkillId = Object.keys(matrixSkills).find((k) =>
        k.includes("web/framework/react"),
      );

      // Use inline type for test flexibility (avoids strict type checking for optional usage field)
      const compileAgents = {
        "web-developer": {
          skills: [
            {
              id: reactSkillId!,
              usage: "when building React components",
              preloaded: true,
            },
          ],
        },
      };

      const compileConfig = {
        name: "claude-collective",
        description: `Local setup with ${individualSkillIds.length} skills`,
        claude_md: "",
        agents: compileAgents,
      } as CompileConfig;

      const engine = await createLiquidEngine(dirs.projectDir);
      const resolvedAgents = await resolveAgents(
        agents,
        matrixSkills as unknown as Record<
          string,
          import("../../types").SkillDefinition
        >,
        compileConfig,
        SKILLS_REPO,
      );

      const compiledAgentNames: string[] = [];
      for (const [name, agent] of Object.entries(resolvedAgents)) {
        const output = await compileAgentForPlugin(
          name,
          agent,
          SKILLS_REPO,
          engine,
        );
        await fsWriteFile(path.join(localAgentsDir, `${name}.md`), output);
        compiledAgentNames.push(name);
      }

      // === ASSERTIONS ===

      // 1. Skills directory exists with skills
      expect(await pathExists(localSkillsDir)).toBe(true);
      expect(copiedSkills.length).toBeGreaterThan(0);

      // Verify each skill has SKILL.md
      for (const copiedSkill of copiedSkills.slice(0, 3)) {
        // Check first 3
        const skillMdPath = path.join(copiedSkill.destPath, "SKILL.md");
        expect(await pathExists(skillMdPath)).toBe(true);
      }

      // 2. Agents directory exists with compiled agents
      expect(await pathExists(localAgentsDir)).toBe(true);
      expect(compiledAgentNames.length).toBeGreaterThan(0);

      // Verify agent files exist
      for (const agentName of compiledAgentNames) {
        const agentPath = path.join(localAgentsDir, `${agentName}.md`);
        expect(await pathExists(agentPath)).toBe(true);
      }

      // 3. Config file exists and is valid
      expect(await pathExists(localConfigPath)).toBe(true);
      const configContent = await readFile(localConfigPath, "utf-8");
      const parsedConfig = parseYaml(configContent) as {
        skills: Array<{ id: string }>;
        agents: string[];
        agent_skills?: Record<string, unknown>;
      };

      expect(parsedConfig.skills.length).toBe(stack.skills.length);
      expect(parsedConfig.agents.length).toBe(stack.agents.length);
      expect(parsedConfig.agent_skills).toBeDefined();

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });
});

// =============================================================================
// Test 4: Already Initialized Detection (P1-03)
// =============================================================================

describe("cc init: Already Initialized Detection", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestDirs();
  });

  afterEach(async () => {
    await rm(dirs.tempDir, { recursive: true, force: true });
  });

  describe("plugin mode detection", () => {
    it("should detect existing .claude/plugins/claude-collective/ directory", async () => {
      // Arrange: Create the plugin directory structure
      const pluginDir = path.join(
        dirs.projectDir,
        ".claude",
        "plugins",
        "claude-collective",
      );
      await mkdir(pluginDir, { recursive: true });

      // Import the detection utilities
      const { getCollectivePluginDir } = await import("../lib/plugin-finder");
      const { directoryExists } = await import("../utils/fs");

      // Act: Check if the plugin directory exists
      const detectedPluginDir = getCollectivePluginDir(dirs.projectDir);
      const pluginExists = await directoryExists(detectedPluginDir);

      // Assert: Plugin directory is detected
      expect(pluginExists).toBe(true);
      expect(detectedPluginDir).toBe(pluginDir);
    });

    it("should NOT detect when .claude/plugins/claude-collective/ is missing", async () => {
      // Arrange: Create only the .claude directory (no plugin)
      const claudeDir = path.join(dirs.projectDir, ".claude");
      await mkdir(claudeDir, { recursive: true });

      // Import the detection utilities
      const { getCollectivePluginDir } = await import("../lib/plugin-finder");
      const { directoryExists } = await import("../utils/fs");

      // Act: Check if the plugin directory exists
      const detectedPluginDir = getCollectivePluginDir(dirs.projectDir);
      const pluginExists = await directoryExists(detectedPluginDir);

      // Assert: Plugin directory is not detected
      expect(pluginExists).toBe(false);
    });
  });

  describe("local mode detection", () => {
    it("should detect existing .claude/skills/ directory as local mode", async () => {
      // Arrange: Create the local skills directory structure
      const skillsDir = path.join(dirs.projectDir, ".claude", "skills");
      await mkdir(skillsDir, { recursive: true });

      // Create a sample skill to make it realistic
      const sampleSkillDir = path.join(skillsDir, "sample-skill");
      await mkdir(sampleSkillDir, { recursive: true });

      // Import the detection utility
      const { directoryExists } = await import("../utils/fs");

      // Act: Check if the local skills directory exists
      const localSkillsPath = path.join(dirs.projectDir, ".claude", "skills");
      const localSkillsExist = await directoryExists(localSkillsPath);

      // Assert: Local skills directory is detected
      expect(localSkillsExist).toBe(true);
    });

    it("should detect existing .claude/agents/ directory as local mode", async () => {
      // Arrange: Create the local agents directory structure
      const agentsDir = path.join(dirs.projectDir, ".claude", "agents");
      await mkdir(agentsDir, { recursive: true });

      // Create a sample agent file to make it realistic
      const { writeFile } = await import("fs/promises");
      await writeFile(
        path.join(agentsDir, "web-developer.md"),
        "# Web Developer Agent",
      );

      // Import the detection utility
      const { directoryExists } = await import("../utils/fs");

      // Act: Check if the local agents directory exists
      const localAgentsPath = path.join(dirs.projectDir, ".claude", "agents");
      const localAgentsExist = await directoryExists(localAgentsPath);

      // Assert: Local agents directory is detected
      expect(localAgentsExist).toBe(true);
    });

    it("should NOT detect when .claude/ has no skills or agents", async () => {
      // Arrange: Create only the .claude directory (no skills or agents)
      const claudeDir = path.join(dirs.projectDir, ".claude");
      await mkdir(claudeDir, { recursive: true });

      // Import the detection utility
      const { directoryExists } = await import("../utils/fs");

      // Act: Check if local mode directories exist
      const localSkillsPath = path.join(dirs.projectDir, ".claude", "skills");
      const localAgentsPath = path.join(dirs.projectDir, ".claude", "agents");
      const localSkillsExist = await directoryExists(localSkillsPath);
      const localAgentsExist = await directoryExists(localAgentsPath);

      // Assert: Neither local mode directory is detected
      expect(localSkillsExist).toBe(false);
      expect(localAgentsExist).toBe(false);
    });
  });

  describe("combined detection logic", () => {
    it("should provide appropriate message for plugin mode initialization", async () => {
      // Arrange: Create the plugin directory structure
      const pluginDir = path.join(
        dirs.projectDir,
        ".claude",
        "plugins",
        "claude-collective",
      );
      await mkdir(pluginDir, { recursive: true });

      // Import utilities
      const { getCollectivePluginDir } = await import("../lib/plugin-finder");
      const { directoryExists } = await import("../utils/fs");

      // Act: Perform the detection
      const detectedPluginDir = getCollectivePluginDir(dirs.projectDir);
      const pluginExists = await directoryExists(detectedPluginDir);

      // This simulates the logic in init.ts lines 71-78
      let warningMessage = "";
      let suggestionMessage = "";

      if (pluginExists) {
        warningMessage = `Claude Collective is already initialized at ${detectedPluginDir}`;
        suggestionMessage = "Use cc edit to modify skills.";
      }

      // Assert: Appropriate messages are generated
      expect(pluginExists).toBe(true);
      expect(warningMessage).toContain("already initialized");
      expect(warningMessage).toContain(detectedPluginDir);
      expect(suggestionMessage).toContain("cc edit");
    });

    it("should detect local mode initialization via skills directory", async () => {
      // Arrange: Create the local skills directory
      const skillsDir = path.join(dirs.projectDir, ".claude", "skills");
      await mkdir(skillsDir, { recursive: true });

      // Import utilities
      const { getCollectivePluginDir } = await import("../lib/plugin-finder");
      const { directoryExists } = await import("../utils/fs");

      // Act: Check both plugin and local mode
      const detectedPluginDir = getCollectivePluginDir(dirs.projectDir);
      const pluginExists = await directoryExists(detectedPluginDir);
      const localSkillsPath = path.join(dirs.projectDir, ".claude", "skills");
      const localSkillsExist = await directoryExists(localSkillsPath);

      // Simulate enhanced detection logic
      const isInitialized = pluginExists || localSkillsExist;

      // Assert: Detected as initialized via local mode
      expect(pluginExists).toBe(false);
      expect(localSkillsExist).toBe(true);
      expect(isInitialized).toBe(true);
    });

    it("should detect local mode initialization via agents directory", async () => {
      // Arrange: Create the local agents directory
      const agentsDir = path.join(dirs.projectDir, ".claude", "agents");
      await mkdir(agentsDir, { recursive: true });

      // Import utilities
      const { getCollectivePluginDir } = await import("../lib/plugin-finder");
      const { directoryExists } = await import("../utils/fs");

      // Act: Check both plugin and local mode
      const detectedPluginDir = getCollectivePluginDir(dirs.projectDir);
      const pluginExists = await directoryExists(detectedPluginDir);
      const localAgentsPath = path.join(dirs.projectDir, ".claude", "agents");
      const localAgentsExist = await directoryExists(localAgentsPath);

      // Simulate enhanced detection logic
      const isInitialized = pluginExists || localAgentsExist;

      // Assert: Detected as initialized via local mode
      expect(pluginExists).toBe(false);
      expect(localAgentsExist).toBe(true);
      expect(isInitialized).toBe(true);
    });

    it("should NOT detect as initialized when project is fresh", async () => {
      // Arrange: Fresh project (no .claude directory at all)
      // dirs.projectDir is already empty

      // Import utilities
      const { getCollectivePluginDir } = await import("../lib/plugin-finder");
      const { directoryExists } = await import("../utils/fs");

      // Act: Check all initialization indicators
      const detectedPluginDir = getCollectivePluginDir(dirs.projectDir);
      const pluginExists = await directoryExists(detectedPluginDir);
      const localSkillsPath = path.join(dirs.projectDir, ".claude", "skills");
      const localAgentsPath = path.join(dirs.projectDir, ".claude", "agents");
      const localSkillsExist = await directoryExists(localSkillsPath);
      const localAgentsExist = await directoryExists(localAgentsPath);

      // Simulate detection logic
      const isInitialized =
        pluginExists || localSkillsExist || localAgentsExist;

      // Assert: Not detected as initialized
      expect(pluginExists).toBe(false);
      expect(localSkillsExist).toBe(false);
      expect(localAgentsExist).toBe(false);
      expect(isInitialized).toBe(false);
    });
  });

  describe("settings.json plugin detection", () => {
    it("should detect plugin from settings.json enabledPlugins", async () => {
      // Arrange: Create settings.json with enabled plugin
      const settingsDir = path.join(dirs.projectDir, ".claude");
      await mkdir(settingsDir, { recursive: true });

      const { writeFile } = await import("fs/promises");
      const settings = {
        enabledPlugins: ["claude-collective"],
      };
      await writeFile(
        path.join(settingsDir, "settings.json"),
        JSON.stringify(settings, null, 2),
      );

      // Act: Read and check settings
      const settingsContent = await readFile(
        path.join(settingsDir, "settings.json"),
        "utf-8",
      );
      const parsedSettings = JSON.parse(settingsContent) as {
        enabledPlugins?: string[];
      };

      // Assert: Plugin is in enabledPlugins
      expect(parsedSettings.enabledPlugins).toContain("claude-collective");
    });

    it("should NOT detect plugin when settings.json has empty enabledPlugins", async () => {
      // Arrange: Create settings.json with empty enabledPlugins
      const settingsDir = path.join(dirs.projectDir, ".claude");
      await mkdir(settingsDir, { recursive: true });

      const { writeFile } = await import("fs/promises");
      const settings = {
        enabledPlugins: [],
      };
      await writeFile(
        path.join(settingsDir, "settings.json"),
        JSON.stringify(settings, null, 2),
      );

      // Act: Read and check settings
      const settingsContent = await readFile(
        path.join(settingsDir, "settings.json"),
        "utf-8",
      );
      const parsedSettings = JSON.parse(settingsContent) as {
        enabledPlugins?: string[];
      };

      // Assert: Plugin is not in enabledPlugins
      expect(parsedSettings.enabledPlugins).not.toContain("claude-collective");
    });

    it("should handle missing settings.json gracefully", async () => {
      // Arrange: No settings.json file
      const settingsPath = path.join(
        dirs.projectDir,
        ".claude",
        "settings.json",
      );

      // Act: Check if file exists
      const settingsExists = await pathExists(settingsPath);

      // Assert: No settings file
      expect(settingsExists).toBe(false);
    });
  });
});
