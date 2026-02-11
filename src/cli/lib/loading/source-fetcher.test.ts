import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { fetchFromSource } from "./source-fetcher";
import { isLocalSource } from "../configuration";

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
});
