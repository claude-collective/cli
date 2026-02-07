/**
 * Shared test fixtures for consistent skill IDs across all tests.
 * Import these constants instead of hardcoding skill IDs.
 *
 * Note: Skill IDs are in normalized kebab-case format (no author suffix, slashes replaced with dashes).
 */
import type { ResolvedSkill } from "../../types-matrix";
import { createMockSkill } from "./helpers";

// =============================================================================
// Primary Test Skills - Use these everywhere (normalized format)
// =============================================================================

export const TEST_SKILLS = {
  REACT: "web-framework-react",
  ZUSTAND: "web-state-zustand",
  HONO: "api-framework-hono",
  VITEST: "web-testing-vitest",
  VUE: "web-framework-vue",
  DRIZZLE: "api-database-drizzle",
  SCSS_MODULES: "web-styling-scss-modules",
  BETTER_AUTH: "api-auth-better-auth-drizzle-hono",
  AUTH_PATTERNS: "api-security-auth-patterns",
  // One methodology skill for testing preselection (matches first in DEFAULT_PRESELECTED_SKILLS)
  ANTI_OVER_ENGINEERING: "meta-methodology-anti-over-engineering",
} as const;

export const TEST_AUTHOR = "@vince";

// =============================================================================
// Placeholder Skills for Generic Tests (normalized format)
// =============================================================================

export const PLACEHOLDER_SKILLS = {
  SKILL_A: "test-skill-a",
  SKILL_B: "test-skill-b",
  SKILL_C: "test-skill-c",
} as const;

// =============================================================================
// Category Constants
// =============================================================================

export const TEST_CATEGORIES = {
  FRAMEWORK: "web/framework",
  STATE: "web/state",
  STYLING: "web/styling",
  API: "api/api",
  BACKEND_FRAMEWORK: "api/framework",
  DATABASE: "api/database",
  TESTING: "testing",
  SECURITY: "api/security",
  METHODOLOGY: "meta/methodology",
} as const;

// =============================================================================
// Pre-built Mock Skills
// =============================================================================

export function createTestReactSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.REACT, TEST_CATEGORIES.FRAMEWORK, {
    alias: "react",
    name: "React",
    description: "React framework for building user interfaces",
    tags: ["react", "web", "ui", "component"],
    ...overrides,
  });
}

export function createTestZustandSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.ZUSTAND, TEST_CATEGORIES.STATE, {
    alias: "zustand",
    name: "Zustand",
    description: "Bear necessities state management",
    tags: ["state", "react", "zustand"],
    ...overrides,
  });
}

export function createTestHonoSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.HONO, TEST_CATEGORIES.BACKEND_FRAMEWORK, {
    alias: "hono",
    name: "Hono",
    description: "Lightweight web framework for the edge",
    tags: ["api", "api", "edge", "serverless"],
    ...overrides,
  });
}

export function createTestVitestSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.VITEST, TEST_CATEGORIES.TESTING, {
    alias: "vitest",
    name: "Vitest",
    description: "Next generation testing framework",
    tags: ["testing", "vitest", "unit"],
    ...overrides,
  });
}

export function createTestVueSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.VUE, TEST_CATEGORIES.FRAMEWORK, {
    alias: "vue",
    name: "Vue",
    description: "Progressive JavaScript framework",
    tags: ["vue", "web", "reactive"],
    ...overrides,
  });
}

export function createTestAuthPatternsSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.AUTH_PATTERNS, TEST_CATEGORIES.SECURITY, {
    alias: "auth",
    name: "Auth Patterns",
    description: "Authentication and authorization patterns",
    tags: ["auth", "security", "jwt", "oauth"],
    ...overrides,
  });
}

export function createTestDrizzleSkill(overrides?: Partial<ResolvedSkill>): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.DRIZZLE, TEST_CATEGORIES.DATABASE, {
    alias: "drizzle",
    name: "Drizzle",
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
  return createMockSkill(TEST_SKILLS.ANTI_OVER_ENGINEERING, TEST_CATEGORIES.METHODOLOGY, {
    name: "Anti-Over-Engineering",
    description: "Surgical implementation, not architectural innovation",
    tags: ["methodology", "foundational"],
    ...overrides,
  });
}
