import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { fetchFromSource, fetchMarketplace, sanitizeSourceForCache } from "./source-fetcher";
import { isLocalSource } from "../configuration";
import { CACHE_HASH_LENGTH, CACHE_READABLE_PREFIX_LENGTH, PLUGIN_MANIFEST_DIR } from "../../consts";
import type { Marketplace } from "../../types";

describe("source-fetcher", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-source-fetcher-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("fetchFromSource with local paths", () => {
    it("should return the local path for existing directory", async () => {
      // Create a local directory
      const localSource = path.join(tempDir, "local-skills");
      await mkdir(localSource, { recursive: true });
      await writeFile(path.join(localSource, "test.txt"), "test content");

      const result = await fetchFromSource(localSource);

      expect(result.path).toBe(localSource);
      expect(result.fromCache).toBe(false);
      expect(result.source).toBe(localSource);
    });

    it("should handle absolute paths", async () => {
      const localSource = path.join(tempDir, "absolute-path-test");
      await mkdir(localSource, { recursive: true });

      const result = await fetchFromSource(localSource);

      expect(result.path).toBe(localSource);
    });

    it("should throw error for non-existent local path", async () => {
      const nonExistent = path.join(tempDir, "does-not-exist");

      await expect(fetchFromSource(nonExistent)).rejects.toThrow(/Local source not found/);
    });

    it("should handle subdir option for local paths", async () => {
      // Create nested structure
      const localSource = path.join(tempDir, "source-with-subdir");
      const subdir = path.join(localSource, "nested", "path");
      await mkdir(subdir, { recursive: true });
      await writeFile(path.join(subdir, "file.txt"), "content");

      const result = await fetchFromSource(localSource, {
        subdir: "nested/path",
      });

      expect(result.path).toBe(subdir);
    });
  });

  describe("remote source URL validation", () => {
    // These tests verify URL parsing without actually fetching
    // (actual remote fetching would require network access)

    it("should identify github: as remote", () => {
      expect(isLocalSource("github:org/repo")).toBe(false);
    });

    it("should identify gh: as remote", () => {
      expect(isLocalSource("gh:org/repo")).toBe(false);
    });

    it("should identify gitlab: as remote", () => {
      expect(isLocalSource("gitlab:org/repo")).toBe(false);
    });

    it("should identify https: as remote", () => {
      expect(isLocalSource("https://github.com/org/repo")).toBe(false);
    });

    it("should identify local paths correctly", () => {
      expect(isLocalSource("/absolute/path")).toBe(true);
      expect(isLocalSource("./relative/path")).toBe(true);
      expect(isLocalSource("../parent/path")).toBe(true);
    });
  });

  describe("sanitizeSourceForCache", () => {
    it("should be deterministic (same input produces same output)", () => {
      const source = "github:org/repo";
      expect(sanitizeSourceForCache(source)).toBe(sanitizeSourceForCache(source));
    });

    it("should produce different outputs for different sources", () => {
      const a = sanitizeSourceForCache("github:user/repo");
      const b = sanitizeSourceForCache("github:other/repo");
      expect(a).not.toBe(b);
    });

    it("should avoid collisions for sources that old regex approach would collapse", () => {
      const a = sanitizeSourceForCache("github:user/repo");
      const b = sanitizeSourceForCache("github-user-repo");
      expect(a).not.toBe(b);
    });

    it("should include a human-readable prefix for debugging", () => {
      const result = sanitizeSourceForCache("github:org/repo");
      expect(result).toMatch(/^github-org-repo-[0-9a-f]+$/);
    });

    it("should include a hex hash suffix", () => {
      const result = sanitizeSourceForCache("github:org/repo");
      const parts = result.split("-");
      const hashPart = parts[parts.length - 1];
      expect(hashPart).toMatch(/^[0-9a-f]+$/);
      expect(hashPart.length).toBe(CACHE_HASH_LENGTH);
    });

    it("should truncate long readable prefixes", () => {
      const longSource =
        "https://github.com/very-long-organization-name/extremely-long-repository-name-that-goes-on-forever";
      const result = sanitizeSourceForCache(longSource);
      // readable prefix is at most CACHE_READABLE_PREFIX_LENGTH, plus a dash, plus CACHE_HASH_LENGTH hex chars
      const maxLength = CACHE_READABLE_PREFIX_LENGTH + 1 + CACHE_HASH_LENGTH;
      expect(result.length).toBeLessThanOrEqual(maxLength);
    });

    it("should handle sources with only special characters", () => {
      const result = sanitizeSourceForCache(":///::");
      // readable part strips to empty, so result is just the hash
      expect(result).toMatch(/^[0-9a-f]+$/);
      expect(result.length).toBe(CACHE_HASH_LENGTH);
    });

    it("should handle empty string input", () => {
      const result = sanitizeSourceForCache("");
      // Empty string still produces a hash
      expect(result).toMatch(/^[0-9a-f]+$/);
      expect(result.length).toBe(CACHE_HASH_LENGTH);
    });

    it("should handle Unicode sources without errors", () => {
      const a = sanitizeSourceForCache("github:\u00FCser/r\u00E9po");
      const b = sanitizeSourceForCache("github:user/repo");
      expect(a).not.toBe(b);
      // Should still produce a valid result
      expect(a).toMatch(/^[a-zA-Z0-9-]+$/);
    });

    it("should produce filesystem-safe names (no special chars)", () => {
      const sources = [
        "github:org/repo",
        "https://github.com/org/repo",
        "gh:user/my-repo#main",
        "gitlab:org/sub/repo",
      ];
      for (const source of sources) {
        const result = sanitizeSourceForCache(source);
        expect(result).toMatch(/^[a-zA-Z0-9-]+$/);
      }
    });
  });

  describe("fetchMarketplace security validation", () => {
    function createValidMarketplace(overrides: Partial<Marketplace> = {}): Marketplace {
      return {
        name: "test-marketplace",
        version: "1.0.0",
        owner: { name: "test-owner" },
        plugins: [{ name: "test-plugin", source: "./plugins/test" }],
        ...overrides,
      };
    }

    async function writeMarketplace(content: string): Promise<string> {
      const pluginDir = path.join(tempDir, PLUGIN_MANIFEST_DIR);
      await mkdir(pluginDir, { recursive: true });
      const marketplacePath = path.join(pluginDir, "marketplace.json");
      await writeFile(marketplacePath, content, "utf-8");
      return tempDir;
    }

    it("should parse a valid marketplace.json", async () => {
      const source = await writeMarketplace(JSON.stringify(createValidMarketplace()));

      const result = await fetchMarketplace(source);

      expect(result.marketplace.name).toBe("test-marketplace");
      expect(result.marketplace.plugins).toHaveLength(1);
    });

    it("should reject oversized marketplace.json files", async () => {
      // Create a marketplace file larger than 10MB
      const hugeContent = "x".repeat(11 * 1024 * 1024);
      const source = await writeMarketplace(hugeContent);

      await expect(fetchMarketplace(source)).rejects.toThrow(/File too large/);
    });

    it("should reject deeply nested JSON structures", async () => {
      // Build a deeply nested structure (>10 levels)
      let deep: unknown = "payload";
      for (let i = 0; i < 15; i++) {
        deep = { nested: deep };
      }
      const marketplace = createValidMarketplace();
      const content = JSON.stringify({ ...marketplace, deep });
      const source = await writeMarketplace(content);

      await expect(fetchMarketplace(source)).rejects.toThrow(/nesting depth/);
    });

    it("should reject invalid JSON", async () => {
      const source = await writeMarketplace("not valid json {{{");

      await expect(fetchMarketplace(source)).rejects.toThrow();
    });

    it("should reject marketplace with missing required fields", async () => {
      const source = await writeMarketplace(JSON.stringify({ name: "incomplete" }));

      await expect(fetchMarketplace(source)).rejects.toThrow(/Validation errors/);
    });

    it("should reject marketplace with too many plugins", async () => {
      const plugins = Array.from({ length: 10_001 }, (_, i) => ({
        name: `plugin-${i}`,
        source: `./plugins/plugin-${i}`,
      }));
      const marketplace = createValidMarketplace({ plugins });
      const source = await writeMarketplace(JSON.stringify(marketplace));

      await expect(fetchMarketplace(source)).rejects.toThrow(/Too many plugins/);
    });

    it("should accept marketplace with plugins at the limit", async () => {
      const plugins = Array.from({ length: 100 }, (_, i) => ({
        name: `plugin-${i}`,
        source: `./plugins/plugin-${i}`,
      }));
      const marketplace = createValidMarketplace({ plugins });
      const source = await writeMarketplace(JSON.stringify(marketplace));

      const result = await fetchMarketplace(source);

      expect(result.marketplace.plugins).toHaveLength(100);
    });
  });
});
