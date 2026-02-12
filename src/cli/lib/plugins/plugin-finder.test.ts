import { describe, it, expect, vi } from "vitest";
import path from "path";
import os from "os";
import {
  getUserPluginsDir,
  getCollectivePluginDir,
  getProjectPluginsDir,
  getPluginSkillsDir,
  getPluginAgentsDir,
  getPluginManifestPath,
  readPluginManifest,
  getPluginSkillIds,
} from "./plugin-finder";
import type { PluginManifest, SkillId } from "../../types";
import { createMockMatrix, createMockSkill } from "../__tests__/helpers";

vi.mock("../../utils/fs");
vi.mock("../../utils/logger");

import { fileExists, readFile, glob } from "../../utils/fs";

const mockedFileExists = vi.mocked(fileExists);
const mockedReadFile = vi.mocked(readFile);
const mockedGlob = vi.mocked(glob);

const CLAUDE_DIR = ".claude";
const PLUGINS_SUBDIR = "plugins";

describe("plugin-finder", () => {
  describe("getUserPluginsDir", () => {
    it("should return path under user home directory", () => {
      const result = getUserPluginsDir();

      expect(result).toBe(path.join(os.homedir(), CLAUDE_DIR, PLUGINS_SUBDIR));
    });
  });

  describe("getCollectivePluginDir", () => {
    it("should return path under provided project directory", () => {
      const result = getCollectivePluginDir("/my/project");

      expect(result).toBe(
        path.join("/my/project", CLAUDE_DIR, PLUGINS_SUBDIR, "claude-collective"),
      );
    });

    it("should default to process.cwd() when no projectDir is provided", () => {
      const result = getCollectivePluginDir();

      expect(result).toBe(
        path.join(process.cwd(), CLAUDE_DIR, PLUGINS_SUBDIR, "claude-collective"),
      );
    });
  });

  describe("getProjectPluginsDir", () => {
    it("should return plugins directory under provided project directory", () => {
      const result = getProjectPluginsDir("/my/project");

      expect(result).toBe(path.join("/my/project", CLAUDE_DIR, PLUGINS_SUBDIR));
    });

    it("should default to process.cwd() when no projectDir is provided", () => {
      const result = getProjectPluginsDir();

      expect(result).toBe(path.join(process.cwd(), CLAUDE_DIR, PLUGINS_SUBDIR));
    });
  });

  describe("getPluginSkillsDir", () => {
    it("should return skills subdirectory of plugin directory", () => {
      const result = getPluginSkillsDir("/path/to/plugin");

      expect(result).toBe(path.join("/path/to/plugin", "skills"));
    });
  });

  describe("getPluginAgentsDir", () => {
    it("should return agents subdirectory of plugin directory", () => {
      const result = getPluginAgentsDir("/path/to/plugin");

      expect(result).toBe(path.join("/path/to/plugin", "agents"));
    });
  });

  describe("getPluginManifestPath", () => {
    it("should return manifest path within .claude-plugin directory", () => {
      const result = getPluginManifestPath("/path/to/plugin");

      expect(result).toBe(path.join("/path/to/plugin", ".claude-plugin", "plugin.json"));
    });
  });

  describe("readPluginManifest", () => {
    it("should return null when manifest file does not exist", async () => {
      mockedFileExists.mockResolvedValue(false);

      const result = await readPluginManifest("/path/to/plugin");

      expect(result).toBeNull();
    });

    it("should return parsed manifest for valid JSON", async () => {
      const manifest: PluginManifest = {
        name: "my-plugin",
        version: "1.0.0",
        description: "A test plugin",
        skills: "./skills/",
      };

      mockedFileExists.mockResolvedValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(manifest));

      const result = await readPluginManifest("/path/to/plugin");

      expect(result).not.toBeNull();
      expect(result!.name).toBe("my-plugin");
      expect(result!.version).toBe("1.0.0");
      expect(result!.description).toBe("A test plugin");
    });

    it("should return null for invalid JSON", async () => {
      mockedFileExists.mockResolvedValue(true);
      mockedReadFile.mockResolvedValue("not valid json {{{");

      const result = await readPluginManifest("/path/to/plugin");

      expect(result).toBeNull();
    });

    it("should return null when manifest has empty name", async () => {
      mockedFileExists.mockResolvedValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify({ name: "", version: "1.0.0" }));

      const result = await readPluginManifest("/path/to/plugin");

      expect(result).toBeNull();
    });

    it("should return null when manifest has no name field", async () => {
      mockedFileExists.mockResolvedValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify({ version: "1.0.0" }));

      const result = await readPluginManifest("/path/to/plugin");

      expect(result).toBeNull();
    });

    it("should return manifest with optional fields missing", async () => {
      mockedFileExists.mockResolvedValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify({ name: "minimal-plugin" }));

      const result = await readPluginManifest("/path/to/plugin");

      expect(result).not.toBeNull();
      expect(result!.name).toBe("minimal-plugin");
      expect(result!.version).toBeUndefined();
      expect(result!.description).toBeUndefined();
    });

    it("should return null when readFile throws", async () => {
      mockedFileExists.mockResolvedValue(true);
      mockedReadFile.mockRejectedValue(new Error("EACCES permission denied"));

      const result = await readPluginManifest("/path/to/plugin");

      expect(result).toBeNull();
    });

    it("should handle manifest with author, keywords, and other fields", async () => {
      const manifest: PluginManifest = {
        name: "full-plugin",
        version: "2.0.0",
        description: "Full featured plugin",
        author: { name: "@vince", email: "vince@example.com" },
        keywords: ["web", "react"],
        skills: "./skills/",
        agents: "./agents/",
      };

      mockedFileExists.mockResolvedValue(true);
      mockedReadFile.mockResolvedValue(JSON.stringify(manifest));

      const result = await readPluginManifest("/path/to/plugin");

      expect(result).not.toBeNull();
      expect(result!.author).toEqual({ name: "@vince", email: "vince@example.com" });
      expect(result!.keywords).toEqual(["web", "react"]);
      expect(result!.skills).toBe("./skills/");
      expect(result!.agents).toBe("./agents/");
    });
  });

  describe("getPluginSkillIds", () => {
    it("should return empty array when no SKILL.md files exist", async () => {
      mockedGlob.mockResolvedValue([]);

      const matrix = createMockMatrix({});
      const result = await getPluginSkillIds("/plugin/skills", matrix);

      expect(result).toEqual([]);
    });

    it("should match skill by frontmatter name as direct skill ID", async () => {
      mockedGlob.mockResolvedValue(["web-framework-react/SKILL.md"]);

      const skillId = "web-framework-react" as SkillId;
      const matrix = createMockMatrix({
        [skillId]: createMockSkill(skillId, "web/framework"),
      });

      mockedReadFile.mockResolvedValue(
        `---\nname: web-framework-react\ndescription: React skill\n---\nContent`,
      );

      const result = await getPluginSkillIds("/plugin/skills", matrix);

      expect(result).toEqual(["web-framework-react"]);
    });

    it("should match skill by display name alias", async () => {
      mockedGlob.mockResolvedValue(["react/SKILL.md"]);

      const skillId = "web-framework-react" as SkillId;
      const matrix = createMockMatrix({
        [skillId]: createMockSkill(skillId, "web/framework", {
          displayName: "react",
        }),
      });

      mockedReadFile.mockResolvedValue(`---\nname: React\ndescription: React skill\n---\nContent`);

      const result = await getPluginSkillIds("/plugin/skills", matrix);

      expect(result).toEqual(["web-framework-react"]);
    });

    it("should match skill by directory name when frontmatter has no name", async () => {
      mockedGlob.mockResolvedValue(["web-framework-react/SKILL.md"]);

      const skillId = "web-framework-react" as SkillId;
      const matrix = createMockMatrix({
        [skillId]: createMockSkill(skillId, "web/framework"),
      });

      mockedReadFile.mockResolvedValue("# React\n\nA skill for React development.");

      const result = await getPluginSkillIds("/plugin/skills", matrix);

      expect(result).toEqual(["web-framework-react"]);
    });

    it("should match skill by directory name using last part of ID", async () => {
      mockedGlob.mockResolvedValue(["subdir/SKILL.md"]);

      const skillId = "web-framework-react" as SkillId;
      const matrix = createMockMatrix({
        [skillId]: createMockSkill(skillId, "web/framework"),
      });

      mockedReadFile.mockResolvedValue("# No frontmatter match");

      const result = await getPluginSkillIds("/plugin/skills", matrix);

      expect(result).toEqual([]);
    });

    it("should handle multiple SKILL.md files", async () => {
      mockedGlob.mockResolvedValue([
        "web-framework-react/SKILL.md",
        "web-state-zustand/SKILL.md",
        "api-framework-hono/SKILL.md",
      ]);

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react", "web/framework"),
        "web-state-zustand": createMockSkill("web-state-zustand", "web/client-state"),
        "api-framework-hono": createMockSkill("api-framework-hono", "api/api"),
      });

      mockedReadFile.mockImplementation((filePath) => {
        if (filePath.includes("react")) {
          return Promise.resolve(
            "---\nname: web-framework-react\ndescription: React\n---\nContent",
          );
        }
        if (filePath.includes("zustand")) {
          return Promise.resolve(
            "---\nname: web-state-zustand\ndescription: Zustand\n---\nContent",
          );
        }
        if (filePath.includes("hono")) {
          return Promise.resolve("---\nname: api-framework-hono\ndescription: Hono\n---\nContent");
        }
        return Promise.resolve("");
      });

      const result = await getPluginSkillIds("/plugin/skills", matrix);

      expect(result).toHaveLength(3);
      expect(result).toContain("web-framework-react");
      expect(result).toContain("web-state-zustand");
      expect(result).toContain("api-framework-hono");
    });

    it("should skip skills with no matching frontmatter name and no matching directory", async () => {
      mockedGlob.mockResolvedValue(["unknown-skill/SKILL.md"]);

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill("web-framework-react", "web/framework"),
      });

      mockedReadFile.mockResolvedValue(
        "---\nname: something-totally-different\ndescription: Test\n---\nContent",
      );

      const result = await getPluginSkillIds("/plugin/skills", matrix);

      expect(result).toEqual([]);
    });

    it("should handle case-insensitive display name matching", async () => {
      mockedGlob.mockResolvedValue(["react/SKILL.md"]);

      const skillId = "web-framework-react" as SkillId;
      const matrix = createMockMatrix({
        [skillId]: createMockSkill(skillId, "web/framework", {
          displayName: "react",
        }),
      });

      mockedReadFile.mockResolvedValue("---\nname: react\ndescription: React\n---\nContent");

      const result = await getPluginSkillIds("/plugin/skills", matrix);

      expect(result).toEqual(["web-framework-react"]);
    });

    it("should handle case-insensitive directory name matching", async () => {
      mockedGlob.mockResolvedValue(["Web-Framework-React/SKILL.md"]);

      const skillId = "web-framework-react" as SkillId;
      const matrix = createMockMatrix({
        [skillId]: createMockSkill(skillId, "web/framework"),
      });

      mockedReadFile.mockResolvedValue("# No frontmatter");

      const result = await getPluginSkillIds("/plugin/skills", matrix);

      expect(result).toEqual(["web-framework-react"]);
    });

    it("should handle frontmatter with quoted name values", async () => {
      mockedGlob.mockResolvedValue(["react/SKILL.md"]);

      const skillId = "web-framework-react" as SkillId;
      const matrix = createMockMatrix({
        [skillId]: createMockSkill(skillId, "web/framework"),
      });

      mockedReadFile.mockResolvedValue(
        "---\nname: 'web-framework-react'\ndescription: React\n---\nContent",
      );

      const result = await getPluginSkillIds("/plugin/skills", matrix);

      expect(result).toEqual(["web-framework-react"]);
    });

    it("should handle frontmatter with double-quoted name values", async () => {
      mockedGlob.mockResolvedValue(["react/SKILL.md"]);

      const skillId = "web-framework-react" as SkillId;
      const matrix = createMockMatrix({
        [skillId]: createMockSkill(skillId, "web/framework"),
      });

      mockedReadFile.mockResolvedValue(
        '---\nname: "web-framework-react"\ndescription: React\n---\nContent',
      );

      const result = await getPluginSkillIds("/plugin/skills", matrix);

      expect(result).toEqual(["web-framework-react"]);
    });

    it("should handle nested directory paths in SKILL.md glob results", async () => {
      mockedGlob.mockResolvedValue(["framework/web-framework-react/SKILL.md"]);

      const skillId = "web-framework-react" as SkillId;
      const matrix = createMockMatrix({
        [skillId]: createMockSkill(skillId, "web/framework"),
      });

      mockedReadFile.mockResolvedValue("# No frontmatter");

      const result = await getPluginSkillIds("/plugin/skills", matrix);

      expect(result).toEqual(["web-framework-react"]);
    });
  });
});
