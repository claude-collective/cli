import { mkdir, writeFile, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installLocal } from "./local-installer";
import type { AgentConfig, AgentName, ProjectConfig } from "../../types";
import { useMatrixStore } from "../../stores/matrix-store";
import {
  createMockMatrix,
  buildWizardResult,
  buildSkillConfigs,
  buildSourceResult,
  createTempDir,
  cleanupTempDir,
  readTestTsConfig,
} from "../__tests__/helpers";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, DEFAULT_PLUGIN_NAME, STANDARD_FILES } from "../../consts";
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

describe("local-installer", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("cc-local-installer-test-");
    useMatrixStore.getState().setMatrix(createMockMatrix());
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
    // Clean global config files written by writeScopedConfigs to the mocked home dir
    const globalClaudeSrc = path.join(os.homedir(), CLAUDE_SRC_DIR);
    await rm(globalClaudeSrc, { recursive: true, force: true }).catch(() => {});
  });

  describe("installLocal", () => {
    it("should create required directories", async () => {
      const matrix = createMockMatrix();
      const wizardResult = buildWizardResult(buildSkillConfigs(["meta-test-skill"]));
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
      const matrix = createMockMatrix();
      const wizardResult = buildWizardResult(buildSkillConfigs(["meta-test-skill"]));
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
      const matrix = createMockMatrix();
      const wizardResult = buildWizardResult(buildSkillConfigs(["meta-test-skill"]));
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
      const matrix = createMockMatrix();
      const wizardResult = buildWizardResult(buildSkillConfigs(["meta-test-skill"]));
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
      const matrix = createMockMatrix();
      const wizardResult = buildWizardResult(buildSkillConfigs(["meta-test-skill"]));
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
      const matrix = createMockMatrix();
      const wizardResult = buildWizardResult(buildSkillConfigs(["meta-test-skill"]));
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

      const matrix = createMockMatrix();
      const wizardResult = buildWizardResult(buildSkillConfigs(["meta-test-skill"]));
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
      const matrix = createMockMatrix();
      const wizardResult = buildWizardResult(
        buildSkillConfigs(["meta-test-skill"], { source: "local" }),
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
      const matrix = createMockMatrix();
      const wizardResult = buildWizardResult(buildSkillConfigs(["meta-test-skill"]));
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
      mockGenerateConfig.mockReturnValueOnce({
        name: "agents-inc",
        agents: [{ name: "web-developer", scope: "project" }],
        skills: [{ id: "meta-test-skill", scope: "project", source: "agents-inc" }],
      });

      const matrix = createMockMatrix();
      const wizardResult = buildWizardResult(
        buildSkillConfigs(["meta-test-skill"], { source: "agents-inc" }),
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

      const matrix = createMockMatrix();
      const wizardResult = buildWizardResult(
        buildSkillConfigs(["meta-test-skill"], { source: "local" }),
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
      const matrix = createMockMatrix();
      const wizardResult = buildWizardResult(buildSkillConfigs(["meta-test-skill"]));
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
      mockGenerateConfig.mockReturnValueOnce({
        name: "agents-inc",
        agents: [{ name: "web-developer", scope: "project" }],
        skills: [{ id: "web-framework-react", scope: "project", source: "local" }],
        stack: {
          "web-developer": {
            "web-framework": [{ id: "web-framework-react", preloaded: false }],
          },
        },
      });

      // buildStackProperty extracts stack data preserving preloaded: true
      mockBuildStackProperty.mockReturnValueOnce({
        "web-developer": {
          "web-framework": [{ id: "web-framework-react", preloaded: true }],
        },
      });

      const matrix = createMockMatrix();
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
});
