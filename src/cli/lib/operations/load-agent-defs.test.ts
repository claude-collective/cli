import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AgentDefinition, AgentName, AgentSourcePaths } from "../../types/index.js";

vi.mock("../agents/index.js", () => ({
  getAgentDefinitions: vi.fn(),
}));

vi.mock("../loading/index.js", () => ({
  loadAllAgents: vi.fn(),
}));

vi.mock("../../consts.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../consts.js")>();
  return {
    ...actual,
    PROJECT_ROOT: "/mock/cli/root",
  };
});

import { loadAgentDefs } from "./load-agent-defs";
import { getAgentDefinitions } from "../agents/index.js";
import { loadAllAgents } from "../loading/index.js";

const mockGetAgentDefinitions = vi.mocked(getAgentDefinitions);
const mockLoadAllAgents = vi.mocked(loadAllAgents);

const MOCK_AGENT_SOURCE_PATHS: AgentSourcePaths = {
  agentsDir: "/tmp/source/src/agents",
  templatesDir: "/tmp/source/src/agents/_templates",
  sourcePath: "/tmp/source",
};

function createMockAgentDef(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    title: "Mock Agent",
    description: "A mock agent for testing",
    tools: [],
    ...overrides,
  };
}

const CLI_AGENT: AgentDefinition = createMockAgentDef({
  title: "CLI Web Developer",
  description: "Built-in web developer",
});

const SOURCE_AGENT: AgentDefinition = createMockAgentDef({
  title: "Source Web Developer",
  description: "Source-overridden web developer",
});

const CLI_ONLY_AGENT: AgentDefinition = createMockAgentDef({
  title: "CLI Reviewer",
  description: "Built-in reviewer",
});

describe("loadAgentDefs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetAgentDefinitions.mockResolvedValue(MOCK_AGENT_SOURCE_PATHS);
  });

  it("should merge CLI agents with source agents (source overrides)", async () => {
    const cliAgents: Partial<Record<AgentName, AgentDefinition>> = {
      "web-developer": CLI_AGENT,
      "api-reviewer": CLI_ONLY_AGENT,
    };
    const sourceAgents: Partial<Record<AgentName, AgentDefinition>> = {
      "web-developer": SOURCE_AGENT,
    };

    mockLoadAllAgents.mockResolvedValueOnce(
      cliAgents as Record<AgentName, AgentDefinition>,
    );
    mockLoadAllAgents.mockResolvedValueOnce(
      sourceAgents as Record<AgentName, AgentDefinition>,
    );

    const result = await loadAgentDefs();

    // Source overrides CLI for "web-developer"
    expect(result.agents["web-developer"]).toStrictEqual(SOURCE_AGENT);
    // CLI-only agent preserved
    expect(result.agents["api-reviewer"]).toStrictEqual(CLI_ONLY_AGENT);
  });

  it("should return sourcePath from agentSourcePaths", async () => {
    mockLoadAllAgents.mockResolvedValue(
      {} as Record<AgentName, AgentDefinition>,
    );

    const result = await loadAgentDefs();

    expect(result.sourcePath).toBe("/tmp/source");
  });

  it("should pass agentSource and options to getAgentDefinitions", async () => {
    mockLoadAllAgents.mockResolvedValue(
      {} as Record<AgentName, AgentDefinition>,
    );

    await loadAgentDefs("github:test/agents", {
      projectDir: "/tmp/project",
      forceRefresh: true,
    });

    expect(mockGetAgentDefinitions).toHaveBeenCalledWith("github:test/agents", {
      projectDir: "/tmp/project",
      forceRefresh: true,
    });
  });

  it("should return complete agentSourcePaths", async () => {
    mockLoadAllAgents.mockResolvedValue(
      {} as Record<AgentName, AgentDefinition>,
    );

    const result = await loadAgentDefs();

    expect(result.agentSourcePaths).toStrictEqual(MOCK_AGENT_SOURCE_PATHS);
  });
});
