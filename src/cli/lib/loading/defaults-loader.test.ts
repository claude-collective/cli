import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock file system and logger — inline factories required because vi.resetModules() is used
// (__mocks__ directory mocks create fresh vi.fn() instances on module reset)
vi.mock("../../utils/fs", () => ({
  readFile: vi.fn(),
  readFileSafe: vi.fn(),
  fileExists: vi.fn(),
}));
vi.mock("../../utils/logger", () => ({
  verbose: vi.fn(),
  warn: vi.fn(),
}));

import { readFileSafe, fileExists } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";

function createValidMappingsYaml(): string {
  return `
skillToAgents:
  web-framework-react:
    - web-developer
    - web-tester
  api-database-drizzle:
    - api-developer
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

describe("defaults-loader", () => {
  beforeEach(() => {
    // Reset modules to clear the internal cachedDefaults between tests
    vi.resetModules();
  });

  describe("loadDefaultMappings", () => {
    it("loads and parses valid YAML mappings", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFileSafe).mockResolvedValue(createValidMappingsYaml());

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      expect(result).not.toBeNull();
      expect(result!.skillToAgents).toEqual({
        "web-framework-react": ["web-developer", "web-tester"],
        "api-database-drizzle": ["api-developer"],
      });
      expect(result!.agentSkillPrefixes).toBeUndefined();
    });

    it("returns null when file does not exist", async () => {
      vi.mocked(fileExists).mockResolvedValue(false);

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      expect(result).toBeNull();
      expect(readFileSafe).not.toHaveBeenCalled();
      expect(verbose).toHaveBeenCalledWith(expect.stringContaining("not found"));
    });

    it("returns null for invalid YAML structure (Zod validation failure)", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFileSafe).mockResolvedValue(createInvalidMappingsYaml());

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      expect(result).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid YAML"));
    });

    it("returns null for malformed YAML that throws parse error", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFileSafe).mockResolvedValue(createMalformedYaml());

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      // Malformed YAML may parse but fail Zod validation, or throw during parse
      // Either way, result should be null
      expect(result).toBeNull();
    });

    it("returns null when readFile throws an error", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFileSafe).mockRejectedValue(new Error("EACCES: permission denied"));

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      expect(result).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Failed to parse YAML"));
    });

    it("logs verbose message on successful load", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFileSafe).mockResolvedValue(createValidMappingsYaml());

      const { loadDefaultMappings } = await import("./defaults-loader");
      await loadDefaultMappings();

      expect(verbose).toHaveBeenCalledWith(expect.stringContaining("Loaded default mappings"));
    });
  });

  describe("caching behavior", () => {
    it("returns cached result on subsequent calls", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFileSafe).mockResolvedValue(createValidMappingsYaml());

      const { loadDefaultMappings } = await import("./defaults-loader");

      const first = await loadDefaultMappings();
      const second = await loadDefaultMappings();

      // readFile should only be called once — second call uses cache
      expect(readFileSafe).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it("getCachedDefaults returns null before any load", async () => {
      const { getCachedDefaults } = await import("./defaults-loader");

      expect(getCachedDefaults()).toBeNull();
    });

    it("getCachedDefaults returns cached data after load", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFileSafe).mockResolvedValue(createValidMappingsYaml());

      const { loadDefaultMappings, getCachedDefaults } = await import("./defaults-loader");

      await loadDefaultMappings();
      const cached = getCachedDefaults();

      expect(cached).not.toBeNull();
      expect(cached!.skillToAgents).toBeDefined();
    });

    it("clearDefaultsCache resets the cache", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFileSafe).mockResolvedValue(createValidMappingsYaml());

      const { loadDefaultMappings, getCachedDefaults, clearDefaultsCache } =
        await import("./defaults-loader");

      await loadDefaultMappings();
      expect(getCachedDefaults()).not.toBeNull();

      clearDefaultsCache();
      expect(getCachedDefaults()).toBeNull();
    });

    it("reloads from file after cache is cleared", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFileSafe).mockResolvedValue(createValidMappingsYaml());

      const { loadDefaultMappings, clearDefaultsCache } = await import("./defaults-loader");

      await loadDefaultMappings();
      clearDefaultsCache();
      await loadDefaultMappings();

      // readFile called twice: once for initial load, once after cache clear
      expect(readFileSafe).toHaveBeenCalledTimes(2);
    });
  });

  describe("edge cases", () => {
    it("handles empty YAML file", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFileSafe).mockResolvedValue("");

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      // Empty content parses as null in YAML, fails Zod validation
      expect(result).toBeNull();
    });

    it("handles YAML with extra fields (passthrough)", async () => {
      const yamlWithExtras = `
skillToAgents:
  web-framework-react:
    - web-developer
extra_field: should_be_ignored
`;
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFileSafe).mockResolvedValue(yamlWithExtras);

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      // Zod strict vs passthrough depends on schema — verify it either parses or rejects
      // The schema uses z.object which strips extra fields by default
      expect(result).not.toBeNull();
      expect(result!.skillToAgents).toBeDefined();
    });

    it("handles YAML with empty records", async () => {
      const emptyRecordsYaml = `
skillToAgents: {}
`;
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFileSafe).mockResolvedValue(emptyRecordsYaml);

      const { loadDefaultMappings } = await import("./defaults-loader");
      const result = await loadDefaultMappings();

      expect(result).not.toBeNull();
      expect(result!.skillToAgents).toEqual({});
    });
  });
});
