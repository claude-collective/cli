import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { stringify as stringifyYaml } from "yaml";
import { writeSourceSkill } from "../helpers";

import { createTestSource, cleanupTestSource, type TestDirs } from "../fixtures/create-test-source";
import { installLocal } from "../../installation/local-installer";
import type { ProjectConfig } from "../../../types";
import {
  fileExists,
  directoryExists,
  readTestYaml,
  buildWizardResult,
  buildSourceResult,
  createMockMatrix,
  createTempDir,
  cleanupTempDir,
} from "../helpers";
import { loadStacks, loadStackById } from "../../stacks/stacks-loader";
import { extractAllSkills, mergeMatrixWithSkills } from "../../matrix";
import {
  CUSTOM_TEST_STACKS,
  PHILOSOPHY_TEST_STACKS,
  OVERRIDING_TEST_STACKS,
  MARKETPLACE_TEST_STACKS,
  MARKETPLACE_FULLSTACK_TEST_STACKS,
  PIPELINE_TEST_STACKS,
  MULTI_TEST_STACKS,
} from "../mock-data/mock-stacks.js";
import {
  TOOLING_AND_FRAMEWORK_CONFIG,
  CI_CD_CONFIG,
  FRAMEWORK_AND_STYLING_CONFIG,
  TOOLING_CONFIG,
  OBSERVABILITY_CONFIG,
  FRAMEWORK_AND_TESTING_CONFIG,
} from "../mock-data/mock-matrices.js";
import { CONSUMER_MATRIX_SKILLS } from "../mock-data/mock-skills.js";

function buildConsumerMatrix() {
  return createMockMatrix(CONSUMER_MATRIX_SKILLS);
}

describe("Integration: Consumer-Defined Stacks", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestSource({
      stacks: CUSTOM_TEST_STACKS,
    });
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  it("should load custom stacks from source config/stacks.yaml", async () => {
    const stacks = await loadStacks(dirs.sourceDir);

    expect(stacks.length).toBe(2);
    expect(stacks[0].id).toBe("custom-fullstack");
    expect(stacks[0].name).toBe("Custom Fullstack");
    expect(stacks[1].id).toBe("custom-testing");
  });

  it("should return empty array when source has no stacks.yaml", async () => {
    const noDirs = await createTestSource();

    try {
      const stacks = await loadStacks(noDirs.sourceDir);
      expect(stacks).toEqual([]);
    } finally {
      await cleanupTestSource(noDirs);
    }
  });

  it("should install with custom stack skills reflected in config.yaml", async () => {
    const sourceResult = buildSourceResult(buildConsumerMatrix(), dirs.sourceDir);

    const result = await installLocal({
      wizardResult: buildWizardResult(["web-framework-react", "api-framework-hono"]),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestYaml<ProjectConfig>(result.configPath);
    expect(config.skills).toContain("web-framework-react");
    expect(config.skills).toContain("api-framework-hono");
    expect(config.installMode).toBe("local");
  });

  it("should find a specific stack by ID using loadStackById", async () => {
    const stack = await loadStackById("custom-fullstack", dirs.sourceDir);

    expect(stack).not.toBeNull();
    expect(stack!.id).toBe("custom-fullstack");
    expect(stack!.name).toBe("Custom Fullstack");
    expect(stack!.description).toBe("A consumer-defined fullstack stack");
  });

  it("should return null from loadStackById for non-existent stack", async () => {
    const stack = await loadStackById("nonexistent-stack", dirs.sourceDir);

    expect(stack).toBeNull();
  });

  it("should normalize bare string skill assignments to SkillAssignment arrays", async () => {
    const stacks = await loadStacks(dirs.sourceDir);
    const fullstackStack = stacks[0];

    // Bare YAML strings like `framework: web-framework-react` are normalized
    // to SkillAssignment[] with preloaded: false
    const webDevConfig = fullstackStack.agents["web-developer"];
    expect(webDevConfig).toBeDefined();
    expect(webDevConfig!["web-framework"]).toEqual([
      { id: "web-framework-react", preloaded: false },
    ]);
  });

  it("should load stacks with philosophy field when provided", async () => {
    const philoDirs = await createTestSource({ stacks: PHILOSOPHY_TEST_STACKS });

    try {
      const stacks = await loadStacks(philoDirs.sourceDir);
      expect(stacks).toHaveLength(1);
      expect(stacks[0].philosophy).toBe("Modern fullstack with type safety");
    } finally {
      await cleanupTestSource(philoDirs);
    }
  });
});

describe("Integration: Stacks Precedence", () => {
  it("should load source stacks independently from CLI stacks", async () => {
    // Source with custom stacks
    const dirs = await createTestSource({ stacks: CUSTOM_TEST_STACKS });

    try {
      const sourceStacks = await loadStacks(dirs.sourceDir);
      expect(sourceStacks).toHaveLength(2);
      expect(sourceStacks.map((s) => s.id)).toContain("custom-fullstack");
      expect(sourceStacks.map((s) => s.id)).toContain("custom-testing");

      // Source stacks should NOT contain CLI built-in stacks (they're separate dirs)
      const hasCliBuiltins = sourceStacks.some((s) => s.id === "nextjs-fullstack");
      expect(hasCliBuiltins).toBe(false);
    } finally {
      await cleanupTestSource(dirs);
    }
  });

  it("should use source stacks when source has stacks.yaml (source overrides CLI)", async () => {
    // In loadAndMergeFromBasePath, if sourceStacks.length > 0, CLI stacks are NOT loaded.
    // This test verifies source stacks are self-contained.
    const dirs = await createTestSource({ stacks: CUSTOM_TEST_STACKS });

    try {
      const sourceStacks = await loadStacks(dirs.sourceDir);
      expect(sourceStacks.length).toBeGreaterThan(0);

      // Each stack should have the expected structure
      for (const stack of sourceStacks) {
        expect(stack.id).toBeDefined();
        expect(stack.name).toBeDefined();
        expect(stack.description).toBeDefined();
        expect(stack.agents).toBeDefined();
      }
    } finally {
      await cleanupTestSource(dirs);
    }
  });

  it("should allow a source to define a stack with an ID matching a CLI built-in", async () => {
    // A source can define a stack with the same ID as a CLI built-in.
    // Since loadAndMergeFromBasePath uses source stacks when available,
    // the source's version effectively takes precedence.
    const dirs = await createTestSource({ stacks: OVERRIDING_TEST_STACKS });

    try {
      const stacks = await loadStacks(dirs.sourceDir);
      expect(stacks).toHaveLength(1);
      expect(stacks[0].id).toBe("nextjs-fullstack");
      // The consumer's custom description, not the CLI built-in
      expect(stacks[0].name).toBe("Custom Next.js");
      expect(stacks[0].description).toBe("Consumer override of Next.js stack");
    } finally {
      await cleanupTestSource(dirs);
    }
  });
});

describe("Integration: Marketplace Source Stacks", () => {
  it("should load stacks from a marketplace-like source directory", async () => {
    // A marketplace source has its own config/stacks.yaml alongside skills
    const dirs = await createTestSource({ stacks: MARKETPLACE_TEST_STACKS });

    try {
      const stacks = await loadStacks(dirs.sourceDir);
      expect(stacks).toHaveLength(1);
      expect(stacks[0].id).toBe("marketplace-stack");
      expect(stacks[0].name).toBe("Marketplace Stack");

      // Verify the stack has the expected agent structure
      expect(Object.keys(stacks[0].agents)).toContain("web-developer");
      expect(Object.keys(stacks[0].agents)).toContain("api-developer");
    } finally {
      await cleanupTestSource(dirs);
    }
  });

  it("should load stacks alongside skills in the same source", async () => {
    const dirs = await createTestSource({ stacks: MARKETPLACE_FULLSTACK_TEST_STACKS });

    try {
      // Stacks load from source config/stacks.yaml
      const stacks = await loadStacks(dirs.sourceDir);
      expect(stacks).toHaveLength(1);

      // Skills are also available at the source skills dir (verify via file existence)
      const reactSkillPath = path.join(
        dirs.skillsDir,
        "web-framework",
        "web-framework-react",
        "SKILL.md",
      );
      expect(await fileExists(reactSkillPath)).toBe(true);

      // Categories and rules files also exist alongside stacks
      const categoriesPath = path.join(dirs.sourceDir, "config", "skill-categories.yaml");
      expect(await fileExists(categoriesPath)).toBe(true);
    } finally {
      await cleanupTestSource(dirs);
    }
  });
});

describe("Integration: Consumer-Defined Skills Matrix", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestSource({
      stacks: CUSTOM_TEST_STACKS,
    });
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  it("should use source skill-categories.yaml and skill-rules.yaml when present", async () => {
    const categoriesPath = path.join(dirs.sourceDir, "config", "skill-categories.yaml");
    const rulesPath = path.join(dirs.sourceDir, "config", "skill-rules.yaml");
    expect(await fileExists(categoriesPath)).toBe(true);
    expect(await fileExists(rulesPath)).toBe(true);

    // The disk categories file contains category definitions (not skill IDs — those
    // come from metadata scanning in src/skills/).
    const categoriesContent = await readFile(categoriesPath, "utf-8");
    expect(categoriesContent).toContain("framework");
    expect(categoriesContent).toContain("testing");
    expect(categoriesContent).toContain("version:");
  });

  it("should install all skills from source and compile agents", async () => {
    const sourceResult = buildSourceResult(buildConsumerMatrix(), dirs.sourceDir);

    const result = await installLocal({
      wizardResult: buildWizardResult(
        ["web-framework-react", "api-framework-hono", "web-testing-vitest"],
        { selectedAgents: ["web-developer", "api-developer"] },
      ),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    expect(result.copiedSkills).toHaveLength(3);
    expect(result.compiledAgents.length).toBeGreaterThan(0);
    expect(await directoryExists(result.skillsDir)).toBe(true);
    expect(await directoryExists(result.agentsDir)).toBe(true);
  });
});

describe("Integration: Custom Skills Matrix Loading", () => {
  it("should load custom categories and skills from a matrix config", async () => {
    const tempDir = await createTempDir("matrix-test-");

    try {
      const skillsDir = path.join(tempDir, "src", "skills");

      // Create a skill in the tooling category (use "infra" prefix — valid categoryPath prefix)
      await writeSourceSkill(skillsDir, path.join("infra", "tooling", "docker"), {
        id: "infra-tooling-docker",
        description: "Docker containerization patterns",
        category: "infra-tooling",
        tags: ["docker", "devops", "containers"],
      });

      // Extract skills from filesystem and merge with matrix config
      const skills = await extractAllSkills(skillsDir);
      const merged = await mergeMatrixWithSkills(
        TOOLING_AND_FRAMEWORK_CONFIG.categories,
        TOOLING_AND_FRAMEWORK_CONFIG.relationships,
        TOOLING_AND_FRAMEWORK_CONFIG.aliases,
        skills,
      );

      // Assert the custom "tooling" category is present
      expect(merged.categories).toBeDefined();
      expect(merged.categories["shared-tooling"]).toBeDefined();
      expect(merged.categories["shared-tooling"]!.displayName).toBe("Tooling");
      expect(merged.categories["shared-tooling"]!.exclusive).toBe(false);

      // Assert the custom skill is present
      expect(merged.skills["infra-tooling-docker"]).toBeDefined();
      expect(merged.skills["infra-tooling-docker"]!.description).toBe(
        "Docker containerization patterns",
      );
      expect(merged.skills["infra-tooling-docker"]!.tags).toContain("docker");
      expect(merged.skills["infra-tooling-docker"]!.category).toBe("infra-tooling");
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it("should respect exclusive flag from custom matrix categories", async () => {
    const tempDir = await createTempDir("exclusive-test-");

    try {
      const skillsDir = path.join(tempDir, "src", "skills");

      // Create skills in the exclusive category (use "infra" prefix — valid categoryPath prefix)
      for (const skillName of ["github-actions", "gitlab-ci"]) {
        const skillId = `infra-ci-cd-${skillName}`;
        await writeSourceSkill(skillsDir, path.join("infra", "ci-cd", skillName), {
          id: skillId,
          description: `${skillName} CI/CD pipeline`,
          category: "infra-ci-cd",
          tags: ["ci-cd", skillName],
        });
      }

      const skills = await extractAllSkills(skillsDir);
      const merged = await mergeMatrixWithSkills(
        CI_CD_CONFIG.categories,
        CI_CD_CONFIG.relationships,
        CI_CD_CONFIG.aliases,
        skills,
      );

      // Verify category exclusive flag
      expect(merged.categories["shared-ci-cd"]).toBeDefined();
      expect(merged.categories["shared-ci-cd"]!.exclusive).toBe(true);

      // Verify both skills are loaded
      expect(merged.skills["infra-ci-cd-github-actions"]).toBeDefined();
      expect(merged.skills["infra-ci-cd-gitlab-ci"]).toBeDefined();
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it("should respect discourages relationships from custom matrix", async () => {
    const tempDir = await createTempDir("discourages-test-");

    try {
      const skillsDir = path.join(tempDir, "src", "skills");

      // Create the skills referenced in relationships
      const skillDefs = [
        { name: "custom-a", id: "web-framework-custom-a", category: "web-framework" },
        { name: "custom-b", id: "web-styling-custom-b", category: "web-styling" },
        { name: "custom-c", id: "web-styling-custom-c", category: "web-styling" },
      ];

      for (const def of skillDefs) {
        const categoryPath = def.category.replace(/\//g, path.sep);
        await writeSourceSkill(skillsDir, path.join(categoryPath, def.name), {
          id: def.id,
          description: `${def.name} skill`,
          category: def.category,
        });
      }

      const skills = await extractAllSkills(skillsDir);
      const merged = await mergeMatrixWithSkills(
        FRAMEWORK_AND_STYLING_CONFIG.categories,
        FRAMEWORK_AND_STYLING_CONFIG.relationships,
        FRAMEWORK_AND_STYLING_CONFIG.aliases,
        skills,
      );

      // Verify discourages relationship is applied to both skills
      const skillA = merged.skills["web-framework-custom-a"];
      expect(skillA).toBeDefined();
      expect(skillA!.discourages).toHaveLength(1);
      expect(skillA!.discourages[0].skillId).toBe("web-styling-custom-b");
      expect(skillA!.discourages[0].reason).toBe(
        "These tools have conflicting design philosophies",
      );

      const skillB = merged.skills["web-styling-custom-b"];
      expect(skillB).toBeDefined();
      expect(skillB!.discourages).toHaveLength(1);
      expect(skillB!.discourages[0].skillId).toBe("web-framework-custom-a");

      // Verify recommends relationship
      expect(skillA!.recommends).toHaveLength(1);
      expect(skillA!.recommends[0].skillId).toBe("web-styling-custom-c");
      expect(skillA!.recommends[0].reason).toBe("These work great together");
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it("should preserve preloaded flag through stack loading", async () => {
    const tempDir = await createTempDir("preloaded-test-");

    try {
      const configDir = path.join(tempDir, "config");
      await mkdir(configDir, { recursive: true });

      // Create a stacks.yaml with preloaded: true on some skills
      const stacksContent = {
        stacks: [
          {
            id: "preloaded-test",
            name: "Preloaded Test Stack",
            description: "Stack with preloaded skills",
            agents: {
              "web-developer": {
                "web-framework": [{ id: "web-framework-react", preloaded: true }],
                "web-testing": "web-testing-vitest",
                "shared-methodology": [
                  { id: "meta-methodology-investigation-requirements", preloaded: true },
                  "meta-methodology-anti-over-engineering",
                ],
              },
            },
          },
        ],
      };

      await writeFile(path.join(configDir, "stacks.yaml"), stringifyYaml(stacksContent));

      const stacks = await loadStacks(tempDir);

      expect(stacks).toHaveLength(1);
      const stack = stacks[0];

      // Framework: preloaded: true (object form)
      const frameworkAssignments = stack.agents["web-developer"]!["web-framework"];
      expect(frameworkAssignments).toHaveLength(1);
      expect(frameworkAssignments![0].id).toBe("web-framework-react");
      expect(frameworkAssignments![0].preloaded).toBe(true);

      // Testing: bare string -> preloaded defaults to false
      const testingAssignments = stack.agents["web-developer"]!["web-testing"];
      expect(testingAssignments).toHaveLength(1);
      expect(testingAssignments![0].id).toBe("web-testing-vitest");
      expect(testingAssignments![0].preloaded).toBe(false);

      // Methodology: mixed array — first preloaded: true, second defaults to false
      const methodologyAssignments = stack.agents["web-developer"]!["shared-methodology"];
      expect(methodologyAssignments).toHaveLength(2);
      expect(methodologyAssignments![0].id).toBe("meta-methodology-investigation-requirements");
      expect(methodologyAssignments![0].preloaded).toBe(true);
      expect(methodologyAssignments![1].id).toBe("meta-methodology-anti-over-engineering");
      expect(methodologyAssignments![1].preloaded).toBe(false);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});

describe("Integration: Custom Matrix + Stacks Full Pipeline", () => {
  it("should install skills from a source with both custom matrix and stacks", async () => {
    const dirs = await createTestSource({ stacks: PIPELINE_TEST_STACKS });

    try {
      // 1. Verify stacks loaded from source
      const stacks = await loadStacks(dirs.sourceDir);
      expect(stacks).toHaveLength(1);
      expect(stacks[0].id).toBe("custom-pipeline");

      // 2. Verify skills exist at the source skills dir
      const reactSkillPath = path.join(
        dirs.skillsDir,
        "web-framework",
        "web-framework-react",
        "SKILL.md",
      );
      expect(await fileExists(reactSkillPath)).toBe(true);

      // 3. Verify categories/rules are loadable
      const categoriesPath = path.join(dirs.sourceDir, "config", "skill-categories.yaml");
      expect(await fileExists(categoriesPath)).toBe(true);

      // 4. Install with the custom stack skills
      const sourceResult = buildSourceResult(buildConsumerMatrix(), dirs.sourceDir);
      const result = await installLocal({
        wizardResult: buildWizardResult(
          ["web-framework-react", "web-testing-vitest", "api-framework-hono"],
          { selectedAgents: ["web-developer", "api-developer"] },
        ),
        sourceResult,
        projectDir: dirs.projectDir,
      });

      // 5. Verify installation results
      expect(result.copiedSkills).toHaveLength(3);
      expect(result.compiledAgents.length).toBeGreaterThan(0);

      // 6. Verify config.yaml contains all selected skills
      const config = await readTestYaml<ProjectConfig>(result.configPath);
      expect(config.skills).toContain("web-framework-react");
      expect(config.skills).toContain("web-testing-vitest");
      expect(config.skills).toContain("api-framework-hono");
    } finally {
      await cleanupTestSource(dirs);
    }
  });

  it("should load categories and rules from a custom source directory", async () => {
    const dirs = await createTestSource();

    try {
      // Verify the source's skill-categories.yaml can be loaded and parsed
      const categoriesPath = path.join(dirs.sourceDir, "config", "skill-categories.yaml");
      expect(await fileExists(categoriesPath)).toBe(true);

      const categoriesContent = await readFile(categoriesPath, "utf-8");

      // Verify the disk categories file contains category definitions and structure.
      // Skill IDs are not in the categories file — they come from metadata scanning
      // in the skills directory (src/skills/).
      expect(categoriesContent).toContain("framework");
      expect(categoriesContent).toContain("testing");
      expect(categoriesContent).toContain("version:");
      expect(categoriesContent).toContain("categories:");

      // Verify source also has skill directories
      const reactDir = path.join(dirs.skillsDir, "web-framework", "web-framework-react");
      expect(await directoryExists(reactDir)).toBe(true);
    } finally {
      await cleanupTestSource(dirs);
    }
  });

  it("should handle a source with multiple stacks referencing the same skills", async () => {
    const dirs = await createTestSource({ stacks: MULTI_TEST_STACKS });

    try {
      const stacks = await loadStacks(dirs.sourceDir);
      expect(stacks).toHaveLength(2);

      // Both stacks reference web-framework-react
      const stackAReactAssignment = stacks[0].agents["web-developer"]?.["web-framework"];
      const stackBReactAssignment = stacks[1].agents["web-developer"]?.["web-framework"];

      expect(stackAReactAssignment).toBeDefined();
      expect(stackBReactAssignment).toBeDefined();
      expect(stackAReactAssignment![0].id).toBe("web-framework-react");
      expect(stackBReactAssignment![0].id).toBe("web-framework-react");
    } finally {
      await cleanupTestSource(dirs);
    }
  });
});

describe("Integration: Custom Matrix Skill Metadata Survival", () => {
  it("should load skills with tags from custom source metadata", async () => {
    const tempDir = await createTempDir("tags-test-");

    try {
      const skillsDir = path.join(tempDir, "src", "skills");

      const customTags = ["monitoring", "observability", "apm", "custom-tag"];
      await writeSourceSkill(skillsDir, path.join("api", "observability", "datadog"), {
        id: "api-observability-datadog",
        description: "Datadog APM integration",
        category: "api-observability",
        tags: customTags,
      });

      const skills = await extractAllSkills(skillsDir);
      const merged = await mergeMatrixWithSkills(
        OBSERVABILITY_CONFIG.categories,
        OBSERVABILITY_CONFIG.relationships,
        OBSERVABILITY_CONFIG.aliases,
        skills,
      );

      const datadogSkill = merged.skills["api-observability-datadog"];
      expect(datadogSkill).toBeDefined();
      expect(datadogSkill!.tags).toEqual(customTags);
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  it("should handle requires relationship from custom matrix", async () => {
    const tempDir = await createTempDir("requires-test-");

    try {
      const skillsDir = path.join(tempDir, "src", "skills");

      // Create the skills (use valid categoryPath prefixes — "shared" is not valid)
      for (const def of [
        { name: "custom-react", id: "web-framework-custom-react", cat: "web-framework" },
        { name: "custom-rtl", id: "web-testing-custom-rtl", cat: "web-testing" },
      ]) {
        const catPath = def.cat.replace(/\//g, path.sep);
        await writeSourceSkill(skillsDir, path.join(catPath, def.name), {
          id: def.id,
          description: def.name,
          category: def.cat,
        });
      }

      const skills = await extractAllSkills(skillsDir);
      const merged = await mergeMatrixWithSkills(
        FRAMEWORK_AND_TESTING_CONFIG.categories,
        FRAMEWORK_AND_TESTING_CONFIG.relationships,
        FRAMEWORK_AND_TESTING_CONFIG.aliases,
        skills,
      );

      // Verify requires relationship is applied
      const rtlSkill = merged.skills["web-testing-custom-rtl"];
      expect(rtlSkill).toBeDefined();
      expect(rtlSkill!.requires).toHaveLength(1);
      expect(rtlSkill!.requires[0].skillIds).toContain("web-framework-custom-react");
      expect(rtlSkill!.requires[0].reason).toBe("RTL requires React to function");
    } finally {
      await cleanupTempDir(tempDir);
    }
  });
});
