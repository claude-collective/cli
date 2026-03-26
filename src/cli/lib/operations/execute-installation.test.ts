import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AgentName, ProjectConfig } from "../../types";
import type { SourceLoadResult } from "../loading/source-loader";
import type { WizardResultV2 } from "../../components/wizard/wizard";
import {
  buildWizardResult,
  buildSkillConfigs,
  buildProjectConfig,
  buildSourceResult,
} from "../__tests__/helpers";
import { EMPTY_MATRIX } from "../__tests__/mock-data/mock-matrices";

// --- Module-level mocks ---

vi.mock("../installation/index.js", () => ({
  installLocal: vi.fn(),
  installPluginConfig: vi.fn(),
  deriveInstallMode: vi.fn(),
}));

vi.mock("./copy-local-skills.js", () => ({
  copyLocalSkills: vi.fn(),
}));

vi.mock("./ensure-marketplace.js", () => ({
  ensureMarketplace: vi.fn(),
}));

vi.mock("./install-plugin-skills.js", () => ({
  installPluginSkills: vi.fn(),
}));

// --- Imports after mocks ---

import { executeInstallation } from "./execute-installation";
import { installLocal, installPluginConfig, deriveInstallMode } from "../installation/index.js";
import { copyLocalSkills } from "./copy-local-skills.js";
import { ensureMarketplace } from "./ensure-marketplace.js";
import { installPluginSkills } from "./install-plugin-skills.js";

const mockInstallLocal = vi.mocked(installLocal);
const mockInstallPluginConfig = vi.mocked(installPluginConfig);
const mockDeriveInstallMode = vi.mocked(deriveInstallMode);
const mockCopyLocalSkills = vi.mocked(copyLocalSkills);
const mockEnsureMarketplace = vi.mocked(ensureMarketplace);
const mockInstallPluginSkills = vi.mocked(installPluginSkills);

describe("execute-installation", () => {
  const projectDir = "/test/project";
  const sourcePath = "/test/source";
  const configPath = "/test/project/.claude-src/config.ts";
  const agentsDir = "/test/project/.claude/agents";

  let wizardResult: WizardResultV2;
  let sourceResult: SourceLoadResult;
  let localInstallResult: ReturnType<typeof buildLocalResult>;

  function buildLocalResult(overrides?: Record<string, unknown>) {
    return {
      copiedSkills: [],
      config: buildProjectConfig(),
      configPath,
      compiledAgents: ["web-developer" as AgentName],
      wasMerged: false,
      mergedConfigPath: undefined,
      skillsDir: "/test/project/.claude/skills",
      agentsDir,
      ...overrides,
    };
  }

  function buildPluginConfigResult(overrides?: Record<string, unknown>) {
    return {
      config: buildProjectConfig(),
      configPath,
      compiledAgents: ["web-developer" as AgentName],
      wasMerged: false,
      mergedConfigPath: undefined,
      agentsDir,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    wizardResult = buildWizardResult(buildSkillConfigs(["web-framework-react"]));
    sourceResult = buildSourceResult(EMPTY_MATRIX, sourcePath);
    localInstallResult = buildLocalResult();

    mockInstallLocal.mockResolvedValue(localInstallResult);
    mockInstallPluginConfig.mockResolvedValue(buildPluginConfigResult());
    mockCopyLocalSkills.mockResolvedValue({
      projectCopied: [],
      globalCopied: [],
      totalCopied: 0,
    });
    mockEnsureMarketplace.mockResolvedValue({
      marketplace: "test-marketplace",
      registered: false,
    });
    mockInstallPluginSkills.mockResolvedValue({
      installed: [],
      failed: [],
    });
  });

  it("should call installLocal for local mode", async () => {
    mockDeriveInstallMode.mockReturnValue("local");

    const result = await executeInstallation({
      wizardResult,
      sourceResult,
      projectDir,
    });

    expect(mockInstallLocal).toHaveBeenCalledWith({
      wizardResult,
      sourceResult,
      projectDir,
      sourceFlag: undefined,
    });
    expect(mockEnsureMarketplace).not.toHaveBeenCalled();
    expect(mockInstallPluginSkills).not.toHaveBeenCalled();
    expect(result.mode).toBe("local");
    expect(result.config).toStrictEqual(localInstallResult.config);
  });

  it("should call ensureMarketplace + installPluginSkills + installPluginConfig for plugin mode", async () => {
    const pluginSkills = buildSkillConfigs(["web-framework-react"], { source: "test-marketplace" });
    wizardResult = buildWizardResult(pluginSkills);
    mockDeriveInstallMode.mockReturnValue("plugin");

    const pluginConfigResult = buildPluginConfigResult();
    mockInstallPluginConfig.mockResolvedValue(pluginConfigResult);

    const result = await executeInstallation({
      wizardResult,
      sourceResult,
      projectDir,
    });

    expect(mockInstallLocal).not.toHaveBeenCalled();
    expect(mockCopyLocalSkills).not.toHaveBeenCalled();
    expect(mockEnsureMarketplace).toHaveBeenCalledWith(sourceResult);
    expect(mockInstallPluginSkills).toHaveBeenCalledWith(
      pluginSkills,
      "test-marketplace",
      projectDir,
    );
    expect(mockInstallPluginConfig).toHaveBeenCalledWith({
      wizardResult,
      sourceResult,
      projectDir,
      sourceFlag: undefined,
    });
    expect(result.mode).toBe("plugin");
    expect(result.copiedSkills).toStrictEqual([]);
  });

  it("should copy local skills + install plugins for mixed mode", async () => {
    const localSkill = buildSkillConfigs(["web-framework-react"], { source: "local" });
    const pluginSkill = buildSkillConfigs(["api-framework-hono"], {
      source: "test-marketplace",
    });
    wizardResult = buildWizardResult([...localSkill, ...pluginSkill]);
    mockDeriveInstallMode.mockReturnValue("mixed");

    const copiedSkill = {
      skillId: "web-framework-react" as import("../../types").SkillId,
      contentHash: "abc123",
      sourcePath: "/test/source/skills/web/framework/react",
      destPath: "/test/project/.claude/skills/web-framework-react",
    };
    mockCopyLocalSkills.mockResolvedValue({
      projectCopied: [copiedSkill],
      globalCopied: [],
      totalCopied: 1,
    });

    const pluginConfigResult = buildPluginConfigResult();
    mockInstallPluginConfig.mockResolvedValue(pluginConfigResult);

    const result = await executeInstallation({
      wizardResult,
      sourceResult,
      projectDir,
    });

    expect(mockCopyLocalSkills).toHaveBeenCalledWith(localSkill, projectDir, sourceResult);
    expect(mockEnsureMarketplace).toHaveBeenCalledWith(sourceResult);
    expect(mockInstallPluginSkills).toHaveBeenCalledWith(pluginSkill, "test-marketplace", projectDir);
    expect(mockInstallPluginConfig).toHaveBeenCalled();
    expect(result.mode).toBe("mixed");
    expect(result.copiedSkills).toStrictEqual([copiedSkill]);
  });

  it("should fall back to installLocal when marketplace unavailable", async () => {
    const pluginSkills = buildSkillConfigs(["web-framework-react"], { source: "test-marketplace" });
    wizardResult = buildWizardResult(pluginSkills);
    mockDeriveInstallMode.mockReturnValue("plugin");

    mockEnsureMarketplace.mockResolvedValue({
      marketplace: null,
      registered: false,
    });

    const result = await executeInstallation({
      wizardResult,
      sourceResult,
      projectDir,
    });

    expect(mockEnsureMarketplace).toHaveBeenCalledWith(sourceResult);
    expect(mockInstallLocal).toHaveBeenCalledWith({
      wizardResult,
      sourceResult,
      projectDir,
      sourceFlag: undefined,
    });
    expect(mockInstallPluginSkills).not.toHaveBeenCalled();
    expect(mockInstallPluginConfig).not.toHaveBeenCalled();
    expect(result.mode).toBe("local");
  });
});
