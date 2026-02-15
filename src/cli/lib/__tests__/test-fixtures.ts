import type { CategoryPath, ResolvedSkill, SkillDisplayName, SkillId } from "../../types";
import { createMockSkill } from "./helpers";

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
    category: "web/framework",
    displayName: "react",
    description: "React framework for building user interfaces",
    tags: ["react", "web", "ui", "component"],
  },
  zustand: {
    id: "web-state-zustand",
    category: "web/state",
    displayName: "zustand",
    description: "Bear necessities state management",
    tags: ["state", "react", "zustand"],
  },
  hono: {
    id: "api-framework-hono",
    category: "api/framework",
    displayName: "hono",
    description: "Lightweight web framework for the edge",
    tags: ["api", "api", "edge", "serverless"],
  },
  vitest: {
    id: "web-testing-vitest",
    category: "testing",
    displayName: "vitest",
    description: "Next generation testing framework",
    tags: ["testing", "vitest", "unit"],
  },
  vue: {
    id: "web-framework-vue",
    category: "web/framework",
    displayName: "vue",
    description: "Progressive JavaScript framework",
    tags: ["vue", "web", "reactive"],
  },
  "auth-patterns": {
    id: "api-security-auth-patterns",
    category: "api/security",
    description: "Authentication and authorization patterns",
    tags: ["auth", "security", "jwt", "oauth"],
  },
  drizzle: {
    id: "api-database-drizzle",
    category: "api/database",
    displayName: "drizzle",
    description: "TypeScript ORM for SQL databases",
    tags: ["database", "orm", "sql"],
  },
  methodology: {
    id: "meta-methodology-anti-over-engineering",
    category: "meta/methodology",
    description: "Surgical implementation, not architectural innovation",
    tags: ["methodology", "foundational"],
  },
  "scss-modules": {
    id: "web-styling-scss-modules",
    category: "web/styling",
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
