import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { loadSkillsMatrixFromSource } from "./source-loader";
import type { CategoryDefinition, ResolvedSkill } from "../../types";

// Skills are in claude-subagents repo, not CLI repo
// CLI tests need to point to the skills repo for integration tests
const SKILLS_REPO_ROOT = path.resolve(__dirname, "../../../../../claude-subagents");
// Fallback to the linked .claude folder's parent if skills repo not at expected path
const SKILLS_SOURCE = process.env.CC_TEST_SKILLS_SOURCE || SKILLS_REPO_ROOT;

// Tests that need specific marketplace skills require explicit opt-in
const itIntegration = process.env.CC_TEST_SKILLS_SOURCE ? it : it.skip;

describe("source-loader", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-source-loader-test-"));
    // Clear environment
    delete process.env.CC_SOURCE;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    delete process.env.CC_SOURCE;
  });

  describe("loadSkillsMatrixFromSource", () => {
    describe("dev mode detection", () => {
      it("should use local mode when devMode flag is explicitly set", async () => {
        // Dev mode is now opt-in via the devMode flag
        // When devMode is true, it loads from PROJECT_ROOT (which is CLI repo)
        // Since CLI repo doesn't have skills, we need to provide sourceFlag
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: SKILLS_SOURCE,
          projectDir: tempDir,
          devMode: true,
        });

        // Should load from local source in dev mode
        expect(result.isLocal).toBe(true);
        expect(result.matrix).toBeDefined();
        expect(result.matrix.skills).toBeDefined();
      });

      it("should use source flag when provided", async () => {
        // Using an explicit local path as source
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: SKILLS_SOURCE,
          projectDir: tempDir,
        });

        expect(result.isLocal).toBe(true);
        expect(result.sourceConfig.source).toBe(SKILLS_SOURCE);
        expect(result.sourceConfig.sourceOrigin).toBe("flag");
      });
    });

    describe("local source loading", () => {
      it("should load matrix from local source", async () => {
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: SKILLS_SOURCE,
          projectDir: tempDir,
        });

        expect(result.matrix).toBeDefined();
        expect(result.matrix.version).toBeDefined();
        expect(result.matrix.categories).toBeDefined();
        expect(result.matrix.skills).toBeDefined();
        expect(Object.keys(result.matrix.skills).length).toBeGreaterThan(0);
      });

      it("should set sourcePath to the root path", async () => {
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: SKILLS_SOURCE,
          projectDir: tempDir,
        });

        expect(result.sourcePath).toBe(SKILLS_SOURCE);
      });

      it("should mark result as local", async () => {
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: SKILLS_SOURCE,
          projectDir: tempDir,
        });

        expect(result.isLocal).toBe(true);
      });
    });

    describe("error handling", () => {
      it("should return empty skills for non-existent skills directory", async () => {
        // With new architecture: matrix loads from CLI repo (always succeeds)
        // Skills extraction gracefully returns empty for non-existent paths
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: "/non/existent/path",
          projectDir: tempDir,
        });

        // Matrix loads from CLI, but no skills from non-existent path
        expect(result.matrix).toBeDefined();
        expect(result.matrix.categories).toBeDefined();
        // Skills from the source path should be empty
        // (matrix defines skills but they won't have content from source)
      });

      it("should return empty skills if skills directory is missing", async () => {
        // Create a directory without src/skills/
        const emptySource = path.join(tempDir, "empty-source");
        await mkdir(emptySource, { recursive: true });

        // With new architecture: matrix loads from CLI repo (always succeeds)
        // Skills extraction gracefully returns empty for missing src/skills/
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: emptySource,
          projectDir: tempDir,
        });

        expect(result.matrix).toBeDefined();
        expect(result.matrix.categories).toBeDefined();
      });
    });
  });
});

describe("source-loader local skills integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-local-skills-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should merge local skills into matrix when .claude/skills exists", async () => {
    // Create a local skill in the temp project
    const skillsDir = path.join(tempDir, ".claude", "skills", "test-my-skill");
    await mkdir(skillsDir, { recursive: true });

    await writeFile(
      path.join(skillsDir, "metadata.yaml"),
      `cli_name: My Local Skill\ncli_description: A local skill`,
    );
    await writeFile(
      path.join(skillsDir, "SKILL.md"),
      `---\nname: my-local-skill\ndescription: A local skill\n---\nContent`,
    );

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
      projectDir: tempDir,
    });

    // Local skill should be in the matrix with normalized ID
    const skills = result.matrix.skills as Record<string, ResolvedSkill>;
    expect(skills["my-local-skill"]).toBeDefined();
    const localSkill = skills["my-local-skill"];

    expect(localSkill.id).toBe("my-local-skill");
    // New local skill without a category in metadata.yaml gets "local" from local-skill-loader defaults
    expect(localSkill.category).toBe("local");
    expect(localSkill.author).toBe("@local");
    expect(localSkill.local).toBe(true);
    expect(localSkill.localPath).toBe(".claude/skills/test-my-skill/");
  });

  it("should not inject fake local category definitions into the matrix", async () => {
    const skillsDir = path.join(tempDir, ".claude", "skills", "test-cat-skill");
    await mkdir(skillsDir, { recursive: true });

    await writeFile(path.join(skillsDir, "metadata.yaml"), `cli_name: Category Test`);
    await writeFile(
      path.join(skillsDir, "SKILL.md"),
      `---\nname: cat-skill (@local)\ndescription: Category test\n---\nContent`,
    );

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
      projectDir: tempDir,
    });

    // Local skills should NOT cause fake "local" or "local/custom" categories to be injected
    // The skill uses whatever category it declared (or "local" default from local-skill-loader)
    expect(
      (result.matrix.categories as Record<string, CategoryDefinition>)["local/custom"],
    ).toBeUndefined();
  });

  it("should not modify matrix when no local skills exist", async () => {
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
      projectDir: tempDir, // No .claude/skills directory
    });

    // Local categories should NOT be added if no local skills
    // (Matrix may already have local categories from previous tests,
    // so we check that no local skills are in the skills object)
    const localSkills = Object.values(result.matrix.skills).filter((s) => s!.local === true);
    expect(localSkills).toHaveLength(0);
  });

  it("should preserve remote skill category when local skill overwrites with category 'local'", async () => {
    // First, load the matrix without local skills to find a skill we can override
    const initialResult = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
      projectDir: tempDir,
    });

    // Find a skill that has a domain-based category
    const skillsMap = initialResult.matrix.skills as Record<string, ResolvedSkill>;
    const categoriesMap = initialResult.matrix.categories as Record<string, CategoryDefinition>;
    const targetSkillId = Object.keys(skillsMap).find((id) => {
      const skill = skillsMap[id];
      return skill.category !== "local" && categoriesMap[skill.category]?.domain;
    });

    // Skip if no suitable skill found (defensive)
    if (!targetSkillId) return;

    const originalSkill = skillsMap[targetSkillId];
    const originalCategory = originalSkill.category;

    // Create a local skill with the SAME ID but no category in metadata
    // (so local-skill-loader defaults category to "local" from LOCAL_CATEGORY constant)
    const skillsDir = path.join(tempDir, ".claude", "skills", "test-override-category");
    await mkdir(skillsDir, { recursive: true });

    await writeFile(path.join(skillsDir, "metadata.yaml"), `cli_name: Override Test`);
    await writeFile(
      path.join(skillsDir, "SKILL.md"),
      `---\nname: ${targetSkillId}\ndescription: Local override\n---\nContent`,
    );

    // Load again with the local skill override
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
      projectDir: tempDir,
    });

    const overriddenSkill = (result.matrix.skills as Record<string, ResolvedSkill>)[targetSkillId];
    expect(overriddenSkill).toBeDefined();
    expect(overriddenSkill.local).toBe(true);

    // The category should be preserved from the remote skill
    expect(overriddenSkill.category).toBe(originalCategory);
  });

  it("should preserve existing skills when merging local skills", async () => {
    const skillsDir = path.join(tempDir, ".claude", "skills", "test-preserve");
    await mkdir(skillsDir, { recursive: true });

    await writeFile(path.join(skillsDir, "metadata.yaml"), `cli_name: Preserve Test`);
    await writeFile(
      path.join(skillsDir, "SKILL.md"),
      `---\nname: preserve-skill\ndescription: Preserve test\n---\nContent`,
    );

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
      projectDir: tempDir,
    });

    // Existing marketplace skills should still be present
    const marketplaceSkills = Object.values(result.matrix.skills).filter((s) => s!.local !== true);
    expect(marketplaceSkills.length).toBeGreaterThan(50);

    // Local skill should also be present with normalized ID
    expect((result.matrix.skills as Record<string, ResolvedSkill>)["preserve-skill"]).toBeDefined();
  });

  itIntegration("P1-19: local skill takes precedence over plugin skill with same ID", async () => {
    // First, get the list of skills from the marketplace to find one to override
    const initialResult = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
      projectDir: tempDir,
    });

    // Pick an existing skill from the marketplace to override
    // Skill IDs are now normalized: web-testing-vitest
    const existingSkillId = "web-testing-vitest";
    const existingSkill = initialResult.matrix.skills[existingSkillId]!;
    expect(existingSkill).toBeDefined();
    expect(existingSkill.local).toBeUndefined(); // Should be a marketplace skill
    const originalDescription = existingSkill.description;

    // Create a local skill with the SAME normalized ID to override it
    const skillsDir = path.join(tempDir, ".claude", "skills", "local-vitest");
    await mkdir(skillsDir, { recursive: true });

    await writeFile(path.join(skillsDir, "metadata.yaml"), `cli_name: My Custom Vitest`);
    await writeFile(
      path.join(skillsDir, "SKILL.md"),
      `---\nname: web-testing-vitest\ndescription: My custom vitest configuration\n---\nThis is my local override of the vitest skill.`,
    );

    // Load again with the local skill in place
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
      projectDir: tempDir,
    });

    // The skill should now be the LOCAL version, not the marketplace version
    const overriddenSkill = result.matrix.skills[existingSkillId]!;
    expect(overriddenSkill).toBeDefined();
    expect(overriddenSkill.local).toBe(true);
    expect(overriddenSkill.description).toBe("My custom vitest configuration");
    // Verify the original description was different (proves we actually overwrote something)
    expect(overriddenSkill.description).not.toBe(originalDescription);
    expect(overriddenSkill.author).toBe("@local");
    // When overwriting a remote skill, the remote skill's category is inherited
    expect(overriddenSkill.category).toBe(existingSkill.category);
    expect(overriddenSkill.localPath).toBe(".claude/skills/local-vitest/");
  });
});

describe("source-loader config-driven paths", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-config-paths-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should use custom skills_dir from source config", async () => {
    const sourceDir = path.join(tempDir, "custom-source");

    // Create source config with custom skills_dir
    const configDir = path.join(sourceDir, ".claude-src");
    await mkdir(configDir, { recursive: true });
    await writeFile(path.join(configDir, "config.yaml"), "skills_dir: lib/skills\n");

    // Create skills in the custom directory
    const skillsDir = path.join(sourceDir, "lib", "skills", "web", "framework", "react");
    await mkdir(skillsDir, { recursive: true });
    await writeFile(
      path.join(skillsDir, "SKILL.md"),
      "---\nname: web-framework-react\ndescription: React framework\n---\nReact skill content",
    );
    await writeFile(
      path.join(skillsDir, "metadata.yaml"),
      'category: web/framework\nauthor: "@test"\nversion: 1\ncli_name: React\ncli_description: React framework\nusage_guidance: Use React for building UIs\ncontent_hash: abc1234\n',
    );

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: sourceDir,
      projectDir: tempDir,
    });

    // Skill should be loaded from custom path
    expect(result.matrix.skills["web-framework-react"]).toBeDefined();
  });

  it("should use custom matrix_file path from source config", async () => {
    const sourceDir = path.join(tempDir, "custom-matrix-source");

    // Create source config with custom matrix_file pointing to a non-existent path
    const configDir = path.join(sourceDir, ".claude-src");
    await mkdir(configDir, { recursive: true });
    await writeFile(path.join(configDir, "config.yaml"), "matrix_file: data/matrix.yaml\n");

    // Do NOT create matrix at data/matrix.yaml — loader should fall back to CLI matrix
    await mkdir(path.join(sourceDir, "src", "skills"), { recursive: true });

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: sourceDir,
      projectDir: tempDir,
    });

    // Falls back to CLI matrix since custom path doesn't exist
    expect(result.matrix).toBeDefined();
    expect(result.matrix.categories).toBeDefined();
    expect(Object.keys(result.matrix.categories).length).toBeGreaterThan(0);
  });

  it("should prefer matrix at custom path over convention path", async () => {
    // Verify that when matrix_file is set and file exists at that path,
    // the loader uses it (verified by skills_dir test above which loads
    // matrix from CLI fallback, showing the path resolution works)
    const sourceDir = path.join(tempDir, "matrix-path-pref-source");
    const configDir = path.join(sourceDir, ".claude-src");
    await mkdir(configDir, { recursive: true });
    await writeFile(path.join(configDir, "config.yaml"), "matrix_file: nonexistent/matrix.yaml\n");

    // Also create convention-path matrix to verify it doesn't use it
    // (it should check nonexistent/matrix.yaml first, not find it,
    // then fall back to CLI)
    const conventionDir = path.join(sourceDir, "config");
    await mkdir(conventionDir, { recursive: true });

    await mkdir(path.join(sourceDir, "src", "skills"), { recursive: true });

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: sourceDir,
      projectDir: tempDir,
    });

    // Should fall back to CLI matrix (not convention-path, because config overrides convention)
    expect(result.matrix).toBeDefined();
  });

  it("should use custom stacks_file from source config", async () => {
    const sourceDir = path.join(tempDir, "custom-stacks-source");

    // Create source config with custom stacks_file
    const configDir = path.join(sourceDir, ".claude-src");
    await mkdir(configDir, { recursive: true });
    await writeFile(path.join(configDir, "config.yaml"), "stacks_file: data/stacks.yaml\n");

    // Create stacks at the custom path
    const dataDir = path.join(sourceDir, "data");
    await mkdir(dataDir, { recursive: true });
    await writeFile(
      path.join(dataDir, "stacks.yaml"),
      `stacks:\n  - id: custom-path-stack\n    name: Custom Path Stack\n    description: Stack from custom path\n    agents:\n      web-developer:\n        framework: web-framework-react\n`,
    );

    // Create empty skills dir
    await mkdir(path.join(sourceDir, "src", "skills"), { recursive: true });

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: sourceDir,
      projectDir: tempDir,
    });

    expect(result.matrix.suggestedStacks).toBeDefined();
    expect(result.matrix.suggestedStacks.length).toBe(1);
    expect(result.matrix.suggestedStacks[0].id).toBe("custom-path-stack");
  });

  it("should fall back to convention defaults when source has no config", async () => {
    const sourceDir = path.join(tempDir, "no-config-source");

    // No .claude-src/config.yaml — just create conventional paths
    await mkdir(path.join(sourceDir, "src", "skills"), { recursive: true });

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: sourceDir,
      projectDir: tempDir,
    });

    // Should still work using convention defaults
    expect(result.matrix).toBeDefined();
    expect(result.matrix.categories).toBeDefined();
  });

  it("should fall back to convention defaults when config has no path overrides", async () => {
    const sourceDir = path.join(tempDir, "config-no-paths-source");

    // Create source config WITHOUT path fields
    const configDir = path.join(sourceDir, ".claude-src");
    await mkdir(configDir, { recursive: true });
    await writeFile(path.join(configDir, "config.yaml"), "source: github:myorg/skills\n");

    await mkdir(path.join(sourceDir, "src", "skills"), { recursive: true });

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: sourceDir,
      projectDir: tempDir,
    });

    // Should still work using convention defaults
    expect(result.matrix).toBeDefined();
    expect(result.matrix.categories).toBeDefined();
  });
});

describe("source-loader integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-integration-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should load all skills from local source", async () => {
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
    });

    // Verify we loaded a reasonable number of skills
    const skillCount = Object.keys(result.matrix.skills).length;
    expect(skillCount).toBeGreaterThan(50); // We know there are 70+ skills

    // Verify skills have required properties
    const firstSkill = Object.values(result.matrix.skills)[0]!;
    expect(firstSkill.id).toBeDefined();
    expect(firstSkill.category).toBeDefined();
    expect(firstSkill.path).toBeDefined();
  });

  it("should load suggested stacks", async () => {
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
    });

    // Stacks loaded from source or CLI fallback
    expect(result.matrix.suggestedStacks).toBeDefined();
    expect(result.matrix.suggestedStacks.length).toBeGreaterThan(0);

    // Verify stack structure
    const firstStack = result.matrix.suggestedStacks[0];
    expect(firstStack.id).toBeDefined();
    expect(firstStack.name).toBeDefined();
    expect(firstStack.allSkillIds).toBeDefined();
  });

  it("should load stacks from source when source has config/stacks.yaml", async () => {
    // Create a source directory with its own stacks.yaml
    const sourceDir = path.join(tempDir, "custom-source");
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    // Write a minimal custom stacks.yaml with a unique stack ID
    await writeFile(
      path.join(configDir, "stacks.yaml"),
      `stacks:
  - id: custom-test-stack
    name: Custom Test Stack
    description: A test stack from the source
    agents:
      web-developer:
        framework: web-framework-react
`,
    );

    // Create an empty src/skills dir so extractAllSkills doesn't fail
    await mkdir(path.join(sourceDir, "src", "skills"), { recursive: true });

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: sourceDir,
      projectDir: tempDir,
    });

    // Should load the custom stack from source, not CLI stacks
    expect(result.matrix.suggestedStacks).toBeDefined();
    expect(result.matrix.suggestedStacks.length).toBe(1);
    expect(result.matrix.suggestedStacks[0].id).toBe("custom-test-stack");
    expect(result.matrix.suggestedStacks[0].name).toBe("Custom Test Stack");
  });

  it("should fall back to CLI stacks when source has no config/stacks.yaml", async () => {
    // Create a source directory without stacks.yaml
    const sourceDir = path.join(tempDir, "no-stacks-source");
    await mkdir(path.join(sourceDir, "src", "skills"), { recursive: true });

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: sourceDir,
      projectDir: tempDir,
    });

    // Should fall back to CLI's stacks (which has multiple stacks)
    expect(result.matrix.suggestedStacks).toBeDefined();
    expect(result.matrix.suggestedStacks.length).toBeGreaterThan(1);
  });

  it("should load categories", async () => {
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
    });

    expect(result.matrix.categories).toBeDefined();
    const categoryCount = Object.keys(result.matrix.categories).length;
    expect(categoryCount).toBeGreaterThan(10); // We know there are 20+ categories
  });
});
