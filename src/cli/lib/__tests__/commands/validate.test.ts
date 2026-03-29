import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { stringify as stringifyYaml } from "yaml";
import { runCliCommand, createTempDir, cleanupTempDir } from "../helpers";
import { validateSource } from "../../source-validator";
import { validatePlugin } from "../../plugins/plugin-validator";
import {
  PLUGIN_MANIFEST_DIR,
  PLUGIN_MANIFEST_FILE,
  STANDARD_DIRS,
  STANDARD_FILES,
} from "../../../consts";
import type { TestSkill } from "../fixtures/create-test-source";
import { renderConfigTs, renderSkillMd } from "../content-generators";

describe("validate command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-validate-test-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
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
      const pluginManifestDir = path.join(projectDir, PLUGIN_MANIFEST_DIR);
      await mkdir(pluginManifestDir, { recursive: true });
      await writeFile(
        path.join(pluginManifestDir, PLUGIN_MANIFEST_FILE),
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
      const pluginManifestDir = path.join(pluginPath, PLUGIN_MANIFEST_DIR);
      await mkdir(pluginManifestDir, { recursive: true });

      await writeFile(
        path.join(pluginManifestDir, PLUGIN_MANIFEST_FILE),
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
      const plugin1Dir = path.join(pluginsDir, "plugin1", PLUGIN_MANIFEST_DIR);
      const plugin2Dir = path.join(pluginsDir, "plugin2", PLUGIN_MANIFEST_DIR);

      await mkdir(plugin1Dir, { recursive: true });
      await mkdir(plugin2Dir, { recursive: true });

      await writeFile(
        path.join(plugin1Dir, PLUGIN_MANIFEST_FILE),
        JSON.stringify({ name: "plugin1", version: "1.0.0" }),
      );
      await writeFile(
        path.join(plugin2Dir, PLUGIN_MANIFEST_FILE),
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
      const pluginManifestDir = path.join(projectDir, PLUGIN_MANIFEST_DIR);
      await mkdir(pluginManifestDir, { recursive: true });
      await writeFile(
        path.join(pluginManifestDir, PLUGIN_MANIFEST_FILE),
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

    it("should report specific error for malformed plugin.json (invalid JSON)", async () => {
      const pluginManifestDir = path.join(projectDir, PLUGIN_MANIFEST_DIR);
      await mkdir(pluginManifestDir, { recursive: true });
      await writeFile(path.join(pluginManifestDir, PLUGIN_MANIFEST_FILE), "{ not valid json !!!");

      const result = await validatePlugin(projectDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Invalid JSON"))).toBe(true);
    });

    it("should not crash when validating directory with malformed plugin.json via CLI", async () => {
      const pluginManifestDir = path.join(projectDir, PLUGIN_MANIFEST_DIR);
      await mkdir(pluginManifestDir, { recursive: true });
      await writeFile(path.join(pluginManifestDir, PLUGIN_MANIFEST_FILE), "<<<broken>>>");

      const { error } = await runCliCommand(["validate", "--plugins"]);

      // Should exit with a validation error, not an unhandled crash
      expect(error?.oclif?.exit).toBeDefined();
    });
  });
});

/**
 * Creates a valid skill directory with full metadata.yaml fields
 * that pass the strict metadataValidationSchema.
 */
async function writeValidSourceSkill(
  skillsDir: string,
  dirPath: string,
  config: TestSkill,
): Promise<void> {
  const skillDir = path.join(skillsDir, dirPath);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    renderSkillMd(config.id, config.description),
  );

  const domain = config.domain;
  const slug = config.slug;
  const metadata: Record<string, unknown> = {
    category: config.category,
    domain,
    author: config.author ?? "@test",
    displayName: config.displayName,
    cliDescription: config.cliDescription,
    usageGuidance: config.usageGuidance,
    slug,
  };

  await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), stringifyYaml(metadata));
}

/** Creates minimal skill-categories.ts and skill-rules.ts with the given categories */
async function writeTestMatrix(
  configDir: string,
  categories: Record<string, { domain: string; displayName: string }>,
): Promise<void> {
  const matrixCategories: Record<string, Record<string, unknown>> = {};
  let order = 0;
  for (const [id, cat] of Object.entries(categories)) {
    matrixCategories[id] = {
      id,
      displayName: cat.displayName,
      description: `${cat.displayName} skills`,
      domain: cat.domain,
      exclusive: true,
      required: false,
      order: order++,
    };
  }

  const categoriesData = { version: "1.0.0", categories: matrixCategories };
  await writeFile(path.join(configDir, "skill-categories.ts"), renderConfigTs(categoriesData));

  const rulesData = {
    version: "1.0.0",
    relationships: {
      conflicts: [],
      discourages: [],
      recommends: [],
      requires: [],
      alternatives: [],
    },
  };
  await writeFile(path.join(configDir, "skill-rules.ts"), renderConfigTs(rulesData));
}

describe("source validation (validateSource)", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("cc-validate-source-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("should report error for non-existent source directory", async () => {
    const result = await validateSource(path.join(tempDir, "nonexistent"));

    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.issues[0].message).toContain("does not exist");
  });

  it("should report error when skills directory is missing", async () => {
    const sourceDir = path.join(tempDir, "source");
    await mkdir(sourceDir, { recursive: true });

    const result = await validateSource(sourceDir);

    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.issues[0].message).toContain("Skills directory does not exist");
  });

  it("should pass validation for a valid source", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    await writeValidSourceSkill(skillsDir, "web/framework/react", {
      id: "web-framework-react",
      description: "React framework",
      category: "web-framework",
      domain: "web",
      displayName: "react",
      cliDescription: "React JavaScript framework",
      usageGuidance: "Use React for building component-based UIs",
      slug: "react",
      author: "@test",
    });

    await writeTestMatrix(configDir, {
      "web-framework": { domain: "web", displayName: "Framework" },
    });

    const result = await validateSource(sourceDir);

    expect(result.skillCount).toBe(1);
    expect(result.errorCount).toBe(0);
  });

  it("should report error when SKILL.md is missing", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
    const skillDir = path.join(skillsDir, "web", "framework", "react");
    await mkdir(skillDir, { recursive: true });

    // Write metadata.yaml without SKILL.md
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      stringifyYaml({
        category: "web-framework",
        domain: "web",
        author: "@test",
        displayName: "react",
        cliDescription: "React framework",
        usageGuidance: "Use React for building UIs",
      }),
    );

    const result = await validateSource(sourceDir);

    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.message.includes("Missing SKILL.md"))).toBe(true);
  });

  it("should report error when metadata.yaml is missing", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
    const skillDir = path.join(skillsDir, "web", "framework", "react");
    await mkdir(skillDir, { recursive: true });

    // Write SKILL.md without metadata.yaml
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React"),
    );

    const result = await validateSource(sourceDir);

    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.message.includes("Missing metadata.yaml"))).toBe(true);
  });

  it("should report errors for invalid metadata schema violations", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
    const skillDir = path.join(skillsDir, "web", "framework", "react");
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React"),
    );

    // Missing required fields: displayName, cliDescription, usageGuidance
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      stringifyYaml({
        category: "web-framework",
        author: "@test",
      }),
    );

    const result = await validateSource(sourceDir);

    expect(result.errorCount).toBeGreaterThan(0);
  });

  it("should report error for snake_case keys in metadata", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
    const skillDir = path.join(skillsDir, "web", "framework", "react");
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React"),
    );

    // Use snake_case key instead of camelCase
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      stringifyYaml({
        category: "web-framework",
        author: "@test",
        cli_name: "react",
        cli_description: "React framework",
        usage_guidance: "Use React for building UIs",
      }),
    );

    const result = await validateSource(sourceDir);

    const snakeCaseIssues = result.issues.filter((i) => i.message.includes("snake_case"));
    expect(snakeCaseIssues.length).toBeGreaterThan(0);
  });

  it("should report warning when displayName does not match directory name", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    // Directory name is "react" but displayName is "react-v2"
    await writeValidSourceSkill(skillsDir, "web/framework/react", {
      id: "web-framework-react",
      description: "React framework",
      category: "web-framework",
      domain: "web",
      displayName: "react-v2",
      cliDescription: "React JavaScript framework v2",
      usageGuidance: "Use React for building component-based UIs",
      slug: "react",
      author: "@test",
    });

    await writeTestMatrix(configDir, {
      "web-framework": { domain: "web", displayName: "Framework" },
    });

    const result = await validateSource(sourceDir);

    const mismatchIssues = result.issues.filter((i) =>
      i.message.includes("does not match directory name"),
    );
    expect(mismatchIssues.length).toBe(1);
    expect(mismatchIssues[0].severity).toBe("warning");
  });

  it("should drop unresolved skill references during resolution (no dangling refs in matrix)", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    // Create skill directory
    const skillDir = path.join(skillsDir, "web", "framework", "react");
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React"),
    );

    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      stringifyYaml({
        category: "web-framework",
        domain: "web",
        author: "@test",
        displayName: "react",
        cliDescription: "React JavaScript framework",
        usageGuidance: "Use React for building component-based UIs",
        slug: "react",
      }),
    );

    // Add a conflict rule referencing a non-existent skill
    const matrixCategories = {
      "web-framework": {
        id: "web-framework",
        displayName: "Framework",
        description: "Framework skills",
        domain: "web",
        exclusive: true,
        required: false,
        order: 0,
      },
    };

    const categoriesData = { version: "1.0.0", categories: matrixCategories };
    await writeFile(path.join(configDir, "skill-categories.ts"), renderConfigTs(categoriesData));

    const rulesData = {
      version: "1.0.0",
      relationships: {
        conflicts: [
          {
            skills: ["react", "angular-standalone"],
            reason: "Test conflict with nonexistent skill",
          },
        ],
        discourages: [],
        recommends: [],
        requires: [],
        alternatives: [],
      },
    };
    await writeFile(path.join(configDir, "skill-rules.ts"), renderConfigTs(rulesData));

    const result = await validateSource(sourceDir);

    // Unresolved slugs are now dropped during resolution (with a warning),
    // so no dangling references appear in the matrix health check
    const crossRefIssues = result.issues.filter((i) => i.message.includes("unresolved reference"));
    expect(crossRefIssues).toHaveLength(0);
  });

  it("should validate multiple skills and count them correctly", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    await writeValidSourceSkill(skillsDir, "web/framework/react", {
      id: "web-framework-react",
      description: "React framework",
      category: "web-framework",
      domain: "web",
      displayName: "react",
      cliDescription: "React JavaScript framework",
      usageGuidance: "Use React for building component-based UIs",
      slug: "react",
      author: "@test",
    });

    await writeValidSourceSkill(skillsDir, "api/api/hono", {
      id: "api-framework-hono",
      description: "Hono framework",
      category: "api-api",
      domain: "api",
      displayName: "hono",
      cliDescription: "Lightweight web framework for the edge",
      usageGuidance: "Use Hono for building edge-first APIs",
      slug: "hono",
      author: "@test",
    });

    await writeTestMatrix(configDir, {
      "web-framework": { domain: "web", displayName: "Framework" },
      "api-api": { domain: "api", displayName: "API Framework" },
    });

    const result = await validateSource(sourceDir);

    expect(result.skillCount).toBe(2);
    expect(result.errorCount).toBe(0);
  });

  it("should run cross-reference validation and report no issues for well-formed source", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    await writeValidSourceSkill(skillsDir, "web/framework/react", {
      id: "web-framework-react",
      description: "React framework",
      category: "web-framework",
      domain: "web",
      displayName: "react",
      cliDescription: "React JavaScript framework",
      usageGuidance: "Use React for building component-based UIs",
      slug: "react",
      author: "@test",
    });

    await writeTestMatrix(configDir, {
      "web-framework": { domain: "web", displayName: "Framework" },
    });

    const result = await validateSource(sourceDir);

    // Phase 3 cross-reference ran and found no issues
    expect(result.errorCount).toBe(0);
    // No cross-reference skipped warnings
    const crossRefSkipped = result.issues.filter((i) =>
      i.message.includes("Cross-reference validation skipped"),
    );
    expect(crossRefSkipped).toHaveLength(0);
  });

  it("should report warning when cross-reference validation cannot load matrix", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
    await mkdir(skillsDir, { recursive: true });

    // Create a valid skill but with a malformed categories config to trigger Phase 3 failure
    await writeValidSourceSkill(skillsDir, "web/framework/react", {
      id: "web-framework-react",
      description: "React framework",
      category: "web-framework",
      domain: "web",
      displayName: "react",
      cliDescription: "React JavaScript framework",
      usageGuidance: "Use React for building component-based UIs",
      slug: "react",
      author: "@test",
    });

    // Write a malformed categories file so loadSkillsMatrixFromSource throws
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });
    await writeFile(path.join(configDir, "skill-categories.ts"), "export default INVALID;");

    const result = await validateSource(sourceDir);

    // Phase 3 should gracefully catch the error and report a warning
    const crossRefWarnings = result.issues.filter((i) =>
      i.message.includes("Cross-reference validation skipped"),
    );
    expect(crossRefWarnings).toHaveLength(1);
    expect(crossRefWarnings[0].severity).toBe("warning");
  });

  it("should validate custom skills with non-standard categories without errors", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    // Create a skill with custom: true and a non-standard category
    const skillDir = path.join(skillsDir, "custom", "tools", "my-linter");
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("custom-tools-my-linter", "My custom linter skill"),
    );

    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      stringifyYaml({
        category: "custom-tools",
        domain: "custom",
        author: "@test",
        displayName: "my-linter",
        cliDescription: "A custom linting skill",
        usageGuidance: "Use this for custom linting checks on your codebase",
        slug: "my-linter",
        custom: true,
      }),
    );

    await writeTestMatrix(configDir, {});

    const result = await validateSource(sourceDir);

    // Custom skills should not fail schema validation for non-standard categories/slugs
    const schemaErrors = result.issues.filter(
      (i) => i.severity === "error" && i.file.includes("my-linter"),
    );
    expect(schemaErrors).toHaveLength(0);
  });
});

describe("validate --source integration", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-validate-source-int-");
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it("should accept --source flag and validate source", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    await writeValidSourceSkill(skillsDir, "web/framework/react", {
      id: "web-framework-react",
      description: "React framework",
      category: "web-framework",
      domain: "web",
      displayName: "react",
      cliDescription: "React JavaScript framework",
      usageGuidance: "Use React for building component-based UIs",
      slug: "react",
      author: "@test",
    });

    await writeTestMatrix(configDir, {
      "web-framework": { domain: "web", displayName: "Framework" },
    });

    const { stdout, error } = await runCliCommand(["validate", "--source", sourceDir]);

    expect(error).toBeUndefined();
    expect(stdout).toContain("Validating source");
    expect(stdout).toContain("Checked 1 skill(s)");
    expect(stdout).toContain("0 error(s)");
  });

  it("should exit with error when source has invalid metadata", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
    const skillDir = path.join(skillsDir, "web", "framework", "react");
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React"),
    );

    // Missing required fields
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      stringifyYaml({ category: "web-framework", author: "@test" }),
    );

    const { error } = await runCliCommand(["validate", "--source", sourceDir]);

    expect(error?.oclif?.exit).toBeDefined();
  });

  it("should exit with error for missing skills directory", async () => {
    const sourceDir = path.join(tempDir, "source");
    await mkdir(sourceDir, { recursive: true });

    const { error } = await runCliCommand(["validate", "--source", sourceDir]);

    expect(error?.oclif?.exit).toBeDefined();
  });

  it("should accept -s shorthand for source flag", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", STANDARD_DIRS.SKILLS);
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    await writeValidSourceSkill(skillsDir, "web/framework/react", {
      id: "web-framework-react",
      description: "React framework",
      category: "web-framework",
      domain: "web",
      displayName: "react",
      cliDescription: "React JavaScript framework",
      usageGuidance: "Use React for building component-based UIs",
      slug: "react",
      author: "@test",
    });

    await writeTestMatrix(configDir, {
      "web-framework": { domain: "web", displayName: "Framework" },
    });

    const { stdout, error } = await runCliCommand(["validate", "-s", sourceDir]);

    expect(error).toBeUndefined();
    expect(stdout).toContain("Validating source");
  });
});
