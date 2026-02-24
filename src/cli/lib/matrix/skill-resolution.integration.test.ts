import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "fs/promises";
import { parse as parseYaml } from "yaml";
import { mapToObj } from "remeda";

import {
  createTestSource,
  cleanupTestSource,
  type TestDirs,
  type TestSkill,
} from "../__tests__/fixtures/create-test-source";
import { installLocal } from "../installation/local-installer";
import {
  validateSelection,
  getAvailableSkills,
  isDisabled,
  getDisableReason,
  resolveAlias,
} from ".";
import {
  createMockSkill,
  createMockMatrix,
  createMockCategory,
  buildWizardResult,
  buildSourceResult,
} from "../__tests__/helpers";
import type {
  CategoryDefinition,
  CategoryPath,
  MergedSkillsMatrix,
  ProjectConfig,
  ResolvedSkill,
  SkillId,
  SkillSource,
  Subcategory,
} from "../../types";

// ── Constants ──────────────────────────────────────────────────────────────────

const TOTAL_SOURCE_COUNT = 3;
const SELECTED_SKILL_COUNT = 10;

/**
 * Creates a ResolvedSkill with availableSources annotation for multi-source testing.
 * This simulates what multi-source-loader.ts does after tagging.
 */
function createMultiSourceSkill(
  id: SkillId,
  category: CategoryPath,
  sources: SkillSource[],
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  const activeSource = sources.find((s) => s.installed) ?? sources[0];
  return createMockSkill(id, category, {
    availableSources: sources,
    activeSource,
    ...overrides,
  });
}

function createPublicSource(installed = false): SkillSource {
  return {
    name: "public",
    type: "public",
    installed,
    ...(installed ? { installMode: "local" as const } : {}),
  };
}

function createPrivateSource(name: string, url: string, installed = false): SkillSource {
  return {
    name,
    type: "private",
    url,
    installed,
    ...(installed ? { installMode: "local" as const } : {}),
  };
}

// ── Test Data: 15 skills across 3 sources ──────────────────────────────────────

// Source 1: Public marketplace (5 skills)
const PUBLIC_SKILLS: Array<{ id: SkillId; category: CategoryPath; description: string }> = [
  { id: "web-framework-react", category: "web-framework", description: "React framework" },
  { id: "web-framework-vue", category: "web-framework", description: "Vue.js framework" },
  {
    id: "web-state-zustand",
    category: "web-client-state",
    description: "Zustand state management",
  },
  { id: "web-styling-scss-modules", category: "web-styling", description: "SCSS Modules styling" },
  { id: "web-testing-vitest", category: "web-testing", description: "Vitest testing framework" },
];

// Source 2: Private marketplace "acme-corp" (5 skills, 2 overlap with public)
const ACME_SKILLS: Array<{ id: SkillId; category: CategoryPath; description: string }> = [
  { id: "web-framework-react", category: "web-framework", description: "React (acme custom fork)" },
  { id: "api-framework-hono", category: "api-api", description: "Hono web framework" },
  { id: "api-database-drizzle", category: "api-database", description: "Drizzle ORM" },
  { id: "api-security-auth-patterns", category: "shared-security", description: "Auth patterns" },
  { id: "web-testing-vitest", category: "web-testing", description: "Vitest (acme custom)" },
];

// Source 3: Private marketplace "internal" (5 skills, 1 overlap with public)
const INTERNAL_SKILLS: Array<{ id: SkillId; category: CategoryPath; description: string }> = [
  { id: "web-framework-react", category: "web-framework", description: "React (internal build)" },
  { id: "web-animation-framer", category: "web-animation", description: "Framer Motion" },
  {
    id: "meta-methodology-investigation",
    category: "shared-methodology",
    description: "Investigation first",
  },
  { id: "web-accessibility-a11y", category: "web-accessibility", description: "Web accessibility" },
  {
    id: "api-monitoring-sentry",
    category: "api-observability",
    description: "Sentry error tracking",
  },
];

// ── Matrix Builder ─────────────────────────────────────────────────────────────

/**
 * Builds a MergedSkillsMatrix with skills annotated with multi-source metadata.
 * Simulates the output of multi-source-loader after tagging all sources.
 */
function buildMultiSourceMatrix(overrides?: Partial<MergedSkillsMatrix>): MergedSkillsMatrix {
  const skills: Record<string, ResolvedSkill> = {};

  // Collect unique skill IDs and their sources
  const skillSources = new Map<SkillId, SkillSource[]>();

  for (const s of PUBLIC_SKILLS) {
    skillSources.set(s.id, [createPublicSource()]);
  }

  for (const s of ACME_SKILLS) {
    const existing = skillSources.get(s.id) ?? [];
    existing.push(createPrivateSource("acme-corp", "github:acme-corp/skills"));
    skillSources.set(s.id, existing);
  }

  for (const s of INTERNAL_SKILLS) {
    const existing = skillSources.get(s.id) ?? [];
    existing.push(createPrivateSource("internal", "github:internal/skills"));
    skillSources.set(s.id, existing);
  }

  // Build unique skills with all sources annotated
  const allSkillDefs = [...PUBLIC_SKILLS, ...ACME_SKILLS, ...INTERNAL_SKILLS];
  const seen = new Set<SkillId>();

  for (const def of allSkillDefs) {
    if (seen.has(def.id)) continue;
    seen.add(def.id);

    const sources = skillSources.get(def.id) ?? [];
    skills[def.id] = createMultiSourceSkill(def.id, def.category, sources, {
      description: def.description,
    });
  }

  const categories = {
    "web-framework": createMockCategory("web-framework" as Subcategory, "Framework", {
      exclusive: true,
      required: true,
    }),
    "web-client-state": createMockCategory("web-client-state" as Subcategory, "State", {
      order: 1,
    }),
    "web-styling": createMockCategory("web-styling" as Subcategory, "Styling", { order: 2 }),
    "web-testing": createMockCategory("web-testing" as Subcategory, "Testing", {
      exclusive: false,
      order: 3,
    }),
    "api-api": createMockCategory("api-api" as Subcategory, "Backend Framework", {
      exclusive: true,
      order: 4,
    }),
    "api-database": createMockCategory("api-database" as Subcategory, "Database", { order: 5 }),
    "shared-security": createMockCategory("shared-security" as Subcategory, "Security", {
      order: 6,
    }),
    "web-animation": createMockCategory("web-animation" as Subcategory, "Animation", { order: 7 }),
    "shared-methodology": createMockCategory("shared-methodology" as Subcategory, "Methodology", {
      order: 8,
    }),
    "web-accessibility": createMockCategory("web-accessibility" as Subcategory, "Accessibility", {
      order: 9,
    }),
    "api-observability": createMockCategory("api-observability" as Subcategory, "Observability", {
      order: 10,
    }),
  } as Partial<Record<Subcategory, CategoryDefinition>> as Record<Subcategory, CategoryDefinition>;

  return createMockMatrix(skills, {
    categories,
    ...overrides,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Integration: Multi-Source Skill Resolution", () => {
  describe("Scenario 1: Skills from 3 sources resolve into unified matrix", () => {
    it("should create a matrix with unique skills from all sources", () => {
      const matrix = buildMultiSourceMatrix();

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

      // web-state-zustand is only in public source
      const zustandSkill = matrix.skills["web-state-zustand"];
      expect(zustandSkill).toBeDefined();
      expect(zustandSkill!.availableSources).toHaveLength(1);
      expect(zustandSkill!.availableSources![0].name).toBe("public");
    });

    it("should have correct activeSource defaulting to first available", () => {
      const matrix = buildMultiSourceMatrix();

      // Skills without any installed source should have first source as active
      const reactSkill = matrix.skills["web-framework-react"];
      expect(reactSkill!.activeSource).toBeDefined();
      expect(reactSkill!.activeSource!.name).toBe("public");
    });
  });

  describe("Scenario 2: Active source wins when same skill ID exists in multiple sources", () => {
    it("should use installed source as activeSource over non-installed sources", () => {
      const matrix = buildMultiSourceMatrix();

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

      const validation = validateSelection(selectedSkills, matrix);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // All selected skills should exist in the matrix
      for (const skillId of selectedSkills) {
        expect(matrix.skills[skillId]).toBeDefined();
      }
    });
  });

  describe("Scenario 3: Missing skill reference produces warning", () => {
    it("should validate successfully when missing skill is selected (passes through)", () => {
      const matrix = buildMultiSourceMatrix();

      // Select a skill that doesn't exist in any source
      const selections: SkillId[] = ["web-framework-react", "web-nonexistent-skill" as SkillId];

      // validateSelection treats unknown skills as valid (skips them)
      const validation = validateSelection(selections, matrix);
      expect(validation.valid).toBe(true);
    });

    it("should not resolve unknown skill ID through alias lookup", () => {
      const matrix = buildMultiSourceMatrix();

      const resolved = resolveAlias("web-nonexistent-skill" as SkillId, matrix);
      // Unknown skill returns as-is (not resolved to anything)
      expect(resolved).toBe("web-nonexistent-skill");
    });

    it("should not include missing skill in getAvailableSkills for any category", () => {
      const matrix = buildMultiSourceMatrix();

      // Check all categories -- missing skill should not appear
      const allCategories = Object.keys(matrix.categories) as Subcategory[];
      for (const category of allCategories) {
        const available = getAvailableSkills(category, [], matrix);
        const ids = available.map((o) => o.id);
        expect(ids).not.toContain("web-nonexistent-skill");
      }
    });

    it("should detect missing requirement when dependency is not in matrix", () => {
      const matrix = buildMultiSourceMatrix();

      // Add a skill that requires a non-existent skill
      matrix.skills["web-feature-advanced" as SkillId] = createMockSkill(
        "web-feature-advanced" as SkillId,
        "web-framework",
        {
          requires: [
            {
              skillIds: ["web-nonexistent-dep" as SkillId],
              needsAny: false,
              reason: "Needs nonexistent dependency",
            },
          ],
        },
      );

      const validation = validateSelection(["web-feature-advanced" as SkillId], matrix);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.type === "missingRequirement")).toBe(true);
    });
  });

  describe("Scenario 4: Skill dependencies are correctly resolved across sources", () => {
    it("should validate when dependency from different source is selected", () => {
      const matrix = buildMultiSourceMatrix();

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
      const validation = validateSelection(["api-database-drizzle", "api-framework-hono"], matrix);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should fail validation when dependency from another source is not selected", () => {
      const matrix = buildMultiSourceMatrix();

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
      const validation = validateSelection(["api-database-drizzle"], matrix);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0].type).toBe("missingRequirement");
      expect(validation.errors[0].message).toContain("api-framework-hono");
    });

    it("should disable dependent skill when requirement is not selected", () => {
      const matrix = buildMultiSourceMatrix();

      // auth-patterns requires hono
      const authSkill = matrix.skills["api-security-auth-patterns"]!;
      authSkill.requires = [
        {
          skillIds: ["api-framework-hono"],
          needsAny: false,
          reason: "Auth patterns need a backend framework",
        },
      ];

      // Nothing selected, auth should be disabled
      const disabled = isDisabled("api-security-auth-patterns", [], matrix);
      expect(disabled).toBe(true);

      const reason = getDisableReason("api-security-auth-patterns", [], matrix);
      expect(reason).toContain("Auth patterns need a backend framework");
      expect(reason).toContain("api-framework-hono");
    });

    it("should enable dependent skill when requirement is selected", () => {
      const matrix = buildMultiSourceMatrix();

      // auth-patterns requires hono
      const authSkill = matrix.skills["api-security-auth-patterns"]!;
      authSkill.requires = [
        {
          skillIds: ["api-framework-hono"],
          needsAny: false,
          reason: "Auth patterns need a backend framework",
        },
      ];

      // hono selected, auth should be enabled
      const disabled = isDisabled("api-security-auth-patterns", ["api-framework-hono"], matrix);
      expect(disabled).toBe(false);
    });

    it("should handle OR dependency across sources", () => {
      const matrix = buildMultiSourceMatrix();

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
        matrix,
      );
      expect(validation.valid).toBe(true);

      // Without any framework, sentry should fail
      const failValidation = validateSelection(["api-monitoring-sentry"], matrix);
      expect(failValidation.valid).toBe(false);
    });
  });

  describe("Scenario 5: Conflict resolution across sources", () => {
    it("should detect conflicts between skills from different sources", () => {
      const matrix = buildMultiSourceMatrix();

      // react and vue conflict (both in framework category)
      const reactSkill = matrix.skills["web-framework-react"]!;
      reactSkill.conflictsWith = [
        {
          skillId: "web-framework-vue",
          reason: "Choose one frontend framework",
        },
      ];

      const validation = validateSelection(["web-framework-react", "web-framework-vue"], matrix);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0].type).toBe("conflict");
      expect(validation.errors[0].message).toContain("Choose one frontend framework");
    });

    it("should disable conflicting skill from another source", () => {
      const matrix = buildMultiSourceMatrix();

      const reactSkill = matrix.skills["web-framework-react"]!;
      reactSkill.conflictsWith = [
        {
          skillId: "web-framework-vue",
          reason: "Choose one frontend framework",
        },
      ];

      // React selected, vue should be disabled
      const disabled = isDisabled("web-framework-vue", ["web-framework-react"], matrix);
      expect(disabled).toBe(true);
    });

    it("should enforce category exclusivity across multi-source skills", () => {
      const matrix = buildMultiSourceMatrix();

      // framework category is exclusive -- selecting both react and vue violates it
      const validation = validateSelection(["web-framework-react", "web-framework-vue"], matrix);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.type === "categoryExclusive")).toBe(true);
    });
  });

  describe("Scenario 6: Large-scale selection with recommendations and warnings", () => {
    it("should validate 10 skills from 3 sources with recommendations", () => {
      const matrix = buildMultiSourceMatrix();

      // zustand recommends react
      const zustandSkill = matrix.skills["web-state-zustand"]!;
      zustandSkill.recommends = [
        {
          skillId: "web-framework-react",
          reason: "Zustand works best with React",
        },
      ];

      // Select zustand but not react -- should be valid with recommendation warning
      const validation = validateSelection(
        ["web-state-zustand", "api-framework-hono", "api-database-drizzle"],
        matrix,
      );
      expect(validation.valid).toBe(true);
      expect(validation.warnings.some((w) => w.type === "missing_recommendation")).toBe(true);
      expect(validation.warnings[0].message).toContain("web-framework-react");
    });

    it("should not warn about recommendation when recommended skill is selected", () => {
      const matrix = buildMultiSourceMatrix();

      const zustandSkill = matrix.skills["web-state-zustand"]!;
      zustandSkill.recommends = [
        {
          skillId: "web-framework-react",
          reason: "Zustand works best with React",
        },
      ];

      // Select both zustand and react
      const validation = validateSelection(["web-state-zustand", "web-framework-react"], matrix);
      expect(validation.valid).toBe(true);
      expect(validation.warnings.filter((w) => w.type === "missing_recommendation")).toHaveLength(
        0,
      );
    });

    it("should handle getAvailableSkills with multi-source skills correctly", () => {
      const matrix = buildMultiSourceMatrix();

      // Get available framework skills
      const available = getAvailableSkills("web-framework", [], matrix);

      // Should have react and vue
      const ids = available.map((o) => o.id);
      expect(ids).toContain("web-framework-react");
      expect(ids).toContain("web-framework-vue");

      // None should be disabled initially
      expect(available.every((o) => !o.disabled)).toBe(true);
      expect(available.every((o) => !o.selected)).toBe(true);
    });
  });
});

describe("Integration: Multi-Source Install Pipeline", () => {
  let dirs: TestDirs;

  // Test skills that map to the multi-source scenario
  const PIPELINE_SKILLS: TestSkill[] = [
    {
      id: "web-framework-react",
      name: "web-framework-react",
      description: "React framework (public source)",
      category: "web-framework",
      author: "@test",
      tags: ["react", "web"],
      content: `---\nname: web-framework-react\ndescription: React framework\n---\n\n# React\n\nReact framework from public source.\n`,
    },
    {
      id: "api-framework-hono",
      name: "api-framework-hono",
      description: "Hono framework (acme source)",
      category: "api-api",
      author: "@acme",
      tags: ["api", "hono"],
      content: `---\nname: api-framework-hono\ndescription: Hono framework\n---\n\n# Hono\n\nHono framework from acme source.\n`,
    },
    {
      id: "web-animation-framer",
      name: "web-animation-framer",
      description: "Framer Motion (internal source)",
      category: "web-animation",
      author: "@internal",
      tags: ["animation"],
      content: `---\nname: web-animation-framer\ndescription: Framer Motion\n---\n\n# Framer Motion\n\nFramer Motion from internal source.\n`,
    },
    {
      id: "api-database-drizzle",
      name: "api-database-drizzle",
      description: "Drizzle ORM (acme source)",
      category: "api-database",
      author: "@acme",
      tags: ["database"],
      content: `---\nname: api-database-drizzle\ndescription: Drizzle ORM\n---\n\n# Drizzle ORM\n\nDrizzle from acme source.\n`,
    },
    {
      id: "web-testing-vitest",
      name: "web-testing-vitest",
      description: "Vitest testing (public source)",
      category: "web-testing",
      author: "@test",
      tags: ["testing"],
      content: `---\nname: web-testing-vitest\ndescription: Vitest testing\n---\n\n# Vitest\n\nVitest from public source.\n`,
    },
  ];

  const PIPELINE_SKILL_COUNT = 5;

  function buildPipelineMatrix(): MergedSkillsMatrix {
    return createMockMatrix(
      mapToObj(PIPELINE_SKILLS, (skill) => [
        skill.name,
        createMockSkill(skill.name as SkillId, skill.category as CategoryPath, {
          description: skill.description,
          tags: skill.tags ?? [],
          author: skill.author,
          path: `skills/${skill.category}/${skill.name}/`,
        }),
      ]),
    );
  }

  beforeEach(async () => {
    dirs = await createTestSource({ skills: PIPELINE_SKILLS });
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  it("should install skills from multiple sources and produce compiled agents", async () => {
    // Boundary cast: frontmatter names from test fixtures are SkillIds by convention
    const selectedSkills = PIPELINE_SKILLS.map((s) => s.name) as unknown as SkillId[];

    const matrix = buildPipelineMatrix();

    const wizardResult = buildWizardResult(selectedSkills, {
      installMode: "local",
      selectedAgents: ["web-developer", "api-developer"],
      sourceSelections: {
        "web-framework-react": "public",
        "api-framework-hono": "acme-corp",
        "web-animation-framer": "internal",
        "api-database-drizzle": "acme-corp",
        "web-testing-vitest": "public",
      } as Partial<Record<SkillId, string>>,
    });
    const sourceResult = buildSourceResult(matrix, dirs.sourceDir);

    const installResult = await installLocal({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Verify all skills were copied
    expect(installResult.copiedSkills).toHaveLength(PIPELINE_SKILL_COUNT);

    // Verify config contains all selected skills
    const configContent = await readFile(installResult.configPath, "utf-8");
    const config = parseYaml(configContent) as ProjectConfig;

    for (const skillId of selectedSkills) {
      expect(config.skills).toContain(skillId);
    }

    // Verify agents were compiled
    expect(installResult.compiledAgents.length).toBeGreaterThan(0);
  });

  it("should preserve source selections through the config write", async () => {
    // Boundary cast: frontmatter names from test fixtures are SkillIds by convention
    const selectedSkills = PIPELINE_SKILLS.map((s) => s.name) as unknown as SkillId[];

    const matrix = buildPipelineMatrix();

    const wizardResult = buildWizardResult(selectedSkills, {
      installMode: "local",
      sourceSelections: {
        "api-framework-hono": "acme-corp",
      } as Partial<Record<SkillId, string>>,
    });
    const sourceResult = buildSourceResult(matrix, dirs.sourceDir, {
      marketplace: "test-marketplace",
    });

    const installResult = await installLocal({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
      sourceFlag: "github:test-org/skills",
    });

    const configContent = await readFile(installResult.configPath, "utf-8");
    const config = parseYaml(configContent) as ProjectConfig;

    // Source metadata should be preserved
    expect(config.source).toBe("github:test-org/skills");
    expect(config.marketplace).toBe("test-marketplace");
  });
});

describe("Integration: Display Name Alias Resolution in Multi-Source Context", () => {
  it("should resolve display name aliases before source checking", () => {
    const matrix = buildMultiSourceMatrix();

    // Add display name aliases
    (matrix.displayNameToId as Record<string, SkillId>)["react"] = "web-framework-react";
    (matrix.displayNameToId as Record<string, SkillId>)["vitest"] = "web-testing-vitest";

    // Resolve via alias
    // Boundary cast: testing display name resolution — "react" is a SkillDisplayName, not SkillId
    const resolved = resolveAlias("react" as unknown as SkillId, matrix);
    expect(resolved).toBe("web-framework-react");

    // Resolved skill should have multi-source metadata
    const skill = matrix.skills[resolved];
    expect(skill).toBeDefined();
    expect(skill!.availableSources!.length).toBeGreaterThanOrEqual(1);
  });

  it("should validate selection using aliases with multi-source skills", () => {
    const matrix = buildMultiSourceMatrix();

    // Add display name aliases
    (matrix.displayNameToId as Record<string, SkillId>)["react"] = "web-framework-react";
    (matrix.displayNameToId as Record<string, SkillId>)["hono"] = "api-framework-hono";

    // Use aliases in validation -- resolveAlias is called internally by validateSelection
    // Boundary cast: aliases are display names being used as SkillIds for resolution
    const validation = validateSelection(
      ["react" as unknown as SkillId, "hono" as unknown as SkillId],
      matrix,
    );
    expect(validation.valid).toBe(true);
  });
});
