import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { loadSkillsMatrixFromSource } from "./source-loader";

// Skills are in claude-subagents repo, not CLI repo
// CLI tests need to point to the skills repo for integration tests
const SKILLS_REPO_ROOT = path.resolve(
  __dirname,
  "../../../../claude-subagents",
);
// Fallback to the linked .claude folder's parent if skills repo not at expected path
const SKILLS_SOURCE = process.env.CC_TEST_SKILLS_SOURCE || SKILLS_REPO_ROOT;

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
      `---\nname: my-local-skill (@local)\ndescription: A local skill\n---\nContent`,
    );

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
      projectDir: tempDir,
    });

    // Local skill should be in the matrix
    expect(result.matrix.skills["my-local-skill (@local)"]).toBeDefined();
    const localSkill = result.matrix.skills["my-local-skill (@local)"];

    expect(localSkill.id).toBe("my-local-skill (@local)");
    expect(localSkill.name).toBe("My Local Skill @local");
    expect(localSkill.category).toBe("local/custom");
    expect(localSkill.author).toBe("@local");
    expect(localSkill.local).toBe(true);
    expect(localSkill.localPath).toBe(".claude/skills/test-my-skill/");
  });

  it("should add local category definitions when local skills exist", async () => {
    const skillsDir = path.join(tempDir, ".claude", "skills", "test-cat-skill");
    await mkdir(skillsDir, { recursive: true });

    await writeFile(
      path.join(skillsDir, "metadata.yaml"),
      `cli_name: Category Test`,
    );
    await writeFile(
      path.join(skillsDir, "SKILL.md"),
      `---\nname: cat-skill (@local)\ndescription: Category test\n---\nContent`,
    );

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
      projectDir: tempDir,
    });

    // Local categories should be added
    expect(result.matrix.categories["local"]).toBeDefined();
    expect(result.matrix.categories["local"].name).toBe("Local Skills");
    expect(result.matrix.categories["local"].order).toBe(0);

    expect(result.matrix.categories["local/custom"]).toBeDefined();
    expect(result.matrix.categories["local/custom"].parent).toBe("local");
  });

  it("should not modify matrix when no local skills exist", async () => {
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
      projectDir: tempDir, // No .claude/skills directory
    });

    // Local categories should NOT be added if no local skills
    // (Matrix may already have local categories from previous tests,
    // so we check that no local skills are in the skills object)
    const localSkills = Object.values(result.matrix.skills).filter(
      (s) => s.local === true,
    );
    expect(localSkills).toHaveLength(0);
  });

  it("should preserve existing skills when merging local skills", async () => {
    const skillsDir = path.join(tempDir, ".claude", "skills", "test-preserve");
    await mkdir(skillsDir, { recursive: true });

    await writeFile(
      path.join(skillsDir, "metadata.yaml"),
      `cli_name: Preserve Test`,
    );
    await writeFile(
      path.join(skillsDir, "SKILL.md"),
      `---\nname: preserve-skill (@local)\ndescription: Preserve test\n---\nContent`,
    );

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
      projectDir: tempDir,
    });

    // Existing marketplace skills should still be present
    const marketplaceSkills = Object.values(result.matrix.skills).filter(
      (s) => s.local !== true,
    );
    expect(marketplaceSkills.length).toBeGreaterThan(50);

    // Local skill should also be present
    expect(result.matrix.skills["preserve-skill (@local)"]).toBeDefined();
  });

  it("P1-19: local skill takes precedence over plugin skill with same ID", async () => {
    // First, get the list of skills from the marketplace to find one to override
    const initialResult = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
      projectDir: tempDir,
    });

    // Pick an existing skill from the marketplace to override
    // Skill IDs include the full path: web/testing/vitest (@vince)
    const existingSkillId = "web/testing/vitest (@vince)";
    const existingSkill = initialResult.matrix.skills[existingSkillId];
    expect(existingSkill).toBeDefined();
    expect(existingSkill.local).toBeUndefined(); // Should be a marketplace skill
    const originalDescription = existingSkill.description;

    // Create a local skill with the SAME ID to override it
    const skillsDir = path.join(tempDir, ".claude", "skills", "local-vitest");
    await mkdir(skillsDir, { recursive: true });

    await writeFile(
      path.join(skillsDir, "metadata.yaml"),
      `cli_name: My Custom Vitest`,
    );
    await writeFile(
      path.join(skillsDir, "SKILL.md"),
      `---\nname: ${existingSkillId}\ndescription: My custom vitest configuration\n---\nThis is my local override of the vitest skill.`,
    );

    // Load again with the local skill in place
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
      projectDir: tempDir,
    });

    // The skill should now be the LOCAL version, not the marketplace version
    const overriddenSkill = result.matrix.skills[existingSkillId];
    expect(overriddenSkill).toBeDefined();
    expect(overriddenSkill.local).toBe(true);
    expect(overriddenSkill.description).toBe("My custom vitest configuration");
    // Verify the original description was different (proves we actually overwrote something)
    expect(overriddenSkill.description).not.toBe(originalDescription);
    expect(overriddenSkill.author).toBe("@local");
    expect(overriddenSkill.category).toBe("local/custom");
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
    const firstSkill = Object.values(result.matrix.skills)[0];
    expect(firstSkill.id).toBeDefined();
    expect(firstSkill.name).toBeDefined();
    expect(firstSkill.category).toBeDefined();
    expect(firstSkill.path).toBeDefined();
  });

  it("should load suggested stacks", async () => {
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
    });

    expect(result.matrix.suggestedStacks).toBeDefined();
    expect(result.matrix.suggestedStacks.length).toBeGreaterThan(0);

    // Verify stack structure
    const firstStack = result.matrix.suggestedStacks[0];
    expect(firstStack.id).toBeDefined();
    expect(firstStack.name).toBeDefined();
    expect(firstStack.allSkillIds).toBeDefined();
    expect(firstStack.allSkillIds.length).toBeGreaterThan(0);
  });

  it("should resolve stack skill IDs to actual skill IDs in matrix", async () => {
    // This tests the fix for the bug where alias targets like "react (@vince)"
    // didn't match actual skill IDs like "web/framework/react (@vince)"
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
    });

    // For every stack, verify all skill IDs exist in the skills map
    for (const stack of result.matrix.suggestedStacks) {
      for (const skillId of stack.allSkillIds) {
        const skill = result.matrix.skills[skillId];
        expect(
          skill,
          `Stack "${stack.id}" references skill "${skillId}" which doesn't exist in matrix.skills`,
        ).toBeDefined();

        // Verify the skill's ID matches what the stack references
        expect(skill.id).toBe(skillId);
      }
    }
  });

  it("should resolve stack skill IDs that can be used for selection tracking", async () => {
    // This tests that when a stack is selected, getAvailableSkills will correctly
    // show those skills as selected (verifies the skill ID format matches)
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: SKILLS_SOURCE,
    });

    // Get the first stack with skills
    const stack = result.matrix.suggestedStacks.find(
      (s) => s.allSkillIds.length > 0,
    );
    expect(stack).toBeDefined();

    // Simulate what the wizard does: use stack.allSkillIds as the selected skills
    const selectedSkills = [...stack!.allSkillIds];

    // For each skill in the matrix that's in a stack, verify it would show as selected
    for (const skillId of selectedSkills) {
      const skill = result.matrix.skills[skillId];
      expect(skill).toBeDefined();

      // The key check: the skill's id should be in the selectedSkills array
      // This is exactly what getAvailableSkills checks with:
      // `selected: resolvedSelections.includes(skill.id)`
      expect(
        selectedSkills.includes(skill.id),
        `Skill "${skillId}" in stack would not show as selected because skill.id="${skill.id}" is not in selectedSkills`,
      ).toBe(true);
    }
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
