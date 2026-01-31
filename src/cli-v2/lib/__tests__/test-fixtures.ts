/**
 * Shared test fixtures for consistent skill IDs across all tests.
 * Import these constants instead of hardcoding skill IDs.
 */
import type { ResolvedSkill } from "../../types-matrix";
import { createMockSkill } from "./helpers";

// =============================================================================
// Primary Test Skills - Use these everywhere
// =============================================================================

export const TEST_SKILLS = {
  REACT: "react (@vince)",
  ZUSTAND: "zustand (@vince)",
  HONO: "hono (@vince)",
  VITEST: "vitest (@vince)",
  VUE: "vue (@vince)",
  DRIZZLE: "drizzle (@vince)",
  SCSS_MODULES: "scss-modules (@vince)",
  BETTER_AUTH: "better-auth+drizzle+hono (@vince)",
  AUTH_PATTERNS: "auth-patterns (@vince)",
} as const;

export const TEST_AUTHOR = "@vince";

// =============================================================================
// Placeholder Skills for Generic Tests
// =============================================================================

export const PLACEHOLDER_SKILLS = {
  SKILL_A: "skill-a (@vince)",
  SKILL_B: "skill-b (@vince)",
  SKILL_C: "skill-c (@vince)",
} as const;

// =============================================================================
// Category Constants
// =============================================================================

export const TEST_CATEGORIES = {
  FRAMEWORK: "frontend/framework",
  STATE: "frontend/state",
  STYLING: "frontend/styling",
  API: "backend/api",
  BACKEND_FRAMEWORK: "backend/framework",
  DATABASE: "backend/database",
  TESTING: "testing",
  SECURITY: "backend/security",
} as const;

// =============================================================================
// Pre-built Mock Skills
// =============================================================================

export function createTestReactSkill(
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.REACT, TEST_CATEGORIES.FRAMEWORK, {
    alias: "react",
    name: "React",
    description: "React framework for building user interfaces",
    tags: ["react", "frontend", "ui", "component"],
    ...overrides,
  });
}

export function createTestZustandSkill(
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.ZUSTAND, TEST_CATEGORIES.STATE, {
    alias: "zustand",
    name: "Zustand",
    description: "Bear necessities state management",
    tags: ["state", "react", "zustand"],
    ...overrides,
  });
}

export function createTestHonoSkill(
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.HONO, TEST_CATEGORIES.BACKEND_FRAMEWORK, {
    alias: "hono",
    name: "Hono",
    description: "Lightweight web framework for the edge",
    tags: ["backend", "api", "edge", "serverless"],
    ...overrides,
  });
}

export function createTestVitestSkill(
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.VITEST, TEST_CATEGORIES.TESTING, {
    alias: "vitest",
    name: "Vitest",
    description: "Next generation testing framework",
    tags: ["testing", "vitest", "unit"],
    ...overrides,
  });
}

export function createTestVueSkill(
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.VUE, TEST_CATEGORIES.FRAMEWORK, {
    alias: "vue",
    name: "Vue",
    description: "Progressive JavaScript framework",
    tags: ["vue", "frontend", "reactive"],
    ...overrides,
  });
}

export function createTestAuthPatternsSkill(
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.AUTH_PATTERNS, TEST_CATEGORIES.SECURITY, {
    alias: "auth",
    name: "Auth Patterns",
    description: "Authentication and authorization patterns",
    tags: ["auth", "security", "jwt", "oauth"],
    ...overrides,
  });
}

export function createTestDrizzleSkill(
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return createMockSkill(TEST_SKILLS.DRIZZLE, TEST_CATEGORIES.DATABASE, {
    alias: "drizzle",
    name: "Drizzle",
    description: "TypeScript ORM for SQL databases",
    tags: ["database", "orm", "sql"],
    ...overrides,
  });
}
