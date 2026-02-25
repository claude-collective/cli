// Shared skill entries, definitions, and extracted skills for test files.
// Uses createMockSkillEntry/createMockSkillDefinition/createMockExtractedSkill from helpers.ts.

import type { ResolvedSkill, Skill } from "../../../types";
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
