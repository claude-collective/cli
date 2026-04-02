import { describe, it, expect, beforeEach } from "vitest";
import { initializeMatrix } from "../../lib/matrix/matrix-provider";
import {
  createMockMatrix,
  createMockResolvedStack,
  createMockCategory,
} from "../../lib/__tests__/helpers";
import { SKILLS } from "../../lib/__tests__/test-fixtures";
import type { Category, CategoryDefinition, Domain, ResolvedStack } from "../../types";
import { getDomainDisplayName, orderDomains, getDomainsFromStack, getStackName } from "./utils";

describe("getDomainDisplayName", () => {
  it("should return display name for known domains", () => {
    expect(getDomainDisplayName("web")).toBe("Web");
    expect(getDomainDisplayName("api")).toBe("API");
    expect(getDomainDisplayName("cli")).toBe("CLI");
    expect(getDomainDisplayName("mobile")).toBe("Mobile");
    expect(getDomainDisplayName("shared")).toBe("Shared");
  });

  it("should capitalize first letter for unknown domains", () => {
    expect(getDomainDisplayName("custom")).toBe("Custom");
    expect(getDomainDisplayName("acme")).toBe("Acme");
  });
});

describe("orderDomains", () => {
  it("should order built-in domains per BUILT_IN_DOMAIN_ORDER", () => {
    const result = orderDomains(["shared", "web", "cli", "api", "mobile"]);
    expect(result).toStrictEqual(["web", "api", "mobile", "cli", "shared"]);
  });

  it("should place custom domains first (alphabetically), then built-in", () => {
    const result = orderDomains(["web", "zebra" as Domain, "acme" as Domain, "api"]);
    expect(result).toStrictEqual(["acme", "zebra", "web", "api"]);
  });

  it("should handle empty array", () => {
    expect(orderDomains([])).toStrictEqual([]);
  });

  it("should handle single domain", () => {
    expect(orderDomains(["api"])).toStrictEqual(["api"]);
  });
});

describe("getDomainsFromStack", () => {
  beforeEach(() => {
    const categories = {
      "web-framework": createMockCategory("web-framework", "Framework", { domain: "web" }),
      "api-api": createMockCategory("api-api", "API", { domain: "api" }),
    } as Record<Category, CategoryDefinition>;

    initializeMatrix(
      createMockMatrix(SKILLS.react, SKILLS.hono, {
        categories,
      }),
    );
  });

  it("should extract unique domains from a stack", () => {
    const stack: ResolvedStack = createMockResolvedStack("test-stack", "Test Stack", {
      skills: {
        "web-developer": {
          "web-framework": ["web-framework-react"],
        },
        "api-developer": {
          "api-api": ["api-framework-hono"],
        },
      } as ResolvedStack["skills"],
      allSkillIds: ["web-framework-react", "api-framework-hono"],
    });

    const result = getDomainsFromStack(stack);
    expect(result).toStrictEqual(["api", "web"]);
  });

  it("should return empty array for stack with no matching categories", () => {
    const stack: ResolvedStack = createMockResolvedStack("empty-stack", "Empty Stack", {
      skills: {},
      allSkillIds: [],
    });

    expect(getDomainsFromStack(stack)).toStrictEqual([]);
  });
});

describe("getStackName", () => {
  beforeEach(() => {
    initializeMatrix(
      createMockMatrix(SKILLS.react, {
        suggestedStacks: [createMockResolvedStack("nextjs-fullstack", "Next.js Full-Stack")],
      }),
    );
  });

  it("should return stack name for a valid stack ID", () => {
    expect(getStackName("nextjs-fullstack")).toBe("Next.js Full-Stack");
  });

  it("should return undefined for unknown stack ID", () => {
    expect(getStackName("nonexistent")).toBeUndefined();
  });

  it("should return undefined for null input", () => {
    expect(getStackName(null)).toBeUndefined();
  });
});
