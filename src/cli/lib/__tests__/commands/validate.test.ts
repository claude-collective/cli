import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { stringify as stringifyYaml } from "yaml";
import { runCliCommand, createTempDir, cleanupTempDir } from "../helpers";
import { validateSource } from "../../source-validator";
import { STANDARD_FILES } from "../../../consts";

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

/**
 * Creates a valid skill directory with full metadata.yaml fields
 * that pass the strict metadataValidationSchema.
 */
async function writeValidSourceSkill(
  skillsDir: string,
  dirPath: string,
  config: {
    id: string;
    description: string;
    category: string;
    cliName: string;
    cliDescription: string;
    usageGuidance: string;
    author?: string;
    tags?: string[];
    categoryExclusive?: boolean;
  },
): Promise<void> {
  const skillDir = path.join(skillsDir, dirPath);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    `---\nname: ${config.id}\ndescription: ${config.description}\n---\n\n# ${config.id}\n\n${config.description}\n`,
  );

  const metadata: Record<string, unknown> = {
    category: config.category,
    author: config.author ?? "@test",
    cliName: config.cliName,
    cliDescription: config.cliDescription,
    usageGuidance: config.usageGuidance,
  };
  if (config.tags) metadata.tags = config.tags;
  if (config.categoryExclusive !== undefined) metadata.categoryExclusive = config.categoryExclusive;

  await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), stringifyYaml(metadata));
}

/** Creates a minimal skills-matrix.yaml with the given categories */
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

  const matrix = {
    version: "1.0.0",
    categories: matrixCategories,
    relationships: {
      conflicts: [],
      discourages: [],
      recommends: [],
      requires: [],
      alternatives: [],
    },
    skillAliases: {},
  };

  await writeFile(path.join(configDir, "skills-matrix.yaml"), stringifyYaml(matrix));
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
    const skillsDir = path.join(sourceDir, "src", "skills");
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    await writeValidSourceSkill(skillsDir, "web/framework/react", {
      id: "web-framework-react",
      description: "React framework",
      category: "web-framework",
      cliName: "react",
      cliDescription: "React JavaScript framework",
      usageGuidance: "Use React for building component-based UIs",
      tags: ["react", "web"],
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
    const skillsDir = path.join(sourceDir, "src", "skills");
    const skillDir = path.join(skillsDir, "web", "framework", "react");
    await mkdir(skillDir, { recursive: true });

    // Write metadata.yaml without SKILL.md
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      stringifyYaml({
        category: "web-framework",
        author: "@test",
        cliName: "react",
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
    const skillsDir = path.join(sourceDir, "src", "skills");
    const skillDir = path.join(skillsDir, "web", "framework", "react");
    await mkdir(skillDir, { recursive: true });

    // Write SKILL.md without metadata.yaml
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      "---\nname: web-framework-react\ndescription: React\n---\n\n# React\n",
    );

    const result = await validateSource(sourceDir);

    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.message.includes("Missing metadata.yaml"))).toBe(true);
  });

  it("should report errors for invalid metadata schema violations", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", "skills");
    const skillDir = path.join(skillsDir, "web", "framework", "react");
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      "---\nname: web-framework-react\ndescription: React\n---\n\n# React\n",
    );

    // Missing required fields: cliName, cliDescription, usageGuidance
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
    const skillsDir = path.join(sourceDir, "src", "skills");
    const skillDir = path.join(skillsDir, "web", "framework", "react");
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      "---\nname: web-framework-react\ndescription: React\n---\n\n# React\n",
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

  it("should report warning when cliName does not match directory name", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", "skills");
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    // Directory name is "react" but cliName is "react-v2"
    await writeValidSourceSkill(skillsDir, "web/framework/react", {
      id: "web-framework-react",
      description: "React framework",
      category: "web-framework",
      cliName: "react-v2",
      cliDescription: "React JavaScript framework v2",
      usageGuidance: "Use React for building component-based UIs",
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

  it("should report cross-reference errors for unresolved skill references", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", "skills");
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    // Create skill directory manually with a reference to non-existent skill
    const skillDir = path.join(skillsDir, "web", "framework", "react");
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      "---\nname: web-framework-react\ndescription: React\n---\n\n# React\n",
    );

    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      stringifyYaml({
        category: "web-framework",
        author: "@test",
        cliName: "react",
        cliDescription: "React JavaScript framework",
        usageGuidance: "Use React for building component-based UIs",
        compatibleWith: ["web-state-nonexistent"],
      }),
    );

    await writeTestMatrix(configDir, {
      "web-framework": { domain: "web", displayName: "Framework" },
    });

    const result = await validateSource(sourceDir);

    const crossRefIssues = result.issues.filter((i) => i.message.includes("unresolved reference"));
    expect(crossRefIssues.length).toBeGreaterThan(0);
  });

  it("should validate multiple skills and count them correctly", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", "skills");
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    await writeValidSourceSkill(skillsDir, "web/framework/react", {
      id: "web-framework-react",
      description: "React framework",
      category: "web-framework",
      cliName: "react",
      cliDescription: "React JavaScript framework",
      usageGuidance: "Use React for building component-based UIs",
    });

    await writeValidSourceSkill(skillsDir, "api/api/hono", {
      id: "api-framework-hono",
      description: "Hono framework",
      category: "api-api",
      cliName: "hono",
      cliDescription: "Lightweight web framework for the edge",
      usageGuidance: "Use Hono for building edge-first APIs",
    });

    await writeTestMatrix(configDir, {
      "web-framework": { domain: "web", displayName: "Framework" },
      "api-api": { domain: "api", displayName: "API Framework" },
    });

    const result = await validateSource(sourceDir);

    expect(result.skillCount).toBe(2);
    expect(result.errorCount).toBe(0);
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
    const skillsDir = path.join(sourceDir, "src", "skills");
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    await writeValidSourceSkill(skillsDir, "web/framework/react", {
      id: "web-framework-react",
      description: "React framework",
      category: "web-framework",
      cliName: "react",
      cliDescription: "React JavaScript framework",
      usageGuidance: "Use React for building component-based UIs",
    });

    await writeTestMatrix(configDir, {
      "web-framework": { domain: "web", displayName: "Framework" },
    });

    const { stdout, error } = await runCliCommand(["validate", "--source", sourceDir]);

    expect(error).toBeUndefined();
    expect(stdout).toContain("Validating source");
    expect(stdout).toContain("Checked 1 skill(s)");
    expect(stdout).toContain("Source validated successfully");
  });

  it("should exit with error when source has invalid metadata", async () => {
    const sourceDir = path.join(tempDir, "source");
    const skillsDir = path.join(sourceDir, "src", "skills");
    const skillDir = path.join(skillsDir, "web", "framework", "react");
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      "---\nname: web-framework-react\ndescription: React\n---\n\n# React\n",
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
    const skillsDir = path.join(sourceDir, "src", "skills");
    const configDir = path.join(sourceDir, "config");
    await mkdir(configDir, { recursive: true });

    await writeValidSourceSkill(skillsDir, "web/framework/react", {
      id: "web-framework-react",
      description: "React framework",
      category: "web-framework",
      cliName: "react",
      cliDescription: "React JavaScript framework",
      usageGuidance: "Use React for building component-based UIs",
    });

    await writeTestMatrix(configDir, {
      "web-framework": { domain: "web", displayName: "Framework" },
    });

    const { stdout, error } = await runCliCommand(["validate", "-s", sourceDir]);

    expect(error).toBeUndefined();
    expect(stdout).toContain("Validating source");
  });
});
