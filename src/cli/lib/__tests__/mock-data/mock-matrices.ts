// Shared matrix configs and compile configs for test files.
// Uses createMockMatrixConfig/createMockCompileConfig from helpers.ts.

import { groupBy, mapValues } from "remeda";

import {
  createMockMatrixConfig,
  createMockCompileConfig,
  createMockCategory,
  createMockMatrix,
  createMockMultiSourceSkill,
  createMockSkill,
  testSkillToResolvedSkill,
} from "../helpers.js";
import { SKILLS, TEST_CATEGORIES } from "../test-fixtures.js";
import { FRAMEWORK_CATEGORY, MULTI_SOURCE_CATEGORIES } from "./mock-categories.js";
import {
  CATEGORY_GRID_SKILLS,
  HEALTH_ALL_REFS_RESOLVED_SKILL,
  HEALTH_MULTIPLE_UNRESOLVED_REFS_SKILL,
  HEALTH_ORPHAN_SKILL,
  HEALTH_PARTIAL_UNRESOLVED_REQUIRES_SKILL,
  HEALTH_UNRESOLVED_COMPATIBLE_WITH_SKILL,
  HEALTH_UNRESOLVED_CONFLICTS_WITH_SKILL,
  HEALTH_UNRESOLVED_REQUIRES_SKILL,
  HEALTH_ZUSTAND_RECOMMENDED,
  MULTI_SOURCE_PUBLIC_SKILLS,
  MULTI_SOURCE_ACME_SKILLS,
  MULTI_SOURCE_INTERNAL_SKILLS,
  PIPELINE_TEST_SKILLS,
} from "./mock-skills.js";
import type { MultiSourceSkillEntry } from "./mock-skills.js";
import { PUBLIC_SOURCE, ACME_SOURCE, INTERNAL_SOURCE } from "./mock-sources.js";
import type {
  Category,
  CategoryDefinition,
  CategoryPath,
  MergedSkillsMatrix,
  SkillId,
  SkillSlug,
  SkillSource,
} from "../../../types";

// ---------------------------------------------------------------------------
// Canonical matrix shapes — use these instead of inline createMockMatrix() calls
// ---------------------------------------------------------------------------

export const EMPTY_MATRIX = createMockMatrix();
export const SINGLE_REACT_MATRIX = createMockMatrix(SKILLS.react);
export const WEB_PAIR_MATRIX = createMockMatrix(SKILLS.react, SKILLS.zustand);
export const FULLSTACK_PAIR_MATRIX = createMockMatrix(SKILLS.react, SKILLS.hono);
export const WEB_TRIO_MATRIX = createMockMatrix(SKILLS.react, SKILLS.zustand, SKILLS.vitest);
export const FULLSTACK_TRIO_MATRIX = createMockMatrix(SKILLS.react, SKILLS.hono, SKILLS.vitest);
export const VITEST_REACT_HONO_MATRIX = createMockMatrix(SKILLS.vitest, SKILLS.react, SKILLS.hono);
export const REACT_SCSS_MATRIX = createMockMatrix(SKILLS.react, SKILLS.scss);
export const REACT_SCSS_HONO_MATRIX = createMockMatrix(SKILLS.react, SKILLS.scss, SKILLS.hono);
export const SCSS_HONO_REACT_MATRIX = createMockMatrix(SKILLS.scss, SKILLS.hono, SKILLS.react);
export const HONO_REACT_MATRIX = createMockMatrix(SKILLS.hono, SKILLS.react);
export const REACT_ZUSTAND_HONO_MATRIX = createMockMatrix(
  SKILLS.react,
  SKILLS.zustand,
  SKILLS.hono,
);

export const CATEGORY_GRID_MATRIX = createMockMatrix(
  ...CATEGORY_GRID_SKILLS.map(({ id, displayName, category }) =>
    createMockSkill(id, { displayName, category }),
  ),
);

// ---------------------------------------------------------------------------
// All-skills matrices with category overrides — for wizard store tests
// ---------------------------------------------------------------------------

export const ALL_SKILLS_TEST_CATEGORIES_MATRIX = createMockMatrix(...Object.values(SKILLS), {
  categories: TEST_CATEGORIES as unknown as Record<Category, CategoryDefinition>,
});

export const ALL_SKILLS_WEB_FRAMEWORK_MATRIX = createMockMatrix(...Object.values(SKILLS), {
  categories: {
    "web-framework": { domain: "web" },
  } as Record<Category, CategoryDefinition>,
});

export const ALL_SKILLS_WEB_PAIR_CATEGORIES_MATRIX = createMockMatrix(...Object.values(SKILLS), {
  categories: {
    "web-framework": { domain: "web" },
    "web-client-state": { domain: "web" },
  } as Record<Category, CategoryDefinition>,
});

export const ALL_SKILLS_FULLSTACK_CATEGORIES_MATRIX = createMockMatrix(...Object.values(SKILLS), {
  categories: {
    "web-framework": { domain: "web" },
    "web-client-state": { domain: "web" },
    "api-api": { domain: "api" },
  } as Record<Category, CategoryDefinition>,
});

export const ALL_SKILLS_WEB_AND_API_MATRIX = createMockMatrix(...Object.values(SKILLS), {
  categories: {
    "web-framework": { domain: "web" },
    "api-api": { domain: "api" },
  } as Record<Category, CategoryDefinition>,
});

export const ALL_SKILLS_METHODOLOGY_MATRIX = createMockMatrix(...Object.values(SKILLS), {
  categories: {
    "meta-reviewing": { domain: "meta" },
  } as Record<Category, CategoryDefinition>,
});

export const ALL_SKILLS_METHODOLOGY_BARE_MATRIX = createMockMatrix(...Object.values(SKILLS), {
  categories: {
    "meta-reviewing": {},
  } as Record<Category, CategoryDefinition>,
});

export const ALL_SKILLS_MULTI_DOMAIN_MATRIX = createMockMatrix(...Object.values(SKILLS), {
  categories: {
    "web-framework": { domain: "web" },
    "meta-reviewing": { domain: "meta" },
    "api-api": { domain: "api" },
  } as Record<Category, CategoryDefinition>,
});

export const REACT_HONO_FRAMEWORK_API_MATRIX = createMockMatrix(SKILLS.react, SKILLS.hono, {
  categories: {
    "web-framework": TEST_CATEGORIES.framework,
    "api-api": TEST_CATEGORIES.api,
  } as Record<Category, CategoryDefinition>,
});

// ---------------------------------------------------------------------------
// Matrix configs from matrix-loader.test.ts
// ---------------------------------------------------------------------------

export const MERGE_BASIC_MATRIX = createMockMatrixConfig({ "web-framework": FRAMEWORK_CATEGORY });

export const CONFLICT_MATRIX = createMockMatrixConfig(
  {},
  {
    relationships: {
      conflicts: [{ skills: ["react", "vue-composition-api"], reason: "Pick one framework" }],
    },
  },
);

export const ALTERNATIVES_MATRIX = createMockMatrixConfig(
  {},
  {
    relationships: {
      alternatives: [
        {
          purpose: "State management",
          skills: ["zustand", "jotai"],
        },
      ],
    },
  },
);

export const REQUIRES_MATRIX = createMockMatrixConfig(
  {},
  {
    relationships: {
      requires: [
        {
          skill: "zustand",
          needs: ["react"],
          reason: "Zustand needs React",
        },
      ],
    },
  },
);

// ---------------------------------------------------------------------------
// MergedSkillsMatrix instances from config-generator.test.ts
// ---------------------------------------------------------------------------

export const LOCAL_SKILL_MATRIX = createMockMatrix(
  // Boundary cast: fictional skill ID for testing local skill matrix
  createMockSkill("web-local-skill" as SkillId, {
    local: true,
    localPath: ".claude/skills/my-local-skill/",
  }),
);

export const MIXED_LOCAL_REMOTE_MATRIX = createMockMatrix(
  SKILLS.react,
  // Boundary cast: fictional skill ID for testing mixed local/remote matrix
  createMockSkill("meta-company-patterns" as SkillId, {
    local: true,
    localPath: ".claude/skills/company-patterns/",
  }),
);

export const METHODOLOGY_MATRIX = createMockMatrix(SKILLS.antiOverEng);

export const VITEST_MATRIX = createMockMatrix(SKILLS.vitest);

export const MULTI_STYLING_MATRIX = createMockMatrix(
  SKILLS.react,
  SKILLS.scss,
  SKILLS.tailwind,
);

// ---------------------------------------------------------------------------
// Compile configs from resolver.test.ts
// ---------------------------------------------------------------------------

export const WEB_AND_API_COMPILE_CONFIG = createMockCompileConfig({
  "web-developer": {},
  "api-developer": {},
});

export const WEB_ONLY_COMPILE_CONFIG = createMockCompileConfig({
  "web-developer": {},
});

// ---------------------------------------------------------------------------
// Matrix configs from consumer-stacks-matrix.integration.test.ts
// ---------------------------------------------------------------------------

export const TOOLING_AND_FRAMEWORK_CONFIG = createMockMatrixConfig({
  "shared-tooling": {
    ...TEST_CATEGORIES.tooling,
    description: "Development tooling and infrastructure",
    domain: "shared" as const,
    exclusive: false,
    order: 20,
  },
  "web-framework": {
    ...TEST_CATEGORIES.framework,
    description: "UI Framework",
    required: true,
    order: 1,
  },
});

export const CI_CD_CONFIG = createMockMatrixConfig({
  "infra-ci-cd": createMockCategory("infra-ci-cd", "CI/CD", {
    description: "Continuous integration and deployment",
    domain: "infra",
    exclusive: true,
    required: false,
    order: 30,
  }),
});

export const FRAMEWORK_AND_STYLING_CONFIG = createMockMatrixConfig(
  {
    "web-framework": {
      ...TEST_CATEGORIES.framework,
      description: "UI Framework",
      required: true,
      order: 1,
    },
    "web-styling": {
      ...TEST_CATEGORIES.styling,
      description: "CSS approach",
      exclusive: false,
      order: 2,
    },
  },
  {
    relationships: {
      discourages: [
        {
          skills: ["react", "scss-modules"],
          reason: "These tools have conflicting design philosophies",
        },
      ],
      recommends: [
        {
          skill: "vue-composition-api",
          reason: "These work great together",
        },
      ],
    },
  },
);

export const OBSERVABILITY_CONFIG = createMockMatrixConfig({
  "api-observability": createMockCategory("api-observability", "Observability", {
    description: "Monitoring and observability tools",
    domain: "api",
    exclusive: false,
    required: false,
    order: 15,
  }),
});

export const FRAMEWORK_AND_TESTING_CONFIG = createMockMatrixConfig(
  {
    "web-framework": {
      ...TEST_CATEGORIES.framework,
      description: "UI Framework",
      required: true,
      order: 1,
    },
    "web-testing": {
      ...TEST_CATEGORIES.testing,
      description: "Testing tools",
      domain: "shared" as const,
      exclusive: false,
      order: 10,
    },
  },
  {
    relationships: {
      requires: [
        {
          skill: "vitest",
          needs: ["react"],
          reason: "RTL requires React to function",
        },
      ],
    },
  },
);

// ---------------------------------------------------------------------------
// Matrix configs from skill-resolution.test.ts
// ---------------------------------------------------------------------------

export const EMPTY_MATRIX_CONFIG = createMockMatrixConfig({});

export const UNRESOLVED_CONFLICT_MATRIX = createMockMatrixConfig(
  {},
  {
    relationships: {
      conflicts: [
        {
          // Boundary cast: deliberately invalid slug to test unresolved reference handling
          skills: ["react", "nonexistent" as SkillSlug],
          reason: "Conflict with missing skill",
        },
      ],
    },
  },
);

// ---------------------------------------------------------------------------
// Pipeline matrix from wizard-init-compile-pipeline.test.ts
// ---------------------------------------------------------------------------

export const PIPELINE_MATRIX = createMockMatrix(
  Object.fromEntries(
    PIPELINE_TEST_SKILLS.map((skill) => [skill.id, testSkillToResolvedSkill(skill)]),
  ),
);

// ---------------------------------------------------------------------------
// Health-check matrices from matrix-health-check.test.ts
// ---------------------------------------------------------------------------

const HEALTH_MISSING_DOMAIN_FRAMEWORK_CATEGORY = {
  ...TEST_CATEGORIES.framework,
  domain: undefined,
};

const HEALTH_MISSING_DOMAIN_STYLING_CATEGORY = {
  ...TEST_CATEGORIES.styling,
  domain: undefined,
};

export const HEALTH_HEALTHY_MATRIX = createMockMatrix(SKILLS.react, HEALTH_ZUSTAND_RECOMMENDED, {
  categories: {
    "web-framework": TEST_CATEGORIES.framework,
    "web-client-state": TEST_CATEGORIES.clientState,
  },
});

export const HEALTH_SINGLE_SKILL_MATRIX = createMockMatrix(SKILLS.react, {
  categories: {
    "web-framework": TEST_CATEGORIES.framework,
  },
});

export const HEALTH_MISSING_DOMAIN_MATRIX = createMockMatrix(SKILLS.react, {
  categories: {
    "web-framework": HEALTH_MISSING_DOMAIN_FRAMEWORK_CATEGORY,
  },
});

export const HEALTH_MULTIPLE_MISSING_DOMAINS_MATRIX = createMockMatrix(
  {},
  {
    categories: {
      "web-framework": HEALTH_MISSING_DOMAIN_FRAMEWORK_CATEGORY,
      "web-styling": HEALTH_MISSING_DOMAIN_STYLING_CATEGORY,
      "web-client-state": TEST_CATEGORIES.clientState,
    },
  },
);

export const HEALTH_UNKNOWN_CATEGORY_MATRIX = createMockMatrix(HEALTH_ORPHAN_SKILL, {
  categories: {
    "web-framework": TEST_CATEGORIES.framework,
  },
});

export const HEALTH_ORPHAN_SKILL_WITH_MISSING_DOMAIN_MATRIX = createMockMatrix(
  HEALTH_ORPHAN_SKILL,
  {
    categories: {
      "web-framework": HEALTH_MISSING_DOMAIN_FRAMEWORK_CATEGORY,
    },
  },
);

export const HEALTH_UNRESOLVED_COMPATIBLE_WITH_MATRIX = createMockMatrix(
  HEALTH_UNRESOLVED_COMPATIBLE_WITH_SKILL,
  {
    categories: {
      "web-client-state": TEST_CATEGORIES.clientState,
    },
  },
);

export const HEALTH_UNRESOLVED_CONFLICTS_WITH_MATRIX = createMockMatrix(
  HEALTH_UNRESOLVED_CONFLICTS_WITH_SKILL,
  {
    categories: {
      "web-framework": TEST_CATEGORIES.framework,
    },
  },
);

export const HEALTH_UNRESOLVED_REQUIRES_MATRIX = createMockMatrix(
  HEALTH_UNRESOLVED_REQUIRES_SKILL,
  {
    categories: {
      "web-testing": TEST_CATEGORIES.testing,
    },
  },
);

export const HEALTH_MULTIPLE_UNRESOLVED_REFS_MATRIX = createMockMatrix(
  HEALTH_MULTIPLE_UNRESOLVED_REFS_SKILL,
  {
    categories: {
      "web-client-state": TEST_CATEGORIES.clientState,
    },
  },
);

export const HEALTH_ALL_REFS_RESOLVED_MATRIX = createMockMatrix(
  SKILLS.react,
  HEALTH_ALL_REFS_RESOLVED_SKILL,
  {
    categories: {
      "web-framework": TEST_CATEGORIES.framework,
      "web-client-state": TEST_CATEGORIES.clientState,
    },
  },
);

export const HEALTH_PARTIAL_UNRESOLVED_REQUIRES_MATRIX = createMockMatrix(
  SKILLS.react,
  HEALTH_PARTIAL_UNRESOLVED_REQUIRES_SKILL,
  {
    categories: {
      "web-framework": TEST_CATEGORIES.framework,
      "web-testing": TEST_CATEGORIES.testing,
    },
  },
);

// ---------------------------------------------------------------------------
// Multi-source matrix from skill-resolution.integration.test.ts
// ---------------------------------------------------------------------------

type TaggedMultiSourceEntry = MultiSourceSkillEntry & { source: SkillSource };

export function buildMultiSourceMatrix(
  overrides?: Partial<MergedSkillsMatrix>,
): MergedSkillsMatrix {
  const taggedEntries: TaggedMultiSourceEntry[] = [
    ...MULTI_SOURCE_PUBLIC_SKILLS.map((s) => ({ ...s, source: { ...PUBLIC_SOURCE } })),
    ...MULTI_SOURCE_ACME_SKILLS.map((s) => ({ ...s, source: { ...ACME_SOURCE } })),
    ...MULTI_SOURCE_INTERNAL_SKILLS.map((s) => ({ ...s, source: { ...INTERNAL_SOURCE } })),
  ];
  const grouped = groupBy(taggedEntries, (e) => e.id);
  const skills = mapValues(grouped, (entries) => {
    const first = entries[0]!;
    const sources = entries.map((e) => e.source);
    // Boundary cast: MultiSourceSkillEntry.id is string, but contains valid skill IDs
    return createMockMultiSourceSkill(first.id as SkillId, sources, {
      category: first.category as CategoryPath,
      description: first.description,
    });
  });

  return createMockMatrix(skills, {
    categories: MULTI_SOURCE_CATEGORIES,
    ...overrides,
  });
}
