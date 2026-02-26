import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  agentYamlConfigSchema,
  brandingConfigSchema,
  categoryDefinitionSchema,
  categoryPathSchema,
  extendSchemasWithCustomValues,
  isValidSkillId,
  localRawMetadataSchema,
  metadataValidationSchema,
  projectConfigLoaderSchema,
  projectSourceConfigSchema,
  resetSchemaExtensions,
  skillAssignmentSchema,
  skillMetadataLoaderSchema,
  skillCategoriesFileSchema,
  SKILL_ID_PATTERN,
  stackAgentConfigSchema,
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
            "web-framework": "web-framework-react",
            "web-styling": "web-styling-scss-modules",
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
            "shared-methodology": [
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
            "web-framework": { id: "web-framework-react", preloaded: true },
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
            "web-framework": "web-framework-react",
            // Format 2: array of objects
            "shared-methodology": [
              { id: "meta-methodology-investigation-requirements", preloaded: true },
              { id: "meta-methodology-anti-over-engineering", preloaded: true },
            ],
            // Format 3: single object
            "web-styling": { id: "web-styling-scss-modules", preloaded: true },
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
            "web-framework": "web-framework-react",
          },
          "api-developer": {
            "api-api": { id: "api-framework-hono", preloaded: true },
            "api-database": [{ id: "api-database-drizzle" }],
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
            "web-framework": "invalid", // Not a valid SkillId (needs 3+ segments)
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
            "shared-methodology": [
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

describe("isValidSkillId", () => {
  afterEach(() => {
    resetSchemaExtensions();
  });

  it("should accept built-in skill IDs matching SKILL_ID_PATTERN", () => {
    expect(isValidSkillId("web-framework-react")).toBe(true);
    expect(isValidSkillId("api-database-drizzle")).toBe(true);
    expect(isValidSkillId("meta-methodology-anti-over-engineering")).toBe(true);
  });

  it("should reject non-built-in IDs when no custom extensions registered", () => {
    expect(isValidSkillId("acme-pipeline-deploy")).toBe(false);
    expect(isValidSkillId("deploy")).toBe(false);
    expect(isValidSkillId("acme-deploy")).toBe(false);
  });

  it("should accept custom skill IDs after extendSchemasWithCustomValues()", () => {
    extendSchemasWithCustomValues({ skillIds: ["acme-pipeline-deploy", "deploy"] });

    expect(isValidSkillId("acme-pipeline-deploy")).toBe(true);
    expect(isValidSkillId("deploy")).toBe(true);
  });

  it("should reject unregistered custom IDs even after extending with others", () => {
    extendSchemasWithCustomValues({ skillIds: ["acme-pipeline-deploy"] });

    expect(isValidSkillId("acme-other-skill")).toBe(false);
  });

  it("should reject IDs with uppercase characters", () => {
    expect(isValidSkillId("Acme-Deploy")).toBe(false);
    expect(isValidSkillId("Not-Valid-Id")).toBe(false);
  });

  it("should reject empty strings", () => {
    expect(isValidSkillId("")).toBe(false);
  });

  it("should still accept built-in IDs after extending with custom ones", () => {
    extendSchemasWithCustomValues({ skillIds: ["acme-pipeline-deploy"] });

    expect(isValidSkillId("web-framework-react")).toBe(true);
    expect(isValidSkillId("acme-pipeline-deploy")).toBe(true);
  });
});

describe("SKILL_ID_PATTERN", () => {
  it("should match valid built-in skill IDs with 3+ segments", () => {
    expect(SKILL_ID_PATTERN.test("web-framework-react")).toBe(true);
    expect(SKILL_ID_PATTERN.test("api-database-drizzle")).toBe(true);
    expect(SKILL_ID_PATTERN.test("meta-methodology-anti-over-engineering")).toBe(true);
  });

  it("should reject IDs without a valid prefix", () => {
    expect(SKILL_ID_PATTERN.test("acme-pipeline-deploy")).toBe(false);
    expect(SKILL_ID_PATTERN.test("custom-skill-name")).toBe(false);
  });

  it("should reject IDs with only 2 segments", () => {
    expect(SKILL_ID_PATTERN.test("web-framework")).toBe(false);
  });
});

describe("custom: true in schemas", () => {
  it("should accept custom: true in skillMetadataLoaderSchema", () => {
    const result = skillMetadataLoaderSchema.safeParse({
      category: "web-framework",
      custom: true,
    });
    expect(result.success).toBe(true);
    expect(result.data?.custom).toBe(true);
  });

  it("should accept metadata without custom field", () => {
    const result = skillMetadataLoaderSchema.safeParse({
      category: "web-framework",
    });
    expect(result.success).toBe(true);
    expect(result.data?.custom).toBeUndefined();
  });

  it("should accept custom: true in agentYamlConfigSchema", () => {
    const result = agentYamlConfigSchema.safeParse({
      id: "web-developer",
      title: "Web Developer",
      description: "Builds web UIs",
      tools: ["Read", "Write"],
      custom: true,
    });
    expect(result.success).toBe(true);
  });

  it("should accept custom: true in metadataValidationSchema", () => {
    const result = metadataValidationSchema.safeParse({
      category: "web-framework",
      categoryExclusive: true,
      author: "@acme",
      cliName: "My Custom Skill",
      cliDescription: "A custom skill for deployment",
      usageGuidance: "Use when deploying services to staging or production.",
      custom: true,
    });
    expect(result.success).toBe(true);
  });

  it("should accept custom: true in categoryDefinitionSchema", () => {
    const result = categoryDefinitionSchema.safeParse({
      id: "web-framework",
      displayName: "Framework",
      description: "Web frameworks",
      domain: "web",
      exclusive: true,
      required: false,
      order: 1,
      custom: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("category validation with custom: true bypass", () => {
  describe("skillMetadataLoaderSchema", () => {
    it("should reject non-custom skill with invalid category", () => {
      const result = skillMetadataLoaderSchema.safeParse({
        category: "foo-bar",
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-custom skill with custom: false and invalid category", () => {
      const result = skillMetadataLoaderSchema.safeParse({
        category: "acme-core",
        custom: false,
      });
      expect(result.success).toBe(false);
    });

    it("should accept custom: true with kebab-case category", () => {
      const result = skillMetadataLoaderSchema.safeParse({
        category: "acme-core",
        custom: true,
      });
      expect(result.success).toBe(true);
    });

    it("should reject custom: true with non-kebab-case category", () => {
      const result = skillMetadataLoaderSchema.safeParse({
        category: "NOT KEBAB",
        custom: true,
      });
      expect(result.success).toBe(false);
    });

    it("should reject custom: true with uppercase category", () => {
      const result = skillMetadataLoaderSchema.safeParse({
        category: "Acme-Core",
        custom: true,
      });
      expect(result.success).toBe(false);
    });

    it("should accept non-custom skill with valid built-in category", () => {
      const result = skillMetadataLoaderSchema.safeParse({
        category: "web-framework",
      });
      expect(result.success).toBe(true);
    });

    it("should accept metadata without category field", () => {
      const result = skillMetadataLoaderSchema.safeParse({
        author: "@test",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("localRawMetadataSchema", () => {
    it("should reject non-custom skill with invalid category", () => {
      const result = localRawMetadataSchema.safeParse({
        category: "foo-bar",
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-custom skill with custom: false and invalid category", () => {
      const result = localRawMetadataSchema.safeParse({
        category: "acme-core",
        custom: false,
      });
      expect(result.success).toBe(false);
    });

    it("should accept custom: true with kebab-case category", () => {
      const result = localRawMetadataSchema.safeParse({
        category: "acme-core",
        custom: true,
      });
      expect(result.success).toBe(true);
    });

    it("should reject custom: true with non-kebab-case category", () => {
      const result = localRawMetadataSchema.safeParse({
        category: "NOT KEBAB",
        custom: true,
      });
      expect(result.success).toBe(false);
    });

    it("should reject custom: true with uppercase category", () => {
      const result = localRawMetadataSchema.safeParse({
        category: "Acme-Core",
        custom: true,
      });
      expect(result.success).toBe(false);
    });

    it("should accept non-custom skill with valid built-in category", () => {
      const result = localRawMetadataSchema.safeParse({
        category: "web-framework",
      });
      expect(result.success).toBe(true);
    });

    it("should accept metadata without category field", () => {
      const result = localRawMetadataSchema.safeParse({
        cliName: "my-skill",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("skillCategoriesFileSchema with pre-scan + extend + strict-load", () => {
  afterEach(() => {
    resetSchemaExtensions();
  });

  it("should accept custom category keys after extending schemas", () => {
    extendSchemasWithCustomValues({ categories: ["acme-pipeline"], domains: ["acme"] });

    const result = skillCategoriesFileSchema.safeParse({
      version: "1.0.0",
      categories: {
        "acme-pipeline": {
          id: "acme-pipeline",
          displayName: "CI/CD Pipeline",
          description: "Deployment pipeline skills",
          domain: "acme",
          exclusive: false,
          required: false,
          order: 1,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("should accept custom domain values after extending schemas", () => {
    extendSchemasWithCustomValues({ categories: ["acme-ml"], domains: ["acme"] });

    const result = skillCategoriesFileSchema.safeParse({
      version: "1.0.0",
      categories: {
        "acme-ml": {
          id: "acme-ml",
          displayName: "ML Tooling",
          description: "Machine learning workflow skills",
          domain: "acme",
          exclusive: true,
          required: false,
          order: 2,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("should accept built-in category keys without extending", () => {
    const result = skillCategoriesFileSchema.safeParse({
      version: "1.0.0",
      categories: {
        "web-framework": {
          id: "web-framework",
          displayName: "Framework",
          description: "Web frameworks",
          exclusive: true,
          required: true,
          order: 1,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("should accept custom: true on category definitions", () => {
    extendSchemasWithCustomValues({ categories: ["acme-pipeline"], domains: ["acme"] });

    const result = skillCategoriesFileSchema.safeParse({
      version: "1.0.0",
      categories: {
        "acme-pipeline": {
          id: "acme-pipeline",
          displayName: "CI/CD Pipeline",
          description: "Deployment pipeline skills",
          domain: "acme",
          exclusive: false,
          required: false,
          order: 1,
          custom: true,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing version", () => {
    const result = skillCategoriesFileSchema.safeParse({
      categories: {},
    });
    expect(result.success).toBe(false);
  });

  it("should reject custom categories without extending schemas first", () => {
    const result = skillCategoriesFileSchema.safeParse({
      version: "1.0.0",
      categories: {
        "acme-pipeline": {
          id: "acme-pipeline",
          displayName: "CI/CD Pipeline",
          description: "Deployment pipeline skills",
          domain: "acme",
          exclusive: false,
          required: false,
          order: 1,
        },
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("dynamic schema extension", () => {
  afterEach(() => {
    resetSchemaExtensions();
  });

  describe("extendSchemasWithCustomValues", () => {
    it("should make custom categories pass categoryPathSchema", () => {
      // Before extension, custom category fails
      const beforeResult = categoryPathSchema.safeParse("acme-pipeline");
      expect(beforeResult.success).toBe(false);

      // Extend with custom category
      extendSchemasWithCustomValues({ categories: ["acme-pipeline"] });

      // After extension, custom category passes
      const afterResult = categoryPathSchema.safeParse("acme-pipeline");
      expect(afterResult.success).toBe(true);
    });

    it("should make custom categories pass stackAgentConfigSchema", () => {
      extendSchemasWithCustomValues({ categories: ["acme-pipeline"] });

      const result = stackAgentConfigSchema.safeParse({
        "acme-pipeline": "web-framework-react",
      });
      expect(result.success).toBe(true);
    });

    it("should make custom categories pass metadataValidationSchema", () => {
      extendSchemasWithCustomValues({ categories: ["acme-pipeline"] });

      const result = metadataValidationSchema.safeParse({
        category: "acme-pipeline",
        author: "@acme",
        cliName: "Deploy Pipeline",
        cliDescription: "Kubernetes deployment automation",
        usageGuidance: "Use when deploying services to staging or production.",
        custom: true,
      });
      expect(result.success).toBe(true);
    });

    it("should make custom agent names pass agentYamlConfigSchema", () => {
      extendSchemasWithCustomValues({ agentNames: ["acme-deployer"] });

      const result = agentYamlConfigSchema.safeParse({
        id: "acme-deployer",
        title: "Acme Deployer",
        description: "Handles Kubernetes deployments",
        tools: ["Bash", "Read", "Write"],
        custom: true,
      });
      expect(result.success).toBe(true);
    });

    it("should make custom skill IDs pass skillAssignmentSchema", () => {
      extendSchemasWithCustomValues({ skillIds: ["acme-pipeline-deploy"] });

      const result = skillAssignmentSchema.safeParse({
        id: "acme-pipeline-deploy",
        preloaded: false,
      });
      expect(result.success).toBe(true);
    });

    it("should make custom skill IDs pass projectConfigLoaderSchema skills array", () => {
      extendSchemasWithCustomValues({ skillIds: ["acme-pipeline-deploy"] });

      const result = projectConfigLoaderSchema.safeParse({
        name: "test-project",
        agents: ["web-developer"],
        skills: ["web-framework-react", "acme-pipeline-deploy"],
      });
      expect(result.success).toBe(true);
    });

    it("should make custom domains pass projectConfigLoaderSchema domains array", () => {
      extendSchemasWithCustomValues({ domains: ["acme"] });

      const result = projectConfigLoaderSchema.safeParse({
        name: "test-project",
        agents: ["web-developer"],
        domains: ["web", "acme"],
      });
      expect(result.success).toBe(true);
    });

    it("should be idempotent (calling multiple times accumulates values)", () => {
      extendSchemasWithCustomValues({ categories: ["acme-pipeline"] });
      extendSchemasWithCustomValues({ categories: ["acme-ml"] });

      expect(categoryPathSchema.safeParse("acme-pipeline").success).toBe(true);
      expect(categoryPathSchema.safeParse("acme-ml").success).toBe(true);
    });

    it("should preserve built-in values after extension", () => {
      extendSchemasWithCustomValues({
        categories: ["acme-pipeline"],
        domains: ["acme"],
        agentNames: ["acme-deployer"],
      });

      // Built-in category still works
      expect(categoryPathSchema.safeParse("web-framework").success).toBe(true);

      // Built-in agent still works
      const agentResult = agentYamlConfigSchema.safeParse({
        id: "web-developer",
        title: "Web Developer",
        description: "Builds web UIs",
        tools: ["Read", "Write"],
      });
      expect(agentResult.success).toBe(true);

      // Built-in domain still works
      const configResult = projectConfigLoaderSchema.safeParse({
        name: "test",
        domains: ["web", "api"],
      });
      expect(configResult.success).toBe(true);
    });

    it("should still reject truly invalid values after extension", () => {
      extendSchemasWithCustomValues({ categories: ["acme-pipeline"] });

      // Invalid category (uppercase) still rejected
      expect(categoryPathSchema.safeParse("Acme-Pipeline").success).toBe(false);

      // Unknown custom agent name still rejected
      const agentResult = agentYamlConfigSchema.safeParse({
        id: "unknown-agent",
        title: "Unknown",
        description: "Not registered",
        tools: ["Read"],
      });
      expect(agentResult.success).toBe(false);
    });
  });

  describe("resetSchemaExtensions", () => {
    it("should clear all custom extensions", () => {
      extendSchemasWithCustomValues({
        categories: ["acme-pipeline"],
        domains: ["acme"],
        agentNames: ["acme-deployer"],
        skillIds: ["acme-pipeline-deploy"],
      });

      // Verify extensions are active
      expect(categoryPathSchema.safeParse("acme-pipeline").success).toBe(true);

      // Reset
      resetSchemaExtensions();

      // Verify extensions are cleared
      expect(categoryPathSchema.safeParse("acme-pipeline").success).toBe(false);

      const agentResult = agentYamlConfigSchema.safeParse({
        id: "acme-deployer",
        title: "Acme Deployer",
        description: "Handles deployments",
        tools: ["Bash"],
      });
      expect(agentResult.success).toBe(false);

      const skillResult = skillAssignmentSchema.safeParse({
        id: "acme-pipeline-deploy",
      });
      expect(skillResult.success).toBe(false);
    });
  });
});
