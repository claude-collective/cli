// Shared matrix configs and compile configs for test files.
// Uses createMockMatrixConfig/createMockCompileConfig from helpers.ts.

import type { SkillId } from "../../../types";
import {
  createMockMatrixConfig,
  createMockCompileConfig,
  createMockCategory,
  createMockMatrix,
  createMockSkill,
} from "../helpers.js";
import { TEST_SKILLS } from "../test-fixtures.js";
import { FRAMEWORK_CATEGORY } from "./mock-categories.js";

// ---------------------------------------------------------------------------
// Matrix configs from matrix-loader.test.ts
// ---------------------------------------------------------------------------

export const MERGE_BASIC_MATRIX = createMockMatrixConfig(
  { "web-framework": FRAMEWORK_CATEGORY },
  { skillAliases: { react: "web-framework-react" } },
);

export const CONFLICT_MATRIX = createMockMatrixConfig(
  {},
  {
    relationships: {
      conflicts: [
        { skills: ["web-framework-react", "web-framework-vue"], reason: "Pick one framework" },
      ],
      discourages: [],
      recommends: [],
      requires: [],
      alternatives: [],
    },
    skillAliases: {
      react: "web-framework-react",
      vue: "web-framework-vue",
    },
  },
);

export const ALTERNATIVES_MATRIX = createMockMatrixConfig(
  {},
  {
    relationships: {
      conflicts: [],
      discourages: [],
      recommends: [],
      requires: [],
      alternatives: [
        {
          purpose: "State management",
          skills: ["web-state-zustand", "web-state-jotai"],
        },
      ],
    },
  },
);

export const REQUIRES_MATRIX = createMockMatrixConfig(
  {},
  {
    relationships: {
      conflicts: [],
      discourages: [],
      recommends: [],
      requires: [
        {
          skill: "web-state-zustand",
          needs: ["web-framework-react"],
          reason: "Zustand needs React",
        },
      ],
      alternatives: [],
    },
  },
);

// ---------------------------------------------------------------------------
// MergedSkillsMatrix instances from config-generator.test.ts
// ---------------------------------------------------------------------------

export const LOCAL_SKILL_MATRIX = createMockMatrix({
  "web-local-skill": createMockSkill("web-local-skill", "local", {
    local: true,
    localPath: ".claude/skills/my-local-skill/",
  }),
});

export const MIXED_LOCAL_REMOTE_MATRIX = createMockMatrix({
  "web-framework-react": TEST_SKILLS.react,
  "meta-company-patterns": createMockSkill("meta-company-patterns", "local", {
    local: true,
    localPath: ".claude/skills/company-patterns/",
  }),
});

export const METHODOLOGY_MATRIX = createMockMatrix({
  "meta-methodology-anti-over-engineering": TEST_SKILLS.antiOverEngineering,
});

export const VITEST_MATRIX = createMockMatrix({
  "web-testing-vitest": TEST_SKILLS.vitest,
});

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
  "shared-tooling": createMockCategory("shared-tooling", "Tooling", {
    description: "Development tooling and infrastructure",
    domain: "shared",
    exclusive: false,
    required: false,
    order: 20,
  }),
  "web-framework": createMockCategory("web-framework", "Framework", {
    description: "UI Framework",
    domain: "web",
    exclusive: true,
    required: true,
    order: 1,
  }),
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
    "web-framework": createMockCategory("web-framework", "Framework", {
      description: "UI Framework",
      domain: "web",
      exclusive: true,
      required: true,
      order: 1,
    }),
    "web-styling": createMockCategory("web-styling", "Styling", {
      description: "CSS approach",
      domain: "web",
      exclusive: false,
      required: false,
      order: 2,
    }),
  },
  {
    relationships: {
      conflicts: [],
      discourages: [
        {
          skills: ["web-framework-custom-a" as SkillId, "web-styling-custom-b" as SkillId],
          reason: "These tools have conflicting design philosophies",
        },
      ],
      recommends: [
        {
          when: "web-framework-custom-a" as SkillId,
          suggest: ["web-styling-custom-c" as SkillId],
          reason: "These work great together",
        },
      ],
      requires: [],
      alternatives: [],
    },
  },
);

export const TOOLING_CONFIG = createMockMatrixConfig({
  "shared-tooling": createMockCategory("shared-tooling", "Tooling", {
    description: "Build and bundling tools",
    domain: "web",
    exclusive: false,
    required: false,
    order: 5,
  }),
});

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
    "web-framework": createMockCategory("web-framework", "Framework", {
      description: "UI Framework",
      domain: "web",
      exclusive: true,
      required: true,
      order: 1,
    }),
    "web-testing": createMockCategory("web-testing", "Testing", {
      description: "Testing tools",
      domain: "shared",
      exclusive: false,
      required: false,
      order: 10,
    }),
  },
  {
    relationships: {
      conflicts: [],
      discourages: [],
      recommends: [],
      requires: [
        {
          skill: "web-testing-custom-rtl" as SkillId,
          needs: ["web-framework-custom-react" as SkillId],
          reason: "RTL requires React to function",
        },
      ],
      alternatives: [],
    },
  },
);
