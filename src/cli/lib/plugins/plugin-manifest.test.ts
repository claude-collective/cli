import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { readFile, stat } from "fs/promises";
import {
  generateAgentPluginManifest,
  generateSkillPluginManifest,
  generateStackPluginManifest,
  writePluginManifest,
  getPluginDir,
  getPluginManifestPath,
} from "./plugin-manifest";
import { PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE } from "../../consts";
import { createTempDir, cleanupTempDir } from "../__tests__/helpers";

describe("plugin-manifest", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("plugin-manifest-test-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("generateSkillPluginManifest", () => {
    it("should generate manifest with skill name as plugin name (no prefix)", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        category: "web-framework",
      });

      expect(manifest.name).toBe("react");
    });

    it("should include skills path", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        category: "web-framework",
      });

      expect(manifest.skills).toBe("./skills/");
    });

    it("should not include agents path", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        category: "web-framework",
      });

      expect(manifest.agents).toBeUndefined();
    });

    it("should include author when provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        category: "web-framework",
        author: "@vince",
        authorEmail: "vince@example.com",
      });

      expect(manifest.author).toEqual({
        name: "@vince",
        email: "vince@example.com",
      });
    });

    it("should include author without email when only name provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        category: "web-framework",
        author: "@vince",
      });

      expect(manifest.author).toEqual({ name: "@vince" });
    });

    it("should include keywords when provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        category: "web-framework",
        keywords: ["web", "ui", "framework"],
      });

      expect(manifest.keywords).toEqual(["web", "ui", "framework"]);
    });

    it("should not include keywords when empty array", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        category: "web-framework",
        keywords: [],
      });

      expect(manifest.keywords).toBeUndefined();
    });

    it("should include description when provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        category: "web-framework",
        description: "React skills for frontend development",
      });

      expect(manifest.description).toBe("React skills for frontend development");
    });

    it("should use custom version when provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        category: "web-framework",
        version: "2.5.0",
      });

      expect(manifest.version).toBe("2.5.0");
    });

    it("should default to version 1.0.0", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        category: "web-framework",
      });

      expect(manifest.version).toBe("1.0.0");
    });

    it("should not include author when author name is not provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        category: "web-framework",
        authorEmail: "orphan@example.com",
      });

      expect(manifest.author).toBeUndefined();
    });

    it("should not include description when not provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        category: "web-framework",
      });

      expect(manifest.description).toBeUndefined();
    });

    it("should not include keywords when not provided", () => {
      const manifest = generateSkillPluginManifest({
        skillName: "react",
        category: "web-framework",
      });

      expect(manifest.keywords).toBeUndefined();
    });
  });

  describe("generateAgentPluginManifest", () => {
    it("should generate manifest with agent- prefix", () => {
      const manifest = generateAgentPluginManifest({
        agentName: "web-developer",
        category: "meta-reviewing",
      });

      expect(manifest.name).toBe("agent-web-developer");
    });

    it("should include agents path", () => {
      const manifest = generateAgentPluginManifest({
        agentName: "web-developer",
        category: "meta-reviewing",
      });

      expect(manifest.agents).toBe("./agents/");
    });

    it("should not include skills path", () => {
      const manifest = generateAgentPluginManifest({
        agentName: "web-developer",
        category: "meta-reviewing",
      });

      expect(manifest.skills).toBeUndefined();
    });

    it("should default to version 1.0.0", () => {
      const manifest = generateAgentPluginManifest({
        agentName: "web-developer",
        category: "meta-reviewing",
      });

      expect(manifest.version).toBe("1.0.0");
    });

    it("should use custom version when provided", () => {
      const manifest = generateAgentPluginManifest({
        agentName: "web-developer",
        version: "2.0.0",
        category: "meta-reviewing",
      });

      expect(manifest.version).toBe("2.0.0");
    });

    it("should include description when provided", () => {
      const manifest = generateAgentPluginManifest({
        agentName: "web-developer",
        description: "Agent for web development tasks",
        category: "meta-reviewing",
      });

      expect(manifest.description).toBe("Agent for web development tasks");
    });

    it("should not include description when not provided", () => {
      const manifest = generateAgentPluginManifest({
        agentName: "web-developer",
        category: "meta-reviewing",
      });

      expect(manifest.description).toBeUndefined();
    });

    it("should not include author field", () => {
      const manifest = generateAgentPluginManifest({
        agentName: "web-developer",
        category: "meta-reviewing",
      });

      expect(manifest.author).toBeUndefined();
    });

    it("should not include keywords field", () => {
      const manifest = generateAgentPluginManifest({
        agentName: "web-developer",
        category: "meta-reviewing",
      });

      expect(manifest.keywords).toBeUndefined();
    });

    it("should not include hooks field", () => {
      const manifest = generateAgentPluginManifest({
        agentName: "web-developer",
        category: "meta-reviewing",
      });

      expect(manifest.hooks).toBeUndefined();
    });
  });

  describe("generateStackPluginManifest", () => {
    it("should generate manifest without skill- prefix", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        category: "web-meta-framework",
      });

      expect(manifest.name).toBe("nextjs-fullstack");
    });

    it("should not include agents even when hasAgents is true (Claude Code discovers agents automatically)", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        hasAgents: true,
        category: "web-meta-framework",
      });

      expect(manifest.agents).toBeUndefined();
    });

    it("should not include agents when hasAgents is false", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        hasAgents: false,
        category: "web-meta-framework",
      });

      expect(manifest.agents).toBeUndefined();
    });

    it("should not include agents when hasAgents is undefined", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        category: "web-meta-framework",
      });

      expect(manifest.agents).toBeUndefined();
    });

    it("should include hooks when hasHooks is true", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        hasHooks: true,
        category: "web-meta-framework",
      });

      expect(manifest.hooks).toBe("./hooks/hooks.json");
    });

    it("should not include hooks when hasHooks is false", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        hasHooks: false,
        category: "web-meta-framework",
      });

      expect(manifest.hooks).toBeUndefined();
    });

    it("should not include skills when hasSkills is undefined", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        category: "web-meta-framework",
      });

      expect(manifest.skills).toBeUndefined();
    });

    it("should include skills path when hasSkills is true", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        hasSkills: true,
        category: "web-meta-framework",
      });

      expect(manifest.skills).toBe("./skills/");
    });

    it("should not include skills when hasSkills is false", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        hasSkills: false,
        category: "web-meta-framework",
      });

      expect(manifest.skills).toBeUndefined();
    });

    it("should include author when provided", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        author: "@claude",
        authorEmail: "claude@example.com",
        category: "web-meta-framework",
      });

      expect(manifest.author).toEqual({
        name: "@claude",
        email: "claude@example.com",
      });
    });

    it("should include keywords when provided", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        keywords: ["web", "react", "stack"],
        category: "web-meta-framework",
      });

      expect(manifest.keywords).toEqual(["web", "react", "stack"]);
    });

    it("should default to version 1.0.0", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        category: "web-meta-framework",
      });

      expect(manifest.version).toBe("1.0.0");
    });

    it("should use custom version when provided", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        version: "3.2.1",
        category: "web-meta-framework",
      });

      expect(manifest.version).toBe("3.2.1");
    });

    it("should include author without email when only name provided", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        author: "@claude",
        category: "web-meta-framework",
      });

      expect(manifest.author).toEqual({ name: "@claude" });
    });

    it("should not include author when author name is not provided", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        authorEmail: "orphan@example.com",
        category: "web-meta-framework",
      });

      expect(manifest.author).toBeUndefined();
    });

    it("should not include keywords when empty array", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        keywords: [],
        category: "web-meta-framework",
      });

      expect(manifest.keywords).toBeUndefined();
    });

    it("should include description when provided", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        description: "Full-stack Next.js development",
        category: "web-meta-framework",
      });

      expect(manifest.description).toBe("Full-stack Next.js development");
    });

    it("should not include description when not provided", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        category: "web-meta-framework",
      });

      expect(manifest.description).toBeUndefined();
    });

    it("should not include hooks when hasHooks is undefined", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        category: "web-meta-framework",
      });

      expect(manifest.hooks).toBeUndefined();
    });

    it("should generate manifest with all options populated", () => {
      const manifest = generateStackPluginManifest({
        stackName: "nextjs-fullstack",
        description: "Full-stack Next.js",
        author: "@claude",
        authorEmail: "claude@example.com",
        version: "2.0.0",
        keywords: ["web", "react"],
        category: "web-meta-framework",
        hasSkills: true,
        hasAgents: true,
        hasHooks: true,
      });

      expect(manifest.name).toBe("nextjs-fullstack");
      expect(manifest.version).toBe("2.0.0");
      expect(manifest.description).toBe("Full-stack Next.js");
      expect(manifest.author).toEqual({ name: "@claude", email: "claude@example.com" });
      expect(manifest.keywords).toEqual(["web", "react"]);
      expect(manifest.skills).toBe("./skills/");
      expect(manifest.agents).toBeUndefined();
      expect(manifest.hooks).toBe("./hooks/hooks.json");
    });
  });

  describe("writePluginManifest", () => {
    it("should create .claude-plugin directory", async () => {
      const manifest = generateSkillPluginManifest({ skillName: "test", category: "web-testing" });

      await writePluginManifest(tempDir, manifest);

      const pluginDir = path.join(tempDir, PLUGIN_MANIFEST_DIR);
      const stats = await stat(pluginDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should write valid JSON", async () => {
      const manifest = generateSkillPluginManifest({
        skillName: "test",
        description: "Test skill",
        category: "web-testing",
      });

      await writePluginManifest(tempDir, manifest);

      const manifestPath = path.join(tempDir, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE);
      const content = await readFile(manifestPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe("test");
      expect(parsed.description).toBe("Test skill");
    });

    it("should overwrite existing manifest", async () => {
      const manifest1 = generateSkillPluginManifest({
        skillName: "original",
        category: "web-framework",
      });
      const manifest2 = generateSkillPluginManifest({
        skillName: "updated",
        category: "web-framework",
      });

      await writePluginManifest(tempDir, manifest1);
      await writePluginManifest(tempDir, manifest2);

      const manifestPath = path.join(tempDir, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE);
      const content = await readFile(manifestPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.name).toBe("updated");
    });

    it("should return the manifest path", async () => {
      const manifest = generateSkillPluginManifest({ skillName: "test", category: "web-testing" });

      const result = await writePluginManifest(tempDir, manifest);

      expect(result).toBe(path.join(tempDir, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE));
    });

    it("should preserve all manifest fields in written JSON", async () => {
      const manifest = generateStackPluginManifest({
        stackName: "fullstack",
        description: "Full-stack plugin",
        author: "@claude",
        authorEmail: "claude@example.com",
        version: "2.0.0",
        keywords: ["web", "react"],
        category: "web-meta-framework",
        hasSkills: true,
        hasHooks: true,
      });

      await writePluginManifest(tempDir, manifest);

      const manifestPath = path.join(tempDir, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE);
      const content = await readFile(manifestPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed).toEqual({
        name: "fullstack",
        version: "2.0.0",
        category: "web-meta-framework",
        skills: "./skills/",
        description: "Full-stack plugin",
        author: { name: "@claude", email: "claude@example.com" },
        keywords: ["web", "react"],
        hooks: "./hooks/hooks.json",
      });
    });

    it("should format JSON with 2-space indentation", async () => {
      const manifest = generateSkillPluginManifest({
        skillName: "test",
        description: "Test description",
        category: "web-testing",
      });

      await writePluginManifest(tempDir, manifest);

      const manifestPath = path.join(tempDir, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE);
      const content = await readFile(manifestPath, "utf-8");

      expect(content).toContain('  "name"');
      expect(content).toContain('  "description"');
    });
  });

  describe("getPluginDir", () => {
    it("should return .claude-plugin subdirectory", () => {
      const result = getPluginDir("/some/output/dir");

      expect(result).toBe("/some/output/dir/.claude-plugin");
    });

    it("should handle paths with trailing slash", () => {
      const result = getPluginDir("/some/output/dir/");

      expect(result).toBe("/some/output/dir/.claude-plugin");
    });

    it("should handle relative paths", () => {
      const result = getPluginDir("dist/plugins");

      expect(result).toBe(path.join("dist/plugins", PLUGIN_MANIFEST_DIR));
    });
  });

  describe("getPluginManifestPath", () => {
    it("should return path to plugin.json", () => {
      const result = getPluginManifestPath("/some/output/dir");

      expect(result).toBe("/some/output/dir/.claude-plugin/plugin.json");
    });

    it("should handle paths with trailing slash", () => {
      const result = getPluginManifestPath("/some/output/dir/");

      expect(result).toBe("/some/output/dir/.claude-plugin/plugin.json");
    });

    it("should handle relative paths", () => {
      const result = getPluginManifestPath("dist/plugins");

      expect(result).toBe(path.join("dist/plugins", PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE));
    });
  });
});
