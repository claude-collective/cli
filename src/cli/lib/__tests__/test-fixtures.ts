/**
 * Shared test fixtures for pre-built mock skills.
 *
 * Skill IDs and categories use literal strings that are type-checked
 * by the SkillId and CategoryPath union types at compile time.
 */
import type { ResolvedSkill } from "../../types";
import { createMockSkill } from "./helpers";

// =============================================================================
// Pre-built Mock Skills
// =============================================================================

export function createTestReactSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill("web-framework-react", "web/framework", {
    displayName: "react",

    description: "React framework for building user interfaces",
    tags: ["react", "web", "ui", "component"],
    ...overrides,
  });
}

export function createTestZustandSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill("web-state-zustand", "web/state", {
    displayName: "zustand",

    description: "Bear necessities state management",
    tags: ["state", "react", "zustand"],
    ...overrides,
  });
}

export function createTestHonoSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill("api-framework-hono", "api/framework", {
    displayName: "hono",

    description: "Lightweight web framework for the edge",
    tags: ["api", "api", "edge", "serverless"],
    ...overrides,
  });
}

export function createTestVitestSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill("web-testing-vitest", "testing", {
    displayName: "vitest",

    description: "Next generation testing framework",
    tags: ["testing", "vitest", "unit"],
    ...overrides,
  });
}

export function createTestVueSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill("web-framework-vue", "web/framework", {
    displayName: "vue",

    description: "Progressive JavaScript framework",
    tags: ["vue", "web", "reactive"],
    ...overrides,
  });
}

export function createTestAuthPatternsSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill("api-security-auth-patterns", "api/security", {
    description: "Authentication and authorization patterns",
    tags: ["auth", "security", "jwt", "oauth"],
    ...overrides,
  });
}

export function createTestDrizzleSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill("api-database-drizzle", "api/database", {
    displayName: "drizzle",

    description: "TypeScript ORM for SQL databases",
    tags: ["database", "orm", "sql"],
    ...overrides,
  });
}

// =============================================================================
// Methodology Skills (Preselected by Default)
// =============================================================================

/**
 * Creates one methodology skill for testing preselection behavior.
 * Use createMockMatrixWithMethodology() helper which includes this automatically.
 */
export function createTestMethodologySkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill("meta-methodology-anti-over-engineering", "meta/methodology", {
    description: "Surgical implementation, not architectural innovation",
    tags: ["methodology", "foundational"],
    ...overrides,
  });
}

export function createTestScssModulesSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill("web-styling-scss-modules", "web/styling", {
    displayName: "scss-modules",
    description: "CSS Modules with SCSS",
    tags: ["css", "scss", "modules"],
    ...overrides,
  });
}
