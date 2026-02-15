import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import { mkdir } from "fs/promises";
import { createTempDir, cleanupTempDir } from "../__tests__/helpers";

// Mock logger (suppress verbose output during tests)
vi.mock("../../utils/logger");

// Mock fetchFromSource (network call — must remain mocked)
vi.mock("../loading", () => ({
  fetchFromSource: vi.fn(),
}));

let MOCK_PROJECT_ROOT: string;

// Mock consts — PROJECT_ROOT points to a temp dir set up per test
vi.mock("../../consts", () => ({
  get PROJECT_ROOT() {
    return MOCK_PROJECT_ROOT;
  },
  DIRS: {
    agents: "src/agents",
    skills: "src/skills",
    stacks: "src/stacks",
    templates: "src/agents/_templates",
    commands: "src/commands",
  },
  CLAUDE_DIR: ".claude",
}));

import {
  getAgentDefinitions,
  getLocalAgentDefinitions,
  fetchAgentDefinitionsFromRemote,
} from "./agent-fetcher";
import { fetchFromSource } from "../loading";

const mockFetchFromSource = vi.mocked(fetchFromSource);

async function createAgentDirStructure(
  root: string,
  options: { agents?: boolean; templates?: boolean } = {},
): Promise<void> {
  const { agents = true, templates = true } = options;
  if (agents) {
    await mkdir(path.join(root, "src/agents"), { recursive: true });
  }
  if (templates) {
    await mkdir(path.join(root, "src/agents/_templates"), { recursive: true });
  }
}

describe("agent-fetcher", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("agent-fetcher-test-");
    MOCK_PROJECT_ROOT = tempDir;
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("getLocalAgentDefinitions", () => {
    it("should return agent source paths when agents directory exists", async () => {
      await createAgentDirStructure(tempDir);

      const result = await getLocalAgentDefinitions();

      expect(result).toEqual({
        agentsDir: path.join(tempDir, "src/agents"),
        templatesDir: path.join(tempDir, "src/agents/_templates"),
        sourcePath: tempDir,
      });
    });

    it("should throw when agents directory does not exist", async () => {
      // Empty temp dir — no agents directory
      await expect(getLocalAgentDefinitions()).rejects.toThrow("Agent partials not found at '");
    });

    it("should use local templates when projectDir is provided and local templates exist", async () => {
      await createAgentDirStructure(tempDir);

      // Create local templates in a separate project dir
      const projectDir = path.join(tempDir, "my-project");
      await mkdir(path.join(projectDir, ".claude/templates"), { recursive: true });

      const result = await getLocalAgentDefinitions({ projectDir });

      expect(result.templatesDir).toBe(path.join(projectDir, ".claude", "templates"));
      expect(result.agentsDir).toBe(path.join(tempDir, "src/agents"));
      expect(result.sourcePath).toBe(tempDir);
    });

    it("should fall back to default templates when local templates directory does not exist", async () => {
      await createAgentDirStructure(tempDir);

      // Project dir without local templates
      const projectDir = path.join(tempDir, "my-project");
      await mkdir(projectDir, { recursive: true });

      const result = await getLocalAgentDefinitions({ projectDir });

      expect(result.templatesDir).toBe(path.join(tempDir, "src/agents/_templates"));
    });

    it("should still succeed when templates directory does not exist", async () => {
      // Create agents dir but NOT templates dir
      await createAgentDirStructure(tempDir, { templates: false });

      const result = await getLocalAgentDefinitions();
      expect(result.agentsDir).toBe(path.join(tempDir, "src/agents"));
      expect(result.templatesDir).toBe(path.join(tempDir, "src/agents/_templates"));
    });
  });

  describe("fetchAgentDefinitionsFromRemote", () => {
    const REMOTE_SOURCE = "github:my-org/agents";

    it("should fetch agent definitions from remote source", async () => {
      // Create a temp dir simulating the fetched remote content
      const fetchedDir = path.join(tempDir, "fetched");
      await mkdir(path.join(fetchedDir, "src/agents/_templates"), { recursive: true });

      mockFetchFromSource.mockResolvedValue({
        path: fetchedDir,
        fromCache: false,
        source: REMOTE_SOURCE,
      });

      const result = await fetchAgentDefinitionsFromRemote(REMOTE_SOURCE);

      expect(mockFetchFromSource).toHaveBeenCalledWith(REMOTE_SOURCE, {
        forceRefresh: undefined,
        subdir: "",
      });
      expect(result).toEqual({
        agentsDir: path.join(fetchedDir, "src", "agents"),
        templatesDir: path.join(fetchedDir, "src", "agents", "_templates"),
        sourcePath: fetchedDir,
      });
    });

    it("should pass forceRefresh option to fetchFromSource", async () => {
      const fetchedDir = path.join(tempDir, "fetched");
      await mkdir(path.join(fetchedDir, "src/agents/_templates"), { recursive: true });

      mockFetchFromSource.mockResolvedValue({
        path: fetchedDir,
        fromCache: false,
        source: REMOTE_SOURCE,
      });

      await fetchAgentDefinitionsFromRemote(REMOTE_SOURCE, {
        forceRefresh: true,
      });

      expect(mockFetchFromSource).toHaveBeenCalledWith(REMOTE_SOURCE, {
        forceRefresh: true,
        subdir: "",
      });
    });

    it("should throw when remote agents directory does not exist", async () => {
      // Fetched dir exists but has no agents subdirectory
      const fetchedDir = path.join(tempDir, "fetched-empty");
      await mkdir(fetchedDir, { recursive: true });

      mockFetchFromSource.mockResolvedValue({
        path: fetchedDir,
        fromCache: false,
        source: REMOTE_SOURCE,
      });

      await expect(fetchAgentDefinitionsFromRemote(REMOTE_SOURCE)).rejects.toThrow(
        "Agent partials not found at '",
      );
    });

    it("when fetchFromSource throws a network error, should propagate it to caller", async () => {
      mockFetchFromSource.mockRejectedValue(
        new Error("Network error fetching: github:my-org/agents"),
      );

      await expect(fetchAgentDefinitionsFromRemote(REMOTE_SOURCE)).rejects.toThrow(
        "Network error fetching:",
      );
    });

    it("should use custom agentsDir when provided", async () => {
      const fetchedDir = path.join(tempDir, "fetched");
      await mkdir(path.join(fetchedDir, "lib/agents/_templates"), { recursive: true });

      mockFetchFromSource.mockResolvedValue({
        path: fetchedDir,
        fromCache: false,
        source: REMOTE_SOURCE,
      });

      const result = await fetchAgentDefinitionsFromRemote(REMOTE_SOURCE, {
        agentsDir: "lib/agents",
      });

      expect(result.agentsDir).toBe(path.join(fetchedDir, "lib/agents"));
      expect(result.templatesDir).toBe(path.join(fetchedDir, "lib/agents", "_templates"));
    });

    it("should use default DIRS.agents when agentsDir is not provided", async () => {
      const fetchedDir = path.join(tempDir, "fetched");
      await mkdir(path.join(fetchedDir, "src/agents/_templates"), { recursive: true });

      mockFetchFromSource.mockResolvedValue({
        path: fetchedDir,
        fromCache: false,
        source: REMOTE_SOURCE,
      });

      const result = await fetchAgentDefinitionsFromRemote(REMOTE_SOURCE);

      expect(result.agentsDir).toBe(path.join(fetchedDir, "src/agents"));
    });

    it("should succeed even when remote templates directory does not exist", async () => {
      const fetchedDir = path.join(tempDir, "fetched");
      // Create agents dir but NOT templates dir
      await mkdir(path.join(fetchedDir, "src/agents"), { recursive: true });

      mockFetchFromSource.mockResolvedValue({
        path: fetchedDir,
        fromCache: false,
        source: REMOTE_SOURCE,
      });

      const result = await fetchAgentDefinitionsFromRemote(REMOTE_SOURCE);

      expect(result.agentsDir).toBe(path.join(fetchedDir, "src", "agents"));
      expect(result.templatesDir).toBe(path.join(fetchedDir, "src", "agents", "_templates"));
    });
  });

  describe("getAgentDefinitions", () => {
    it("should delegate to fetchAgentDefinitionsFromRemote when remoteSource is provided", async () => {
      const REMOTE_SOURCE = "github:my-org/agents";
      const fetchedDir = path.join(tempDir, "fetched");
      await mkdir(path.join(fetchedDir, "src/agents/_templates"), { recursive: true });

      mockFetchFromSource.mockResolvedValue({
        path: fetchedDir,
        fromCache: false,
        source: REMOTE_SOURCE,
      });

      const result = await getAgentDefinitions(REMOTE_SOURCE);

      expect(mockFetchFromSource).toHaveBeenCalled();
      expect(result.sourcePath).toBe(fetchedDir);
    });

    it("should delegate to getLocalAgentDefinitions when no remoteSource is provided", async () => {
      await createAgentDirStructure(tempDir);

      const result = await getAgentDefinitions();

      expect(mockFetchFromSource).not.toHaveBeenCalled();
      expect(result.sourcePath).toBe(tempDir);
    });

    it("should delegate to getLocalAgentDefinitions when remoteSource is undefined", async () => {
      await createAgentDirStructure(tempDir);

      const result = await getAgentDefinitions(undefined);

      expect(mockFetchFromSource).not.toHaveBeenCalled();
      expect(result.sourcePath).toBe(tempDir);
    });

    it("should pass options through to fetchAgentDefinitionsFromRemote", async () => {
      const REMOTE_SOURCE = "github:my-org/agents";
      const fetchedDir = path.join(tempDir, "fetched");
      await mkdir(path.join(fetchedDir, "src/agents/_templates"), { recursive: true });

      mockFetchFromSource.mockResolvedValue({
        path: fetchedDir,
        fromCache: false,
        source: REMOTE_SOURCE,
      });

      await getAgentDefinitions(REMOTE_SOURCE, { forceRefresh: true });

      expect(mockFetchFromSource).toHaveBeenCalledWith(REMOTE_SOURCE, {
        forceRefresh: true,
        subdir: "",
      });
    });

    it("should pass projectDir option through to getLocalAgentDefinitions", async () => {
      await createAgentDirStructure(tempDir);

      // Create local templates in project dir
      const projectDir = path.join(tempDir, "my-project");
      await mkdir(path.join(projectDir, ".claude/templates"), { recursive: true });

      const result = await getAgentDefinitions(undefined, { projectDir });

      expect(result.templatesDir).toBe(path.join(projectDir, ".claude", "templates"));
    });
  });
});
