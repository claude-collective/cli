import type { MergedSkillsMatrix, ResolvedSkill, SkillSlug } from "../../types";
import { createMockSkill, createMockCategory, createMockMatrix } from "./helpers";

const SKILL_FIXTURES = {
  react: createMockSkill("web-framework-react", {
    description: "React framework for building user interfaces",
    tags: ["react", "web", "ui", "component"],
  }),
  zustand: createMockSkill("web-state-zustand", {
    description: "Bear necessities state management",
    tags: ["state", "react", "zustand"],
  }),
  hono: createMockSkill("api-framework-hono", {
    description: "Lightweight web framework for the edge",
    tags: ["api", "api", "edge", "serverless"],
  }),
  vitest: createMockSkill("web-testing-vitest", {
    description: "Next generation testing framework",
    tags: ["testing", "vitest", "unit"],
  }),
  vue: createMockSkill("web-framework-vue", {
    description: "Progressive JavaScript framework",
    tags: ["vue", "web", "reactive"],
  }),
  "auth-patterns": createMockSkill("api-security-auth-patterns", {
    description: "Authentication and authorization patterns",
    tags: ["auth", "security", "jwt", "oauth"],
  }),
  drizzle: createMockSkill("api-database-drizzle", {
    description: "TypeScript ORM for SQL databases",
    tags: ["database", "orm", "sql"],
  }),
  "anti-over-engineering": createMockSkill(
    "meta-methodology-anti-over-engineering",
    {
      description: "Surgical implementation, not architectural innovation",
      tags: ["methodology", "foundational"],
    },
  ),
  "scss-modules": createMockSkill("web-styling-scss-modules", {
    description: "CSS Modules with SCSS",
    tags: ["css", "scss", "modules"],
  }),
} satisfies Partial<Record<SkillSlug, ResolvedSkill>>;

export type TestSkillName = keyof typeof SKILL_FIXTURES;

export function getTestSkill(
  name: TestSkillName,
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return { ...SKILL_FIXTURES[name], ...overrides };
}

// ---------------------------------------------------------------------------
// Shared base skill fixtures — canonical defaults with no overrides.
// Use spread for per-test customization: `{ ...TEST_SKILLS.react, slug: "react" }`
// ---------------------------------------------------------------------------

export const TEST_SKILLS = {
  react: createMockSkill("web-framework-react"),
  vue: createMockSkill("web-framework-vue"),
  zustand: createMockSkill("web-state-zustand", {
    compatibleWith: ["web-framework-react"],
  }),
  pinia: createMockSkill("web-state-pinia", {
    compatibleWith: ["web-framework-vue"],
  }),
  hono: createMockSkill("api-framework-hono"),
  vitest: createMockSkill("web-testing-vitest"),
  "scss-modules": createMockSkill("web-styling-scss-modules"),
  drizzle: createMockSkill("api-database-drizzle"),
  // Methodology skills (DEFAULT_PRESELECTED_SKILLS) — used by createComprehensiveMatrix
  "investigation-requirements": createMockSkill(
    "meta-methodology-investigation-requirements",
    { description: "Never speculate - read actual code first" },
  ),
  "anti-over-engineering": createMockSkill(
    "meta-methodology-anti-over-engineering",
    {
      description: "Surgical implementation, not architectural innovation",
    },
  ),
  "success-criteria": createMockSkill("meta-methodology-success-criteria", {
    description: "Explicit, measurable criteria defining done",
  }),
  "write-verification": createMockSkill(
    "meta-methodology-write-verification",
    {
      description: "Verify work was actually saved",
    },
  ),
  "improvement-protocol": createMockSkill(
    "meta-methodology-improvement-protocol",
    { description: "Evidence-based self-improvement" },
  ),
  "context-management": createMockSkill(
    "meta-methodology-context-management",
    {
      description: "Maintain project continuity across sessions",
    },
  ),
} satisfies Partial<Record<SkillSlug, ResolvedSkill>>;

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
    "web-styling-scss-modules": TEST_SKILLS["scss-modules"],
  }),
  reactScssAndHono: createMockMatrix({
    "web-framework-react": TEST_SKILLS.react,
    "web-styling-scss-modules": TEST_SKILLS["scss-modules"],
    "api-framework-hono": TEST_SKILLS.hono,
  }),
  reactZustandAndHono: createMockMatrix({
    "web-framework-react": TEST_SKILLS.react,
    "web-state-zustand": TEST_SKILLS.zustand,
    "api-framework-hono": TEST_SKILLS.hono,
  }),
};
