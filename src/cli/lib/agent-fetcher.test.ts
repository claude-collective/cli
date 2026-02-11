import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "path";

// Mock dependencies before importing the module under test
vi.mock("../utils/fs", () => ({
  directoryExists: vi.fn(),
}));

vi.mock("../utils/logger", () => ({
  verbose: vi.fn(),
}));

vi.mock("./source-fetcher", () => ({
  fetchFromSource: vi.fn(),
}));

// Mock consts - provide stable values for test assertions
const MOCK_PROJECT_ROOT = "/mock/cli/root";
vi.mock("../consts", () => ({
  PROJECT_ROOT: "/mock/cli/root",
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
import { directoryExists } from "../utils/fs";
import { fetchFromSource } from "./source-fetcher";

const mockDirectoryExists = vi.mocked(directoryExists);
const mockFetchFromSource = vi.mocked(fetchFromSource);

describe("agent-fetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLocalAgentDefinitions", () => {
    it("should return agent source paths when agents directory exists", async () => {
      // Both agents dir and templates dir exist
      mockDirectoryExists.mockResolvedValue(true);

      const result = await getLocalAgentDefinitions();

      expect(result).toEqual({
        agentsDir: path.join(MOCK_PROJECT_ROOT, "src/agents"),
        templatesDir: path.join(MOCK_PROJECT_ROOT, "src/agents/_templates"),
        sourcePath: MOCK_PROJECT_ROOT,
      });
    });

    it("should throw when agents directory does not exist", async () => {
      // First call (agentsDir check) returns false
      mockDirectoryExists.mockResolvedValueOnce(false);

      await expect(getLocalAgentDefinitions()).rejects.toThrow("Agent partials not found at:");
    });

    it("should use local templates when projectDir is provided and local templates exist", async () => {
      const projectDir = "/test/project";
      // agentsDir exists (first call)
      mockDirectoryExists.mockResolvedValueOnce(true);
      // localTemplatesDir exists (second call)
      mockDirectoryExists.mockResolvedValueOnce(true);
      // templatesDir check (third call) - not reached since local templates found
      mockDirectoryExists.mockResolvedValueOnce(true);

      const result = await getLocalAgentDefinitions({ projectDir });

      expect(result.templatesDir).toBe(path.join(projectDir, ".claude", "templates"));
      expect(result.agentsDir).toBe(path.join(MOCK_PROJECT_ROOT, "src/agents"));
      expect(result.sourcePath).toBe(MOCK_PROJECT_ROOT);
    });

    it("should fall back to default templates when local templates directory does not exist", async () => {
      const projectDir = "/test/project";
      // agentsDir exists
      mockDirectoryExists.mockResolvedValueOnce(true);
      // localTemplatesDir does NOT exist
      mockDirectoryExists.mockResolvedValueOnce(false);
      // default templatesDir exists
      mockDirectoryExists.mockResolvedValueOnce(true);

      const result = await getLocalAgentDefinitions({ projectDir });

      expect(result.templatesDir).toBe(path.join(MOCK_PROJECT_ROOT, "src/agents/_templates"));
    });

    it("should still succeed when templates directory does not exist", async () => {
      // agentsDir exists
      mockDirectoryExists.mockResolvedValueOnce(true);
      // templatesDir does NOT exist (verbose warning logged, no error)
      mockDirectoryExists.mockResolvedValueOnce(false);

      const result = await getLocalAgentDefinitions();

      // Should still return paths without throwing
      expect(result.agentsDir).toBe(path.join(MOCK_PROJECT_ROOT, "src/agents"));
      expect(result.templatesDir).toBe(path.join(MOCK_PROJECT_ROOT, "src/agents/_templates"));
    });
  });

  describe("fetchAgentDefinitionsFromRemote", () => {
    const REMOTE_SOURCE = "github:my-org/agents";
    const FETCHED_PATH = "/tmp/cache/fetched";

    it("should fetch agent definitions from remote source", async () => {
      mockFetchFromSource.mockResolvedValue({
        path: FETCHED_PATH,
        fromCache: false,
        source: REMOTE_SOURCE,
      });
      // agentsDir exists
      mockDirectoryExists.mockResolvedValueOnce(true);
      // templatesDir exists
      mockDirectoryExists.mockResolvedValueOnce(true);

      const result = await fetchAgentDefinitionsFromRemote(REMOTE_SOURCE);

      expect(mockFetchFromSource).toHaveBeenCalledWith(REMOTE_SOURCE, {
        forceRefresh: undefined,
        subdir: "",
      });
      expect(result).toEqual({
        agentsDir: path.join(FETCHED_PATH, "src", "agents"),
        templatesDir: path.join(FETCHED_PATH, "src", "agents", "_templates"),
        sourcePath: FETCHED_PATH,
      });
    });

    it("should pass forceRefresh option to fetchFromSource", async () => {
      mockFetchFromSource.mockResolvedValue({
        path: FETCHED_PATH,
        fromCache: false,
        source: REMOTE_SOURCE,
      });
      mockDirectoryExists.mockResolvedValue(true);

      await fetchAgentDefinitionsFromRemote(REMOTE_SOURCE, {
        forceRefresh: true,
      });

      expect(mockFetchFromSource).toHaveBeenCalledWith(REMOTE_SOURCE, {
        forceRefresh: true,
        subdir: "",
      });
    });

    it("should throw when remote agents directory does not exist", async () => {
      mockFetchFromSource.mockResolvedValue({
        path: FETCHED_PATH,
        fromCache: false,
        source: REMOTE_SOURCE,
      });
      // agentsDir does NOT exist
      mockDirectoryExists.mockResolvedValueOnce(false);

      await expect(fetchAgentDefinitionsFromRemote(REMOTE_SOURCE)).rejects.toThrow(
        "Agent partials not found at:",
      );
    });

    it("should propagate network errors from fetchFromSource", async () => {
      mockFetchFromSource.mockRejectedValue(
        new Error("Network error fetching: github:my-org/agents"),
      );

      await expect(fetchAgentDefinitionsFromRemote(REMOTE_SOURCE)).rejects.toThrow(
        "Network error fetching:",
      );
    });

    it("should succeed even when remote templates directory does not exist", async () => {
      mockFetchFromSource.mockResolvedValue({
        path: FETCHED_PATH,
        fromCache: false,
        source: REMOTE_SOURCE,
      });
      // agentsDir exists
      mockDirectoryExists.mockResolvedValueOnce(true);
      // templatesDir does NOT exist (verbose warning, no error)
      mockDirectoryExists.mockResolvedValueOnce(false);

      const result = await fetchAgentDefinitionsFromRemote(REMOTE_SOURCE);

      expect(result.agentsDir).toBe(path.join(FETCHED_PATH, "src", "agents"));
      expect(result.templatesDir).toBe(path.join(FETCHED_PATH, "src", "agents", "_templates"));
    });
  });

  describe("getAgentDefinitions", () => {
    it("should delegate to fetchAgentDefinitionsFromRemote when remoteSource is provided", async () => {
      const REMOTE_SOURCE = "github:my-org/agents";
      const FETCHED_PATH = "/tmp/cache/fetched";

      mockFetchFromSource.mockResolvedValue({
        path: FETCHED_PATH,
        fromCache: false,
        source: REMOTE_SOURCE,
      });
      mockDirectoryExists.mockResolvedValue(true);

      const result = await getAgentDefinitions(REMOTE_SOURCE);

      expect(mockFetchFromSource).toHaveBeenCalled();
      expect(result.sourcePath).toBe(FETCHED_PATH);
    });

    it("should delegate to getLocalAgentDefinitions when no remoteSource is provided", async () => {
      mockDirectoryExists.mockResolvedValue(true);

      const result = await getAgentDefinitions();

      expect(mockFetchFromSource).not.toHaveBeenCalled();
      expect(result.sourcePath).toBe(MOCK_PROJECT_ROOT);
    });

    it("should delegate to getLocalAgentDefinitions when remoteSource is undefined", async () => {
      mockDirectoryExists.mockResolvedValue(true);

      const result = await getAgentDefinitions(undefined);

      expect(mockFetchFromSource).not.toHaveBeenCalled();
      expect(result.sourcePath).toBe(MOCK_PROJECT_ROOT);
    });

    it("should pass options through to fetchAgentDefinitionsFromRemote", async () => {
      const REMOTE_SOURCE = "github:my-org/agents";
      const FETCHED_PATH = "/tmp/cache/fetched";

      mockFetchFromSource.mockResolvedValue({
        path: FETCHED_PATH,
        fromCache: false,
        source: REMOTE_SOURCE,
      });
      mockDirectoryExists.mockResolvedValue(true);

      await getAgentDefinitions(REMOTE_SOURCE, { forceRefresh: true });

      expect(mockFetchFromSource).toHaveBeenCalledWith(REMOTE_SOURCE, {
        forceRefresh: true,
        subdir: "",
      });
    });

    it("should pass projectDir option through to getLocalAgentDefinitions", async () => {
      const projectDir = "/test/project";

      // agentsDir exists
      mockDirectoryExists.mockResolvedValueOnce(true);
      // localTemplatesDir exists
      mockDirectoryExists.mockResolvedValueOnce(true);
      // default templatesDir (not reached)
      mockDirectoryExists.mockResolvedValueOnce(true);

      const result = await getAgentDefinitions(undefined, { projectDir });

      expect(result.templatesDir).toBe(path.join(projectDir, ".claude", "templates"));
    });
  });
});
