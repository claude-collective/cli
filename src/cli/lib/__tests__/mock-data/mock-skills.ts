// Shared skill entries and TestSkill arrays for test files.
// Uses createMockSkillEntry from helpers.ts.

import type { Skill, SkillId } from "../../../types";
import type { TestSkill } from "../fixtures/create-test-source";
import { createMockSkillEntry, createTestSkill } from "../helpers.js";
import { renderSkillMd } from "../content-generators";

// Skill entries from compiler.test.ts

export const REACT_SKILL_PRELOADED = createMockSkillEntry("web-framework-react", true);

export const REACT_SKILL = createMockSkillEntry("web-framework-react");

export const VITEST_SKILL = createMockSkillEntry("web-testing-vitest");

export const VITEST_SINGLE_FILE_SKILL: Skill = {
  ...VITEST_SKILL,
  path: "skills/web-testing-vitest.md",
};

const METHODOLOGY_TEST_SKILLS: TestSkill[] = [
  {
    id: "meta-methodology-anti-over-engineering",
    slug: "anti-over-engineering",
    displayName: "Anti Over-Engineering",
    description: "Surgical implementation, not architectural innovation",
    category: "shared-methodology",
    author: "@test",
    domain: "shared",
    tags: ["methodology", "foundational"],
  },
];

// Individual TestSkill constants — each skill defined exactly once

const reactSkill = createTestSkill(
  "web-framework-react",
  "React framework for building user interfaces",
  {
    tags: ["react", "web", "ui"],
  },
);

const zustandSkill = createTestSkill("web-state-zustand", "Bear necessities state management", {
  tags: ["state", "react", "zustand"],
});

const vitestSkill = createTestSkill("web-testing-vitest", "Next generation testing framework", {
  tags: ["testing", "vitest", "unit"],
});

const honoSkill = createTestSkill("api-framework-hono", "Lightweight web framework for the edge", {
  tags: ["api", "hono", "edge"],
});

const vueSkill = createTestSkill("web-framework-vue", "Progressive JavaScript framework", {
  tags: ["vue", "web"],
});

const scssSkill = createTestSkill("web-styling-scss-modules", "CSS Modules with SCSS", {
  displayName: "SCSS Modules",
  tags: ["css", "scss"],
});

const drizzleSkill = createTestSkill("api-database-drizzle", "TypeScript ORM for SQL databases", {
  tags: ["database", "orm"],
});

// Composed TestSkill arrays

export const EXTRA_DOMAIN_TEST_SKILLS: TestSkill[] = [vueSkill, scssSkill, drizzleSkill];

export const COMPILE_LOCAL_SKILL: TestSkill = createTestSkill(
  "web-tooling-local-skill",
  "A local project skill",
  { slug: "tooling", displayName: "Local Skill", tags: ["local", "custom"] },
);

export const DEFAULT_TEST_SKILLS: TestSkill[] = [reactSkill, zustandSkill, vitestSkill, honoSkill];

export const PIPELINE_TEST_SKILLS: TestSkill[] = [
  ...DEFAULT_TEST_SKILLS,
  ...EXTRA_DOMAIN_TEST_SKILLS,
];

// TestSkill constants from consumer-stacks-matrix.integration.test.ts

export const DOCKER_TOOLING_SKILL: TestSkill = createTestSkill(
  "infra-tooling-docker",
  "Docker containerization patterns",
  {
    slug: "tooling",
    displayName: "Docker",
    domain: "shared",
    tags: ["docker", "devops", "containers"],
  },
);

export const CI_CD_SKILLS: TestSkill[] = [
  createTestSkill("infra-ci-cd-github-actions", "github-actions CI/CD pipeline", {
    slug: "github-actions",
    displayName: "GitHub Actions",
    category: "infra-ci-cd",
    domain: "shared",
    tags: ["ci-cd", "github-actions"],
  }),
  createTestSkill("infra-ci-cd-gitlab-ci", "gitlab-ci CI/CD pipeline", {
    slug: "gitlab-ci",
    displayName: "GitLab CI",
    category: "infra-ci-cd",
    domain: "shared",
    tags: ["ci-cd", "gitlab-ci"],
  }),
];

export const DISCOURAGES_RELATIONSHIP_SKILLS: TestSkill[] = [reactSkill, scssSkill, vueSkill];

export const DATADOG_OBSERVABILITY_SKILL: TestSkill = createTestSkill(
  "api-observability-datadog",
  "Datadog APM integration",
  { tags: ["monitoring", "observability", "apm", "custom-tag"] },
);

export const REQUIRES_RELATIONSHIP_SKILLS: TestSkill[] = [reactSkill, vitestSkill];

// Source-switching TestSkill arrays (with rendered SKILL.md content)

/** Creates a TestSkill with rendered SKILL.md content for source-switching tests */
function contentSkill(
  id: SkillId,
  description: string,
  tags: string[],
  body: string,
  author?: string,
): TestSkill {
  return createTestSkill(id, description, {
    ...(author ? { author } : {}),
    tags,
    content: renderSkillMd(id, description, body),
  });
}

export const SWITCHABLE_SKILLS: TestSkill[] = [
  contentSkill(
    "web-framework-react",
    "React framework for building user interfaces",
    ["react", "web"],
    "# React (Marketplace Version)\n\nReact is a JavaScript library for building user interfaces.\nUse component-based architecture with JSX.",
  ),
  contentSkill(
    "web-state-zustand",
    "Bear necessities state management",
    ["state", "zustand"],
    "# Zustand (Marketplace Version)\n\nZustand is a minimal state management library for React.",
  ),
  contentSkill(
    "api-framework-hono",
    "Lightweight web framework for the edge",
    ["api", "hono"],
    "# Hono (Marketplace Version)\n\nHono is a fast web framework for the edge.",
  ),
  contentSkill(
    "web-testing-vitest",
    "Next generation testing framework",
    ["testing", "vitest"],
    "# Vitest (Marketplace Version)\n\nVitest is a fast unit test framework powered by Vite.",
  ),
];

export const LOCAL_SKILL_VARIANTS: TestSkill[] = [
  contentSkill(
    "web-framework-react",
    "React framework (local customized version)",
    ["react", "web"],
    "# React (Local Version)\n\nThis is my customized React skill with project-specific patterns.",
    "@local-user",
  ),
  contentSkill(
    "web-state-zustand",
    "Zustand state management (local customized version)",
    ["state", "zustand"],
    "# Zustand (Local Version)\n\nMy customized Zustand patterns with project-specific stores.",
    "@local-user",
  ),
];

export const RESOLUTION_PIPELINE_SKILLS: TestSkill[] = [
  createTestSkill("web-framework-react", "React framework (public source)", {
    tags: ["react", "web"],
  }),
  createTestSkill("api-framework-hono", "Hono framework (acme source)", {
    author: "@acme",
    tags: ["api", "hono"],
  }),
  createTestSkill("web-animation-framer", "Framer Motion (internal source)", {
    slug: "framer-motion",
    displayName: "Framer Motion",
    author: "@internal",
    tags: ["animation"],
  }),
  createTestSkill("api-database-drizzle", "Drizzle ORM (acme source)", {
    author: "@acme",
    tags: ["database"],
  }),
  createTestSkill("web-testing-vitest", "Vitest testing (public source)", {
    tags: ["testing"],
  }),
];

// Composed skill ID collections

export const ALL_TEST_SKILLS = [
  ...DEFAULT_TEST_SKILLS,
  ...EXTRA_DOMAIN_TEST_SKILLS,
  ...METHODOLOGY_TEST_SKILLS,
];

export const INIT_SKILL_IDS: SkillId[] = [
  "web-framework-react",
  "api-framework-hono",
  "web-testing-vitest",
];

export const INIT_TEST_SKILLS = DEFAULT_TEST_SKILLS.filter((s) => INIT_SKILL_IDS.includes(s.id));
