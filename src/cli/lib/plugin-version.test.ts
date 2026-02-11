import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { bumpPluginVersion, getPluginVersion } from "./plugin-version";
import { PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE, DEFAULT_VERSION } from "../consts";

describe("plugin-version", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "plugin-version-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper: write a plugin manifest file to the temp directory.
   * Creates the .claude-plugin directory and writes plugin.json.
   */
  async function writeManifest(manifest: Record<string, unknown>): Promise<void> {
    const manifestDir = path.join(tempDir, PLUGIN_MANIFEST_DIR);
    await mkdir(manifestDir, { recursive: true });
    await writeFile(
      path.join(manifestDir, PLUGIN_MANIFEST_FILE),
      JSON.stringify(manifest, null, 2),
    );
  }

  /**
   * Helper: read the current manifest from disk.
   */
  async function readManifest(): Promise<Record<string, unknown>> {
    const manifestPath = path.join(tempDir, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE);
    const content = await readFile(manifestPath, "utf-8");
    return JSON.parse(content);
  }

  // =============================================================================
  // getPluginVersion
  // =============================================================================

  describe("getPluginVersion", () => {
    it("should return version from manifest", async () => {
      await writeManifest({ name: "test-plugin", version: "2.3.4" });

      const version = await getPluginVersion(tempDir);

      expect(version).toBe("2.3.4");
    });

    it("should return DEFAULT_VERSION when manifest has no version field", async () => {
      await writeManifest({ name: "test-plugin" });

      const version = await getPluginVersion(tempDir);

      expect(version).toBe(DEFAULT_VERSION);
    });

    it("should throw when manifest file does not exist", async () => {
      await expect(getPluginVersion(tempDir)).rejects.toThrow();
    });

    it("should throw when manifest contains invalid JSON", async () => {
      const manifestDir = path.join(tempDir, PLUGIN_MANIFEST_DIR);
      await mkdir(manifestDir, { recursive: true });
      await writeFile(path.join(manifestDir, PLUGIN_MANIFEST_FILE), "{ invalid json }");

      await expect(getPluginVersion(tempDir)).rejects.toThrow();
    });

    it("should return version 1.0.0 for manifest with version 1.0.0", async () => {
      await writeManifest({ name: "test-plugin", version: "1.0.0" });

      const version = await getPluginVersion(tempDir);

      expect(version).toBe("1.0.0");
    });
  });

  // =============================================================================
  // bumpPluginVersion
  // =============================================================================

  describe("bumpPluginVersion", () => {
    describe("patch bump", () => {
      it("should bump patch version from 1.0.0 to 1.0.1", async () => {
        await writeManifest({ name: "test-plugin", version: "1.0.0" });

        const newVersion = await bumpPluginVersion(tempDir, "patch");

        expect(newVersion).toBe("1.0.1");
      });

      it("should bump patch version from 2.5.9 to 2.5.10", async () => {
        await writeManifest({ name: "test-plugin", version: "2.5.9" });

        const newVersion = await bumpPluginVersion(tempDir, "patch");

        expect(newVersion).toBe("2.5.10");
      });

      it("should write bumped version back to manifest file", async () => {
        await writeManifest({ name: "test-plugin", version: "1.0.0" });

        await bumpPluginVersion(tempDir, "patch");

        const manifest = await readManifest();
        expect(manifest.version).toBe("1.0.1");
      });
    });

    describe("minor bump", () => {
      it("should bump minor version from 1.0.0 to 1.1.0", async () => {
        await writeManifest({ name: "test-plugin", version: "1.0.0" });

        const newVersion = await bumpPluginVersion(tempDir, "minor");

        expect(newVersion).toBe("1.1.0");
      });

      it("should reset patch to 0 when bumping minor", async () => {
        await writeManifest({ name: "test-plugin", version: "1.2.5" });

        const newVersion = await bumpPluginVersion(tempDir, "minor");

        expect(newVersion).toBe("1.3.0");
      });
    });

    describe("major bump", () => {
      it("should bump major version from 1.0.0 to 2.0.0", async () => {
        await writeManifest({ name: "test-plugin", version: "1.0.0" });

        const newVersion = await bumpPluginVersion(tempDir, "major");

        expect(newVersion).toBe("2.0.0");
      });

      it("should reset minor and patch to 0 when bumping major", async () => {
        await writeManifest({ name: "test-plugin", version: "3.7.12" });

        const newVersion = await bumpPluginVersion(tempDir, "major");

        expect(newVersion).toBe("4.0.0");
      });
    });

    describe("missing version field", () => {
      it("should use DEFAULT_VERSION when manifest has no version", async () => {
        await writeManifest({ name: "test-plugin" });

        const newVersion = await bumpPluginVersion(tempDir, "patch");

        // DEFAULT_VERSION is "1.0.0", so patch bump gives "1.0.1"
        expect(newVersion).toBe("1.0.1");
      });

      it("should use DEFAULT_VERSION for minor bump when no version", async () => {
        await writeManifest({ name: "test-plugin" });

        const newVersion = await bumpPluginVersion(tempDir, "minor");

        expect(newVersion).toBe("1.1.0");
      });

      it("should use DEFAULT_VERSION for major bump when no version", async () => {
        await writeManifest({ name: "test-plugin" });

        const newVersion = await bumpPluginVersion(tempDir, "major");

        expect(newVersion).toBe("2.0.0");
      });
    });

    describe("missing manifest", () => {
      it("should throw when manifest file does not exist", async () => {
        await expect(bumpPluginVersion(tempDir, "patch")).rejects.toThrow();
      });
    });

    describe("preserves other manifest fields", () => {
      it("should preserve name and description after bump", async () => {
        await writeManifest({
          name: "test-plugin",
          version: "1.0.0",
          description: "A test plugin",
        });

        await bumpPluginVersion(tempDir, "patch");

        const manifest = await readManifest();
        expect(manifest.name).toBe("test-plugin");
        expect(manifest.description).toBe("A test plugin");
        expect(manifest.version).toBe("1.0.1");
      });

      it("should preserve author and keywords after bump", async () => {
        await writeManifest({
          name: "test-plugin",
          version: "1.0.0",
          author: { name: "@vince" },
          keywords: ["test", "plugin"],
        });

        await bumpPluginVersion(tempDir, "minor");

        const manifest = await readManifest();
        expect(manifest.author).toEqual({ name: "@vince" });
        expect(manifest.keywords).toEqual(["test", "plugin"]);
        expect(manifest.version).toBe("1.1.0");
      });
    });

    describe("return value matches file contents", () => {
      it("should return the same version that was written to disk", async () => {
        await writeManifest({ name: "test-plugin", version: "5.0.0" });

        const returnedVersion = await bumpPluginVersion(tempDir, "patch");
        const diskVersion = await getPluginVersion(tempDir);

        expect(returnedVersion).toBe(diskVersion);
      });
    });
  });
});
