import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import {
  compileSkillPlugin,
  compileAllSkillPlugins,
  printCompilationSummary,
} from "./skill-plugin-compiler";
import { createTempDir, cleanupTempDir, writeTestSkill } from "../__tests__/helpers";

describe("skill-plugin-compiler", () => {
  let tempDir: string;
  let skillsDir: string;
  let outputDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("skill-compiler-test-");
    skillsDir = path.join(tempDir, "skills");
    outputDir = path.join(tempDir, "output");
    await mkdir(skillsDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("compileSkillPlugin", () => {
    it("should create plugin directory structure", async () => {
      const skillPath = await writeTestSkill(skillsDir, "react", {
        description: "React skills",
        skipMetadata: true,
      });

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      const pluginDir = result.pluginPath;
      const stats = await stat(pluginDir);
      expect(stats.isDirectory()).toBe(true);

      const skillsSubDir = path.join(pluginDir, "skills", "react");
      const skillsStats = await stat(skillsSubDir);
      expect(skillsStats.isDirectory()).toBe(true);
    });

    it("should generate valid plugin.json", async () => {
      const skillPath = await writeTestSkill(skillsDir, "zustand", {
        description: "State management with Zustand",
        skipMetadata: true,
      });

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      const manifestPath = path.join(result.pluginPath, ".claude-plugin", "plugin.json");
      const content = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(content);

      expect(manifest.name).toBe("zustand");
      expect(manifest.version).toBe("1.0.0");
      // contentHash and updated are no longer in manifest - stored internally
      expect(manifest.contentHash).toBeUndefined();
      expect(manifest.updated).toBeUndefined();
      expect(manifest.skills).toBe("./skills/");
    });

    it("should copy SKILL.md with frontmatter", async () => {
      const skillPath = await writeTestSkill(skillsDir, "tailwind", {
        description: "Tailwind CSS styling",
        skipMetadata: true,
        skillContent:
          "---\nname: tailwind\ndescription: Tailwind CSS styling\ncategory: test\n---\n\n# Tailwind Content\n\nStyling guide.",
      });

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      const copiedSkillMd = path.join(result.pluginPath, "skills", "tailwind", "SKILL.md");
      const content = await readFile(copiedSkillMd, "utf-8");

      expect(content).toContain("---");
      expect(content).toContain("name: tailwind");
      expect(content).toContain("description: Tailwind CSS styling");
      expect(content).toContain("# Tailwind Content");
    });

    it("should copy examples directory when present", async () => {
      const skillPath = await writeTestSkill(skillsDir, "vitest", {
        description: "Testing with Vitest",
        skipMetadata: true,
      });

      // Create examples directory
      const examplesDir = path.join(skillPath, "examples");
      await mkdir(examplesDir, { recursive: true });
      await writeFile(path.join(examplesDir, "basic.test.ts"), "// test example");

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      const copiedExamples = path.join(result.pluginPath, "skills", "vitest", "examples");
      const stats = await stat(copiedExamples);
      expect(stats.isDirectory()).toBe(true);

      const exampleContent = await readFile(path.join(copiedExamples, "basic.test.ts"), "utf-8");
      expect(exampleContent).toBe("// test example");
    });

    it("should generate README.md", async () => {
      const skillPath = await writeTestSkill(skillsDir, "mobx", {
        description: "State management with MobX",
        skipMetadata: true,
      });

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const content = await readFile(readmePath, "utf-8");

      expect(content).toContain("# mobx");
      expect(content).toContain("State management with MobX");
      expect(content).toContain("## Installation");
      expect(content).toContain('"mobx"');
    });

    it("should include tags in README when metadata has tags", async () => {
      const skillPath = await writeTestSkill(skillsDir, "react-query", {
        description: "Data fetching with React Query",
        extraMetadata: { tags: ["web", "data", "async"] },
      });

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      const readmePath = path.join(result.pluginPath, "README.md");
      const content = await readFile(readmePath, "utf-8");

      expect(content).toContain("## Tags");
      expect(content).toContain("`web`");
      expect(content).toContain("`data`");
      expect(content).toContain("`async`");
    });

    it("should use custom skill name when provided", async () => {
      const skillPath = await writeTestSkill(skillsDir, "original", {
        description: "Original skill",
        skipMetadata: true,
      });

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
        skillName: "custom-name",
      });

      expect(result.skillName).toBe("custom-name");
      expect(result.manifest.name).toBe("custom-name");
    });

    it("should throw error when SKILL.md is missing", async () => {
      const skillPath = path.join(skillsDir, "missing-skill");
      await mkdir(skillPath, { recursive: true });
      // Don't create SKILL.md

      await expect(compileSkillPlugin({ skillPath, outputDir })).rejects.toThrow(
        /is missing required SKILL\.md file/,
      );
    });

    it("should throw error when frontmatter is invalid", async () => {
      const skillPath = path.join(skillsDir, "bad-skill");
      await mkdir(skillPath, { recursive: true });
      await writeFile(path.join(skillPath, "SKILL.md"), "# No frontmatter here");

      await expect(compileSkillPlugin({ skillPath, outputDir })).rejects.toThrow(
        /has invalid or missing YAML frontmatter/,
      );
    });

    it("should get author from metadata.yaml", async () => {
      const skillPath = await writeTestSkill(skillsDir, "web-framework-react", {
        description: "React skills",
        extraMetadata: { author: "@vince" },
      });

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      // Author should come from metadata.yaml
      expect(result.manifest.author?.name).toBe("@vince");
    });

    it("should have undefined author when no metadata.yaml", async () => {
      const skillPath = await writeTestSkill(skillsDir, "web-framework-vue", {
        description: "Vue skills",
        skipMetadata: true,
      });

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      // No author when metadata.yaml doesn't exist
      expect(result.manifest.author).toBeUndefined();
    });

    it("should use hash-based versioning on recompile", async () => {
      const skillPath = await writeTestSkill(skillsDir, "simple", {
        description: "Simple skill",
        skipMetadata: true,
        skillContent: "---\nname: simple\ndescription: Simple skill\n---\n\n# Simple version 1",
      });

      // First compile
      const result1 = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      expect(result1.manifest.version).toBe("1.0.0");

      // Recompile without changes - version should stay the same
      const result2 = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      expect(result2.manifest.version).toBe("1.0.0");

      // Modify the skill content
      await writeFile(
        path.join(skillPath, "SKILL.md"),
        `---
name: simple
description: Simple skill
---

# Simple version 2 - updated content`,
      );

      // Recompile with changes - version should bump major (1.0.0 -> 2.0.0)
      const result3 = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      expect(result3.manifest.version).toBe("2.0.0");
    });
  });

  describe("compileAllSkillPlugins", () => {
    it("should compile multiple skills from directory", async () => {
      // Use flat directory structure with frontmatter.name as source of truth
      await writeTestSkill(skillsDir, "web-framework-react", {
        description: "React skills",
        skipMetadata: true,
      });
      await writeTestSkill(skillsDir, "state-zustand", {
        description: "State management",
        skipMetadata: true,
      });
      await writeTestSkill(skillsDir, "backend-api-hono", {
        description: "API framework",
        skipMetadata: true,
      });

      const results = await compileAllSkillPlugins(skillsDir, outputDir);

      expect(results).toHaveLength(3);
      const skillNames = results.map((r) => r.skillName);
      expect(skillNames).toContain("web-framework-react");
      expect(skillNames).toContain("state-zustand");
      expect(skillNames).toContain("backend-api-hono");
    });

    it("should create plugin directories for each skill", async () => {
      await writeTestSkill(skillsDir, "web-framework-react", {
        description: "React skills",
        skipMetadata: true,
      });
      await writeTestSkill(skillsDir, "backend-api-hono", {
        description: "API framework",
        skipMetadata: true,
      });

      const results = await compileAllSkillPlugins(skillsDir, outputDir);

      for (const result of results) {
        const stats = await stat(result.pluginPath);
        expect(stats.isDirectory()).toBe(true);
      }
    });

    it("should handle empty skills directory", async () => {
      const results = await compileAllSkillPlugins(skillsDir, outputDir);
      expect(results).toHaveLength(0);
    });

    it("should use frontmatter.name as skill name (not directory name)", async () => {
      // Directory name and frontmatter.name are different
      await writeTestSkill(skillsDir, "some-directory-name", {
        description: "Skill description",
        skipMetadata: true,
        skillContent:
          "---\nname: actual-skill-name\ndescription: Skill description\n---\n\n# Content",
      });

      const results = await compileAllSkillPlugins(skillsDir, outputDir);

      expect(results).toHaveLength(1);
      // Should use frontmatter.name, not directory name
      expect(results[0].skillName).toBe("actual-skill-name");
    });

    it("should continue compiling other skills when one fails", async () => {
      // Create valid skill
      await writeTestSkill(skillsDir, "web-framework-react", {
        description: "React skills",
        skipMetadata: true,
      });

      // Create invalid skill (no frontmatter) - intentionally raw for error testing
      const badSkillPath = path.join(skillsDir, "bad-skill");
      await mkdir(badSkillPath, { recursive: true });
      await writeFile(path.join(badSkillPath, "SKILL.md"), "# No frontmatter");

      // Create another valid skill
      await writeTestSkill(skillsDir, "state-zustand", {
        description: "State",
        skipMetadata: true,
      });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const results = await compileAllSkillPlugins(skillsDir, outputDir);

      // Should have compiled the valid skills
      expect(results).toHaveLength(2);
      const skillNames = results.map((r) => r.skillName);
      expect(skillNames).toContain("web-framework-react");
      expect(skillNames).toContain("state-zustand");

      // Should have warned about the failed skill
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Warning:"));

      consoleSpy.mockRestore();
    });

    it("should log success messages for compiled skills", async () => {
      await writeTestSkill(skillsDir, "web-framework-react", {
        description: "React skills",
        skipMetadata: true,
      });

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await compileAllSkillPlugins(skillsDir, outputDir);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[OK]"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("web-framework-react"));

      consoleSpy.mockRestore();
    });

    it("should return correct manifest for each compiled skill", async () => {
      await writeTestSkill(skillsDir, "web-framework-react", {
        description: "React skills",
        skipMetadata: true,
      });
      await writeTestSkill(skillsDir, "backend-api-hono", {
        description: "API framework",
        skipMetadata: true,
      });

      const results = await compileAllSkillPlugins(skillsDir, outputDir);

      for (const result of results) {
        // Plugin name = skill name (no prefix)
        expect(result.manifest.name).toBe(result.skillName);
        expect(result.manifest.version).toBe("1.0.0");
      }
    });
  });

  describe("printCompilationSummary", () => {
    it("should print count of compiled plugins", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const results = [
        {
          pluginPath: "/out/react",
          manifest: { name: "react", version: "1.0.0" },
          skillName: "react",
        },
        {
          pluginPath: "/out/zustand",
          manifest: { name: "zustand", version: "2.0.0" },
          skillName: "zustand",
        },
        {
          pluginPath: "/out/hono",
          manifest: { name: "hono", version: "3.0.0" },
          skillName: "hono",
        },
      ];

      printCompilationSummary(results);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Compiled 3 skill plugins"));

      consoleSpy.mockRestore();
    });

    it("should print each skill name with version", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const results = [
        {
          pluginPath: "/out/react",
          manifest: { name: "react", version: "1.0.0" },
          skillName: "react",
        },
        {
          pluginPath: "/out/zustand",
          manifest: { name: "zustand", version: "5.0.0" },
          skillName: "zustand",
        },
      ];

      printCompilationSummary(results);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("react"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("v1.0.0"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("zustand"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("v5.0.0"));

      consoleSpy.mockRestore();
    });

    it("should handle empty results array", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      printCompilationSummary([]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Compiled 0 skill plugins"));

      consoleSpy.mockRestore();
    });

    it("should handle single result", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const results = [
        {
          pluginPath: "/out/react",
          manifest: { name: "react", version: "1.0.0" },
          skillName: "react",
        },
      ];

      printCompilationSummary(results);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Compiled 1 skill plugins"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("react"));

      consoleSpy.mockRestore();
    });
  });
});
