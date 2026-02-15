import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { bumpPluginVersion, getPluginVersion } from "./plugin-version";
import { PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE, DEFAULT_VERSION } from "../../consts";

describe("plugin-version", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "plugin-version-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function writeManifest(manifest: Record<string, unknown>): Promise<void> {
    const manifestDir = path.join(tempDir, PLUGIN_MANIFEST_DIR);
    await mkdir(manifestDir, { recursive: true });
    await writeFile(
      path.join(manifestDir, PLUGIN_MANIFEST_FILE),
      JSON.stringify(manifest, null, 2),
    );
  }

  async function readManifest(): Promise<Record<string, unknown>> {
    const manifestPath = path.join(tempDir, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE);
    const content = await readFile(manifestPath, "utf-8");
    return JSON.parse(content);
  }

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

    it("should return large version numbers as-is", async () => {
      await writeManifest({ name: "test-plugin", version: "100.200.300" });

      const version = await getPluginVersion(tempDir);

      expect(version).toBe("100.200.300");
    });

    it("should return pre-release version string as-is", async () => {
      await writeManifest({ name: "test-plugin", version: "1.0.0-beta.1" });

      const version = await getPluginVersion(tempDir);

      expect(version).toBe("1.0.0-beta.1");
    });

    it("should return empty string version as DEFAULT_VERSION", async () => {
      await writeManifest({ name: "test-plugin", version: "" });

      const version = await getPluginVersion(tempDir);

      // empty string is falsy, so `manifest.version || DEFAULT_VERSION` returns DEFAULT_VERSION
      expect(version).toBe(DEFAULT_VERSION);
    });

    it("should throw when manifest is missing required name field", async () => {
      const manifestDir = path.join(tempDir, PLUGIN_MANIFEST_DIR);
      await mkdir(manifestDir, { recursive: true });
      await writeFile(
        path.join(manifestDir, PLUGIN_MANIFEST_FILE),
        JSON.stringify({ version: "1.0.0" }),
      );

      await expect(getPluginVersion(tempDir)).rejects.toThrow();
    });
  });

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

    describe("large version numbers", () => {
      it("should bump patch on large version numbers", async () => {
        await writeManifest({ name: "test-plugin", version: "10.20.30" });

        const newVersion = await bumpPluginVersion(tempDir, "patch");

        expect(newVersion).toBe("10.20.31");
      });

      it("should bump minor on large version numbers", async () => {
        await writeManifest({ name: "test-plugin", version: "10.20.30" });

        const newVersion = await bumpPluginVersion(tempDir, "minor");

        expect(newVersion).toBe("10.21.0");
      });

      it("should bump major on large version numbers", async () => {
        await writeManifest({ name: "test-plugin", version: "10.20.30" });

        const newVersion = await bumpPluginVersion(tempDir, "major");

        expect(newVersion).toBe("11.0.0");
      });

      it("should handle version with triple-digit components", async () => {
        await writeManifest({ name: "test-plugin", version: "100.200.999" });

        const newVersion = await bumpPluginVersion(tempDir, "patch");

        expect(newVersion).toBe("100.200.1000");
      });
    });

    describe("pre-release version strings", () => {
      it("should treat pre-release patch segment as 0 and bump from there", async () => {
        // parseVersion("1.0.0-beta.1") splits on "." => ["1","0","0-beta","1"]
        // Number("0-beta") = NaN, NaN || 0 = 0, so patch = 0
        await writeManifest({ name: "test-plugin", version: "1.0.0-beta.1" });

        const newVersion = await bumpPluginVersion(tempDir, "patch");

        expect(newVersion).toBe("1.0.1");
      });

      it("should treat pre-release minor as NaN fallback for minor bump", async () => {
        // parseVersion("1.0-rc.2") splits on "." => ["1","0-rc","2"]
        // Number("0-rc") = NaN, NaN || 0 = 0
        await writeManifest({ name: "test-plugin", version: "1.0-rc.2" });

        const newVersion = await bumpPluginVersion(tempDir, "minor");

        expect(newVersion).toBe("1.1.0");
      });
    });

    describe("zero-major version handling", () => {
      it("should treat major version 0 as 1 due to falsy fallback", async () => {
        // parseVersion uses `parts[0] || 1`, so 0 becomes 1
        await writeManifest({ name: "test-plugin", version: "0.1.0" });

        const newVersion = await bumpPluginVersion(tempDir, "patch");

        expect(newVersion).toBe("1.1.1");
      });

      it("should bump major from 0 treating it as 1", async () => {
        await writeManifest({ name: "test-plugin", version: "0.5.3" });

        const newVersion = await bumpPluginVersion(tempDir, "major");

        expect(newVersion).toBe("2.0.0");
      });
    });

    describe("partial version strings", () => {
      it("should handle single-segment version string", async () => {
        // parseVersion("5") => parts = [5], minor = parts[1] || 0 = 0, patch = parts[2] || 0 = 0
        await writeManifest({ name: "test-plugin", version: "5" });

        const newVersion = await bumpPluginVersion(tempDir, "patch");

        expect(newVersion).toBe("5.0.1");
      });

      it("should handle two-segment version string", async () => {
        // parseVersion("3.7") => parts = [3, 7], patch = parts[2] || 0 = 0
        await writeManifest({ name: "test-plugin", version: "3.7" });

        const newVersion = await bumpPluginVersion(tempDir, "patch");

        expect(newVersion).toBe("3.7.1");
      });
    });

    describe("invalid version strings", () => {
      it("should fall back to 1.0.0 for completely invalid version string", async () => {
        // parseVersion("abc") => Number("abc") = NaN, NaN || 1 = 1
        await writeManifest({ name: "test-plugin", version: "abc" });

        const newVersion = await bumpPluginVersion(tempDir, "patch");

        expect(newVersion).toBe("1.0.1");
      });

      it("should fall back to 1.0.0 for empty version string", async () => {
        // parseVersion("") => split(".")=[""], Number("") = 0, 0 || 1 = 1
        await writeManifest({ name: "test-plugin", version: "" });

        const newVersion = await bumpPluginVersion(tempDir, "patch");

        expect(newVersion).toBe("1.0.1");
      });
    });

    describe("sequential bumps", () => {
      it("should correctly apply two consecutive patch bumps", async () => {
        await writeManifest({ name: "test-plugin", version: "1.0.0" });

        await bumpPluginVersion(tempDir, "patch");
        const secondBump = await bumpPluginVersion(tempDir, "patch");

        expect(secondBump).toBe("1.0.2");
      });

      it("should correctly apply minor then patch bump", async () => {
        await writeManifest({ name: "test-plugin", version: "1.0.5" });

        await bumpPluginVersion(tempDir, "minor");
        const secondBump = await bumpPluginVersion(tempDir, "patch");

        expect(secondBump).toBe("1.1.1");
      });

      it("should correctly apply major then minor then patch bump", async () => {
        await writeManifest({ name: "test-plugin", version: "1.2.3" });

        await bumpPluginVersion(tempDir, "major");
        await bumpPluginVersion(tempDir, "minor");
        const thirdBump = await bumpPluginVersion(tempDir, "patch");

        expect(thirdBump).toBe("2.1.1");
      });
    });

    describe("schema validation", () => {
      it("should throw when manifest is missing required name field", async () => {
        const manifestDir = path.join(tempDir, PLUGIN_MANIFEST_DIR);
        await mkdir(manifestDir, { recursive: true });
        await writeFile(
          path.join(manifestDir, PLUGIN_MANIFEST_FILE),
          JSON.stringify({ version: "1.0.0" }),
        );

        await expect(bumpPluginVersion(tempDir, "patch")).rejects.toThrow();
      });

      it("should throw when manifest is an empty object", async () => {
        const manifestDir = path.join(tempDir, PLUGIN_MANIFEST_DIR);
        await mkdir(manifestDir, { recursive: true });
        await writeFile(path.join(manifestDir, PLUGIN_MANIFEST_FILE), JSON.stringify({}));

        await expect(bumpPluginVersion(tempDir, "patch")).rejects.toThrow();
      });
    });
  });
});
