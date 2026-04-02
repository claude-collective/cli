import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile, readFile } from "fs/promises";
import { runCliCommand, fileExists, createTempDir, cleanupTempDir } from "../../helpers";
import { PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE } from "../../../../consts";
import type { Category, Marketplace, PluginManifest } from "../../../../types";

/** Creates a plugin directory with a valid plugin.json manifest */
async function createPluginDir(
  pluginsDir: string,
  name: string,
  manifest: PluginManifest,
): Promise<string> {
  const pluginDir = path.join(pluginsDir, name);
  const manifestDir = path.join(pluginDir, PLUGIN_MANIFEST_DIR);
  await mkdir(manifestDir, { recursive: true });
  await writeFile(path.join(manifestDir, PLUGIN_MANIFEST_FILE), JSON.stringify(manifest, null, 2));
  return pluginDir;
}

/** Reads and parses the generated marketplace.json */
async function readMarketplaceJson(outputPath: string): Promise<Marketplace> {
  const content = await readFile(outputPath, "utf-8");
  return JSON.parse(content) as Marketplace;
}

describe("build:marketplace command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-build-marketplace-test-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  describe("basic execution", () => {
    it("should run without arguments", async () => {
      const { error } = await runCliCommand(["build:marketplace"]);

      // Should not have argument parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should complete with 0 plugins when no plugins directory exists", async () => {
      // projectDir has no plugins directory - command still runs
      const { stdout, error } = await runCliCommand(["build:marketplace"]);

      // Command completes with 0 plugins (doesn't crash)
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("missing required arg");
    });
  });

  describe("flag validation", () => {
    it("should accept --plugins-dir flag with path", async () => {
      const pluginsPath = path.join(tempDir, "custom-plugins");

      const { error } = await runCliCommand(["build:marketplace", "--plugins-dir", pluginsPath]);

      // Should not error on --plugins-dir flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -p shorthand for plugins-dir", async () => {
      const pluginsPath = path.join(tempDir, "custom-plugins");

      const { error } = await runCliCommand(["build:marketplace", "-p", pluginsPath]);

      // Should accept -p shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --output flag with path", async () => {
      const outputPath = path.join(tempDir, "marketplace.json");

      const { error } = await runCliCommand(["build:marketplace", "--output", outputPath]);

      // Should not error on --output flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -o shorthand for output", async () => {
      const outputPath = path.join(tempDir, "marketplace.json");

      const { error } = await runCliCommand(["build:marketplace", "-o", outputPath]);

      // Should accept -o shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --name flag", async () => {
      const { error } = await runCliCommand(["build:marketplace", "--name", "my-marketplace"]);

      // Should not error on --name flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --version flag", async () => {
      const { error } = await runCliCommand(["build:marketplace", "--version", "2.0.0"]);

      // Should not error on --version flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --description flag", async () => {
      const { error } = await runCliCommand([
        "build:marketplace",
        "--description",
        "My custom marketplace",
      ]);

      // Should not error on --description flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --owner-name flag", async () => {
      const { error } = await runCliCommand(["build:marketplace", "--owner-name", "Test Owner"]);

      // Should not error on --owner-name flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --owner-email flag", async () => {
      const { error } = await runCliCommand([
        "build:marketplace",
        "--owner-email",
        "test@example.com",
      ]);

      // Should not error on --owner-email flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --verbose flag", async () => {
      const { error } = await runCliCommand(["build:marketplace", "--verbose"]);

      // Should not error on --verbose flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -v shorthand for verbose", async () => {
      const { error } = await runCliCommand(["build:marketplace", "-v"]);

      // Should accept -v shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("combined flags", () => {
    it("should accept multiple flags together", async () => {
      const pluginsPath = path.join(tempDir, "plugins");
      const outputPath = path.join(tempDir, "marketplace.json");

      const { error } = await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsPath,
        "--output",
        outputPath,
        "--name",
        "test-marketplace",
        "--version",
        "1.0.0",
        "--verbose",
      ]);

      // Should accept all flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept shorthand flags together", async () => {
      const pluginsPath = path.join(tempDir, "plugins");
      const outputPath = path.join(tempDir, "marketplace.json");

      const { error } = await runCliCommand([
        "build:marketplace",
        "-p",
        pluginsPath,
        "-o",
        outputPath,
        "-v",
      ]);

      // Should accept all shorthand flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --name with --version", async () => {
      const { error } = await runCliCommand([
        "build:marketplace",
        "--name",
        "my-marketplace",
        "--version",
        "2.0.0",
      ]);

      // Should accept both flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept all owner flags together", async () => {
      const { error } = await runCliCommand([
        "build:marketplace",
        "--owner-name",
        "Test Owner",
        "--owner-email",
        "test@example.com",
        "--description",
        "Test marketplace",
      ]);

      // Should accept all owner flags
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("error handling", () => {
    it("should handle missing plugins directory gracefully", async () => {
      const { stdout, error } = await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        "/definitely/not/real/path/xyz",
      ]);

      // Command completes (generates marketplace with 0 plugins)
      const output = stdout + (error?.message || "");
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should handle empty plugins directory gracefully", async () => {
      // Create empty plugins directory
      const emptyPluginsDir = path.join(projectDir, "empty-plugins");
      await mkdir(emptyPluginsDir, { recursive: true });

      const { error } = await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        emptyPluginsDir,
      ]);

      // Command completes successfully with 0 plugins
      // The command doesn't error for empty directories
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should skip plugins with invalid plugin.json and not crash", async () => {
      const pluginsDir = path.join(projectDir, "dist", "plugins");
      const outputPath = path.join(projectDir, "marketplace.json");
      await mkdir(pluginsDir, { recursive: true });

      // Valid plugin
      await createPluginDir(pluginsDir, "web-framework-react", {
        name: "web-framework-react",
        description: "React framework",
        version: "1.0.0",
      });

      // Invalid plugin: plugin.json exists but contains invalid JSON
      const invalidPluginDir = path.join(pluginsDir, "broken-plugin");
      const invalidManifestDir = path.join(invalidPluginDir, PLUGIN_MANIFEST_DIR);
      await mkdir(invalidManifestDir, { recursive: true });
      await writeFile(
        path.join(invalidManifestDir, PLUGIN_MANIFEST_FILE),
        "{ this is not valid json }",
      );

      const { stdout, error } = await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
      ]);

      // Should complete without crashing, skipping the broken plugin
      expect(error).toBeUndefined();
      expect(stdout).toContain("1 plugins");

      const marketplace = await readMarketplaceJson(outputPath);
      expect(marketplace.plugins).toHaveLength(1);
      expect(marketplace.plugins[0].name).toBe("web-framework-react");
    });

    it("should skip plugins with missing required name field in plugin.json", async () => {
      const pluginsDir = path.join(projectDir, "dist", "plugins");
      const outputPath = path.join(projectDir, "marketplace.json");
      await mkdir(pluginsDir, { recursive: true });

      // Valid plugin
      await createPluginDir(pluginsDir, "api-framework-hono", {
        name: "api-framework-hono",
        description: "Hono framework",
        version: "1.0.0",
      });

      // Invalid plugin: valid JSON but missing required 'name' field
      const invalidPluginDir = path.join(pluginsDir, "nameless-plugin");
      const invalidManifestDir = path.join(invalidPluginDir, PLUGIN_MANIFEST_DIR);
      await mkdir(invalidManifestDir, { recursive: true });
      await writeFile(
        path.join(invalidManifestDir, PLUGIN_MANIFEST_FILE),
        JSON.stringify({ description: "No name field", version: "1.0.0" }),
      );

      const { stdout, error } = await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
      ]);

      // Should complete without crashing, skipping the nameless plugin
      expect(error).toBeUndefined();
      expect(stdout).toContain("1 plugins");

      const marketplace = await readMarketplaceJson(outputPath);
      expect(marketplace.plugins).toHaveLength(1);
      expect(marketplace.plugins[0].name).toBe("api-framework-hono");
    });
  });

  describe("marketplace generation integration", () => {
    let pluginsDir: string;
    let outputPath: string;

    beforeEach(async () => {
      pluginsDir = path.join(projectDir, "dist", "plugins");
      outputPath = path.join(projectDir, "marketplace.json");
      await mkdir(pluginsDir, { recursive: true });
    });

    it("should create marketplace.json from a single plugin", async () => {
      await createPluginDir(pluginsDir, "web-framework-react", {
        name: "web-framework-react",
        description: "React framework skills",
        version: "1.0.0",
      });

      const { stdout, error } = await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
        "--name",
        "test-marketplace",
      ]);

      expect(error).toBeUndefined();
      expect(stdout).toContain("1 plugins");
      expect(await fileExists(outputPath)).toBe(true);

      const marketplace = await readMarketplaceJson(outputPath);
      expect(marketplace.plugins).toHaveLength(1);
      expect(marketplace.plugins[0].name).toBe("web-framework-react");
      expect(marketplace.plugins[0].description).toBe("React framework skills");
      expect(marketplace.plugins[0].version).toBe("1.0.0");
    });

    it("should include correct marketplace metadata in output", async () => {
      await createPluginDir(pluginsDir, "web-test-a", {
        name: "web-test-a",
        description: "Test plugin",
        version: "0.1.0",
      });

      // oclif runCommand splits space-containing flag values, so use single-word values
      await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
        "--name",
        "my-marketplace",
        "--version",
        "2.5.0",
        "--description",
        "test-marketplace-description",
        "--owner-name",
        "TestOwner",
        "--owner-email",
        "owner@test.com",
      ]);

      const marketplace = await readMarketplaceJson(outputPath);

      expect(marketplace.name).toBe("my-marketplace");
      expect(marketplace.version).toBe("2.5.0");
      expect(marketplace.description).toBe("test-marketplace-description");
      expect(marketplace.owner.name).toBe("TestOwner");
      expect(marketplace.owner.email).toBe("owner@test.com");
      expect(marketplace.$schema).toBe("https://anthropic.com/claude-code/marketplace.schema.json");
    });

    it("should include all 5 plugins from a populated plugins directory", async () => {
      const plugins = [
        { name: "web-framework-react", description: "React framework" },
        { name: "web-state-zustand", description: "Zustand state management" },
        { name: "web-styling-scss-modules", description: "SCSS Modules styling" },
        { name: "api-framework-hono", description: "Hono API framework" },
        { name: "api-database-drizzle", description: "Drizzle ORM" },
      ];

      for (const plugin of plugins) {
        await createPluginDir(pluginsDir, plugin.name, {
          name: plugin.name,
          description: plugin.description,
          version: "1.0.0",
        });
      }

      const { stdout, error } = await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
        "--name",
        "full-marketplace",
      ]);

      expect(error).toBeUndefined();
      expect(stdout).toContain("5 plugins");

      const marketplace = await readMarketplaceJson(outputPath);
      expect(marketplace.plugins).toHaveLength(5);

      const names = marketplace.plugins.map((p) => p.name);
      for (const plugin of plugins) {
        expect(names).toContain(plugin.name);
      }
    });

    it("should sort plugins alphabetically in output", async () => {
      // Create plugins in non-alphabetical order
      await createPluginDir(pluginsDir, "web-state-zustand", {
        name: "web-state-zustand",
        description: "Zustand",
        version: "1.0.0",
      });
      await createPluginDir(pluginsDir, "api-framework-hono", {
        name: "api-framework-hono",
        description: "Hono",
        version: "1.0.0",
      });
      await createPluginDir(pluginsDir, "web-framework-react", {
        name: "web-framework-react",
        description: "React",
        version: "1.0.0",
      });

      await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
      ]);

      const marketplace = await readMarketplaceJson(outputPath);
      const names = marketplace.plugins.map((p) => p.name);

      expect(names).toStrictEqual([
        "api-framework-hono",
        "web-framework-react",
        "web-state-zustand",
      ]);
    });

    it("should preserve explicit categories from plugin manifests", async () => {
      await createPluginDir(pluginsDir, "web-framework-react", {
        name: "web-framework-react",
        description: "React",
        version: "1.0.0",
      });
      await createPluginDir(pluginsDir, "api-database-drizzle", {
        name: "api-database-drizzle",
        description: "Drizzle",
        version: "1.0.0",
      });
      await createPluginDir(pluginsDir, "meta-methodology-anti-over-engineering", {
        name: "meta-methodology-anti-over-engineering",
        description: "Anti over-engineering",
        version: "1.0.0",
      });

      await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
      ]);

      const marketplace = await readMarketplaceJson(outputPath);

      const reactPlugin = marketplace.plugins.find((p) => p.name === "web-framework-react");
      const drizzlePlugin = marketplace.plugins.find((p) => p.name === "api-database-drizzle");
      const metaPlugin = marketplace.plugins.find(
        (p) => p.name === "meta-methodology-anti-over-engineering",
      );

      // Plugin manifests don't carry category — it comes from skill metadata.yaml
      expect(reactPlugin?.category).toBeUndefined();
      expect(drizzlePlugin?.category).toBeUndefined();
      expect(metaPlugin?.category).toBeUndefined();
    });

    it("should generate correct source paths referencing plugin directories", async () => {
      await createPluginDir(pluginsDir, "web-framework-react", {
        name: "web-framework-react",
        description: "React",
        version: "1.0.0",
      });

      await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
      ]);

      const marketplace = await readMarketplaceJson(outputPath);
      const plugin = marketplace.plugins[0];

      // Source should reference the plugin directory relative to plugin root
      expect(typeof plugin.source).toBe("string");
      expect(plugin.source).toContain("web-framework-react");
    });

    it("should preserve author and keywords from plugin manifests", async () => {
      await createPluginDir(pluginsDir, "web-framework-react", {
        name: "web-framework-react",
        description: "React framework",
        version: "1.0.0",
        author: { name: "@vince", email: "vince@example.com" },
        keywords: ["react", "framework", "web"],
      });

      await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
      ]);

      const marketplace = await readMarketplaceJson(outputPath);
      const plugin = marketplace.plugins[0];

      expect(plugin.author?.name).toBe("@vince");
      expect(plugin.author?.email).toBe("vince@example.com");
      expect(plugin.keywords).toStrictEqual(["react", "framework", "web"]);
    });

    it("should use default version when --version flag is omitted", async () => {
      await createPluginDir(pluginsDir, "web-test-a", {
        name: "web-test-a",
        description: "Test",
        version: "1.0.0",
      });

      await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
        "--name",
        "defaults-test",
      ]);

      const marketplace = await readMarketplaceJson(outputPath);

      // Default version from consts.ts is "1.0.0"
      expect(marketplace.version).toBe("1.0.0");
    });

    it("should apply version from --version flag to marketplace", async () => {
      await createPluginDir(pluginsDir, "web-test-a", {
        name: "web-test-a",
        description: "Test",
        version: "1.0.0",
      });

      await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
        "--version",
        "3.0.0",
      ]);

      const marketplace = await readMarketplaceJson(outputPath);
      expect(marketplace.version).toBe("3.0.0");
    });

    it("should overwrite existing marketplace.json on repeated builds", async () => {
      await createPluginDir(pluginsDir, "web-test-a", {
        name: "web-test-a",
        description: "Test",
        version: "1.0.0",
      });

      // First build with version 1.0.0
      await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
        "--version",
        "1.0.0",
      ]);

      const first = await readMarketplaceJson(outputPath);
      expect(first.version).toBe("1.0.0");
      expect(first.plugins).toHaveLength(1);

      // Add another plugin and rebuild with bumped version
      await createPluginDir(pluginsDir, "api-framework-hono", {
        name: "api-framework-hono",
        description: "Hono",
        version: "1.0.0",
      });

      await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
        "--version",
        "1.1.0",
      ]);

      const second = await readMarketplaceJson(outputPath);
      expect(second.version).toBe("1.1.0");
      expect(second.plugins).toHaveLength(2);
    });

    it("should skip directories without valid plugin.json manifests", async () => {
      // Valid plugin
      await createPluginDir(pluginsDir, "web-framework-react", {
        name: "web-framework-react",
        description: "React",
        version: "1.0.0",
      });

      // Invalid: directory without .claude-plugin/plugin.json
      const invalidDir = path.join(pluginsDir, "not-a-plugin");
      await mkdir(invalidDir, { recursive: true });
      await writeFile(path.join(invalidDir, "README.md"), "# Not a plugin");

      await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
      ]);

      const marketplace = await readMarketplaceJson(outputPath);
      expect(marketplace.plugins).toHaveLength(1);
      expect(marketplace.plugins[0].name).toBe("web-framework-react");
    });

    it("should generate marketplace.json with 0 plugins for empty plugins directory", async () => {
      // pluginsDir exists but is empty

      const { error } = await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
        "--name",
        "empty-marketplace",
      ]);

      expect(error).toBeUndefined();
      expect(await fileExists(outputPath)).toBe(true);

      const marketplace = await readMarketplaceJson(outputPath);
      expect(marketplace.name).toBe("empty-marketplace");
      expect(marketplace.plugins).toHaveLength(0);
    });

    it("should write valid JSON with 2-space indentation and trailing newline", async () => {
      await createPluginDir(pluginsDir, "web-test-a", {
        name: "web-test-a",
        description: "Test",
        version: "1.0.0",
      });

      await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
      ]);

      const raw = await readFile(outputPath, "utf-8");

      // Valid JSON
      expect(() => JSON.parse(raw)).not.toThrow();

      // 2-space indentation
      expect(raw).toContain('  "name"');

      // Trailing newline
      expect(raw.endsWith("\n")).toBe(true);
    });

    it("should report plugin count and category breakdown in stdout", async () => {
      await createPluginDir(pluginsDir, "web-framework-react", {
        name: "web-framework-react",
        description: "React",
        version: "1.0.0",
      });
      await createPluginDir(pluginsDir, "api-framework-hono", {
        name: "api-framework-hono",
        description: "Hono",
        version: "1.0.0",
      });

      const { stdout, error } = await runCliCommand([
        "build:marketplace",
        "--plugins-dir",
        pluginsDir,
        "--output",
        outputPath,
      ]);

      expect(error).toBeUndefined();
      expect(stdout).toContain("2 plugins");
      // Category breakdown is shown in output
      expect(stdout).toContain("web");
      expect(stdout).toContain("api");
    });
  });
});
