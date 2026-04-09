import { typedEntries } from "../../../utils/typed-object";
import type {
  Category,
  CategoryDefinition,
  MergedSkillsMatrix,
  RelationshipDefinitions,
  ResolvedSkill,
  ResolvedStack,
  SkillId,
  SkillSlug,
  SkillSlugMap,
} from "../../../types";
import { SKILLS, TEST_CATEGORIES } from "../test-fixtures";
import { createMockResolvedStack } from "./stack-factories.js";

export function createMockMatrix(
  skillsOrFirstSkill?: Record<string, ResolvedSkill> | ResolvedSkill,
  ...rest: (ResolvedSkill | Partial<MergedSkillsMatrix>)[]
): MergedSkillsMatrix {
  let skillsRecord: Record<string, ResolvedSkill>;
  let overrides: Partial<MergedSkillsMatrix> | undefined;

  if (skillsOrFirstSkill === undefined) {
    // Empty call: createMockMatrix()
    skillsRecord = {};
  } else if (
    "id" in skillsOrFirstSkill &&
    typeof (skillsOrFirstSkill as ResolvedSkill).id === "string" &&
    "slug" in skillsOrFirstSkill
  ) {
    // New spread syntax: createMockMatrix(skill1, skill2, ..., optionalOverrides?)
    const allArgs = [skillsOrFirstSkill, ...rest];
    const lastArg = allArgs[allArgs.length - 1];

    // Detect if last arg is overrides (has no 'id' + 'slug' properties)
    if (lastArg && !("id" in lastArg && "slug" in lastArg)) {
      overrides = lastArg as Partial<MergedSkillsMatrix>;
      const skills = allArgs.slice(0, -1) as ResolvedSkill[];
      skillsRecord = {};
      for (const skill of skills) {
        skillsRecord[skill.id] = skill;
      }
    } else {
      const skills = allArgs as ResolvedSkill[];
      skillsRecord = {};
      for (const skill of skills) {
        skillsRecord[skill.id] = skill;
      }
    }
  } else {
    // Old record syntax: createMockMatrix({ "id": skill }, overrides?)
    skillsRecord = skillsOrFirstSkill as Record<string, ResolvedSkill>;
    overrides = rest[0] as Partial<MergedSkillsMatrix> | undefined;
  }

  // Boundary cast: empty objects are populated in the loop below
  const autoSlugToId = {} as Record<SkillSlug, SkillId>;
  const autoIdToSlug = {} as Record<SkillId, SkillSlug>;
  for (const [, skill] of typedEntries(skillsRecord)) {
    if (skill.slug) {
      autoSlugToId[skill.slug] = skill.id;
      autoIdToSlug[skill.id] = skill.slug;
    }
  }

  return {
    version: "1.0.0",
    categories: {} as Record<Category, CategoryDefinition>,
    skills: skillsRecord,
    suggestedStacks: [],
    slugMap: { slugToId: autoSlugToId, idToSlug: autoIdToSlug },
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Builds a comprehensive test matrix with 8 skills across 7 categories,
 * 2 suggested stacks, display name mappings, and relationship data
 * (conflicts, recommends). Includes anti-over-engineering methodology skill.
 * @returns A fully populated MergedSkillsMatrix with realistic test data
 */
export function createComprehensiveMatrix(
  overrides?: Partial<MergedSkillsMatrix>,
): MergedSkillsMatrix {
  // Skill categories use domain-prefixed Category IDs (matching production
  // metadata.yaml and the categories map keys, e.g., "web-framework", "api-api").
  const skills = {
    "web-framework-react": SKILLS.react,
    "web-framework-vue-composition-api": {
      ...SKILLS.vue,
      conflictsWith: [{ skillId: "web-framework-react", reason: "Choose one framework" }],
    } satisfies ResolvedSkill,
    "web-state-zustand": SKILLS.zustand,
    "web-styling-scss-modules": SKILLS.scss,
    "api-framework-hono": SKILLS.hono,
    "api-database-drizzle": SKILLS.drizzle,
    "web-testing-vitest": SKILLS.vitest,
    // Methodology skill
    "meta-reviewing-reviewing": SKILLS.antiOverEng,
  };

  const categories = {
    "web-framework": {
      ...TEST_CATEGORIES.framework,
      domain: "web",
      exclusive: true,
      required: true,
    },
    "web-client-state": { ...TEST_CATEGORIES.clientState, domain: "web", order: 1 },
    "web-styling": { ...TEST_CATEGORIES.styling, domain: "web", order: 2 },
    "api-api": { ...TEST_CATEGORIES.api, domain: "api", exclusive: true, required: true },
    "api-database": { ...TEST_CATEGORIES.database, domain: "api", order: 1 },
    "web-testing": {
      ...TEST_CATEGORIES.testing,
      domain: "shared",
      exclusive: false,
      order: 10,
    },
    "meta-reviewing": {
      ...TEST_CATEGORIES.methodology,
      domain: "meta",
      exclusive: false,
      required: false,
      order: 11,
    },
  } as Record<Category, CategoryDefinition>;

  const suggestedStacks: ResolvedStack[] = [
    createMockResolvedStack("nextjs-fullstack", "Next.js Full-Stack", {
      description: "Complete Next.js stack with React and Hono",
      skills: {
        "web-developer": {
          "web-framework": ["web-framework-react"],
          "web-client-state": ["web-state-zustand"],
          "web-styling": ["web-styling-scss-modules"],
        },
        "api-developer": {
          "api-api": ["api-framework-hono"],
          "api-database": ["api-database-drizzle"],
        },
      } as ResolvedStack["skills"],
      allSkillIds: [
        "web-framework-react",
        "web-state-zustand",
        "web-styling-scss-modules",
        "api-framework-hono",
        "api-database-drizzle",
      ],
      philosophy: "Modern, type-safe fullstack development",
    }),
    createMockResolvedStack("vue-modern-fullstack", "Vue Modern Full-Stack", {
      description: "Vue.js frontend stack",
      skills: {
        "web-developer": {
          "web-framework": ["web-framework-vue-composition-api"],
        },
      } as ResolvedStack["skills"],
      allSkillIds: ["web-framework-vue-composition-api"],
      philosophy: "Progressive framework approach",
    }),
  ];

  // Boundary cast: test matrix only contains a subset of all possible slugs
  const slugToId = {
    react: "web-framework-react",
    "vue-composition-api": "web-framework-vue-composition-api",
    zustand: "web-state-zustand",
    "scss-modules": "web-styling-scss-modules",
    hono: "api-framework-hono",
    drizzle: "api-database-drizzle",
    vitest: "web-testing-vitest",
    reviewing: "meta-reviewing-reviewing",
  } as unknown as Record<SkillSlug, SkillId>;

  // Boundary cast: Object.fromEntries returns { [k: string]: string }
  const idToSlug = Object.fromEntries(
    typedEntries(slugToId).map(([slug, fullId]) => [fullId, slug]),
  ) as SkillSlugMap["idToSlug"];

  return createMockMatrix(skills, {
    categories,
    suggestedStacks,
    slugMap: { slugToId, idToSlug },
    ...overrides,
  });
}

/**
 * Builds a lightweight test matrix with 5 skills, 5 categories, and 2 stacks.
 * Use instead of createComprehensiveMatrix when relationship data is not needed.
 * @returns A minimal MergedSkillsMatrix for basic integration tests
 */
export function createBasicMatrix(overrides?: Partial<MergedSkillsMatrix>): MergedSkillsMatrix {
  // Domain-prefixed Category IDs — see createComprehensiveMatrix comment
  const skills = {
    "web-framework-react": SKILLS.react,
    "web-state-zustand": SKILLS.zustand,
    "api-framework-hono": SKILLS.hono,
    "web-testing-vitest": SKILLS.vitest,
    // Methodology skill
    "meta-reviewing-reviewing": SKILLS.antiOverEng,
  };

  const suggestedStacks: ResolvedStack[] = [
    createMockResolvedStack("react-fullstack", "React Fullstack", {
      allSkillIds: ["web-framework-react", "web-state-zustand", "api-framework-hono"],
    }),
    createMockResolvedStack("testing-stack", "Testing Stack", {
      allSkillIds: ["web-testing-vitest"],
    }),
  ];

  return createMockMatrix(skills, {
    suggestedStacks,
    categories: {
      "web-framework": {
        ...TEST_CATEGORIES.framework,
        domain: "web",
        exclusive: true,
        required: true,
      },
      "web-client-state": { ...TEST_CATEGORIES.clientState, domain: "web", order: 1 },
      "api-api": {
        ...TEST_CATEGORIES.api,
        domain: "api",
        exclusive: true,
        required: true,
      },
      "web-testing": {
        ...TEST_CATEGORIES.testing,
        displayName: "Testing Framework",
        domain: "shared",
        exclusive: false,
      },
      "meta-reviewing": {
        ...TEST_CATEGORIES.methodology,
        domain: "meta",
        exclusive: false,
        required: false,
      },
    } as Record<Category, CategoryDefinition>,
    ...overrides,
  });
}

/** Decomposed matrix config returned by createMockMatrixConfig (replaces SkillsMatrixConfig) */
export type MockMatrixConfig = {
  categories: Record<string, CategoryDefinition>;
  relationships: RelationshipDefinitions;
};

export function createMockMatrixConfig(
  categories: Record<string, CategoryDefinition>,
  overrides?: {
    relationships?: Partial<RelationshipDefinitions>;
  },
): MockMatrixConfig {
  const defaultRelationships: RelationshipDefinitions = {
    conflicts: [],
    discourages: [],
    recommends: [],
    requires: [],
    alternatives: [],
  };
  return {
    categories,
    relationships: overrides?.relationships
      ? { ...defaultRelationships, ...overrides.relationships }
      : defaultRelationships,
  };
}
