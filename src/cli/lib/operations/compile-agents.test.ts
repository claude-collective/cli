import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AgentName } from "../../types";

// --- Module-level mocks ---

vi.mock("../agents/index.js", () => ({
  recompileAgents: vi.fn(),
}));

vi.mock("../configuration/index.js", () => ({
  loadProjectConfigFromDir: vi.fn(),
}));

vi.mock("../installation/index.js", () => ({
  buildAgentScopeMap: vi.fn(),
}));

// --- Imports after mocks ---

import { compileAgents } from "./compile-agents";
import { recompileAgents } from "../agents/index.js";
import { loadProjectConfigFromDir } from "../configuration/index.js";

const mockRecompileAgents = vi.mocked(recompileAgents);
const mockLoadProjectConfigFromDir = vi.mocked(loadProjectConfigFromDir);

describe("compile-agents", () => {
  const projectDir = "/test/project";
  const sourcePath = "/test/source";

  beforeEach(() => {
    vi.clearAllMocks();

    mockRecompileAgents.mockResolvedValue({
      compiled: ["web-developer" as AgentName],
      failed: [],
      warnings: [],
    });
  });

  it("should pass options through to recompileAgents", async () => {
    const result = await compileAgents({
      projectDir,
      sourcePath,
      pluginDir: "/test/plugin",
      outputDir: "/test/output",
      installMode: "local",
    });

    expect(mockRecompileAgents).toHaveBeenCalledWith({
      pluginDir: "/test/plugin",
      sourcePath,
      agents: undefined,
      skills: undefined,
      projectDir,
      outputDir: "/test/output",
      installMode: "local",
      agentScopeMap: undefined,
    });
    expect(result.compiled).toStrictEqual(["web-developer"]);
  });

  it("should use pluginDir defaulting to projectDir when not provided", async () => {
    await compileAgents({
      projectDir,
      sourcePath,
    });

    expect(mockRecompileAgents).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginDir: projectDir,
      }),
    );
  });

  it("should filter agents by scopeFilter when set", async () => {
    mockLoadProjectConfigFromDir.mockResolvedValue({
      config: {
        name: "test",
        agents: [
          { name: "web-developer" as AgentName, scope: "project" },
          { name: "api-developer" as AgentName, scope: "global" },
        ],
        skills: [],
      },
      configPath: "/test/project/.claude-src/config.ts",
    });

    mockRecompileAgents.mockResolvedValue({
      compiled: ["web-developer" as AgentName],
      failed: [],
      warnings: [],
    });

    const result = await compileAgents({
      projectDir,
      sourcePath,
      scopeFilter: "project",
    });

    expect(mockLoadProjectConfigFromDir).toHaveBeenCalledWith(projectDir);
    expect(mockRecompileAgents).toHaveBeenCalledWith(
      expect.objectContaining({
        agents: ["web-developer"],
      }),
    );
    expect(result.compiled).toStrictEqual(["web-developer"]);
  });

  it("should intersect scopeFilter with explicit agents list", async () => {
    mockLoadProjectConfigFromDir.mockResolvedValue({
      config: {
        name: "test",
        agents: [
          { name: "web-developer" as AgentName, scope: "project" },
          { name: "api-developer" as AgentName, scope: "project" },
          { name: "web-pm" as AgentName, scope: "global" },
        ],
        skills: [],
      },
      configPath: "/test/project/.claude-src/config.ts",
    });

    await compileAgents({
      projectDir,
      sourcePath,
      agents: ["web-developer", "web-pm"],
      scopeFilter: "project",
    });

    // Only web-developer matches both the explicit list AND the project scope filter
    expect(mockRecompileAgents).toHaveBeenCalledWith(
      expect.objectContaining({
        agents: ["web-developer"],
      }),
    );
  });

  it("should return compilation result from recompileAgents", async () => {
    mockRecompileAgents.mockResolvedValue({
      compiled: ["web-developer" as AgentName, "api-developer" as AgentName],
      failed: ["web-pm" as AgentName],
      warnings: ["Agent web-pm had issues"],
    });

    const result = await compileAgents({
      projectDir,
      sourcePath,
    });

    expect(result).toStrictEqual({
      compiled: ["web-developer", "api-developer"],
      failed: ["web-pm"],
      warnings: ["Agent web-pm had issues"],
    });
  });
});
