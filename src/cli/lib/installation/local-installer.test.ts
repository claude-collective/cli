import { mkdir, mkdtemp, rm, writeFile, readFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { installLocal } from "./local-installer";
import type { WizardResultV2 } from "../../components/wizard/wizard";
import type { SourceLoadResult } from "../loading";
import type { AgentConfig, AgentName, MergedSkillsMatrix, ProjectConfig } from "../../types";
import { createMockMatrix } from "../__tests__/helpers";

function createWizardResult(overrides?: Partial<WizardResultV2>): WizardResultV2 {
  return {
    selectedSkills: [],
    selectedStackId: null,
    domainSelections: {},
    sourceSelections: {},
    expertMode: false,
    installMode: "local",
    cancelled: false,
    validation: {
      valid: true,
      errors: [],
      warnings: [],
    },
    ...overrides,
  };
}

function createSourceResult(
  matrix: MergedSkillsMatrix,
  sourcePath: string,
  overrides?: Partial<SourceLoadResult>,
): SourceLoadResult {
  return {
    matrix,
    sourceConfig: {
      source: "github:test/skills",
      sourceOrigin: "default",
    },
    sourcePath,
    isLocal: true,
    ...overrides,
  };
}

// Mock heavy dependencies that involve file system operations outside our temp dir
vi.mock("../skills/skill-copier", () => ({
  copySkillsToLocalFlattened: vi.fn().mockResolvedValue([]),
}));

vi.mock("../loading/loader", () => ({
  loadAllAgents: vi.fn().mockResolvedValue({}),
}));

vi.mock("../stacks/stacks-loader", () => ({
  loadStackById: vi.fn().mockResolvedValue(null),
}));

vi.mock("../resolver", () => ({
  resolveAgents: vi.fn().mockResolvedValue({}),
  buildSkillRefsFromConfig: vi.fn().mockReturnValue([]),
}));

vi.mock("../stacks/stack-plugin-compiler", () => ({
  compileAgentForPlugin: vi.fn().mockResolvedValue("# compiled agent content"),
}));

vi.mock("../compiler", () => ({
  createLiquidEngine: vi.fn().mockResolvedValue({}),
}));

vi.mock("../configuration/config-generator", () => ({
  generateProjectConfigFromSkills: vi.fn().mockReturnValue({
    name: "claude-collective",
    agents: ["web-developer"],
    skills: ["test-skill"],
  }),
  buildStackProperty: vi.fn().mockReturnValue({}),
}));

// Access the mock to verify installMode is passed through
const mockCompileAgentForPlugin = vi.mocked(
  (await import("../stacks/stack-plugin-compiler")).compileAgentForPlugin,
);

describe("local-installer", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-local-installer-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("installLocal", () => {
    it("should create required directories", async () => {
      const matrix = createMockMatrix({});
      const wizardResult = createWizardResult({
        selectedSkills: ["meta-test-skill"],
      });
      const sourceResult = createSourceResult(matrix, tempDir);

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      // Verify directories were created
      const { fileExists } = await import("../../utils/fs");
      expect(await fileExists(path.join(tempDir, ".claude", "skills"))).toBe(true);
      expect(await fileExists(path.join(tempDir, ".claude", "agents"))).toBe(true);
      expect(await fileExists(path.join(tempDir, ".claude-src"))).toBe(true);
    });

    it("should write config to .claude-src/config.yaml", async () => {
      const matrix = createMockMatrix({});
      const wizardResult = createWizardResult({
        selectedSkills: ["meta-test-skill"],
      });
      const sourceResult = createSourceResult(matrix, tempDir);

      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      // Verify config was written
      const configPath = path.join(tempDir, ".claude-src", "config.yaml");
      const configContent = await readFile(configPath, "utf-8");
      const config = parseYaml(configContent) as ProjectConfig;

      expect(config.name).toBe("claude-collective");
      expect(result.configPath).toBe(configPath);
    });

    it("should include source in config from sourceFlag", async () => {
      const matrix = createMockMatrix({});
      const wizardResult = createWizardResult({
        selectedSkills: ["meta-test-skill"],
      });
      const sourceResult = createSourceResult(matrix, tempDir);

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
        sourceFlag: "github:my-org/skills",
      });

      const configPath = path.join(tempDir, ".claude-src", "config.yaml");
      const configContent = await readFile(configPath, "utf-8");
      const config = parseYaml(configContent) as ProjectConfig;

      expect(config.source).toBe("github:my-org/skills");
    });

    it("should include source from sourceResult when no sourceFlag", async () => {
      const matrix = createMockMatrix({});
      const wizardResult = createWizardResult({
        selectedSkills: ["meta-test-skill"],
      });
      const sourceResult = createSourceResult(matrix, tempDir, {
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

      const configPath = path.join(tempDir, ".claude-src", "config.yaml");
      const configContent = await readFile(configPath, "utf-8");
      const config = parseYaml(configContent) as ProjectConfig;

      expect(config.source).toBe("github:default/source");
    });

    it("should include marketplace in config when available", async () => {
      const matrix = createMockMatrix({});
      const wizardResult = createWizardResult({
        selectedSkills: ["meta-test-skill"],
      });
      const sourceResult = createSourceResult(matrix, tempDir, {
        marketplace: "my-marketplace",
      });

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      const configPath = path.join(tempDir, ".claude-src", "config.yaml");
      const configContent = await readFile(configPath, "utf-8");
      const config = parseYaml(configContent) as ProjectConfig;

      expect(config.marketplace).toBe("my-marketplace");
    });

    it("should return correct result structure", async () => {
      const matrix = createMockMatrix({});
      const wizardResult = createWizardResult({
        selectedSkills: ["meta-test-skill"],
      });
      const sourceResult = createSourceResult(matrix, tempDir);

      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      expect(result.copiedSkills).toBeDefined();
      expect(result.config).toBeDefined();
      expect(result.configPath).toContain(".claude-src/config.yaml");
      expect(result.compiledAgents).toBeDefined();
      expect(typeof result.wasMerged).toBe("boolean");
      expect(result.skillsDir).toContain(".claude/skills");
      expect(result.agentsDir).toContain(".claude/agents");
    });

    it("should merge with existing config when present", async () => {
      // Write an existing config
      const configDir = path.join(tempDir, ".claude-src");
      await mkdir(configDir, { recursive: true });
      await writeFile(
        path.join(configDir, "config.yaml"),
        stringifyYaml({
          name: "existing-project",
          agents: ["existing-agent"],
          author: "@existing",
        }),
      );

      const matrix = createMockMatrix({});
      const wizardResult = createWizardResult({
        selectedSkills: ["meta-test-skill"],
      });
      const sourceResult = createSourceResult(matrix, tempDir);

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

    it("should set installMode on config", async () => {
      const matrix = createMockMatrix({});
      const wizardResult = createWizardResult({
        selectedSkills: ["meta-test-skill"],
        installMode: "local",
      });
      const sourceResult = createSourceResult(matrix, tempDir);

      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      expect(result.config.installMode).toBe("local");
    });

    it("should not set wasMerged when no existing config", async () => {
      const matrix = createMockMatrix({});
      const wizardResult = createWizardResult({
        selectedSkills: ["meta-test-skill"],
      });
      const sourceResult = createSourceResult(matrix, tempDir);

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

      const matrix = createMockMatrix({});
      const wizardResult = createWizardResult({
        selectedSkills: ["meta-test-skill"],
        installMode: "plugin",
      });
      const sourceResult = createSourceResult(matrix, tempDir);

      mockCompileAgentForPlugin.mockClear();

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      // compileAgentForPlugin should have been called with installMode as the 5th arg
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

      const matrix = createMockMatrix({});
      const wizardResult = createWizardResult({
        selectedSkills: ["meta-test-skill"],
        installMode: "local",
      });
      const sourceResult = createSourceResult(matrix, tempDir);

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
  });
});
