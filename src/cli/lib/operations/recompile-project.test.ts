import { describe, it, expect, beforeEach, vi } from "vitest";
import os from "os";
import type { AgentDefinition, AgentName } from "../../types";
import { ERROR_MESSAGES } from "../../utils/messages";

// --- Module-level mocks ---

vi.mock("../installation/index.js", () => ({
  detectGlobalInstallation: vi.fn(),
  detectProjectInstallation: vi.fn(),
}));

vi.mock("./load-agent-defs.js", () => ({
  loadAgentDefs: vi.fn(),
}));

vi.mock("./compile-agents.js", () => ({
  compileAgents: vi.fn(),
}));

vi.mock("../../utils/logger.js", () => ({
  setVerbose: vi.fn(),
}));

// --- Imports after mocks ---

import { recompileProject } from "./recompile-project";
import { detectGlobalInstallation, detectProjectInstallation } from "../installation/index.js";
import { loadAgentDefs } from "./load-agent-defs.js";
import { compileAgents } from "./compile-agents.js";
import { setVerbose } from "../../utils/logger.js";

const mockDetectGlobalInstallation = vi.mocked(detectGlobalInstallation);
const mockDetectProjectInstallation = vi.mocked(detectProjectInstallation);
const mockLoadAgentDefs = vi.mocked(loadAgentDefs);
const mockCompileAgents = vi.mocked(compileAgents);
const mockSetVerbose = vi.mocked(setVerbose);

describe("recompile-project", () => {
  const projectDir = "/test/project";
  const sourcePath = "/test/source";

  const globalInstallation = {
    mode: "local" as const,
    configPath: `${os.homedir()}/.claude-src/config.ts`,
    agentsDir: `${os.homedir()}/.claude/agents`,
    skillsDir: `${os.homedir()}/.claude/skills`,
    projectDir: os.homedir(),
  };

  const projectInstallation = {
    mode: "local" as const,
    configPath: "/test/project/.claude-src/config.ts",
    agentsDir: "/test/project/.claude/agents",
    skillsDir: "/test/project/.claude/skills",
    projectDir,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLoadAgentDefs.mockResolvedValue({
      agents: {} as Record<AgentName, AgentDefinition>,
      sourcePath,
      agentSourcePaths: {
        agentsDir: "/test/source/src/agents",
        templatesDir: "/test/source/src/agents/_templates",
        sourcePath,
      },
    });

    mockCompileAgents.mockResolvedValue({
      compiled: [],
      failed: [],
      warnings: [],
    });
  });

  it("should compile agents for global installation only", async () => {
    mockDetectGlobalInstallation.mockResolvedValue(globalInstallation);
    mockDetectProjectInstallation.mockResolvedValue(null);

    mockCompileAgents.mockResolvedValue({
      compiled: ["web-developer" as AgentName],
      failed: [],
      warnings: [],
    });

    const result = await recompileProject({ projectDir });

    expect(mockCompileAgents).toHaveBeenCalledTimes(1);
    expect(mockCompileAgents).toHaveBeenCalledWith({
      projectDir: os.homedir(),
      sourcePath,
      outputDir: globalInstallation.agentsDir,
      scopeFilter: undefined,
    });
    expect(result.globalCompiled).toStrictEqual(["web-developer"]);
    expect(result.projectCompiled).toStrictEqual([]);
    expect(result.totalCompiled).toBe(1);
  });

  it("should compile agents for project installation only", async () => {
    mockDetectGlobalInstallation.mockResolvedValue(null);
    mockDetectProjectInstallation.mockResolvedValue(projectInstallation);

    mockCompileAgents.mockResolvedValue({
      compiled: ["api-developer" as AgentName],
      failed: [],
      warnings: [],
    });

    const result = await recompileProject({ projectDir });

    expect(mockCompileAgents).toHaveBeenCalledTimes(1);
    expect(mockCompileAgents).toHaveBeenCalledWith({
      projectDir,
      sourcePath,
      outputDir: projectInstallation.agentsDir,
      scopeFilter: undefined,
    });
    expect(result.globalCompiled).toStrictEqual([]);
    expect(result.projectCompiled).toStrictEqual(["api-developer"]);
    expect(result.totalCompiled).toBe(1);
  });

  it("should compile both scopes with scopeFilter when both exist", async () => {
    mockDetectGlobalInstallation.mockResolvedValue(globalInstallation);
    mockDetectProjectInstallation.mockResolvedValue(projectInstallation);

    mockCompileAgents
      .mockResolvedValueOnce({
        compiled: ["web-pm" as AgentName],
        failed: [],
        warnings: ["global warning"],
      })
      .mockResolvedValueOnce({
        compiled: ["web-developer" as AgentName],
        failed: [],
        warnings: ["project warning"],
      });

    const result = await recompileProject({ projectDir });

    expect(mockCompileAgents).toHaveBeenCalledTimes(2);

    // First call: global scope with "global" filter
    expect(mockCompileAgents).toHaveBeenNthCalledWith(1, {
      projectDir: os.homedir(),
      sourcePath,
      outputDir: globalInstallation.agentsDir,
      scopeFilter: "global",
    });

    // Second call: project scope with "project" filter
    expect(mockCompileAgents).toHaveBeenNthCalledWith(2, {
      projectDir,
      sourcePath,
      outputDir: projectInstallation.agentsDir,
      scopeFilter: "project",
    });

    expect(result.globalCompiled).toStrictEqual(["web-pm"]);
    expect(result.projectCompiled).toStrictEqual(["web-developer"]);
    expect(result.totalCompiled).toBe(2);
    expect(result.warnings).toStrictEqual(["global warning", "project warning"]);
  });

  it("should throw when no installation found", async () => {
    mockDetectGlobalInstallation.mockResolvedValue(null);
    mockDetectProjectInstallation.mockResolvedValue(null);

    await expect(recompileProject({ projectDir })).rejects.toThrow(ERROR_MESSAGES.NO_INSTALLATION);
  });

  it("should set verbose when options.verbose is true", async () => {
    mockDetectGlobalInstallation.mockResolvedValue(globalInstallation);
    mockDetectProjectInstallation.mockResolvedValue(null);

    await recompileProject({ projectDir, verbose: true });

    expect(mockSetVerbose).toHaveBeenCalledWith(true);
  });
});
