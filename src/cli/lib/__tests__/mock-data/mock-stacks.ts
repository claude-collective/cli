// Shared stack constants for test files.
// Each stack uses createMockStack/createMockSkillAssignment from helpers.ts.
// TestStack arrays are used with createTestSource() for integration tests.

import type { SkillId } from "../../../types";
import type { TestStack } from "../fixtures/create-test-source.js";
import { createMockStack, createMockSkillAssignment } from "../helpers.js";

/** Shorthand alias for createMockSkillAssignment */
const sa = (id: SkillId, preloaded = false) => createMockSkillAssignment(id, preloaded);

// ---------------------------------------------------------------------------
// Stacks from resolver.test.ts
// ---------------------------------------------------------------------------

export const FULLSTACK_STACK = createMockStack("fullstack", {
  name: "Fullstack Stack",
  description: "A fullstack development stack",
  agents: {
    "web-developer": {
      "web-framework": [sa("web-framework-react", true)],
      "web-styling": [sa("web-styling-scss-modules")],
    },
    "api-developer": {
      "api-api": [sa("api-framework-hono", true)],
      "api-database": [sa("api-database-drizzle", true)],
    },
  },
});

export const WEB_REACT_AND_SCSS_STACK = createMockStack("test-stack", {
  name: "Test Stack",
  agents: {
    "web-developer": {
      "web-framework": [sa("web-framework-react", true)],
      "web-styling": [sa("web-styling-scss-modules")],
    },
  },
});

export const WEB_REACT_ONLY_STACK = createMockStack("test-stack", {
  name: "Test Stack",
  agents: {
    "web-developer": {
      "web-framework": [sa("web-framework-react", true)],
    },
  },
});

export const WEB_SCSS_ONLY_STACK = createMockStack("test-stack", {
  name: "Test Stack",
  agents: {
    "web-developer": {
      "web-styling": [sa("web-styling-scss-modules")],
    },
  },
});

export const API_HONO_ONLY_STACK = createMockStack("test-stack", {
  name: "Test Stack",
  agents: {
    "api-developer": { "api-api": [sa("api-framework-hono", true)] },
  },
});

export const WEB_EMPTY_AGENT_STACK = createMockStack("test-stack", {
  name: "Test Stack",
  agents: {
    "web-developer": {},
  },
});

export const WEB_ONLY_PARTIAL_STACK = createMockStack("web-only", {
  name: "Web Stack",
  description: "A web-only stack",
  agents: {
    "web-developer": {
      "web-framework": [sa("web-framework-react", true)],
    },
  },
});

// ---------------------------------------------------------------------------
// Stacks from config-generator.test.ts
// ---------------------------------------------------------------------------

export const EMPTY_AGENTS_STACK = createMockStack("empty-stack", {
  name: "Empty Stack",
  description: "No agents",
  agents: {},
});

export const PRELOADED_FLAG_STACK = createMockStack("test-stack", {
  name: "Test Stack",
  description: "Test stack",
  agents: {
    "web-developer": {
      "web-framework": [sa("web-framework-react", true)],
      "web-styling": [sa("web-styling-scss-modules", false)],
    },
  },
});

export const SHARED_SUBCATEGORY_STACK = createMockStack("test-stack", {
  name: "Test Stack",
  description: "Test stack",
  agents: {
    "web-developer": {
      "web-framework": [sa("web-framework-react")],
    },
    "web-reviewer": {
      "web-framework": [sa("web-framework-react")],
    },
  },
});

export const STACK_WITH_EMPTY_AGENTS = createMockStack("test-stack", {
  name: "Test Stack",
  description: "Test stack",
  agents: {
    "web-developer": {
      "web-framework": [sa("web-framework-react", true)],
    },
    "cli-tester": {},
    "web-pm": {},
  },
});

export const SINGLE_AGENT_STACK = createMockStack("test-stack", {
  name: "Test Stack",
  description: "Test stack",
  agents: {
    "web-developer": {
      "web-framework": [sa("web-framework-react", true)],
      "web-styling": [sa("web-styling-tailwind")],
    },
  },
});

export const MULTI_METHODOLOGY_STACK = createMockStack("test-stack", {
  name: "Test Stack",
  description: "Test stack",
  agents: {
    "pattern-scout": {
      "shared-methodology": [
        sa("meta-methodology-investigation-requirements", true),
        sa("meta-methodology-anti-over-engineering", true),
        sa("meta-methodology-success-criteria", true),
      ],
      "shared-research": [sa("meta-research-research-methodology", true)],
    },
  },
});

export const STACK_WITH_EMPTY_SUBCATEGORY = createMockStack("test-stack", {
  name: "Test Stack",
  description: "Test stack",
  agents: {
    "web-developer": {
      "web-framework": [sa("web-framework-react", true)],
      "shared-methodology": [],
    },
  },
});

export const MANY_SUBCATEGORIES_STACK = createMockStack("fullstack", {
  name: "Fullstack",
  description: "Fullstack stack",
  agents: {
    "web-developer": {
      "web-framework": [sa("web-framework-react")],
      "web-styling": [sa("web-styling-scss-modules")],
      "web-client-state": [sa("web-state-zustand")],
      "web-testing": [sa("web-testing-vitest")],
    },
  },
});

export const LOCAL_SKILL_STACK = createMockStack("test-stack", {
  name: "Test Stack",
  description: "Test stack with local skill",
  agents: {
    "web-developer": {
      "web-framework": [
        {
          id: "web-framework-react",
          preloaded: true,
          local: true,
          path: ".claude/skills/react/",
        },
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// Stack from compilation-pipeline.test.ts
// ---------------------------------------------------------------------------

export const COMPILATION_TEST_STACK = createMockStack("test-stack", {
  name: "Test Stack",
  description: "A test stack for integration testing",
  agents: {
    "web-developer": {
      "web-framework": [{ id: "web-framework-react" as SkillId, preloaded: true }],
    },
    "api-developer": {
      "api-api": [{ id: "api-framework-hono" as SkillId, preloaded: true }],
    },
  },
});

// ---------------------------------------------------------------------------
// TestStack arrays from consumer-stacks-matrix.integration.test.ts
// (used with createTestSource() — different shape than Stack objects above)
// ---------------------------------------------------------------------------

export const CUSTOM_TEST_STACKS: TestStack[] = [
  {
    id: "custom-fullstack",
    name: "Custom Fullstack",
    description: "A consumer-defined fullstack stack",
    agents: {
      "web-developer": {
        "web-framework": "web-framework-react",
      },
      "api-developer": {
        "api-api": "api-framework-hono",
      },
    },
  },
  {
    id: "custom-testing",
    name: "Custom Testing",
    description: "A consumer-defined testing stack",
    agents: {
      "web-developer": {
        "web-testing": "web-testing-vitest",
      },
    },
  },
];

export const PHILOSOPHY_TEST_STACKS: TestStack[] = [
  {
    id: "philo-stack",
    name: "Philosophy Stack",
    description: "Stack with philosophy",
    agents: {
      "web-developer": {
        "web-framework": "web-framework-react",
      },
    },
    philosophy: "Modern fullstack with type safety",
  },
];

export const OVERRIDING_TEST_STACKS: TestStack[] = [
  {
    id: "nextjs-fullstack",
    name: "Custom Next.js",
    description: "Consumer override of Next.js stack",
    agents: {
      "web-developer": {
        "web-framework": "web-framework-react",
        "web-testing": "web-testing-vitest",
      },
    },
  },
];

export const MARKETPLACE_TEST_STACKS: TestStack[] = [
  {
    id: "marketplace-stack",
    name: "Marketplace Stack",
    description: "A stack from a marketplace source",
    agents: {
      "web-developer": {
        "web-framework": "web-framework-react",
      },
      "api-developer": {
        "api-api": "api-framework-hono",
      },
    },
  },
];

export const MARKETPLACE_FULLSTACK_TEST_STACKS: TestStack[] = [
  {
    id: "mp-fullstack",
    name: "MP Fullstack",
    description: "Marketplace fullstack",
    agents: {
      "web-developer": {
        "web-framework": "web-framework-react",
      },
    },
  },
];

export const PIPELINE_TEST_STACKS: TestStack[] = [
  {
    id: "custom-pipeline",
    name: "Custom Pipeline",
    description: "Stack for testing the full pipeline",
    agents: {
      "web-developer": {
        "web-framework": "web-framework-react",
        "web-testing": "web-testing-vitest",
      },
      "api-developer": {
        "api-api": "api-framework-hono",
      },
    },
  },
];

export const MULTI_TEST_STACKS: TestStack[] = [
  {
    id: "stack-a",
    name: "Stack A",
    description: "First stack",
    agents: {
      "web-developer": {
        "web-framework": "web-framework-react",
      },
    },
  },
  {
    id: "stack-b",
    name: "Stack B",
    description: "Second stack also using React",
    agents: {
      "web-developer": {
        "web-framework": "web-framework-react",
        "web-testing": "web-testing-vitest",
      },
    },
  },
];
