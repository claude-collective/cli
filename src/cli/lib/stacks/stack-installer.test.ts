import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CompiledStackPlugin } from "./stack-plugin-compiler";
import type { AgentName, SkillId } from "../../types";

// Mock dependencies before imports
vi.mock("./stack-plugin-compiler", () => ({
  compileStackPlugin: vi.fn(),
}));

vi.mock("../../utils/exec", () => ({
  claudePluginInstall: vi.fn(),
  isClaudeCLIAvailable: vi.fn(),
}));

vi.mock("../../utils/fs");
vi.mock("../../utils/logger");

import { compileStackToTemp, installStackAsPlugin } from "./stack-installer";
import { compileStackPlugin } from "./stack-plugin-compiler";
import { claudePluginInstall, isClaudeCLIAvailable } from "../../utils/exec";
import { ensureDir, remove } from "../../utils/fs";

function createMockCompiledResult(overrides?: Partial<CompiledStackPlugin>): CompiledStackPlugin {
  return {
    pluginPath: "/tmp/cc-stack-123456/test-stack",
    manifest: { name: "test-stack", version: "1.0.0" },
    stackName: "Test Stack",
    agents: ["web-developer"] as AgentName[],
    skillPlugins: ["web-framework-react"] as SkillId[],
    hasHooks: false,
    ...overrides,
  };
}

describe("stack-installer", () => {
  beforeEach(() => {
    // Set default mock return values
    vi.mocked(isClaudeCLIAvailable).mockResolvedValue(true);
    vi.mocked(claudePluginInstall).mockResolvedValue(undefined);
    vi.mocked(ensureDir).mockResolvedValue(undefined);
    vi.mocked(remove).mockResolvedValue(undefined);
  });

  describe("compileStackToTemp", () => {
    it("should create a temp directory and compile the stack", async () => {
      const mockResult = createMockCompiledResult();
      vi.mocked(compileStackPlugin).mockResolvedValue(mockResult);

      const { result } = await compileStackToTemp({
        stackId: "test-stack",
        projectRoot: "/project",
      });

      expect(ensureDir).toHaveBeenCalledWith(expect.stringContaining("cc-stack-"));
      expect(compileStackPlugin).toHaveBeenCalledWith(
        expect.objectContaining({
          stackId: "test-stack",
          projectRoot: "/project",
          outputDir: expect.stringContaining("cc-stack-"),
        }),
      );
      expect(result).toBe(mockResult);
    });

    it("should pass agentSourcePath through to compileStackPlugin", async () => {
      const mockResult = createMockCompiledResult();
      vi.mocked(compileStackPlugin).mockResolvedValue(mockResult);

      await compileStackToTemp({
        stackId: "test-stack",
        projectRoot: "/project",
        agentSourcePath: "/custom/agents",
      });

      expect(compileStackPlugin).toHaveBeenCalledWith(
        expect.objectContaining({
          agentSourcePath: "/custom/agents",
        }),
      );
    });

    it("should return a cleanup function that removes the temp directory", async () => {
      const mockResult = createMockCompiledResult();
      vi.mocked(compileStackPlugin).mockResolvedValue(mockResult);

      const { cleanup } = await compileStackToTemp({
        stackId: "test-stack",
        projectRoot: "/project",
      });

      // Cleanup not called yet
      expect(remove).not.toHaveBeenCalled();

      await cleanup();

      // Now remove should be called with the temp directory
      expect(remove).toHaveBeenCalledWith(expect.stringContaining("cc-stack-"));
    });

    it("should use os.tmpdir() as base for the temp directory", async () => {
      const mockResult = createMockCompiledResult();
      vi.mocked(compileStackPlugin).mockResolvedValue(mockResult);

      await compileStackToTemp({
        stackId: "test-stack",
        projectRoot: "/project",
      });

      const ensureDirCall = vi.mocked(ensureDir).mock.calls[0][0];
      // Should start with the system temp directory
      expect(ensureDirCall).toMatch(/^\/tmp/);
    });

    it("should propagate compilation errors", async () => {
      vi.mocked(compileStackPlugin).mockRejectedValue(
        new Error("Stack 'nonexistent' not found in config/stacks.yaml"),
      );

      await expect(
        compileStackToTemp({
          stackId: "nonexistent",
          projectRoot: "/project",
        }),
      ).rejects.toThrow("Stack 'nonexistent' not found in config/stacks.yaml");
    });
  });

  describe("installStackAsPlugin", () => {
    it("should throw when Claude CLI is not available", async () => {
      vi.mocked(isClaudeCLIAvailable).mockResolvedValue(false);

      await expect(
        installStackAsPlugin({
          stackId: "test-stack",
          projectDir: "/project",
          sourcePath: "/source",
          agentSourcePath: "/agents",
        }),
      ).rejects.toThrow("Claude CLI not found");
    });

    it("should check Claude CLI availability before anything else", async () => {
      vi.mocked(isClaudeCLIAvailable).mockResolvedValue(false);

      try {
        await installStackAsPlugin({
          stackId: "test-stack",
          projectDir: "/project",
          sourcePath: "/source",
          agentSourcePath: "/agents",
        });
      } catch {
        // Expected to throw
      }

      expect(isClaudeCLIAvailable).toHaveBeenCalled();
      // compileStackPlugin should NOT have been called
      expect(compileStackPlugin).not.toHaveBeenCalled();
    });

    it("should install from marketplace when marketplace option is provided", async () => {
      const result = await installStackAsPlugin({
        stackId: "test-stack",
        projectDir: "/project",
        sourcePath: "/source",
        agentSourcePath: "/agents",
        marketplace: "my-marketplace",
      });

      expect(claudePluginInstall).toHaveBeenCalledWith(
        "test-stack@my-marketplace",
        "project",
        "/project",
      );
      expect(result.fromMarketplace).toBe(true);
      expect(result.pluginName).toBe("test-stack");
      expect(result.stackName).toBe("test-stack");
      expect(result.pluginPath).toBe("test-stack@my-marketplace");
      expect(result.agents).toEqual([]);
      expect(result.skills).toEqual([]);
    });

    it("should skip local compilation when marketplace is specified", async () => {
      await installStackAsPlugin({
        stackId: "test-stack",
        projectDir: "/project",
        sourcePath: "/source",
        agentSourcePath: "/agents",
        marketplace: "my-marketplace",
      });

      // Should NOT compile locally
      expect(compileStackPlugin).not.toHaveBeenCalled();
    });

    it("should compile locally and install when no marketplace is specified", async () => {
      const mockResult = createMockCompiledResult({
        pluginPath: "/tmp/cc-stack-999/test-stack",
        stackName: "Test Stack",
        agents: ["web-developer", "api-developer"] as AgentName[],
        skillPlugins: ["web-framework-react", "web-state-zustand"] as SkillId[],
      });
      vi.mocked(compileStackPlugin).mockResolvedValue(mockResult);

      const result = await installStackAsPlugin({
        stackId: "test-stack",
        projectDir: "/project",
        sourcePath: "/source",
        agentSourcePath: "/agents",
      });

      // Should compile the stack
      expect(compileStackPlugin).toHaveBeenCalledWith(
        expect.objectContaining({
          stackId: "test-stack",
          projectRoot: "/source",
          agentSourcePath: "/agents",
        }),
      );

      // Should install using claude CLI
      expect(claudePluginInstall).toHaveBeenCalledWith(
        "/tmp/cc-stack-999/test-stack",
        "project",
        "/project",
      );

      // Should return correct result
      expect(result.fromMarketplace).toBe(false);
      expect(result.pluginName).toBe("stack-test-stack");
      expect(result.stackName).toBe("Test Stack");
      expect(result.agents).toEqual(["web-developer", "api-developer"]);
      expect(result.skills).toEqual(["web-framework-react", "web-state-zustand"]);
      expect(result.pluginPath).toBe("/tmp/cc-stack-999/test-stack");
    });

    it("should clean up temp directory after successful installation", async () => {
      const mockResult = createMockCompiledResult();
      vi.mocked(compileStackPlugin).mockResolvedValue(mockResult);

      await installStackAsPlugin({
        stackId: "test-stack",
        projectDir: "/project",
        sourcePath: "/source",
        agentSourcePath: "/agents",
      });

      // Cleanup should have been called (remove on the temp dir)
      expect(remove).toHaveBeenCalledWith(expect.stringContaining("cc-stack-"));
    });

    it("should clean up temp directory even when installation fails", async () => {
      const mockResult = createMockCompiledResult();
      vi.mocked(compileStackPlugin).mockResolvedValue(mockResult);
      vi.mocked(claudePluginInstall).mockRejectedValue(
        new Error("Plugin installation failed: permission denied"),
      );

      await expect(
        installStackAsPlugin({
          stackId: "test-stack",
          projectDir: "/project",
          sourcePath: "/source",
          agentSourcePath: "/agents",
        }),
      ).rejects.toThrow("Plugin installation failed");

      // Cleanup should still be called (finally block)
      expect(remove).toHaveBeenCalledWith(expect.stringContaining("cc-stack-"));
    });

    it("should propagate compilation errors without cleanup attempt on compile failure", async () => {
      // When compileStackToTemp itself fails (before the try/finally block),
      // ensureDir is called but compileStackPlugin throws before cleanup is set up
      vi.mocked(compileStackPlugin).mockRejectedValue(new Error("Stack 'bad-stack' not found"));

      await expect(
        installStackAsPlugin({
          stackId: "bad-stack",
          projectDir: "/project",
          sourcePath: "/source",
          agentSourcePath: "/agents",
        }),
      ).rejects.toThrow("Stack 'bad-stack' not found");
    });
  });
});
