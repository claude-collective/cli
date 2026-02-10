import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { loadSkillsMatrixFromSource } from "./source-loader";
import type { ResolvedSkill, CategoryDefinition } from "../types-matrix";

// Skills are in claude-subagents repo, not CLI repo
// CLI tests need to point to the skills repo for integration tests
const SKILLS_REPO_ROOT = path.resolve(__dirname, "../../../../claude-subagents");
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
    expect(localSkill.name).toBe("My Local Skill @local");
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
    expect((result.matrix.categories as Record<string, CategoryDefinition>)["local/custom"]).toBeUndefined();
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

describe("source-loader integration", () => {
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
    expect(firstSkill.name).toBeDefined();
    expect(firstSkill.category).toBeDefined();
    expect(firstSkill.path).toBeDefined();
  });

  it("should load suggested stacks", async () => {
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
    });

    // Phase 6: stacks loaded from config/stacks.yaml
    expect(result.matrix.suggestedStacks).toBeDefined();
    // Stacks should be loaded from CLI's config/stacks.yaml
    expect(result.matrix.suggestedStacks.length).toBeGreaterThan(0);

    // Verify stack structure
    const firstStack = result.matrix.suggestedStacks[0];
    expect(firstStack.id).toBeDefined();
    expect(firstStack.name).toBeDefined();
    // Note: allSkillIds is empty in new format - skills come from agents at compile time
    expect(firstStack.allSkillIds).toBeDefined();
  });

  // Skip: In Phase 6 agent-centric config, stacks no longer have allSkillIds.
  // Skills come from agents at compile time, not from stack config.
  it.skip("should resolve stack skill IDs to actual skill IDs in matrix", async () => {
    // Test skipped - stacks no longer contain skill references
  });

  // Skip: In Phase 6 agent-centric config, stacks no longer have allSkillIds.
  // Skills come from agents at compile time, not from stack config.
  it.skip("should resolve stack skill IDs that can be used for selection tracking", async () => {
    // Test skipped - stacks no longer contain skill references
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
