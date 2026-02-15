import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "fs/promises";
import {
  compileAgentPlugin,
  compileAllAgentPlugins,
  printAgentCompilationSummary,
} from "./agent-plugin-compiler";

describe("agent-plugin-compiler", () => {
  let tempDir: string;
  let agentsDir: string;
  let outputDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "agent-compiler-test-"));
    agentsDir = path.join(tempDir, "agents");
    outputDir = path.join(tempDir, "output");
    await mkdir(agentsDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function createAgentMd(
    name: string,
    description: string,
    body = "# Agent Content",
    extraFrontmatter = "",
  ): string {
    const extra = extraFrontmatter ? `\n${extraFrontmatter}` : "";
    return `---\nname: ${name}\ndescription: ${description}${extra}\n---\n\n${body}`;
  }

  describe("compileAgentPlugin", () => {
    it("should compile a single agent into a plugin", async () => {
      const agentPath = path.join(agentsDir, "web-developer.md");
      await writeFile(agentPath, createAgentMd("web-developer", "Expert frontend developer"));

      const result = await compileAgentPlugin({
        agentPath,
        outputDir,
      });

      expect(result.agentName).toBe("web-developer");
      expect(result.manifest.name).toBe("agent-web-developer");
      expect(result.manifest.version).toBe("1.0.0");

      const stats = await stat(result.pluginPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should create correct directory structure", async () => {
      const agentPath = path.join(agentsDir, "cli-developer.md");
      await writeFile(agentPath, createAgentMd("cli-developer", "CLI development agent"));

      const result = await compileAgentPlugin({
        agentPath,
        outputDir,
      });

      // Check .claude-plugin/plugin.json exists
      const manifestPath = path.join(result.pluginPath, ".claude-plugin", "plugin.json");
      const manifestStats = await stat(manifestPath);
      expect(manifestStats.isFile()).toBe(true);

      // Check agents/{name}.md exists
      const agentMdPath = path.join(result.pluginPath, "agents", "cli-developer.md");
      const agentStats = await stat(agentMdPath);
      expect(agentStats.isFile()).toBe(true);
    });

    it("should generate valid plugin.json with agents path", async () => {
      const agentPath = path.join(agentsDir, "api-developer.md");
      await writeFile(agentPath, createAgentMd("api-developer", "Backend API developer"));

      const result = await compileAgentPlugin({
        agentPath,
        outputDir,
      });

      const manifestPath = path.join(result.pluginPath, ".claude-plugin", "plugin.json");
      const content = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(content);

      expect(manifest.name).toBe("agent-api-developer");
      expect(manifest.version).toBe("1.0.0");
      expect(manifest.agents).toBe("./agents/");
      expect(manifest.description).toBe("Backend API developer");
    });

    it("should read name and description from frontmatter", async () => {
      const agentPath = path.join(agentsDir, "my-agent.md");
      await writeFile(agentPath, createAgentMd("custom-agent", "A custom agent for testing"));

      const result = await compileAgentPlugin({
        agentPath,
        outputDir,
      });

      expect(result.agentName).toBe("custom-agent");
      expect(result.manifest.description).toBe("A custom agent for testing");
    });

    it("should copy agent .md file to agents/ subdirectory", async () => {
      const body = "# Web Developer\n\nYou are an expert frontend developer.";
      const agentPath = path.join(agentsDir, "web-dev.md");
      await writeFile(agentPath, createAgentMd("web-dev", "Frontend developer agent", body));

      const result = await compileAgentPlugin({
        agentPath,
        outputDir,
      });

      const copiedPath = path.join(result.pluginPath, "agents", "web-dev.md");
      const content = await readFile(copiedPath, "utf-8");

      expect(content).toContain("name: web-dev");
      expect(content).toContain("description: Frontend developer agent");
      expect(content).toContain("# Web Developer");
      expect(content).toContain("You are an expert frontend developer.");
    });

    it("should throw error when frontmatter is missing", async () => {
      const agentPath = path.join(agentsDir, "bad-agent.md");
      await writeFile(agentPath, "# No frontmatter here");

      await expect(compileAgentPlugin({ agentPath, outputDir })).rejects.toThrow(
        /has invalid or missing YAML frontmatter/,
      );
    });

    it("should throw error when frontmatter is missing required fields", async () => {
      const agentPath = path.join(agentsDir, "incomplete.md");
      await writeFile(agentPath, "---\nname: incomplete\n---\n\n# Agent");

      await expect(compileAgentPlugin({ agentPath, outputDir })).rejects.toThrow(
        /has invalid or missing YAML frontmatter/,
      );
    });

    it("should bump version on content change", async () => {
      const agentPath = path.join(agentsDir, "versioned.md");
      await writeFile(agentPath, createAgentMd("versioned", "Versioned agent", "# Version 1"));

      // First compile
      const result1 = await compileAgentPlugin({ agentPath, outputDir });
      expect(result1.manifest.version).toBe("1.0.0");

      // Recompile without changes - version stays the same
      const result2 = await compileAgentPlugin({ agentPath, outputDir });
      expect(result2.manifest.version).toBe("1.0.0");

      // Modify content
      await writeFile(
        agentPath,
        createAgentMd("versioned", "Versioned agent", "# Version 2 - updated"),
      );

      // Recompile with changes - version should bump
      const result3 = await compileAgentPlugin({ agentPath, outputDir });
      expect(result3.manifest.version).toBe("2.0.0");
    });
  });

  describe("compileAllAgentPlugins", () => {
    it("should compile all agent .md files from directory", async () => {
      await writeFile(
        path.join(agentsDir, "web-developer.md"),
        createAgentMd("web-developer", "Frontend developer"),
      );
      await writeFile(
        path.join(agentsDir, "api-developer.md"),
        createAgentMd("api-developer", "Backend developer"),
      );
      await writeFile(
        path.join(agentsDir, "cli-developer.md"),
        createAgentMd("cli-developer", "CLI developer"),
      );

      const results = await compileAllAgentPlugins(agentsDir, outputDir);

      expect(results).toHaveLength(3);
      const agentNames = results.map((r) => r.agentName);
      expect(agentNames).toContain("web-developer");
      expect(agentNames).toContain("api-developer");
      expect(agentNames).toContain("cli-developer");
    });

    it("should handle empty agents directory", async () => {
      const results = await compileAllAgentPlugins(agentsDir, outputDir);
      expect(results).toHaveLength(0);
    });

    it("should warn and skip agents with missing frontmatter", async () => {
      await writeFile(
        path.join(agentsDir, "good-agent.md"),
        createAgentMd("good-agent", "A good agent"),
      );
      await writeFile(path.join(agentsDir, "bad-agent.md"), "# No frontmatter here");

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const results = await compileAllAgentPlugins(agentsDir, outputDir);

      expect(results).toHaveLength(1);
      expect(results[0].agentName).toBe("good-agent");

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Warning:"));

      consoleSpy.mockRestore();
    });

    it("should create plugin directories for each agent", async () => {
      await writeFile(path.join(agentsDir, "alpha.md"), createAgentMd("alpha", "Alpha agent"));
      await writeFile(path.join(agentsDir, "beta.md"), createAgentMd("beta", "Beta agent"));

      const results = await compileAllAgentPlugins(agentsDir, outputDir);

      for (const result of results) {
        const stats = await stat(result.pluginPath);
        expect(stats.isDirectory()).toBe(true);

        const manifestPath = path.join(result.pluginPath, ".claude-plugin", "plugin.json");
        const manifestStats = await stat(manifestPath);
        expect(manifestStats.isFile()).toBe(true);
      }
    });

    it("should log success messages for compiled agents", async () => {
      await writeFile(
        path.join(agentsDir, "web-developer.md"),
        createAgentMd("web-developer", "Frontend developer"),
      );

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await compileAllAgentPlugins(agentsDir, outputDir);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[OK]"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("agent-web-developer"));

      consoleSpy.mockRestore();
    });
  });

  describe("printAgentCompilationSummary", () => {
    it("should print count of compiled agent plugins", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const results = [
        {
          pluginPath: "/out/agent-web-developer",
          manifest: { name: "agent-web-developer", version: "1.0.0" },
          agentName: "web-developer",
        },
        {
          pluginPath: "/out/agent-api-developer",
          manifest: { name: "agent-api-developer", version: "2.0.0" },
          agentName: "api-developer",
        },
      ];

      printAgentCompilationSummary(results);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Compiled 2 agent plugins"));

      consoleSpy.mockRestore();
    });

    it("should print each agent name with version", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const results = [
        {
          pluginPath: "/out/agent-web-developer",
          manifest: { name: "agent-web-developer", version: "1.0.0" },
          agentName: "web-developer",
        },
      ];

      printAgentCompilationSummary(results);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("agent-web-developer"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("v1.0.0"));

      consoleSpy.mockRestore();
    });

    it("should handle empty results array", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      printAgentCompilationSummary([]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Compiled 0 agent plugins"));

      consoleSpy.mockRestore();
    });
  });
});
