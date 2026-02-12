import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { runCliCommand } from "../helpers";

describe("validate command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-validate-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("schema validation (default)", () => {
    it("should run schema validation when no args provided", async () => {
      const { error } = await runCliCommand(["validate"]);

      // Schema validation should complete without unhandled errors
      // (may exit 0 or with validation-specific codes, but not parsing errors)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should complete schema validation without argument errors", async () => {
      const { error } = await runCliCommand(["validate"]);

      // Should not fail due to argument parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("parse");
    });
  });

  describe("plugin validation (--plugins flag)", () => {
    it("should accept --plugins flag", async () => {
      const { error } = await runCliCommand(["validate", "--plugins"]);

      // Should not error on invalid flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -p shorthand for plugins", async () => {
      const { error } = await runCliCommand(["validate", "-p"]);

      // Should not error on shorthand flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should validate plugin at current directory with valid structure", async () => {
      // Create a minimal plugin structure
      const pluginManifestDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginManifestDir, { recursive: true });
      await writeFile(
        path.join(pluginManifestDir, "plugin.json"),
        JSON.stringify({
          name: "test-plugin",
          version: "1.0.0",
        }),
      );

      const { error } = await runCliCommand(["validate", "--plugins"]);

      // With valid plugin structure, should not have critical errors
      // (may have warnings, but not validation failures)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing .claude-plugin");
    });
  });

  describe("plugin validation (path argument)", () => {
    it("should accept path as first argument", async () => {
      const pluginPath = path.join(tempDir, "my-plugin");
      const pluginManifestDir = path.join(pluginPath, ".claude-plugin");
      await mkdir(pluginManifestDir, { recursive: true });

      await writeFile(
        path.join(pluginManifestDir, "plugin.json"),
        JSON.stringify({
          name: "my-plugin",
          version: "1.0.0",
        }),
      );

      const { error } = await runCliCommand(["validate", pluginPath]);

      // Should accept path argument without parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --all flag", async () => {
      // Create plugins directory with multiple plugins
      const pluginsDir = path.join(tempDir, "plugins");
      const plugin1Dir = path.join(pluginsDir, "plugin1", ".claude-plugin");
      const plugin2Dir = path.join(pluginsDir, "plugin2", ".claude-plugin");

      await mkdir(plugin1Dir, { recursive: true });
      await mkdir(plugin2Dir, { recursive: true });

      await writeFile(
        path.join(plugin1Dir, "plugin.json"),
        JSON.stringify({ name: "plugin1", version: "1.0.0" }),
      );
      await writeFile(
        path.join(plugin2Dir, "plugin.json"),
        JSON.stringify({ name: "plugin2", version: "1.0.0" }),
      );

      const { error } = await runCliCommand(["validate", pluginsDir, "--all"]);

      // Should accept --all flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unexpected argument");
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -a shorthand for all", async () => {
      const pluginsDir = path.join(tempDir, "plugins");
      await mkdir(pluginsDir, { recursive: true });

      const { error } = await runCliCommand(["validate", pluginsDir, "-a"]);

      // Should accept -a shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("verbose mode", () => {
    it("should accept --verbose flag", async () => {
      const { error } = await runCliCommand(["validate", "--verbose"]);

      // Should not error on --verbose flag
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -v shorthand for verbose", async () => {
      const { error } = await runCliCommand(["validate", "-v"]);

      // Should accept -v shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --verbose with --plugins", async () => {
      // Create valid plugin structure to avoid validation errors
      const pluginManifestDir = path.join(projectDir, ".claude-plugin");
      await mkdir(pluginManifestDir, { recursive: true });
      await writeFile(
        path.join(pluginManifestDir, "plugin.json"),
        JSON.stringify({ name: "test-plugin", version: "1.0.0" }),
      );

      const { error } = await runCliCommand(["validate", "--plugins", "--verbose"]);

      // Should accept both flags together
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("error handling", () => {
    it("should exit with error for non-existent plugin path", async () => {
      const nonExistentPath = path.join(tempDir, "does-not-exist");

      const { error } = await runCliCommand(["validate", nonExistentPath]);

      // Should exit with error code when path doesn't exist
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should exit with error for invalid plugin structure", async () => {
      // Create directory without plugin.json
      const invalidPluginDir = path.join(tempDir, "invalid-plugin");
      await mkdir(invalidPluginDir, { recursive: true });

      const { error } = await runCliCommand(["validate", invalidPluginDir]);

      // Should exit with error when plugin.json is missing
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should fail validation when .claude-plugin directory is missing", async () => {
      // projectDir already exists but has no .claude-plugin
      const { error } = await runCliCommand(["validate", "--plugins"]);

      // Should fail because plugin structure is invalid
      expect(error?.oclif?.exit).toBeDefined();
    });
  });
});
