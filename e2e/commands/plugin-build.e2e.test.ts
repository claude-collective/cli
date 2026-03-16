import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  ensureBinaryExists,
  cleanupTempDir,
  fileExists,
  listFiles,
  readTestFile,
  runCLI,
  EXIT_CODES,
  SETUP_TIMEOUT_MS,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

/**
 * P-BUILD-1 and P-BUILD-2: Build pipeline E2E tests.
 *
 * Tests the full plugin build chain:
 *   createE2ESource() -> build plugins -> build marketplace
 *
 * These tests verify that `build plugins` produces valid plugin directories
 * with manifests, and `build marketplace` produces a valid marketplace.json.
 *
 * Reference: e2e-framework-design.md, Section 4.4
 */

const E2E_SKILL_NAMES = [
  "web-framework-react",
  "web-testing-vitest",
  "web-state-zustand",
  "api-framework-hono",
  "shared-meta-research-methodology",
  "shared-meta-reviewing",
  "shared-meta-cli-reviewing",
];

const EXPECTED_SKILL_COUNT = 7;
const MARKETPLACE_NAME = "test-mp";

describe("build pipeline (plugin chain)", () => {
  let sourceDir: string;
  let tempDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();
    const source = await createE2ESource();
    sourceDir = source.sourceDir;
    tempDir = source.tempDir;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  });

  describe("build plugins produces valid plugin directories", () => {
    let buildResult: Awaited<ReturnType<typeof runCLI>>;

    beforeAll(async () => {
      buildResult = await runCLI(["build", "plugins"], sourceDir);
    }, SETUP_TIMEOUT_MS);

    it("should exit with code 0", () => {
      expect(buildResult.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it("should report compiled skill count in output", () => {
      expect(buildResult.stdout).toContain(`Compiled ${EXPECTED_SKILL_COUNT} skill plugins`);
    });

    it("should produce a plugin directory with manifest for each skill", async () => {
      const pluginsDir = path.join(sourceDir, "dist", "plugins");

      for (const skillName of E2E_SKILL_NAMES) {
        const manifestPath = path.join(pluginsDir, skillName, ".claude-plugin", "plugin.json");
        const exists = await fileExists(manifestPath);
        expect(exists, `Missing manifest for ${skillName}: ${manifestPath}`).toBe(true);
      }
    });

    it("should produce valid manifest JSON with name and version fields", async () => {
      const pluginsDir = path.join(sourceDir, "dist", "plugins");
      const pluginDirs = await listFiles(pluginsDir);

      expect(pluginDirs.length).toBeGreaterThanOrEqual(1);

      for (const pluginDirName of pluginDirs) {
        const manifestPath = path.join(pluginsDir, pluginDirName, ".claude-plugin", "plugin.json");

        if (!(await fileExists(manifestPath))) continue;

        const content = await readTestFile(manifestPath);
        const manifest = JSON.parse(content);

        expect(manifest, `Invalid manifest for ${pluginDirName}`).toHaveProperty("name");
        expect(manifest, `Invalid manifest for ${pluginDirName}`).toHaveProperty("version");
        expect(typeof manifest.name).toBe("string");
        expect(typeof manifest.version).toBe("string");
      }
    });
  });

  describe("build marketplace produces valid marketplace.json", () => {
    let marketplaceResult: Awaited<ReturnType<typeof runCLI>>;

    beforeAll(async () => {
      // P-BUILD-2 depends on P-BUILD-1 having already run (plugins built).
      // Vitest runs describes in order within the same file.
      marketplaceResult = await runCLI(
        ["build", "marketplace", "--name", MARKETPLACE_NAME],
        sourceDir,
      );
    }, SETUP_TIMEOUT_MS);

    it("should exit with code 0", () => {
      expect(marketplaceResult.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it("should create marketplace.json at the expected path", async () => {
      const marketplacePath = path.join(sourceDir, ".claude-plugin", "marketplace.json");
      expect(await fileExists(marketplacePath)).toBe(true);
    });

    it("should have correct name, version, and plugins in marketplace.json", async () => {
      const marketplacePath = path.join(sourceDir, ".claude-plugin", "marketplace.json");
      const content = await readTestFile(marketplacePath);
      const marketplace = JSON.parse(content);

      expect(marketplace.name).toBe(MARKETPLACE_NAME);
      expect(typeof marketplace.version).toBe("string");
      expect(Array.isArray(marketplace.plugins)).toBe(true);
      expect(marketplace.plugins.length).toBeGreaterThanOrEqual(1);
    });

    it("should report plugin count in output", () => {
      // The marketplace command outputs "Marketplace generated with X plugins!"
      expect(marketplaceResult.stdout).toMatch(/Marketplace generated with [1-9]\d* plugins!/);
    });
  });
});
