import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { z } from "zod";
import { safeLoadYamlFile } from "./yaml";

const testSchema = z.object({
  name: z.string(),
  version: z.string(),
});

type TestConfig = z.infer<typeof testSchema>;

describe("safeLoadYamlFile", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-yaml-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe("valid YAML", () => {
    it("should parse and validate a valid YAML file", async () => {
      const filePath = path.join(tempDir, "config.yaml");
      await writeFile(filePath, "name: my-project\nversion: '1.0.0'\n", "utf-8");

      const result = await safeLoadYamlFile(filePath, testSchema);

      expect(result).toEqual({ name: "my-project", version: "1.0.0" });
    });

    it("should return typed data matching the schema", async () => {
      const filePath = path.join(tempDir, "typed.yaml");
      await writeFile(filePath, "name: typed-test\nversion: '2.5.0'\n", "utf-8");

      const result = await safeLoadYamlFile<TestConfig>(filePath, testSchema);

      expect(result?.name).toBe("typed-test");
      expect(result?.version).toBe("2.5.0");
    });

    it("should handle YAML with extra fields when schema allows passthrough", async () => {
      const passthroughSchema = z
        .object({
          name: z.string(),
        })
        .passthrough();
      const filePath = path.join(tempDir, "extra.yaml");
      await writeFile(filePath, "name: test\nextra: value\n", "utf-8");

      const result = await safeLoadYamlFile(filePath, passthroughSchema);

      expect(result).toEqual({ name: "test", extra: "value" });
    });
  });

  describe("invalid YAML", () => {
    it("should return null for unparseable YAML", async () => {
      const filePath = path.join(tempDir, "broken.yaml");
      await writeFile(filePath, ":\n  - :\n    invalid: [unclosed", "utf-8");

      const result = await safeLoadYamlFile(filePath, testSchema);

      expect(result).toBeNull();
    });

    it("should warn when YAML is unparseable", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const filePath = path.join(tempDir, "broken.yaml");
      await writeFile(filePath, ":\n  - :\n    invalid: [unclosed", "utf-8");

      await safeLoadYamlFile(filePath, testSchema);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to parse YAML"));
    });
  });

  describe("missing file", () => {
    it("should return null when file does not exist", async () => {
      const filePath = path.join(tempDir, "nonexistent.yaml");

      const result = await safeLoadYamlFile(filePath, testSchema);

      expect(result).toBeNull();
    });

    it("should warn when file does not exist", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const filePath = path.join(tempDir, "nonexistent.yaml");

      await safeLoadYamlFile(filePath, testSchema);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to parse YAML"));
    });
  });

  describe("schema validation failure", () => {
    it("should return null when data does not match schema", async () => {
      const filePath = path.join(tempDir, "wrong-shape.yaml");
      await writeFile(filePath, "count: 42\nenabled: true\n", "utf-8");

      const result = await safeLoadYamlFile(filePath, testSchema);

      expect(result).toBeNull();
    });

    it("should warn with 'Invalid YAML' when schema validation fails", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const filePath = path.join(tempDir, "wrong-shape.yaml");
      await writeFile(filePath, "count: 42\nenabled: true\n", "utf-8");

      await safeLoadYamlFile(filePath, testSchema);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid YAML"));
    });

    it("should include file path in validation warning", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const filePath = path.join(tempDir, "wrong-shape.yaml");
      await writeFile(filePath, "count: 42\n", "utf-8");

      await safeLoadYamlFile(filePath, testSchema);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(filePath));
    });

    it("should return null when a required field is missing", async () => {
      const filePath = path.join(tempDir, "partial.yaml");
      await writeFile(filePath, "name: only-name\n", "utf-8");

      const result = await safeLoadYamlFile(filePath, testSchema);

      expect(result).toBeNull();
    });

    it("should return null when a field has the wrong type", async () => {
      const filePath = path.join(tempDir, "wrong-type.yaml");
      await writeFile(filePath, "name: 123\nversion: true\n", "utf-8");

      const result = await safeLoadYamlFile(filePath, testSchema);

      expect(result).toBeNull();
    });
  });

  describe("oversized file", () => {
    it("should return null when file exceeds maxSizeBytes", async () => {
      const filePath = path.join(tempDir, "large.yaml");
      const content = "data: " + "x".repeat(500);
      await writeFile(filePath, content, "utf-8");

      const result = await safeLoadYamlFile(filePath, testSchema, 100);

      expect(result).toBeNull();
    });

    it("should warn when file exceeds maxSizeBytes", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const filePath = path.join(tempDir, "large.yaml");
      const content = "data: " + "x".repeat(500);
      await writeFile(filePath, content, "utf-8");

      await safeLoadYamlFile(filePath, testSchema, 100);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("File too large"));
    });

    it("should use MAX_CONFIG_FILE_SIZE as the default limit", async () => {
      const filePath = path.join(tempDir, "normal.yaml");
      await writeFile(filePath, "name: test\nversion: '1.0.0'\n", "utf-8");

      // File is well under 1MB default, should succeed
      const result = await safeLoadYamlFile(filePath, testSchema);

      expect(result).toEqual({ name: "test", version: "1.0.0" });
    });
  });

  describe("edge cases", () => {
    it("should return null for an empty file", async () => {
      const filePath = path.join(tempDir, "empty.yaml");
      await writeFile(filePath, "", "utf-8");

      const result = await safeLoadYamlFile(filePath, testSchema);

      expect(result).toBeNull();
    });

    it("should return null for a file with only comments", async () => {
      const filePath = path.join(tempDir, "comments.yaml");
      await writeFile(filePath, "# This is a comment\n# Another comment\n", "utf-8");

      const result = await safeLoadYamlFile(filePath, testSchema);

      expect(result).toBeNull();
    });

    it("should handle YAML with null values", async () => {
      const nullableSchema = z.object({
        name: z.string(),
        optional: z.string().nullable(),
      });
      const filePath = path.join(tempDir, "nullable.yaml");
      await writeFile(filePath, "name: test\noptional: null\n", "utf-8");

      const result = await safeLoadYamlFile(filePath, nullableSchema);

      expect(result).toEqual({ name: "test", optional: null });
    });

    it("should handle nested YAML structures", async () => {
      const nestedSchema = z.object({
        database: z.object({
          host: z.string(),
          port: z.number(),
        }),
      });
      const filePath = path.join(tempDir, "nested.yaml");
      await writeFile(filePath, "database:\n  host: localhost\n  port: 5432\n", "utf-8");

      const result = await safeLoadYamlFile(filePath, nestedSchema);

      expect(result).toEqual({ database: { host: "localhost", port: 5432 } });
    });

    it("should handle YAML arrays", async () => {
      const arraySchema = z.object({
        items: z.array(z.string()),
      });
      const filePath = path.join(tempDir, "array.yaml");
      await writeFile(filePath, "items:\n  - alpha\n  - beta\n  - gamma\n", "utf-8");

      const result = await safeLoadYamlFile(filePath, arraySchema);

      expect(result).toEqual({ items: ["alpha", "beta", "gamma"] });
    });
  });
});
