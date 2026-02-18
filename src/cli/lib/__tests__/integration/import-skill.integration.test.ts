import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { stringify as stringifyYaml, parse as parseYaml } from "yaml";
import {
  runCliCommand,
  fileExists,
  directoryExists,
  createTempDir,
  cleanupTempDir,
} from "../helpers";
import { compileSkillPlugin, compileAllSkillPlugins } from "../../skills";
import { validatePlugin } from "../../plugins";
import { EXIT_CODES } from "../../exit-codes";
import {
  IMPORT_REACT_PATTERNS_SKILL,
  IMPORT_TESTING_UTILS_SKILL,
  IMPORT_API_SECURITY_SKILL,
  type ImportSourceSkill,
} from "../fixtures/create-test-source";

// ── Constants ──────────────────────────────────────────────────────────────────

const LOCAL_SKILLS_DIR = ".claude/skills";
const SKILL_MD_FILE = "SKILL.md";
const METADATA_YAML_FILE = "metadata.yaml";
const PLUGIN_MANIFEST_DIR = ".claude-plugin";
const PLUGIN_MANIFEST_FILE = "plugin.json";

// Plain directory name (no slashes/colons) so parseGitHubSource passes it
// through as-is and fetchFromSource treats it as a local path relative to cwd
const LOCAL_SOURCE_NAME = "test-import-source";

// ── Test Source Builders ────────────────────────────────────────────────────────

async function createLocalSource(
  projectDir: string,
  skills: ImportSourceSkill[],
  options?: { subdir?: string },
): Promise<void> {
  const subdir = options?.subdir ?? "skills";
  const skillsDir = path.join(projectDir, LOCAL_SOURCE_NAME, subdir);

  for (const skill of skills) {
    const skillDir = path.join(skillsDir, skill.name);
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, SKILL_MD_FILE), skill.content);

    if (skill.metadata) {
      await writeFile(path.join(skillDir, METADATA_YAML_FILE), stringifyYaml(skill.metadata));
    }
  }
}

// ── Test Suites ────────────────────────────────────────────────────────────────

describe("Integration: Import Skill -> Compile Pipeline", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-import-integration-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it("should import a skill and compile it as a plugin", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Step 1: Create source with a skill
    await createLocalSource(projectDir, [IMPORT_REACT_PATTERNS_SKILL]);

    // Step 2: Import the skill
    const { error } = await runCliCommand([
      "import:skill",
      LOCAL_SOURCE_NAME,
      "--skill",
      "react-patterns",
    ]);
    expect(error?.oclif?.exit).toBeUndefined();

    // Step 3: Verify skill was imported to .claude/skills/
    const importedSkillDir = path.join(projectDir, LOCAL_SKILLS_DIR, "react-patterns");
    expect(await directoryExists(importedSkillDir)).toBe(true);
    expect(await fileExists(path.join(importedSkillDir, SKILL_MD_FILE))).toBe(true);

    // Step 4: Compile the imported skill as a plugin
    const outputDir = path.join(tempDir, "plugins");
    await mkdir(outputDir, { recursive: true });

    const result = await compileSkillPlugin({
      skillPath: importedSkillDir,
      outputDir,
    });

    // Step 5: Verify compiled plugin structure
    expect(result.skillName).toBe("react-patterns");
    expect(result.manifest.name).toBe("react-patterns");
    expect(result.manifest.description).toBe("React design patterns and best practices");
    expect(await directoryExists(result.pluginPath)).toBe(true);

    // Step 6: Verify plugin manifest
    const manifestPath = path.join(result.pluginPath, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE);
    expect(await fileExists(manifestPath)).toBe(true);

    const manifestContent = await readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent) as Record<string, unknown>;
    expect(manifest.name).toBe("react-patterns");
    expect(manifest.version).toBe("1.0.0");

    // Step 7: Verify compiled skill content is preserved
    const compiledSkillMd = path.join(result.pluginPath, "skills", "react-patterns", SKILL_MD_FILE);
    expect(await fileExists(compiledSkillMd)).toBe(true);

    const compiledContent = await readFile(compiledSkillMd, "utf-8");
    expect(compiledContent).toContain("React Patterns");
    expect(compiledContent).toContain("Component Composition");
    expect(compiledContent).toContain("Hooks Patterns");

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should import multiple skills and compile them all", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Step 1: Create source with multiple skills
    await createLocalSource(projectDir, [
      IMPORT_REACT_PATTERNS_SKILL,
      IMPORT_TESTING_UTILS_SKILL,
      IMPORT_API_SECURITY_SKILL,
    ]);

    // Step 2: Import all skills
    const { error } = await runCliCommand(["import:skill", LOCAL_SOURCE_NAME, "--all"]);
    expect(error?.oclif?.exit).toBeUndefined();

    // Step 3: Verify all skills were imported
    const skillNames = ["react-patterns", "testing-utils", "api-security"];
    for (const name of skillNames) {
      const skillDir = path.join(projectDir, LOCAL_SKILLS_DIR, name);
      expect(await directoryExists(skillDir)).toBe(true);
    }

    // Step 4: Compile all imported skills
    const importedSkillsDir = path.join(projectDir, LOCAL_SKILLS_DIR);
    const outputDir = path.join(tempDir, "plugins");
    await mkdir(outputDir, { recursive: true });

    const results = await compileAllSkillPlugins(importedSkillsDir, outputDir);

    // Step 5: Verify all skills compiled successfully
    expect(results).toHaveLength(3);

    const compiledNames = results.map((r) => r.skillName).sort();
    expect(compiledNames).toEqual(["api-security", "react-patterns", "testing-utils"]);

    // Step 6: Each compiled plugin should be valid
    for (const result of results) {
      expect(await directoryExists(result.pluginPath)).toBe(true);

      const manifestPath = path.join(result.pluginPath, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE);
      expect(await fileExists(manifestPath)).toBe(true);
    }

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should validate compiled plugin from imported skill", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Import a skill with metadata
    await createLocalSource(projectDir, [IMPORT_REACT_PATTERNS_SKILL]);

    const { error } = await runCliCommand([
      "import:skill",
      LOCAL_SOURCE_NAME,
      "--skill",
      "react-patterns",
    ]);
    expect(error?.oclif?.exit).toBeUndefined();

    // Compile it
    const importedSkillDir = path.join(projectDir, LOCAL_SKILLS_DIR, "react-patterns");
    const outputDir = path.join(tempDir, "plugins");
    await mkdir(outputDir, { recursive: true });

    const result = await compileSkillPlugin({
      skillPath: importedSkillDir,
      outputDir,
    });

    // Validate the compiled plugin
    const validation = await validatePlugin(result.pluginPath);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe("Integration: Import with --force and Recompile", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-import-force-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it("should overwrite and recompile with updated content", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Step 1: Import original version
    await createLocalSource(projectDir, [IMPORT_REACT_PATTERNS_SKILL]);

    const { error: firstError } = await runCliCommand([
      "import:skill",
      LOCAL_SOURCE_NAME,
      "--skill",
      "react-patterns",
    ]);
    expect(firstError?.oclif?.exit).toBeUndefined();

    // Step 2: Compile first version
    const importedSkillDir = path.join(projectDir, LOCAL_SKILLS_DIR, "react-patterns");
    const outputDir = path.join(tempDir, "plugins");
    await mkdir(outputDir, { recursive: true });

    const firstResult = await compileSkillPlugin({
      skillPath: importedSkillDir,
      outputDir,
    });
    expect(firstResult.manifest.version).toBe("1.0.0");

    // Step 3: Update the source skill with new content
    const updatedSkill = {
      ...IMPORT_REACT_PATTERNS_SKILL,
      content: `---
name: react-patterns
description: React design patterns and best practices (updated)
---

# React Patterns v2

## Server Components

Use React Server Components for improved performance.

## Suspense Patterns

Leverage Suspense for data fetching and code splitting.
`,
    };
    // Remove old source and recreate with updated content
    await rm(path.join(projectDir, LOCAL_SOURCE_NAME), { recursive: true, force: true });
    await createLocalSource(projectDir, [updatedSkill]);

    // Step 4: Import with --force to overwrite
    const { error: secondError } = await runCliCommand([
      "import:skill",
      LOCAL_SOURCE_NAME,
      "--skill",
      "react-patterns",
      "--force",
    ]);
    expect(secondError?.oclif?.exit).toBeUndefined();

    // Step 5: Verify updated content was imported
    const skillMdContent = await readFile(path.join(importedSkillDir, SKILL_MD_FILE), "utf-8");
    expect(skillMdContent).toContain("React Patterns v2");
    expect(skillMdContent).toContain("Server Components");

    // Step 6: Recompile and verify version bump
    const secondResult = await compileSkillPlugin({
      skillPath: importedSkillDir,
      outputDir,
    });

    // Content changed, so version should be bumped
    expect(secondResult.manifest.version).toBe("2.0.0");

    // Step 7: Verify compiled content reflects update
    const compiledSkillMd = path.join(
      secondResult.pluginPath,
      "skills",
      "react-patterns",
      SKILL_MD_FILE,
    );
    const compiledContent = await readFile(compiledSkillMd, "utf-8");
    expect(compiledContent).toContain("React Patterns v2");
    expect(compiledContent).toContain("Server Components");

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should skip import without --force and preserve compiled output", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Import original version
    await createLocalSource(projectDir, [IMPORT_REACT_PATTERNS_SKILL]);
    await runCliCommand(["import:skill", LOCAL_SOURCE_NAME, "--skill", "react-patterns"]);

    // Compile first version
    const importedSkillDir = path.join(projectDir, LOCAL_SKILLS_DIR, "react-patterns");
    const outputDir = path.join(tempDir, "plugins");
    await mkdir(outputDir, { recursive: true });

    await compileSkillPlugin({
      skillPath: importedSkillDir,
      outputDir,
    });

    // Record original SKILL.md content
    const originalContent = await readFile(path.join(importedSkillDir, SKILL_MD_FILE), "utf-8");

    // Try to import again WITHOUT --force
    const { error } = await runCliCommand([
      "import:skill",
      LOCAL_SOURCE_NAME,
      "--skill",
      "react-patterns",
    ]);
    // Command completes (skipping is not an error)
    expect(error?.oclif?.exit).toBeUndefined();

    // Content should be unchanged (original preserved)
    const afterContent = await readFile(path.join(importedSkillDir, SKILL_MD_FILE), "utf-8");
    expect(afterContent).toBe(originalContent);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe("Integration: Import with --subdir and Compile", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-import-subdir-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it("should import from custom subdirectory and compile successfully", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Create source with custom subdirectory
    await createLocalSource(projectDir, [IMPORT_API_SECURITY_SKILL], {
      subdir: "custom-skills",
    });

    // Import from custom subdir
    const { error } = await runCliCommand([
      "import:skill",
      LOCAL_SOURCE_NAME,
      "--skill",
      "api-security",
      "--subdir",
      "custom-skills",
    ]);
    expect(error?.oclif?.exit).toBeUndefined();

    // Verify import
    const importedDir = path.join(projectDir, LOCAL_SKILLS_DIR, "api-security");
    expect(await directoryExists(importedDir)).toBe(true);

    // Compile imported skill
    const outputDir = path.join(tempDir, "plugins");
    await mkdir(outputDir, { recursive: true });

    const result = await compileSkillPlugin({
      skillPath: importedDir,
      outputDir,
    });

    // Verify compiled output
    expect(result.skillName).toBe("api-security");

    const compiledSkillMd = path.join(result.pluginPath, "skills", "api-security", SKILL_MD_FILE);
    const content = await readFile(compiledSkillMd, "utf-8");
    expect(content).toContain("API Security");
    expect(content).toContain("Authentication");
    expect(content).toContain("Rate Limiting");

    // Validate the plugin
    const validation = await validatePlugin(result.pluginPath);
    expect(validation.valid).toBe(true);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe("Integration: Import Metadata Preservation Through Compilation", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-import-metadata-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it("should preserve forked_from metadata after import", async () => {
    await createLocalSource(projectDir, [IMPORT_REACT_PATTERNS_SKILL]);

    const { error } = await runCliCommand([
      "import:skill",
      LOCAL_SOURCE_NAME,
      "--skill",
      "react-patterns",
    ]);
    expect(error?.oclif?.exit).toBeUndefined();

    // Read injected metadata
    const metadataPath = path.join(
      projectDir,
      LOCAL_SKILLS_DIR,
      "react-patterns",
      METADATA_YAML_FILE,
    );
    expect(await fileExists(metadataPath)).toBe(true);

    const metadataContent = await readFile(metadataPath, "utf-8");
    const metadata = parseYaml(metadataContent) as Record<string, unknown>;

    // Verify forked_from was injected
    expect(metadata.forked_from).toBeDefined();
    const forkedFrom = metadata.forked_from as Record<string, unknown>;
    expect(forkedFrom.source).toBe(LOCAL_SOURCE_NAME);
    expect(forkedFrom.skill_name).toBe("react-patterns");
    expect(forkedFrom.content_hash).toBeDefined();
    expect(typeof forkedFrom.content_hash).toBe("string");
    expect((forkedFrom.content_hash as string).length).toBeGreaterThan(0);
    expect(forkedFrom.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Original metadata fields should be preserved
    expect(metadata.version).toBe(1);
    expect(metadata.author).toBe("@external-author");
  });

  it("should inject forked_from metadata for skills without existing metadata", async () => {
    // IMPORT_API_SECURITY_SKILL has no tags/metadata — toImportSourceSkill won't add metadata
    await createLocalSource(projectDir, [IMPORT_API_SECURITY_SKILL]);

    const { error } = await runCliCommand([
      "import:skill",
      LOCAL_SOURCE_NAME,
      "--skill",
      "api-security",
    ]);
    expect(error?.oclif?.exit).toBeUndefined();

    // A metadata.yaml should have been created with minimal metadata + forked_from
    const metadataPath = path.join(
      projectDir,
      LOCAL_SKILLS_DIR,
      "api-security",
      METADATA_YAML_FILE,
    );
    expect(await fileExists(metadataPath)).toBe(true);

    const metadataContent = await readFile(metadataPath, "utf-8");
    const metadata = parseYaml(metadataContent) as Record<string, unknown>;

    // Minimal metadata should be created
    expect(metadata.cli_name).toBe("Api Security");
    expect(metadata.cli_description).toBe("Imported from third-party repository");
    expect(metadata.forked_from).toBeDefined();

    const forkedFrom = metadata.forked_from as Record<string, unknown>;
    expect(forkedFrom.skill_name).toBe("api-security");
  });

  it("should use forked_from metadata tags in compiled plugin README", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await createLocalSource(projectDir, [IMPORT_REACT_PATTERNS_SKILL]);

    await runCliCommand(["import:skill", LOCAL_SOURCE_NAME, "--skill", "react-patterns"]);

    // Compile the imported skill
    const importedDir = path.join(projectDir, LOCAL_SKILLS_DIR, "react-patterns");
    const outputDir = path.join(tempDir, "plugins");
    await mkdir(outputDir, { recursive: true });

    const result = await compileSkillPlugin({
      skillPath: importedDir,
      outputDir,
    });

    // README should be generated
    const readmePath = path.join(result.pluginPath, "README.md");
    expect(await fileExists(readmePath)).toBe(true);

    const readmeContent = await readFile(readmePath, "utf-8");
    expect(readmeContent).toContain("react-patterns");
    expect(readmeContent).toContain("React design patterns and best practices");

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe("Integration: Import --dry-run Does Not Affect Compilation", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-import-dryrun-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it("should not create importable skills in dry-run mode", async () => {
    await createLocalSource(projectDir, [IMPORT_REACT_PATTERNS_SKILL]);

    const { error } = await runCliCommand([
      "import:skill",
      LOCAL_SOURCE_NAME,
      "--skill",
      "react-patterns",
      "--dry-run",
    ]);
    expect(error?.oclif?.exit).toBeUndefined();

    // Skills should not have been created
    const importedDir = path.join(projectDir, LOCAL_SKILLS_DIR, "react-patterns");
    expect(await directoryExists(importedDir)).toBe(false);

    // No skills to compile
    const skillsDir = path.join(projectDir, LOCAL_SKILLS_DIR);
    expect(await directoryExists(skillsDir)).toBe(false);
  });
});

describe("Integration: Import Error Recovery", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-import-error-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it("should error when importing nonexistent skill from valid source", async () => {
    await createLocalSource(projectDir, [IMPORT_REACT_PATTERNS_SKILL]);

    const { error } = await runCliCommand([
      "import:skill",
      LOCAL_SOURCE_NAME,
      "--skill",
      "nonexistent-skill",
    ]);

    expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
  });

  it("should import valid skills even when source has mixed content", async () => {
    // Create a source with one valid skill and one directory without SKILL.md
    await createLocalSource(projectDir, [IMPORT_REACT_PATTERNS_SKILL]);

    // Add a directory without SKILL.md (invalid skill)
    const invalidDir = path.join(projectDir, LOCAL_SOURCE_NAME, "skills", "invalid-skill");
    await mkdir(invalidDir, { recursive: true });
    await writeFile(path.join(invalidDir, "README.md"), "# Not a skill\n");

    // --list should only show valid skills
    const { error: listError, stdout: listStdout } = await runCliCommand([
      "import:skill",
      LOCAL_SOURCE_NAME,
      "--list",
    ]);
    expect(listError?.oclif?.exit).toBeUndefined();
    expect(listStdout).toContain("react-patterns");
    expect(listStdout).not.toContain("invalid-skill");

    // Import the valid skill
    const { error: importError } = await runCliCommand([
      "import:skill",
      LOCAL_SOURCE_NAME,
      "--skill",
      "react-patterns",
    ]);
    expect(importError?.oclif?.exit).toBeUndefined();

    // Compile it
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const importedDir = path.join(projectDir, LOCAL_SKILLS_DIR, "react-patterns");
    const outputDir = path.join(tempDir, "plugins");
    await mkdir(outputDir, { recursive: true });

    const result = await compileSkillPlugin({
      skillPath: importedDir,
      outputDir,
    });

    expect(result.skillName).toBe("react-patterns");

    const validation = await validatePlugin(result.pluginPath);
    expect(validation.valid).toBe(true);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("should produce unique plugin names when importing skills with distinct names", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await createLocalSource(projectDir, [IMPORT_REACT_PATTERNS_SKILL, IMPORT_TESTING_UTILS_SKILL]);

    await runCliCommand(["import:skill", LOCAL_SOURCE_NAME, "--all"]);

    const importedSkillsDir = path.join(projectDir, LOCAL_SKILLS_DIR);
    const outputDir = path.join(tempDir, "plugins");
    await mkdir(outputDir, { recursive: true });

    const results = await compileAllSkillPlugins(importedSkillsDir, outputDir);

    const names = results.map((r) => r.manifest.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
