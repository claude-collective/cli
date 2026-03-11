// Shared matrix configs and compile configs for test files.
// Uses createMockMatrixConfig/createMockCompileConfig from helpers.ts.

import {
  createMockMatrixConfig,
  createMockCompileConfig,
  createMockCategory,
  createMockMatrix,
  createMockSkill,
} from "../helpers.js";
import { SKILLS, TEST_CATEGORIES } from "../test-fixtures.js";
import { FRAMEWORK_CATEGORY } from "./mock-categories.js";
import type { Category, CategoryDefinition } from "../../../types";

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
    "shared-methodology": { domain: "shared" },
  } as Record<Category, CategoryDefinition>,
});

export const ALL_SKILLS_METHODOLOGY_BARE_MATRIX = createMockMatrix(...Object.values(SKILLS), {
  categories: {
    "shared-methodology": {},
  } as Record<Category, CategoryDefinition>,
});

export const ALL_SKILLS_MULTI_DOMAIN_MATRIX = createMockMatrix(...Object.values(SKILLS), {
  categories: {
    "web-framework": { domain: "web" },
    "shared-methodology": { domain: "shared" },
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
      conflicts: [{ skills: ["react", "vue"], reason: "Pick one framework" }],
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
  createMockSkill("web-local-skill", {
    local: true,
    localPath: ".claude/skills/my-local-skill/",
  }),
);

export const MIXED_LOCAL_REMOTE_MATRIX = createMockMatrix(
  SKILLS.react,
  createMockSkill("meta-company-patterns", {
    local: true,
    localPath: ".claude/skills/company-patterns/",
  }),
);

export const METHODOLOGY_MATRIX = createMockMatrix(SKILLS.antiOverEng);

export const VITEST_MATRIX = createMockMatrix(SKILLS.vitest);

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
  "shared-ci-cd": createMockCategory("shared-ci-cd", "CI/CD", {
    description: "Continuous integration and deployment",
    domain: "shared",
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
          skill: "vue",
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
