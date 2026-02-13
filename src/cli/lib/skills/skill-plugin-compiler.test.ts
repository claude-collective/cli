import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from "fs/promises";
import {
  compileSkillPlugin,
  compileAllSkillPlugins,
  printCompilationSummary,
} from "./skill-plugin-compiler";

describe("skill-plugin-compiler", () => {
  let tempDir: string;
  let skillsDir: string;
  let outputDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "skill-compiler-test-"));
    skillsDir = path.join(tempDir, "skills");
    outputDir = path.join(tempDir, "output");
    await mkdir(skillsDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("compileSkillPlugin", () => {
    async function createTestSkill(
      dirName: string,
      frontmatter: Record<string, string>,
      content = "# Skill Content",
      metadata?: Record<string, unknown>,
    ): Promise<string> {
      // Use flat directory structure (no (@author) suffix)
      const skillPath = path.join(skillsDir, dirName);
      await mkdir(skillPath, { recursive: true });

      // Create SKILL.md with frontmatter
      const frontmatterYaml = Object.entries(frontmatter)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
      const skillMd = `---\n${frontmatterYaml}\n---\n\n${content}`;
      await writeFile(path.join(skillPath, "SKILL.md"), skillMd);

      // Create metadata.yaml if provided
      if (metadata) {
        const metadataYaml = Object.entries(metadata)
          .map(([key, value]) => {
            if (Array.isArray(value)) {
              return `${key}:\n${value.map((v) => `  - ${v}`).join("\n")}`;
            }
            // Quote strings that start with @ to avoid YAML parsing issues
            const stringValue =
              typeof value === "string" && value.startsWith("@") ? `"${value}"` : String(value);
            return `${key}: ${stringValue}`;
          })
          .join("\n");
        await writeFile(path.join(skillPath, "metadata.yaml"), metadataYaml);
      }

      return skillPath;
    }

    it("should create plugin directory structure", async () => {
      const skillPath = await createTestSkill("react", {
        name: "react",
        description: "React skills",
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
      const skillPath = await createTestSkill("zustand", {
        name: "zustand",
        description: "State management with Zustand",
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
      // content_hash and updated are no longer in manifest - stored internally
      expect(manifest.content_hash).toBeUndefined();
      expect(manifest.updated).toBeUndefined();
      expect(manifest.skills).toBe("./skills/");
    });

    it("should copy SKILL.md with frontmatter", async () => {
      const frontmatter = {
        name: "tailwind",
        description: "Tailwind CSS styling",
      };
      const skillPath = await createTestSkill(
        "tailwind",
        frontmatter,
        "# Tailwind Content\n\nStyling guide.",
      );

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
      const skillPath = await createTestSkill("vitest", {
        name: "vitest",
        description: "Testing with Vitest",
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
      const skillPath = await createTestSkill("mobx", {
        name: "mobx",
        description: "State management with MobX",
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
      const skillPath = await createTestSkill(
        "react-query",
        {
          name: "react-query",
          description: "Data fetching with React Query",
        },
        "# React Query",
        { tags: ["web", "data", "async"] },
      );

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
      const skillPath = await createTestSkill("original", {
        name: "original",
        description: "Original skill",
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
      const skillPath = await createTestSkill(
        "web-framework-react",
        {
          name: "web-framework-react",
          description: "React skills",
        },
        "# React Content",
        { author: "@vince" },
      );

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      // Author should come from metadata.yaml
      expect(result.manifest.author?.name).toBe("@vince");
    });

    it("should have undefined author when no metadata.yaml", async () => {
      const skillPath = await createTestSkill("web-framework-vue", {
        name: "web-framework-vue",
        description: "Vue skills",
      });

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      // No author when metadata.yaml doesn't exist
      expect(result.manifest.author).toBeUndefined();
    });

    it("should coerce numeric version in metadata.yaml to string without warning", async () => {
      const skillPath = await createTestSkill(
        "web-testing-vitest",
        {
          name: "web-testing-vitest",
          description: "Testing with Vitest",
        },
        "# Vitest Content",
        { author: "@test-author", version: 1 },
      );

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await compileSkillPlugin({
        skillPath,
        outputDir,
      });

      // Metadata was loaded successfully (not null) — author comes from metadata.yaml
      expect(result.manifest.author?.name).toBe("@test-author");

      // No warning about version type coercion
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it("should use hash-based versioning on recompile", async () => {
      const skillPath = await createTestSkill(
        "simple",
        {
          name: "simple",
          description: "Simple skill",
        },
        "# Simple version 1",
      );

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
    async function createTestSkill(
      dirName: string,
      frontmatter: Record<string, string>,
      content = "# Skill Content",
    ): Promise<string> {
      // Use flat directory structure (no subDir or (@author) suffix)
      const skillPath = path.join(skillsDir, dirName);
      await mkdir(skillPath, { recursive: true });

      const frontmatterYaml = Object.entries(frontmatter)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
      const skillMd = `---\n${frontmatterYaml}\n---\n\n${content}`;
      await writeFile(path.join(skillPath, "SKILL.md"), skillMd);

      return skillPath;
    }

    it("should compile multiple skills from directory", async () => {
      // Use flat directory structure with frontmatter.name as source of truth
      await createTestSkill(
        "web-framework-react",
        { name: "web-framework-react", description: "React skills" },
        "# React",
      );
      await createTestSkill(
        "state-zustand",
        { name: "state-zustand", description: "State management" },
        "# Zustand",
      );
      await createTestSkill(
        "backend-api-hono",
        { name: "backend-api-hono", description: "API framework" },
        "# Hono",
      );

      const results = await compileAllSkillPlugins(skillsDir, outputDir);

      expect(results).toHaveLength(3);
      const skillNames = results.map((r) => r.skillName);
      expect(skillNames).toContain("web-framework-react");
      expect(skillNames).toContain("state-zustand");
      expect(skillNames).toContain("backend-api-hono");
    });

    it("should create plugin directories for each skill", async () => {
      await createTestSkill(
        "web-framework-react",
        { name: "web-framework-react", description: "React skills" },
        "# React",
      );
      await createTestSkill(
        "backend-api-hono",
        { name: "backend-api-hono", description: "API framework" },
        "# Hono",
      );

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
      await createTestSkill(
        "some-directory-name",
        { name: "actual-skill-name", description: "Skill description" },
        "# Content",
      );

      const results = await compileAllSkillPlugins(skillsDir, outputDir);

      expect(results).toHaveLength(1);
      // Should use frontmatter.name, not directory name
      expect(results[0].skillName).toBe("actual-skill-name");
    });

    it("should continue compiling other skills when one fails", async () => {
      // Create valid skill
      await createTestSkill(
        "web-framework-react",
        { name: "web-framework-react", description: "React skills" },
        "# React",
      );

      // Create invalid skill (no frontmatter)
      const badSkillPath = path.join(skillsDir, "bad-skill");
      await mkdir(badSkillPath, { recursive: true });
      await writeFile(path.join(badSkillPath, "SKILL.md"), "# No frontmatter");

      // Create another valid skill
      await createTestSkill(
        "state-zustand",
        { name: "state-zustand", description: "State" },
        "# Zustand",
      );

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const results = await compileAllSkillPlugins(skillsDir, outputDir);

      // Should have compiled the valid skills
      expect(results).toHaveLength(2);
      const skillNames = results.map((r) => r.skillName);
      expect(skillNames).toContain("web-framework-react");
      expect(skillNames).toContain("state-zustand");

      // Should have warned about the failed skill
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[WARN]"));

      consoleSpy.mockRestore();
    });

    it("should log success messages for compiled skills", async () => {
      await createTestSkill(
        "web-framework-react",
        { name: "web-framework-react", description: "React skills" },
        "# React",
      );

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await compileAllSkillPlugins(skillsDir, outputDir);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[OK]"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("web-framework-react"));

      consoleSpy.mockRestore();
    });

    it("should return correct manifest for each compiled skill", async () => {
      await createTestSkill(
        "web-framework-react",
        { name: "web-framework-react", description: "React skills" },
        "# React",
      );
      await createTestSkill(
        "backend-api-hono",
        { name: "backend-api-hono", description: "API framework" },
        "# Hono",
      );

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
