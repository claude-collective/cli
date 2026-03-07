// Shared skill entries, definitions, and extracted skills for test files.
// Uses createMockSkillEntry/createMockSkillDefinition/createMockExtractedSkill from helpers.ts.

import type { CategoryPath, ResolvedSkill, Skill, SkillId } from "../../../types";
import type { TestSkill } from "../fixtures/create-test-source";
import {
  createMockSkillEntry,
  createMockSkillDefinition,
  createMockExtractedSkill,
  getTestSkill,
} from "../helpers.js";

// ---------------------------------------------------------------------------
// Skill entries from compiler.test.ts
// ---------------------------------------------------------------------------

export const REACT_SKILL_PRELOADED = createMockSkillEntry("web-framework-react", true);

export const REACT_SKILL = createMockSkillEntry("web-framework-react");

export const VITEST_SINGLE_FILE_SKILL: Skill = {
  ...createMockSkillEntry("web-testing-vitest"),
  path: "skills/web-testing-vitest.md",
};

// ---------------------------------------------------------------------------
// Skill definitions from resolver.test.ts
// ---------------------------------------------------------------------------

export const REACT_DEFINITION = createMockSkillDefinition("web-framework-react", {
  path: "skills/web/framework/react/",
  description: "React component patterns",
});

export const HONO_DEFINITION = createMockSkillDefinition("api-framework-hono", {
  path: "skills/api/api/hono/",
  description: "Hono API framework",
});

export const ZUSTAND_DEFINITION = createMockSkillDefinition("web-state-zustand", {
  path: "skills/web/client-state-management/zustand/",
  description: "Lightweight state management",
});

export const SCSS_DEFINITION = createMockSkillDefinition("web-styling-scss-modules", {
  path: "skills/web/styling/scss-modules/",
  description: "SCSS Modules styling",
});

export const DRIZZLE_DEFINITION = createMockSkillDefinition("api-database-drizzle", {
  path: "skills/api/database/drizzle/",
  description: "Drizzle ORM",
});

// ---------------------------------------------------------------------------
// Extracted skills from matrix-loader.test.ts
// ---------------------------------------------------------------------------

export const REACT_EXTRACTED = createMockExtractedSkill("web-framework-react", {
  description: "React framework",
  author: "@vince",
  tags: ["react"],
});

export const REACT_EXTRACTED_BASIC = createMockExtractedSkill("web-framework-react", {
  description: "React",
});

export const VUE_EXTRACTED_BASIC = createMockExtractedSkill("web-framework-vue", {
  description: "Vue",
});

export const ZUSTAND_EXTRACTED = createMockExtractedSkill("web-state-zustand", {
  description: "Zustand",
  category: "web-client-state",
});

export const JOTAI_EXTRACTED = createMockExtractedSkill("web-state-jotai", {
  description: "Jotai",
  category: "web-client-state",
});

// ---------------------------------------------------------------------------
// Resolved skills record from consumer-stacks-matrix.integration.test.ts
// ---------------------------------------------------------------------------

export const CONSUMER_MATRIX_SKILLS: Record<string, ResolvedSkill> = {
  "web-framework-react": getTestSkill("react", {
    description: "React framework for building user interfaces",
    tags: ["react", "web"],
    path: "skills/web-framework/web-framework-react/",
  }),
  "api-framework-hono": getTestSkill("hono", {
    description: "Hono API framework for the edge",
    tags: ["hono", "api"],
    path: "skills/api-api/api-framework-hono/",
  }),
  "web-testing-vitest": getTestSkill("vitest", {
    description: "Next generation testing framework",
    tags: ["testing", "vitest"],
    path: "skills/web-testing/web-testing-vitest/",
  }),
};

// ---------------------------------------------------------------------------
// TestSkill constants from consumer-stacks-matrix.integration.test.ts
// ---------------------------------------------------------------------------

export const DOCKER_TOOLING_SKILL: TestSkill = {
  id: "infra-tooling-docker",
  slug: "tooling",
  description: "Docker containerization patterns",
  category: "infra-tooling",
  author: "@test",
  domain: "shared",
  tags: ["docker", "devops", "containers"],
};

export const CI_CD_SKILLS: TestSkill[] = [
  {
    id: "infra-ci-cd-github-actions",
    slug: "github-actions",
    description: "github-actions CI/CD pipeline",
    category: "infra-ci-cd",
    author: "@test",
    domain: "shared",
    tags: ["ci-cd", "github-actions"],
  },
  {
    id: "infra-ci-cd-gitlab-ci",
    slug: "github-actions",
    description: "gitlab-ci CI/CD pipeline",
    category: "infra-ci-cd",
    author: "@test",
    domain: "shared",
    tags: ["ci-cd", "gitlab-ci"],
  },
];

export const DISCOURAGES_TEST_SKILLS: TestSkill[] = [
  {
    id: "web-framework-custom-a",
    slug: "react",
    description: "custom-a skill",
    category: "web-framework",
    author: "@test",
    domain: "web",
  },
  {
    id: "web-styling-custom-b",
    slug: "cva",
    description: "custom-b skill",
    category: "web-styling",
    author: "@test",
    domain: "web",
  },
  {
    id: "web-styling-custom-c",
    slug: "scss-modules",
    description: "custom-c skill",
    category: "web-styling",
    author: "@test",
    domain: "web",
  },
];

export const DATADOG_OBSERVABILITY_SKILL: TestSkill = {
  id: "api-observability-datadog",
  slug: "axiom-pino-sentry",
  description: "Datadog APM integration",
  category: "api-observability",
  author: "@test",
  domain: "api",
  tags: ["monitoring", "observability", "apm", "custom-tag"],
};

export const REQUIRES_TEST_SKILLS: TestSkill[] = [
  {
    id: "web-framework-custom-react",
    slug: "react",
    description: "custom-react",
    category: "web-framework",
    author: "@test",
    domain: "web",
  },
  {
    id: "web-testing-custom-rtl",
    slug: "react-testing-library",
    description: "custom-rtl",
    category: "web-testing",
    author: "@test",
    domain: "web",
  },
];

// ---------------------------------------------------------------------------
// TestSkill arrays from wizard-init-compile-pipeline.test.ts
// ---------------------------------------------------------------------------

export const PIPELINE_TEST_SKILLS: TestSkill[] = [
  {
    id: "web-framework-react",
    slug: "react",
    description: "React framework for building user interfaces",
    category: "web-framework",
    author: "@test",
    domain: "web",
    tags: ["react", "web"],
    content: `---
name: web-framework-react
description: React framework for building user interfaces
---

# React

React is a JavaScript library for building user interfaces.
Use component-based architecture with JSX.
`,
  },
  {
    id: "web-state-zustand",
    slug: "zustand",
    description: "Bear necessities state management",
    category: "web-client-state",
    author: "@test",
    domain: "web",
    tags: ["state", "zustand"],
    content: `---
name: web-state-zustand
description: Bear necessities state management
---

# Zustand

Zustand is a minimal state management library for React.
`,
  },
  {
    id: "web-styling-scss-modules",
    slug: "scss-modules",
    description: "CSS Modules with SCSS",
    category: "web-styling",
    author: "@test",
    domain: "web",
    tags: ["css", "scss"],
    content: `---
name: web-styling-scss-modules
description: CSS Modules with SCSS
---

# SCSS Modules

Use CSS Modules with SCSS for scoped styling.
`,
  },
  {
    id: "web-testing-vitest",
    slug: "vitest",
    description: "Next generation testing framework",
    category: "web-testing",
    author: "@test",
    domain: "web",
    tags: ["testing", "vitest"],
    content: `---
name: web-testing-vitest
description: Next generation testing framework
---

# Vitest

Vitest is a fast unit test framework powered by Vite.
`,
  },
  {
    id: "api-framework-hono",
    slug: "hono",
    description: "Lightweight web framework for the edge",
    category: "api-api",
    author: "@test",
    domain: "api",
    tags: ["api", "hono"],
    content: `---
name: api-framework-hono
description: Lightweight web framework for the edge
---

# Hono

Hono is a fast web framework for the edge.
`,
  },
  {
    id: "api-database-drizzle",
    slug: "drizzle",
    description: "TypeScript ORM for SQL databases",
    category: "api-database",
    author: "@test",
    domain: "api",
    tags: ["database", "orm"],
    content: `---
name: api-database-drizzle
description: TypeScript ORM for SQL databases
---

# Drizzle ORM

Drizzle is a lightweight TypeScript ORM.
`,
  },
  {
    id: "api-security-auth-patterns",
    slug: "auth-patterns",
    description: "Authentication and authorization patterns",
    category: "api-security",
    author: "@test",
    domain: "api",
    tags: ["auth", "security"],
    content: `---
name: api-security-auth-patterns
description: Authentication and authorization patterns
---

# Auth Patterns

JWT-based authentication and role-based authorization.
`,
  },
  {
    id: "web-accessibility-a11y",
    slug: "accessibility",
    description: "Web accessibility best practices",
    category: "web-accessibility",
    author: "@test",
    domain: "web",
    tags: ["a11y", "accessibility"],
    content: `---
name: web-accessibility-a11y
description: Web accessibility best practices
---

# Accessibility

Follow WCAG 2.1 guidelines for accessible web applications.
`,
  },
  {
    id: "meta-methodology-investigation",
    slug: "investigation-requirements",
    description: "Investigation before implementation",
    category: "shared-methodology",
    author: "@test",
    domain: "shared",
    tags: ["methodology"],
    content: `---
name: meta-methodology-investigation
description: Investigation before implementation
---

# Investigation Requirements

Always investigate before implementing. Read the code first.
`,
  },
  {
    id: "web-animation-framer",
    slug: "framer-motion",
    description: "Framer Motion animation library",
    category: "web-animation",
    author: "@test",
    domain: "web",
    tags: ["animation", "framer"],
    content: `---
name: web-animation-framer
description: Framer Motion animation library
---

# Framer Motion

Production-ready motion library for React.
`,
  },
];

// ---------------------------------------------------------------------------
// TestSkill arrays from skill-resolution.integration.test.ts
// (renamed from PIPELINE_SKILLS to avoid collision with PIPELINE_TEST_SKILLS)
// ---------------------------------------------------------------------------

export const RESOLUTION_PIPELINE_SKILLS: TestSkill[] = [
  {
    id: "web-framework-react",
    slug: "react",
    description: "React framework (public source)",
    category: "web-framework",
    author: "@test",
    domain: "web",
    tags: ["react", "web"],
    content: `---\nname: web-framework-react\ndescription: React framework\n---\n\n# React\n\nReact framework from public source.\n`,
  },
  {
    id: "api-framework-hono",
    slug: "hono",
    description: "Hono framework (acme source)",
    category: "api-api",
    author: "@acme",
    domain: "api",
    tags: ["api", "hono"],
    content: `---\nname: api-framework-hono\ndescription: Hono framework\n---\n\n# Hono\n\nHono framework from acme source.\n`,
  },
  {
    id: "web-animation-framer",
    slug: "framer-motion",
    description: "Framer Motion (internal source)",
    category: "web-animation",
    author: "@internal",
    domain: "web",
    tags: ["animation"],
    content: `---\nname: web-animation-framer\ndescription: Framer Motion\n---\n\n# Framer Motion\n\nFramer Motion from internal source.\n`,
  },
  {
    id: "api-database-drizzle",
    slug: "drizzle",
    description: "Drizzle ORM (acme source)",
    category: "api-database",
    author: "@acme",
    domain: "api",
    tags: ["database"],
    content: `---\nname: api-database-drizzle\ndescription: Drizzle ORM\n---\n\n# Drizzle ORM\n\nDrizzle from acme source.\n`,
  },
  {
    id: "web-testing-vitest",
    slug: "vitest",
    description: "Vitest testing (public source)",
    category: "web-testing",
    author: "@test",
    domain: "web",
    tags: ["testing"],
    content: `---\nname: web-testing-vitest\ndescription: Vitest testing\n---\n\n# Vitest\n\nVitest from public source.\n`,
  },
];

// ---------------------------------------------------------------------------
// TestSkill arrays from source-switching.integration.test.ts
// ---------------------------------------------------------------------------

export const SWITCHABLE_SKILLS: TestSkill[] = [
  {
    id: "web-framework-react",
    slug: "react",
    description: "React framework for building user interfaces",
    category: "web-framework",
    author: "@test",
    domain: "web",
    tags: ["react", "web"],
    content: `---
name: web-framework-react
description: React framework for building user interfaces
---

# React (Marketplace Version)

React is a JavaScript library for building user interfaces.
Use component-based architecture with JSX.
`,
  },
  {
    id: "web-state-zustand",
    slug: "zustand",
    description: "Bear necessities state management",
    category: "web-client-state",
    author: "@test",
    domain: "web",
    tags: ["state", "zustand"],
    content: `---
name: web-state-zustand
description: Bear necessities state management
---

# Zustand (Marketplace Version)

Zustand is a minimal state management library for React.
`,
  },
  {
    id: "api-framework-hono",
    slug: "hono",
    description: "Lightweight web framework for the edge",
    category: "api-api",
    author: "@test",
    domain: "api",
    tags: ["api", "hono"],
    content: `---
name: api-framework-hono
description: Lightweight web framework for the edge
---

# Hono (Marketplace Version)

Hono is a fast web framework for the edge.
`,
  },
  {
    id: "web-testing-vitest",
    slug: "vitest",
    description: "Next generation testing framework",
    category: "web-testing",
    author: "@test",
    domain: "web",
    tags: ["testing", "vitest"],
    content: `---
name: web-testing-vitest
description: Next generation testing framework
---

# Vitest (Marketplace Version)

Vitest is a fast unit test framework powered by Vite.
`,
  },
];

// ---------------------------------------------------------------------------
// TestSkill arrays from create-test-source.ts (methodology, extra domain, local, defaults)
// ---------------------------------------------------------------------------

export const METHODOLOGY_TEST_SKILLS: TestSkill[] = [
  {
    id: "meta-methodology-investigation-requirements",
    slug: "investigation-requirements",
    description: "Never speculate - read actual code first",
    category: "shared-methodology",
    author: "@test",
    domain: "shared",
    tags: ["methodology", "foundational"],
  },
  {
    id: "meta-methodology-anti-over-engineering",
    slug: "anti-over-engineering",
    description: "Surgical implementation, not architectural innovation",
    category: "shared-methodology",
    author: "@test",
    domain: "shared",
    tags: ["methodology", "foundational"],
  },
  {
    id: "meta-methodology-success-criteria",
    slug: "success-criteria",
    description: "Explicit, measurable criteria defining done",
    category: "shared-methodology",
    author: "@test",
    domain: "shared",
    tags: ["methodology", "foundational"],
  },
  {
    id: "meta-methodology-write-verification",
    slug: "write-verification",
    description: "Verify work was actually saved",
    category: "shared-methodology",
    author: "@test",
    domain: "shared",
    tags: ["methodology", "foundational"],
  },
  {
    id: "meta-methodology-improvement-protocol",
    slug: "improvement-protocol",
    description: "Evidence-based self-improvement",
    category: "shared-methodology",
    author: "@test",
    domain: "shared",
    tags: ["methodology", "foundational"],
  },
  {
    id: "meta-methodology-context-management",
    slug: "context-management",
    description: "Maintain project continuity across sessions",
    category: "shared-methodology",
    author: "@test",
    domain: "shared",
    tags: ["methodology", "foundational"],
  },
];

export const EXTRA_DOMAIN_TEST_SKILLS: TestSkill[] = [
  {
    id: "web-framework-vue",
    slug: "vue",
    description: "Progressive JavaScript framework",
    category: "web-framework",
    author: "@test",
    domain: "web",
    tags: ["vue", "web"],
  },
  {
    id: "web-styling-scss-modules",
    slug: "scss-modules",
    description: "CSS Modules with SCSS",
    category: "web-styling",
    author: "@test",
    domain: "web",
    tags: ["css", "scss"],
  },
  {
    id: "api-database-drizzle",
    slug: "drizzle",
    description: "TypeScript ORM for SQL databases",
    category: "api-database",
    author: "@test",
    domain: "api",
    tags: ["database", "orm"],
  },
];

export const COMPILE_LOCAL_SKILL: TestSkill = {
  id: "web-tooling-local-skill",
  slug: "tooling",
  description: "A local project skill",
  category: "web-tooling",
  author: "@test",
  domain: "web",
  tags: ["local", "custom"],
  content: `---
name: web-tooling-local-skill
description: A local project skill for testing
---

# Web Tooling Local Skill

This is a locally defined skill for the project.

## Usage

Use this skill for project-specific patterns.
`,
};

export const DEFAULT_TEST_SKILLS: TestSkill[] = [
  {
    id: "web-framework-react",
    slug: "react",
    alias: "web-framework-react",
    description: "React framework for building user interfaces",
    category: "web-framework",
    author: "@test",
    domain: "web",
    tags: ["react", "web", "ui"],
    content: `---
name: web-framework-react
description: React framework for building user interfaces
---

# React

React is a JavaScript library for building user interfaces with components.

## Key Capabilities

- Component-based architecture
- Virtual DOM for performance
- JSX syntax for templates
`,
  },
  {
    id: "web-state-zustand",
    slug: "zustand",
    alias: "web-state-zustand",
    description: "Bear necessities state management",
    category: "web-client-state",
    author: "@test",
    domain: "web",
    tags: ["state", "react", "zustand"],
    content: `---
name: web-state-zustand
description: Bear necessities state management
---

# Zustand

Zustand is a small, fast state management solution for React.

## Key Features

- Simple API
- No boilerplate
- TypeScript support
`,
  },
  {
    id: "web-testing-vitest",
    slug: "vitest",
    alias: "web-testing-vitest",
    description: "Next generation testing framework",
    category: "web-testing",
    author: "@test",
    domain: "web",
    tags: ["testing", "vitest", "unit"],
    content: `---
name: web-testing-vitest
description: Next generation testing framework
---

# Vitest

Vitest is a fast unit test framework powered by Vite.
`,
  },
  {
    id: "api-framework-hono",
    slug: "hono",
    alias: "api-framework-hono",
    description: "Lightweight web framework for the edge",
    category: "api-api",
    author: "@test",
    domain: "api",
    tags: ["api", "hono", "edge"],
    content: `---
name: api-framework-hono
description: Lightweight web framework for the edge
---

# Hono

Hono is a small, fast web framework for the edge.
`,
  },
];

// ---------------------------------------------------------------------------
// TestSkill arrays from source-switching.integration.test.ts
// ---------------------------------------------------------------------------

export const LOCAL_SKILL_VARIANTS: TestSkill[] = [
  {
    id: "web-framework-react",
    slug: "react",
    description: "React framework (local customized version)",
    category: "web-framework",
    author: "@local-user",
    domain: "web",
    tags: ["react", "web"],
    content: `---
name: web-framework-react
description: React framework (local customized version)
---

# React (Local Version)

This is my customized React skill with project-specific patterns.
`,
  },
  {
    id: "web-state-zustand",
    slug: "zustand",
    description: "Zustand state management (local customized version)",
    category: "web-client-state",
    author: "@local-user",
    domain: "web",
    tags: ["state", "zustand"],
    content: `---
name: web-state-zustand
description: Zustand state management (local customized version)
---

# Zustand (Local Version)

My customized Zustand patterns with project-specific stores.
`,
  },
];

// ---------------------------------------------------------------------------
// Skill entries from skill-resolution.integration.test.ts
// ---------------------------------------------------------------------------

export type SkillEntry = { id: SkillId; category: CategoryPath; description: string };

export const PUBLIC_SKILLS: SkillEntry[] = [
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

export const ACME_SKILLS: SkillEntry[] = [
  { id: "web-framework-react", category: "web-framework", description: "React (acme custom fork)" },
  { id: "api-framework-hono", category: "api-api", description: "Hono web framework" },
  { id: "api-database-drizzle", category: "api-database", description: "Drizzle ORM" },
  { id: "api-security-auth-patterns", category: "shared-security", description: "Auth patterns" },
  { id: "web-testing-vitest", category: "web-testing", description: "Vitest (acme custom)" },
];

export const INTERNAL_SKILLS: SkillEntry[] = [
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

// ---------------------------------------------------------------------------
// Composed skill ID collections
// ---------------------------------------------------------------------------

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

export const EJECT_INSTALLED_SKILL_IDS: SkillId[] = [
  "web-framework-react",
  "api-framework-hono",
];

export const TEST_AVAILABLE_SKILLS = [
  "web-framework-react",
  "web-framework-vue",
  "web-styling-scss-modules",
  "web-state-zustand",
  "web-testing-vitest",
  "web-mocks-msw",
  "api-framework-hono",
  "api-database-drizzle",
  "api-auth-better-auth",
  "cli-framework-cli-commander",
  "cli-framework-oclif",
  "mobile-framework-react-native",
  "mobile-framework-expo",
  "infra-monorepo-turborepo",
  "infra-env-setup",
  "security-web-security",
  "meta-methodology-investigation-requirements",
  "meta-methodology-anti-over-engineering",
  "meta-reviewing-reviewing",
  "meta-research-research-methodology",
] as const;
