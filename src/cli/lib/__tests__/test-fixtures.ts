import type {
  CategoryPath,
  MergedSkillsMatrix,
  ResolvedSkill,
  SkillDisplayName,
  SkillId,
} from "../../types";
import { createMockSkill, createMockCategory, createMockMatrix } from "./helpers";

interface SkillFixtureConfig {
  id: SkillId;
  category: CategoryPath;
  displayName?: SkillDisplayName;
  description: string;
  tags: string[];
}

const SKILL_FIXTURES: Record<string, SkillFixtureConfig> = {
  react: {
    id: "web-framework-react",
    category: "web-framework",
    displayName: "react",
    description: "React framework for building user interfaces",
    tags: ["react", "web", "ui", "component"],
  },
  zustand: {
    id: "web-state-zustand",
    category: "web-client-state",
    displayName: "zustand",
    description: "Bear necessities state management",
    tags: ["state", "react", "zustand"],
  },
  hono: {
    id: "api-framework-hono",
    category: "api-api",
    displayName: "hono",
    description: "Lightweight web framework for the edge",
    tags: ["api", "api", "edge", "serverless"],
  },
  vitest: {
    id: "web-testing-vitest",
    category: "web-testing",
    displayName: "vitest",
    description: "Next generation testing framework",
    tags: ["testing", "vitest", "unit"],
  },
  vue: {
    id: "web-framework-vue",
    category: "web-framework",
    displayName: "vue",
    description: "Progressive JavaScript framework",
    tags: ["vue", "web", "reactive"],
  },
  "auth-patterns": {
    id: "api-security-auth-patterns",
    category: "api-security",
    description: "Authentication and authorization patterns",
    tags: ["auth", "security", "jwt", "oauth"],
  },
  drizzle: {
    id: "api-database-drizzle",
    category: "api-database",
    displayName: "drizzle",
    description: "TypeScript ORM for SQL databases",
    tags: ["database", "orm", "sql"],
  },
  methodology: {
    id: "meta-methodology-anti-over-engineering",
    category: "shared-methodology",
    description: "Surgical implementation, not architectural innovation",
    tags: ["methodology", "foundational"],
  },
  "scss-modules": {
    id: "web-styling-scss-modules",
    category: "web-styling",
    displayName: "scss-modules",
    description: "CSS Modules with SCSS",
    tags: ["css", "scss", "modules"],
  },
} as const;

export type TestSkillName = keyof typeof SKILL_FIXTURES;

export function getTestSkill(
  name: TestSkillName,
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  const config = SKILL_FIXTURES[name];
  const { id, category, ...defaults } = config;
  return createMockSkill(id, category, { ...defaults, ...overrides });
}

// ---------------------------------------------------------------------------
// Shared base skill fixtures — canonical defaults with no overrides.
// Use spread for per-test customization: `{ ...TEST_SKILLS.react, displayName: "react" }`
// ---------------------------------------------------------------------------

export const TEST_SKILLS = {
  react: createMockSkill("web-framework-react", "web-framework"),
  vue: createMockSkill("web-framework-vue", "web-framework"),
  zustand: createMockSkill("web-state-zustand", "web-client-state", {
    compatibleWith: ["web-framework-react"],
  }),
  pinia: createMockSkill("web-state-pinia", "web-client-state", {
    compatibleWith: ["web-framework-vue"],
  }),
  hono: createMockSkill("api-framework-hono", "api-api"),
  vitest: createMockSkill("web-testing-vitest", "web-testing"),
  scssModules: createMockSkill("web-styling-scss-modules", "web-styling"),
  drizzle: createMockSkill("api-database-drizzle", "api-database"),
  // Methodology skills (DEFAULT_PRESELECTED_SKILLS) — used by createComprehensiveMatrix
  investigationRequirements: createMockSkill(
    "meta-methodology-investigation-requirements",
    "shared-methodology",
    { description: "Never speculate - read actual code first", categoryExclusive: false },
  ),
  antiOverEngineering: createMockSkill(
    "meta-methodology-anti-over-engineering",
    "shared-methodology",
    {
      description: "Surgical implementation, not architectural innovation",
      categoryExclusive: false,
    },
  ),
  successCriteria: createMockSkill("meta-methodology-success-criteria", "shared-methodology", {
    description: "Explicit, measurable criteria defining done",
    categoryExclusive: false,
  }),
  writeVerification: createMockSkill("meta-methodology-write-verification", "shared-methodology", {
    description: "Verify work was actually saved",
    categoryExclusive: false,
  }),
  improvementProtocol: createMockSkill(
    "meta-methodology-improvement-protocol",
    "shared-methodology",
    { description: "Evidence-based self-improvement", categoryExclusive: false },
  ),
  contextManagement: createMockSkill("meta-methodology-context-management", "shared-methodology", {
    description: "Maintain project continuity across sessions",
    categoryExclusive: false,
  }),
};

// ---------------------------------------------------------------------------
// Shared base category fixtures — canonical defaults with no overrides.
// Use spread for per-test customization: `{ ...TEST_CATEGORIES.framework, required: true }`
// ---------------------------------------------------------------------------

export const TEST_CATEGORIES = {
  framework: createMockCategory("web-framework", "Framework"),
  clientState: createMockCategory("web-client-state", "Client State"),
  styling: createMockCategory("web-styling", "Styling"),
  testing: createMockCategory("web-testing", "Testing"),
  api: createMockCategory("api-api", "Backend Framework"),
  database: createMockCategory("api-database", "Database"),
  methodology: createMockCategory("shared-methodology", "Methodology"),
  tooling: createMockCategory("shared-tooling", "Tooling"),
};

// ---------------------------------------------------------------------------
// Shared matrix fixtures — common skill combinations used across test files.
// Use createMockMatrix overrides for per-test customization:
//   `createMockMatrix(TEST_MATRICES.react.skills, { suggestedStacks: [...] })`
// ---------------------------------------------------------------------------

export const TEST_MATRICES: Record<string, MergedSkillsMatrix> = {
  empty: createMockMatrix({}),
  react: createMockMatrix({
    "web-framework-react": TEST_SKILLS.react,
  }),
  reactAndZustand: createMockMatrix({
    "web-framework-react": TEST_SKILLS.react,
    "web-state-zustand": TEST_SKILLS.zustand,
  }),
  reactAndHono: createMockMatrix({
    "web-framework-react": TEST_SKILLS.react,
    "api-framework-hono": TEST_SKILLS.hono,
  }),
  reactAndScss: createMockMatrix({
    "web-framework-react": TEST_SKILLS.react,
    "web-styling-scss-modules": TEST_SKILLS.scssModules,
  }),
  reactScssAndHono: createMockMatrix({
    "web-framework-react": TEST_SKILLS.react,
    "web-styling-scss-modules": TEST_SKILLS.scssModules,
    "api-framework-hono": TEST_SKILLS.hono,
  }),
  reactZustandAndHono: createMockMatrix({
    "web-framework-react": TEST_SKILLS.react,
    "web-state-zustand": TEST_SKILLS.zustand,
    "api-framework-hono": TEST_SKILLS.hono,
  }),
};
