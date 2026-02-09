import { mkdir, mkdtemp, rm, writeFile, readFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { installLocal, type LocalInstallOptions } from "./local-installer";
import type { WizardResultV2 } from "../components/wizard/wizard";
import type { SourceLoadResult } from "./source-loader";
import type { MergedSkillsMatrix } from "../types-matrix";
import type { ProjectConfig } from "../../types";
import { createMockMatrix } from "./__tests__/helpers";

/**
 * Helper to create a minimal wizard result
 */
function createWizardResult(overrides?: Partial<WizardResultV2>): WizardResultV2 {
  return {
    selectedSkills: [],
    selectedStackId: null,
    domainSelections: {},
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

/**
 * Helper to create a minimal source load result.
 * Uses a real source path from the project (PROJECT_ROOT) so that
 * loadAllAgents and other loaders can find real agent definitions.
 */
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
vi.mock("./skill-copier", () => ({
  copySkillsToLocalFlattened: vi.fn().mockResolvedValue([]),
}));

vi.mock("./loader", () => ({
  loadAllAgents: vi.fn().mockResolvedValue({}),
}));

vi.mock("./stacks-loader", () => ({
  loadStackById: vi.fn().mockResolvedValue(null),
}));

vi.mock("./resolver", () => ({
  resolveAgents: vi.fn().mockResolvedValue({}),
  resolveStackSkills: vi.fn().mockReturnValue([]),
  resolveAgentSkillsFromStack: vi.fn().mockReturnValue([]),
}));

vi.mock("./stack-plugin-compiler", () => ({
  compileAgentForPlugin: vi.fn().mockResolvedValue("# compiled agent content"),
}));

vi.mock("./compiler", () => ({
  createLiquidEngine: vi.fn().mockResolvedValue({}),
}));

vi.mock("./config-generator", () => ({
  generateProjectConfigFromSkills: vi.fn().mockReturnValue({
    name: "claude-collective",
    agents: ["web-developer"],
    skills: ["test-skill"],
  }),
  buildStackProperty: vi.fn().mockReturnValue({}),
}));

describe("local-installer", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-local-installer-test-"));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("installLocal", () => {
    it("should create required directories", async () => {
      const matrix = createMockMatrix({});
      const wizardResult = createWizardResult({
        selectedSkills: ["test-skill"],
      });
      const sourceResult = createSourceResult(matrix, tempDir);

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: tempDir,
      });

      // Verify directories were created
      const { fileExists } = await import("../utils/fs");
      expect(await fileExists(path.join(tempDir, ".claude", "skills"))).toBe(true);
      expect(await fileExists(path.join(tempDir, ".claude", "agents"))).toBe(true);
      expect(await fileExists(path.join(tempDir, ".claude-src"))).toBe(true);
    });

    it("should write config to .claude-src/config.yaml", async () => {
      const matrix = createMockMatrix({});
      const wizardResult = createWizardResult({
        selectedSkills: ["test-skill"],
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
        selectedSkills: ["test-skill"],
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
        selectedSkills: ["test-skill"],
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
        selectedSkills: ["test-skill"],
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
        selectedSkills: ["test-skill"],
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
        selectedSkills: ["test-skill"],
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
        selectedSkills: ["test-skill"],
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
        selectedSkills: ["test-skill"],
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
  });
});
