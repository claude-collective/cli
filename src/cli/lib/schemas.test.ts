import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  brandingConfigSchema,
  projectConfigLoaderSchema,
  projectSourceConfigSchema,
  validateNestingDepth,
  warnUnknownFields,
} from "./schemas";

vi.mock("../utils/logger", () => ({
  warn: vi.fn(),
}));

import { warn } from "../utils/logger";

describe("schema utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateNestingDepth", () => {
    it("should accept flat objects", () => {
      expect(validateNestingDepth({ a: 1, b: "hello" }, 10)).toBe(true);
    });

    it("should accept flat arrays", () => {
      expect(validateNestingDepth([1, 2, 3], 10)).toBe(true);
    });

    it("should accept primitives", () => {
      expect(validateNestingDepth("hello", 10)).toBe(true);
      expect(validateNestingDepth(42, 10)).toBe(true);
      expect(validateNestingDepth(null, 10)).toBe(true);
      expect(validateNestingDepth(true, 10)).toBe(true);
    });

    it("should accept nested objects within depth limit", () => {
      const nested = { a: { b: { c: "value" } } };
      expect(validateNestingDepth(nested, 5)).toBe(true);
    });

    it("should reject objects exceeding depth limit", () => {
      const deeplyNested = { a: { b: { c: { d: { e: "too deep" } } } } };
      expect(validateNestingDepth(deeplyNested, 3)).toBe(false);
    });

    it("should handle depth limit of 0", () => {
      // At depth 0, only primitives should pass
      expect(validateNestingDepth("hello", 0)).toBe(true);
      expect(validateNestingDepth({ a: 1 }, 0)).toBe(false);
    });

    it("should handle depth limit of 1 for flat objects", () => {
      expect(validateNestingDepth({ a: 1, b: 2 }, 1)).toBe(true);
      expect(validateNestingDepth({ a: { b: 1 } }, 1)).toBe(false);
    });

    it("should check arrays within objects", () => {
      const value = { plugins: [{ name: "a" }, { name: "b" }] };
      expect(validateNestingDepth(value, 3)).toBe(true);
      expect(validateNestingDepth(value, 1)).toBe(false);
    });

    it("should handle deeply nested arrays", () => {
      const deep = [[[["too deep"]]]];
      expect(validateNestingDepth(deep, 2)).toBe(false);
      expect(validateNestingDepth(deep, 5)).toBe(true);
    });

    it("should handle realistic marketplace.json structure", () => {
      const marketplace = {
        name: "test-marketplace",
        version: "1.0.0",
        owner: { name: "test", email: "test@example.com" },
        plugins: [
          {
            name: "plugin-a",
            source: "./plugins/a",
            author: { name: "@author" },
            keywords: ["web", "react"],
          },
        ],
      };
      // This is about 4 levels deep, should pass with limit of 10
      expect(validateNestingDepth(marketplace, 10)).toBe(true);
    });

    it("should reject maliciously deeply nested JSON", () => {
      // Build a 15-level deep structure
      let deep: unknown = "payload";
      for (let i = 0; i < 15; i++) {
        deep = { nested: deep };
      }
      expect(validateNestingDepth(deep, 10)).toBe(false);
    });
  });

  describe("warnUnknownFields", () => {
    it("should not warn when all fields are expected", () => {
      warnUnknownFields({ name: "test", version: "1.0" }, ["name", "version"], "test.json");

      expect(warn).not.toHaveBeenCalled();
    });

    it("should warn about unknown fields", () => {
      warnUnknownFields(
        { name: "test", malicious: "data", extra: 42 },
        ["name", "version"],
        "test.json",
      );

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Unknown fields in test.json: malicious, extra"),
      );
    });

    it("should not warn for empty objects", () => {
      warnUnknownFields({}, ["name"], "test.json");

      expect(warn).not.toHaveBeenCalled();
    });

    it("should handle no expected keys", () => {
      warnUnknownFields({ a: 1 }, [], "test.json");

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("a"));
    });

    it("should include context in warning message", () => {
      warnUnknownFields({ unknown: true }, ["name"], "marketplace.json");

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("marketplace.json"));
    });
  });
});

describe("projectConfigLoaderSchema", () => {
  describe("stack field with mixed skill assignment formats", () => {
    it("should accept bare string skill IDs (format 1)", () => {
      const config = {
        name: "test-project",
        agents: ["web-developer"],
        stack: {
          "web-developer": {
            framework: "web-framework-react",
            styling: "web-styling-scss-modules",
          },
        },
      };

      const result = projectConfigLoaderSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should accept array of objects with preloaded (format 2)", () => {
      const config = {
        name: "test-project",
        agents: ["web-developer"],
        stack: {
          "web-developer": {
            methodology: [
              { id: "meta-methodology-investigation-requirements", preloaded: true },
              { id: "meta-methodology-anti-over-engineering", preloaded: true },
            ],
          },
        },
      };

      const result = projectConfigLoaderSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should accept single object with preloaded (format 3)", () => {
      const config = {
        name: "test-project",
        agents: ["web-developer"],
        stack: {
          "web-developer": {
            framework: { id: "web-framework-react", preloaded: true },
          },
        },
      };

      const result = projectConfigLoaderSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should accept mixed formats within the same agent config", () => {
      const config = {
        name: "test-project",
        agents: ["web-developer"],
        stack: {
          "web-developer": {
            // Format 1: bare string
            framework: "web-framework-react",
            // Format 2: array of objects
            methodology: [
              { id: "meta-methodology-investigation-requirements", preloaded: true },
              { id: "meta-methodology-anti-over-engineering", preloaded: true },
            ],
            // Format 3: single object
            styling: { id: "web-styling-scss-modules", preloaded: true },
          },
        },
      };

      const result = projectConfigLoaderSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should accept mixed formats across multiple agents", () => {
      const config = {
        name: "test-project",
        agents: ["web-developer", "api-developer"],
        stack: {
          "web-developer": {
            framework: "web-framework-react",
          },
          "api-developer": {
            api: { id: "api-framework-hono", preloaded: true },
            database: [{ id: "api-database-drizzle" }],
          },
        },
      };

      const result = projectConfigLoaderSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should reject invalid skill ID format in stack", () => {
      const config = {
        name: "test-project",
        agents: ["web-developer"],
        stack: {
          "web-developer": {
            framework: "invalid", // Not a valid SkillId (needs 3+ segments)
          },
        },
      };

      const result = projectConfigLoaderSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should accept stack with no agents", () => {
      const config = {
        name: "test-project",
        agents: ["web-developer"],
        stack: {},
      };

      const result = projectConfigLoaderSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should accept config without stack field", () => {
      const config = {
        name: "test-project",
        agents: ["web-developer"],
        skills: ["web-framework-react"],
      };

      const result = projectConfigLoaderSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should accept array with mixed string and object elements", () => {
      const config = {
        name: "test-project",
        agents: ["web-developer"],
        stack: {
          "web-developer": {
            methodology: [
              "meta-methodology-investigation-requirements",
              { id: "meta-methodology-anti-over-engineering", preloaded: true },
            ],
          },
        },
      };

      const result = projectConfigLoaderSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});

describe("brandingConfigSchema", () => {
  it("should accept full branding config", () => {
    const result = brandingConfigSchema.safeParse({
      name: "Acme Dev Tools",
      tagline: "Build faster with Acme",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: "Acme Dev Tools",
      tagline: "Build faster with Acme",
    });
  });

  it("should accept partial branding (name only)", () => {
    const result = brandingConfigSchema.safeParse({ name: "My Company" });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("My Company");
    expect(result.data?.tagline).toBeUndefined();
  });

  it("should accept partial branding (tagline only)", () => {
    const result = brandingConfigSchema.safeParse({ tagline: "Custom tagline" });
    expect(result.success).toBe(true);
    expect(result.data?.tagline).toBe("Custom tagline");
  });

  it("should accept empty branding object", () => {
    const result = brandingConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should reject non-string name", () => {
    const result = brandingConfigSchema.safeParse({ name: 123 });
    expect(result.success).toBe(false);
  });

  it("should reject non-string tagline", () => {
    const result = brandingConfigSchema.safeParse({ tagline: true });
    expect(result.success).toBe(false);
  });
});

describe("projectSourceConfigSchema with branding", () => {
  it("should accept config with branding", () => {
    const result = projectSourceConfigSchema.safeParse({
      source: "github:myorg/skills",
      branding: {
        name: "Acme Dev Tools",
        tagline: "Build faster with Acme",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should accept config without branding", () => {
    const result = projectSourceConfigSchema.safeParse({
      source: "github:myorg/skills",
    });
    expect(result.success).toBe(true);
  });
});
