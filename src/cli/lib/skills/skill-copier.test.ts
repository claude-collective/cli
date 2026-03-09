import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import { mkdir, readFile } from "fs/promises";
import {
  copySkillsToPluginFromSource,
  copySkillsToLocalFlattened,
  validateSkillPath,
} from "./skill-copier";
import type { SkillId } from "../../types";
import { CLAUDE_DIR, PROJECT_ROOT, STANDARD_DIRS, STANDARD_FILES } from "../../consts";
import { findSkill, useMatrixStore } from "../../stores/matrix-store";
import {
  buildSourceResult,
  createMockSkill,
  createMockMatrix,
  createTempDir,
  cleanupTempDir,
  writeTestSkill,
} from "../__tests__/helpers";

/**
 * Write a local skill SKILL.md to .claude/skills/<skillId>/ in the project directory.
 * Returns the relative local skill path (e.g., ".claude/skills/web-framework-react/").
 */
async function writeLocalSkillOnDisk(
  projectDir: string,
  skillId: SkillId,
): Promise<string> {
  const skill = findSkill(skillId);
  if (!skill) {
    throw new Error(
      `writeLocalSkillOnDisk: "${skillId}" not found in matrix store`,
    );
  }
  const localSkillPath = `.claude/skills/${skillId}/`;
  await writeTestSkill(path.join(projectDir, ".claude/skills"), skillId, {
    skillContent: `---\nname: ${skillId} (@local)\ndescription: ${skill.description}\n---\n${skillId} content`,
    skipMetadata: true,
  });
  return localSkillPath;
}

/**
 * Write a remote source skill with SKILL.md and metadata.yaml to src/<relPath> in the project directory.
 * Returns the skill directory path.
 */
async function writeRemoteSkillOnDisk(
  projectDir: string,
  relPath: string,
  config: {
    name: string;
    displayName?: string;
    author?: string;
  },
): Promise<string> {
  const skillDir = path.join(projectDir, "src", relPath);
  // Boundary cast: path.basename extracts the skill ID directory name (e.g., "web-framework-react")
  const skillId = path.basename(relPath) as SkillId;
  const skill = findSkill(skillId);
  if (!skill) {
    throw new Error(
      `writeRemoteSkillOnDisk: "${skillId}" not found in matrix store`,
    );
  }
  await writeTestSkill(path.join(projectDir, "src", path.dirname(relPath)), skillId, {
    skillContent: `---\nname: ${config.name}\ndescription: ${skill.description}\n---\n${skill.description}`,
    extraMetadata: {
      displayName: config.displayName ?? config.name,
      author: config.author ?? "@vince",
    },
  });
  return skillDir;
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
    tempDir = await createTempDir("cc-skill-copier-test-");
    pluginDir = path.join(tempDir, "plugin");
    projectDir = path.join(tempDir, "project");
    await mkdir(pluginDir, { recursive: true });
    await mkdir(projectDir, { recursive: true });
    useMatrixStore.getState().setMatrix(createMockMatrix({
      "web-testing-copier": createMockSkill("web-testing-copier"),
      "web-testing-metadata": createMockSkill("web-testing-metadata"),
      "web-styling-custom": createMockSkill("web-styling-custom"),
      "web-framework-react": createMockSkill("web-framework-react", {
        compatibleWith: ["web-framework-react"],
      }),
      "web-state-zustand": createMockSkill("web-state-zustand", {
        compatibleWith: ["web-framework-react"],
      }),
      "api-framework-hono": createMockSkill("api-framework-hono"),
      "web-testing-vitest": createMockSkill("web-testing-vitest"),
      "web-tooling-vite": createMockSkill("web-tooling-vite"),
    }));
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("copySkillsToPluginFromSource", () => {
    it("skips local skills and does not copy them", async () => {
      // Create a local skill in the project's .claude/skills/ directory
      const localSkillPath = await writeLocalSkillOnDisk(projectDir, "web-testing-copier");

      const matrix = createMockMatrix({
        "web-testing-copier": createMockSkill("web-testing-copier", {
          category: "local",
          path: localSkillPath,
          local: true,
          localPath: localSkillPath,
        }),
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

      // Change cwd to project dir for local skill resolution
      const originalCwd = process.cwd();
      process.chdir(projectDir);

      try {
        const result = await copySkillsToPluginFromSource(
          ["web-testing-copier"],
          pluginDir,
          matrix,
          sourceResult,
        );

        // Local skill should be returned but marked as local
        expect(result).toHaveLength(1);
        expect(result[0].skillId).toBe("web-testing-copier");
        expect(result[0].local).toBe(true);
        expect(result[0].sourcePath).toBe(localSkillPath);
        expect(result[0].destPath).toBe(localSkillPath);

        // Verify skill was NOT copied to plugin dir
        const copiedSkillDir = path.join(pluginDir, STANDARD_DIRS.SKILLS, "web-testing-copier");
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
      const localSkillPath = await writeLocalSkillOnDisk(projectDir, "web-testing-metadata");

      const matrix = createMockMatrix({
        "web-testing-metadata": createMockSkill("web-testing-metadata", {
          category: "local",
          path: localSkillPath,
          local: true,
          localPath: localSkillPath,
        }),
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

      const originalCwd = process.cwd();
      process.chdir(projectDir);

      try {
        const result = await copySkillsToPluginFromSource(
          ["web-testing-metadata"],
          pluginDir,
          matrix,
          sourceResult,
        );

        expect(result[0]).toMatchObject({
          skillId: "web-testing-metadata",
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
      const localSkillPath = await writeLocalSkillOnDisk(projectDir, "web-styling-custom");

      // Create remote skill in source location (simulating fetched source)
      const remoteSkillRelPath = "skills/web/framework/web-framework-react/";
      await writeRemoteSkillOnDisk(projectDir, remoteSkillRelPath, {
        name: "web-framework-react",
      });

      const matrix = createMockMatrix({
        "web-styling-custom": createMockSkill("web-styling-custom", {
          category: "local",
          path: localSkillPath,
          local: true,
          localPath: localSkillPath,
        }),
        "web-framework-react": {
          ...createMockSkill("web-framework-react", {
            compatibleWith: ["web-framework-react"],
          }),
          path: remoteSkillRelPath,
        },
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

      const originalCwd = process.cwd();
      process.chdir(projectDir);

      try {
        const result = await copySkillsToPluginFromSource(
          ["web-styling-custom", "web-framework-react"],
          pluginDir,
          matrix,
          sourceResult,
        );

        expect(result).toHaveLength(2);

        // Find local and remote results
        const localResult = result.find((r) => r.local === true);
        const remoteResult = result.find((r) => r.local !== true);

        // Local skill should not be copied
        expect(localResult?.skillId).toBe("web-styling-custom");
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

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

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

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

      const result = await copySkillsToPluginFromSource([], pluginDir, matrix, sourceResult);

      expect(result).toEqual([]);
    });

    it("overrides local-skip when sourceSelections selects remote source", async () => {
      // Create local skill
      const localSkillPath = await writeLocalSkillOnDisk(projectDir, "web-framework-react");

      // Create remote skill in source
      const remoteSkillRelPath = "skills/web/framework/web-framework-react/";
      await writeRemoteSkillOnDisk(projectDir, remoteSkillRelPath, {
        name: "web-framework-react",
        displayName: "React",
      });

      const matrix = createMockMatrix({
        "web-framework-react": {
          ...createMockSkill("web-framework-react", {
            compatibleWith: ["web-framework-react"],
          }),
          path: remoteSkillRelPath,
          local: true,
          localPath: localSkillPath,
        },
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

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
      const localSkillPath = await writeLocalSkillOnDisk(projectDir, "web-framework-react");

      const matrix = createMockMatrix({
        "web-framework-react": {
          ...createMockSkill("web-framework-react", {
            compatibleWith: ["web-framework-react"],
          }),
          path: localSkillPath,
          local: true,
          localPath: localSkillPath,
        },
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

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
      await writeRemoteSkillOnDisk(projectDir, remoteSkillRelPath, {
        name: "web-state-zustand",
        displayName: "Zustand",
      });

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      await mkdir(localSkillsDir, { recursive: true });

      const matrix = createMockMatrix({
        "web-state-zustand": {
          ...createMockSkill("web-state-zustand", {
            compatibleWith: ["web-framework-react"],
          }),
          path: remoteSkillRelPath,
        },
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

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
      expect(copiedSkillMd).toContain("web-state-zustand");
    });

    it("copies skills using extracted name when no alias", async () => {
      // Create remote skill without alias
      const remoteSkillRelPath = "skills/api/api/api-framework-hono/";
      await writeRemoteSkillOnDisk(projectDir, remoteSkillRelPath, {
        name: "api-framework-hono",
        displayName: "Hono",
      });

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      await mkdir(localSkillsDir, { recursive: true });

      const matrix = createMockMatrix({
        "api-framework-hono": {
          ...createMockSkill("api-framework-hono"),
          path: remoteSkillRelPath,
        },
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

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
      const localSkillPath = await writeLocalSkillOnDisk(projectDir, "web-testing-copier");

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);

      const matrix = createMockMatrix({
        "web-testing-copier": createMockSkill("web-testing-copier", {
          category: "local",
          path: localSkillPath,
          local: true,
          localPath: localSkillPath,
        }),
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

      const originalCwd = process.cwd();
      process.chdir(projectDir);

      try {
        const result = await copySkillsToLocalFlattened(
          ["web-testing-copier"],
          localSkillsDir,
          matrix,
          sourceResult,
        );

        // Local skill should be returned but marked as local
        expect(result).toHaveLength(1);
        expect(result[0].skillId).toBe("web-testing-copier");
        expect(result[0].local).toBe(true);
        expect(result[0].sourcePath).toBe(localSkillPath);
        expect(result[0].destPath).toBe(localSkillPath);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("handles mix of local and remote skills", async () => {
      // Create local skill
      const localSkillPath = await writeLocalSkillOnDisk(projectDir, "web-styling-custom");

      // Create remote skill
      const remoteSkillRelPath = "skills/web/framework/web-framework-react/";
      await writeRemoteSkillOnDisk(projectDir, remoteSkillRelPath, {
        name: "web-framework-react",
        displayName: "React",
      });

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);

      const matrix = createMockMatrix({
        "web-styling-custom": createMockSkill("web-styling-custom", {
          category: "local",
          path: localSkillPath,
          local: true,
          localPath: localSkillPath,
        }),
        "web-framework-react": {
          ...createMockSkill("web-framework-react", {
            compatibleWith: ["web-framework-react"],
          }),
          path: remoteSkillRelPath,
        },
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

      const originalCwd = process.cwd();
      process.chdir(projectDir);

      try {
        const result = await copySkillsToLocalFlattened(
          ["web-styling-custom", "web-framework-react"],
          localSkillsDir,
          matrix,
          sourceResult,
        );

        expect(result).toHaveLength(2);

        // Find local and remote results
        const localResult = result.find((r) => r.local === true);
        const remoteResult = result.find((r) => r.local !== true);

        // Local skill should not be copied
        expect(localResult?.skillId).toBe("web-styling-custom");
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

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

      const result = await copySkillsToLocalFlattened([], localSkillsDir, matrix, sourceResult);

      expect(result).toEqual([]);
    });

    it("flattens deeply nested directory structures", async () => {
      // Create a skill with a deeply nested path like:
      // skills/web/framework/web-framework-react/
      // This should be flattened to: .claude/skills/web-framework-react/
      const deeplyNestedPath = "skills/web/framework/client-rendering/web-framework-react/";
      await writeRemoteSkillOnDisk(projectDir, deeplyNestedPath, {
        name: "web-framework-react",
        displayName: "React",
      });

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      await mkdir(localSkillsDir, { recursive: true });

      const matrix = createMockMatrix({
        "web-framework-react": {
          ...createMockSkill("web-framework-react", {
            compatibleWith: ["web-framework-react"],
          }),
          path: deeplyNestedPath,
        },
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

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
      expect(copiedSkillMd).toContain("web-framework-react");

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

    it("flattens multiple skills from different nested directories", async () => {
      // Create skills from different nested paths
      const reactPath = "skills/web/framework/web-framework-react/";
      await writeRemoteSkillOnDisk(projectDir, reactPath, {
        name: "web-framework-react",
        displayName: "React",
      });

      const honoPath = "skills/api/api/api-framework-hono/";
      await writeRemoteSkillOnDisk(projectDir, honoPath, {
        name: "api-framework-hono",
        displayName: "Hono",
      });

      const vitestPath = "skills/testing/unit/web-testing-vitest/";
      await writeRemoteSkillOnDisk(projectDir, vitestPath, {
        name: "web-testing-vitest",
        displayName: "Vitest",
      });

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      await mkdir(localSkillsDir, { recursive: true });

      const matrix = createMockMatrix({
        "web-framework-react": {
          ...createMockSkill("web-framework-react", {
            compatibleWith: ["web-framework-react"],
          }),
          path: reactPath,
        },
        "api-framework-hono": {
          ...createMockSkill("api-framework-hono"),
          path: honoPath,
        },
        "web-testing-vitest": {
          ...createMockSkill("web-testing-vitest"),
          path: vitestPath,
        },
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

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

      expect(reactContent).toContain("web-framework-react");
      expect(honoContent).toContain("api-framework-hono");
      expect(vitestContent).toContain("web-testing-vitest");
    });

    it("uses skill ID name when no alias is provided", async () => {
      // Create a skill without an alias - should extract name from skill ID
      const nestedPath = "skills/tooling/bundler/web-tooling-vite/";
      await writeRemoteSkillOnDisk(projectDir, nestedPath, {
        name: "web-tooling-vite",
        displayName: "Vite",
      });

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
      await mkdir(localSkillsDir, { recursive: true });

      const matrix = createMockMatrix({
        "web-tooling-vite": createMockSkill("web-tooling-vite", {
          category: "web-tooling",
          path: nestedPath,
        }),
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

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
      const localSkillPath = await writeLocalSkillOnDisk(projectDir, "web-framework-react");

      // Create remote skill in source
      const remoteSkillRelPath = "skills/web/framework/web-framework-react/";
      await writeRemoteSkillOnDisk(projectDir, remoteSkillRelPath, {
        name: "web-framework-react",
        displayName: "React",
      });

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);

      const matrix = createMockMatrix({
        "web-framework-react": {
          ...createMockSkill("web-framework-react", {
            compatibleWith: ["web-framework-react"],
          }),
          path: remoteSkillRelPath,
          local: true,
          localPath: localSkillPath,
        },
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

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

        // Verify the remote content was copied (not the local version with (@local) in name)
        const copiedContent = await readFile(
          path.join(localSkillsDir, "web-framework-react", STANDARD_FILES.SKILL_MD),
          "utf-8",
        );
        expect(copiedContent).not.toContain("(@local)");
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("preserves local skill when sourceSelections selects local", async () => {
      const localSkillPath = await writeLocalSkillOnDisk(projectDir, "web-framework-react");

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);

      const matrix = createMockMatrix({
        "web-framework-react": {
          ...createMockSkill("web-framework-react", {
            compatibleWith: ["web-framework-react"],
          }),
          path: localSkillPath,
          local: true,
          localPath: localSkillPath,
        },
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

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
      const localSkillPath = await writeLocalSkillOnDisk(projectDir, "web-framework-react");

      const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);

      const matrix = createMockMatrix({
        "web-framework-react": {
          ...createMockSkill("web-framework-react", {
            compatibleWith: ["web-framework-react"],
          }),
          path: localSkillPath,
          local: true,
          localPath: localSkillPath,
        },
      });

      const sourceResult = buildSourceResult(matrix, projectDir, {
        sourceConfig: { source: PROJECT_ROOT, sourceOrigin: "flag" },
      });

      const originalCwd = process.cwd();
      process.chdir(projectDir);

      try {
        // No sourceSelections passed -- should behave as before (preserve local)
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
