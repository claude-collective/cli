import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { loadSkillsMatrixFromSource } from "./source-loader";
import { createTempDir, cleanupTempDir } from "../__tests__/helpers";
import { CLAUDE_DIR, STANDARD_DIRS, STANDARD_FILES } from "../../consts";
import {
  createTestSource,
  cleanupTestSource,
  type TestDirs,
  type TestStack,
} from "../__tests__/fixtures/create-test-source";
import { DEFAULT_TEST_SKILLS, EXTRA_DOMAIN_TEST_SKILLS } from "../__tests__/mock-data/mock-skills";
import type { CategoryDefinition, ResolvedSkill } from "../../types";
import { renderConfigTs, renderSkillMd } from "../__tests__/content-generators";

// ── Shared fixture ──────────────────────────────────────────────────────────────

const FIXTURE_SKILLS = [...DEFAULT_TEST_SKILLS, ...EXTRA_DOMAIN_TEST_SKILLS];

const FIXTURE_SKILL_COUNT = FIXTURE_SKILLS.length;

const FIXTURE_STACKS: TestStack[] = [
  {
    id: "fixture-test-stack",
    name: "Fixture Test Stack",
    description: "A stack for source-loader tests",
    agents: {
      "web-developer": {
        "web-framework": "web-framework-react",
      },
    },
  },
];

let fixtureDirs: TestDirs;

beforeAll(async () => {
  fixtureDirs = await createTestSource({
    skills: FIXTURE_SKILLS,
    stacks: FIXTURE_STACKS,
  });
});

afterAll(async () => {
  await cleanupTestSource(fixtureDirs);
});

// ── Tests ───────────────────────────────────────────────────────────────────────

describe("source-loader", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("cc-source-loader-test-");
    // Clear environment
    delete process.env.CC_SOURCE;
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
    delete process.env.CC_SOURCE;
  });

  describe("loadSkillsMatrixFromSource", () => {
    describe("dev mode detection", () => {
      it("should use local mode when devMode flag is explicitly set", async () => {
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: fixtureDirs.sourceDir,
          projectDir: tempDir,
          devMode: true,
        });

        // Should load from local source in dev mode
        expect(result.isLocal).toBe(true);
        expect(result.matrix).toBeDefined();
        expect(result.matrix.skills).toBeDefined();
      });

      it("should use source flag when provided", async () => {
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: fixtureDirs.sourceDir,
          projectDir: tempDir,
        });

        expect(result.isLocal).toBe(true);
        expect(result.sourceConfig.source).toBe(fixtureDirs.sourceDir);
        expect(result.sourceConfig.sourceOrigin).toBe("flag");
      });
    });

    describe("local source loading", () => {
      it("should load matrix from local source", async () => {
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: fixtureDirs.sourceDir,
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
          sourceFlag: fixtureDirs.sourceDir,
          projectDir: tempDir,
        });

        expect(result.sourcePath).toBe(fixtureDirs.sourceDir);
      });

      it("should mark result as local", async () => {
        const result = await loadSkillsMatrixFromSource({
          sourceFlag: fixtureDirs.sourceDir,
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
    tempDir = await createTempDir("cc-local-skills-test-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("should merge local skills into matrix when .claude/skills exists", async () => {
    // Create a local skill in the temp project
    const skillsDir = path.join(tempDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, "test-my-skill");
    await mkdir(skillsDir, { recursive: true });

    await writeFile(
      path.join(skillsDir, STANDARD_FILES.METADATA_YAML),
      `displayName: My Local Skill\nslug: my-local-skill\ncliDescription: A local skill\ndomain: web\ncategory: dummy-category\ncustom: true`,
    );
    await writeFile(
      path.join(skillsDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("my-local-skill", "A local skill", "Content"),
    );

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: fixtureDirs.sourceDir,
      projectDir: tempDir,
    });

    // Local skill should be in the matrix with normalized ID
    // Boundary cast: skills keys are branded SkillId, widened to string for test indexing
    const skills = result.matrix.skills as Record<string, ResolvedSkill>;
    expect(skills["my-local-skill"]).toBeDefined();
    const localSkill = skills["my-local-skill"];

    expect(localSkill.id).toBe("my-local-skill");
    expect(localSkill.category).toBe("dummy-category");
    expect(localSkill.author).toBe("@dummy-author");
    expect(localSkill.local).toBe(true);
    expect(localSkill.localPath).toBe(".claude/skills/test-my-skill/");
  });

  it("should not inject fake local category definitions into the matrix", async () => {
    const skillsDir = path.join(tempDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, "test-cat-skill");
    await mkdir(skillsDir, { recursive: true });

    await writeFile(
      path.join(skillsDir, STANDARD_FILES.METADATA_YAML),
      `displayName: Category Test\nslug: cat-skill\ndomain: web\ncategory: dummy-category\ncustom: true`,
    );
    await writeFile(
      path.join(skillsDir, STANDARD_FILES.SKILL_MD),
      `---\nname: cat-skill (@local)\ndescription: Category test\n---\nContent`,
    );

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: fixtureDirs.sourceDir,
      projectDir: tempDir,
    });

    // Local skills should NOT cause fake "local" or "local/custom" categories to be injected
    // The skill uses whatever category it declared (or "local" default from local-skill-loader)
    // Boundary cast: categories keys are branded Category, widened to string for test indexing
    expect(
      (result.matrix.categories as Record<string, CategoryDefinition>)["local/custom"],
    ).toBeUndefined();
  });

  it("should not modify matrix when no local skills exist", async () => {
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: fixtureDirs.sourceDir,
      projectDir: tempDir, // No .claude/skills directory
    });

    // Local categories should NOT be added if no local skills
    // (Matrix may already have local categories from previous tests,
    // so we check that no local skills are in the skills object)
    const localSkills = Object.values(result.matrix.skills).filter((s) => s!.local === true);
    expect(localSkills).toHaveLength(0);
  });

  it("should preserve remote skill category when local skill overwrites with category 'local'", async () => {
    // Use a known fixture skill with a domain-mapped category
    const targetSkillId = "web-framework-react";
    const expectedCategory = "web-framework";

    // Create a local skill with the SAME ID but a different category in metadata
    // (source-loader preserves the remote skill's category when overwriting)
    const skillsDir = path.join(
      tempDir,
      CLAUDE_DIR,
      STANDARD_DIRS.SKILLS,
      "test-override-category",
    );
    await mkdir(skillsDir, { recursive: true });

    await writeFile(
      path.join(skillsDir, STANDARD_FILES.METADATA_YAML),
      `displayName: Override Test\nslug: override-test\ndomain: web\ncategory: web-styling`,
    );
    await writeFile(
      path.join(skillsDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd(targetSkillId, "Local override", "Content"),
    );

    // Load with the local skill override
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: fixtureDirs.sourceDir,
      projectDir: tempDir,
    });

    // Boundary cast: branded SkillId key widened to string for test indexing
    const overriddenSkill = (result.matrix.skills as Record<string, ResolvedSkill>)[targetSkillId];
    expect(overriddenSkill).toBeDefined();
    expect(overriddenSkill.local).toBe(true);

    // The category should be preserved from the remote skill
    expect(overriddenSkill.category).toBe(expectedCategory);
  });

  it("should preserve existing skills when merging local skills", async () => {
    const skillsDir = path.join(tempDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, "test-preserve");
    await mkdir(skillsDir, { recursive: true });

    await writeFile(
      path.join(skillsDir, STANDARD_FILES.METADATA_YAML),
      `displayName: Preserve Test\nslug: preserve-test\ndomain: web\ncategory: dummy-category\ncustom: true`,
    );
    await writeFile(
      path.join(skillsDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("preserve-skill", "Preserve test", "Content"),
    );

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: fixtureDirs.sourceDir,
      projectDir: tempDir,
    });

    // Existing marketplace skills should still be present
    const marketplaceSkills = Object.values(result.matrix.skills).filter((s) => s!.local !== true);
    expect(marketplaceSkills.length).toBe(FIXTURE_SKILL_COUNT);

    // Local skill should also be present with normalized ID
    // Boundary cast: branded SkillId key widened to string for test indexing
    expect((result.matrix.skills as Record<string, ResolvedSkill>)["preserve-skill"]).toBeDefined();
  });

  it("P1-19: local skill takes precedence over plugin skill with same ID", async () => {
    // Create a source directory with a marketplace skill
    const sourceDir = path.join(tempDir, "precedence-source");
    const skillDir = path.join(
      sourceDir,
      "src",
      STANDARD_DIRS.SKILLS,
      "web",
      "testing",
      "web-testing-vitest",
    );
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd(
        "web-testing-vitest",
        "Marketplace vitest configuration",
        "Marketplace vitest skill content.",
      ),
    );
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      'category: web-testing\nauthor: "@test"\ndisplayName: Vitest\ncliDescription: Marketplace vitest configuration\ncontentHash: abc1234\ndomain: web\nslug: vitest\n',
    );

    // Load skills from source to verify marketplace skill is present
    const initialResult = await loadSkillsMatrixFromSource({
      sourceFlag: sourceDir,
      projectDir: tempDir,
    });

    const existingSkillId = "web-testing-vitest";
    const existingSkill = initialResult.matrix.skills[existingSkillId]!;
    expect(existingSkill).toBeDefined();
    expect(existingSkill.local).toBeUndefined(); // Should be a marketplace skill
    expect(existingSkill.description).toBe("Marketplace vitest configuration");

    // Create a local skill with the SAME ID to override it
    const localSkillsDir = path.join(tempDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, "local-vitest");
    await mkdir(localSkillsDir, { recursive: true });

    await writeFile(
      path.join(localSkillsDir, STANDARD_FILES.METADATA_YAML),
      `displayName: My Custom Vitest\nslug: vitest\ndomain: web\ncategory: web-testing`,
    );
    await writeFile(
      path.join(localSkillsDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd(
        "web-testing-vitest",
        "My custom vitest configuration",
        "This is my local override of the vitest skill.",
      ),
    );

    // Load again with the local skill in place
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: sourceDir,
      projectDir: tempDir,
    });

    // The skill should now be the LOCAL version, not the marketplace version
    const overriddenSkill = result.matrix.skills[existingSkillId]!;
    expect(overriddenSkill).toBeDefined();
    expect(overriddenSkill.local).toBe(true);
    expect(overriddenSkill.description).toBe("My custom vitest configuration");
    // Verify the original description was different (proves we actually overwrote something)
    expect(overriddenSkill.description).not.toBe(existingSkill.description);
    expect(overriddenSkill.author).toBe("@dummy-author");
    // When overwriting a remote skill, the remote skill's category is inherited
    expect(overriddenSkill.category).toBe(existingSkill.category);
    expect(overriddenSkill.localPath).toBe(".claude/skills/local-vitest/");
  });
});

describe("source-loader config-driven paths", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("cc-config-paths-test-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("should use custom skillsDir from source config", async () => {
    const sourceDir = path.join(tempDir, "custom-source");

    // Create source config with custom skillsDir
    const configDir = path.join(sourceDir, ".claude-src");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, STANDARD_FILES.CONFIG_TS),
      'export default { skillsDir: "lib/skills" };',
    );

    // Create skills in the custom directory
    const skillsDir = path.join(
      sourceDir,
      "lib",
      STANDARD_DIRS.SKILLS,
      "web",
      "framework",
      "react",
    );
    await mkdir(skillsDir, { recursive: true });
    await writeFile(
      path.join(skillsDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "React skill content"),
    );
    await writeFile(
      path.join(skillsDir, STANDARD_FILES.METADATA_YAML),
      'category: web-framework\nauthor: "@test"\ndisplayName: React\ncliDescription: React framework\nusageGuidance: Use React for building UIs\ncontentHash: abc1234\ndomain: web\nslug: react\n',
    );

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: sourceDir,
      projectDir: tempDir,
    });

    // Skill should be loaded from custom path
    expect(result.matrix.skills["web-framework-react"]).toBeDefined();
  });

  it("should use custom categoriesFile path from source config", async () => {
    const sourceDir = path.join(tempDir, "custom-categories-source");

    // Create source config with custom categoriesFile pointing to a non-existent path
    const configDir = path.join(sourceDir, ".claude-src");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, STANDARD_FILES.CONFIG_TS),
      'export default { categoriesFile: "data/categories.yaml" };',
    );

    // Do NOT create categories at data/categories.yaml — loader should fall back to CLI categories
    await mkdir(path.join(sourceDir, "src", STANDARD_DIRS.SKILLS), { recursive: true });

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: sourceDir,
      projectDir: tempDir,
    });

    // Falls back to CLI categories since custom path doesn't exist
    expect(result.matrix).toBeDefined();
    expect(result.matrix.categories).toBeDefined();
    expect(Object.keys(result.matrix.categories).length).toBeGreaterThan(0);
  });

  it("should use custom rulesFile path from source config", async () => {
    const sourceDir = path.join(tempDir, "custom-rules-source");

    // Create source config with custom rulesFile pointing to a non-existent path
    const configDir = path.join(sourceDir, ".claude-src");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, STANDARD_FILES.CONFIG_TS),
      'export default { rulesFile: "data/rules.yaml" };',
    );

    await mkdir(path.join(sourceDir, "src", STANDARD_DIRS.SKILLS), { recursive: true });

    const result = await loadSkillsMatrixFromSource({
      sourceFlag: sourceDir,
      projectDir: tempDir,
    });

    // Falls back to CLI rules since custom path doesn't exist
    expect(result.matrix).toBeDefined();
  });

  it("should use custom stacksFile from source config", async () => {
    const sourceDir = path.join(tempDir, "custom-stacks-source");

    // Create source config with custom stacksFile
    const configDir = path.join(sourceDir, ".claude-src");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, STANDARD_FILES.CONFIG_TS),
      'export default { stacksFile: "data/stacks.ts" };',
    );

    // Create stacks at the custom path
    const dataDir = path.join(sourceDir, "data");
    await mkdir(dataDir, { recursive: true });
    await writeFile(
      path.join(dataDir, "stacks.ts"),
      renderConfigTs({
        stacks: [
          {
            id: "custom-path-stack",
            name: "Custom Path Stack",
            description: "Stack from custom path",
            agents: { "web-developer": { "web-framework": "web-framework-react" } },
          },
        ],
      }),
    );

    // Create empty skills dir
    await mkdir(path.join(sourceDir, "src", STANDARD_DIRS.SKILLS), { recursive: true });

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

    // No .claude-src/config.ts — just create conventional paths
    await mkdir(path.join(sourceDir, "src", STANDARD_DIRS.SKILLS), { recursive: true });

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
    await writeFile(
      path.join(configDir, STANDARD_FILES.CONFIG_TS),
      'export default { source: "github:myorg/skills" };',
    );

    await mkdir(path.join(sourceDir, "src", STANDARD_DIRS.SKILLS), { recursive: true });

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
    tempDir = await createTempDir("cc-integration-test-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("should load all skills from local source", async () => {
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: fixtureDirs.sourceDir,
    });

    // Verify all fixture skills are present (built-in matrix may add more)
    const loadedSkillIds = Object.keys(result.matrix.skills);
    expect(loadedSkillIds.length).toBeGreaterThanOrEqual(FIXTURE_SKILL_COUNT);
    for (const skill of FIXTURE_SKILLS) {
      expect(loadedSkillIds).toContain(skill.id);
    }

    // Verify skills have required properties
    const firstSkill = Object.values(result.matrix.skills)[0]!;
    expect(firstSkill.id).toBeDefined();
    expect(firstSkill.category).toBeDefined();
    expect(firstSkill.path).toBeDefined();
  });

  it("should load suggested stacks", async () => {
    const result = await loadSkillsMatrixFromSource({
      sourceFlag: fixtureDirs.sourceDir,
    });

    // Stacks loaded from source
    expect(result.matrix.suggestedStacks).toBeDefined();
    expect(result.matrix.suggestedStacks.length).toBeGreaterThan(0);

    // Verify stack structure
    const firstStack = result.matrix.suggestedStacks[0];
    expect(firstStack.id).toBeDefined();
    expect(firstStack.name).toBeDefined();
    expect(firstStack.allSkillIds).toBeDefined();
  });

  it("should load stacks from source when source has config/stacks.ts", async () => {
    // Create a source directory with its own stacks.ts
    const sourceDir = path.join(tempDir, "custom-source");
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    // Write a minimal custom stacks.ts with a unique stack ID
    await writeFile(
      path.join(configDir, "stacks.ts"),
      renderConfigTs({
        stacks: [
          {
            id: "custom-test-stack",
            name: "Custom Test Stack",
            description: "A test stack from the source",
            agents: { "web-developer": { "web-framework": "web-framework-react" } },
          },
        ],
      }),
    );

    // Create an empty src/skills dir so extractAllSkills doesn't fail
    await mkdir(path.join(sourceDir, "src", STANDARD_DIRS.SKILLS), { recursive: true });

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

  it("should fall back to CLI stacks when source has no config/stacks.ts", async () => {
    // Create a source directory without stacks.ts
    const sourceDir = path.join(tempDir, "no-stacks-source");
    await mkdir(path.join(sourceDir, "src", STANDARD_DIRS.SKILLS), { recursive: true });

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
      sourceFlag: fixtureDirs.sourceDir,
    });

    expect(result.matrix.categories).toBeDefined();
    const categoryCount = Object.keys(result.matrix.categories).length;
    // Categories come from the CLI's built-in matrix (all defined categories)
    expect(categoryCount).toBeGreaterThan(10);
  });
});
