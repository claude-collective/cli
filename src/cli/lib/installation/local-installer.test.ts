import { mkdir, writeFile, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installLocal,
  writeScopedConfigs,
  resolveInstallPaths,
  buildLocalSkillsMap,
  buildCompileAgents,
  buildAgentScopeMap,
  setConfigMetadata,
} from "./local-installer";
import type { AgentConfig, AgentDefinition, AgentName, ProjectConfig, SkillId } from "../../types";
import { initializeMatrix } from "../matrix/matrix-provider";
import {
  buildWizardResult,
  buildSkillConfigs,
  buildProjectConfig,
  buildSourceResult,
  createMockSkill,
  createMockAgent,
  createTempDir,
  cleanupTempDir,
  readTestTsConfig,
  buildAgentConfigs,
  createMockMatrix,
} from "../__tests__/helpers";
import { SKILLS } from "../__tests__/test-fixtures";
import { EMPTY_MATRIX, SINGLE_REACT_MATRIX } from "../__tests__/mock-data/mock-matrices";
import {
  CLAUDE_DIR,
  CLAUDE_SRC_DIR,
  DEFAULT_PLUGIN_NAME,
  LOCAL_SKILLS_PATH,
  STANDARD_FILES,
} from "../../consts";
import { generateConfigSource } from "../configuration/config-writer";

// Mock heavy dependencies that involve file system operations outside our temp dir
vi.mock("../skills/skill-copier", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../skills/skill-copier")>()),
  copySkillsToLocalFlattened: vi.fn().mockResolvedValue([]),
}));

vi.mock("../loading/loader", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../loading/loader")>()),
  loadAllAgents: vi.fn().mockResolvedValue({}),
}));

vi.mock("../stacks/stacks-loader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../stacks/stacks-loader")>();
  return {
    ...actual,
    loadStackById: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("../resolver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../resolver")>()),
  resolveAgents: vi.fn().mockResolvedValue({}),
  buildSkillRefsFromConfig: vi.fn().mockReturnValue([]),
}));

vi.mock("../stacks/stack-plugin-compiler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../stacks/stack-plugin-compiler")>()),
  compileAgentForPlugin: vi.fn().mockResolvedValue("# compiled agent content"),
}));

vi.mock("../compiler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../compiler")>()),
  createLiquidEngine: vi.fn().mockResolvedValue({}),
}));

vi.mock("../configuration/config-generator", async (importOriginal) => {
  const original = await importOriginal<typeof import("../configuration/config-generator")>();
  return {
    generateProjectConfigFromSkills: vi.fn().mockReturnValue({
      // Uses literal values because vi.mock factories are hoisted above imports
      name: "agents-inc",
      agents: ["web-developer"],
      skills: [{ id: "test-skill", scope: "project", source: "local" }],
    }),
    buildStackProperty: vi.fn().mockReturnValue({}),
    // Use real compactStackForYaml so configs with stack properties serialize correctly
    compactStackForYaml: original.compactStackForYaml,
    // Use real splitConfigByScope for scope-aware config writing
    splitConfigByScope: original.splitConfigByScope,
  };
});

// Access the mock to verify installMode is passed through
const mockCompileAgentForPlugin = vi.mocked(
  (await import("../stacks/stack-plugin-compiler")).compileAgentForPlugin,
);

// Boundary cast: fictional skill ID used throughout local-installer tests
const TEST_SKILL_ID = "meta-test-skill" as SkillId;

describe("local-installer", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("cc-local-installer-test-");
    initializeMatrix(EMPTY_MATRIX);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
    // Clean global config files written by writeScopedConfigs to the mocked home dir
    const globalClaudeSrc = path.join(os.homedir(), CLAUDE_SRC_DIR);
    await rm(globalClaudeSrc, { recursive: true, force: true }).catch(() => {});
  });

  describe("installLocal", () => {
    it("should create required directories", async () => {
      const matrix = EMPTY_MATRIX;
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]));
      const sourceResult = buildSourceResult(matrix, tempDir);

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      // Verify directories were created
      const { fileExists } = await import("../../utils/fs");
      expect(await fileExists(path.join(tempDir, CLAUDE_DIR, "skills"))).toBe(true);
      expect(await fileExists(path.join(tempDir, CLAUDE_DIR, "agents"))).toBe(true);
      expect(await fileExists(path.join(tempDir, CLAUDE_SRC_DIR))).toBe(true);
    });

    it("should write config to .claude-src/config.ts", async () => {
      const matrix = EMPTY_MATRIX;
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]));
      const sourceResult = buildSourceResult(matrix, tempDir);

      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      // Verify config was written
      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const config = await readTestTsConfig<ProjectConfig>(configPath);

      expect(config.name).toBe(DEFAULT_PLUGIN_NAME);
      expect(result.configPath).toBe(configPath);
    });

    it("should include source in config from sourceFlag", async () => {
      const matrix = EMPTY_MATRIX;
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]));
      const sourceResult = buildSourceResult(matrix, tempDir);

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
        sourceFlag: "github:my-org/skills",
      });

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const config = await readTestTsConfig<ProjectConfig>(configPath);

      expect(config.source).toBe("github:my-org/skills");
    });

    it("should include source from sourceResult when no sourceFlag", async () => {
      const matrix = EMPTY_MATRIX;
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]));
      const sourceResult = buildSourceResult(matrix, tempDir, {
        sourceConfig: {
          source: "github:default/source",
          sourceOrigin: "project",
        },
      });

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const config = await readTestTsConfig<ProjectConfig>(configPath);

      expect(config.source).toBe("github:default/source");
    });

    it("should include marketplace in config when available", async () => {
      const matrix = EMPTY_MATRIX;
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]));
      const sourceResult = buildSourceResult(matrix, tempDir, {
        marketplace: "my-marketplace",
      });

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const config = await readTestTsConfig<ProjectConfig>(configPath);

      expect(config.marketplace).toBe("my-marketplace");
    });

    it("should return correct result structure", async () => {
      const matrix = EMPTY_MATRIX;
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]));
      const sourceResult = buildSourceResult(matrix, tempDir);

      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      expect(result.copiedSkills).toBeDefined();
      expect(result.config).toBeDefined();
      expect(result.configPath).toContain(path.join(CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS));
      expect(result.compiledAgents).toBeDefined();
      expect(typeof result.wasMerged).toBe("boolean");
      expect(result.skillsDir).toContain(path.join(CLAUDE_DIR, "skills"));
      expect(result.agentsDir).toContain(path.join(CLAUDE_DIR, "agents"));
    });

    it("should merge with existing config when present", async () => {
      // Write an existing config in TS format
      const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
      await mkdir(configDir, { recursive: true });
      // Boundary cast: test provides a synthetic agent name not in the AgentName union
      await writeFile(
        path.join(configDir, STANDARD_FILES.CONFIG_TS),
        generateConfigSource({
          name: "existing-project",
          agents: [{ name: "existing-agent" as AgentName, scope: "project" as const }],
          skills: [],
          author: "@existing",
        }),
      );

      const matrix = EMPTY_MATRIX;
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]));
      const sourceResult = buildSourceResult(matrix, tempDir);

      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      expect(result.wasMerged).toBe(true);
      expect(result.mergedConfigPath).toBeDefined();
      // Existing name should take precedence
      expect(result.config.name).toBe("existing-project");
      // Existing author should be preserved
      expect(result.config.author).toBe("@existing");
    });

    it("should derive local installMode from skill configs", async () => {
      const matrix = EMPTY_MATRIX;
      const wizardResult = buildWizardResult(
        buildSkillConfigs([TEST_SKILL_ID], { source: "local" }),
      );
      const sourceResult = buildSourceResult(matrix, tempDir);

      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      // installMode is derived from skills at runtime, not stored on config
      expect(result.config.skills.every((s) => s.source === "local")).toBe(true);
    });

    it("should not set wasMerged when no existing config", async () => {
      const matrix = EMPTY_MATRIX;
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]));
      const sourceResult = buildSourceResult(matrix, tempDir);

      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      expect(result.wasMerged).toBe(false);
      expect(result.mergedConfigPath).toBeUndefined();
    });

    it("should pass installMode to compileAgentForPlugin", async () => {
      // resolveAgents returns one agent so compileAgentForPlugin gets called
      const mockResolveAgents = vi.mocked((await import("../resolver")).resolveAgents);
      // Boundary cast: test provides partial agents record; mock only needs the test agent
      mockResolveAgents.mockResolvedValueOnce({
        "web-developer": {
          name: "web-developer",
          title: "Web Dev",
          description: "A dev",
          tools: ["Read"],
          skills: [],
        },
      } as unknown as Record<AgentName, AgentConfig>);

      // Override generateProjectConfigFromSkills to return plugin-sourced skills
      const mockGenerateConfig = vi.mocked(
        (await import("../configuration/config-generator")).generateProjectConfigFromSkills,
      );
      mockGenerateConfig.mockReturnValueOnce(
        buildProjectConfig({
          name: "agents-inc",
          skills: buildSkillConfigs([TEST_SKILL_ID], { source: "agents-inc" }),
        }),
      );

      const matrix = EMPTY_MATRIX;
      const wizardResult = buildWizardResult(
        buildSkillConfigs([TEST_SKILL_ID], { source: "agents-inc" }),
      );
      const sourceResult = buildSourceResult(matrix, tempDir);

      mockCompileAgentForPlugin.mockClear();

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      // compileAgentForPlugin should have been called with installMode as the 5th arg
      // deriveInstallMode returns "plugin" when all skills have non-local source
      expect(mockCompileAgentForPlugin).toHaveBeenCalledWith(
        "web-developer",
        expect.any(Object),
        expect.any(String),
        expect.any(Object),
        "plugin",
      );
    });

    it("should pass local installMode to compileAgentForPlugin", async () => {
      const mockResolveAgents = vi.mocked((await import("../resolver")).resolveAgents);
      // Boundary cast: test provides partial agents record; mock only needs the test agent
      mockResolveAgents.mockResolvedValueOnce({
        "web-developer": {
          name: "web-developer",
          title: "Web Dev",
          description: "A dev",
          tools: ["Read"],
          skills: [],
        },
      } as unknown as Record<AgentName, AgentConfig>);

      const matrix = EMPTY_MATRIX;
      const wizardResult = buildWizardResult(
        buildSkillConfigs([TEST_SKILL_ID], { source: "local" }),
      );
      const sourceResult = buildSourceResult(matrix, tempDir);

      mockCompileAgentForPlugin.mockClear();

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      expect(mockCompileAgentForPlugin).toHaveBeenCalledWith(
        "web-developer",
        expect.any(Object),
        expect.any(String),
        expect.any(Object),
        "local",
      );
    });

    it("should write valid config with satisfies ProjectConfig", async () => {
      const matrix = EMPTY_MATRIX;
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]));
      const sourceResult = buildSourceResult(matrix, tempDir);

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const configContent = await readFile(configPath, "utf-8");

      // Should use plain object export with satisfies
      expect(configContent).not.toContain("defineConfig");
      expect(configContent).toContain("export default {");
      expect(configContent).toContain("satisfies ProjectConfig");

      // Should parse back to a valid config
      const config = await readTestTsConfig<ProjectConfig>(configPath);
      expect(config.name).toBe(DEFAULT_PLUGIN_NAME);
    });

    it("should preserve preloaded flags from stack skill assignments", async () => {
      const mockLoadStackById = vi.mocked((await import("../stacks/stacks-loader")).loadStackById);
      const mockGenerateConfig = vi.mocked(
        (await import("../configuration/config-generator")).generateProjectConfigFromSkills,
      );
      const mockBuildStackProperty = vi.mocked(
        (await import("../configuration/config-generator")).buildStackProperty,
      );

      // Stack defines a skill with preloaded: true
      mockLoadStackById.mockResolvedValueOnce({
        id: "test-stack",
        name: "Test Stack",
        description: "A test stack",
        agents: {
          "web-developer": {
            "web-framework": [{ id: "web-framework-react", preloaded: true }],
          },
        },
      });

      // generateProjectConfigFromSkills hardcodes preloaded: false (the bug)
      mockGenerateConfig.mockReturnValueOnce(
        buildProjectConfig({
          name: "agents-inc",
          skills: buildSkillConfigs(["web-framework-react"]),
          stack: {
            "web-developer": {
              "web-framework": [{ id: "web-framework-react", preloaded: false }],
            },
          },
        }),
      );

      // buildStackProperty extracts stack data preserving preloaded: true
      mockBuildStackProperty.mockReturnValueOnce({
        "web-developer": {
          "web-framework": [{ id: "web-framework-react", preloaded: true }],
        },
      });

      const matrix = EMPTY_MATRIX;
      const wizardResult = buildWizardResult(buildSkillConfigs(["web-framework-react"]), {
        selectedStackId: "test-stack",
      });
      const sourceResult = buildSourceResult(matrix, tempDir);

      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      // Verify preloaded: true survived into the final config
      const webDevStack = result.config.stack?.["web-developer"];
      expect(webDevStack).toBeDefined();
      const frameworkAssignments = webDevStack?.["web-framework"];
      expect(frameworkAssignments).toBeDefined();
      expect(frameworkAssignments).toHaveLength(1);
      expect(frameworkAssignments![0].id).toBe("web-framework-react");
      expect(frameworkAssignments![0].preloaded).toBe(true);

      // Also verify it's written correctly to the config file
      const configPath = path.join(tempDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const parsedConfig = await readTestTsConfig<ProjectConfig>(configPath);
      // compactStackForYaml converts preloaded: true to { id, preloaded: true } object form
      const parsedWebDev = parsedConfig.stack?.["web-developer"] as Record<string, unknown>;
      expect(parsedWebDev?.["web-framework"]).toEqual({
        id: "web-framework-react",
        preloaded: true,
      });
    });
  });

  describe("writeScopedConfigs", () => {
    // Boundary cast: empty agents record for tests that don't need agent definitions
    const emptyAgents = {} as Record<AgentName, AgentDefinition>;

    it("should skip project config when no existing project installation and no project-scoped items", async () => {
      // Setup: all items are global-scoped, so project split will be empty.
      // No project installation exists, so project config should be skipped.
      const config = buildProjectConfig({
        skills: [{ id: "web-framework-react", scope: "global", source: "agents-inc" }],
        agents: [{ name: "web-developer", scope: "global" }],
      });

      const projectDir = path.join(tempDir, "project-dir");
      const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);

      // Ensure project .claude-src/ directory exists but do NOT create config.ts
      await mkdir(path.dirname(projectConfigPath), { recursive: true });

      await writeScopedConfigs(
        config,
        EMPTY_MATRIX,
        emptyAgents,
        projectDir,
        projectConfigPath,
        false, // no existing project installation
      );

      // Global config should be written
      const globalConfigPath = path.join(os.homedir(), CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const { fileExists } = await import("../../utils/fs");
      expect(await fileExists(globalConfigPath)).toBe(true);

      // Project config should NOT be written (no existing config and no project-scoped items)
      expect(await fileExists(projectConfigPath)).toBe(false);
    });

    it("should write project config when project split has skills", async () => {
      const config = buildProjectConfig({
        skills: [
          { id: "web-framework-react", scope: "global", source: "agents-inc" },
          { id: "web-testing-vitest", scope: "project", source: "local" },
        ],
        agents: [
          { name: "web-developer", scope: "global" },
          { name: "web-reviewer", scope: "project" },
        ],
      });

      const projectDir = path.join(tempDir, "project-dir");
      const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      await mkdir(path.dirname(projectConfigPath), { recursive: true });

      await writeScopedConfigs(
        config,
        EMPTY_MATRIX,
        emptyAgents,
        projectDir,
        projectConfigPath,
        false, // no existing project installation, but project-scoped items exist
      );

      // Both global and project configs should be written
      const globalConfigPath = path.join(os.homedir(), CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const { fileExists } = await import("../../utils/fs");
      expect(await fileExists(globalConfigPath)).toBe(true);
      expect(await fileExists(projectConfigPath)).toBe(true);

      // Project config should contain the project-scoped skill
      const projectContent = await readFile(projectConfigPath, "utf-8");
      expect(projectContent).toContain("web-testing-vitest");
    });
  });

  describe("resolveInstallPaths", () => {
    it("should resolve project-scope paths relative to projectDir", () => {
      const result = resolveInstallPaths("/my/project", "project");

      expect(result.skillsDir).toBe(`/my/project/${LOCAL_SKILLS_PATH}`);
      expect(result.agentsDir).toBe(`/my/project/${CLAUDE_DIR}/agents`);
      expect(result.configPath).toBe(`/my/project/${CLAUDE_SRC_DIR}/${STANDARD_FILES.CONFIG_TS}`);
    });

    it("should resolve global-scope paths relative to home directory", () => {
      const homeDir = os.homedir();
      const result = resolveInstallPaths("/my/project", "global");

      expect(result.skillsDir).toBe(path.join(homeDir, LOCAL_SKILLS_PATH));
      expect(result.agentsDir).toBe(path.join(homeDir, CLAUDE_DIR, "agents"));
      expect(result.configPath).toBe(path.join(homeDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS));
    });

    it("should default to project scope when no scope argument provided", () => {
      const result = resolveInstallPaths("/my/project");

      expect(result.skillsDir).toBe(`/my/project/${LOCAL_SKILLS_PATH}`);
      expect(result.agentsDir).toBe(`/my/project/${CLAUDE_DIR}/agents`);
      expect(result.configPath).toBe(`/my/project/${CLAUDE_SRC_DIR}/${STANDARD_FILES.CONFIG_TS}`);
    });
  });

  describe("buildLocalSkillsMap", () => {
    it("should map copied skills that exist in the matrix", () => {
      initializeMatrix(SINGLE_REACT_MATRIX);

      const copiedSkills = [
        {
          skillId: "web-framework-react" as SkillId,
          contentHash: "abc123",
          sourcePath: "/source/skills/react",
          destPath: "/project/.claude/skills/web-framework-react",
        },
      ];

      const result = buildLocalSkillsMap(copiedSkills);

      expect(result["web-framework-react"]).toBeDefined();
      expect(result["web-framework-react"]!.id).toBe("web-framework-react");
      expect(result["web-framework-react"]!.description).toBe(
        SINGLE_REACT_MATRIX.skills["web-framework-react"]!.description,
      );
      expect(result["web-framework-react"]!.path).toBe(
        "/project/.claude/skills/web-framework-react",
      );
      expect(result["web-framework-react"]!.content).toBe("");
    });

    it("should filter out copied skills not in the matrix", () => {
      initializeMatrix(EMPTY_MATRIX);

      const copiedSkills = [
        {
          skillId: "web-nonexistent-skill" as SkillId,
          contentHash: "abc123",
          sourcePath: "/source/skills/nonexistent",
          destPath: "/project/.claude/skills/web-nonexistent-skill",
        },
      ];

      const result = buildLocalSkillsMap(copiedSkills);

      expect(Object.keys(result)).toHaveLength(0);
    });

    it("should return empty map when no skills are copied", () => {
      initializeMatrix(SINGLE_REACT_MATRIX);

      const result = buildLocalSkillsMap([]);

      expect(Object.keys(result)).toHaveLength(0);
    });

    it("should handle mixed copied skills — some in matrix, some not", () => {
      initializeMatrix(SINGLE_REACT_MATRIX);

      const copiedSkills = [
        {
          skillId: "web-framework-react" as SkillId,
          contentHash: "abc123",
          sourcePath: "/source/skills/react",
          destPath: "/project/.claude/skills/web-framework-react",
        },
        {
          skillId: "web-nonexistent-skill" as SkillId,
          contentHash: "def456",
          sourcePath: "/source/skills/nonexistent",
          destPath: "/project/.claude/skills/web-nonexistent-skill",
        },
      ];

      const result = buildLocalSkillsMap(copiedSkills);

      expect(Object.keys(result)).toHaveLength(1);
      expect(result["web-framework-react"]).toBeDefined();
      expect(result["web-nonexistent-skill" as SkillId]).toBeUndefined();
    });
  });

  describe("buildCompileAgents", () => {
    it("should build compile agents for agents in the definition record", () => {
      const config = buildProjectConfig({
        agents: buildAgentConfigs(["web-developer"]),
        skills: buildSkillConfigs(["web-framework-react"]),
        stack: {
          "web-developer": {
            "web-framework": [{ id: "web-framework-react", preloaded: false }],
          },
        },
      });
      const agents: Record<AgentName, AgentDefinition> = {
        "web-developer": createMockAgent("web-developer"),
      } as Record<AgentName, AgentDefinition>;

      const result = buildCompileAgents(config, agents);

      expect(result["web-developer"]).toBeDefined();
      expect(result["web-developer"].skills).toBeDefined();
    });

    it("should skip agents not in the definition record", () => {
      const config = buildProjectConfig({
        agents: buildAgentConfigs(["web-developer", "api-developer"]),
        skills: buildSkillConfigs(["web-framework-react"]),
      });
      // Only web-developer has a definition
      const agents: Record<AgentName, AgentDefinition> = {
        "web-developer": createMockAgent("web-developer"),
      } as Record<AgentName, AgentDefinition>;

      const result = buildCompileAgents(config, agents);

      expect(result["web-developer"]).toBeDefined();
      expect(result["api-developer"]).toBeUndefined();
    });

    it("should return empty skills when agent has no stack mapping", () => {
      const config = buildProjectConfig({
        agents: buildAgentConfigs(["web-developer"]),
        skills: buildSkillConfigs(["web-framework-react"]),
        // No stack property
      });
      const agents: Record<AgentName, AgentDefinition> = {
        "web-developer": createMockAgent("web-developer"),
      } as Record<AgentName, AgentDefinition>;

      const result = buildCompileAgents(config, agents);

      expect(result["web-developer"]).toEqual({});
    });

    it("should filter global agent skills to only global-scoped skills (cross-scope safety net)", async () => {
      // Set up buildSkillRefsFromConfig mock to return both skills
      const mockBuildSkillRefs = vi.mocked((await import("../resolver")).buildSkillRefsFromConfig);
      mockBuildSkillRefs.mockReturnValueOnce([
        { id: "web-framework-react", usage: "when working with web-framework" },
        { id: "web-testing-vitest", usage: "when working with web-testing" },
      ]);

      const config = buildProjectConfig({
        agents: [{ name: "web-developer" as AgentName, scope: "global" }],
        skills: [
          { id: "web-framework-react", scope: "project", source: "local" },
          { id: "web-testing-vitest", scope: "global", source: "local" },
        ],
        stack: {
          "web-developer": {
            "web-framework": [{ id: "web-framework-react", preloaded: false }],
            "web-testing": [{ id: "web-testing-vitest", preloaded: false }],
          },
        },
      });
      const agents: Record<AgentName, AgentDefinition> = {
        "web-developer": createMockAgent("web-developer"),
      } as Record<AgentName, AgentDefinition>;

      const result = buildCompileAgents(config, agents);

      // Global agent should only see web-testing-vitest (global scope), not web-framework-react (project scope)
      const skills = result["web-developer"].skills ?? [];
      const skillIds = skills.map((s) => s.id);
      expect(skillIds).toContain("web-testing-vitest");
      expect(skillIds).not.toContain("web-framework-react");
    });

    it("should not filter project-scoped agent skills", async () => {
      // Set up buildSkillRefsFromConfig mock to return both skills
      const mockBuildSkillRefs = vi.mocked((await import("../resolver")).buildSkillRefsFromConfig);
      mockBuildSkillRefs.mockReturnValueOnce([
        { id: "web-framework-react", usage: "when working with web-framework" },
        { id: "web-testing-vitest", usage: "when working with web-testing" },
      ]);

      const config = buildProjectConfig({
        agents: [{ name: "web-developer" as AgentName, scope: "project" }],
        skills: [
          { id: "web-framework-react", scope: "project", source: "local" },
          { id: "web-testing-vitest", scope: "global", source: "local" },
        ],
        stack: {
          "web-developer": {
            "web-framework": [{ id: "web-framework-react", preloaded: false }],
            "web-testing": [{ id: "web-testing-vitest", preloaded: false }],
          },
        },
      });
      const agents: Record<AgentName, AgentDefinition> = {
        "web-developer": createMockAgent("web-developer"),
      } as Record<AgentName, AgentDefinition>;

      const result = buildCompileAgents(config, agents);

      // Project agent should see all skills regardless of scope
      const skills = result["web-developer"].skills ?? [];
      const skillIds = skills.map((s) => s.id);
      expect(skillIds).toContain("web-framework-react");
      expect(skillIds).toContain("web-testing-vitest");
    });
  });

  describe("buildAgentScopeMap", () => {
    it("should build a map from agent names to their scopes", () => {
      const config = buildProjectConfig({
        agents: [
          { name: "web-developer" as AgentName, scope: "project" },
          { name: "api-developer" as AgentName, scope: "global" },
        ],
      });

      const result = buildAgentScopeMap(config);

      expect(result.get("web-developer" as AgentName)).toBe("project");
      expect(result.get("api-developer" as AgentName)).toBe("global");
    });

    it("should return empty map for config with no agents", () => {
      const config = buildProjectConfig({ agents: [] });

      const result = buildAgentScopeMap(config);

      expect(result.size).toBe(0);
    });

    it("should handle single agent", () => {
      const config = buildProjectConfig({
        agents: buildAgentConfigs(["web-developer"]),
      });

      const result = buildAgentScopeMap(config);

      expect(result.size).toBe(1);
      expect(result.get("web-developer" as AgentName)).toBe("project");
    });
  });

  describe("setConfigMetadata", () => {
    it("should return a new config with domains when selectedDomains is non-empty", () => {
      const config = buildProjectConfig();
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]), {
        selectedDomains: ["web", "api"],
      });
      const sourceResult = buildSourceResult(EMPTY_MATRIX, tempDir);

      const result = setConfigMetadata(config, wizardResult, sourceResult);

      expect(result.domains).toEqual(["web", "api"]);
    });

    it("should not set domains when selectedDomains is empty", () => {
      const config = buildProjectConfig();
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]), {
        selectedDomains: [],
      });
      const sourceResult = buildSourceResult(EMPTY_MATRIX, tempDir);

      const result = setConfigMetadata(config, wizardResult, sourceResult);

      expect(result.domains).toBeUndefined();
    });

    it("should set selectedAgents when non-empty", () => {
      const config = buildProjectConfig();
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]), {
        selectedAgents: ["web-developer" as AgentName, "api-developer" as AgentName],
      });
      const sourceResult = buildSourceResult(EMPTY_MATRIX, tempDir);

      const result = setConfigMetadata(config, wizardResult, sourceResult);

      expect(result.selectedAgents).toEqual(["web-developer", "api-developer"]);
    });

    it("should not set selectedAgents when empty", () => {
      const config = buildProjectConfig();
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]), {
        selectedAgents: [],
      });
      const sourceResult = buildSourceResult(EMPTY_MATRIX, tempDir);

      const result = setConfigMetadata(config, wizardResult, sourceResult);

      expect(result.selectedAgents).toBeUndefined();
    });

    it("should prefer sourceFlag over sourceResult.sourceConfig.source", () => {
      const config = buildProjectConfig();
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]));
      const sourceResult = buildSourceResult(EMPTY_MATRIX, tempDir, {
        sourceConfig: { source: "github:default/source", sourceOrigin: "project" },
      });

      const result = setConfigMetadata(config, wizardResult, sourceResult, "github:my-org/skills");

      expect(result.source).toBe("github:my-org/skills");
    });

    it("should use sourceResult.sourceConfig.source when no sourceFlag", () => {
      const config = buildProjectConfig();
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]));
      const sourceResult = buildSourceResult(EMPTY_MATRIX, tempDir, {
        sourceConfig: { source: "github:default/source", sourceOrigin: "project" },
      });

      const result = setConfigMetadata(config, wizardResult, sourceResult);

      expect(result.source).toBe("github:default/source");
    });

    it("should set marketplace when available", () => {
      const config = buildProjectConfig();
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]));
      const sourceResult = buildSourceResult(EMPTY_MATRIX, tempDir, {
        marketplace: "my-marketplace",
      });

      const result = setConfigMetadata(config, wizardResult, sourceResult);

      expect(result.marketplace).toBe("my-marketplace");
    });

    it("should not mutate the original config object", () => {
      const config = buildProjectConfig();
      const originalName = config.name;
      const wizardResult = buildWizardResult(buildSkillConfigs([TEST_SKILL_ID]), {
        selectedDomains: ["web"],
        selectedAgents: ["web-developer" as AgentName],
      });
      const sourceResult = buildSourceResult(EMPTY_MATRIX, tempDir, {
        marketplace: "my-marketplace",
      });

      const result = setConfigMetadata(config, wizardResult, sourceResult, "github:my/repo");

      // Original config should not be mutated
      expect(config.domains).toBeUndefined();
      expect(config.selectedAgents).toBeUndefined();
      expect(config.source).toBeUndefined();
      expect(config.marketplace).toBeUndefined();
      expect(config.name).toBe(originalName);

      // Result should have the new values
      expect(result.domains).toEqual(["web"]);
      expect(result.selectedAgents).toEqual(["web-developer"]);
      expect(result.source).toBe("github:my/repo");
      expect(result.marketplace).toBe("my-marketplace");
    });
  });

  describe("writeScopedConfigs with HOME isolation", () => {
    // Moved from e2e/lifecycle/unified-config-view.e2e.test.ts — these are unit tests
    // that call writeScopedConfigs directly, not E2E tests.
    // Boundary cast: empty agents record for tests that don't need agent definitions
    const emptyAgents = {} as Record<AgentName, AgentDefinition>;
    let savedHome: string | undefined;

    beforeEach(() => {
      savedHome = process.env.HOME;
    });

    afterEach(() => {
      // Restore HOME after each test
      if (savedHome !== undefined) {
        process.env.HOME = savedHome;
      } else {
        delete process.env.HOME;
      }
    });

    it("should skip project config file when no existing config on disk and no project-scoped items", async () => {
      const globalHome = path.join(tempDir, "fake-home");
      const projectDir = path.join(tempDir, "project");

      process.env.HOME = globalHome;

      const config = buildProjectConfig({
        skills: [{ id: "web-framework-react", scope: "global", source: "agents-inc" }],
        agents: [{ name: "web-developer", scope: "global" }],
      });

      const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      await mkdir(path.dirname(projectConfigPath), { recursive: true });

      await writeScopedConfigs(
        config,
        EMPTY_MATRIX,
        emptyAgents,
        projectDir,
        projectConfigPath,
        false,
      );

      const globalConfigPath = path.join(globalHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const { fileExists } = await import("../../utils/fs");
      expect(await fileExists(globalConfigPath)).toBe(true);

      // Project config should NOT be written (no existing project installation and no project-scoped items)
      expect(await fileExists(projectConfigPath)).toBe(false);
    });

    it("should write project config when project split has project-scoped items", async () => {
      const globalHome = path.join(tempDir, "fake-home");
      const projectDir = path.join(tempDir, "project");

      process.env.HOME = globalHome;

      const config = buildProjectConfig({
        skills: [
          { id: "web-framework-react", scope: "global", source: "agents-inc" },
          { id: "web-testing-vitest", scope: "project", source: "local" },
        ],
        agents: [
          { name: "web-developer", scope: "global" },
          { name: "web-reviewer", scope: "project" },
        ],
      });

      const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      await mkdir(path.dirname(projectConfigPath), { recursive: true });

      await writeScopedConfigs(
        config,
        EMPTY_MATRIX,
        emptyAgents,
        projectDir,
        projectConfigPath,
        false,
      );

      const globalConfigPath = path.join(globalHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      const { fileExists } = await import("../../utils/fs");
      expect(await fileExists(globalConfigPath)).toBe(true);
      expect(await fileExists(projectConfigPath)).toBe(true);

      // Project config should have the project-scoped skill
      const projectContent = await readFile(projectConfigPath, "utf-8");
      expect(projectContent).toContain("web-testing-vitest");
      // Project config should import from global
      expect(projectContent).toContain("import globalConfig");
    });
  });
});
