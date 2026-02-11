import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock file system
vi.mock("../utils/fs", () => ({
  readFile: vi.fn(),
  fileExists: vi.fn(),
}));

// Mock logger
vi.mock("../utils/logger", () => ({
  verbose: vi.fn(),
  warn: vi.fn(),
}));

import { readFile, fileExists } from "../utils/fs";
import { verbose } from "../utils/logger";

// =============================================================================
// Fixtures
// =============================================================================

function createValidMappingsYaml(): string {
  return `
skill_to_agents:
  web-framework-react:
    - web-developer
    - web-tester
  api-database-drizzle:
    - api-developer
preloaded_skills:
  web-developer:
    - web-framework-react
    - web-styling-scss-modules
  api-developer:
    - api-framework-hono
subcategory_aliases:
  framework: web-framework
  database: api-database
`;
}

function createInvalidMappingsYaml(): string {
  // Missing required fields — Zod validation will fail
  return `
random_key: some_value
`;
}

function createMalformedYaml(): string {
  return `
  : invalid: yaml: [
    not properly: closed
`;
}

// =============================================================================
// Tests
// =============================================================================

describe("defaults-loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset modules to clear the internal cachedDefaults between tests
    vi.resetModules();
  });

  describe("loadDefaultMappings", () => {
    it("loads and parses valid YAML mappings", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidMappingsYaml());

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      expect(result).not.toBeNull();
      expect(result!.skill_to_agents).toEqual({
        "web-framework-react": ["web-developer", "web-tester"],
        "api-database-drizzle": ["api-developer"],
      });
      expect(result!.preloaded_skills).toEqual({
        "web-developer": ["web-framework-react", "web-styling-scss-modules"],
        "api-developer": ["api-framework-hono"],
      });
      expect(result!.subcategory_aliases).toEqual({
        framework: "web-framework",
        database: "api-database",
      });
    });

    it("returns null when file does not exist", async () => {
      vi.mocked(fileExists).mockResolvedValue(false);

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      expect(result).toBeNull();
      expect(readFile).not.toHaveBeenCalled();
      expect(verbose).toHaveBeenCalledWith(expect.stringContaining("not found"));
    });

    it("returns null for invalid YAML structure (Zod validation failure)", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createInvalidMappingsYaml());

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      expect(result).toBeNull();
      expect(verbose).toHaveBeenCalledWith(expect.stringContaining("Invalid default mappings"));
    });

    it("returns null for malformed YAML that throws parse error", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createMalformedYaml());

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      // Malformed YAML may parse but fail Zod validation, or throw during parse
      // Either way, result should be null
      expect(result).toBeNull();
    });

    it("returns null when readFile throws an error", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockRejectedValue(new Error("EACCES: permission denied"));

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      expect(result).toBeNull();
      expect(verbose).toHaveBeenCalledWith(expect.stringContaining("Failed to parse"));
    });

    it("logs verbose message on successful load", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidMappingsYaml());

      const { loadDefaultMappings } = await import("./defaults-loader");
      await loadDefaultMappings();

      expect(verbose).toHaveBeenCalledWith(expect.stringContaining("Loaded default mappings"));
    });
  });

  describe("caching behavior", () => {
    it("returns cached result on subsequent calls", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidMappingsYaml());

      const { loadDefaultMappings } = await import("./defaults-loader");

      const first = await loadDefaultMappings();
      const second = await loadDefaultMappings();

      // readFile should only be called once — second call uses cache
      expect(readFile).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it("getCachedDefaults returns null before any load", async () => {
      const { getCachedDefaults } = await import("./defaults-loader");

      expect(getCachedDefaults()).toBeNull();
    });

    it("getCachedDefaults returns cached data after load", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidMappingsYaml());

      const { loadDefaultMappings, getCachedDefaults } = await import("./defaults-loader");

      await loadDefaultMappings();
      const cached = getCachedDefaults();

      expect(cached).not.toBeNull();
      expect(cached!.skill_to_agents).toBeDefined();
      expect(cached!.preloaded_skills).toBeDefined();
      expect(cached!.subcategory_aliases).toBeDefined();
    });

    it("clearDefaultsCache resets the cache", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidMappingsYaml());

      const { loadDefaultMappings, getCachedDefaults, clearDefaultsCache } =
        await import("./defaults-loader");

      await loadDefaultMappings();
      expect(getCachedDefaults()).not.toBeNull();

      clearDefaultsCache();
      expect(getCachedDefaults()).toBeNull();
    });

    it("reloads from file after cache is cleared", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createValidMappingsYaml());

      const { loadDefaultMappings, clearDefaultsCache } = await import("./defaults-loader");

      await loadDefaultMappings();
      clearDefaultsCache();
      await loadDefaultMappings();

      // readFile called twice: once for initial load, once after cache clear
      expect(readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe("edge cases", () => {
    it("handles empty YAML file", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue("");

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      // Empty content parses as null in YAML, fails Zod validation
      expect(result).toBeNull();
    });

    it("handles YAML with extra fields (passthrough)", async () => {
      const yamlWithExtras = `
skill_to_agents:
  web-framework-react:
    - web-developer
preloaded_skills:
  web-developer:
    - web-framework-react
subcategory_aliases:
  framework: web-framework
extra_field: should_be_ignored
`;
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(yamlWithExtras);

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      // Zod strict vs passthrough depends on schema — verify it either parses or rejects
      // The schema uses z.object which strips extra fields by default
      expect(result).not.toBeNull();
      expect(result!.skill_to_agents).toBeDefined();
    });

    it("handles YAML with empty records", async () => {
      const emptyRecordsYaml = `
skill_to_agents: {}
preloaded_skills: {}
subcategory_aliases: {}
`;
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(emptyRecordsYaml);

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      expect(result).not.toBeNull();
      expect(result!.skill_to_agents).toEqual({});
      expect(result!.preloaded_skills).toEqual({});
      expect(result!.subcategory_aliases).toEqual({});
    });
  });
});
