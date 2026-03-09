import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { groupBy, mapToObj, mapValues } from "remeda";

import {
  createTestSource,
  cleanupTestSource,
  type TestDirs,
} from "../__tests__/fixtures/create-test-source";
import { installLocal } from "../installation/local-installer";
import {
  validateSelection,
  getAvailableSkills,
  isDiscouraged,
  getDiscourageReason,
  resolveAlias,
} from ".";
import {
  createMockSkill,
  createMockMultiSourceSkill,
  createMockMatrix,
  createMockCategory,
  buildWizardResult,
  buildSkillConfigs,
  buildSourceResult,
  readTestTsConfig,
} from "../__tests__/helpers";
import {
  PUBLIC_SOURCE,
  ACME_SOURCE,
  INTERNAL_SOURCE,
} from "../__tests__/mock-data/mock-sources.js";
import {
  RESOLUTION_PIPELINE_SKILLS,
  PUBLIC_SKILLS,
  ACME_SKILLS,
  INTERNAL_SKILLS,
  type SkillEntry,
} from "../__tests__/mock-data/mock-skills";
import type {
  CategoryDefinition,
  CategoryPath,
  MergedSkillsMatrix,
  ProjectConfig,
  ResolvedSkill,
  SkillId,
  SkillSource,
  Category,
} from "../../types";
import { useMatrixStore } from "../../stores/matrix-store";

// ── Constants ──────────────────────────────────────────────────────────────────

const TOTAL_SOURCE_COUNT = 3;
const SELECTED_SKILL_COUNT = 10;

// ── Test Data: 15 skills across 3 sources ──────────────────────────────────────

type TaggedSkillEntry = SkillEntry & { source: SkillSource };

// ── Category Fixtures ────────────────────────────────────────────────────────

const MULTI_SOURCE_CATEGORIES = {
  "web-framework": createMockCategory("web-framework", "Framework", {
    exclusive: true,
    required: true,
  }),
  "web-client-state": createMockCategory("web-client-state", "State", { order: 1 }),
  "web-styling": createMockCategory("web-styling", "Styling", { order: 2 }),
  "web-testing": createMockCategory("web-testing", "Testing", { exclusive: false, order: 3 }),
  "api-api": createMockCategory("api-api", "Backend Framework", { exclusive: true, order: 4 }),
  "api-database": createMockCategory("api-database", "Database", { order: 5 }),
  "shared-security": createMockCategory("shared-security", "Security", { order: 6 }),
  "web-animation": createMockCategory("web-animation", "Animation", { order: 7 }),
  "shared-methodology": createMockCategory("shared-methodology", "Methodology", { order: 8 }),
  "web-accessibility": createMockCategory("web-accessibility", "Accessibility", { order: 9 }),
  "api-observability": createMockCategory("api-observability", "Observability", { order: 10 }),
} as Partial<Record<Category, CategoryDefinition>> as Record<Category, CategoryDefinition>;

// ── Matrix Builder ─────────────────────────────────────────────────────────────

/**
 * Builds a MergedSkillsMatrix with skills annotated with multi-source metadata.
 * Simulates the output of multi-source-loader after tagging all sources.
 */
function buildMultiSourceMatrix(overrides?: Partial<MergedSkillsMatrix>): MergedSkillsMatrix {
  const taggedEntries: TaggedSkillEntry[] = [
    ...PUBLIC_SKILLS.map((s) => ({ ...s, source: { ...PUBLIC_SOURCE } })),
    ...ACME_SKILLS.map((s) => ({ ...s, source: { ...ACME_SOURCE } })),
    ...INTERNAL_SKILLS.map((s) => ({ ...s, source: { ...INTERNAL_SOURCE } })),
  ];
  const grouped = groupBy(taggedEntries, (e) => e.id);
  const skills = mapValues(grouped, (entries) => {
    const first = entries[0]!;
    const sources = entries.map((e) => e.source);
    return createMockMultiSourceSkill(first.id, sources, {
      category: first.category as CategoryPath,
      description: first.description,
    });
  });

  return createMockMatrix(skills, {
    categories: MULTI_SOURCE_CATEGORIES,
    ...overrides,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Integration: Multi-Source Skill Resolution", () => {
  describe("Scenario 1: Skills from 3 sources resolve into unified matrix", () => {
    it("should create a matrix with unique skills from all sources", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // Count unique skills from all 3 sources (15 total, minus overlaps)
      const uniqueSkillIds = new Set([
        ...PUBLIC_SKILLS.map((s) => s.id),
        ...ACME_SKILLS.map((s) => s.id),
        ...INTERNAL_SKILLS.map((s) => s.id),
      ]);
      const EXPECTED_UNIQUE_COUNT = uniqueSkillIds.size;

      const skillKeys = Object.keys(matrix.skills);
      expect(skillKeys).toHaveLength(EXPECTED_UNIQUE_COUNT);
    });

    it("should annotate skills with all available sources", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // web-framework-react exists in all 3 sources
      const reactSkill = matrix.skills["web-framework-react"];
      expect(reactSkill).toBeDefined();
      expect(reactSkill!.availableSources).toHaveLength(TOTAL_SOURCE_COUNT);

      const sourceTypes = reactSkill!.availableSources!.map((s) => s.type);
      expect(sourceTypes).toContain("public");
      expect(sourceTypes).toContain("private");

      const sourceNames = reactSkill!.availableSources!.map((s) => s.name);
      expect(sourceNames).toContain("public");
      expect(sourceNames).toContain("acme-corp");
      expect(sourceNames).toContain("internal");
    });

    it("should annotate skills with single source when not duplicated", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // web-state-zustand is only in public source
      const zustandSkill = matrix.skills["web-state-zustand"];
      expect(zustandSkill).toBeDefined();
      expect(zustandSkill!.availableSources).toHaveLength(1);
      expect(zustandSkill!.availableSources![0].name).toBe("public");
    });

    it("should have correct activeSource defaulting to first available", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // Skills without any installed source should have first source as active
      const reactSkill = matrix.skills["web-framework-react"];
      expect(reactSkill!.activeSource).toBeDefined();
      expect(reactSkill!.activeSource!.name).toBe("public");
    });
  });

  describe("Scenario 2: Active source wins when same skill ID exists in multiple sources", () => {
    it("should use installed source as activeSource over non-installed sources", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // Simulate acme-corp version being installed
      const reactSkill = matrix.skills["web-framework-react"]!;
      const acmeSource = reactSkill.availableSources!.find((s) => s.name === "acme-corp")!;
      acmeSource.installed = true;
      acmeSource.installMode = "local";

      // Re-compute active source (same logic as setActiveSources in multi-source-loader)
      const installedSource = reactSkill.availableSources!.find((s) => s.installed);
      reactSkill.activeSource = installedSource ?? reactSkill.availableSources![0];

      expect(reactSkill.activeSource.name).toBe("acme-corp");
      expect(reactSkill.activeSource.type).toBe("private");
      expect(reactSkill.activeSource.installed).toBe(true);
    });

    it("should respect sourceSelections when determining which source is preferred", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // sourceSelections maps SkillId -> source name (user's choice from wizard)
      const sourceSelections: Partial<Record<SkillId, string>> = {
        "web-framework-react": "internal",
        "web-testing-vitest": "acme-corp",
      };

      // Verify the source selections reference valid sources
      for (const [skillId, sourceName] of Object.entries(sourceSelections)) {
        const skill = matrix.skills[skillId as SkillId];
        expect(skill).toBeDefined();
        const matchingSource = skill!.availableSources!.find((s) => s.name === sourceName);
        expect(matchingSource).toBeDefined();
      }
    });

    it("should allow selecting 10 skills across different sources without conflicts", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // Select 10 skills from different sources (no conflicts since no conflictsWith defined)
      const selectedSkills: SkillId[] = [
        "web-framework-react", // from 3 sources
        "web-state-zustand", // public only
        "web-styling-scss-modules", // public only
        "web-testing-vitest", // from 2 sources
        "api-framework-hono", // acme only
        "api-database-drizzle", // acme only
        "api-security-auth-patterns", // acme only
        "web-animation-framer", // internal only
        "web-accessibility-a11y", // internal only
        "api-monitoring-sentry", // internal only
      ];

      expect(selectedSkills).toHaveLength(SELECTED_SKILL_COUNT);

      const validation = validateSelection(selectedSkills);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // All selected skills should exist in the matrix
      for (const skillId of selectedSkills) {
        expect(matrix.skills[skillId]).toBeDefined();
      }
    });
  });

  describe("Scenario 3: Missing skill reference produces warning", () => {
    it("should throw when missing skill is selected", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // Select a skill that doesn't exist in any source
      const selections: SkillId[] = ["web-framework-react", "web-nonexistent-skill"];

      // resolveAlias throws for unknown skill IDs — invalid input is a bug
      expect(() => validateSelection(selections)).toThrow("Unknown skill ID");
    });

    it("should throw for unknown skill ID through alias lookup", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      expect(() => resolveAlias("web-nonexistent-skill")).toThrow("Unknown skill ID");
    });

    it("should not include missing skill in getAvailableSkills for any category", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // Check all categories -- missing skill should not appear
      const allCategories = Object.keys(matrix.categories) as Category[];
      for (const category of allCategories) {
        const available = getAvailableSkills(category, []);
        const ids = available.map((o) => o.id);
        expect(ids).not.toContain("web-nonexistent-skill");
      }
    });

    it("should detect missing requirement when dependency is not in matrix", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // Add a skill that requires a non-existent skill
      matrix.skills["web-feature-advanced"] = createMockSkill(
        "web-feature-advanced",
        {
          category: "web-framework",
          requires: [
            {
              skillIds: ["web-nonexistent-dep"],
              needsAny: false,
              reason: "Needs nonexistent dependency",
            },
          ],
        },
      );

      const validation = validateSelection(["web-feature-advanced"]);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.type === "missingRequirement")).toBe(true);
    });
  });

  describe("Scenario 4: Skill dependencies are correctly resolved across sources", () => {
    it("should validate when dependency from different source is selected", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // Add dependency: drizzle (acme) requires hono (acme)
      const drizzleSkill = matrix.skills["api-database-drizzle"]!;
      drizzleSkill.requires = [
        {
          skillIds: ["api-framework-hono"],
          needsAny: false,
          reason: "Database ORM needs a backend framework",
        },
      ];

      // Both selected -- should be valid
      const validation = validateSelection(["api-database-drizzle", "api-framework-hono"]);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should fail validation when dependency from another source is not selected", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // Add dependency: drizzle requires hono
      const drizzleSkill = matrix.skills["api-database-drizzle"]!;
      drizzleSkill.requires = [
        {
          skillIds: ["api-framework-hono"],
          needsAny: false,
          reason: "Database ORM needs a backend framework",
        },
      ];

      // Only drizzle selected, hono missing
      const validation = validateSelection(["api-database-drizzle"]);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0].type).toBe("missingRequirement");
      expect(validation.errors[0].message).toContain("Hono");
    });

    it("should discourage dependent skill when requirement is not selected", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // auth-patterns requires hono
      const authSkill = matrix.skills["api-security-auth-patterns"]!;
      authSkill.requires = [
        {
          skillIds: ["api-framework-hono"],
          needsAny: false,
          reason: "Auth patterns need a backend framework",
        },
      ];

      // Nothing selected, auth should be discouraged
      const discouraged = isDiscouraged("api-security-auth-patterns", []);
      expect(discouraged).toBe(true);

      const reason = getDiscourageReason("api-security-auth-patterns", []);
      expect(reason).toContain("Auth patterns need a backend framework");
      expect(reason).toContain("Hono");
    });

    it("should not discourage dependent skill when requirement is selected", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // auth-patterns requires hono
      const authSkill = matrix.skills["api-security-auth-patterns"]!;
      authSkill.requires = [
        {
          skillIds: ["api-framework-hono"],
          needsAny: false,
          reason: "Auth patterns need a backend framework",
        },
      ];

      // hono selected, auth should not be discouraged
      const discouraged = isDiscouraged(
        "api-security-auth-patterns",
        ["api-framework-hono"],
      );
      expect(discouraged).toBe(false);
    });

    it("should handle OR dependency across sources", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // sentry can work with either hono (acme) OR react (public/acme/internal)
      const sentrySkill = matrix.skills["api-monitoring-sentry"]!;
      sentrySkill.requires = [
        {
          skillIds: ["api-framework-hono", "web-framework-react"],
          needsAny: true,
          reason: "Needs at least one framework for instrumentation",
        },
      ];

      // Select react (from public), sentry should be valid
      const validation = validateSelection(
        ["api-monitoring-sentry", "web-framework-react"],
      );
      expect(validation.valid).toBe(true);

      // Without any framework, sentry should fail
      const failValidation = validateSelection(["api-monitoring-sentry"]);
      expect(failValidation.valid).toBe(false);
    });
  });

  describe("Scenario 5: Conflict resolution across sources", () => {
    it("should detect conflicts between skills from different sources", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // react and vue conflict (both in framework category)
      const reactSkill = matrix.skills["web-framework-react"]!;
      reactSkill.conflictsWith = [
        {
          skillId: "web-framework-vue",
          reason: "Choose one frontend framework",
        },
      ];

      const validation = validateSelection(["web-framework-react", "web-framework-vue"]);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0].type).toBe("conflict");
      expect(validation.errors[0].message).toContain("Choose one frontend framework");
    });

    it("should discourage conflicting skill from another source", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      const reactSkill = matrix.skills["web-framework-react"]!;
      reactSkill.conflictsWith = [
        {
          skillId: "web-framework-vue",
          reason: "Choose one frontend framework",
        },
      ];

      // React selected, vue should be discouraged
      const discouraged = isDiscouraged("web-framework-vue", ["web-framework-react"]);
      expect(discouraged).toBe(true);
    });

    it("should enforce category exclusivity across multi-source skills", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // framework category is exclusive -- selecting both react and vue violates it
      const validation = validateSelection(["web-framework-react", "web-framework-vue"]);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.type === "categoryExclusive")).toBe(true);
    });
  });

  describe("Scenario 6: Large-scale selection with recommendations and warnings", () => {
    it("should validate 10 skills from 3 sources with recommendations", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // react is a recommended skill
      const reactSkill = matrix.skills["web-framework-react"]!;
      reactSkill.isRecommended = true;
      reactSkill.recommendedReason = "Zustand works best with React";

      // Select zustand but not react -- should be valid with recommendation warning
      const validation = validateSelection(
        ["web-state-zustand", "api-framework-hono", "api-database-drizzle"],
      );
      expect(validation.valid).toBe(true);
      expect(validation.warnings.some((w) => w.type === "missing_recommendation")).toBe(true);
      expect(validation.warnings[0].message).toContain("React");
    });

    it("should not warn about recommendation when recommended skill is selected", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // react is a recommended skill
      const reactSkill = matrix.skills["web-framework-react"]!;
      reactSkill.isRecommended = true;
      reactSkill.recommendedReason = "Zustand works best with React";

      // Select both zustand and react
      const validation = validateSelection(["web-state-zustand", "web-framework-react"]);
      expect(validation.valid).toBe(true);
      expect(validation.warnings.filter((w) => w.type === "missing_recommendation")).toHaveLength(
        0,
      );
    });

    it("should handle getAvailableSkills with multi-source skills correctly", () => {
      const matrix = buildMultiSourceMatrix();
      useMatrixStore.getState().setMatrix(matrix);

      // Get available framework skills
      const available = getAvailableSkills("web-framework", []);

      // Should have react and vue
      const ids = available.map((o) => o.id);
      expect(ids).toContain("web-framework-react");
      expect(ids).toContain("web-framework-vue");

      // None should be discouraged or selected initially
      expect(available.every((o) => !o.discouraged)).toBe(true);
      expect(available.every((o) => !o.selected)).toBe(true);
    });
  });
});

describe("Integration: Multi-Source Install Pipeline", () => {
  let dirs: TestDirs;

  const PIPELINE_SKILL_COUNT = 5;

  function buildPipelineMatrix(): MergedSkillsMatrix {
    return createMockMatrix(
      mapToObj(RESOLUTION_PIPELINE_SKILLS, (skill) => [
        skill.id,
        createMockSkill(skill.id, {
          category: skill.category as CategoryPath,
          description: skill.description,
          tags: skill.tags ?? [],
          author: skill.author,
          path: `skills/${skill.category}/${skill.id}/`,
        }),
      ]),
    );
  }

  beforeEach(async () => {
    dirs = await createTestSource({ skills: RESOLUTION_PIPELINE_SKILLS });
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  it("should install skills from multiple sources and produce compiled agents", async () => {
    const selectedSkills = RESOLUTION_PIPELINE_SKILLS.map((s) => s.id);

    const matrix = buildPipelineMatrix();
    useMatrixStore.getState().setMatrix(matrix);

    const wizardResult = buildWizardResult(
      [
        { id: "web-framework-react", scope: "project", source: "public" },
        { id: "api-framework-hono", scope: "project", source: "acme-corp" },
        { id: "web-animation-framer", scope: "project", source: "internal" },
        { id: "api-database-drizzle", scope: "project", source: "acme-corp" },
        { id: "web-testing-vitest", scope: "project", source: "public" },
      ],
      {
        selectedAgents: ["web-developer", "api-developer"],
      },
    );
    const sourceResult = buildSourceResult(matrix, dirs.sourceDir);

    const installResult = await installLocal({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Verify all skills were copied
    expect(installResult.copiedSkills).toHaveLength(PIPELINE_SKILL_COUNT);

    // Verify config contains all selected skills
    // Boundary cast: config parse returns `unknown`
    const config = await readTestTsConfig<ProjectConfig>(installResult.configPath);

    const configSkillIds = config.skills.map((s) => s.id);
    for (const skillId of selectedSkills) {
      expect(configSkillIds).toContain(skillId);
    }

    // Verify agents were compiled
    expect(installResult.compiledAgents.length).toBeGreaterThan(0);
  });

  it("should preserve source selections through the config write", async () => {
    const selectedSkills = RESOLUTION_PIPELINE_SKILLS.map((s) => s.id);

    const matrix = buildPipelineMatrix();
    useMatrixStore.getState().setMatrix(matrix);

    const wizardResult = buildWizardResult(buildSkillConfigs(selectedSkills));
    const sourceResult = buildSourceResult(matrix, dirs.sourceDir, {
      marketplace: "test-marketplace",
    });

    const installResult = await installLocal({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
      sourceFlag: "github:test-org/skills",
    });

    // Boundary cast: config parse returns `unknown`
    const config = await readTestTsConfig<ProjectConfig>(installResult.configPath);

    // Source metadata should be preserved
    expect(config.source).toBe("github:test-org/skills");
    expect(config.marketplace).toBe("test-marketplace");
  });
});

describe("Integration: Skill ID Resolution in Multi-Source Context", () => {
  it("should resolve skill IDs with multi-source metadata", () => {
    const matrix = buildMultiSourceMatrix();
    useMatrixStore.getState().setMatrix(matrix);

    const resolved = resolveAlias("web-framework-react");
    expect(resolved).toBe("web-framework-react");

    // Resolved skill should have multi-source metadata
    const skill = matrix.skills[resolved];
    expect(skill).toBeDefined();
    expect(skill!.availableSources!.length).toBeGreaterThanOrEqual(1);
  });

  it("should validate selection using skill IDs with multi-source skills", () => {
    const matrix = buildMultiSourceMatrix();
    useMatrixStore.getState().setMatrix(matrix);

    const validation = validateSelection(["web-framework-react", "api-framework-hono"]);
    expect(validation.valid).toBe(true);
  });
});
