import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { copySkillsToPluginFromSource } from "./skill-copier";
import type { MergedSkillsMatrix, ResolvedSkill } from "../types-matrix";
import type { SourceLoadResult } from "./source-loader";
import { PROJECT_ROOT } from "../consts";

/**
 * Helper to create a minimal resolved skill for testing
 */
function createMockSkill(
  id: string,
  category: string,
  skillPath: string,
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return {
    id,
    name: id.replace(/ \(@.*\)$/, ""),
    description: `${id} skill`,
    category,
    categoryExclusive: false,
    tags: [],
    author: "@test",
    conflictsWith: [],
    recommends: [],
    recommendedBy: [],
    requires: [],
    requiredBy: [],
    alternatives: [],
    discourages: [],
    requiresSetup: [],
    providesSetupFor: [],
    path: skillPath,
    ...overrides,
  };
}

/**
 * Helper to create a minimal merged skills matrix for testing
 */
function createMockMatrix(
  skills: Record<string, ResolvedSkill>,
): MergedSkillsMatrix {
  return {
    version: "1.0.0",
    categories: {},
    skills,
    suggestedStacks: [],
    aliases: {},
    aliasesReverse: {},
    generatedAt: new Date().toISOString(),
  };
}

describe("skill-copier", () => {
  let tempDir: string;
  let pluginDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-skill-copier-test-"));
    pluginDir = path.join(tempDir, "plugin");
    projectDir = path.join(tempDir, "project");
    await mkdir(pluginDir, { recursive: true });
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("copySkillsToPluginFromSource", () => {
    it("skips local skills and does not copy them", async () => {
      // Create a local skill in the project's .claude/skills/ directory
      const localSkillPath = ".claude/skills/my-local-skill/";
      const localSkillDir = path.join(projectDir, localSkillPath);
      await mkdir(localSkillDir, { recursive: true });
      await writeFile(
        path.join(localSkillDir, "SKILL.md"),
        `---\nname: my-local-skill (@local)\ndescription: Local skill\n---\nLocal skill content`,
      );

      const matrix = createMockMatrix({
        "my-local-skill (@local)": createMockSkill(
          "my-local-skill (@local)",
          "local/custom",
          localSkillPath,
          {
            local: true,
            localPath: localSkillPath,
          },
        ),
      });

      const sourceResult: SourceLoadResult = {
        matrix,
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
        sourcePath: projectDir,
        isLocal: true,
      };

      // Change cwd to project dir for local skill resolution
      const originalCwd = process.cwd();
      process.chdir(projectDir);

      try {
        const result = await copySkillsToPluginFromSource(
          ["my-local-skill (@local)"],
          pluginDir,
          matrix,
          sourceResult,
        );

        // Local skill should be returned but marked as local
        expect(result).toHaveLength(1);
        expect(result[0].skillId).toBe("my-local-skill (@local)");
        expect(result[0].local).toBe(true);
        expect(result[0].sourcePath).toBe(localSkillPath);
        expect(result[0].destPath).toBe(localSkillPath);

        // Verify skill was NOT copied to plugin dir
        const copiedSkillDir = path.join(
          pluginDir,
          "skills",
          "my-local-skill",
        );
        let exists = false;
        try {
          await readFile(path.join(copiedSkillDir, "SKILL.md"));
          exists = true;
        } catch {
          exists = false;
        }
        expect(exists).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("returns correct metadata for local skills", async () => {
      const localSkillPath = ".claude/skills/test-local/";
      const localSkillDir = path.join(projectDir, localSkillPath);
      await mkdir(localSkillDir, { recursive: true });
      await writeFile(
        path.join(localSkillDir, "SKILL.md"),
        `---\nname: test-local (@local)\ndescription: Test local\n---\nContent`,
      );

      const matrix = createMockMatrix({
        "test-local (@local)": createMockSkill(
          "test-local (@local)",
          "local/custom",
          localSkillPath,
          {
            local: true,
            localPath: localSkillPath,
          },
        ),
      });

      const sourceResult: SourceLoadResult = {
        matrix,
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
        sourcePath: projectDir,
        isLocal: true,
      };

      const originalCwd = process.cwd();
      process.chdir(projectDir);

      try {
        const result = await copySkillsToPluginFromSource(
          ["test-local (@local)"],
          pluginDir,
          matrix,
          sourceResult,
        );

        expect(result[0]).toMatchObject({
          skillId: "test-local (@local)",
          sourcePath: localSkillPath,
          destPath: localSkillPath,
          local: true,
        });
        // Content hash should be computed from the SKILL.md
        expect(result[0].contentHash).toBeDefined();
        expect(result[0].contentHash).toMatch(/^[a-f0-9]{7}$/);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("handles mix of local and remote skills", async () => {
      // Create local skill
      const localSkillPath = ".claude/skills/my-local/";
      const localSkillDir = path.join(projectDir, localSkillPath);
      await mkdir(localSkillDir, { recursive: true });
      await writeFile(
        path.join(localSkillDir, "SKILL.md"),
        `---\nname: my-local (@local)\ndescription: Local\n---\nLocal content`,
      );

      // Create remote skill in source location (simulating fetched source)
      const remoteSkillRelPath = "skills/frontend/framework/react (@vince)/";
      const remoteSkillDir = path.join(
        projectDir,
        "src",
        remoteSkillRelPath,
      );
      await mkdir(remoteSkillDir, { recursive: true });
      await writeFile(
        path.join(remoteSkillDir, "SKILL.md"),
        `---\nname: react (@vince)\ndescription: React\n---\nReact content`,
      );
      await writeFile(
        path.join(remoteSkillDir, "metadata.yaml"),
        `cli_name: React\nauthor: "@vince"`,
      );

      const matrix = createMockMatrix({
        "my-local (@local)": createMockSkill(
          "my-local (@local)",
          "local/custom",
          localSkillPath,
          {
            local: true,
            localPath: localSkillPath,
          },
        ),
        "react (@vince)": createMockSkill(
          "react (@vince)",
          "frontend/framework",
          remoteSkillRelPath,
        ),
      });

      const sourceResult: SourceLoadResult = {
        matrix,
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
        sourcePath: projectDir,
        isLocal: true,
      };

      const originalCwd = process.cwd();
      process.chdir(projectDir);

      try {
        const result = await copySkillsToPluginFromSource(
          ["my-local (@local)", "react (@vince)"],
          pluginDir,
          matrix,
          sourceResult,
        );

        expect(result).toHaveLength(2);

        // Find local and remote results
        const localResult = result.find((r) => r.local === true);
        const remoteResult = result.find((r) => r.local !== true);

        // Local skill should not be copied
        expect(localResult?.skillId).toBe("my-local (@local)");
        expect(localResult?.local).toBe(true);
        expect(localResult?.sourcePath).toBe(localSkillPath);
        expect(localResult?.destPath).toBe(localSkillPath);

        // Remote skill should be copied
        expect(remoteResult?.skillId).toBe("react (@vince)");
        expect(remoteResult?.local).toBeUndefined();
        expect(remoteResult?.destPath).toContain(pluginDir);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("warns about unknown skills and skips them", async () => {
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const matrix = createMockMatrix({});

      const sourceResult: SourceLoadResult = {
        matrix,
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
        sourcePath: projectDir,
        isLocal: true,
      };

      const result = await copySkillsToPluginFromSource(
        ["unknown-skill (@test)"],
        pluginDir,
        matrix,
        sourceResult,
      );

      expect(result).toEqual([]);
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("unknown-skill (@test)"),
      );

      consoleWarn.mockRestore();
    });

    it("handles empty skill selection", async () => {
      const matrix = createMockMatrix({});

      const sourceResult: SourceLoadResult = {
        matrix,
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
        sourcePath: projectDir,
        isLocal: true,
      };

      const result = await copySkillsToPluginFromSource(
        [],
        pluginDir,
        matrix,
        sourceResult,
      );

      expect(result).toEqual([]);
    });
  });
});
