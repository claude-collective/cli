import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import {
  copySkillsToPluginFromSource,
  copySkillsToLocalFlattened,
  validateSkillPath,
} from "./skill-copier";
import type { CategoryPath, ResolvedSkill, SkillId } from "../../types";
import type { SourceLoadResult } from "../loading";
import { CLAUDE_DIR, PROJECT_ROOT, STANDARD_DIRS, STANDARD_FILES } from "../../consts";
import { createMockSkill as _createMockSkill, createMockMatrix } from "../__tests__/helpers";

function createMockSkill(
  id: SkillId,
  category: CategoryPath,
  skillPath: string,
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return _createMockSkill(id, category, {
    path: skillPath,
    ...overrides,
  });
}

describe("validateSkillPath", () => {
  it("allows normal skill paths within the parent directory", () => {
    expect(() =>
      validateSkillPath(
        "/registry/src/skills/web/framework/react",
        "/registry/src",
        "skills/web/framework/react",
      ),
    ).not.toThrow();
  });

  it("allows nested skill paths", () => {
    expect(() =>
      validateSkillPath(
        "/registry/src/skills/web/framework/client-rendering/react",
        "/registry/src",
        "skills/web/framework/client-rendering/react",
      ),
    ).not.toThrow();
  });

  it("blocks path traversal with ..", () => {
    expect(() =>
      validateSkillPath("/registry/src/../../sensitive", "/registry/src", "../../sensitive"),
    ).toThrow(/escapes expected directory/);
  });

  it("blocks traversal attempting to reach agents directory", () => {
    expect(() =>
      validateSkillPath(
        "/registry/src/../../src/agents/admin-agent",
        "/registry/src",
        "../../src/agents/admin-agent",
      ),
    ).toThrow(/escapes expected directory/);
  });

  it("blocks path traversal with intermediate ..", () => {
    expect(() =>
      validateSkillPath(
        "/registry/src/skills/../../../etc/passwd",
        "/registry/src",
        "skills/../../../etc/passwd",
      ),
    ).toThrow(/escapes expected directory/);
  });

  it("blocks absolute paths on Linux", () => {
    expect(() => validateSkillPath("/etc/passwd", "/registry/src", "/etc/passwd")).toThrow(
      /escapes expected directory/,
    );
  });

  it("blocks null byte attacks", () => {
    expect(() =>
      validateSkillPath(
        "/registry/src/skills/web\x00/../../../etc/passwd",
        "/registry/src",
        "skills/web\x00/../../../etc/passwd",
      ),
    ).toThrow(/contains null bytes/);
  });

  it("allows paths that equal the parent directory exactly", () => {
    expect(() => validateSkillPath("/registry/src", "/registry/src", ".")).not.toThrow();
  });
});

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
        path.join(localSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: my-local-skill (@local)\ndescription: Local skill\n---\nLocal skill content`,
      );

      const matrix = createMockMatrix({
        "web-local-skill": createMockSkill("web-local-skill", "local", localSkillPath, {
          local: true,
          localPath: localSkillPath,
        }),
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
          ["web-local-skill"],
          pluginDir,
          matrix,
          sourceResult,
        );

        // Local skill should be returned but marked as local
        expect(result).toHaveLength(1);
        expect(result[0].skillId).toBe("web-local-skill");
        expect(result[0].local).toBe(true);
        expect(result[0].sourcePath).toBe(localSkillPath);
        expect(result[0].destPath).toBe(localSkillPath);

        // Verify skill was NOT copied to plugin dir
        const copiedSkillDir = path.join(pluginDir, STANDARD_DIRS.SKILLS, "my-local-skill");
        let exists = false;
        try {
          await readFile(path.join(copiedSkillDir, STANDARD_FILES.SKILL_MD));
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
        path.join(localSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: test-local (@local)\ndescription: Test local\n---\nContent`,
      );

      const matrix = createMockMatrix({
        "web-test-local": createMockSkill("web-test-local", "local", localSkillPath, {
          local: true,
          localPath: localSkillPath,
        }),
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
          ["web-test-local"],
          pluginDir,
          matrix,
          sourceResult,
        );

        expect(result[0]).toMatchObject({
          skillId: "web-test-local",
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
        path.join(localSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: my-local (@local)\ndescription: Local\n---\nLocal content`,
      );

      // Create remote skill in source location (simulating fetched source)
      const remoteSkillRelPath = "skills/web/framework/web-framework-react/";
      const remoteSkillDir = path.join(projectDir, "src", remoteSkillRelPath);
      await mkdir(remoteSkillDir, { recursive: true });
      await writeFile(
        path.join(remoteSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-framework-react\ndescription: React\n---\nReact content`,
      );
      await writeFile(
        path.join(remoteSkillDir, STANDARD_FILES.METADATA_YAML),
        `cli_name: React\nauthor: "@vince"`,
      );

      const matrix = createMockMatrix({
        "web-my-local": createMockSkill("web-my-local", "local", localSkillPath, {
          local: true,
          localPath: localSkillPath,
        }),
        ["web-framework-react"]: createMockSkill(
          "web-framework-react",
          "web/framework",
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
          ["web-my-local", "web-framework-react"],
          pluginDir,
          matrix,
          sourceResult,
        );

        expect(result).toHaveLength(2);

        // Find local and remote results
        const localResult = result.find((r) => r.local === true);
        const remoteResult = result.find((r) => r.local !== true);

        // Local skill should not be copied
        expect(localResult?.skillId).toBe("web-my-local");
        expect(localResult?.local).toBe(true);
        expect(localResult?.sourcePath).toBe(localSkillPath);
        expect(localResult?.destPath).toBe(localSkillPath);

        // Remote skill should be copied
        expect(remoteResult?.skillId).toBe("web-framework-react");
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
        ["web-unknown-skill"],
        pluginDir,
        matrix,
        sourceResult,
      );

      expect(result).toEqual([]);
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("web-unknown-skill"));

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

      const result = await copySkillsToPluginFromSource([], pluginDir, matrix, sourceResult);

      expect(result).toEqual([]);
    });

    it("overrides local-skip when sourceSelections selects remote source", async () => {
      // Create local skill
      const localSkillPath = ".claude/skills/web-framework-react/";
      const localSkillDir = path.join(projectDir, localSkillPath);
      await mkdir(localSkillDir, { recursive: true });
      await writeFile(
        path.join(localSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-framework-react (@local)\ndescription: Local React\n---\nLocal React content`,
      );

      // Create remote skill in source
      const remoteSkillRelPath = "skills/web/framework/web-framework-react/";
      const remoteSkillDir = path.join(projectDir, "src", remoteSkillRelPath);
      await mkdir(remoteSkillDir, { recursive: true });
      await writeFile(
        path.join(remoteSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-framework-react\ndescription: Remote React\n---\nRemote React content`,
      );
      await writeFile(
        path.join(remoteSkillDir, STANDARD_FILES.METADATA_YAML),
        `cli_name: React\nauthor: "@vince"`,
      );

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill(
          "web-framework-react",
          "web/framework",
          remoteSkillRelPath,
          { local: true, localPath: localSkillPath },
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
          ["web-framework-react"],
          pluginDir,
          matrix,
          sourceResult,
          { "web-framework-react": "public" } as Partial<Record<SkillId, string>>,
        );

        // Should copy from remote, NOT preserve local
        expect(result).toHaveLength(1);
        expect(result[0].local).toBeUndefined();
        expect(result[0].destPath).toContain(pluginDir);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("preserves local skill when sourceSelections selects local", async () => {
      const localSkillPath = ".claude/skills/web-framework-react/";
      const localSkillDir = path.join(projectDir, localSkillPath);
      await mkdir(localSkillDir, { recursive: true });
      await writeFile(
        path.join(localSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-framework-react (@local)\ndescription: Local React\n---\nLocal`,
      );

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill(
          "web-framework-react",
          "web/framework",
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
          ["web-framework-react"],
          pluginDir,
          matrix,
          sourceResult,
          { "web-framework-react": "local" } as Partial<Record<SkillId, string>>,
        );

        // Should preserve local
        expect(result).toHaveLength(1);
        expect(result[0].local).toBe(true);
        expect(result[0].sourcePath).toBe(localSkillPath);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe("copySkillsToLocalFlattened", () => {
    it("copies skills to flattened structure using normalized ID", async () => {
      // Create remote skill in source location
      const remoteSkillRelPath = "skills/web/client-state-management/web-state-zustand/";
      const remoteSkillDir = path.join(projectDir, "src", remoteSkillRelPath);
      await mkdir(remoteSkillDir, { recursive: true });
      await writeFile(
        path.join(remoteSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-state-zustand\ndescription: Zustand state management\n---\nZustand content`,
      );
      await writeFile(
        path.join(remoteSkillDir, STANDARD_FILES.METADATA_YAML),
        `cli_name: Zustand\nauthor: "@vince"`,
      );

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      await mkdir(localSkillsDir, { recursive: true });

      const matrix = createMockMatrix({
        ["web-state-zustand"]: createMockSkill(
          "web-state-zustand",
          "web/state",
          remoteSkillRelPath,
          {
            displayName: "zustand",
          },
        ),
      });

      const sourceResult: SourceLoadResult = {
        matrix,
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
        sourcePath: projectDir,
        isLocal: true,
      };

      const result = await copySkillsToLocalFlattened(
        ["web-state-zustand"],
        localSkillsDir,
        matrix,
        sourceResult,
      );

      expect(result).toHaveLength(1);
      expect(result[0].skillId).toBe("web-state-zustand");
      // Should be flattened to .claude/skills/web-state-zustand/ (using normalized ID)
      expect(result[0].destPath).toBe(path.join(localSkillsDir, "web-state-zustand"));

      // Verify skill was copied
      const copiedSkillMd = await readFile(
        path.join(localSkillsDir, "web-state-zustand", STANDARD_FILES.SKILL_MD),
        "utf-8",
      );
      expect(copiedSkillMd).toContain("Zustand content");
    });

    it("copies skills using extracted name when no alias", async () => {
      // Create remote skill without alias
      const remoteSkillRelPath = "skills/api/api/api-framework-hono/";
      const remoteSkillDir = path.join(projectDir, "src", remoteSkillRelPath);
      await mkdir(remoteSkillDir, { recursive: true });
      await writeFile(
        path.join(remoteSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: api-framework-hono\ndescription: Hono API\n---\nHono content`,
      );
      await writeFile(
        path.join(remoteSkillDir, STANDARD_FILES.METADATA_YAML),
        `cli_name: Hono\nauthor: "@vince"`,
      );

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      await mkdir(localSkillsDir, { recursive: true });

      const matrix = createMockMatrix({
        ["api-framework-hono"]: createMockSkill(
          "api-framework-hono",
          "api/api",
          remoteSkillRelPath,
          // No alias
        ),
      });

      const sourceResult: SourceLoadResult = {
        matrix,
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
        sourcePath: projectDir,
        isLocal: true,
      };

      const result = await copySkillsToLocalFlattened(
        ["api-framework-hono"],
        localSkillsDir,
        matrix,
        sourceResult,
      );

      expect(result).toHaveLength(1);
      // With normalized IDs, the full ID is used as the folder name when no alias
      expect(result[0].destPath).toBe(path.join(localSkillsDir, "api-framework-hono"));
    });

    it("skips local skills and does not copy them", async () => {
      // Create a local skill already in .claude/skills/
      const localSkillPath = ".claude/skills/my-local-skill/";
      const localSkillDir = path.join(projectDir, localSkillPath);
      await mkdir(localSkillDir, { recursive: true });
      await writeFile(
        path.join(localSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: my-local-skill (@local)\ndescription: Local skill\n---\nLocal content`,
      );

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);

      const matrix = createMockMatrix({
        "web-local-skill": createMockSkill("web-local-skill", "local", localSkillPath, {
          local: true,
          localPath: localSkillPath,
        }),
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
        const result = await copySkillsToLocalFlattened(
          ["web-local-skill"],
          localSkillsDir,
          matrix,
          sourceResult,
        );

        // Local skill should be returned but marked as local
        expect(result).toHaveLength(1);
        expect(result[0].skillId).toBe("web-local-skill");
        expect(result[0].local).toBe(true);
        expect(result[0].sourcePath).toBe(localSkillPath);
        expect(result[0].destPath).toBe(localSkillPath);
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
        path.join(localSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: my-local (@local)\ndescription: Local\n---\nLocal content`,
      );

      // Create remote skill
      const remoteSkillRelPath = "skills/web/framework/web-framework-react/";
      const remoteSkillDir = path.join(projectDir, "src", remoteSkillRelPath);
      await mkdir(remoteSkillDir, { recursive: true });
      await writeFile(
        path.join(remoteSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-framework-react\ndescription: React\n---\nReact content`,
      );
      await writeFile(
        path.join(remoteSkillDir, STANDARD_FILES.METADATA_YAML),
        `cli_name: React\nauthor: "@vince"`,
      );

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);

      const matrix = createMockMatrix({
        "web-my-local": createMockSkill("web-my-local", "local", localSkillPath, {
          local: true,
          localPath: localSkillPath,
        }),
        ["web-framework-react"]: createMockSkill(
          "web-framework-react",
          "web/framework",
          remoteSkillRelPath,
          { displayName: "react" },
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
        const result = await copySkillsToLocalFlattened(
          ["web-my-local", "web-framework-react"],
          localSkillsDir,
          matrix,
          sourceResult,
        );

        expect(result).toHaveLength(2);

        // Find local and remote results
        const localResult = result.find((r) => r.local === true);
        const remoteResult = result.find((r) => r.local !== true);

        // Local skill should not be copied
        expect(localResult?.skillId).toBe("web-my-local");
        expect(localResult?.local).toBe(true);

        // Remote skill should be copied to flattened location using normalized ID
        expect(remoteResult?.skillId).toBe("web-framework-react");
        expect(remoteResult?.destPath).toBe(path.join(localSkillsDir, "web-framework-react"));
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("handles empty skill selection", async () => {
      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      await mkdir(localSkillsDir, { recursive: true });

      const matrix = createMockMatrix({});

      const sourceResult: SourceLoadResult = {
        matrix,
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
        sourcePath: projectDir,
        isLocal: true,
      };

      const result = await copySkillsToLocalFlattened([], localSkillsDir, matrix, sourceResult);

      expect(result).toEqual([]);
    });

    it("P1-20: flattens deeply nested directory structures", async () => {
      // Create a skill with a deeply nested path like:
      // skills/web/framework/web-framework-react/
      // This should be flattened to: .claude/skills/web-framework-react/
      const deeplyNestedPath = "skills/web/framework/client-rendering/web-framework-react/";
      const remoteSkillDir = path.join(projectDir, "src", deeplyNestedPath);
      await mkdir(remoteSkillDir, { recursive: true });
      await writeFile(
        path.join(remoteSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-framework-react\ndescription: React framework\n---\nReact content from deeply nested dir`,
      );
      await writeFile(
        path.join(remoteSkillDir, STANDARD_FILES.METADATA_YAML),
        `cli_name: React\nauthor: "@vince"`,
      );

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      await mkdir(localSkillsDir, { recursive: true });

      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill(
          "web-framework-react",
          "web/framework/client-rendering",
          deeplyNestedPath,
        ),
      });

      const sourceResult: SourceLoadResult = {
        matrix,
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
        sourcePath: projectDir,
        isLocal: true,
      };

      const result = await copySkillsToLocalFlattened(
        ["web-framework-react"],
        localSkillsDir,
        matrix,
        sourceResult,
      );

      expect(result).toHaveLength(1);
      // Key assertion: destPath should be FLAT using normalized ID, not nested
      // The path should be ".claude/skills/web-framework-react", NOT ".claude/skills/web/framework/client-rendering/web-framework-react/"
      expect(result[0].destPath).toBe(path.join(localSkillsDir, "web-framework-react"));

      // Verify the skill was actually copied to the flat location
      const copiedSkillMd = await readFile(
        path.join(localSkillsDir, "web-framework-react", STANDARD_FILES.SKILL_MD),
        "utf-8",
      );
      expect(copiedSkillMd).toContain("React content from deeply nested dir");

      // Verify the nested structure was NOT created
      const nestedPath = path.join(
        localSkillsDir,
        "web",
        "framework",
        "client-rendering",
        "web-framework-react",
      );
      let nestedExists = false;
      try {
        await readFile(path.join(nestedPath, STANDARD_FILES.SKILL_MD));
        nestedExists = true;
      } catch {
        nestedExists = false;
      }
      expect(nestedExists).toBe(false);
    });

    it("P1-20: flattens multiple skills from different nested directories", async () => {
      // Create skills from different nested paths
      const reactPath = "skills/web/framework/web-framework-react/";
      const reactDir = path.join(projectDir, "src", reactPath);
      await mkdir(reactDir, { recursive: true });
      await writeFile(
        path.join(reactDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-framework-react\ndescription: React\n---\nReact`,
      );
      await writeFile(
        path.join(reactDir, STANDARD_FILES.METADATA_YAML),
        `cli_name: React\nauthor: "@vince"`,
      );

      const honoPath = "skills/api/api/api-framework-hono/";
      const honoDir = path.join(projectDir, "src", honoPath);
      await mkdir(honoDir, { recursive: true });
      await writeFile(
        path.join(honoDir, STANDARD_FILES.SKILL_MD),
        `---\nname: api-framework-hono\ndescription: Hono\n---\nHono`,
      );
      await writeFile(
        path.join(honoDir, STANDARD_FILES.METADATA_YAML),
        `cli_name: Hono\nauthor: "@vince"`,
      );

      const vitestPath = "skills/testing/unit/web-testing-vitest/";
      const vitestDir = path.join(projectDir, "src", vitestPath);
      await mkdir(vitestDir, { recursive: true });
      await writeFile(
        path.join(vitestDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-testing-vitest\ndescription: Vitest\n---\nVitest`,
      );
      await writeFile(
        path.join(vitestDir, STANDARD_FILES.METADATA_YAML),
        `cli_name: Vitest\nauthor: "@vince"`,
      );

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      await mkdir(localSkillsDir, { recursive: true });

      const matrix = createMockMatrix({
        ["web-framework-react"]: createMockSkill(
          "web-framework-react",
          "web/framework",
          reactPath,
          {
            displayName: "react",
          },
        ),
        ["api-framework-hono"]: createMockSkill("api-framework-hono", "api/api", honoPath, {
          displayName: "hono",
        }),
        ["web-testing-vitest"]: createMockSkill("web-testing-vitest", "testing", vitestPath, {
          displayName: "vitest",
        }),
      });

      const sourceResult: SourceLoadResult = {
        matrix,
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
        sourcePath: projectDir,
        isLocal: true,
      };

      const result = await copySkillsToLocalFlattened(
        ["web-framework-react", "api-framework-hono", "web-testing-vitest"],
        localSkillsDir,
        matrix,
        sourceResult,
      );

      expect(result).toHaveLength(3);

      // All skills should be at the same flat level using normalized IDs
      const destPaths = result.map((r) => r.destPath);
      expect(destPaths).toContain(path.join(localSkillsDir, "web-framework-react"));
      expect(destPaths).toContain(path.join(localSkillsDir, "api-framework-hono"));
      expect(destPaths).toContain(path.join(localSkillsDir, "web-testing-vitest"));

      // Verify all skills exist at their flat locations
      const reactContent = await readFile(
        path.join(localSkillsDir, "web-framework-react", STANDARD_FILES.SKILL_MD),
        "utf-8",
      );
      const honoContent = await readFile(
        path.join(localSkillsDir, "api-framework-hono", STANDARD_FILES.SKILL_MD),
        "utf-8",
      );
      const vitestContent = await readFile(
        path.join(localSkillsDir, "web-testing-vitest", STANDARD_FILES.SKILL_MD),
        "utf-8",
      );

      expect(reactContent).toContain("React");
      expect(honoContent).toContain("Hono");
      expect(vitestContent).toContain("Vitest");
    });

    it("P1-20: uses skill ID name when no alias is provided", async () => {
      // Create a skill without an alias - should extract name from skill ID
      const nestedPath = "skills/tooling/bundler/web-tooling-vite/";
      const skillDir = path.join(projectDir, "src", nestedPath);
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-tooling-vite\ndescription: Vite bundler\n---\nVite`,
      );
      await writeFile(
        path.join(skillDir, STANDARD_FILES.METADATA_YAML),
        `cli_name: Vite\nauthor: "@vince"`,
      );

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      await mkdir(localSkillsDir, { recursive: true });

      const matrix = createMockMatrix({
        "web-tooling-vite": createMockSkill(
          "web-tooling-vite",
          "web/tooling",
          nestedPath,
          // No alias!
        ),
      });

      const sourceResult: SourceLoadResult = {
        matrix,
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
        sourcePath: projectDir,
        isLocal: true,
      };

      const result = await copySkillsToLocalFlattened(
        ["web-tooling-vite"],
        localSkillsDir,
        matrix,
        sourceResult,
      );

      expect(result).toHaveLength(1);
      // With normalized IDs, the full ID is used as the folder name when no alias
      expect(result[0].destPath).toBe(path.join(localSkillsDir, "web-tooling-vite"));
    });

    it("overrides local-skip when sourceSelections selects remote source", async () => {
      // Create local skill
      const localSkillPath = ".claude/skills/web-framework-react/";
      const localSkillDir = path.join(projectDir, localSkillPath);
      await mkdir(localSkillDir, { recursive: true });
      await writeFile(
        path.join(localSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-framework-react (@local)\ndescription: Local React\n---\nLocal React content`,
      );

      // Create remote skill in source
      const remoteSkillRelPath = "skills/web/framework/web-framework-react/";
      const remoteSkillDir = path.join(projectDir, "src", remoteSkillRelPath);
      await mkdir(remoteSkillDir, { recursive: true });
      await writeFile(
        path.join(remoteSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-framework-react\ndescription: Remote React\n---\nRemote React content`,
      );
      await writeFile(
        path.join(remoteSkillDir, STANDARD_FILES.METADATA_YAML),
        `cli_name: React\nauthor: "@vince"`,
      );

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill(
          "web-framework-react",
          "web/framework",
          remoteSkillRelPath,
          { local: true, localPath: localSkillPath },
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
        const result = await copySkillsToLocalFlattened(
          ["web-framework-react"],
          localSkillsDir,
          matrix,
          sourceResult,
          { "web-framework-react": "public" } as Partial<Record<SkillId, string>>,
        );

        // Should copy from remote, NOT preserve local
        expect(result).toHaveLength(1);
        expect(result[0].local).toBeUndefined();
        expect(result[0].destPath).toBe(path.join(localSkillsDir, "web-framework-react"));

        // Verify the remote content was copied
        const copiedContent = await readFile(
          path.join(localSkillsDir, "web-framework-react", STANDARD_FILES.SKILL_MD),
          "utf-8",
        );
        expect(copiedContent).toContain("Remote React content");
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("preserves local skill when sourceSelections selects local", async () => {
      const localSkillPath = ".claude/skills/web-framework-react/";
      const localSkillDir = path.join(projectDir, localSkillPath);
      await mkdir(localSkillDir, { recursive: true });
      await writeFile(
        path.join(localSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-framework-react (@local)\ndescription: Local React\n---\nLocal`,
      );

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill(
          "web-framework-react",
          "web/framework",
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
        const result = await copySkillsToLocalFlattened(
          ["web-framework-react"],
          localSkillsDir,
          matrix,
          sourceResult,
          { "web-framework-react": "local" } as Partial<Record<SkillId, string>>,
        );

        // Should preserve local
        expect(result).toHaveLength(1);
        expect(result[0].local).toBe(true);
        expect(result[0].sourcePath).toBe(localSkillPath);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("works without sourceSelections (backward compatible)", async () => {
      const localSkillPath = ".claude/skills/web-framework-react/";
      const localSkillDir = path.join(projectDir, localSkillPath);
      await mkdir(localSkillDir, { recursive: true });
      await writeFile(
        path.join(localSkillDir, STANDARD_FILES.SKILL_MD),
        `---\nname: web-framework-react (@local)\ndescription: Local React\n---\nLocal`,
      );

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill(
          "web-framework-react",
          "web/framework",
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
        // No sourceSelections passed — should behave as before (preserve local)
        const result = await copySkillsToLocalFlattened(
          ["web-framework-react"],
          localSkillsDir,
          matrix,
          sourceResult,
        );

        expect(result).toHaveLength(1);
        expect(result[0].local).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
